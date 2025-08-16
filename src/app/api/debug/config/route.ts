// src/app/api/debug/config/route.ts
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function has(v?: string) {
  return Boolean(v && v.trim().length > 0);
}
function looksLikePk(raw?: string) {
  if (!raw) return "missing";
  const s = raw.includes("\\n") ? raw.replace(/\\n/g, "\n") : raw;
  return s.startsWith("-----BEGIN PRIVATE KEY-----") && s.includes("\n")
    ? "ok"
    : "bad-format";
}

export async function GET() {
  const report = {
    vercelEnv: process.env.VERCEL_ENV ?? "unknown", // production / preview / development
    NEXT_PUBLIC_APP_URL: {
      set: has(process.env.NEXT_PUBLIC_APP_URL),
      valueHint: process.env.NEXT_PUBLIC_APP_URL?.slice(0, 40),
    },
    STRIPE_SECRET_KEY: {
      set: has(process.env.STRIPE_SECRET_KEY),
      prefix: process.env.STRIPE_SECRET_KEY?.slice(0, 3), // 例: "sk_"
    },
    STRIPE_DEFAULT_PRICE_ID: {
      set: has(process.env.STRIPE_DEFAULT_PRICE_ID),
      prefix: process.env.STRIPE_DEFAULT_PRICE_ID?.slice(0, 3),
    },
    FIREBASE_PROJECT_ID: {
      set: has(process.env.FIREBASE_PROJECT_ID),
      value: process.env.FIREBASE_PROJECT_ID,
    },
    FIREBASE_CLIENT_EMAIL: {
      set: has(process.env.FIREBASE_CLIENT_EMAIL),
      suffix: process.env.FIREBASE_CLIENT_EMAIL?.split("@")[1],
    },
    FIREBASE_PRIVATE_KEY: {
      set: has(process.env.FIREBASE_PRIVATE_KEY),
      format: looksLikePk(process.env.FIREBASE_PRIVATE_KEY),
    },
  };
  return NextResponse.json(report);
}
