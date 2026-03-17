#!/usr/bin/env node

const { execSync, spawn } = require("child_process");

// Check if youmd is installed globally
try {
  execSync("youmd --version", { stdio: "ignore" });
  // It's installed — run the interactive init
  const child = spawn("youmd", ["init"], { stdio: "inherit" });
  child.on("exit", (code) => process.exit(code || 0));
} catch {
  // Not installed — install it first, then run init
  console.log("");
  console.log("  Installing youmd...");
  console.log("");
  try {
    execSync("npm install -g youmd", { stdio: "inherit" });
    console.log("");
    const child = spawn("youmd", ["init"], { stdio: "inherit" });
    child.on("exit", (code) => process.exit(code || 0));
  } catch (err) {
    // If global install fails (permissions), use npx
    const child = spawn("npx", ["youmd", "init"], { stdio: "inherit" });
    child.on("exit", (code) => process.exit(code || 0));
  }
}
