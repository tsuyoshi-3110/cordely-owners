// app/login/page.tsx
"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { FirebaseError } from "firebase/app";
import { auth } from "@/lib/firebase";
import { useSetAtom } from "jotai";
import { siteSettingsAtom } from "@/lib/atoms/siteSettingsAtom";
import { fetchSiteSettingsByOwnerId } from "@/lib/fetchSiteSettings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

function messageFromAuthError(err: unknown) {
  if (err instanceof FirebaseError) {
    switch (err.code) {
      case "auth/invalid-credential":
      case "auth/wrong-password":
      case "auth/user-not-found":
        return "メールアドレスまたはパスワードが正しくありません。";
      case "auth/invalid-email":
        return "メールアドレスの形式が正しくありません。";
      case "auth/too-many-requests":
        return "試行回数が多すぎます。しばらく経ってから再度お試しください。";
      case "auth/network-request-failed":
        return "ネットワークエラーが発生しました。通信環境をご確認ください。";
      default:
        return `ログインに失敗しました（${err.code}）。`;
    }
  }
  return "ログインに失敗しました。もう一度お試しください。";
}

export default function LoginPage() {
  const router = useRouter();                 // ← トップレベルで呼び出し
  const setSiteSettings = useSetAtom(siteSettingsAtom);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const uid = cred.user.uid;

      const ss = await fetchSiteSettingsByOwnerId(uid);

      // siteSettings がない場合はログアウトさせる
      if (!ss || !ss.id) {
        await signOut(auth);
        setSiteSettings(null);
        toast.error(
          "サイト設定が見つかりません（ownerId と一致する siteSettings がありません）。"
        );
        return;
      }

      setSiteSettings(ss);
      toast.success(`ログイン成功（siteKey: ${ss.siteKey ?? ss.id}）`);
      router.push("/");                       // ← 成功したらホームへ遷移
    } catch (e: unknown) {
      toast.error(messageFromAuthError(e));   // ← エラー理由を表示
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.warning("メールアドレスとパスワードを入力してください。");
      return;
    }
    await handleLogin();
  };

  return (
    <div className="min-h-[100dvh] bg-gray-50 flex items-center justify-center px-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md rounded-lg border bg-white p-6 shadow-sm"
      >
        <div className="flex flex-col items-center gap-6">
          <Image
            src="/images/cordelyLogo.png"
            alt="Cordely"
            width={240}
            height={80}
            className="h-auto w-[160px] sm:w-[200px] md:w-[240px]"
            priority
          />

          <div className="w-full space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                inputMode="email"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="password">パスワード</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="パスワードを入力"
                autoComplete="current-password"
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={loading || !email || !password}
            >
              {loading ? "ログイン中..." : "ログイン"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
