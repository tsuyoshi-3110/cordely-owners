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
import {
  List,
  LogIn,
  LogOut,
  Menu,
  Package,
  Palette,
  RotateCcw,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function Navbar() {
  const router = useRouter();
  const setSiteSettings = useSetAtom(siteSettingsAtom);
  const site = useAtomValue(siteSettingsAtom);
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);

  const siteTitle = site?.siteName ?? "";

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => setIsAuthed(!!user));
    return () => unsub();
  }, []);

  const go = (path: string) => {
    setOpen(false);
    router.push(path);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setSiteSettings(null);
    } finally {
      setOpen(false);
      router.push("/login");
    }
  };

  return (
    <header className="fixed inset-x-0 top-0 z-50 bg-gradient-to-r from-teal-500 to-pink-500 shadow-md">
      <div className="mx-auto flex h-14 max-w-screen-xl items-center px-4">
        <Link href="/" className="inline-flex items-center">
          <Image
            src="/images/cordelyLogoH.png"
            alt="Cordely"
            width={140}
            height={28}
            className="h-30 w-auto"
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
                {/* 一覧 */}
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

                {/* 商品追加 */}
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

                {/* （任意）リセット：今は閉じるだけ。処理を入れる場合はここに */}
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

                {/* 未ログイン時のみ：ログイン */}
                {isAuthed === false && (
                  <SheetClose asChild>
                    <Button
                      variant="ghost"
                      className="justify-start"
                      onClick={() => go("/login")}
                    >
                      <LogIn className="mr-2" />
                      ログイン
                    </Button>
                  </SheetClose>
                )}

                {/* ログイン時のみ：ログアウト */}
                {isAuthed === true && (
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
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* 中央：サイト名（クリックを邪魔しないよう pointer-events-none） */}
      {siteTitle && (
        <div className="pointer-events-none absolute inset-x-0 top-0 flex h-14 items-center justify-center">
          <span className="max-w-[60%] truncate text-white text-sm font-semibold md:text-base drop-shadow">
            {siteTitle}
          </span>
        </div>
      )}
    </header>
  );
}
