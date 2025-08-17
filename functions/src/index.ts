// functions/src/index.ts
import { getApp, getApps, initializeApp } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { setGlobalOptions } from "firebase-functions/v2/options";

setGlobalOptions({ region: "asia-northeast2" });

const app = getApps().length ? getApp() : initializeApp();

type OrderDoc = {
  isComp?: boolean;
  siteKey?: string;
  orderNo?: number;
  customerFcmToken?: string | null;
};

const CLIENT_BASE_URL =
  process.env.CLIENT_BASE_URL ??
  process.env.VERCEL_URL ??
  "https://cordely-customers.vercel.app"; // ← お客さま側のURLに合わせておく

export const notifyOrderCompleted = onDocumentUpdated(
  "orders/{orderId}",
  async (event) => {            // ← ← ← ここ、(event: any) をやめる
    const before = event.data?.before.data() as OrderDoc | undefined;
    const after  = event.data?.after.data()  as OrderDoc | undefined;
    if (!before || !after) return;
    if (before.isComp === after.isComp) return;
    if (!after.isComp) return;

    const token = after.customerFcmToken ?? null;
    if (!token) return;

    const siteKey = after.siteKey ?? "";
    const orderNo = Number(after.orderNo ?? 0);
    const link = `${CLIENT_BASE_URL}/?siteKey=${encodeURIComponent(siteKey)}&done=${orderNo}`;

    await getMessaging(app).send({
      token,
      notification: {
        title: "ご注文ができあがりました！",
        body: `注文番号 ${orderNo} をお受け取りください`,
      },
      webpush: {
        fcmOptions: { link },
        notification: {
          icon: "/icons/icon-192x192.png",
          badge: "/icons/badge-72x72.png",
        },
      },
      data: { siteKey, done: String(orderNo) },
    });
  }
);
