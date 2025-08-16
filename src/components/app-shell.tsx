"use client";

import { ReactNode } from "react";
import Navbar from "@/components/Navbar";
import SiteSettingsBootstrap from "@/components/SiteSettingsBootstrap";
import SubscriptionOverlay from "@/components/subscription/SubscriptionOverlay";
import { useAtomValue } from "jotai";
import { siteSettingsAtom } from "@/lib/atoms/siteSettingsAtom";

export default function AppShell({ children }: { children: ReactNode }) {
  const site = useAtomValue(siteSettingsAtom);
  const siteKey = site?.siteKey ?? site?.id ?? "";

  return (
    <>
      <SiteSettingsBootstrap />
      <Navbar />
      {children}
      {siteKey && <SubscriptionOverlay siteKey={siteKey} />}
    </>
  );
}
