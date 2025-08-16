// src/components/subscription/SubscriptionOverlay.tsx
"use client";

import { useEffect, useState } from "react";
import CheckoutButton from "./CheckoutButton";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

type Status = "loading" | "paid" | "unpaid" | "pending" | "canceled" | "setup";

export default function SubscriptionOverlay({ siteKey }: { siteKey: string }) {
  const [status, setStatus] = useState<Status>("loading");
  const [isFreePlan, setIsFreePlan] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;

    const checkPayment = async () => {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const sessionId = urlParams.get("session_id");

        const apiUrl = sessionId
          ? `/api/stripe/verify-subscription?session_id=${sessionId}`
          : `/api/stripe/check-subscription?siteKey=${siteKey}`;

        // ← fetchはこれ1回だけ
        const response = await fetch(apiUrl, { cache: "no-store" });

        let json: any = null;
        const ct = response.headers.get("content-type") ?? "";
        if (ct.includes("application/json")) {
          json = await response.json();
        } else {
          throw new Error(`Non-JSON response: ${response.status}`);
        }

        if (cancelled) return;

        switch (json.status) {
          case "active":
            setStatus("paid");
            break;
          case "pending_cancel":
            setStatus("pending");
            break;
          case "canceled":
            setStatus("canceled");
            break;
          case "setup_mode":
            setStatus("setup");
            break;
          default:
            setStatus("unpaid");
        }

        // クエリ掃除
        if (sessionId) {
          const url = new URL(window.location.href);
          url.searchParams.delete("session_id");
          window.history.replaceState({}, "", url.toString());
        }
      } catch (e) {
        console.error("SubscriptionOverlay fetch error:", e);
        if (!cancelled) setStatus("unpaid"); // 失敗時は未払い扱いでオーバーレイ表示
      }
    };

    const fetchIsFreePlan = async () => {
      try {
        const snap = await getDoc(doc(db, "siteSettings", siteKey));
        setIsFreePlan(snap.exists() ? snap.data()?.isFreePlan === true : false);
      } catch {
        setIsFreePlan(false);
      }
    };

    checkPayment();
    fetchIsFreePlan();

    return () => {
      cancelled = true;
    };
  }, [siteKey]);

  // ローディング中は何も出さない
  if (isFreePlan === null || status === "loading") return null;
  // 無料プランは表示しない
  if (isFreePlan) return null;

  // 未払い系のみ表示
  if (!["setup", "paid", "pending"].includes(status)) {
    return (
      <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/90 p-6 text-white">
        <p className="mb-4 text-center text-lg">
          このページを表示するにはサブスクリプション登録が必要です。
        </p>
        <CheckoutButton siteKey={siteKey} />
      </div>
    );
  }

  return null;
}
