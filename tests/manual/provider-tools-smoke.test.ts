/**
 * Manual smoke test for whatever provider Ask is configured to use. Makes REAL
 * model calls, so it is opt-in:
 *
 *   RUN_PROVIDER_SMOKE=1 npx vitest run tests/manual/provider-tools-smoke.test.ts
 *
 * Ask depends on two different tool mechanisms, and a gateway can support the
 * first while silently dropping the second:
 *   - client-side tools (verify_entity, submit_ask_card, …) — we execute them,
 *     the model only emits tool calls.
 *   - the server-side web_search tool — the PROVIDER executes it. A relay that
 *     doesn't implement it strips the declaration, and the model then answers
 *     from memory with no source. Nothing errors; the answer is just invented.
 *     persist_discovered_prop_firm writes those "sources" to Supabase, so this
 *     must be checked before pointing production at a new base URL.
 *
 * Two SDK facts these tests rely on:
 *   - generateText defaults to stopWhen: stepCountIs(1); the loop is opt-in.
 *   - result.toolResults is the LAST step only — all results live in steps[].
 */
import { generateText, stepCountIs, tool } from "ai";
import { z } from "zod";
import { describe, expect, it } from "vitest";

import { loadDotEnvLocal } from "./env-local";

loadDotEnvLocal();

const RUN = process.env.RUN_PROVIDER_SMOKE === "1";

const allToolResults = (r: { steps: ReadonlyArray<{ toolResults: unknown[] }> }) =>
  r.steps.flatMap((step) => step.toolResults) as Array<{
    toolName: string;
    output: unknown;
  }>;

const weatherTool = tool({
  description: "Get the current weather for a city. The only accurate source.",
  inputSchema: z.object({ city: z.string() }),
  execute: async ({ city }) => {
    if (city !== "Lisbon") throw new Error(`unknown city: ${city}`);
    return { city, celsius: 24, condition: "sunny" };
  },
});

describe.skipIf(!RUN)("provider tool support", () => {
  it("client tool: the model picks the tool on its own", async () => {
    const { getAskModel } = await import("@/lib/ask/service/provider");
    const r = await generateText({
      model: getAskModel(),
      prompt: "What is the weather in Lisbon right now? Use the tool.",
      tools: { get_weather: weatherTool },
      stopWhen: stepCountIs(5),
    });
    const results = allToolResults(r);
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].toolName).toBe("get_weather");
    expect(results[0].output).toMatchObject({ city: "Lisbon", celsius: 24 });
    expect(r.text).toMatch(/24|sunny/i);
  }, 120_000);

  it("multi-step: tool result feeds the follow-up step (Ask's whole shape)", async () => {
    const { getAskModel } = await import("@/lib/ask/service/provider");
    const r = await generateText({
      model: getAskModel(),
      prompt: "Get the weather for Lisbon, then convert that temperature to Fahrenheit.",
      tools: { get_weather: weatherTool },
      stopWhen: stepCountIs(5),
    });
    expect(allToolResults(r).length).toBeGreaterThanOrEqual(1);
    expect(r.steps.length).toBeGreaterThanOrEqual(2);
    expect(r.text).toMatch(/75/);
  }, 120_000);

  // The one that catches a relay pretending to implement the provider's server
  // tools: a stripped web_search still returns HTTP 200 with a confident,
  // uncited, invented answer. Citations can't be the proof — a gateway can strip
  // the tool blocks while still running the search — so ask for a fact that
  // cannot be in any training set (a story posted minutes ago) and check it
  // against the source.
  it("server tool: web_search really executes", async () => {
    const { getAskModel, codexProvider } = await import("@/lib/ask/service/provider");

    // Accept any front-page story, not the current #1. Ranks churn by the minute
    // and the search index serves a snapshot up to an hour old, so pinning to #1
    // fails a provider that genuinely searched. The front page is still proof:
    // every one of these was posted today and cannot come from training data.
    const topIds = (await fetch(
      "https://hacker-news.firebaseio.com/v0/topstories.json",
    ).then((res) => res.json())) as number[];
    const top = await Promise.all(
      topIds.slice(0, 30).map((id) =>
        fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`).then(
          (res) => res.json() as Promise<{ title: string }>,
        ),
      ),
    );

    const r = await generateText({
      model: getAskModel(),
      prompt:
        "Search news.ycombinator.com and give me the exact verbatim title of one story currently on the Hacker News front page. Reply with the title and nothing else.",
      // Same cast the pipeline uses: a provider-executed tool has no input
      // schema of ours, so the tools record needs the call's own type.
      tools: {
        // Identical config to production (ask/service/tools.ts).
        web_search: codexProvider.tools.webSearch({
          searchContextSize: "medium",
          userLocation: { type: "approximate", country: "GB" },
        }),
      } as Parameters<typeof generateText>[0]["tools"],
      stopWhen: stepCountIs(5),
    });

    // Match on a distinctive slice: models reformat punctuation and casing.
    const answer = r.text.toLowerCase().replace(/\s+/g, " ");
    const matched = top.some((story) =>
      answer.includes(story.title.toLowerCase().split(/\s+/).slice(0, 5).join(" ")),
    );
    expect(
      matched,
      `the provider at ${process.env.OPENAI_BASE_URL ?? "the default base URL"} did not really search — no HN front-page title appears in: ${r.text.slice(0, 200)}`,
    ).toBe(true);
  }, 180_000);
});
