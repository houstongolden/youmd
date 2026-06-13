/**
 * You.md identity bundle  <->  OKF bundle.
 *
 * A You.md bundle on disk is already a directory of markdown files
 * (profile/, preferences/, voice/, directives/, skills/). This module makes
 * that bundle a *conformant* OKF bundle and reads one back, so a person's
 * identity + skills travel between machines and agents as plain OKF — no SDK,
 * no lock-in. It is the portable wire format underneath `youmd sync`.
 *
 * The transform is lossless and round-trippable: each section file keeps its
 * title and body verbatim, gains OKF frontmatter (`type`, `description`,
 * `timestamp`) plus a `youmd_kind` custom field that records the section's
 * home directory so import can route it back exactly.
 *
 * Pure transforms (no fs) live at the top so they can be unit-tested; the
 * filesystem wrappers are at the bottom.
 */

import * as fs from "fs";
import * as path from "path";
import matter from "gray-matter";
import {
  OKF_VERSION,
  OkfBundleFile,
  OkfIndexSection,
  OkfLogEntry,
  buildIndexMd,
  buildLogMd,
  parseOkfFile,
  serializeOkfFile,
  validateOkfBundle,
  OkfValidationResult,
} from "./okf";

/** Section directories that participate in OKF identity export. `private/` is
 *  intentionally excluded — OKF bundles are meant to be shareable. */
export const OKF_SECTION_DIRS = ["profile", "preferences", "voice", "directives", "skills"] as const;

/** dir -> human-friendly OKF `type` + index.md section heading. */
const DIR_META: Record<string, { type: string; heading: string }> = {
  profile: { type: "Identity Profile", heading: "Profile" },
  preferences: { type: "Agent Preference", heading: "Preferences" },
  voice: { type: "Voice Profile", heading: "Voice" },
  directives: { type: "Agent Directive", heading: "Directives" },
  skills: { type: "Skill", heading: "Skills" },
};

/** A You.md section in memory (one markdown file, no frontmatter on `body`). */
export interface YoumdSection {
  /** Home directory, e.g. "profile". */
  dir: string;
  /** Filename slug without extension, e.g. "about". */
  slug: string;
  /** Display title. */
  title: string;
  /** Markdown body, frontmatter stripped. */
  body: string;
  /** ISO timestamp of last change, if known. */
  timestamp?: string;
}

export interface BuildOkfOptions {
  /** Title for the bundle-root index.md (usually the person's name). */
  title?: string;
  /** Short intro line under the index title. */
  intro?: string;
  /** Log entries to write to log.md. */
  log?: OkfLogEntry[];
}

// ─── Pure helpers ──────────────────────────────────────────────────────

function titleCase(slug: string): string {
  return slug
    .split(/[-_.]/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** First descriptive sentence of a body, for the `description` field. */
function deriveDescription(body: string): string | undefined {
  for (const raw of body.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    if (/^[#>*\-+|]/.test(line)) continue;
    if (line.startsWith("**") && line.endsWith("**")) continue;
    const sentence = line.split(/(?<=[.!?])\s/)[0].trim();
    if (!sentence) continue;
    return sentence.length > 160 ? sentence.slice(0, 157).trimEnd() + "..." : sentence;
  }
  return undefined;
}

function dropUndefined<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && !(Array.isArray(v) && v.length === 0)) out[k] = v;
  }
  return out as T;
}

/** Transform one You.md section into one OKF concept file. */
export function sectionToOkfFile(section: YoumdSection): OkfBundleFile {
  const meta = DIR_META[section.dir] || { type: "Note", heading: "Other" };
  const frontmatter = dropUndefined({
    type: meta.type,
    title: section.title,
    description: deriveDescription(section.body),
    timestamp: section.timestamp,
    youmd_kind: `${section.dir}/${section.slug}`,
  });
  const content = serializeOkfFile({ frontmatter, body: section.body });
  return { path: `${section.dir}/${section.slug}.md`, content };
}

/** Transform an OKF concept file back into a You.md section. Returns null for
 *  reserved files (index.md / log.md). */
export function okfFileToSection(file: OkfBundleFile): YoumdSection | null {
  const normalized = file.path.replace(/\\/g, "/");
  const base = normalized.split("/").pop() || "";
  if (base === "index.md" || base === "log.md") return null;

  const { frontmatter, body } = parseOkfFile(file.content);

  let dir: string;
  let slug: string;
  const kind = typeof frontmatter.youmd_kind === "string" ? frontmatter.youmd_kind : "";
  if (kind.includes("/")) {
    const parts = kind.split("/");
    slug = parts.pop() as string;
    dir = parts.join("/");
  } else {
    const parts = normalized.replace(/\.md$/i, "").split("/");
    slug = parts.pop() as string;
    dir = parts.pop() || "profile";
  }

  const title = typeof frontmatter.title === "string" && frontmatter.title.trim()
    ? frontmatter.title.trim()
    : titleCase(slug);

  return {
    dir,
    slug,
    title,
    body,
    timestamp: typeof frontmatter.timestamp === "string" ? frontmatter.timestamp : undefined,
  };
}

/** Build the complete set of OKF files (concepts + reserved index/log) for a
 *  list of sections. Pure — does not touch the filesystem. */
export function buildOkfBundleFiles(
  sections: YoumdSection[],
  options: BuildOkfOptions = {},
): OkfBundleFile[] {
  const conceptFiles = sections.map(sectionToOkfFile);

  // index.md grouped by directory, in the canonical section order.
  const order = [...OKF_SECTION_DIRS] as string[];
  const indexSections: OkfIndexSection[] = [];
  for (const dir of order) {
    const inDir = sections.filter((s) => s.dir === dir);
    if (inDir.length === 0) continue;
    indexSections.push({
      heading: DIR_META[dir]?.heading || titleCase(dir),
      entries: inDir.map((s) => ({
        conceptId: `${s.dir}/${s.slug}`,
        title: s.title,
        description: deriveDescription(s.body),
      })),
    });
  }

  const indexMd = buildIndexMd(indexSections, {
    title: options.title || "You.md Identity Bundle",
    intro:
      options.intro ||
      "Portable identity context in Open Knowledge Format. Every file is a concept an agent can read natively.",
    okfVersion: OKF_VERSION,
  });

  const files: OkfBundleFile[] = [
    { path: "index.md", content: indexMd },
    ...conceptFiles,
  ];

  const logEntries = options.log && options.log.length > 0 ? options.log : undefined;
  if (logEntries) {
    files.push({ path: "log.md", content: buildLogMd(logEntries, { title: "Change Log" }) });
  }

  return files;
}

/** Reconstruct You.md sections from a set of OKF files. */
export function okfBundleFilesToSections(files: OkfBundleFile[]): YoumdSection[] {
  return files
    .map(okfFileToSection)
    .filter((s): s is YoumdSection => s !== null);
}

// ─── Filesystem wrappers ───────────────────────────────────────────────

function readManifestTimestamp(bundleDir: string): string | undefined {
  const manifestPath = path.join(bundleDir, "manifest.json");
  if (!fs.existsSync(manifestPath)) return undefined;
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
    return typeof manifest.generatedAt === "string" ? manifest.generatedAt : undefined;
  } catch {
    return undefined;
  }
}

function readBundleVersion(bundleDir: string): number | undefined {
  const manifestPath = path.join(bundleDir, "manifest.json");
  if (!fs.existsSync(manifestPath)) return undefined;
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
    return typeof manifest.version === "number" ? manifest.version : undefined;
  } catch {
    return undefined;
  }
}

function readBundleName(bundleDir: string): string | undefined {
  const youJsonPath = path.join(bundleDir, "you.json");
  if (!fs.existsSync(youJsonPath)) return undefined;
  try {
    const youJson = JSON.parse(fs.readFileSync(youJsonPath, "utf-8"));
    return youJson?.identity?.name || youJson?.username || undefined;
  } catch {
    return undefined;
  }
}

/** Read every section file from a You.md bundle directory into memory. */
export function collectBundleSections(bundleDir: string): YoumdSection[] {
  const sections: YoumdSection[] = [];
  const fallbackTs = readManifestTimestamp(bundleDir);

  for (const dir of OKF_SECTION_DIRS) {
    const abs = path.join(bundleDir, dir);
    if (!fs.existsSync(abs)) continue;
    const files = fs.readdirSync(abs).filter((f) => f.endsWith(".md")).sort();
    for (const file of files) {
      const raw = fs.readFileSync(path.join(abs, file), "utf-8");
      const { data, content } = matter(raw);
      const slug = path.basename(file, ".md");
      const title =
        typeof data.title === "string" && data.title.trim() ? data.title.trim() : titleCase(slug);
      sections.push({
        dir,
        slug,
        title,
        body: content.trim(),
        timestamp: typeof data.timestamp === "string" ? data.timestamp : fallbackTs,
      });
    }
  }

  return sections;
}

export interface ExportBundleToOkfResult {
  outDir: string;
  files: string[];
  conceptCount: number;
  validation: OkfValidationResult;
}

/**
 * Export a You.md bundle directory as a conformant OKF bundle on disk.
 * Carries the existing you.json + manifest.sha256.json alongside (OKF
 * tolerates extra files) as integrity value-adds the spec does not require.
 */
export function exportBundleToOkf(
  bundleDir: string,
  outDir: string,
  options: { extraSections?: YoumdSection[] } = {},
): ExportBundleToOkfResult {
  const sections = [...collectBundleSections(bundleDir), ...(options.extraSections || [])];

  const name = readBundleName(bundleDir);
  const version = readBundleVersion(bundleDir);
  const ts = readManifestTimestamp(bundleDir) || new Date().toISOString();
  const date = ts.split("T")[0];

  const log: OkfLogEntry[] = [
    {
      date,
      label: "Export",
      message: `Generated OKF bundle${version ? ` (bundle v${version})` : ""} from You.md — ${sections.length} concepts.`,
    },
  ];

  const okfFiles = buildOkfBundleFiles(sections, {
    title: name ? `${name} — You.md` : undefined,
    log,
  });

  fs.mkdirSync(outDir, { recursive: true });
  const written: string[] = [];

  for (const file of okfFiles) {
    const dest = path.join(outDir, file.path);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, file.content);
    written.push(file.path);
  }

  // Carry integrity/structured siblings if present (non-OKF but tolerated).
  for (const sibling of ["you.json", "manifest.sha256.json"]) {
    const src = path.join(bundleDir, sibling);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(outDir, sibling));
      written.push(sibling);
    }
  }

  const validation = validateOkfBundle(okfFiles);

  return {
    outDir,
    files: written,
    conceptCount: okfFiles.filter((f) => {
      const base = f.path.split("/").pop() || "";
      return base !== "index.md" && base !== "log.md";
    }).length,
    validation,
  };
}

/** Read an OKF bundle directory into in-memory files (markdown only). */
export function readOkfBundleDir(okfDir: string): OkfBundleFile[] {
  const files: OkfBundleFile[] = [];
  const walk = (dir: string, prefix: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(abs, rel);
      } else if (entry.name.endsWith(".md")) {
        files.push({ path: rel, content: fs.readFileSync(abs, "utf-8") });
      }
    }
  };
  walk(okfDir, "");
  return files;
}

export interface ImportOkfToBundleResult {
  outDir: string;
  written: string[];
  sectionCount: number;
}

/**
 * Import an OKF bundle directory into a You.md bundle directory, writing each
 * concept back to its section file in the standard You.md frontmatter style
 * (so a subsequent `compileBundle` consumes it unchanged).
 */
export function importOkfToBundle(okfDir: string, outDir: string): ImportOkfToBundleResult {
  const files = readOkfBundleDir(okfDir);
  const sections = okfBundleFilesToSections(files);

  const written: string[] = [];
  for (const section of sections) {
    const destDir = path.join(outDir, section.dir);
    fs.mkdirSync(destDir, { recursive: true });
    const dest = path.join(destDir, `${section.slug}.md`);
    const frontmatter = `---\ntitle: "${section.title.replace(/"/g, '\\"')}"\n---\n\n`;
    fs.writeFileSync(dest, frontmatter + section.body.trim() + "\n");
    written.push(`${section.dir}/${section.slug}.md`);
  }

  return { outDir, written, sectionCount: sections.length };
}
