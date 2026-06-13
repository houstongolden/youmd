/**
 * OKF (Open Knowledge Format) core library.
 *
 * OKF is a vendor-neutral standard (okf/v0.1) for representing knowledge as a
 * directory of UTF-8 markdown files, each carrying a YAML frontmatter block.
 * The only required frontmatter field is `type`. Two filenames are reserved:
 *   - index.md  — directory listing for progressive disclosure (no frontmatter,
 *                 except a bundle-root index may declare `okf_version`)
 *   - log.md    — chronological, date-grouped change history (newest first)
 * A concept's ID is its file path with the trailing ".md" removed.
 *
 * Spec: https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md
 *
 * This module is pure — no filesystem access, no You.md specifics — so it can
 * be unit-tested in isolation and reused by the export/import layers.
 */

import matter from "gray-matter";
import yaml from "js-yaml";

export const OKF_VERSION = "0.1";
export const OKF_RESERVED_FILES = ["index.md", "log.md"] as const;

/** Recommended frontmatter fields, in the spec's priority order. */
const RECOMMENDED_FIELD_ORDER = [
  "type",
  "title",
  "description",
  "resource",
  "tags",
  "timestamp",
];

/**
 * Provenance fields (Familiar-second-brain convention). Optional, OKF-legal
 * custom keys that let agents audit a concept: who last wrote it, how sure the
 * writer is, and what it was derived from. Emitted in a stable position right
 * after the recommended fields so audits are scannable.
 */
const PROVENANCE_FIELD_ORDER = ["last_updated_by", "confidence", "linked_sources"];

/** Allowed `confidence` values (warned, not enforced — OKF tolerates unknowns). */
export const OKF_CONFIDENCE_LEVELS = ["low", "medium", "high"] as const;
export type OkfConfidence = (typeof OKF_CONFIDENCE_LEVELS)[number];

export interface OkfFrontmatter {
  /** Required: a short string identifying the kind of concept. */
  type: string;
  /** Human-readable display name. */
  title?: string;
  /** A single sentence summarizing the concept. */
  description?: string;
  /** URI uniquely identifying the underlying asset. */
  resource?: string;
  /** Cross-cutting categorization. */
  tags?: string[];
  /** ISO 8601 datetime of last change. */
  timestamp?: string;
  /** Provenance: who last wrote this concept (e.g. "houston", "agent"). */
  last_updated_by?: string;
  /** Provenance: writer's confidence — low | medium | high. */
  confidence?: string;
  /** Provenance: source concept IDs or URIs this concept derives from. */
  linked_sources?: string[];
  /** Producers may add custom keys; consumers must preserve them. */
  [key: string]: unknown;
}

export interface OkfFile {
  frontmatter: OkfFrontmatter;
  body: string;
}

// ─── Concept identity ──────────────────────────────────────────────────

/** Normalize a path to forward slashes. */
function normalizeRelPath(relPath: string): string {
  return relPath.replace(/\\/g, "/").replace(/^\.\//, "");
}

/** The OKF concept ID for a file path: the path with ".md" removed. */
export function conceptId(relPath: string): string {
  return normalizeRelPath(relPath).replace(/\.md$/i, "");
}

/** Whether a path's basename is an OKF reserved filename. */
export function isReservedFile(relPath: string): boolean {
  const base = normalizeRelPath(relPath).split("/").pop() || "";
  return (OKF_RESERVED_FILES as readonly string[]).includes(base);
}

/** A bundle-relative absolute link to a concept (recommended stable form). */
export function conceptHref(relPath: string): string {
  return "/" + normalizeRelPath(relPath);
}

// ─── Serialize / parse ─────────────────────────────────────────────────

/**
 * Serialize a concept file: frontmatter (type first, then recommended fields,
 * then custom keys sorted for determinism) followed by the markdown body.
 * Throws if `type` is missing or empty — that is the one OKF hard requirement.
 */
export function serializeOkfFile(file: OkfFile): string {
  const { frontmatter, body } = file;
  if (
    !frontmatter ||
    typeof frontmatter.type !== "string" ||
    frontmatter.type.trim() === ""
  ) {
    throw new Error("OKF concept file requires a non-empty `type` frontmatter field");
  }

  const placed = new Set<string>();
  const ordered: Record<string, unknown> = {};
  for (const key of [...RECOMMENDED_FIELD_ORDER, ...PROVENANCE_FIELD_ORDER]) {
    if (frontmatter[key] !== undefined) {
      ordered[key] = frontmatter[key];
      placed.add(key);
    }
  }
  for (const key of Object.keys(frontmatter).sort()) {
    if (placed.has(key)) continue;
    if (frontmatter[key] !== undefined) ordered[key] = frontmatter[key];
  }

  const yamlStr = yaml
    .dump(ordered, { lineWidth: -1, noRefs: true, sortKeys: false })
    .trimEnd();

  return `---\n${yamlStr}\n---\n\n${body.trim()}\n`;
}

/** Parse a concept file into frontmatter + trimmed body. */
export function parseOkfFile(raw: string): OkfFile {
  const { data, content } = matter(raw);
  return { frontmatter: (data || {}) as OkfFrontmatter, body: content.trim() };
}

// ─── Validation ────────────────────────────────────────────────────────

export interface OkfValidationIssue {
  file: string;
  level: "error" | "warning";
  message: string;
}

export interface OkfValidationResult {
  ok: boolean;
  errors: OkfValidationIssue[];
  warnings: OkfValidationIssue[];
}

export interface OkfBundleFile {
  /** Bundle-relative path, e.g. "profile/about.md". */
  path: string;
  content: string;
}

/**
 * Validate a single file against OKF conformance rules. `isRoot` marks the
 * bundle-root index.md, which may carry an `okf_version` frontmatter.
 */
export function validateOkfFileEntry(
  file: OkfBundleFile,
  options: { isRoot?: boolean } = {},
): OkfValidationIssue[] {
  const issues: OkfValidationIssue[] = [];
  const rel = normalizeRelPath(file.path);

  if (!rel.toLowerCase().endsWith(".md")) {
    // Non-markdown files (manifests, json) are allowed alongside concepts.
    return issues;
  }

  const base = rel.split("/").pop() || "";

  if (base === "index.md") {
    const { data } = matter(file.content);
    const keys = Object.keys(data || {});
    const allowed = options.isRoot ? ["okf_version"] : [];
    const extra = keys.filter((k) => !allowed.includes(k));
    if (extra.length > 0) {
      issues.push({
        file: rel,
        level: "error",
        message: options.isRoot
          ? `index.md may only declare \`okf_version\` in frontmatter; found: ${extra.join(", ")}`
          : `index.md must not contain frontmatter; found: ${extra.join(", ")}`,
      });
    }
    return issues;
  }

  if (base === "log.md") {
    const { data } = matter(file.content);
    if (Object.keys(data || {}).length > 0) {
      issues.push({
        file: rel,
        level: "warning",
        message: "log.md should not contain frontmatter",
      });
    }
    return issues;
  }

  // Non-reserved concept file: must have parseable frontmatter with `type`.
  let parsed;
  try {
    parsed = matter(file.content);
  } catch (err) {
    issues.push({
      file: rel,
      level: "error",
      message: `unparseable YAML frontmatter: ${(err as Error).message}`,
    });
    return issues;
  }

  const data = (parsed.data || {}) as Record<string, unknown>;
  const type = data.type;
  if (typeof type !== "string" || type.trim() === "") {
    issues.push({
      file: rel,
      level: "error",
      message: "concept file is missing a non-empty `type` frontmatter field",
    });
  }

  // Provenance fields are optional; malformed values are warnings, not errors.
  if (data.confidence !== undefined) {
    const ok =
      typeof data.confidence === "string" &&
      (OKF_CONFIDENCE_LEVELS as readonly string[]).includes(data.confidence);
    if (!ok) {
      issues.push({
        file: rel,
        level: "warning",
        message: `confidence should be one of: ${OKF_CONFIDENCE_LEVELS.join(", ")}`,
      });
    }
  }
  if (data.last_updated_by !== undefined && typeof data.last_updated_by !== "string") {
    issues.push({ file: rel, level: "warning", message: "last_updated_by should be a string" });
  }
  if (data.linked_sources !== undefined && !Array.isArray(data.linked_sources)) {
    issues.push({ file: rel, level: "warning", message: "linked_sources should be a list" });
  }

  return issues;
}

/**
 * Validate a whole bundle (provided as in-memory files). A bundle is
 * conformant when there are zero errors. Broken links and unknown types are
 * explicitly NOT errors per the spec — consumers must tolerate them.
 */
export function validateOkfBundle(files: OkfBundleFile[]): OkfValidationResult {
  const errors: OkfValidationIssue[] = [];
  const warnings: OkfValidationIssue[] = [];

  for (const file of files) {
    const rel = normalizeRelPath(file.path);
    const isRoot = rel === "index.md";
    for (const issue of validateOkfFileEntry(file, { isRoot })) {
      if (issue.level === "error") errors.push(issue);
      else warnings.push(issue);
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}

// ─── Reserved file builders ────────────────────────────────────────────

export interface OkfIndexEntry {
  /** e.g. "profile/about". */
  conceptId: string;
  title: string;
  description?: string;
}

export interface OkfIndexSection {
  heading: string;
  entries: OkfIndexEntry[];
}

export interface OkfIndexOptions {
  title?: string;
  intro?: string;
  /** When set, declares the OKF version (only valid on a bundle-root index). */
  okfVersion?: string;
}

/**
 * Build a reserved index.md. Per spec it carries no frontmatter, except a
 * bundle-root index may declare `okf_version`. Entries link to concepts using
 * the stable bundle-relative absolute form ("/profile/about.md").
 */
export function buildIndexMd(
  sections: OkfIndexSection[],
  options: OkfIndexOptions = {},
): string {
  const parts: string[] = [];

  if (options.okfVersion) {
    parts.push(`---\nokf_version: "${options.okfVersion}"\n---\n`);
  }

  if (options.title) parts.push(`# ${options.title}\n`);
  if (options.intro) parts.push(`${options.intro.trim()}\n`);

  for (const section of sections) {
    if (section.entries.length === 0) continue;
    parts.push(`## ${section.heading}\n`);
    const lines = section.entries.map((entry) => {
      const href = conceptHref(`${entry.conceptId}.md`);
      const desc = entry.description ? ` - ${entry.description}` : "";
      return `* [${entry.title}](${href})${desc}`;
    });
    parts.push(lines.join("\n") + "\n");
  }

  return parts.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}

export interface OkfLogEntry {
  /** ISO date, YYYY-MM-DD. */
  date: string;
  /** Conventional label: Update | Creation | Deprecation | custom. */
  label?: string;
  /** Markdown prose describing the change. */
  message: string;
}

/**
 * Build a reserved log.md: a flat, date-grouped list, newest first. Date
 * headings use `## YYYY-MM-DD`; entries are bullets with an optional bold
 * label, e.g. `* **Update**: ...`.
 */
export function buildLogMd(
  entries: OkfLogEntry[],
  options: { title?: string } = {},
): string {
  const parts: string[] = [];
  if (options.title) parts.push(`# ${options.title}\n`);

  const byDate = new Map<string, OkfLogEntry[]>();
  for (const entry of entries) {
    const list = byDate.get(entry.date) || [];
    list.push(entry);
    byDate.set(entry.date, list);
  }

  const dates = [...byDate.keys()].sort().reverse();
  for (const date of dates) {
    parts.push(`## ${date}\n`);
    const lines = (byDate.get(date) || []).map((entry) => {
      const label = entry.label ? `**${entry.label}**: ` : "";
      return `* ${label}${entry.message}`;
    });
    parts.push(lines.join("\n") + "\n");
  }

  return parts.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}
