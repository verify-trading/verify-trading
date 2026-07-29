import path from "node:path";

import { loadEnvConfig } from "@next/env";
import { defineConfig } from "vitest/config";

loadEnvConfig(process.cwd());

export default defineConfig({
  test: {
    setupFiles: ["./tests/setup/vitest-globals.ts"],
    environment: "node",
    // The heavy jsdom component renders (ask-workspace, markets) run 1-2s alone and blow
    // the 5s default when the full suite competes for CPU — the only observed flake cause.
    testTimeout: 20_000,
    include: ["tests/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
