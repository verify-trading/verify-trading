import path from "node:path";

import { loadEnvConfig } from "@next/env";
import { defineConfig } from "vitest/config";

loadEnvConfig(process.cwd());

export default defineConfig({
  test: {
    setupFiles: ["./tests/setup/vitest-globals.ts"],
    environment: "node",
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
