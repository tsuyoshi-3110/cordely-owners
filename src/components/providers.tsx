"use client";

import { ReactNode } from "react";
import { Provider as JotaiProvider } from "jotai";
import { Toaster } from "sonner";

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <JotaiProvider>
      {children}
      <Toaster richColors closeButton />
    </JotaiProvider>
  );
}
