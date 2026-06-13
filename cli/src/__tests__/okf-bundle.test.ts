import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
  sectionToOkfFile,
  okfFileToSection,
  buildOkfBundleFiles,
  okfBundleFilesToSections,
  collectBundleSections,
  exportBundleToOkf,
  importOkfToBundle,
  YoumdSection,
} from "../lib/okf-bundle";
import { validateOkfBundle, parseOkfFile } from "../lib/okf";

const EXAMPLE_BUNDLE = path.resolve(__dirname, "../../examples/houston");

const SAMPLE: YoumdSection[] = [
  {
    dir: "profile",
    slug: "about",
    title: "About",
    body: "# Houston Golden\n\nFounder of You.md. Based in Miami.",
    timestamp: "2026-06-13T00:00:00Z",
  },
  {
    dir: "preferences",
    slug: "agent",
    title: "Agent Preferences",
    body: "**Tone:** direct, no fluff\n**Avoid:** corporate speak",
  },
  {
    dir: "voice",
    slug: "voice",
    title: "Voice Profile",
    body: "Sharp, dry, terminal-native.",
  },
  {
    dir: "skills",
    slug: "voice-sync",
    title: "Voice Sync",
    body: "# Voice Sync\n\nSync the user's voice across tools.",
  },
];

describe("section <-> okf file", () => {
  it("emits a conformant concept file with a type and youmd_kind", () => {
    const file = sectionToOkfFile(SAMPLE[0]);
    expect(file.path).toBe("profile/about.md");
    const { frontmatter } = parseOkfFile(file.content);
    expect(frontmatter.type).toBe("Identity Profile");
    expect(frontmatter.youmd_kind).toBe("profile/about");
    expect(frontmatter.title).toBe("About");
    const result = validateOkfBundle([file]);
    expect(result.ok).toBe(true);
  });

  it("round-trips dir, slug, title, and body losslessly", () => {
    for (const section of SAMPLE) {
      const file = sectionToOkfFile(section);
      const back = okfFileToSection(file);
      expect(back).not.toBeNull();
      expect(back!.dir).toBe(section.dir);
      expect(back!.slug).toBe(section.slug);
      expect(back!.title).toBe(section.title);
      expect(back!.body.trim()).toBe(section.body.trim());
    }
  });

  it("maps each section dir to a distinct OKF type", () => {
    const types = SAMPLE.map((s) => parseOkfFile(sectionToOkfFile(s).content).frontmatter.type);
    expect(new Set(types).size).toBe(4); // profile, preference, voice, skill
  });
});

describe("buildOkfBundleFiles", () => {
  it("produces a conformant bundle with a root index and log", () => {
    const files = buildOkfBundleFiles(SAMPLE, {
      title: "Houston Golden",
      log: [{ date: "2026-06-13", label: "Export", message: "Generated." }],
    });
    const paths = files.map((f) => f.path);
    expect(paths).toContain("index.md");
    expect(paths).toContain("log.md");
    expect(paths).toContain("profile/about.md");
    expect(paths).toContain("skills/voice-sync.md");

    const result = validateOkfBundle(files);
    expect(result.ok).toBe(true);

    const index = files.find((f) => f.path === "index.md")!;
    expect(index.content).toContain('okf_version: "0.1"');
    expect(index.content).toContain("## Profile");
    expect(index.content).toContain("## Skills");
    expect(index.content).toContain("[About](/profile/about.md)");
  });

  it("recovers the original sections from the built files", () => {
    const files = buildOkfBundleFiles(SAMPLE);
    const back = okfBundleFilesToSections(files);
    expect(back).toHaveLength(SAMPLE.length);
    const byKey = new Map(back.map((s) => [`${s.dir}/${s.slug}`, s]));
    for (const original of SAMPLE) {
      const recovered = byKey.get(`${original.dir}/${original.slug}`);
      expect(recovered).toBeDefined();
      expect(recovered!.body.trim()).toBe(original.body.trim());
    }
  });
});

describe("provenance stamping and round-trip", () => {
  it("stamps defaultAuthor/defaultConfidence only on sections lacking their own", () => {
    const sections: YoumdSection[] = [
      { dir: "profile", slug: "about", title: "About", body: "Hi." },
      {
        dir: "skills",
        slug: "voice-sync",
        title: "Voice Sync",
        body: "Sync.",
        lastUpdatedBy: "agent",
      },
    ];
    const files = buildOkfBundleFiles(sections, {
      defaultAuthor: "houston",
      defaultConfidence: "high",
    });
    const about = parseOkfFile(files.find((f) => f.path === "profile/about.md")!.content);
    const skill = parseOkfFile(files.find((f) => f.path === "skills/voice-sync.md")!.content);
    expect(about.frontmatter.last_updated_by).toBe("houston");
    expect(about.frontmatter.confidence).toBe("high");
    // The skill declared its own author — it is preserved, not overwritten.
    expect(skill.frontmatter.last_updated_by).toBe("agent");
  });

  it("preserves provenance from a concept file back into a section", () => {
    const file = {
      path: "profile/about.md",
      content:
        "---\ntype: Identity Profile\ntitle: About\nlast_updated_by: agent\nconfidence: low\nlinked_sources:\n  - https://x.com/a\n---\n\nBody.",
    };
    const section = okfFileToSection(file)!;
    expect(section.lastUpdatedBy).toBe("agent");
    expect(section.confidence).toBe("low");
    expect(section.linkedSources).toEqual(["https://x.com/a"]);
  });
});

describe("filesystem export / import round-trip", () => {
  let tmp: string;

  beforeAll(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "okf-bundle-"));
  });
  afterAll(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("the example bundle exists on disk", () => {
    expect(fs.existsSync(EXAMPLE_BUNDLE)).toBe(true);
    const sections = collectBundleSections(EXAMPLE_BUNDLE);
    expect(sections.length).toBeGreaterThan(0);
  });

  it("exports the example bundle as a conformant OKF bundle", () => {
    const outDir = path.join(tmp, "okf-out");
    const result = exportBundleToOkf(EXAMPLE_BUNDLE, outDir);
    expect(result.validation.ok).toBe(true);
    expect(result.conceptCount).toBeGreaterThan(0);
    expect(fs.existsSync(path.join(outDir, "index.md"))).toBe(true);
    expect(fs.existsSync(path.join(outDir, "profile", "about.md"))).toBe(true);

    // Root index must validate (only okf_version frontmatter allowed).
    const indexRaw = fs.readFileSync(path.join(outDir, "index.md"), "utf-8");
    expect(validateOkfBundle([{ path: "index.md", content: indexRaw }]).ok).toBe(true);
  });

  it("imports an OKF bundle back into You.md section files, preserving bodies", () => {
    const original = collectBundleSections(EXAMPLE_BUNDLE);

    const okfDir = path.join(tmp, "okf-roundtrip");
    exportBundleToOkf(EXAMPLE_BUNDLE, okfDir);

    const importDir = path.join(tmp, "imported-bundle");
    const result = importOkfToBundle(okfDir, importDir);
    expect(result.sectionCount).toBe(original.length);

    // Re-read the imported bundle and compare bodies section-by-section.
    const reimported = collectBundleSections(importDir);
    const byKey = new Map(reimported.map((s) => [`${s.dir}/${s.slug}`, s]));
    for (const section of original) {
      const recovered = byKey.get(`${section.dir}/${section.slug}`);
      expect(recovered, `${section.dir}/${section.slug} survived round-trip`).toBeDefined();
      expect(recovered!.body.trim()).toBe(section.body.trim());
      expect(recovered!.title).toBe(section.title);
    }
  });
});
