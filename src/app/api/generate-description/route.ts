// app/api/generate-description/route.ts
import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";            // Node実行
export const dynamic = "force-dynamic";     // キャッシュ無効

type ReqBody = {
  title?: string;
  keywords?: string[];
  siteKey?: string; // 使わない場合は無視されます（将来ログ用などに）
};

export async function POST(req: Request) {
  try {
    const { title, keywords }: ReqBody = await req.json();

    if (!title || !Array.isArray(keywords) || keywords.length === 0) {
      return NextResponse.json({ error: "bad request" }, { status: 400 });
    }

    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const prompt = [
      "あなたは飲食店のメニューコピーライターです。",
      "以下のタイトルとキーワードから、100文字程度の日本語の魅力的な説明文を1つだけ作成してください。",
      "箇条書きではなく1文で、記号は最小限に。",
      `- タイトル: ${title}`,
      `- キーワード: ${keywords.join(", ")}`,
    ].join("\n");

    const out = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
    });

    let description =
      out.choices?.[0]?.message?.content?.trim()?.replace(/\s+/g, " ") ?? "";

    // 念のため、長すぎる場合は軽くトリム
    if (description.length > 120) {
      description = description.slice(0, 118) + "…";
    }

    return NextResponse.json({ description });
  } catch (err) {
    console.error("generate-description error:", err);
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}

// （必要ならCORSを許可）同一オリジンからの呼び出しなら不要
export function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
