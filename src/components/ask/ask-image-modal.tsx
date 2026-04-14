"use client";

import Image from "next/image";
import { X } from "lucide-react";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export function AskImageModal({
  src,
  alt,
  onClose,
}: {
  src: string;
  alt: string;
  onClose: () => void;
}) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(5,8,27,0.88)] px-3 py-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-sm sm:px-4 sm:py-6"
      role="dialog"
      aria-modal="true"
      aria-label="Image preview"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-5xl"
        onClick={(event) => event.stopPropagation()}
      >
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 size-9 rounded-full border border-white/15 bg-[rgba(10,13,46,0.78)] text-white hover:bg-[rgba(10,13,46,0.95)]"
          aria-label="Close image preview"
        >
          <X className="size-4" strokeWidth={2.25} aria-hidden />
        </Button>
        <div className="overflow-hidden rounded-[28px] border border-white/10 bg-[var(--vt-card)] shadow-[0_24px_70px_rgba(0,0,0,0.45)]">
          <Image
            src={src}
            alt={alt}
            width={1600}
            height={1200}
            unoptimized
            className="h-auto max-h-[82vh] w-full object-contain"
            priority
          />
        </div>
      </div>
    </div>
  );
}
