// app/orders/detail/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useAtomValue } from "jotai";
import { currentOrderIdAtom } from "@/lib/atoms/routeAtoms";
import { siteSettingsAtom } from "@/lib/atoms/siteSettingsAtom";
import { db } from "@/lib/firebase";
import { doc, getDoc, Timestamp } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useRouter } from "next/navigation";

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
  const router = useRouter();
  const id = useAtomValue(currentOrderIdAtom);            // ✅ ここが唯一の id 入力
  const site = useAtomValue(siteSettingsAtom);
  const mySiteKey = site?.siteKey ?? site?.id ?? "";

  const [order, setOrder] = useState<OrderDoc | null>(null);
  const [deny, setDeny] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // id から Firestore を取得
  useEffect(() => {
    (async () => {
      if (!id) {
        setDeny("注文ID が未設定です（一覧から入り直してください）。");
        setLoading(false);
        return;
      }
      try {
        const snap = await getDoc(doc(db, "orders", id));
        if (!snap.exists()) {
          setDeny("注文データが見つかりません。");
          return;
        }
        const data = snap.data() as Omit<OrderDoc, "id">;

        // siteKey ガード
        if (mySiteKey && data.siteKey && data.siteKey !== mySiteKey) {
          setDeny("この注文にはアクセスできません（siteKey が一致しません）。");
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
  }, [id, mySiteKey]);

  const createdAt = useMemo(() => {
    if (!order) return "";
    const d =
      order.createdAt instanceof Timestamp
        ? order.createdAt.toDate()
        : new Date(order.createdAt);
    return d.toLocaleString();
  }, [order]);

  if (loading) {
    return (
      <div className="min-h-[100dvh] grid place-items-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-transparent" />
      </div>
    );
  }

  if (deny || !order) {
    return (
      <main className="mx-auto max-w-md px-4 py-20 text-center">
        <p className="text-sm text-gray-600">{deny ?? "注文データがありません。"}</p>
        <Button className="mt-4" onClick={() => router.back()}>
          戻る
        </Button>
      </main>
    );
  }

  return (
    <div className="relative">
      {/* グローバル Navbar が h-14 想定 */}
      <header className="fixed inset-x-0 top-14 z-40 bg-gradient-to-r from-teal-500 to-pink-500 shadow-md">
        <div className="mx-auto flex h-14 max-w-screen-md items-center px-4">
          <Button
            variant="ghost"
            className="text-white hover:text-white"
            onClick={() => router.back()}
          >
            ←
          </Button>
          <h1 className="ml-2 text-white text-lg font-semibold">
            注文 No.{order.orderNo}
          </h1>
        </div>
      </header>

      <main className="mx-auto max-w-screen-md px-4 pt-[120px] pb-10">
        <div className="rounded-md border bg-white p-5 shadow-sm">
          <div className="space-y-1">
            <p>日時: {createdAt}</p>
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
        </div>
      </main>
    </div>
  );
}
