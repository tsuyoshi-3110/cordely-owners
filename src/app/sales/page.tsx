// app/estimateOrders/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAtomValue } from "jotai";
import { siteSettingsAtom } from "@/lib/atoms/siteSettingsAtom";
import { db } from "@/lib/firebase";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  where,
} from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { useSetAtom } from "jotai";
import { currentOrderIdAtom } from "@/lib/atoms/routeAtoms";

type OrderItem = {
  productId: number;
  name: string;
  quantity: number;
  subtotal: number;
};

type OrderDoc = {
  id: string;
  orderNo: number;
  items: OrderItem[];
  totalItems: number;
  totalPrice: number;
  createdAt: Timestamp;
  siteKey?: string;
  isComp?: boolean;
};

export default function EstimateOrdersPage() {
  const router = useRouter();
  const site = useAtomValue(siteSettingsAtom);
  const siteKey = site?.siteKey ?? site?.id ?? "";

  const [orders, setOrders] = useState<OrderDoc[]>([]);
  const [loading, setLoading] = useState(true);

  const setOrderId = useSetAtom(currentOrderIdAtom)

  // 完了(isComp=true)のみ、siteKeyで仕分け、作成日時の新しい順
  useEffect(() => {
    if (!siteKey) {
      setOrders([]);
      setLoading(false);
      return;
    }

    const qy = query(
      collection(db, "orders"),
      where("siteKey", "==", siteKey),
      where("isComp", "==", true),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(
      qy,
      (snap) => {
        const data: OrderDoc[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<OrderDoc, "id">),
        }));
        setOrders(data);
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setOrders([]);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [siteKey]);

  const handleDetail = () => {
    router.push("/salesDetail")
  }

  if (loading) {
    return (
      <div className="min-h-[100dvh] grid place-items-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-transparent" />
      </div>
    );
  }

  if (!siteKey) {
    return (
      <main className="mx-auto max-w-screen-lg px-4 py-20 text-center">
        <p className="text-sm text-gray-600">siteKey が未設定です。ログインし直してください。</p>
        <Link href="/login">
          <Button className="mt-4">ログインへ</Button>
        </Link>
      </main>
    );
  }

  return (
    <div className="relative">
      {/* 固定ヘッダー（グローバルNavbarが h-14 を想定） */}
      <header className="fixed inset-x-0 top-14 z-40 bg-gradient-to-r from-teal-500 to-pink-500 shadow-md">
        <div className="mx-auto flex h-14 max-w-screen-lg items-center px-4">
          <Button
            variant="ghost"
            className="text-white hover:text-white"
            onClick={() => router.back()}
          >
            {/* lucide の ChevronLeft を文字代替（アイコン入れてもOK） */}
            ←
          </Button>
          <h1 className="ml-2 text-white text-lg md:text-xl font-semibold">販売履歴一覧</h1>
        </div>
      </header>

      {/* 本文 */}
      <main className="mx-auto max-w-screen-lg px-4 pt-[120px] pb-10">
        {/* md以上: テーブル */}
        <div className="hidden md:block">
          <table className="w-full overflow-hidden rounded-md border text-left">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-lg font-semibold">注文No.</th>
                <th className="px-4 py-3 text-lg font-semibold">注文時間</th>
                <th className="px-4 py-3 text-lg font-semibold text-right">合計点数</th>
                <th className="px-4 py-3 text-lg font-semibold text-right">合計金額 (円)</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-base">{o.orderNo}</td>
                  <td className="px-4 py-3 text-base">
                    {o.createdAt?.toDate().toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right">{o.totalItems}</td>
                  <td className="px-4 py-3 text-right">
                    ¥{o.totalPrice.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button asChild size="sm" onClick={handleDetail}>
                      詳細
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* スマホ: カード */}
        <div className="flex flex-col gap-3 md:hidden">
          {orders.map((o) => (
            <div key={o.id} className="rounded-md border bg-white p-4 shadow-sm">
              <div className="mb-2 flex items-center justify-between">
                <p className="font-semibold">注文No. {o.orderNo}</p>
                <p className="text-sm text-gray-600">
                  {o.createdAt?.toDate().toLocaleString()}
                </p>
              </div>
              <div className="flex items-center justify-between">
                <p>点数: <b>{o.totalItems}</b></p>
                <p>金額: <b>¥{o.totalPrice.toLocaleString()}</b></p>
              </div>
              <Button asChild className="mt-3 w-full">
                <Link href={`/estimateOrders/${o.id}`}>詳細</Link>
              </Button>
            </div>
          ))}
        </div>

        {orders.length === 0 && (
          <div className="mt-10 grid place-items-center">
            <p className="text-sm text-gray-500">現在注文はありません</p>
          </div>
        )}
      </main>
    </div>
  );
}
