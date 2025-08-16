// app/api/stripe/create-checkout-session/route.ts
import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { adminDb } from "@/lib/firebase-admin";
import { getBaseUrl } from "@/lib/origin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";



export async function POST(req: NextRequest) {

  try {
    const { siteKey } = await req.json();
    if (!siteKey || typeof siteKey !== "string") {
      return NextResponse.json({ error: "siteKey required" }, { status: 400 });
    }

    const appUrl = getBaseUrl();

    // ここは「siteSettings/{siteKey}」という *docID=siteKey* 前提です
    // もし docID が別なら、query で探すように変更してください。
    const snap = await adminDb.doc(`siteSettings/${siteKey}`).get();
    if (!snap.exists) {
      return NextResponse.json({ error: "siteKey not found" }, { status: 404 });
    }

    const priceId = process.env.STRIPE_DEFAULT_PRICE_ID;
    if (!priceId) {
      return NextResponse.json({ error: "STRIPE_DEFAULT_PRICE_ID missing" }, { status: 500 });
    }

    const customerId = snap.data()?.stripeCustomerId as string | undefined;
    if (!customerId) {
      return NextResponse.json({ error: "customer not found" }, { status: 400 });
    }

    // 既に有効なら新規セッションは作らない（任意）
    const existing = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 10,
    });
    const active = existing.data.find(
      (s) => (s.status === "active" || s.status === "trialing") && !s.cancel_at_period_end
    );
    if (active) {
      return NextResponse.json({
        message: "already active",
        subscriptionId: active.id,
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: { siteKey },
      // 必要に応じて:
      // billing_address_collection: "auto",
      // allow_promotion_codes: true,
      success_url: `${appUrl}/?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("create-checkout-session error:", err);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
