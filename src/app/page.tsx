// app/orders/page.tsx
"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { orderIdAtom } from "@/lib/atoms/routeAtoms";
import { siteSettingsAtom } from "@/lib/atoms/siteSettingsAtom";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
} from "firebase/firestore";
import { useAtomValue, useSetAtom } from "jotai";
import { DollarSign, FileText } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

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

export default function Home() {
  const router = useRouter();
  const site = useAtomValue(siteSettingsAtom);
  const siteKey = site?.siteKey ?? site?.id ?? "";

  const [orders, setOrders] = useState<OrderDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalQuan, setTotalQuan] = useState(0);
  const [totalPrice, setTotalPrice] = useState(0);

  const [sumDialogOpen, setSumDialogOpen] = useState(false);
  const [totalSum, setTotalSum] = useState(0);

  // ← 追加: OPEN/CLOSE 状態（Firestore と同期）
  const [isOpen, setIsOpen] = useState<boolean | null>(null);

  const setOrderId = useSetAtom(orderIdAtom);

  // === 未ログインなら /login に自動リダイレクト ===
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setLoading(false);
        router.replace("/login?next=/orders");
      }
    });
    return () => unsub();
  }, [router]);

  // === OPEN/CLOSE 状態を購読（siteSettingsEditable/{siteKey}.isOpen） ===
  useEffect(() => {
    if (!siteKey) {
      setIsOpen(true); // siteKey 未確定のときは一旦 OPEN 扱い
      return;
    }
    const ref = doc(db, "siteSettingsEditable", siteKey);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        const data = snap.data() as { isOpen?: boolean } | undefined;
        setIsOpen(data?.isOpen ?? true); // 未設定なら OPEN
      },
      (e) => {
        console.error("isOpen onSnapshot error:", e);
        setIsOpen(true);
      }
    );
    return () => unsub();
  }, [siteKey]);

  // ---- Realtime: 未完了(isComp=false) + siteKey で購読
  useEffect(() => {
    if (!siteKey) {
      setOrders([]);
      setTotalQuan(0);
      setTotalPrice(0);
      setLoading(false);
      return;
    }

    const qy = query(
      collection(db, "orders"),
      where("siteKey", "==", siteKey),
      where("isComp", "==", false)
    );

    const unsub = onSnapshot(
      qy,
      (snap) => {
        const data: OrderDoc[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<OrderDoc, "id">),
        }));

        const toMillis = (t: any) =>
          typeof t?.toMillis === "function" ? t.toMillis() : 0;

        data.sort((a, b) => toMillis(a.createdAt) - toMillis(b.createdAt));

        setOrders(data);
        setLoading(false);

        const count = data.reduce((s, o) => s + (o.totalItems ?? 0), 0);
        const price = data.reduce((s, o) => s + (o.totalPrice ?? 0), 0);
        setTotalQuan(count);
        setTotalPrice(price);
      },
      (err) => {
        console.error("orders onSnapshot error:", err);
        setOrders([]);
        setTotalQuan(0);
        setTotalPrice(0);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [siteKey]);

  // ---- 完了(isComp=true) の売上合計 (siteKey で絞る)
  const fetchCompletedSum = async () => {
    if (!siteKey) return 0;
    const qy = query(
      collection(db, "orders"),
      where("siteKey", "==", siteKey),
      where("isComp", "==", true)
    );
    const snap = await getDocs(qy);
    return snap.docs.reduce((sum, d) => {
      const v = (d.data() as any).totalPrice;
      return sum + (typeof v === "number" ? v : 0);
    }, 0);
  };

  const openSumDialog = async () => {
    const sum = await fetchCompletedSum();
    setTotalSum(sum);
    setSumDialogOpen(true);
  };

  const handleDetail = (id: string) => {
    setOrderId(id);
    router.push(`/orders/${id}`);
  };

  // ← 追加: OPEN/CLOSE トグル（Firestore に保存）
  const toggleOpen = async () => {
    if (!siteKey || isOpen === null) return;
    const ref = doc(db, "siteSettingsEditable", siteKey);
    await setDoc(
      ref,
      {
        isOpen: !isOpen,
        isOpenUpdatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  };

  // ---- ローディング
  if (loading || isOpen === null) {
    return (
      <div className="min-h-[100dvh] grid place-items-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="relative">
      {/* 固定ヘッダー */}
      <header className="fixed inset-x-0 top-14 z-40 bg-gradient-to-r from-teal-500 to-pink-500 shadow-md">
        <div className="mx-auto flex h-14 max-w-screen-lg items-center px-4">
          <h1 className="text-white text-lg md:text-xl font-semibold">
            注文一覧
          </h1>

          {/* ← 追加: OPEN/CLOSE トグルボタン（ヘッダー左側） */}
          <div className="ml-4">
            <Button
              onClick={toggleOpen}
              className={
                (isOpen
                  ? "bg-emerald-500 hover:bg-emerald-600 text-white"
                  : "bg-rose-600 hover:bg-rose-700 text-white") +
                " fixed bottom-6 right-6 z-[1001] shadow-lg"
              }
              size="sm"
            >
              {isOpen ? "OPEN" : "CLOSE"}
            </Button>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <div className="flex md:hidden gap-1">
              <Link href="/estimateOrders">
                <Button
                  variant="ghost"
                  className="text-white hover:text-white"
                  size="icon"
                >
                  <FileText className="h-5 w-5" />
                </Button>
              </Link>
              <Button
                variant="ghost"
                className="text-white hover:text-white"
                size="icon"
                onClick={openSumDialog}
              >
                <DollarSign className="h-5 w-5" />
              </Button>
            </div>
            <div className="hidden md:flex gap-2">
              <Link href="/sales">
                <Button variant="ghost" className="text-white hover:text-white">
                  <FileText className="mr-2 h-4 w-4" />
                  販売履歴一覧
                </Button>
              </Link>
              <Button
                variant="ghost"
                className="text-white hover:text-white"
                onClick={openSumDialog}
              >
                <DollarSign className="mr-2 h-4 w-4" />
                売上
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* 本文 */}
      <main className="mx-auto max-w-screen-lg px-4 pt-[140px] pb-10">
        <div className="mb-4 flex items-center justify-between rounded-md border bg-gray-50 px-3 py-3 md:hidden">
          <p className="text-sm">
            合計点数: <b>{totalQuan}</b>
          </p>
          <p className="text-sm">
            合計金額: <b>¥{totalPrice.toLocaleString()}</b>
          </p>
        </div>

        <div className="hidden md:block">
          <table className="w-full overflow-hidden rounded-md border text-left">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-3 text-lg font-semibold">注文No.</th>
                <th className="px-4 py-3 text-lg font-semibold">注文時間</th>
                <th className="px-4 py-3 text-lg font-semibold text-right">
                  合計点数: {totalQuan}
                </th>
                <th className="px-4 py-3 text-lg font-semibold text-right">
                  合計金額: ¥{totalPrice.toLocaleString()}
                </th>
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
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => handleDetail(o.id)}
                    >
                      詳細
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* モバイル: カード表示 */}
        <div className="flex flex-col gap-3 md:hidden">
          {orders.map((o) => (
            <div
              key={o.id}
              className="rounded-md border bg-white p-4 shadow-sm hover:shadow transition"
            >
              <div className="mb-2 flex items-center justify-between">
                <p className="font-semibold">注文No. {o.orderNo}</p>
                <p className="text-sm text-gray-600">
                  {o.createdAt?.toDate().toLocaleString()}
                </p>
              </div>
              <div className="flex items-center justify-between">
                <p>
                  点数: <b>{o.totalItems}</b>
                </p>
                <p>
                  金額: <b>¥{o.totalPrice.toLocaleString()}</b>
                </p>
              </div>
              <Link href={`/orders/${o.id}`}>
                <Button className="mt-3 w-full">詳細</Button>
              </Link>
            </div>
          ))}
        </div>

        {orders.length === 0 && (
          <div className="mt-10 grid place-items-center">
            <p className="text-sm text-gray-500">現在注文はありません</p>
          </div>
        )}
      </main>

      {/* 売上合計 ダイアログ */}
      <Dialog open={sumDialogOpen} onOpenChange={setSumDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>売上合計</DialogTitle>
          </DialogHeader>
          <div className="py-2 text-center">
            <p className="text-2xl font-bold">¥{totalSum.toLocaleString()}</p>
          </div>
          <DialogFooter>
            <Button className="w-full" onClick={() => setSumDialogOpen(false)}>
              閉じる
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ← 追加: CLOSE オーバーレイ（CLOSE のとき全面に表示。タップで再オープン） */}
      {!isOpen && (
        <div
          className="fixed inset-0 z-[999] bg-black/70 backdrop-blur-sm grid place-items-center"
          onClick={toggleOpen}
        >
          <p className="text-white text-6xl md:text-9xl font-extrabold tracking-widest select-none">
            CLOSE
          </p>
        </div>
      )}
    </div>
  );
}
