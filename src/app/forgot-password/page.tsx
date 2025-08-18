// src/app/forgot-password/page.tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { sendPasswordResetEmail } from "firebase/auth";
import { FirebaseError } from "firebase/app";
import { auth } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<{ text: string; kind: "info" | "error" } | null>(null);
  const [loading, setLoading] = useState(false);

  const isEmailValid = (v: string) => !!v && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

  const handleReset = async () => {
    const addr = email.trim();
    setMsg(null);
    if (!isEmailValid(addr)) {
      setMsg({ text: "正しいメールアドレスを入力してください。", kind: "error" });
      return;
    }
    try {
      setLoading(true);
      // 事前チェックはしない（列挙防止対策のため）
      await sendPasswordResetEmail(auth, addr);
      setMsg({
        text: "パスワード再設定用のメールを送信しました。届かない場合は迷惑メールをご確認ください。",
        kind: "info",
      });
    } catch (e) {
      console.error(e);
      const fe = e as FirebaseError;
      if (fe.code === "auth/operation-not-allowed") {
        setMsg({ text: "Email/Password のサインイン方法が無効です。コンソールで有効化してください。", kind: "error" });
      } else if (fe.code === "auth/invalid-email") {
        setMsg({ text: "メールアドレスの形式が正しくありません。", kind: "error" });
      } else {
        setMsg({ text: "送信に失敗しました。時間をおいて再度お試しください。", kind: "error" });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => (history.length > 1 ? router.back() : router.push("/login"));

  return (
    <div className="max-w-md mx-auto p-6 space-y-3">
      <h2 className="text-xl font-bold text-center">パスワードをリセット</h2>
      <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
      <Button onClick={handleReset} disabled={loading || !isEmailValid(email)} className="w-full">
        {loading ? "送信中…" : "リセットメール送信"}
      </Button>
      {msg && (
        <p className={`text-center text-sm ${msg.kind === "error" ? "text-red-600" : "text-gray-700"}`}>{msg.text}</p>
      )}
      <Button variant="outline" onClick={handleClose} className="w-full">閉じる</Button>
    </div>
  );
}
