"use client";

import { SessionProvider } from "next-auth/react";
import { Toaster } from "sonner";
import { WebVitalsReporter } from "@/components/web-vitals-reporter";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      {children}
      <WebVitalsReporter />
      <Toaster 
        position="top-right"
        richColors
        closeButton
        toastOptions={{
          duration: 4000,
        }}
      />
    </SessionProvider>
  );
}
