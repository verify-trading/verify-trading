import type { Block } from "@/lib/blog/posts";

export const slugify = (text: string) =>
  text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** H2 headings become the table of contents. */
export const tocFromBlocks = (blocks: Block[]) =>
  blocks.filter((b): b is Extract<Block, { type: "h2" }> => b.type === "h2").map((b) => ({ id: slugify(b.text), label: b.text }));

/** Renders the typed blog blocks with readable article prose and clear H2 spacing. */
export function ArticleBody({ blocks }: { blocks: Block[] }) {
  return (
    <div className="space-y-6">
      {blocks.map((block, i) => {
        switch (block.type) {
          case "h2":
            return (
              <h2
                key={i}
                id={slugify(block.text)}
                className="scroll-mt-24 pt-10 pb-1 text-2xl font-semibold tracking-tight text-white sm:text-3xl first:pt-0"
              >
                {block.text}
              </h2>
            );
          case "h3":
            return (
              <h3 key={i} className="pt-6 text-xl font-semibold tracking-tight text-white">
                {block.text}
              </h3>
            );
          case "p":
            return (
              <p key={i} className="text-[17px] leading-8 text-slate-300">
                {block.text}
              </p>
            );
          case "ul":
            return (
              <ul key={i} className="list-disc space-y-2.5 pl-6 text-[17px] leading-8 text-slate-300 marker:text-[var(--vt-coral)]">
                {block.items.map((item) => <li key={item}>{item}</li>)}
              </ul>
            );
          case "ol":
            return (
              <ol key={i} className="list-decimal space-y-3 pl-6 text-[17px] leading-8 text-slate-300 marker:font-semibold marker:text-[var(--vt-coral)]">
                {block.items.map((item) => <li key={item}>{item}</li>)}
              </ol>
            );
          case "callout":
            return (
              <aside key={i} className="my-8 border-l-2 border-[var(--vt-amber)] pl-6 py-2 text-[17px] leading-8 text-slate-200">
                {block.text}
              </aside>
            );
        }
      })}
    </div>
  );
}
