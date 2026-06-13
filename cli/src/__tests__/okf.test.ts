import { describe, it, expect } from "vitest";
import {
  OKF_VERSION,
  conceptId,
  conceptHref,
  isReservedFile,
  serializeOkfFile,
  parseOkfFile,
  validateOkfBundle,
  validateOkfFileEntry,
  buildIndexMd,
  buildLogMd,
} from "../lib/okf";

describe("okf concept identity", () => {
  it("derives concept id by stripping .md", () => {
    expect(conceptId("profile/about.md")).toBe("profile/about");
    expect(conceptId("tables/users.md")).toBe("tables/users");
    expect(conceptId("./skills/voice-sync.md")).toBe("skills/voice-sync");
  });

  it("builds stable bundle-relative absolute hrefs", () => {
    expect(conceptHref("profile/about.md")).toBe("/profile/about.md");
  });

  it("detects reserved filenames", () => {
    expect(isReservedFile("index.md")).toBe(true);
    expect(isReservedFile("profile/index.md")).toBe(true);
    expect(isReservedFile("log.md")).toBe(true);
    expect(isReservedFile("profile/about.md")).toBe(false);
  });
});

describe("okf serialize / parse", () => {
  it("requires a non-empty type", () => {
    expect(() =>
      serializeOkfFile({ frontmatter: { type: "" }, body: "hi" }),
    ).toThrow(/non-empty `type`/);
    // @ts-expect-error intentionally missing type
    expect(() => serializeOkfFile({ frontmatter: {}, body: "hi" })).toThrow();
  });

  it("emits type first then recommended fields in order", () => {
    const out = serializeOkfFile({
      frontmatter: {
        timestamp: "2026-06-13T00:00:00Z",
        type: "Identity Profile",
        title: "About",
        description: "Who I am.",
      },
      body: "# About\n\nBody text.",
    });
    const fm = out.split("---")[1];
    const typeIdx = fm.indexOf("type:");
    const titleIdx = fm.indexOf("title:");
    const descIdx = fm.indexOf("description:");
    const tsIdx = fm.indexOf("timestamp:");
    expect(typeIdx).toBeGreaterThanOrEqual(0);
    expect(typeIdx).toBeLessThan(titleIdx);
    expect(titleIdx).toBeLessThan(descIdx);
    expect(descIdx).toBeLessThan(tsIdx);
  });

  it("round-trips frontmatter and body, preserving custom keys", () => {
    const file = {
      frontmatter: {
        type: "Skill",
        title: "Voice Sync",
        tags: ["voice", "writing"],
        youmd_kind: "skill",
      },
      body: "# Voice Sync\n\nDo the thing.",
    };
    const serialized = serializeOkfFile(file);
    const parsed = parseOkfFile(serialized);
    expect(parsed.frontmatter.type).toBe("Skill");
    expect(parsed.frontmatter.title).toBe("Voice Sync");
    expect(parsed.frontmatter.tags).toEqual(["voice", "writing"]);
    expect(parsed.frontmatter.youmd_kind).toBe("skill");
    expect(parsed.body).toBe("# Voice Sync\n\nDo the thing.");
  });

  it("produces output that parses back as conformant", () => {
    const serialized = serializeOkfFile({
      frontmatter: { type: "Project", title: "You.md" },
      body: "Building the identity protocol.",
    });
    const result = validateOkfBundle([{ path: "projects/youmd.md", content: serialized }]);
    expect(result.ok).toBe(true);
  });
});

describe("okf validation", () => {
  it("flags concept files missing type as errors", () => {
    const issues = validateOkfFileEntry({
      path: "profile/about.md",
      content: "---\ntitle: About\n---\n\nBody",
    });
    expect(issues.some((i) => i.level === "error" && /type/.test(i.message))).toBe(true);
  });

  it("passes a concept file with a type", () => {
    const issues = validateOkfFileEntry({
      path: "profile/about.md",
      content: "---\ntype: Identity Profile\ntitle: About\n---\n\nBody",
    });
    expect(issues).toHaveLength(0);
  });

  it("rejects frontmatter in a non-root index.md", () => {
    const issues = validateOkfFileEntry(
      { path: "profile/index.md", content: "---\ntype: x\n---\n\n# Index" },
      { isRoot: false },
    );
    expect(issues.some((i) => i.level === "error")).toBe(true);
  });

  it("allows okf_version on the bundle-root index.md", () => {
    const issues = validateOkfFileEntry(
      { path: "index.md", content: '---\nokf_version: "0.1"\n---\n\n# Index' },
      { isRoot: true },
    );
    expect(issues).toHaveLength(0);
  });

  it("tolerates broken links and unknown types (bundle stays conformant)", () => {
    const result = validateOkfBundle([
      {
        path: "things/weird.md",
        content: "---\ntype: Totally Unregistered Type\n---\n\nSee [missing](/nope.md).",
      },
    ]);
    expect(result.ok).toBe(true);
  });

  it("ignores non-markdown files", () => {
    const issues = validateOkfFileEntry({
      path: "manifest.sha256.json",
      content: "{}",
    });
    expect(issues).toHaveLength(0);
  });
});

describe("okf index.md builder", () => {
  it("omits frontmatter by default and lists linked entries", () => {
    const md = buildIndexMd([
      {
        heading: "Profile",
        entries: [
          { conceptId: "profile/about", title: "About", description: "Who I am." },
          { conceptId: "profile/projects", title: "Projects" },
        ],
      },
    ]);
    expect(md.startsWith("---")).toBe(false);
    expect(md).toContain("## Profile");
    expect(md).toContain("* [About](/profile/about.md) - Who I am.");
    expect(md).toContain("* [Projects](/profile/projects.md)");
  });

  it("declares okf_version when building a bundle-root index", () => {
    const md = buildIndexMd(
      [{ heading: "Profile", entries: [{ conceptId: "profile/about", title: "About" }] }],
      { title: "Houston Golden", okfVersion: OKF_VERSION },
    );
    expect(md.startsWith("---")).toBe(true);
    expect(md).toContain(`okf_version: "${OKF_VERSION}"`);
    // A root index declaring only okf_version is still conformant.
    const result = validateOkfBundle([{ path: "index.md", content: md }]);
    expect(result.ok).toBe(true);
  });

  it("skips empty sections", () => {
    const md = buildIndexMd([{ heading: "Empty", entries: [] }]);
    expect(md).not.toContain("## Empty");
  });
});

describe("okf log.md builder", () => {
  it("groups by date newest-first with optional labels", () => {
    const md = buildLogMd([
      { date: "2026-06-10", label: "Creation", message: "Created [About](/profile/about.md)." },
      { date: "2026-06-13", label: "Update", message: "Updated voice." },
    ]);
    const firstDate = md.indexOf("## 2026-06-13");
    const secondDate = md.indexOf("## 2026-06-10");
    expect(firstDate).toBeGreaterThanOrEqual(0);
    expect(firstDate).toBeLessThan(secondDate);
    expect(md).toContain("* **Update**: Updated voice.");
    expect(md).toContain("* **Creation**: Created [About](/profile/about.md).");
  });

  it("does not emit frontmatter", () => {
    const md = buildLogMd([{ date: "2026-06-13", message: "x" }]);
    expect(md.startsWith("---")).toBe(false);
  });
});
