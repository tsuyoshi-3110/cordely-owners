import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // 読み取りできるか（存在しないコレクションでもOK）
    const snap = await adminDb.collection("siteSettings").limit(1).get();
    return NextResponse.json({ ok: true, canRead: true, count: snap.size });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? String(e) }, { status: 500 });
  }
}
