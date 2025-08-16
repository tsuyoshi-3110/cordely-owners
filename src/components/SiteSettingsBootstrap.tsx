"use client";
import { useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useSetAtom } from "jotai";
import { siteSettingsAtom } from "@/lib/atoms/siteSettingsAtom";
import { fetchSiteSettingsByOwnerId } from "@/lib/fetchSiteSettings";

export default function SiteSettingsBootstrap() {
  const setSiteSettings = useSetAtom(siteSettingsAtom);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { setSiteSettings(null); return; }
      const ss = await fetchSiteSettingsByOwnerId(user.uid);
      if (ss) setSiteSettings({ ...ss, updatedAt: Date.now() });
    });
    return () => unsub();
  }, [setSiteSettings]);

  return null;
}
