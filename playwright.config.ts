import { defineConfig, devices } from "@playwright/test";

/**
 * T26 — Playwright smoke config.
 *
 * Runs chromium only, headless. baseURL defaults to https://www.you.md but
 * can be overridden via the BASE_URL env var for local dev:
 *   BASE_URL=http://localhost:3100 npm run e2e
 */
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  retries: 0,
  workers: 1,
  reporter: "line",
  use: {
    baseURL: process.env.BASE_URL ?? "https://www.you.md",
    headless: true,
    screenshot: "only-on-failure",
    trace: "off",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
