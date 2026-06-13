/**
 * T27 — per-section sha256 manifest tests
 *
 * Verifies that:
 * - manifest.sha256.json is written adjacent to you.json by writeBundle
 * - hashes are deterministic across runs
 * - hash changes when section content changes
 * - schema_version is 1
 * - full_sha is the sha256 of the canonical JSON of you.json
 */

import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { createHash } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { compileBundle, writeBundle, buildSha256Manifest } from "../lib/compiler";
import { canonicalJsonString } from "../lib/canonical-json";

const tmpDirs: string[] = [];

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "youmd-sha256-test-"));
  tmpDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tmpDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function populateBundle(
  dir: string,
  opts: { values?: string[]; about?: string } = {},
): void {
  fs.mkdirSync(path.join(dir, "profile"), { recursive: true });
  fs.mkdirSync(path.join(dir, "preferences"), { recursive: true });

  const aboutContent = opts.about ??
    `---\ntitle: "About"\n---\n# Test User\n\n*Miami, FL*\n\nBuilding things.\n`;
  fs.writeFileSync(path.join(dir, "profile", "about.md"), aboutContent);

  if (opts.values) {
    fs.writeFileSync(
      path.join(dir, "profile", "values.md"),
      `---\ntitle: "Values"\n---\n${opts.values.map((v) => `- ${v}`).join("\n")}\n`,
    );
  }
}

// ─── Schema shape ─────────────────────────────────────────────────────

describe("manifest.sha256.json — schema", () => {
  it("writeBundle emits manifest.sha256.json adjacent to you.json", () => {
    const dir = makeTempDir();
    populateBundle(dir);
    const result = compileBundle(dir);
    writeBundle(dir, result);

    expect(fs.existsSync(path.join(dir, "manifest.sha256.json"))).toBe(true);
  });

  it("manifest has schema_version: 1", () => {
    const dir = makeTempDir();
    populateBundle(dir);
    const result = compileBundle(dir);
    writeBundle(dir, result);

    const manifest = JSON.parse(
      fs.readFileSync(path.join(dir, "manifest.sha256.json"), "utf-8"),
    );
    expect(manifest.schema_version).toBe(1);
  });

  it("manifest has sections object and full_sha string", () => {
    const dir = makeTempDir();
    populateBundle(dir, { values: ["Speed", "Quality"] });
    const result = compileBundle(dir);
    writeBundle(dir, result);

    const manifest = JSON.parse(
      fs.readFileSync(path.join(dir, "manifest.sha256.json"), "utf-8"),
    );
    expect(typeof manifest.sections).toBe("object");
    expect(typeof manifest.full_sha).toBe("string");
    expect(manifest.full_sha).toMatch(/^[0-9a-f]{64}$/);
  });

  it("section hashes are 64-char hex strings", () => {
    const dir = makeTempDir();
    populateBundle(dir, { values: ["Speed", "Quality"] });
    const result = compileBundle(dir);
    writeBundle(dir, result);

    const manifest = JSON.parse(
      fs.readFileSync(path.join(dir, "manifest.sha256.json"), "utf-8"),
    );
    for (const hash of Object.values(manifest.sections) as string[]) {
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    }
  });
});

// ─── Determinism ──────────────────────────────────────────────────────

describe("manifest.sha256.json — determinism", () => {
  it("same content produces same hashes across two calls", () => {
    const dir1 = makeTempDir();
    const dir2 = makeTempDir();

    populateBundle(dir1, { values: ["Integrity", "Speed"] });
    populateBundle(dir2, { values: ["Integrity", "Speed"] });

    const r1 = compileBundle(dir1);
    const r2 = compileBundle(dir2);

    const m1 = buildSha256Manifest(r1);
    const m2 = buildSha256Manifest(r2);

    // Sections should be same keys and hashes (ignoring generated_at differences in youJson)
    // Compare section hashes for profile/values specifically
    expect(m1.sections["profile/values"]).toBe(m2.sections["profile/values"]);
    expect(m1.sections["profile/about"]).toBe(m2.sections["profile/about"]);
  });

  it("full_sha matches sha256 of canonical JSON of youJson", () => {
    const dir = makeTempDir();
    populateBundle(dir, { values: ["Craft", "Speed"] });
    const result = compileBundle(dir);
    const manifest = buildSha256Manifest(result);

    const expectedFullSha = createHash("sha256")
      .update(canonicalJsonString(result.youJson), "utf-8")
      .digest("hex");

    expect(manifest.full_sha).toBe(expectedFullSha);
  });
});

// ─── Sensitivity ──────────────────────────────────────────────────────

describe("manifest.sha256.json — sensitivity", () => {
  it("hash changes when values content changes", () => {
    const dir1 = makeTempDir();
    const dir2 = makeTempDir();

    populateBundle(dir1, { values: ["Speed", "Quality"] });
    populateBundle(dir2, { values: ["Speed", "Quality", "Craft"] });

    const m1 = buildSha256Manifest(compileBundle(dir1));
    const m2 = buildSha256Manifest(compileBundle(dir2));

    expect(m1.sections["profile/values"]).not.toBe(m2.sections["profile/values"]);
  });

  it("full_sha changes when any section changes", () => {
    const dir1 = makeTempDir();
    const dir2 = makeTempDir();

    populateBundle(dir1, { about: `---\ntitle: "About"\n---\n# Alice Smith\n\nA bio.\n` });
    populateBundle(dir2, { about: `---\ntitle: "About"\n---\n# Bob Jones\n\nA different bio.\n` });

    const m1 = buildSha256Manifest(compileBundle(dir1));
    const m2 = buildSha256Manifest(compileBundle(dir2));

    expect(m1.full_sha).not.toBe(m2.full_sha);
  });
});

// ─── canonical-json.ts ────────────────────────────────────────────────

describe("canonicalJsonString", () => {
  it("sorts object keys", () => {
    const a = canonicalJsonString({ z: 1, a: 2 });
    const b = canonicalJsonString({ a: 2, z: 1 });
    expect(a).toBe(b);
  });

  it("is deterministic", () => {
    const obj = { name: "Houston", values: ["Speed", "Craft"] };
    expect(canonicalJsonString(obj)).toBe(canonicalJsonString(obj));
  });

  it("handles nested objects", () => {
    const result = canonicalJsonString({ b: { z: 1, a: 2 }, a: "hi" });
    expect(result).toBe('{"a":"hi","b":{"a":2,"z":1}}');
  });

  it("handles arrays (preserves order)", () => {
    const result = canonicalJsonString([3, 1, 2]);
    expect(result).toBe("[3,1,2]");
  });

  it("handles null", () => {
    expect(canonicalJsonString(null)).toBe("null");
  });

  it("handles strings with special chars", () => {
    const result = canonicalJsonString({ key: 'say "hello"' });
    expect(result).toBe('{"key":"say \\"hello\\""}');
  });
});
