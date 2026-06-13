/**
 * T10 — lossless identity round-trip tests
 *
 * Verifies that compile → decompile → recompile produces semantically
 * identical structured values for all identity sections.
 * Uses random fixture generation (no fast-check dependency).
 */

import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { compileBundle, writeBundle, roundtripIdentity } from "../lib/compiler";
import { decompileToFilesystem } from "../lib/decompile";

const tmpDirs: string[] = [];

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "youmd-rt-test-"));
  tmpDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tmpDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ─── Helpers ─────────────────────────────────────────────────────────

function writeSections(
  bundleDir: string,
  sections: {
    about?: string;
    now?: string;
    projects?: string;
    values?: string;
    links?: string;
    agentPrefs?: string;
    writingPrefs?: string;
    voice?: string;
    directives?: string;
  },
): void {
  fs.mkdirSync(path.join(bundleDir, "profile"), { recursive: true });
  fs.mkdirSync(path.join(bundleDir, "preferences"), { recursive: true });
  fs.mkdirSync(path.join(bundleDir, "voice"), { recursive: true });
  fs.mkdirSync(path.join(bundleDir, "directives"), { recursive: true });

  if (sections.about) {
    fs.writeFileSync(path.join(bundleDir, "profile", "about.md"), sections.about);
  }
  if (sections.now) {
    fs.writeFileSync(path.join(bundleDir, "profile", "now.md"), sections.now);
  }
  if (sections.projects) {
    fs.writeFileSync(path.join(bundleDir, "profile", "projects.md"), sections.projects);
  }
  if (sections.values) {
    fs.writeFileSync(path.join(bundleDir, "profile", "values.md"), sections.values);
  }
  if (sections.links) {
    fs.writeFileSync(path.join(bundleDir, "profile", "links.md"), sections.links);
  }
  if (sections.agentPrefs) {
    fs.writeFileSync(path.join(bundleDir, "preferences", "agent.md"), sections.agentPrefs);
  }
  if (sections.writingPrefs) {
    fs.writeFileSync(path.join(bundleDir, "preferences", "writing.md"), sections.writingPrefs);
  }
  if (sections.voice) {
    fs.writeFileSync(path.join(bundleDir, "voice", "voice.md"), sections.voice);
  }
  if (sections.directives) {
    fs.writeFileSync(path.join(bundleDir, "directives", "agent.md"), sections.directives);
  }
}

// ─── Core round-trip tests ────────────────────────────────────────────

describe("roundtripIdentity()", () => {
  it("returns ok:true for an empty bundle", () => {
    const dir = makeTempDir();
    fs.mkdirSync(path.join(dir, "profile"), { recursive: true });
    const result = roundtripIdentity(dir);
    expect(result.ok).toBe(true);
    expect(result.mismatches).toHaveLength(0);
  });

  it("round-trips name, location, bio", () => {
    const dir = makeTempDir();
    writeSections(dir, {
      about: `---\ntitle: "About"\n---\n# Houston Golden\n\n*Miami, FL*\n\nFounded BAMF Media. Building You.md.\n`,
    });
    const result = roundtripIdentity(dir);
    const nameMismatch = result.mismatches.find((m) => m.section === "identity.name");
    const bioMismatch = result.mismatches.find((m) => m.section === "identity.bio.long");
    expect(nameMismatch).toBeUndefined();
    expect(bioMismatch).toBeUndefined();
  });

  it("round-trips now.focus list", () => {
    const dir = makeTempDir();
    writeSections(dir, {
      now: `---\ntitle: "Now"\n---\n- Building You.md\n- Running BAMF Media\n`,
    });
    const result = roundtripIdentity(dir);
    const mismatch = result.mismatches.find((m) => m.section === "now.focus");
    expect(mismatch).toBeUndefined();
  });

  it("round-trips values list", () => {
    const dir = makeTempDir();
    writeSections(dir, {
      values: `---\ntitle: "Values"\n---\n- Speed\n- Integrity\n- Craft\n`,
    });
    const result = roundtripIdentity(dir);
    const mismatch = result.mismatches.find((m) => m.section === "values");
    expect(mismatch).toBeUndefined();
  });

  it("round-trips links map", () => {
    const dir = makeTempDir();
    writeSections(dir, {
      links: `---\ntitle: "Links"\n---\n- **linkedin**: https://linkedin.com/in/houstongolden\n- **twitter**: https://twitter.com/houstongolden\n`,
    });
    const result = roundtripIdentity(dir);
    const mismatch = result.mismatches.find((m) => m.section === "links");
    expect(mismatch).toBeUndefined();
  });

  it("round-trips agent preferences (structured fields)", () => {
    const dir = makeTempDir();
    writeSections(dir, {
      agentPrefs: `---\ntitle: "Agent Preferences"\n---\n**Tone:** direct, no fluff\n**Formality:** casual-professional\n**Avoid:** corporate speak, emoji\n`,
    });
    const result = roundtripIdentity(dir);
    const toneMismatch = result.mismatches.find((m) => m.section === "preferences.agent.tone");
    const avoidMismatch = result.mismatches.find((m) => m.section === "preferences.agent.avoid");
    expect(toneMismatch).toBeUndefined();
    expect(avoidMismatch).toBeUndefined();
  });

  it("round-trips voice overall (via markdown passthrough)", () => {
    const dir = makeTempDir();
    writeSections(dir, {
      voice: `---\ntitle: "Voice Profile"\n---\nDirect. Sharp. No corporate speak. Data-driven storytelling.\n`,
    });
    const result = roundtripIdentity(dir);
    const mismatch = result.mismatches.find((m) => m.section === "voice.overall");
    expect(mismatch).toBeUndefined();
  });

  it("round-trips agent directives (via markdown passthrough)", () => {
    const dir = makeTempDir();
    writeSections(dir, {
      directives: `---\ntitle: "Agent Directives"\n---\n**Communication Style:** direct and action-oriented\n**Default Stack:** Next.js + Convex\n`,
    });
    const result = roundtripIdentity(dir);
    const mismatch = result.mismatches.find((m) => m.section === "agent_directives.communication_style");
    expect(mismatch).toBeUndefined();
  });

  it("round-trips projects with role, status, url, description", () => {
    const dir = makeTempDir();
    writeSections(dir, {
      projects: `---\ntitle: "Projects"\n---\n## You.md\n**Role:** Founder\n**Status:** active\n**URL:** https://you.md\n\nIdentity context protocol.\n\n## BAMF Media\n**Role:** CEO\n**Status:** active\n\nGrowth marketing agency.\n`,
    });
    const result = roundtripIdentity(dir);
    const mismatch = result.mismatches.find((m) => m.section === "projects");
    expect(mismatch).toBeUndefined();
  });
});

// ─── Fuzz / random fixture tests ─────────────────────────────────────

/** Generate a random ASCII word, no special chars that confuse Markdown parsers */
function randomWord(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz";
  const len = 3 + Math.floor(Math.random() * 8);
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

function randomPhrase(words = 4): string {
  return Array.from({ length: words }, randomWord).join(" ");
}

function randomList(count: number): string[] {
  return Array.from({ length: count }, () => randomPhrase(3));
}

describe("roundtripIdentity() fuzz — N=20 random bundles", () => {
  it("all 20 random fixtures round-trip cleanly", () => {
    const failures: string[] = [];

    for (let i = 0; i < 20; i++) {
      const dir = makeTempDir();

      const name = `${randomWord()} ${randomWord()}`.replace(/^./, (c) => c.toUpperCase());
      const location = `${randomWord()}, ${randomWord().toUpperCase().slice(0, 2)}`;
      const bioSentence = randomPhrase(8) + ".";

      const nowItems = randomList(2 + Math.floor(Math.random() * 3));
      const valueItems = randomList(2 + Math.floor(Math.random() * 4));

      writeSections(dir, {
        about: `---\ntitle: "About"\n---\n# ${name}\n\n*${location}*\n\n${bioSentence}\n`,
        now: `---\ntitle: "Now"\n---\n${nowItems.map((x) => `- ${x}`).join("\n")}\n`,
        values: `---\ntitle: "Values"\n---\n${valueItems.map((x) => `- ${x}`).join("\n")}\n`,
        voice: `---\ntitle: "Voice Profile"\n---\n${randomPhrase(6)}.\n`,
      });

      const result = roundtripIdentity(dir);
      if (!result.ok) {
        failures.push(
          `fixture ${i}: ${result.mismatches.map((m) => `${m.section}: ${m.before} → ${m.after}`).join("; ")}`,
        );
      }
    }

    expect(failures).toHaveLength(0);
  });
});

// ─── Decompile manifest verification ─────────────────────────────────

describe("decompileToFilesystem — manifest.sha256.json verification", () => {
  it("does not warn when manifest matches", () => {
    const dir = makeTempDir();
    fs.mkdirSync(path.join(dir, "profile"), { recursive: true });
    writeSections(dir, {
      about: `---\ntitle: "About"\n---\n# Test User\n\n*Miami*\n\nA test bio.\n`,
      values: `---\ntitle: "Values"\n---\n- Speed\n- Quality\n`,
    });

    const result = compileBundle(dir);
    writeBundle(dir, result);

    // Now decompile into a fresh dir — manifest.sha256.json is in the source dir, not dest
    const destDir = makeTempDir();
    // Copy manifest.sha256.json to destDir so decompiler can find it
    fs.copyFileSync(
      path.join(dir, "manifest.sha256.json"),
      path.join(destDir, "manifest.sha256.json"),
    );

    const warnings: string[] = [];
    decompileToFilesystem(destDir, result.youJson, {
      warnOnHashMismatch: (msg) => warnings.push(msg),
    });

    // Since we're passing the same youJson that produced the manifest, no mismatch
    expect(warnings).toHaveLength(0);
  });

  it("warns when section content changes after manifest was written", () => {
    const dir = makeTempDir();
    fs.mkdirSync(path.join(dir, "profile"), { recursive: true });
    writeSections(dir, {
      values: `---\ntitle: "Values"\n---\n- Speed\n- Quality\n`,
    });

    const result = compileBundle(dir);
    writeBundle(dir, result);

    // Tamper: produce a different youJson (change values)
    const tamperedJson = {
      ...result.youJson,
      values: ["Speed", "Quality", "Extra value that wasnt there"],
    };

    const destDir = makeTempDir();
    fs.copyFileSync(
      path.join(dir, "manifest.sha256.json"),
      path.join(destDir, "manifest.sha256.json"),
    );

    const warnings: string[] = [];
    decompileToFilesystem(destDir, tamperedJson, {
      warnOnHashMismatch: (msg) => warnings.push(msg),
    });

    // Should have warned about profile/values mismatch
    const valuesWarning = warnings.find((w) => w.includes("profile/values"));
    expect(valuesWarning).toBeDefined();
  });
});
