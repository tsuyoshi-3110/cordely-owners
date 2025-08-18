// app/_components/Navbar.tsx
"use client";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { siteSettingsAtom } from "@/lib/atoms/siteSettingsAtom";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useAtomValue, useSetAtom } from "jotai";
import { List, LogOut, Menu, Package, Palette, RotateCcw, Lock } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

// ★ 追加：Firestore 購読で editable を読む
import { db } from "@/lib/firebase";
import { doc, onSnapshot as onSnapshotDoc } from "firebase/firestore";

type Editable = {
  logoUrl?: string;
  siteName?: string;
} | null;

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const setSiteSettings = useSetAtom(siteSettingsAtom);
  const site = useAtomValue(siteSettingsAtom);

  const [isAuthed, setIsAuthed] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);
  const [editable, setEditable] = useState<Editable>(null); // ★ 追加

  // ---------- 認証ガード ----------
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      const authed = !!user;
      setIsAuthed(authed);

      const publicPaths = ["/login", "/forgot-email", "/forgot-password"];

      if (!authed && !publicPaths.includes(pathname)) {
        // 未ログイン → 公開ページ以外なら強制ログイン画面へ
        router.replace("/login");
      }

      if (authed && pathname === "/login") {
        // ログイン済みでログイン画面にいるならトップへ（任意）
        router.replace("/");
      }
    });
    return () => unsub();
  }, [pathname, router]);

  // ---------- editable を Firestore から購読 ----------
  useEffect(() => {
    // siteSettingsAtom からキーを抽出
    const key = site?.siteKey ?? site?.id;
    if (!key) {
      setEditable(null);
      return;
    }
    const ref = doc(db, "siteSettingsEditable", key);
    const unsub = onSnapshotDoc(ref, (snap) => {
      setEditable(snap.exists() ? (snap.data() as Editable) : null);
    });
    return () => unsub();
  }, [site?.siteKey, site?.id]);

  // ---------- 表示用にマージ ----------
  const displayLogoUrl = useMemo(
    () => editable?.logoUrl ?? site?.logoUrl ?? "/images/cordelyLogo.png",
    [editable?.logoUrl, site?.logoUrl]
  );
  const displaySiteTitle = useMemo(
    () => editable?.siteName ?? site?.siteName ?? "",
    [editable?.siteName, site?.siteName]
  );

  const go = (path: string) => {
    setOpen(false);
    router.push(path);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setSiteSettings(null);
      router.replace("/login");
    } finally {
      setOpen(false);
    }
  };

  // /login ではナビ非表示 & 判定中/未ログインは描画しない
  if (pathname === "/login" || isAuthed !== true) return null;

  return (
    <header className="fixed inset-x-0 top-0 z-50 bg-gradient-to-r from-teal-500 to-pink-500 shadow-md ">
      <div className="mx-auto flex h-14 max-w-screen-xl items-center px-4">
        <Link href="/" className="inline-flex items-center">
          <Image
            src={displayLogoUrl}
            alt={displaySiteTitle || "Cordely"}
            width={140}
            height={28}
            className="h-12 w-auto"
            priority
          />
        </Link>

        <div className="ml-auto">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" className="text-white hover:text-white">
                <Menu />
              </Button>
            </SheetTrigger>

            <SheetContent side="right" className="w-80">
              <SheetHeader>
                <SheetTitle>メニュー</SheetTitle>
              </SheetHeader>

              <div className="mt-4 flex flex-col space-y-2">
                <SheetClose asChild>
                  <Button
                    variant="ghost"
                    className="justify-start"
                    onClick={() => go("/")}
                  >
                    <List className="mr-2" />
                    注文一覧
                  </Button>
                </SheetClose>

                <SheetClose asChild>
                  <Button
                    variant="ghost"
                    className="justify-start"
                    onClick={() => go("/add-product")}
                  >
                    <Package className="mr-2" />
                    商品管理
                  </Button>
                </SheetClose>

                <SheetClose asChild>
                  <Button
                    variant="ghost"
                    className="justify-start"
                    onClick={() => go("/branding")}
                  >
                    <Palette className="mr-2" />
                    ロゴ/サイト名設定
                  </Button>
                </SheetClose>

                <SheetClose asChild>
                  <Button
                    variant="ghost"
                    className="justify-start"
                    onClick={() => go("/change-password")}
                  >
                    <Lock className="mr-2" />
                    パスワード変更
                  </Button>
                </SheetClose>

                <SheetClose asChild>
                  <Button
                    variant="destructive"
                    className="justify-start"
                    onClick={() => setOpen(false)}
                  >
                    <RotateCcw className="mr-2" />
                    リセット
                  </Button>
                </SheetClose>

                <SheetClose asChild>
                  <Button
                    variant="default"
                    className="justify-start"
                    onClick={handleLogout}
                  >
                    <LogOut className="mr-2" />
                    ログアウト
                  </Button>
                </SheetClose>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {displaySiteTitle && (
        <div className="pointer-events-none absolute inset-x-0 top-0 flex h-14 items-center justify-center">
          <span className="max-w-[60%] truncate text-white text-sm font-semibold md:text-base drop-shadow">
            {displaySiteTitle}
          </span>
        </div>
      )}
    </header>
  );
}
