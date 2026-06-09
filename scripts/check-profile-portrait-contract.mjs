#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const failures = [];
let checks = 0;

function read(path) {
  return readFileSync(resolve(root, path), "utf8");
}

function expect(condition, label) {
  checks += 1;
  if (!condition) failures.push(label);
}

const directoryPath = "src/app/(app)/profiles/profiles-content.tsx";
const profilePath = "src/app/(app)/[username]/profile-content.tsx";
const portraitComponentPath = "src/components/ProfilePortrait.tsx";
const portraitHelperPath = "src/lib/profilePortrait.ts";
const profileDirectoryPath = "convex/lib/profileDirectory.ts";
const cronsPath = "convex/crons.ts";
const apiProxyPath = "src/app/api/v1/profiles/route.ts";

const directory = read(directoryPath);
const profile = read(profilePath);
const portraitComponent = read(portraitComponentPath);
const portraitHelper = read(portraitHelperPath);
const profileDirectory = read(profileDirectoryPath);
const crons = read(cronsPath);

expect(existsSync(resolve(root, apiProxyPath)), "missing same-origin /api/v1/profiles proxy route");
expect(directory.includes('useState<"list" | "grid">("grid")'), "/profiles must default to grid view");
expect(directory.includes("ProfilePortrait"), "/profiles cards must use the shared ProfilePortrait renderer");
expect(!directory.includes("function DirectoryPortrait"), "/profiles must not reintroduce ad hoc DirectoryPortrait rendering");
expect(directory.includes("hasRenderableAsciiPortrait"), "/profiles must validate stored ASCII before counting/rendering it");
expect(profile.includes("ProfilePortrait"), "individual public profiles must use ProfilePortrait for the small portrait tile");
expect(!profile.includes("src={resolvedAvatarUrl}"), "individual public profiles must not render raw resolvedAvatarUrl img tags");
expect(portraitComponent.includes("ascii pending"), "ProfilePortrait must provide a visible nonblank fallback");
expect(portraitComponent.includes("preRendered={portrait}"), "ProfilePortrait must prefer stored ASCII portraits");
expect(portraitHelper.includes("hasRenderableAsciiPortrait"), "frontend portrait helper must expose renderability validation");
expect(profileDirectory.includes("hasRenderableAsciiPortrait"), "Convex directory normalization must reject malformed ASCII portraits");
expect(crons.includes("refresh unclaimed profile portraits"), "Convex crons must include autonomous public profile portrait QA");

if (failures.length > 0) {
  console.error("profile portrait contract failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`profile portrait contract ok (${checks} checks)`);
