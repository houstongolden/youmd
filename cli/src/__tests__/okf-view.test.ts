import { describe, it, expect } from "vitest";
import { buildBrainView, renderBrainHtml } from "../lib/okf-view";
import { buildOkfBundleFiles, YoumdSection } from "../lib/okf-bundle";

const NOW = new Date("2026-06-13T00:00:00Z");

const SECTIONS: YoumdSection[] = [
  { dir: "profile", slug: "about", title: "About", body: "Founder.", timestamp: NOW.toISOString() },
  { dir: "voice", slug: "voice", title: "Voice", body: "Overall voice.", timestamp: NOW.toISOString() },
  { dir: "voice", slug: "voice.linkedin", title: "LinkedIn Voice", body: "LI voice.", timestamp: NOW.toISOString() },
  { dir: "skills", slug: "voice-sync", title: "Voice Sync", body: "Sync voice.", timestamp: NOW.toISOString() },
];

describe("buildBrainView", () => {
  it("builds a grouped, edged view model from OKF files", () => {
    const files = buildOkfBundleFiles(SECTIONS, { defaultAuthor: "houston" });
    const view = buildBrainView(files, { now: NOW });

    expect(view.title).toContain("You.md");
    expect(view.okfVersion).toBe("0.1");
    expect(view.concepts).toHaveLength(4); // reserved index/log excluded

    // grouped by type
    const types = view.groups.map((g) => g.type);
    expect(types).toContain("Identity Profile");
    expect(types).toContain("Voice Profile");
    expect(types).toContain("Skill");

    // edges come from derived `related` (voice.linkedin -> voice, all -> about)
    const edgePairs = view.edges.map((e) => `${e.from}->${e.to}`);
    expect(edgePairs).toContain("voice/voice.linkedin->voice/voice");
    expect(edgePairs).toContain("skills/voice-sync->profile/about");
    // health is included
    expect(view.health.totalConcepts).toBe(4);
  });

  it("only includes edges whose target exists", () => {
    const files = buildOkfBundleFiles(SECTIONS);
    const view = buildBrainView(files, { now: NOW });
    const ids = new Set(view.concepts.map((c) => c.id));
    for (const e of view.edges) {
      expect(ids.has(e.from)).toBe(true);
      expect(ids.has(e.to)).toBe(true);
    }
  });
});

describe("renderBrainHtml", () => {
  it("produces a self-contained HTML page with no external resources", () => {
    const files = buildOkfBundleFiles(SECTIONS, { defaultAuthor: "houston" });
    const html = renderBrainHtml(buildBrainView(files, { now: NOW }));

    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("<style>");
    // no external scripts/styles/network
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/https?:\/\//);
    expect(html).not.toMatch(/<link\b/i);

    // content present
    expect(html).toContain("brain health:");
    expect(html).toContain("About");
    expect(html).toContain("LinkedIn Voice");
    // related rendered as in-page anchors
    expect(html).toContain('href="#c-');
  });

  it("escapes HTML in concept content", () => {
    const files = buildOkfBundleFiles([
      { dir: "profile", slug: "about", title: "A <script>x</script>", body: "Body & <b>stuff</b>." },
    ]);
    const html = renderBrainHtml(buildBrainView(files, { now: NOW }));
    expect(html).not.toContain("<script>x</script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
