// src/app/api/stripe/check-subscription/route.ts
import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { adminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const siteKey = req.nextUrl.searchParams.get("siteKey");
    if (!siteKey) {
      return NextResponse.json({ status: "none", error: "missing siteKey" }, { status: 400 });
    }

    const snap = await adminDb.doc(`siteSettings/${siteKey}`).get();
    const data = snap.data() ?? {};
    const isFreePlan = data.isFreePlan === true;
    const setupMode  = data.setupMode === true;
    const customerId =
      typeof data.stripeCustomerId === "string" ? (data.stripeCustomerId as string) : undefined;

    if (setupMode) return NextResponse.json({ status: "setup_mode" });
    if (isFreePlan || !customerId) return NextResponse.json({ status: "none" });

    const subs = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 10,
    });

    const hasActive  = subs.data.some(s => (s.status === "active" || s.status === "trialing") && !s.cancel_at_period_end);
    const hasPending = subs.data.some(s => (s.status === "active" || s.status === "trialing") &&  s.cancel_at_period_end);
    const hasCanceled= subs.data.some(s => s.status === "canceled");

    const status = hasActive ? "active" : hasPending ? "pending_cancel" : hasCanceled ? "canceled" : "none";
    return NextResponse.json({ status });
  } catch (err: any) {
    console.error("check-subscription error:", err);
    return NextResponse.json(
      { status: "none", error: err?.message ?? "internal error" },
      { status: 500 }
    );
  }
}
