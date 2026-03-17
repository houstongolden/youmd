#!/usr/bin/env node

import { runOnboarding } from "./lib/onboarding";

async function main(): Promise<void> {
  try {
    await runOnboarding();
  } catch (err) {
    if (err instanceof Error && err.message === "readline was closed") {
      // User pressed Ctrl+C
      console.log("");
      console.log("  aborted.");
      console.log("");
      process.exit(0);
    }
    throw err;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
