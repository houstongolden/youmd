/**
 * Per-section 3-way merge for identity bundles (you-md/v1).
 *
 * Pure functions — no fs, no network — so the merge logic is unit-testable
 * in isolation. The caller (sync) is responsible for loading base.json,
 * compiling the local bundle, fetching the remote bundle, and writing the
 * merged result to disk (atomically: all-or-nothing).
 *
 * A "section" is a top-level key of the nested you.json format (identity,
 * now, projects, values, links, preferences, voice, agent_directives,
 * custom_sections, ...). For each section we compare base vs local vs remote:
 *
 *   - neither changed            → keep as-is
 *   - only local changed         → keep local
 *   - only remote changed        → take remote
 *   - both changed identically   → keep (no conflict)
 *   - both changed differently   → CONFLICT (section listed, merge not clean)
 */

// Scaffolding/volatile keys are never merged per-section — they are stamped
// by the compiler on every compile (generated_at, meta.last_updated) or are
// structural (schema, username). The merged bundle takes them from remote,
// falling back to local, falling back to base.
const SCAFFOLD_KEYS = new Set(["schema", "username", "generated_at", "meta"]);

// Canonical section ordering so merged you.json reads like compiler output.
const KNOWN_SECTION_ORDER = [
  "identity",
  "now",
  "projects",
  "values",
  "links",
  "preferences",
  "voice",
  "analysis",
  "social_images",
  "agent_directives",
  "agent_guide",
  "custom_sections",
  "verification",
];

export type SectionDecision =
  | "unchanged"      // neither side changed
  | "keep-local"     // only local changed
  | "take-remote"    // only remote changed
  | "both-equal"     // both changed to the same content
  | "conflict";      // both changed differently

export interface SectionResult {
  section: string;
  decision: SectionDecision;
}

export interface MergeResult {
  /** The merged bundle. Only meaningful when `clean` is true. */
  merged: Record<string, unknown>;
  /** Sections where local and remote both changed, differently. */
  conflicts: string[];
  /** Per-section decision detail (scaffold keys excluded). */
  sections: SectionResult[];
  /** True when every section merged without conflict. */
  clean: boolean;
}

/**
 * Deterministic stringification for equality comparison only (object keys
 * sorted recursively). Does NOT need to match the server's canonical hash
 * format — it is never hashed or persisted.
 */
function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    return "[" + value.map(stableStringify).join(",") + "]";
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    return "{" + keys.map((k) => JSON.stringify(k) + ":" + stableStringify(obj[k])).join(",") + "}";
  }
  return String(value);
}

/**
 * Normalize a section value for change detection, stripping fields the
 * compiler re-stamps on every compile (so a recompile alone never reads as
 * an edit). Currently: `now.updated_at`.
 */
export function normalizeSection(section: string, value: unknown): string {
  let v = value;
  if (section === "now" && v && typeof v === "object" && !Array.isArray(v)) {
    const cleaned = { ...(v as Record<string, unknown>) };
    delete cleaned.updated_at;
    v = cleaned;
  }
  return stableStringify(v);
}

function orderSectionKeys(keys: Set<string>): string[] {
  const ordered: string[] = [];
  for (const k of KNOWN_SECTION_ORDER) {
    if (keys.has(k)) ordered.push(k);
  }
  const rest = [...keys].filter((k) => !KNOWN_SECTION_ORDER.includes(k)).sort();
  return [...ordered, ...rest];
}

/**
 * Per-section 3-way merge of base (common ancestor) vs local vs remote.
 *
 * Returns the merged bundle plus the list of conflicting sections. Callers
 * MUST treat the merge as atomic: if `conflicts` is non-empty (`clean` is
 * false), write nothing and surface the conflicts to the user.
 */
export function mergeSections(
  base: Record<string, unknown> | null | undefined,
  local: Record<string, unknown> | null | undefined,
  remote: Record<string, unknown> | null | undefined,
): MergeResult {
  const b = base || {};
  const l = local || {};
  const r = remote || {};

  const allKeys = new Set([...Object.keys(b), ...Object.keys(l), ...Object.keys(r)]);
  const merged: Record<string, unknown> = {};
  const conflicts: string[] = [];
  const sections: SectionResult[] = [];

  // Scaffold keys first (schema/username/generated_at/meta), in known order.
  for (const key of ["schema", "username", "generated_at"]) {
    if (!allKeys.has(key)) continue;
    merged[key] = key in r ? r[key] : key in l ? l[key] : b[key];
  }

  for (const key of orderSectionKeys(allKeys)) {
    if (SCAFFOLD_KEYS.has(key)) continue;

    const baseN = normalizeSection(key, key in b ? b[key] : undefined);
    const localN = normalizeSection(key, key in l ? l[key] : undefined);
    const remoteN = normalizeSection(key, key in r ? r[key] : undefined);

    const localChanged = localN !== baseN;
    const remoteChanged = remoteN !== baseN;

    let decision: SectionDecision;
    let value: unknown;

    if (!localChanged && !remoteChanged) {
      decision = "unchanged";
      value = key in l ? l[key] : key in r ? r[key] : b[key];
    } else if (localChanged && !remoteChanged) {
      decision = "keep-local";
      value = l[key];
    } else if (!localChanged && remoteChanged) {
      decision = "take-remote";
      value = r[key];
    } else if (localN === remoteN) {
      decision = "both-equal";
      value = l[key];
    } else {
      decision = "conflict";
      conflicts.push(key);
      value = l[key]; // placeholder — merged must not be written when dirty
    }

    sections.push({ section: key, decision });
    if (value !== undefined) merged[key] = value;
  }

  // meta last — taken from remote (compiler re-stamps it on next compile).
  if (allKeys.has("meta")) {
    merged.meta = "meta" in r ? r.meta : "meta" in l ? l.meta : b.meta;
  }

  return { merged, conflicts, sections, clean: conflicts.length === 0 };
}

/** Human-readable label for a section decision (terminal output). */
export function decisionLabel(decision: SectionDecision): string {
  switch (decision) {
    case "unchanged":
      return "unchanged";
    case "keep-local":
      return "kept local";
    case "take-remote":
      return "took remote";
    case "both-equal":
      return "both sides match";
    case "conflict":
      return "conflict";
  }
}
