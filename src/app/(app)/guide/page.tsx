import type { Metadata } from "next";

import {
  GUIDE_DESCRIPTION,
  GUIDE_PATH,
  GUIDE_SETUP_STEPS,
  GUIDE_TITLE,
  GuideArticle,
} from "@/components/guide/guide-article";
import { JsonLd } from "@/components/seo/json-ld";
import { SiteFooter } from "@/components/site/site-footer";
import { howToSchema, pageMetadata, webPageSchema } from "@/lib/marketing/seo";

export const metadata: Metadata = pageMetadata({ title: GUIDE_TITLE, description: GUIDE_DESCRIPTION, path: GUIDE_PATH });

export default function GuidePage() {
  return (
    // The (app) shell clips overflow, so this page owns its scroll.
    <div className="min-h-0 flex-1 overflow-y-auto">
      <JsonLd
        data={webPageSchema({
          name: "AI Trading Prompts and verify.trading Platform Guide",
          description: GUIDE_DESCRIPTION,
          path: GUIDE_PATH,
        })}
      />
      <JsonLd
        data={howToSchema({
          name: "How to get started on verify.trading",
          description: "Set up a free verify.trading account and run your first broker check.",
          path: GUIDE_PATH,
          steps: GUIDE_SETUP_STEPS,
          totalTime: "PT1M",
        })}
      />
      <GuideArticle />
      <SiteFooter />
    </div>
  );
}
