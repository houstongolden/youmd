import { describe, it, expect } from "vitest";
import { mergeSections, normalizeSection, decisionLabel } from "../lib/merge";

/** A small but realistic nested you-md/v1 bundle. */
function makeBundle(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schema: "you-md/v1",
    username: "tester",
    generated_at: "2026-01-01T00:00:00Z",
    identity: { name: "Tester", tagline: "builds things", bio: { short: "a tester." } },
    now: { focus: ["shipping"], updated_at: "2026-01-01" },
    projects: [{ name: "youmd", role: "founder", status: "active", url: "", description: "" }],
    values: ["honesty"],
    links: { github: "https://github.com/tester" },
    preferences: { agent: { tone: "direct", formality: "casual", avoid: [], markdown: "" } },
    voice: { overall: "dry", markdown: "", platforms: { linkedin: null, x: null, blog: null } },
    agent_directives: { communication_style: "terse", negative_prompts: [], markdown: "" },
    custom_sections: [],
    meta: { sources_used: [], last_updated: "2026-01-01T00:00:00Z" },
    ...overrides,
  };
}

describe("mergeSections — per-section decisions", () => {
  it("keeps everything when nothing changed", () => {
    const base = makeBundle();
    const result = mergeSections(base, makeBundle(), makeBundle());

    expect(result.clean).toBe(true);
    expect(result.conflicts).toEqual([]);
    expect(result.sections.every((s) => s.decision === "unchanged")).toBe(true);
    expect(result.merged.identity).toEqual(base.identity);
    expect(result.merged.values).toEqual(base.values);
  });

  it("only local changed → keeps local", () => {
    const base = makeBundle();
    const local = makeBundle({ identity: { name: "Tester", tagline: "edited locally", bio: { short: "a tester." } } });
    const remote = makeBundle();

    const result = mergeSections(base, local, remote);

    expect(result.clean).toBe(true);
    expect(result.merged.identity).toEqual(local.identity);
    expect(result.sections.find((s) => s.section === "identity")?.decision).toBe("keep-local");
  });

  it("only remote changed → takes remote", () => {
    const base = makeBundle();
    const local = makeBundle();
    const remote = makeBundle({ values: ["honesty", "speed"] });

    const result = mergeSections(base, local, remote);

    expect(result.clean).toBe(true);
    expect(result.merged.values).toEqual(["honesty", "speed"]);
    expect(result.sections.find((s) => s.section === "values")?.decision).toBe("take-remote");
  });

  it("both changed identically → keeps without conflict", () => {
    const base = makeBundle();
    const same = { focus: ["new focus"], updated_at: "2026-06-12" };
    const local = makeBundle({ now: same });
    const remote = makeBundle({ now: { ...same } });

    const result = mergeSections(base, local, remote);

    expect(result.clean).toBe(true);
    expect((result.merged.now as Record<string, unknown>).focus).toEqual(["new focus"]);
    expect(result.sections.find((s) => s.section === "now")?.decision).toBe("both-equal");
  });

  it("both changed differently → conflict, merge not clean", () => {
    const base = makeBundle();
    const local = makeBundle({ values: ["local value"] });
    const remote = makeBundle({ values: ["remote value"] });

    const result = mergeSections(base, local, remote);

    expect(result.clean).toBe(false);
    expect(result.conflicts).toEqual(["values"]);
    expect(result.sections.find((s) => s.section === "values")?.decision).toBe("conflict");
  });

  it("multi-section mix: local + remote + identical + conflict resolved independently", () => {
    const base = makeBundle();
    const local = makeBundle({
      identity: { name: "Tester", tagline: "local tagline", bio: { short: "a tester." } },
      values: ["local value"],
      links: { github: "https://github.com/tester", x: "https://x.com/tester" },
    });
    const remote = makeBundle({
      projects: [{ name: "youmd", role: "founder", status: "shipped", url: "", description: "" }],
      values: ["remote value"],
      links: { github: "https://github.com/tester", x: "https://x.com/tester" },
    });

    const result = mergeSections(base, local, remote);

    expect(result.clean).toBe(false);
    expect(result.conflicts).toEqual(["values"]);
    // Non-conflicting sections still got the right decisions
    expect(result.sections.find((s) => s.section === "identity")?.decision).toBe("keep-local");
    expect(result.sections.find((s) => s.section === "projects")?.decision).toBe("take-remote");
    expect(result.sections.find((s) => s.section === "links")?.decision).toBe("both-equal");
    expect(result.sections.find((s) => s.section === "voice")?.decision).toBe("unchanged");
  });

  it("a clean multi-section merge combines local and remote sections", () => {
    const base = makeBundle();
    const local = makeBundle({ identity: { name: "Tester", tagline: "local tagline", bio: { short: "a tester." } } });
    const remote = makeBundle({ values: ["remote value"], custom_sections: [{ id: "talks", title: "Talks", content: "spoke at x" }] });

    const result = mergeSections(base, local, remote);

    expect(result.clean).toBe(true);
    expect((result.merged.identity as Record<string, unknown>).tagline).toBe("local tagline");
    expect(result.merged.values).toEqual(["remote value"]);
    expect(result.merged.custom_sections).toEqual([{ id: "talks", title: "Talks", content: "spoke at x" }]);
  });
});

describe("mergeSections — edge cases", () => {
  it("section deleted locally, untouched remotely → stays deleted", () => {
    const base = makeBundle();
    const local = makeBundle();
    delete local.custom_sections;
    const remote = makeBundle();

    const result = mergeSections(base, local, remote);

    expect(result.clean).toBe(true);
    expect("custom_sections" in result.merged).toBe(false);
    expect(result.sections.find((s) => s.section === "custom_sections")?.decision).toBe("keep-local");
  });

  it("section added remotely, absent locally and in base → taken from remote", () => {
    const base = makeBundle();
    delete base.custom_sections;
    const local = makeBundle();
    delete local.custom_sections;
    const remote = makeBundle({ custom_sections: [{ id: "press", title: "Press", content: "featured" }] });

    const result = mergeSections(base, local, remote);

    expect(result.clean).toBe(true);
    expect(result.merged.custom_sections).toEqual([{ id: "press", title: "Press", content: "featured" }]);
  });

  it("now.updated_at recompile stamp alone does not read as a change", () => {
    const base = makeBundle({ now: { focus: ["shipping"], updated_at: "2026-01-01" } });
    const local = makeBundle({ now: { focus: ["shipping"], updated_at: "2026-06-12" } });
    const remote = makeBundle({ now: { focus: ["remote focus"], updated_at: "2026-06-10" } });

    const result = mergeSections(base, local, remote);

    // local's only difference is the volatile stamp → remote's real edit wins
    expect(result.clean).toBe(true);
    expect(result.sections.find((s) => s.section === "now")?.decision).toBe("take-remote");
    expect((result.merged.now as Record<string, unknown>).focus).toEqual(["remote focus"]);
  });

  it("scaffold keys (schema/username/generated_at/meta) come from remote and never conflict", () => {
    const base = makeBundle();
    const local = makeBundle({ generated_at: "2026-06-01T00:00:00Z", meta: { sources_used: [], last_updated: "2026-06-01T00:00:00Z" } });
    const remote = makeBundle({ generated_at: "2026-06-12T00:00:00Z", meta: { sources_used: [], last_updated: "2026-06-12T00:00:00Z" } });

    const result = mergeSections(base, local, remote);

    expect(result.clean).toBe(true);
    expect(result.merged.generated_at).toBe("2026-06-12T00:00:00Z");
    expect((result.merged.meta as Record<string, unknown>).last_updated).toBe("2026-06-12T00:00:00Z");
    expect(result.sections.find((s) => s.section === "generated_at")).toBeUndefined();
    expect(result.sections.find((s) => s.section === "meta")).toBeUndefined();
  });

  it("handles null/missing inputs without throwing", () => {
    const result = mergeSections(null, makeBundle(), makeBundle({ values: ["remote value"] }));
    // No base: any difference between local and remote is a both-changed comparison
    expect(result.conflicts).toContain("values");
    expect(result.clean).toBe(false);
  });

  it("object key order does not cause false conflicts", () => {
    const base = makeBundle({ identity: { name: "Tester", tagline: "t", bio: { short: "s" } } });
    const local = makeBundle({ identity: { bio: { short: "s" }, tagline: "t", name: "Tester" } });
    const remote = makeBundle({ identity: { tagline: "t", name: "Tester", bio: { short: "s" } } });

    const result = mergeSections(base, local, remote);
    expect(result.sections.find((s) => s.section === "identity")?.decision).toBe("unchanged");
  });

  it("atomicity contract: conflicts are all reported, clean=false means do not write", () => {
    const base = makeBundle();
    const local = makeBundle({ values: ["local"], voice: { overall: "local voice", markdown: "", platforms: {} } });
    const remote = makeBundle({ values: ["remote"], voice: { overall: "remote voice", markdown: "", platforms: {} } });

    const result = mergeSections(base, local, remote);

    expect(result.clean).toBe(false);
    expect(result.conflicts.sort()).toEqual(["values", "voice"]);
  });
});

describe("normalizeSection + decisionLabel", () => {
  it("normalizeSection strips now.updated_at only for the now section", () => {
    const a = normalizeSection("now", { focus: ["x"], updated_at: "2026-01-01" });
    const b = normalizeSection("now", { focus: ["x"], updated_at: "2026-06-12" });
    expect(a).toBe(b);

    const c = normalizeSection("identity", { name: "x", updated_at: "2026-01-01" });
    const d = normalizeSection("identity", { name: "x", updated_at: "2026-06-12" });
    expect(c).not.toBe(d);
  });

  it("decisionLabel covers every decision", () => {
    expect(decisionLabel("unchanged")).toBe("unchanged");
    expect(decisionLabel("keep-local")).toBe("kept local");
    expect(decisionLabel("take-remote")).toBe("took remote");
    expect(decisionLabel("both-equal")).toBe("both sides match");
    expect(decisionLabel("conflict")).toBe("conflict");
  });
});
