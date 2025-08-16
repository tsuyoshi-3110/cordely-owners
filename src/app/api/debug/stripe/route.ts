import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const hasSecret = !!process.env.STRIPE_SECRET_KEY;
    const hasPrice  = !!process.env.STRIPE_DEFAULT_PRICE_ID;
    let priceOk = false;
    if (hasPrice) {
      // 実在チェック（アクセス権/ID間違いを即発見）
      await stripe.prices.retrieve(process.env.STRIPE_DEFAULT_PRICE_ID!);
      priceOk = true;
    }
    return NextResponse.json({ ok: true, hasSecret, hasPrice, priceOk });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? String(e) }, { status: 500 });
  }
}
