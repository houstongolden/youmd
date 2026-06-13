import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { runStackImprove } from "../lib/stackImprove";
import type { YouStackManifest } from "../lib/youstack";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "youmd-improve-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function makeManifest(extra: Partial<YouStackManifest> = {}): YouStackManifest {
  return {
    schemaVersion: "youstack/v1",
    kind: "youstack",
    slug: "test-stack",
    name: "Test Stack",
    version: "0.1.0",
    visibility: "private",
    ...extra,
  };
}

// ---------------------------------------------------------------------------
// Gate: observe mode refuses both propose and auto_pr
// ---------------------------------------------------------------------------

describe("runStackImprove — observe gate", () => {
  it("refuses propose when mode is observe", () => {
    const manifest = makeManifest({ improvement: { mode: "observe" } });
    const result = runStackImprove(manifest, tmpDir, "propose");
    expect(result.refused).toBeDefined();
    expect(result.refused).toMatch(/observe/);
  });

  it("refuses auto_pr when mode is observe", () => {
    const manifest = makeManifest({ improvement: { mode: "observe" } });
    const result = runStackImprove(manifest, tmpDir, "auto_pr");
    expect(result.refused).toBeDefined();
    expect(result.refused).toMatch(/observe/);
  });

  it("does not write journal when refused", () => {
    const manifest = makeManifest({ improvement: { mode: "observe" } });
    runStackImprove(manifest, tmpDir, "propose");
    const journalDir = path.join(tmpDir, "journal");
    expect(fs.existsSync(journalDir)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Gate: auto_pr requires a valid T2/T3 safety contract
// ---------------------------------------------------------------------------

describe("runStackImprove — auto_pr safety gate", () => {
  it("refuses auto_pr when no safety contract is declared", () => {
    const manifest = makeManifest({ improvement: { mode: "propose" } });
    const result = runStackImprove(manifest, tmpDir, "auto_pr");
    expect(result.refused).toBeDefined();
    expect(result.refused).toMatch(/auto_pr blocked/);
  });

  it("refuses auto_pr when tier is T1", () => {
    const manifest = makeManifest({
      improvement: { mode: "auto_pr" },
      safety: {
        tier: "T1",
        capabilities: { fs_write: true, auto_pr: false },
        humanGate: { required: false },
      },
    });
    const result = runStackImprove(manifest, tmpDir, "auto_pr");
    expect(result.refused).toBeDefined();
    expect(result.refused).toMatch(/auto_pr blocked/);
  });

  it("refuses auto_pr when T2 but humanGate.required is false", () => {
    const manifest = makeManifest({
      improvement: { mode: "auto_pr" },
      safety: {
        tier: "T2",
        capabilities: { auto_pr: true },
        humanGate: { required: false },
      },
    });
    const result = runStackImprove(manifest, tmpDir, "auto_pr");
    expect(result.refused).toBeDefined();
    expect(result.refused).toMatch(/auto_pr blocked/);
  });
});

// ---------------------------------------------------------------------------
// Propose mode: journal creation
// ---------------------------------------------------------------------------

describe("runStackImprove — propose mode journal", () => {
  it("creates the journal directory and file on first run", () => {
    const manifest = makeManifest({ improvement: { mode: "propose" } });
    const result = runStackImprove(manifest, tmpDir, "propose");
    expect(result.refused).toBeUndefined();
    expect(fs.existsSync(result.journalPath)).toBe(true);
    expect(result.appended).toBe(false);
  });

  it("journal file contains the slug header", () => {
    const manifest = makeManifest({ improvement: { mode: "propose" }, slug: "mystack" });
    const result = runStackImprove(manifest, tmpDir, "propose");
    const content = fs.readFileSync(result.journalPath, "utf-8");
    expect(content).toContain("mystack");
  });

  it("journal file contains a Run block", () => {
    const manifest = makeManifest({ improvement: { mode: "propose" } });
    const result = runStackImprove(manifest, tmpDir, "propose");
    const content = fs.readFileSync(result.journalPath, "utf-8");
    expect(content).toContain("## Run");
  });

  it("second run on the same day appends rather than creating a second file", () => {
    const manifest = makeManifest({ improvement: { mode: "propose" } });
    const first = runStackImprove(manifest, tmpDir, "propose");
    const second = runStackImprove(manifest, tmpDir, "propose");
    expect(first.journalPath).toBe(second.journalPath);
    expect(second.appended).toBe(true);
    const content = fs.readFileSync(second.journalPath, "utf-8");
    // Two Run blocks should exist.
    const runCount = (content.match(/## Run/g) ?? []).length;
    expect(runCount).toBe(2);
  });

  it("returns mode: propose", () => {
    const manifest = makeManifest({ improvement: { mode: "propose" } });
    const result = runStackImprove(manifest, tmpDir, "propose");
    expect(result.mode).toBe("propose");
  });
});

// ---------------------------------------------------------------------------
// Summary: signals and proposals
// ---------------------------------------------------------------------------

describe("runStackImprove — signals", () => {
  it("includes improvement.mode as a signal", () => {
    const manifest = makeManifest({ improvement: { mode: "propose" } });
    const result = runStackImprove(manifest, tmpDir, "propose");
    const sig = result.summary.signals.find((s) => s.name === "improvement.mode");
    expect(sig?.value).toBe("propose");
  });

  it("includes capability count as a signal", () => {
    const manifest = makeManifest({
      improvement: { mode: "propose" },
      capabilities: [{ id: "my-cap", intent: "do a thing" }],
    });
    const result = runStackImprove(manifest, tmpDir, "propose");
    const sig = result.summary.signals.find((s) => s.name === "capabilities.count");
    expect(sig?.value).toBe("1");
  });

  it("reports missing required files", () => {
    const manifest = makeManifest({
      improvement: { mode: "propose" },
      files: [{ path: "nonexistent.md", type: "docs", required: true }],
    });
    const result = runStackImprove(manifest, tmpDir, "propose");
    const sig = result.summary.signals.find((s) => s.name === "missing.required.files");
    expect(sig).toBeDefined();
    expect(sig?.value).toContain("nonexistent.md");
  });
});

describe("runStackImprove — proposals", () => {
  it("proposes adding evals when none are declared", () => {
    const manifest = makeManifest({ improvement: { mode: "propose" } });
    const result = runStackImprove(manifest, tmpDir, "propose");
    const proposal = result.summary.proposals.find((p) => p.id === "add-evals");
    expect(proposal).toBeDefined();
  });

  it("proposes filling missing required files", () => {
    const manifest = makeManifest({
      improvement: { mode: "propose" },
      files: [{ path: "missing.md", type: "docs", required: true }],
    });
    const result = runStackImprove(manifest, tmpDir, "propose");
    const proposal = result.summary.proposals.find((p) => p.id === "fill-missing-files");
    expect(proposal).toBeDefined();
  });

  it("produces no missing-files proposal when all files present", () => {
    // Create the required file.
    const filePath = path.join(tmpDir, "present.md");
    fs.writeFileSync(filePath, "# Present\n");
    const manifest = makeManifest({
      improvement: { mode: "propose" },
      files: [{ path: "present.md", type: "docs", required: true }],
    });
    const result = runStackImprove(manifest, tmpDir, "propose");
    const proposal = result.summary.proposals.find((p) => p.id === "fill-missing-files");
    expect(proposal).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// auto_pr allowed (T3)
// ---------------------------------------------------------------------------

describe("runStackImprove — auto_pr allowed tier", () => {
  it("does not refuse when T3 with non-empty scopes", () => {
    const manifest = makeManifest({
      improvement: { mode: "auto_pr" },
      safety: {
        tier: "T3",
        capabilities: { auto_pr: true, fs_write: true },
        humanGate: { required: true, scopes: ["stack.improve"] },
      },
    });
    // T3 would try to open a PR via `gh` — we just check it doesn't refuse.
    const result = runStackImprove(manifest, tmpDir, "auto_pr");
    expect(result.refused).toBeUndefined();
    expect(result.mode).toBe("auto_pr");
    // Journal must still be written.
    expect(fs.existsSync(result.journalPath)).toBe(true);
  });
});
