"use client";

import { AlertTriangle, CheckCircle2, CircleAlert, Info } from "lucide-react";
import { Toaster } from "sonner";

import "sonner/dist/styles.css";

/**
 * Sonner host — colors come from globals.css (remap `--normal-bg` / `--normal-border` to `--vt-*`).
 */
export function AppToaster() {
  return (
    <Toaster
      position="top-center"
      theme="dark"
      closeButton
      richColors={false}
      toastOptions={{
        duration: 3000,
        classNames: {
          toast:
            "group relative flex w-full max-w-[min(100vw-2rem,22rem)] items-start gap-3 py-3.5 pl-4 pr-10 text-sm shadow-[0_16px_50px_rgba(0,0,0,0.42)] ring-1 ring-white/[0.06] backdrop-blur-xl",
          content: "flex-1 gap-0.5",
          title: "text-[0.9375rem] font-semibold leading-snug text-white",
          description: "mt-0.5 text-[13px] leading-relaxed",
          icon: "mt-0.5 [&_svg]:shrink-0",
          closeButton:
            "absolute right-2 top-2 rounded-md border-0 bg-transparent p-1.5 text-white/50 transition hover:bg-white/[0.08] hover:text-white [&_svg]:size-4",
          actionButton:
            "rounded-lg !bg-[var(--vt-coral)] !text-white !shadow-none font-semibold hover:brightness-105",
          cancelButton:
            "rounded-lg !border !border-[color:var(--vt-border)] !bg-[var(--vt-card-alt)] !text-white !shadow-none",
        },
      }}
      icons={{
        success: <CheckCircle2 className="size-[18px]" strokeWidth={2} aria-hidden />,
        error: <CircleAlert className="size-[18px]" strokeWidth={2} aria-hidden />,
        warning: <AlertTriangle className="size-[18px]" strokeWidth={2} aria-hidden />,
        info: <Info className="size-[18px]" strokeWidth={2} aria-hidden />,
      }}
    />
  );
}
