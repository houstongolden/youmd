/**
 * OKF brain-health audit.
 *
 * Audits an OKF bundle for the failure modes that rot agent knowledge bases
 * (the Familiar-second-brain "graph health" idea, applied to OKF): concepts
 * missing a type, thin/un-sourced concepts, agent-authored low-confidence
 * concepts that need a human pass, stale concepts, unresolved [CONFLICT]/[STALE]
 * markers, and orphans nothing links to.
 *
 * Pure — operates on in-memory files so it can be unit-tested and reused by the
 * CLI against either the live bundle or any OKF directory on disk.
 */

import matter from "gray-matter";
import { OkfBundleFile, conceptId, isReservedFile } from "./okf";

export type OkfHealthCategory =
  | "missing_type"
  | "no_description"
  | "unsourced"
  | "needs_review"
  | "stale"
  | "conflict"
  | "orphan";

export interface OkfHealthIssue {
  category: OkfHealthCategory;
  level: "error" | "warning" | "info";
  file: string;
  message: string;
}

export interface OkfHealthReport {
  ok: boolean;
  totalConcepts: number;
  issues: OkfHealthIssue[];
  summary: Record<OkfHealthCategory, number>;
  /** 0-100 health score (100 = clean). */
  score: number;
}

export interface OkfHealthOptions {
  /** Concepts whose timestamp is older than this many days are flagged. */
  staleDays?: number;
  /** Injectable "now" for deterministic tests. */
  now?: Date;
}

interface ParsedConcept {
  file: string;
  id: string;
  data: Record<string, unknown>;
  body: string;
}

/** Extract every link target from markdown: [text](target) and [[wikilink]]. */
function extractLinkTargets(text: string): string[] {
  const targets: string[] = [];
  const mdLink = /\]\(([^)\s]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = mdLink.exec(text)) !== null) targets.push(m[1]);
  const wiki = /\[\[([^\]]+)\]\]/g;
  while ((m = wiki.exec(text)) !== null) targets.push(m[1]);
  return targets;
}

/** Normalize a link target to a concept id (strip leading slash, .md, anchors). */
function targetToConceptId(target: string): string {
  return target
    .replace(/^\.?\//, "")
    .replace(/#.*$/, "")
    .replace(/\.md$/i, "")
    .trim();
}

const EMPTY_SUMMARY = (): Record<OkfHealthCategory, number> => ({
  missing_type: 0,
  no_description: 0,
  unsourced: 0,
  needs_review: 0,
  stale: 0,
  conflict: 0,
  orphan: 0,
});

const PENALTY: Record<OkfHealthIssue["level"], number> = {
  error: 10,
  warning: 3,
  info: 1,
};

/**
 * Audit a set of OKF files. A bundle is `ok` when there are no errors (a
 * missing `type` is the only error; everything else is advisory).
 */
export function auditOkfBundle(
  files: OkfBundleFile[],
  options: OkfHealthOptions = {},
): OkfHealthReport {
  const staleDays = options.staleDays ?? 30;
  const now = options.now ?? new Date();

  const concepts: ParsedConcept[] = [];
  const referenced = new Set<string>();

  for (const file of files) {
    const rel = file.path.replace(/\\/g, "/");
    if (!rel.toLowerCase().endsWith(".md")) continue;

    // Every file (including index.md/log.md) contributes graph edges.
    for (const target of extractLinkTargets(file.content)) {
      referenced.add(targetToConceptId(target));
    }

    if (isReservedFile(rel)) continue;
    const { data, content } = matter(file.content);
    const fm = (data || {}) as Record<string, unknown>;
    // `related` frontmatter edges count toward the graph too.
    if (Array.isArray(fm.related)) {
      for (const target of fm.related) {
        if (typeof target === "string") referenced.add(targetToConceptId(target));
      }
    }
    concepts.push({
      file: rel,
      id: conceptId(rel),
      data: fm,
      body: content,
    });
  }

  const issues: OkfHealthIssue[] = [];
  const summary = EMPTY_SUMMARY();
  const add = (issue: OkfHealthIssue) => {
    issues.push(issue);
    summary[issue.category] += 1;
  };

  for (const concept of concepts) {
    const { file, id, data, body } = concept;

    const type = data.type;
    if (typeof type !== "string" || type.trim() === "") {
      add({ category: "missing_type", level: "error", file, message: "missing required `type`" });
    }

    if (typeof data.description !== "string" || !data.description.trim()) {
      add({ category: "no_description", level: "info", file, message: "no description" });
    }

    const linkedSources = data.linked_sources;
    if (!Array.isArray(linkedSources) || linkedSources.length === 0) {
      add({ category: "unsourced", level: "info", file, message: "no linked_sources (un-sourced)" });
    }

    const confidence = typeof data.confidence === "string" ? data.confidence : "";
    const author = typeof data.last_updated_by === "string" ? data.last_updated_by : "";
    if (confidence === "low" || (author === "agent" && !confidence)) {
      add({
        category: "needs_review",
        level: "warning",
        file,
        message:
          confidence === "low"
            ? "low confidence — needs a human pass"
            : "agent-authored with no confidence — needs a human pass",
      });
    }

    const timestamp = typeof data.timestamp === "string" ? data.timestamp : "";
    if (timestamp) {
      const ts = Date.parse(timestamp);
      if (!Number.isNaN(ts)) {
        const ageDays = (now.getTime() - ts) / (1000 * 60 * 60 * 24);
        if (ageDays > staleDays) {
          add({
            category: "stale",
            level: "warning",
            file,
            message: `not updated in ${Math.floor(ageDays)} days (> ${staleDays})`,
          });
        }
      }
    }
    if (/\[STALE\]/.test(body)) {
      add({ category: "stale", level: "warning", file, message: "contains a [STALE] marker" });
    }

    if (/\[CONFLICT\]/.test(body)) {
      add({ category: "conflict", level: "warning", file, message: "contains an unresolved [CONFLICT] marker" });
    }

    // Orphan: no other file links to this concept id.
    if (!referenced.has(id)) {
      add({ category: "orphan", level: "info", file, message: "orphan — nothing links to it" });
    }
  }

  const ok = issues.every((i) => i.level !== "error");
  const penalty = issues.reduce((sum, i) => sum + PENALTY[i.level], 0);
  const score = Math.max(0, 100 - penalty);

  return { ok, totalConcepts: concepts.length, issues, summary, score };
}
