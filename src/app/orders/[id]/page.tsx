// app/orders/[id]/page.tsx
"use client";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { orderIdAtom } from "@/lib/atoms/routeAtoms";
import { siteSettingsAtom } from "@/lib/atoms/siteSettingsAtom";
import { db } from "@/lib/firebase";
import { doc, getDoc, Timestamp, updateDoc } from "firebase/firestore";
import { useAtomValue } from "jotai";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type OrderItem = {
  productId: number;
  name: string;
  quantity: number;
  subtotal?: number;
};

type OrderDoc = {
  id: string;
  orderNo: number;
  items: OrderItem[];
  totalItems: number;
  totalPrice: number;
  createdAt: Timestamp | number;
  siteKey?: string;
  isComp?: boolean;
};

export default function OrderDetailPage() {
  const id = useAtomValue(orderIdAtom);
  const router = useRouter();

  const site = useAtomValue(siteSettingsAtom);
  const siteKey = site?.siteKey ?? site?.id ?? "";

  const [order, setOrder] = useState<OrderDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [deny, setDeny] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // 取得
  useEffect(() => {
    (async () => {
      if (!id) return;
      try {
        const snap = await getDoc(doc(db, "orders", id));
        if (!snap.exists()) {
          setDeny("注文データが見つかりません。");
          setLoading(false);
          return;
        }
        const data = snap.data() as Omit<OrderDoc, "id">;
        // siteKey の整合性チェック
        if (siteKey && data.siteKey && data.siteKey !== siteKey) {
          setDeny("この注文にはアクセスできません（siteKey が一致しません）。");
          setLoading(false);
          return;
        }
        setOrder({ id: snap.id, ...data });
      } catch (e) {
        console.error(e);
        setDeny("読み込み中にエラーが発生しました。");
      } finally {
        setLoading(false);
      }
    })();
  }, [id, siteKey]);

  const createdAtDate = useMemo(() => {
    if (!order) return null;
    return order.createdAt instanceof Timestamp
      ? order.createdAt.toDate()
      : new Date(order.createdAt);
  }, [order]);

  const handleComp = async () => {
    if (!order?.id) return;
    // 二重ガード：siteKey がズレていたら弾く
    if (siteKey && order.siteKey && order.siteKey !== siteKey) {
      setDeny("この注文にはアクセスできません（siteKey が一致しません）。");
      return;
    }
    try {
      setSaving(true);
      await updateDoc(doc(db, "orders", order.id), { isComp: true });
      router.back();
    } catch (e) {
      console.error(e);
      alert("完了処理に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  // ---- UI ----
  if (loading) {
    return (
      <div className="min-h-[100dvh] grid place-items-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-transparent" />
      </div>
    );
  }

  if (!siteKey) {
    return (
      <main className="mx-auto max-w-md px-4 py-20 text-center">
        <p className="text-sm text-gray-600">
          siteKey が未設定です。ログインし直してください。
        </p>
        <Link href="/login">
          <Button className="mt-4">ログインへ</Button>
        </Link>
      </main>
    );
  }

  if (deny) {
    return (
      <main className="mx-auto max-w-md px-4 py-20 text-center">
        <p className="text-sm text-gray-600">{deny}</p>
        <Button className="mt-4" onClick={() => router.back()}>
          戻る
        </Button>
      </main>
    );
  }

  if (!order) {
    return (
      <main className="mx-auto max-w-md px-4 py-20 text-center">
        <p className="text-sm text-gray-600">注文データが見つかりません。</p>
        <Button className="mt-4" onClick={() => router.back()}>
          戻る
        </Button>
      </main>
    );
  }

  return (
    <div className="relative">
      {/* 固定ヘッダー（グローバルNavbarが h-14 想定） */}
      <header className="fixed inset-x-0 top-14 z-40 bg-gradient-to-r from-teal-500 to-pink-500 shadow-md relative">
        {/* 画面の一番左端に配置される戻るボタン */}
        <Button
          variant="ghost"
          className="absolute left-2 top-1/2 -translate-y-1/2 text-white hover:text-white"
          onClick={() => router.back()}
          aria-label="戻る"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>

        {/* 中央にタイトル（幅はコンテナで制限） */}
        <div className="mx-auto flex h-14 max-w-screen-md items-center justify-center">
          <h1 className="text-white text-lg font-semibold">
            注文 No.{order.orderNo}
          </h1>
        </div>
      </header>

      <main className="mx-auto max-w-screen-md px-4 pt-[120px] pb-10">
        <div className="rounded-md border bg-white p-5 shadow-sm">
          <div className="space-y-1">
            <p>日時: {createdAtDate?.toLocaleString()}</p>
            <p>合計点数: {order.totalItems}</p>
            <p>合計金額: ￥{order.totalPrice?.toLocaleString?.() ?? "不明"}</p>
          </div>

          <Separator className="my-4" />

          <h2 className="mb-2 text-lg font-semibold">内訳</h2>
          <ul className="space-y-2">
            {order.items.map((it, idx) => (
              <li key={`${it.productId}-${idx}`} className="text-base">
                {it.name} × {it.quantity} — ￥
                {typeof it.subtotal === "number"
                  ? it.subtotal.toLocaleString()
                  : "不明"}
              </li>
            ))}
          </ul>

          <Button
            className="mt-8 w-full"
            onClick={handleComp}
            disabled={saving || order.isComp}
          >
            {order.isComp ? "完了済み" : saving ? "処理中..." : "完了"}
          </Button>
        </div>
      </main>
    </div>
  );
}
