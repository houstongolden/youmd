import { defineConfig } from "vitest/config";

/**
 * Root vitest config — Convex backend contract tests only.
 *
 * The CLI package has its own vitest setup (cli/vitest.config.ts); this
 * config is scoped to convex/*.test.ts so the two suites never overlap.
 *
 * - environment "edge-runtime" approximates the Convex JS runtime
 *   (Web Crypto, no Node APIs) better than node — matches the official
 *   convex-test recommendation.
 * - convex-test must be inlined so vite transforms its internal
 *   import.meta.glob of the convex/ folder.
 */
export default defineConfig({
  test: {
    include: ["convex/**/*.test.ts"],
    environment: "edge-runtime",
    server: { deps: { inline: ["convex-test"] } },
    testTimeout: 10000,
  },
});
