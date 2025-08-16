// src/app/api/stripe/create-checkout-session/route.ts
import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { adminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { siteKey } = await req.json();

    const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "");
    const priceId = process.env.STRIPE_DEFAULT_PRICE_ID;
    if (!appUrl) throw new Error("ENV: NEXT_PUBLIC_APP_URL missing");
    if (!priceId) throw new Error("ENV: STRIPE_DEFAULT_PRICE_ID missing");

    const snap = await adminDb.doc(`siteSettings/${siteKey}`).get();
    if (!snap.exists) throw new Error(`siteSettings/${siteKey} not found`);

    const data = snap.data() || {};
    const customerId: string | undefined = data.stripeCustomerId;
    const ownerEmail: string | undefined = data.ownerEmail;

    // customerId があれば指定、無ければ省略（Stripe が自動で Customer 作成）
    const params: any = {
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: { siteKey },
      success_url: `${appUrl}/?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}`,
    };
    if (customerId) params.customer = customerId;
    if (!customerId && ownerEmail) params.customer_email = ownerEmail;

    const session = await stripe.checkout.sessions.create(params);
    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error("[create-checkout-session] error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Internal Error" },
      { status: 500 }
    );
  }
}
