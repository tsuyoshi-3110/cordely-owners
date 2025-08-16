// src/lib/firebase-admin.ts
import "server-only";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const projectId = process.env.FIREBASE_PROJECT_ID!;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL!;
const privateKey = (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n");

if (!projectId || !clientEmail || !privateKey) {
  throw new Error("Missing Firebase Admin env vars (FIREBASE_PROJECT_ID/CLIENT_EMAIL/PRIVATE_KEY)");
}

if (!getApps().length) {
  initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
}

export const adminDb = getFirestore();
