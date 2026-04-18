#!/usr/bin/env node

process.env.YOUMD_LAUNCH_SURFACE = "you";

// Default `you` to the conversational entrypoint when the user simply types
// the command with no extra arguments, but keep all other subcommands working.
if (process.argv.length <= 2) {
  const config = require("./lib/config") as {
    getLocalBundleDir: () => string;
    getHomeBundleDir: () => string;
    bundleLooksInitialized: (dir: string) => boolean;
    isAuthenticated: () => boolean;
  };

  const localReady = config.bundleLooksInitialized(config.getLocalBundleDir());
  const homeReady = config.bundleLooksInitialized(config.getHomeBundleDir());

  if (config.isAuthenticated() && (localReady || homeReady)) {
    process.argv.push("chat");
  }
}

require("./index");
