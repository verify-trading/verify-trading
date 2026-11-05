import { JsonLd } from "@/components/seo/json-ld";
import { videoObjectSchema } from "@/lib/marketing/seo";

export type CategoryVideoData = {
  /** YouTube video id. */
  youtubeId: string;
  /** Exact YouTube title (also the VideoObject name). */
  title: string;
  description: string;
  uploadDate: string;
};

/**
 * The founder's "Understanding …" explainer videos (YouTube channel @Verify.trading),
 * one per register category. Keyed by the page that embeds it.
 */
export const CATEGORY_VIDEOS = {
  broker: {
    youtubeId: "O4t_fhlWIDw",
    title: "Understanding Brokers | Market Makers, Spreads, Commissions & Regulation Explained",
    description:
      "What a broker actually does with your order: market makers versus agency execution, spreads and commissions, and why regulation decides how protected your money is.",
    uploadDate: "2026-11-03",
  },
  propfirm: {
    youtubeId: "ahou_tv1XXk",
    title: "Understanding Prop Firms | Challenges, Drawdown Rules & Payouts Explained",
    description:
      "How prop firm funding really works: challenges and profit targets, drawdown rules, payout conditions and the business model behind funded accounts.",
    uploadDate: "2026-11-03",
  },
  guru: {
    youtubeId: "0bEAChD1iWM",
    title: "Understanding Trading Educators | Screenshots, Track Records & Signals Explained",
    description:
      "How to judge trading educators and signal sellers: why screenshots are not proof, what a verified track record looks like, and the red flags to check before you pay.",
    uploadDate: "2026-11-03",
  },
  regulators: {
    youtubeId: "0kpdEgoyebk",
    title: "Understanding Financial Regulators | FCA, ASIC, CySEC & Broker Licences Explained",
    description:
      "What financial regulators such as the FCA, ASIC and CySEC actually do, what a licence does and does not protect, and how to check a broker's licence on the official register.",
    uploadDate: "2026-11-03",
  },
} as const satisfies Record<string, CategoryVideoData>;

/**
 * Privacy-friendly, lazy YouTube embed with matching VideoObject structured data.
 * youtube-nocookie + loading="lazy" keeps the player out of the critical path and
 * sets no cookies until the visitor presses play.
 */
export function CategoryVideo({ video, heading, lede }: { video: CategoryVideoData; heading: string; lede?: string }) {
  return (
    <div className="mx-auto max-w-3xl text-center">
      <JsonLd
        data={videoObjectSchema({
          name: video.title,
          description: video.description,
          embedUrl: `https://www.youtube-nocookie.com/embed/${video.youtubeId}`,
          thumbnailUrl: `https://i.ytimg.com/vi/${video.youtubeId}/hqdefault.jpg`,
          uploadDate: video.uploadDate,
        })}
      />
      <h2 className="text-2xl font-bold tracking-[-0.03em] text-white sm:text-3xl">{heading}</h2>
      {lede ? <p className="mx-auto mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">{lede}</p> : null}
      <figure className="mt-5">
        <div className="overflow-hidden rounded-2xl border border-white/[0.09] bg-black/40">
          <iframe
            className="aspect-video w-full"
            src={`https://www.youtube-nocookie.com/embed/${video.youtubeId}`}
            title={video.title}
            loading="lazy"
            allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        </div>
        <figcaption className="mt-2 text-xs text-[var(--vt-muted)]">{video.title}</figcaption>
      </figure>
    </div>
  );
}
