import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * @next/env skips .env.local when NODE_ENV=test (which vitest sets), so the real
 * API keys never load through the normal path. Parse .env.local directly.
 * Anything already in the environment wins, so a one-off override still works:
 *   OPENAI_BASE_URL=https://api.openai.com npx vitest run …
 */
export function loadDotEnvLocal() {
  try {
    const raw = readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!match) continue;
      const [, key, value] = match;
      if (!process.env[key]) {
        process.env[key] = value.trim().replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    // no .env.local — rely on whatever is already in the environment
  }
}
