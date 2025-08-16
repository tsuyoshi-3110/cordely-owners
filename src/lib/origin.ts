// utils/origin.ts (サーバー専用)
export function getBaseUrl() {
  // 1) 明示設定があればそれを使う（末尾スラッシュは削る）
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "");
  if (explicit) return explicit;

  // 2) Vercelのプレビュー/本番では VERCEL_URL が入る（プロトコル無）
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;

  // 3) ローカル
  return "http://localhost:3000";
}
