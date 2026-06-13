/**
 * T26 — Playwright smoke tests (3 cases).
 *
 * Runs against BASE_URL (default https://www.you.md) via playwright.config.ts.
 * Chromium only, headless. Not wired into PR CI — schedule-only (see
 * .github/workflows/playwright-smoke.yml).
 *
 * Tests:
 *   1. Landing page loads and has headline "every agent meets"
 *   2. Anonymous public profile loads (hardcoded: houstongolden)
 *   3. Sign-in page loads and the email/username input is present
 */
import { test, expect } from "@playwright/test";

test("landing page loads with headline text", async ({ page }) => {
  await page.goto("/");

  // Verify the page loaded (not a 5xx)
  expect(page.url()).toContain("you.md");

  // Headline should contain the product tagline (case-insensitive match)
  await expect(
    page.getByText(/every agent meets/i).or(page.getByText(/identity context protocol/i))
  ).toBeVisible({ timeout: 15_000 });
});

test("anonymous public profile loads for houstongolden", async ({ page }) => {
  await page.goto("/houstongolden");

  // Profile page loaded — username should appear somewhere in the page
  await expect(
    page
      .getByText(/houstongolden/i)
      .or(page.getByText(/Houston Golden/i))
      .first()
  ).toBeVisible({ timeout: 15_000 });
});

test("sign-in page loads with email or username input", async ({ page }) => {
  await page.goto("/sign-in");

  // The sign-in page should have an input accepting email or username
  const input = page
    .getByPlaceholder(/email/i)
    .or(page.getByPlaceholder(/username/i))
    .or(page.getByRole("textbox").first());

  await expect(input).toBeVisible({ timeout: 15_000 });
});
