// app/material-price-setting/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useAtomValue } from "jotai";
import { siteSettingsAtom } from "@/lib/atoms/siteSettingsAtom";
import { db, storage } from "@/lib/firebase";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";

type UIProduct = {
  docId: string;
  productId: number;
  name: string;
  price: number;
  imageUri: string;
  soldOut: boolean;
  description: string;
};

export default function MaterialPriceSetting() {
  const site = useAtomValue(siteSettingsAtom);
  const siteKey = site?.siteKey ?? site?.id ?? "";

  const [products, setProducts] = useState<UIProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [pickedFiles, setPickedFiles] = useState<Record<string, File | null>>({});
  const [fileResetKey, setFileResetKey] = useState<Record<string, string>>({});

  // 購読（siteKey で仕分け）
  useEffect(() => {
    if (!siteKey) {
      setProducts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const qy = query(
      collection(db, "products"),
      where("siteKey", "==", siteKey),
      orderBy("name", "asc") // 必要なら productId に変更可
    );
    const unsub = onSnapshot(
      qy,
      (snap) => {
        const rows: UIProduct[] = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            docId: d.id,
            productId: Number(data.productId ?? 0),
            name: String(data.name ?? ""),
            price: Number(data.price ?? 0),
            imageUri: String(data.imageUri ?? ""),
            soldOut: Boolean(data.soldOut ?? false),
            description: String(data.description ?? ""),
          };
        });
        setProducts(rows);
        setLoading(false);
      },
      (err) => {
        console.error("onSnapshot error:", err);
        setProducts([]);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [siteKey]);

  const handlePick = (docId: string, file: File) => {
    setPickedFiles((p) => ({ ...p, [docId]: file }));
  };

  const handleToggleSoldOut = async (p: UIProduct) => {
    try {
      await updateDoc(doc(db, "products", p.docId), { soldOut: !p.soldOut });
      setProducts((prev) =>
        prev.map((x) => (x.docId === p.docId ? { ...x, soldOut: !x.soldOut } : x))
      );
    } catch (e) {
      console.error(e);
      alert("更新に失敗しました");
    }
  };

  const handleUpdate = async (p: UIProduct) => {
    try {
      setUpdatingId(p.docId);

      // 画像アップロード（選択があれば）
      let imageUri = p.imageUri;
      const f = pickedFiles[p.docId];
      if (f) {
        const storageRef = ref(storage, `products/${siteKey}/${p.productId}_${f.name}`);
        const snap = await uploadBytes(storageRef, f);
        imageUri = await getDownloadURL(snap.ref);
      }

      // Firestore 更新
      await updateDoc(doc(db, "products", p.docId), {
        name: p.name,
        price: Number(p.price) || 0,
        description: p.description ?? "",
        imageUri,
      });

      // ローカル反映 & file input リセット
      setProducts((prev) =>
        prev.map((x) => (x.docId === p.docId ? { ...x, imageUri } : x))
      );
      setPickedFiles((prev) => ({ ...prev, [p.docId]: null }));
      setFileResetKey((prev) => ({ ...prev, [p.docId]: String(Date.now()) }));
      alert("更新しました");
    } catch (e) {
      console.error(e);
      alert("更新に失敗しました");
    } finally {
      setUpdatingId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[100dvh] grid place-items-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-transparent" />
      </div>
    );
  }

  if (!siteKey) {
    return (
      <main className="mx-auto max-w-screen-md px-4 py-20 text-center">
        <p className="text-sm text-gray-600">
          siteKey が未設定です。ログインし直してください。
        </p>
      </main>
    );
  }

  return (
    <div className="relative">
      {/* グローバルNavbarが h-14 を想定 → その下に固定ヘッダー */}
      <header className="fixed inset-x-0 top-14 z-40 bg-gradient-to-r from-teal-500 to-pink-500 shadow-md">
        <div className="mx-auto flex h-14 max-w-screen-lg items-center px-4">
          <h1 className="text-white text-lg md:text-xl font-semibold">商品価格・画像編集</h1>
        </div>
      </header>

      <main className="mx-auto max-w-screen-lg px-4 pt-[120px] pb-10">
        <div className="grid grid-cols-1 gap-6">
          {products.map((p) => (
            <div key={p.docId} className="rounded-md border bg-white p-4 shadow-sm">
              {/* 画像 + 売切オーバーレイ */}
              <div className="relative flex items-center justify-center">
                {p.imageUri ? (
                  <Image
                    src={p.imageUri}
                    alt={p.name}
                    width={320}
                    height={320}
                    className="h-48 w-48 rounded-md object-cover"
                  />
                ) : (
                  <div className="grid h-48 w-48 place-items-center rounded-md bg-gray-100 text-gray-500">
                    No Image
                  </div>
                )}

                {p.soldOut && (
                  <Image
                    src="/images/soldOut.png" // 置き場所に合わせて調整
                    alt="売り切れ"
                    width={180}
                    height={80}
                    className="pointer-events-none absolute opacity-85"
                  />
                )}
              </div>

              <div className="mt-4 grid gap-3">
                {/* 画像アップロード */}
                <div className="grid gap-2">
                  <Label>新しい画像を選択（省略可）</Label>
                  <Input
                    key={fileResetKey[p.docId]}
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handlePick(p.docId, f);
                    }}
                  />
                </div>

                {/* 名称 */}
                <div className="grid gap-2">
                  <Label>商品名</Label>
                  <Input
                    value={p.name}
                    onChange={(e) =>
                      setProducts((prev) =>
                        prev.map((x) => (x.docId === p.docId ? { ...x, name: e.target.value } : x))
                      )
                    }
                  />
                </div>

                {/* 価格 */}
                <div className="grid gap-2 max-w-[200px]">
                  <Label>価格（円）</Label>
                  <Input
                    inputMode="numeric"
                    value={Number.isFinite(p.price) ? String(p.price) : ""}
                    onChange={(e) =>
                      setProducts((prev) =>
                        prev.map((x) =>
                          x.docId === p.docId ? { ...x, price: Number(e.target.value || 0) } : x
                        )
                      )
                    }
                  />
                </div>

                {/* 説明文 */}
                <div className="grid gap-2">
                  <Label>説明文</Label>
                  <Textarea
                    placeholder="商品の説明を入力（省略可）"
                    value={p.description}
                    onChange={(e) =>
                      setProducts((prev) =>
                        prev.map((x) =>
                          x.docId === p.docId ? { ...x, description: e.target.value } : x
                        )
                      )
                    }
                    className="min-h-[160px]"
                  />
                </div>

                <Separator className="my-1" />

                <div className="flex items-center justify-between gap-2">
                  <Button
                    variant={p.soldOut ? "destructive" : "secondary"}
                    onClick={() => handleToggleSoldOut(p)}
                  >
                    {p.soldOut ? "売り切れ" : "販売中"}
                  </Button>

                  <Button
                    onClick={() => handleUpdate(p)}
                    disabled={updatingId === p.docId}
                  >
                    {updatingId === p.docId ? "更新中..." : "更新"}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {products.length === 0 && (
          <div className="mt-10 grid place-items-center text-sm text-gray-500">
            現在商品がありません
          </div>
        )}
      </main>
    </div>
  );
}
