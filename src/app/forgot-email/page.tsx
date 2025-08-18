// ForgotEmail.tsx
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  query,
  where,
  limit,
  DocumentData,
} from "firebase/firestore";
import {
  AsYouType,
  isValidPhoneNumber,
  parsePhoneNumberFromString,
} from "libphonenumber-js";

type Props = {
  onClose?: () => void;
  onEmailFound?: (email: string) => void;
};

export default function ForgotEmail({ onClose, onEmailFound }: Props) {
  const router = useRouter();

  const [phone, setPhone] = useState("");
  const [rawPhone, setRawPhone] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // ESCで閉じる
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && handleClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const handleClose = () => {
    if (onClose) return onClose();
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else router.push("/login");
  };

  // 電話番号の見た目と raw を更新
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digitsOnly = e.target.value.replace(/\D/g, "");
    const formatted = new AsYouType("JP").input(digitsOnly);
    setRawPhone(digitsOnly);
    setPhone(formatted);
  };

  // E.164 正規化 (+81…)
  const normalizeToE164 = (value: string) => {
    const parsed = parsePhoneNumberFromString(value, "JP");
    if (parsed && parsed.isValid()) return parsed.number; // E.164
    // フォールバック（数字だけ）
    return value.replace(/\D/g, "");
  };

  // 日本の番号として有効か
  const isPhoneValid = isValidPhoneNumber(phone || rawPhone, "JP");

  const handleSearch = async () => {
  setLoading(true);
  setEmail("");
  setError("");

  try {
    // 1) 正規化
    const normalizedE164 = normalizeToE164(phone || rawPhone);
    const normalizedDigits = normalizedE164.replace(/\D/g, "");

    // 2) まずはインデックスで速く検索（ownerPhoneE164 を用意している場合）
    const col = collection(db, "siteSettings");
    let found: DocumentData | null = null;

    try {
      const q1 = query(col, where("ownerPhoneE164", "==", normalizedE164), limit(1));
      const snap1 = await getDocs(q1);
      if (!snap1.empty) {
        found = snap1.docs[0].data();
      }
    } catch {
      // インデックス未作成やフィールド未整備時は無視（後で全件スキャン）
    }

    // 3) 見つからなければ全件スキャンで照合（小規模前提のフォールバック）
    if (!found) {
      const all = await getDocs(col);
      for (const d of all.docs) {
        const data = d.data() as {
          ownerPhone?: string;
          ownerPhoneE164?: string;
          ownerEmail?: string;
        };
        const candidate = data.ownerPhoneE164 ?? normalizeToE164(String(data.ownerPhone ?? ""));
        if (candidate && candidate.replace(/\D/g, "") === normalizedDigits) {
          found = data;
          break;
        }
      }
    }

    // 4) 結果
    if (found) {
      const foundEmail = (found.ownerEmail ?? "").trim();

      if (foundEmail) {
        setEmail(foundEmail);
        if (onEmailFound) onEmailFound(foundEmail);

        // ▼ ログイン画面プリフィル用に一時保存して遷移
        if (typeof window !== "undefined") {
          sessionStorage.setItem("prefillEmail", foundEmail);
        }
        router.replace("/login");
        return;
      } else {
        setEmail("（メールアドレスが未登録です）");
      }
    } else {
      setError("一致する電話番号が見つかりません。");
    }
  } catch (e) {
    console.error(e);
    setError("エラーが発生しました。");
  } finally {
    setLoading(false);
  }
};


  // 背景クリックで閉じる（中身クリックは閉じない）
  const onBackdropClick = () => handleClose();
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onBackdropClick}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-white w-full max-w-md rounded-lg p-6 shadow-lg space-y-4 mx-5"
        onClick={stop}
      >
        <h2 className="text-xl font-bold text-center">メールアドレスを忘れた場合</h2>
        <p className="text-sm text-gray-600 text-center">
          登録済みの電話番号を入力してください（例: 090-1234-5678）。
        </p>

        <Input
          type="tel"
          placeholder="例: 090-1234-5678"
          value={phone}
          onChange={handlePhoneChange}
          autoComplete="tel"
          inputMode="tel"
        />

        <Button
          type="button"
          onClick={handleSearch}
          className="w-full"
          disabled={loading || !isPhoneValid}
        >
          {loading ? "照合中…" : "メールアドレスを表示"}
        </Button>

        {email && (
          <p className="text-green-600 text-center text-sm break-words">
            登録メールアドレス：
            <br />
            <strong>{email}</strong>
          </p>
        )}
        {error && <p className="text-red-600 text-center text-sm">{error}</p>}

        <Button type="button" variant="outline" onClick={handleClose} className="w-full">
          閉じる
        </Button>
      </div>
    </div>
  );
}
