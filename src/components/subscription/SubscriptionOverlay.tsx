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
  const [hasCustomer, setHasCustomer] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;

    const checkPayment = async () => {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const sessionId = urlParams.get("session_id");

        const apiUrl = sessionId
          ? `/api/stripe/verify-subscription?session_id=${sessionId}`
          : `/api/stripe/check-subscription?siteKey=${siteKey}`;

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
          // "none"（顧客なし等）は未払い扱いに寄せる
          default:
            setStatus("unpaid");
        }

        if (sessionId) {
          const url = new URL(window.location.href);
          url.searchParams.delete("session_id");
          window.history.replaceState({}, "", url.toString());
        }
      } catch (e) {
        console.error("SubscriptionOverlay fetch error:", e);
        if (!cancelled) setStatus("unpaid"); // 失敗時は未払い扱い
      }
    };

    const fetchPlanAndCustomer = async () => {
      try {
        const snap = await getDoc(doc(db, "siteSettings", siteKey));
        if (!snap.exists()) {
          setIsFreePlan(false);
          setHasCustomer(false);
          return;
        }
        const data = snap.data() as any;
        setIsFreePlan(data.isFreePlan === true);
        const cid = data.stripeCustomerId;
        setHasCustomer(typeof cid === "string" && cid.trim().length > 0);
      } catch (e) {
        console.error("fetchPlanAndCustomer error:", e);
        setIsFreePlan(false);
        setHasCustomer(false);
      }
    };

    checkPayment();
    fetchPlanAndCustomer();

    return () => {
      cancelled = true;
    };
  }, [siteKey]);

  // 取得中は何も出さない
  if (isFreePlan === null || hasCustomer === null || status === "loading") {
    return null;
  }

  // 無料プランは表示しない
  if (isFreePlan) return null;

  // 顧客未登録なら無条件でオーバーレイ表示
  const mustShowOverlay =
    !hasCustomer || !["setup", "paid", "pending"].includes(status);

  if (mustShowOverlay) {
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
