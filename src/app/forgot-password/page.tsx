"use client";

import { auth } from "@/lib/firebase";
import { FirebaseError } from "firebase/app";
import { sendPasswordResetEmail } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function Page() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0); // 再送クールダウン（秒）

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const handleSendReset = async () => {
    setMessage("");
    setIsSuccess(false);

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setMessage("正しいメールアドレスを入力してください。");
      return;
    }

    setLoading(true);
    try {
      // いちばん簡単な方法：actionCodeSettings を渡さず、Firebaseのデフォルト画面で再設定
      await sendPasswordResetEmail(auth, email);

      setIsSuccess(true);
      setMessage(
        "✅ パスワード再設定用のメールを送信しました。メール内のリンクから手続きを完了してください。"
      );
      setCooldown(60); // 60秒の再送クールダウン
    } catch (err) {
      console.error(err);
      setIsSuccess(false);
      if (err instanceof FirebaseError) {
        switch (err.code) {
          case "auth/user-not-found":
            setMessage(
              "このメールアドレスのユーザーが見つかりませんでした。入力内容をご確認ください。"
            );
            break;
          case "auth/invalid-email":
            setMessage("メールアドレスの形式が正しくありません。");
            break;
          case "auth/too-many-requests":
            setMessage(
              "短時間にリクエストが多すぎます。しばらく時間をおいてから再度お試しください。"
            );
            break;
          case "auth/network-request-failed":
            setMessage("ネットワークエラーが発生しました。接続をご確認ください。");
            break;
          default:
            setMessage(`エラーが発生しました: ${err.message}`);
        }
      } else {
        setMessage("予期しないエラーが発生しました。もう一度お試しください。");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/login");
    }
  };

  return (
    <div className="max-w-xl mx-auto bg-white p-6 rounded shadow space-y-4 pt-20">
      <h2 className="text-xl font-bold text-center">パスワード再設定</h2>
      <p className="text-sm text-gray-600 text-center">
        登録済みのメールアドレスを入力すると、再設定用リンクを送信します。
      </p>

      <input
        type="email"
        placeholder="メールアドレス"
        className="w-full border px-3 py-2 rounded"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      <button
        onClick={handleSendReset}
        disabled={loading || cooldown > 0}
        className="bg-blue-600 text-white w-full py-2 rounded disabled:opacity-50"
      >
        {loading
          ? "送信中…"
          : cooldown > 0
          ? `再送まで ${cooldown}s`
          : "再設定メールを送る"}
      </button>

      <button
        onClick={handleClose}
        className="text-center underline text-sm text-gray-600 w-full mt-2"
      >
        閉じる
      </button>

      {message && (
        <p
          className={`mt-2 text-sm text-center ${
            isSuccess ? "text-green-600" : "text-red-600"
          }`}
        >
          {message}
        </p>
      )}

      <div className="text-md text-gray-500 text-center">
        ※ メールが見当たらない場合は迷惑メールフォルダもご確認ください。
      </div>
    </div>
  );
}
