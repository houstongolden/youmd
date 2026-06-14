import { describe, it, expect } from "vitest";
import { auditOkfBundle } from "../lib/okf-health";
import { buildOkfBundleFiles, YoumdSection } from "../lib/okf-bundle";
import { OkfBundleFile } from "../lib/okf";

const NOW = new Date("2026-06-13T00:00:00Z");

function concept(path: string, frontmatter: Record<string, unknown>, body = "Body text here."): OkfBundleFile {
  const fm = Object.entries(frontmatter)
    .map(([k, v]) =>
      Array.isArray(v) ? `${k}:\n${v.map((x) => `  - ${x}`).join("\n")}` : `${k}: ${typeof v === "string" ? JSON.stringify(v) : v}`,
    )
    .join("\n");
  return { path, content: `---\n${fm}\n---\n\n${body}` };
}

describe("auditOkfBundle", () => {
  it("a freshly exported bundle has no errors", () => {
    const sections: YoumdSection[] = [
      { dir: "profile", slug: "about", title: "About", body: "Founder.", timestamp: NOW.toISOString() },
    ];
    const files = buildOkfBundleFiles(sections, { defaultAuthor: "houston" });
    const report = auditOkfBundle(files, { now: NOW });
    expect(report.ok).toBe(true);
  });

  it("flags a missing type as an error and tanks `ok`", () => {
    const report = auditOkfBundle(
      [{ path: "profile/about.md", content: "---\ntitle: About\n---\n\nx" }],
      { now: NOW },
    );
    expect(report.ok).toBe(false);
    expect(report.summary.missing_type).toBe(1);
  });

  it("flags low confidence and agent-authored-without-confidence as needs_review", () => {
    const files = [
      concept("a.md", { type: "Note", description: "d", confidence: "low", linked_sources: ["s"] }),
      concept("b.md", { type: "Note", description: "d", last_updated_by: "agent", linked_sources: ["s"] }),
      concept("c.md", { type: "Note", description: "d", last_updated_by: "agent", confidence: "high", linked_sources: ["s"] }),
    ];
    const report = auditOkfBundle(files, { now: NOW });
    expect(report.summary.needs_review).toBe(2); // a + b, not c
  });

  it("flags un-sourced concepts and [CONFLICT]/[STALE] markers", () => {
    const files = [
      concept("a.md", { type: "Note", description: "d", linked_sources: ["s"] }, "Has a [CONFLICT] block."),
      concept("b.md", { type: "Note", description: "d" }, "This one is [STALE]."),
    ];
    const report = auditOkfBundle(files, { now: NOW });
    expect(report.summary.conflict).toBe(1);
    expect(report.summary.stale).toBe(1);
    expect(report.summary.unsourced).toBe(1); // only b lacks linked_sources
  });

  it("flags concepts older than staleDays", () => {
    const files = [
      concept("old.md", { type: "Note", description: "d", linked_sources: ["s"], timestamp: "2026-01-01T00:00:00Z" }),
      concept("new.md", { type: "Note", description: "d", linked_sources: ["s"], timestamp: "2026-06-12T00:00:00Z" }),
    ];
    const report = auditOkfBundle(files, { now: NOW, staleDays: 30 });
    const staleFiles = report.issues.filter((i) => i.category === "stale").map((i) => i.file);
    expect(staleFiles).toContain("old.md");
    expect(staleFiles).not.toContain("new.md");
  });

  it("detects orphans (nothing links to them) but not indexed concepts", () => {
    const files = [
      { path: "index.md", content: "# Index\n\n* [A](/a.md) - linked" },
      concept("a.md", { type: "Note", description: "d", linked_sources: ["s"] }),
      concept("orphan.md", { type: "Note", description: "d", linked_sources: ["s"] }),
    ];
    const report = auditOkfBundle(files, { now: NOW });
    const orphanFiles = report.issues.filter((i) => i.category === "orphan").map((i) => i.file);
    expect(orphanFiles).toContain("orphan.md");
    expect(orphanFiles).not.toContain("a.md");
  });

  it("treats `related` frontmatter as graph edges (no false orphans)", () => {
    const files = [
      concept("a.md", { type: "Note", description: "d", linked_sources: ["s"], related: ["b"] }),
      concept("b.md", { type: "Note", description: "d", linked_sources: ["s"] }),
    ];
    const report = auditOkfBundle(files, { now: NOW });
    const orphans = report.issues.filter((i) => i.category === "orphan").map((i) => i.file);
    // b is linked from a's `related`; a is the only true orphan.
    expect(orphans).toContain("a.md");
    expect(orphans).not.toContain("b.md");
  });

  it("computes a score that drops with issues", () => {
    const clean = auditOkfBundle(
      [concept("a.md", { type: "Note", description: "d", linked_sources: ["s"], timestamp: NOW.toISOString() }, "[A](/a.md)")],
      { now: NOW },
    );
    const dirty = auditOkfBundle(
      [{ path: "a.md", content: "---\ntitle: x\n---\n\n[CONFLICT] [STALE]" }],
      { now: NOW },
    );
    expect(clean.score).toBeGreaterThan(dirty.score);
    expect(dirty.score).toBeLessThan(100);
  });
});
