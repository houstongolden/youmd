#!/usr/bin/env node

import {
  getLocalBundleDir,
  getHomeBundleDir,
  bundleLooksInitialized,
} from "./lib/config";

process.env.YOUMD_LAUNCH_SURFACE = "you";

// Default `you` to the conversational entrypoint when the user simply types
// the command with no extra arguments, but keep all other subcommands working.
if (process.argv.length <= 2) {
  const localReady = bundleLooksInitialized(getLocalBundleDir());
  const homeReady = bundleLooksInitialized(getHomeBundleDir());

  if (localReady || homeReady) {
    process.argv.push("chat");
  }
}

// Deferred (dynamic) import: index.ts reads YOUMD_LAUNCH_SURFACE and argv at
// module load, so it must only be evaluated after the mutations above.
void import("./index");
