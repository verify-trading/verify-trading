"use client";

import { Calendar, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getTelegramCommunityUrl, getTraderSupportCallUrl } from "@/lib/site-config";

export function MarketsCommunityCtas() {
  const supportUrl = getTraderSupportCallUrl();
  const telegramUrl = getTelegramCommunityUrl();

  return (
    <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-4">
      {supportUrl ? (
        <Button
          asChild
          variant="accent"
          className="h-auto min-h-12 w-full justify-center gap-2 rounded-2xl px-5 py-3.5 text-sm font-bold sm:min-w-[240px] sm:flex-1"
        >
          <a href={supportUrl} target="_blank" rel="noopener noreferrer">
            <Calendar className="size-4 shrink-0" aria-hidden />
            Book a Trader Support Call
          </a>
        </Button>
      ) : null}

      {telegramUrl ? (
        <Button
          asChild
          variant="outline"
          className="h-auto min-h-12 w-full justify-center gap-2 rounded-2xl border-[color:var(--vt-border)] bg-white/[0.04] px-5 py-3.5 text-sm font-bold text-white hover:bg-white/[0.08] sm:min-w-[240px] sm:flex-1"
        >
          <a href={telegramUrl} target="_blank" rel="noopener noreferrer">
            <Send className="size-4 shrink-0" aria-hidden />
            Join Verify Trading Community Group Chat on Telegram
          </a>
        </Button>
      ) : null}
    </div>
  );
}
