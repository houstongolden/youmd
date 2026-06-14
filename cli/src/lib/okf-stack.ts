/**
 * YouStack  ->  OKF bundle.
 *
 * A YouStack is a manifest (youstack.json) plus typed markdown files — skills,
 * workflows, docs, tests, prompts. This module renders a stack as a conformant
 * OKF bundle so a published "Gstack-style" stack is readable by any OKF
 * consumer (an LLM, Obsidian, MkDocs, a static server) with no You.md SDK. The
 * canonical youstack.json is carried alongside so the stack stays installable.
 *
 * Export-focused: the OKF rendering is the shareable/consumable view; the
 * youstack.json remains the source of truth for installation and routing.
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
  serializeOkfFile,
  validateOkfBundle,
  OkfValidationResult,
} from "./okf";
import { YouStackManifest, getYouStackCapabilities } from "./youstack";

/** Declared file `type` -> human-friendly OKF `type` + index heading. */
const FILE_TYPE_META: Record<string, { type: string; heading: string }> = {
  skill: { type: "Skill", heading: "Skills" },
  workflow: { type: "Workflow", heading: "Workflows" },
  docs: { type: "Documentation", heading: "Docs" },
  doc: { type: "Documentation", heading: "Docs" },
  prompt: { type: "Prompt", heading: "Prompts" },
  test: { type: "Test", heading: "Tests" },
  example: { type: "Example", heading: "Examples" },
};

/** Directory name -> declared file type, for files not listed in manifest.files. */
const DIR_TYPE_HINT: Record<string, string> = {
  skills: "skill",
  workflows: "workflow",
  docs: "docs",
  prompts: "prompt",
  tests: "test",
  examples: "example",
};

export interface StackSourceFile {
  /** Bundle-relative path, e.g. "skills/youstack-start/SKILL.md". */
  path: string;
  /** Declared file type from the manifest, if known. */
  declaredType?: string;
  content: string;
}

function titleCase(slug: string): string {
  return slug
    .split(/[-_.]/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function deriveDescription(body: string): string | undefined {
  for (const raw of body.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    if (/^[#>*\-+|]/.test(line)) continue;
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

function typeMetaFor(file: StackSourceFile): { type: string; heading: string } {
  if (file.declaredType && FILE_TYPE_META[file.declaredType]) {
    return FILE_TYPE_META[file.declaredType];
  }
  const topDir = file.path.replace(/\\/g, "/").split("/")[0];
  const hinted = DIR_TYPE_HINT[topDir];
  if (hinted && FILE_TYPE_META[hinted]) return FILE_TYPE_META[hinted];
  return { type: "Stack File", heading: "Other" };
}

/** Read provenance fields from a parsed frontmatter block, applying defaults. */
function readProvenance(
  data: Record<string, unknown>,
  defaults: { author?: string; confidence?: string },
): { last_updated_by?: string; confidence?: string; linked_sources?: string[] } {
  const lastUpdatedBy =
    (typeof data.last_updated_by === "string" && data.last_updated_by) || defaults.author;
  const confidence =
    (typeof data.confidence === "string" && data.confidence) || defaults.confidence;
  const linkedSources = Array.isArray(data.linked_sources)
    ? (data.linked_sources as unknown[]).filter((s): s is string => typeof s === "string")
    : undefined;
  return {
    last_updated_by: lastUpdatedBy || undefined,
    confidence: confidence || undefined,
    linked_sources: linkedSources && linkedSources.length > 0 ? linkedSources : undefined,
  };
}

/** Build the manifest summary concept (type: YouStack). */
function buildStackManifestConcept(
  manifest: YouStackManifest,
  timestamp: string,
  defaults: { author?: string; confidence?: string } = {},
): OkfBundleFile {
  const capabilities = getYouStackCapabilities(manifest);
  const lines: string[] = [];

  lines.push(`# ${manifest.name}`);
  lines.push("");
  if (manifest.description) {
    lines.push(manifest.description);
    lines.push("");
  }
  lines.push("## Identity");
  lines.push("");
  lines.push(`- Slug: ${manifest.slug}`);
  lines.push(`- Version: ${manifest.version}`);
  lines.push(`- Visibility: ${manifest.visibility}`);
  if (manifest.domain) lines.push(`- Domain: ${manifest.domain}`);
  if (manifest.tags?.length) lines.push(`- Tags: ${manifest.tags.join(", ")}`);
  lines.push("");
  lines.push("## Capabilities");
  lines.push("");
  for (const capability of capabilities) {
    const mode = capability.localOnly ? "local" : "protected";
    lines.push(`- ${capability.id} (${mode}): ${capability.intent || "No intent declared."}`);
  }
  if (manifest.improvement) {
    lines.push("");
    lines.push("## Self-Improvement");
    lines.push("");
    lines.push(`- Mode: ${manifest.improvement.mode || "observe"}`);
    if (manifest.improvement.cadence) lines.push(`- Cadence: ${manifest.improvement.cadence}`);
  }

  const frontmatter = dropUndefined({
    type: "YouStack",
    title: manifest.name,
    description: manifest.description,
    tags: manifest.tags && manifest.tags.length > 0 ? manifest.tags : undefined,
    timestamp,
    last_updated_by: defaults.author,
    confidence: defaults.confidence,
    youmd_kind: "youstack",
    stack_slug: manifest.slug,
    stack_version: manifest.version,
    stack_visibility: manifest.visibility,
  });

  return {
    path: "youstack.md",
    content: serializeOkfFile({ frontmatter, body: lines.join("\n") }),
  };
}

export interface BuildStackOkfResult {
  files: OkfBundleFile[];
  conceptCount: number;
  validation: OkfValidationResult;
}

/** Pure: build the full OKF file set for a stack manifest + its source files. */
export function buildStackOkfFiles(
  manifest: YouStackManifest,
  sourceFiles: StackSourceFile[],
  options: { timestamp?: string; defaultAuthor?: string; defaultConfidence?: string } = {},
): BuildStackOkfResult {
  const timestamp = options.timestamp || new Date().toISOString();
  const date = timestamp.split("T")[0];
  const provDefaults = { author: options.defaultAuthor, confidence: options.defaultConfidence };

  const manifestConcept = buildStackManifestConcept(manifest, timestamp, provDefaults);

  const conceptFiles: OkfBundleFile[] = sourceFiles.map((file) => {
    const meta = typeMetaFor(file);
    const { data, content } = matter(file.content);
    const slug = path.basename(file.path, path.extname(file.path));
    const title =
      (typeof data.title === "string" && data.title.trim()) ||
      (typeof data.name === "string" && data.name.trim()) ||
      titleCase(slug);
    const description =
      (typeof data.description === "string" && data.description.trim()) ||
      deriveDescription(content);
    const provenance = readProvenance(data, provDefaults);

    const frontmatter = dropUndefined({
      type: meta.type,
      title,
      description,
      timestamp,
      last_updated_by: provenance.last_updated_by,
      confidence: provenance.confidence,
      linked_sources: provenance.linked_sources,
      // Every stack file belongs to the stack — link it to the manifest concept.
      related: ["youstack"],
      youmd_kind: file.path.replace(/\\/g, "/").replace(/\.md$/i, ""),
      stack_slug: manifest.slug,
    });

    return {
      path: file.path.replace(/\\/g, "/"),
      content: serializeOkfFile({ frontmatter, body: content.trim() }),
    };
  });

  // index.md grouped by heading.
  const headingOrder = ["Skills", "Workflows", "Prompts", "Docs", "Tests", "Examples", "Other"];
  const grouped = new Map<string, OkfIndexSection>();
  // Manifest summary goes in an "Overview" section first.
  grouped.set("Overview", {
    heading: "Overview",
    entries: [{ conceptId: "youstack", title: manifest.name, description: manifest.description }],
  });
  for (const file of sourceFiles) {
    const meta = typeMetaFor(file);
    const { data, content } = matter(file.content);
    const slug = path.basename(file.path, path.extname(file.path));
    const title =
      (typeof data.title === "string" && data.title.trim()) ||
      (typeof data.name === "string" && data.name.trim()) ||
      titleCase(slug);
    const section = grouped.get(meta.heading) || { heading: meta.heading, entries: [] };
    section.entries.push({
      conceptId: file.path.replace(/\\/g, "/").replace(/\.md$/i, ""),
      title,
      description:
        (typeof data.description === "string" && data.description.trim()) ||
        deriveDescription(content),
    });
    grouped.set(meta.heading, section);
  }

  const indexSections: OkfIndexSection[] = [
    grouped.get("Overview")!,
    ...headingOrder
      .filter((h) => grouped.has(h))
      .map((h) => grouped.get(h)!),
  ];

  const indexMd = buildIndexMd(indexSections, {
    title: `${manifest.name} — YouStack`,
    intro:
      manifest.description ||
      "A portable YouStack in Open Knowledge Format. Skills, workflows, and docs an agent can read natively.",
    okfVersion: OKF_VERSION,
  });

  const log: OkfLogEntry[] = [
    {
      date,
      label: "Export",
      message: `Generated OKF bundle for ${manifest.name} v${manifest.version} — ${conceptFiles.length + 1} concepts.`,
    },
  ];

  const files: OkfBundleFile[] = [
    { path: "index.md", content: indexMd },
    manifestConcept,
    ...conceptFiles,
    { path: "log.md", content: buildLogMd(log, { title: "Change Log" }) },
  ];

  return {
    files,
    conceptCount: conceptFiles.length + 1,
    validation: validateOkfBundle(files),
  };
}

// ─── Filesystem wrapper ────────────────────────────────────────────────

/** Collect all markdown source files from a stack root, tagging declared
 *  types from manifest.files where available. */
export function collectStackSourceFiles(
  rootDir: string,
  manifest: YouStackManifest,
): StackSourceFile[] {
  const declaredType = new Map<string, string>();
  for (const file of manifest.files || []) {
    declaredType.set(file.path.replace(/\\/g, "/"), file.type);
  }

  const collected: StackSourceFile[] = [];
  const walk = (dir: string, prefix: string) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs
      .readdirSync(dir, { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name))) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(abs, rel);
      } else if (entry.name.endsWith(".md")) {
        collected.push({
          path: rel,
          declaredType: declaredType.get(rel),
          content: fs.readFileSync(abs, "utf-8"),
        });
      }
    }
  };
  walk(rootDir, "");
  return collected;
}

export interface ExportStackToOkfResult {
  outDir: string;
  written: string[];
  conceptCount: number;
  validation: OkfValidationResult;
}

/** Export a loaded stack (manifest + rootDir) as a conformant OKF bundle. */
export function exportYouStackToOkf(
  manifest: YouStackManifest,
  rootDir: string,
  outDir: string,
  options: { defaultAuthor?: string; defaultConfidence?: string } = {},
): ExportStackToOkfResult {
  const sourceFiles = collectStackSourceFiles(rootDir, manifest);
  const built = buildStackOkfFiles(manifest, sourceFiles, {
    defaultAuthor: options.defaultAuthor,
    defaultConfidence: options.defaultConfidence,
  });

  fs.mkdirSync(outDir, { recursive: true });
  const written: string[] = [];
  for (const file of built.files) {
    const dest = path.join(outDir, file.path);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, file.content);
    written.push(file.path);
  }

  // Carry the canonical manifest so the OKF bundle stays installable.
  const manifestSrc = path.join(rootDir, "youstack.json");
  if (fs.existsSync(manifestSrc)) {
    fs.copyFileSync(manifestSrc, path.join(outDir, "youstack.json"));
    written.push("youstack.json");
  }

  return {
    outDir,
    written,
    conceptCount: built.conceptCount,
    validation: built.validation,
  };
}
