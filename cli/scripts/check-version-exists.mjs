#!/usr/bin/env node
// T29: pre-publish guard — refuse to attempt `npm publish` if the version in
// package.json already exists on the npm registry. npm itself errors out with
// E_PUBLISH_CONFLICT, but only after build + tarball + 2FA dance — surfacing
// the conflict up-front saves the OTP round-trip every time someone forgets
// `npm version patch`.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgPath = join(__dirname, "..", "package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
const name = pkg.name;
const version = pkg.version;

const url = `https://registry.npmjs.org/${encodeURIComponent(name)}/${encodeURIComponent(version)}`;

try {
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (res.status === 404) {
    // unknown version — safe to publish
    process.exit(0);
  }
  if (res.ok) {
    console.error(
      `\n  ✗ ${name}@${version} is already published on npm.\n` +
      `    bump the version before publishing:\n\n` +
      `      cd cli && npm version patch --no-git-tag-version\n\n`
    );
    process.exit(1);
  }
  // 5xx or transient — don't block the publish on registry flakiness; warn and continue
  console.error(`  ! could not reach npm registry (HTTP ${res.status}) — proceeding without version check`);
  process.exit(0);
} catch (err) {
  console.error(`  ! could not reach npm registry (${err?.message ?? err}) — proceeding without version check`);
  process.exit(0);
}
