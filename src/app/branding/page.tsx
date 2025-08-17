// app/branding/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db, storage } from "@/lib/firebase";
import { useAtomValue } from "jotai";
import { siteSettingsAtom } from "@/lib/atoms/siteSettingsAtom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Editable = {
  siteName?: string;
  logoUrl?: string | null;
};

export default function BrandingPage() {
  const site = useAtomValue(siteSettingsAtom); // 例: { id, siteKey, siteName, ...}
  const siteKey = site?.siteKey ?? site?.id ?? "";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [siteName, setSiteName] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);

  const canUse = useMemo(() => !!siteKey, [siteKey]);

  useEffect(() => {
    (async () => {
      if (!siteKey) {
        setLoading(false);
        return;
      }
      try {
        const snap = await getDoc(doc(db, "siteSettingsEditable", siteKey));
        const data = snap.data() as Editable | undefined;
        setSiteName(data?.siteName ?? "");
        setLogoUrl(data?.logoUrl ?? null);
      } finally {
        setLoading(false);
      }
    })();
  }, [siteKey]);

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    setFile(f);
  };

  const uploadLogo = async () => {
    if (!file || !siteKey) return;
    setSaving(true);
    setProgress(0);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `logos/${siteKey}/${Date.now()}.${ext}`;
      const storageRef = ref(storage, path);
      const task = uploadBytesResumable(storageRef, file, { contentType: file.type });

      await new Promise<void>((resolve, reject) => {
        task.on(
          "state_changed",
          (s) => setProgress(Math.round((s.bytesTransferred / s.totalBytes) * 100)),
          reject,
          () => resolve()
        );
      });

      const url = await getDownloadURL(storageRef);
      setLogoUrl(url);
      setFile(null);
      setProgress(null);

      await setDoc(
        doc(db, "siteSettingsEditable", siteKey),
        { logoUrl: url },
        { merge: true }
      );
      alert("ロゴを保存しました。");
    } catch (e) {
      console.error(e);
      alert("アップロードに失敗しました。");
      setProgress(null);
    } finally {
      setSaving(false);
    }
  };

  const removeLogo = async () => {
    if (!siteKey || !logoUrl) return;
    if (!confirm("ロゴを削除しますか？")) return;
    try {
      setSaving(true);
      // Storage から消す（URL → 参照パスに変換できない場合は Firestore だけ消す）
      try {
        // URL のまま deleteObject はできないため、/logos/${siteKey}/ で運用していれば
        // Firestore からもパスを保持するのが理想。ここでは URL のみの場合は skip。
        const u = new URL(logoUrl);
        if (u.hostname.includes("firebasestorage.googleapis.com")) {
          // 参照パスが分からないので削除スキップ（必要ならパスも保存してください）
        }
      } catch {}

      await setDoc(
        doc(db, "siteSettingsEditable", siteKey),
        { logoUrl: null },
        { merge: true }
      );
      setLogoUrl(null);
      alert("ロゴを削除しました。");
    } finally {
      setSaving(false);
    }
  };

  const saveSiteName = async () => {
    if (!siteKey) return;
    setSaving(true);
    try {
      await setDoc(
        doc(db, "siteSettingsEditable", siteKey),
        { siteName: siteName || "" },
        { merge: true }
      );
      alert("サイト名を保存しました。");
    } catch (e) {
      console.error(e);
      alert("保存に失敗しました。");
    } finally {
      setSaving(false);
    }
  };

  if (!canUse) {
    return (
      <main className="mx-auto max-w-md px-4 py-10">
        <h1 className="text-lg font-semibold mb-4">ブランディング</h1>
        <p className="text-sm text-gray-600">
          siteKey が未設定です。ログイン後に店舗を選択してください。
        </p>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="min-h-[60vh] grid place-items-center px-4">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-transparent" />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-4 py-6 space-y-6">
      <h1 className="text-lg font-semibold">ブランディング</h1>

      {/* サイト名 */}
      <section className="rounded-md border bg-white p-4 shadow-sm space-y-3">
        <h2 className="font-medium">サイト名</h2>
        <Input
          value={siteName}
          onChange={(e) => setSiteName(e.target.value)}
          placeholder="例）クレープ屋さん"
        />
        <Button onClick={saveSiteName} disabled={saving}>
          保存
        </Button>
      </section>

      {/* ロゴ */}
      <section className="rounded-md border bg-white p-4 shadow-sm space-y-4">
        <h2 className="font-medium">ロゴ画像</h2>

        {logoUrl ? (
          <div className="space-y-2">
            <div className="relative h-24 w-full">
              <Image
                src={logoUrl}
                alt="logo"
                fill
                className="object-contain"
                sizes="320px"
              />
            </div>
            <div className="flex gap-2">
              <label className="inline-flex items-center gap-2 rounded-md border px-3 py-2 cursor-pointer">
                変更する
                <input type="file" accept="image/*" className="hidden" onChange={onPick} />
              </label>
              <Button variant="destructive" onClick={removeLogo} disabled={saving}>
                削除
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-gray-600">ロゴ未設定です。</p>
            <label className="inline-flex items-center gap-2 rounded-md border px-3 py-2 cursor-pointer">
              画像を選択
              <input type="file" accept="image/*" className="hidden" onChange={onPick} />
            </label>
          </div>
        )}

        {file && (
          <div className="space-y-2">
            <p className="text-sm text-gray-600">{file.name}</p>
            <Button onClick={uploadLogo} disabled={saving}>
              {saving ? "アップロード中..." : "アップロードして保存"}
            </Button>
            {progress != null && (
              <div className="text-xs text-gray-600">進捗: {progress}%</div>
            )}
          </div>
        )}
      </section>

      <p className="text-xs text-gray-500">
        ※ アップロード後は、顧客ページのヘッダーにロゴが自動反映されます。
      </p>
    </main>
  );
}
