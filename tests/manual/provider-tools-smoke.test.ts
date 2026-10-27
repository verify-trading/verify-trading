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
 *   - provider-side web research — verify fresh facts independently. Some relays
 *     omit search traces while still retrieving live pages; others silently ignore
 *     the tool. Neither HTTP 200 nor a citation alone proves current web access.
 *     persist_discovered_prop_firm writes sourced facts to Supabase, so verify
 *     research before pointing production at a new base URL.
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

  // Pikachu omits native search events even when it fetches live pages. Prove access
  // with a fresh item whose title and original article URL are withheld from the model.
  it("server tool retrieves fresh source facts, even when the gateway omits search traces", async () => {
    const { getAskModel, getAskWebSearchTool } = await import("@/lib/ask/service/provider");
    const ids = await fetch("https://hacker-news.firebaseio.com/v0/topstories.json")
      .then((res) => res.json()) as number[];
    type Story = { id: number; title: string; url: string; time: number };
    const stories = await Promise.all(ids.slice(0, 30).map((id) =>
      fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`)
        .then((res) => res.json() as Promise<Story>),
    ));
    const story = stories.filter((item) => item?.title && item.url && Date.now() - item.time * 1000 < 6 * 3600000)
      .sort((a, b) => b.time - a.time)[0];
    expect(story, "The probe needs a source published within six hours").toBeTruthy();

    const result = await generateText({
      model: getAskModel(),
      prompt: `Use live web search to open https://news.ycombinator.com/item?id=${story.id}. Return JSON with its exact title and the full original article URL as sourceUrl. Neither is provided here. Actually look it up; do not guess.`,
      tools: { web_search: getAskWebSearchTool() } as Parameters<typeof generateText>[0]["tools"],
      stopWhen: stepCountIs(5),
      maxRetries: 0,
      abortSignal: AbortSignal.timeout(120000),
    });
    const json = result.text.match(/\{[\s\S]*\}/)?.[0];
    expect(json, "The model must return the requested source facts").toBeTruthy();
    const answer = JSON.parse(json!) as { title: string; sourceUrl: string };
    const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
    expect(normalize(answer.title)).toBe(normalize(story.title));
    expect(answer.sourceUrl.replace(/\/$/, "")).toBe(story.url.replace(/\/$/, ""));
  }, 180_000);
});
