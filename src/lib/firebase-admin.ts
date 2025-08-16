import admin from "firebase-admin";

const raw = process.env.FIREBASE_PRIVATE_KEY || "";
const privateKey = raw.includes("\\n") ? raw.replace(/\\n/g, "\n") : raw;

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
      privateKey,
    }),
  });
}
export const adminDb = admin.firestore();
