/**
 * stackImprove.ts — L14 local stack improvement runner.
 *
 * Two modes:
 *   propose   — journal-only; writes to stacks/<slug>/journal/<YYYY-MM-DD>.md
 *               allowed from T1 upward (requires improvement.mode != "observe").
 *   auto_pr   — opens a PR via `gh` CLI (or prints the patch if gh not found);
 *               gated by T2/T3 with humanGate.required (tierAllows auto_pr).
 *
 * Idempotent: re-runs on the same day append under a new ## Run block rather
 * than creating a second file.
 *
 * Key contract:
 *   - Never touches main branch.
 *   - Never runs if the manifest mode is "observe" (journal-only requires at
 *     least "propose").
 *   - Always logs to the journal; auto_pr additionally creates the branch + PR.
 *   - tierAllows() from stackSafety.ts is the single gate for auto_pr.
 */

import * as fs from "fs";
import * as path from "path";
import { execFileSync, execSync } from "child_process";
import type { YouStackManifest } from "./youstack";
import { parseSafetyContract, tierAllows } from "./stackSafety";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ImproveMode = "propose" | "auto_pr";

export interface ImproveSummary {
  /** Signals gathered from the manifest's improvement.signals list. */
  signals: SignalEntry[];
  /** Proposals generated (human-readable action items). */
  proposals: ProposalEntry[];
}

export interface SignalEntry {
  name: string;
  value: string;
}

export interface ProposalEntry {
  id: string;
  description: string;
  rationale: string;
}

export interface StackImproveResult {
  mode: ImproveMode;
  journalPath: string;
  /** true if the entry was appended to an existing file (idempotent re-run). */
  appended: boolean;
  summary: ImproveSummary;
  /** Only present in auto_pr mode — the pr URL or "no-gh" if gh CLI absent. */
  prUrl?: string;
  /** Refusal reason when the manifest contract blocks the requested mode. */
  refused?: string;
}

// ---------------------------------------------------------------------------
// Signal gathering
// ---------------------------------------------------------------------------

function gatherSignals(manifest: YouStackManifest, rootDir: string): SignalEntry[] {
  const signals: SignalEntry[] = [];
  const declaredSignals = manifest.improvement?.signals ?? [];

  // Always include the declared mode as a signal.
  signals.push({
    name: "improvement.mode",
    value: manifest.improvement?.mode ?? "observe",
  });

  // eval file check
  const evalsDecl = manifest.improvement?.evals ?? [];
  for (const evalPath of evalsDecl) {
    const full = path.isAbsolute(evalPath)
      ? evalPath
      : path.join(rootDir, evalPath);
    const exists = fs.existsSync(full);
    signals.push({ name: `eval:${evalPath}`, value: exists ? "present" : "missing" });
  }

  // Journal entry count (approximate health of the journal)
  const journalDir = path.join(rootDir, "journal");
  if (fs.existsSync(journalDir)) {
    const entries = fs.readdirSync(journalDir).filter((f) => f.endsWith(".md"));
    signals.push({ name: "journal.entries", value: String(entries.length) });
  } else {
    signals.push({ name: "journal.entries", value: "0 (no journal dir yet)" });
  }

  // File completeness
  const files = manifest.files ?? [];
  const missingFiles = files.filter((f) => {
    const full = path.isAbsolute(f.path) ? f.path : path.join(rootDir, f.path);
    return f.required && !fs.existsSync(full);
  });
  if (missingFiles.length > 0) {
    signals.push({ name: "missing.required.files", value: missingFiles.map((f) => f.path).join(", ") });
  } else if (files.length > 0) {
    signals.push({ name: "required.files", value: `all ${files.length} present` });
  }

  // Capability count
  const caps = manifest.capabilities ?? [];
  signals.push({ name: "capabilities.count", value: String(caps.length) });

  // Declared signals from the manifest (capture them as-is; real implementations
  // would resolve these against activity logs, journal entries, etc.)
  for (const sig of declaredSignals) {
    if (!signals.find((s) => s.name === sig)) {
      signals.push({ name: sig, value: "declared (not yet instrumented)" });
    }
  }

  return signals;
}

// ---------------------------------------------------------------------------
// Proposal generation
// ---------------------------------------------------------------------------

function generateProposals(
  manifest: YouStackManifest,
  signals: SignalEntry[]
): ProposalEntry[] {
  const proposals: ProposalEntry[] = [];

  // Missing required files
  const missingFilesSig = signals.find((s) => s.name === "missing.required.files");
  if (missingFilesSig) {
    proposals.push({
      id: "fill-missing-files",
      description: `Add missing required files: ${missingFilesSig.value}`,
      rationale: "Required files declared in the manifest are not present on disk.",
    });
  }

  // No evals declared
  if (!manifest.improvement?.evals || manifest.improvement.evals.length === 0) {
    proposals.push({
      id: "add-evals",
      description: 'Add improvement.evals to the manifest (e.g. "youmd stack smoke", "youmd stack eval")',
      rationale: "Evals gate auto-apply; without them, the stack cannot safely self-apply changes.",
    });
  }

  // Missing evals files
  const missingEvals = signals.filter(
    (s) => s.name.startsWith("eval:") && s.value === "missing"
  );
  for (const sig of missingEvals) {
    proposals.push({
      id: `create-eval-${sig.name.replace("eval:", "").replace(/\W+/g, "-")}`,
      description: `Create the declared eval file: ${sig.name.replace("eval:", "")}`,
      rationale: "The eval is declared in improvement.evals but the file does not exist.",
    });
  }

  // No capabilities
  if ((manifest.capabilities?.length ?? 0) === 0) {
    proposals.push({
      id: "declare-capabilities",
      description: "Declare at least one capability in the manifest",
      rationale: "No capabilities means youmd stack route cannot match any request.",
    });
  }

  // Observe mode warning
  if (manifest.improvement?.mode === "observe") {
    proposals.push({
      id: "upgrade-improvement-mode",
      description: 'Consider upgrading improvement.mode from "observe" to "propose" to enable journal writes',
      rationale: 'Mode "observe" prevents any journal writes, including proposals.',
    });
  }

  return proposals;
}

// ---------------------------------------------------------------------------
// Journal writing
// ---------------------------------------------------------------------------

function utcDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function utcTimestamp(): string {
  return new Date().toISOString();
}

function journalFilePath(rootDir: string): string {
  const journalDir = path.join(rootDir, "journal");
  return path.join(journalDir, `${utcDate()}.md`);
}

function renderJournalEntry(summary: ImproveSummary, mode: ImproveMode, runTs: string): string {
  const lines: string[] = [];
  lines.push(`## Run — ${runTs}`);
  lines.push(`Mode: ${mode}`);
  lines.push("");
  lines.push("### Signals");
  for (const sig of summary.signals) {
    lines.push(`- **${sig.name}**: ${sig.value}`);
  }
  lines.push("");
  lines.push("### Proposals");
  if (summary.proposals.length === 0) {
    lines.push("No proposals generated.");
  } else {
    for (const p of summary.proposals) {
      lines.push(`#### ${p.id}`);
      lines.push(`> ${p.description}`);
      lines.push(`> *Rationale:* ${p.rationale}`);
      lines.push("");
    }
  }
  lines.push("---");
  lines.push("");
  return lines.join("\n");
}

function ensureJournalFile(journalPath: string, slug: string): { existed: boolean } {
  const journalDir = path.dirname(journalPath);
  if (!fs.existsSync(journalDir)) {
    fs.mkdirSync(journalDir, { recursive: true });
  }
  const existed = fs.existsSync(journalPath);
  if (!existed) {
    const header = `# Stack Journal — ${slug}\n\nDate: ${utcDate()}\n\n`;
    fs.writeFileSync(journalPath, header, "utf-8");
  }
  return { existed };
}

// ---------------------------------------------------------------------------
// auto_pr implementation
// ---------------------------------------------------------------------------

function ghAvailable(): boolean {
  try {
    execFileSync("gh", ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function renderPatchText(summary: ImproveSummary, slug: string): string {
  const lines: string[] = [];
  lines.push(`# Stack Improvement Proposals — ${slug}`);
  lines.push(`Generated: ${utcTimestamp()}`);
  lines.push("");
  for (const p of summary.proposals) {
    lines.push(`## ${p.id}`);
    lines.push(`**Action:** ${p.description}`);
    lines.push(`**Rationale:** ${p.rationale}`);
    lines.push("");
  }
  return lines.join("\n");
}

function openAutoPr(
  rootDir: string,
  slug: string,
  summary: ImproveSummary,
  journalPath: string
): string {
  if (!ghAvailable()) {
    // Print patch to stdout; caller surfaces it.
    return "no-gh";
  }

  const branch = `stack-improve/${slug}/${utcDate()}`;

  // Attempt to create the branch and push the journal.
  try {
    // Create branch from current HEAD (never modifies main directly).
    execSync(`git checkout -b "${branch}"`, { cwd: rootDir, stdio: "pipe" });
    execSync(`git add "${journalPath}"`, { cwd: rootDir, stdio: "pipe" });
    execSync(
      `git commit -m "feat(stack): ${slug} improvement proposals ${utcDate()}"`,
      { cwd: rootDir, stdio: "pipe" }
    );
    execSync(`git push origin "${branch}"`, { cwd: rootDir, stdio: "pipe" });

    const prTitle = `stack-improve: ${slug} ${utcDate()}`;
    const prBody = `Auto-generated by \`youmd stack improve --mode auto_pr\`.\n\n${renderPatchText(summary, slug)}`;
    const result = execSync(
      `gh pr create --title "${prTitle}" --body "${prBody.replace(/"/g, '\\"')}" --base main --head "${branch}"`,
      { cwd: rootDir, encoding: "utf-8" }
    );
    return result.trim();
  } catch (err) {
    // Return a descriptive error string; caller surfaces it.
    return `pr-failed: ${err instanceof Error ? err.message : String(err)}`;
  }
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export function runStackImprove(
  manifest: YouStackManifest,
  rootDir: string,
  mode: ImproveMode
): StackImproveResult {
  // ── Gate 1: mode must be at least "propose" in the manifest ──────────
  const declaredMode = manifest.improvement?.mode ?? "observe";
  if (declaredMode === "observe") {
    return {
      mode,
      journalPath: journalFilePath(rootDir),
      appended: false,
      summary: { signals: [], proposals: [] },
      refused: `improvement.mode is "observe" in the manifest; journal writes require at least "propose"`,
    };
  }

  // ── Gate 2: auto_pr requires tierAllows("auto_pr") ───────────────────
  if (mode === "auto_pr") {
    const contract = parseSafetyContract(manifest);
    if (!contract || !tierAllows(contract, "auto_pr")) {
      const tier = contract?.tier ?? "(no safety contract)";
      return {
        mode,
        journalPath: journalFilePath(rootDir),
        appended: false,
        summary: { signals: [], proposals: [] },
        refused: `auto_pr blocked: tier ${tier} does not allow auto_pr (requires T2 with humanGate.required, or T3)`,
      };
    }
  }

  // ── Gather signals + proposals ────────────────────────────────────────
  const signals = gatherSignals(manifest, rootDir);
  const proposals = generateProposals(manifest, signals);
  const summary: ImproveSummary = { signals, proposals };
  const runTs = utcTimestamp();

  // ── Write journal ─────────────────────────────────────────────────────
  const journalPath = journalFilePath(rootDir);
  const { existed } = ensureJournalFile(journalPath, manifest.slug);
  const entry = renderJournalEntry(summary, mode, runTs);
  fs.appendFileSync(journalPath, entry, "utf-8");

  // ── auto_pr branch ───────────────────────────────────────────────────
  let prUrl: string | undefined;
  if (mode === "auto_pr") {
    prUrl = openAutoPr(rootDir, manifest.slug, summary, journalPath);
  }

  return {
    mode,
    journalPath,
    appended: existed,
    summary,
    prUrl,
  };
}
