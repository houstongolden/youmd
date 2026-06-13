import * as fs from "fs";
import * as path from "path";
import chalk from "chalk";
import matter from "gray-matter";
import { resolveActiveBundleDir, getSkillsDir } from "../lib/config";
import { compileBundle, writeBundle } from "../lib/compiler";
import {
  exportBundleToOkf,
  importOkfToBundle,
  readOkfBundleDir,
  YoumdSection,
} from "../lib/okf-bundle";
import { exportYouStackToOkf } from "../lib/okf-stack";
import { loadYouStackManifest } from "../lib/youstack";
import { validateOkfBundle, OKF_VERSION } from "../lib/okf";

interface OkfOptions {
  out?: string;
  stack?: string;
  skills?: boolean; // commander sets `skills: false` for --no-skills
  json?: boolean;
}

function titleCase(slug: string): string {
  return slug
    .split(/[-_.]/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Collect installed skills (~/.youmd/skills/<name>/SKILL.md) as sections. */
function collectInstalledSkillSections(): YoumdSection[] {
  const dir = getSkillsDir();
  if (!fs.existsSync(dir)) return [];
  const sections: YoumdSection[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const skillMd = path.join(dir, entry.name, "SKILL.md");
    if (!fs.existsSync(skillMd)) continue;
    const { data, content } = matter(fs.readFileSync(skillMd, "utf-8"));
    sections.push({
      dir: "skills",
      slug: entry.name,
      title:
        (typeof data.title === "string" && data.title.trim()) ||
        (typeof data.name === "string" && data.name.trim()) ||
        titleCase(entry.name),
      body: content.trim(),
      timestamp: typeof data.timestamp === "string" ? data.timestamp : undefined,
    });
  }
  return sections;
}

export async function okfCommand(
  subcommand: string | undefined,
  arg: string | undefined,
  options: OkfOptions,
): Promise<void> {
  const sub = (subcommand || "export").toLowerCase();

  if (sub === "export") return exportSub(arg, options);
  if (sub === "import") return importSub(arg, options);
  if (sub === "validate" || sub === "check") return validateSub(arg, options);

  console.log("");
  console.log(chalk.yellow(`  unknown okf subcommand: ${sub}`));
  console.log("");
  console.log("  " + chalk.dim("usage:"));
  console.log("  " + chalk.cyan("youmd okf export") + chalk.dim("            export your identity bundle as OKF"));
  console.log("  " + chalk.cyan("youmd okf export --stack") + chalk.dim("    export a YouStack as OKF"));
  console.log("  " + chalk.cyan("youmd okf import <dir>") + chalk.dim("      import an OKF bundle into You.md"));
  console.log("  " + chalk.cyan("youmd okf validate <dir>") + chalk.dim("    check an OKF bundle for conformance"));
  console.log("");
}

// ─── export ────────────────────────────────────────────────────────────

async function exportSub(arg: string | undefined, options: OkfOptions): Promise<void> {
  console.log("");

  // Stack export: --stack [path] or positional path when --stack is a flag.
  if (options.stack !== undefined || arg) {
    const stackPath = typeof options.stack === "string" ? options.stack : arg;
    return exportStack(stackPath, options);
  }

  const bundleDir = resolveActiveBundleDir();
  if (!bundleDir) {
    console.log(chalk.yellow("  no active bundle found"));
    console.log("");
    console.log("  run " + chalk.cyan("youmd init") + " to create one.");
    console.log("");
    return;
  }

  // Ensure compiled artifacts exist (you.json/manifest) so timestamps/name resolve.
  const youJsonPath = path.join(bundleDir, "you.json");
  if (!fs.existsSync(youJsonPath)) {
    const result = compileBundle(bundleDir);
    writeBundle(bundleDir, result);
  }

  const outDir = path.resolve(process.cwd(), options.out || "okf");
  const includeSkills = options.skills !== false;
  const extraSections = includeSkills ? collectInstalledSkillSections() : [];

  const result = exportBundleToOkf(bundleDir, outDir, { extraSections });

  if (options.json) {
    console.log(
      JSON.stringify(
        {
          ok: result.validation.ok,
          okfVersion: OKF_VERSION,
          outDir: result.outDir,
          concepts: result.conceptCount,
          files: result.files,
          errors: result.validation.errors,
          warnings: result.validation.warnings,
        },
        null,
        2,
      ),
    );
    return;
  }

  console.log(chalk.green("  exported OKF bundle") + chalk.dim(`  (okf/${OKF_VERSION})`));
  console.log("");
  console.log("  " + chalk.dim(result.outDir));
  console.log("  " + chalk.dim(`${result.conceptCount} concepts, ${result.files.length} files`));
  if (includeSkills && extraSections.length > 0) {
    console.log("  " + chalk.dim(`${extraSections.length} installed skills included`));
  }
  printValidation(result.validation);
  console.log("");
  console.log("  " + chalk.dim("any OKF-aware agent or tool can read this directory natively."));
  console.log("");
}

async function exportStack(stackPath: string | undefined, options: OkfOptions): Promise<void> {
  let loaded;
  try {
    loaded = loadYouStackManifest(stackPath);
  } catch (err) {
    console.log(chalk.yellow(`  ${(err as Error).message}`));
    console.log("");
    return;
  }

  if (!loaded.validation.ok) {
    console.log(chalk.yellow("  stack manifest has validation errors:"));
    for (const e of loaded.validation.errors) console.log("  " + chalk.red(`- ${e}`));
    console.log("");
    console.log("  " + chalk.dim("exporting anyway; fix the manifest for a clean OKF bundle."));
    console.log("");
  }

  const outDir = path.resolve(
    process.cwd(),
    options.out || `okf-${loaded.manifest.slug}`,
  );
  const result = exportYouStackToOkf(loaded.manifest, loaded.rootDir, outDir);

  if (options.json) {
    console.log(
      JSON.stringify(
        {
          ok: result.validation.ok,
          okfVersion: OKF_VERSION,
          stack: loaded.manifest.slug,
          outDir: result.outDir,
          concepts: result.conceptCount,
          files: result.written,
          errors: result.validation.errors,
          warnings: result.validation.warnings,
        },
        null,
        2,
      ),
    );
    return;
  }

  console.log(
    chalk.green(`  exported YouStack as OKF`) +
      chalk.dim(`  ${loaded.manifest.name} (${loaded.manifest.slug})`),
  );
  console.log("");
  console.log("  " + chalk.dim(result.outDir));
  console.log("  " + chalk.dim(`${result.conceptCount} concepts, ${result.written.length} files`));
  console.log("  " + chalk.dim("youstack.json carried alongside — still installable."));
  printValidation(result.validation);
  console.log("");
}

// ─── import ──────────────────────────────────────────────────────────────

async function importSub(arg: string | undefined, options: OkfOptions): Promise<void> {
  console.log("");
  if (!arg) {
    console.log(chalk.yellow("  usage: ") + chalk.cyan("youmd okf import <okf-dir> [--out <bundle-dir>]"));
    console.log("");
    return;
  }

  const okfDir = path.resolve(process.cwd(), arg);
  if (!fs.existsSync(okfDir) || !fs.statSync(okfDir).isDirectory()) {
    console.log(chalk.yellow(`  not a directory: ${okfDir}`));
    console.log("");
    return;
  }

  // Validate before importing so we never write from a malformed bundle.
  const files = readOkfBundleDir(okfDir);
  const validation = validateOkfBundle(
    files.map((f) => ({ path: f.path, content: f.content })),
  );
  if (!validation.ok) {
    console.log(chalk.yellow("  OKF bundle is not conformant:"));
    for (const e of validation.errors) console.log("  " + chalk.red(`- ${e.file}: ${e.message}`));
    console.log("");
    console.log("  " + chalk.dim("fix the bundle or run") + " " + chalk.cyan(`youmd okf validate ${arg}`));
    console.log("");
    return;
  }

  const outDir = path.resolve(process.cwd(), options.out || "imported-okf");
  const result = importOkfToBundle(okfDir, outDir);

  if (options.json) {
    console.log(JSON.stringify({ ok: true, outDir: result.outDir, sections: result.sectionCount, written: result.written }, null, 2));
    return;
  }

  console.log(chalk.green("  imported OKF bundle"));
  console.log("");
  console.log("  " + chalk.dim(result.outDir));
  console.log("  " + chalk.dim(`${result.sectionCount} sections written`));
  console.log("");
  console.log("  " + chalk.dim("next:") + " " + chalk.cyan("youmd build") + chalk.dim(" then ") + chalk.cyan("youmd push") + chalk.dim(" to sync it."));
  console.log("");
}

// ─── validate ────────────────────────────────────────────────────────────

async function validateSub(arg: string | undefined, options: OkfOptions): Promise<void> {
  console.log("");
  const target = path.resolve(process.cwd(), arg || ".");
  if (!fs.existsSync(target) || !fs.statSync(target).isDirectory()) {
    console.log(chalk.yellow(`  not a directory: ${target}`));
    console.log("");
    return;
  }

  const files = readOkfBundleDir(target);
  const validation = validateOkfBundle(files.map((f) => ({ path: f.path, content: f.content })));

  if (options.json) {
    console.log(JSON.stringify({ ok: validation.ok, dir: target, concepts: files.length, errors: validation.errors, warnings: validation.warnings }, null, 2));
    return;
  }

  console.log("  " + chalk.dim(target));
  console.log("  " + chalk.dim(`${files.length} markdown files`));
  printValidation(validation);
  if (validation.ok) {
    console.log("");
    console.log("  " + chalk.green(`conformant OKF bundle (okf/${OKF_VERSION}).`));
  }
  console.log("");
}

// ─── shared ──────────────────────────────────────────────────────────────

function printValidation(validation: { ok: boolean; errors: { file: string; message: string }[]; warnings: { file: string; message: string }[] }): void {
  if (validation.errors.length > 0) {
    console.log("");
    console.log("  " + chalk.red(`${validation.errors.length} error(s):`));
    for (const e of validation.errors) console.log("  " + chalk.red(`- ${e.file}: ${e.message}`));
  }
  if (validation.warnings.length > 0) {
    console.log("  " + chalk.yellow(`${validation.warnings.length} warning(s):`));
    for (const w of validation.warnings) console.log("  " + chalk.dim(`- ${w.file}: ${w.message}`));
  }
  if (validation.ok && validation.warnings.length === 0) {
    console.log("  " + chalk.green("conformant — 0 errors"));
  }
}
