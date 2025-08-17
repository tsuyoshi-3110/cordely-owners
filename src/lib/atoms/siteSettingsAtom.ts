"use client";
import { atomWithStorage } from "jotai/utils";

export type SiteSettings = {
  id: string;
  siteKey: string;
  siteName: string;
  taxDisplayMode?: "inclusive" | "exclusive";
  ownerId?: string;        // クライアント保持は任意
  updatedAt?: number;      // 同期時刻など（任意）
};

/** Firestoreのドキュメント形（id を含む型） */
export interface SiteSettingsDoc {
  id: string;
  siteKey: string;
  siteName: string;
  ownerId: string;         // クエリで使うので必須に
  taxDisplayMode?: "inclusive" | "exclusive";
}

export const siteSettingsAtom = atomWithStorage<SiteSettings | null>(
  "siteSettings",
  null
);
