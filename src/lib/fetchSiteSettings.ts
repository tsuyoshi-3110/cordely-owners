// src/lib/fetchSiteSettings.ts
import { collection, getDocs, limit, query, where } from "firebase/firestore";
import { db } from "./firebase";
import type { SiteSettingsDoc } from "./atoms/siteSettingsAtom";

export async function fetchSiteSettingsByOwnerId(ownerId: string) {
  const q = query(
    collection(db, "siteSettings"),
    where("ownerId", "==", ownerId),
    limit(1)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { id: doc.id, ...(doc.data() as Omit<SiteSettingsDoc, "id">) } as SiteSettingsDoc;
}
