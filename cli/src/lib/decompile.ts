/**
 * Decompile a you.json bundle into individual markdown files on disk.
 * Handles both the nested server format (identity.name, projects[], etc.)
 * and the legacy array format ({profile: [{slug, content}]}).
 *
 * This is the CLI counterpart of src/lib/decompile.ts (web).
 */

import * as fs from "fs";
import * as path from "path";
import { createHash } from "node:crypto";
import { canonicalJsonString } from "./canonical-json";

// ─── Format detection ────────────────────────────────────────────────

export type BundleFormat = "nested" | "array" | "unknown";

/**
 * Detect whether a youJson object uses the nested server format
 * (identity.name, projects[], etc.) or the legacy CLI array format
 * ({profile: [{slug, content}]}).
 */
export function detectFormat(youJson: Record<string, unknown>): BundleFormat {
  if (youJson.identity || youJson.projects || youJson.values || youJson.voice) {
    return "nested";
  }
  if (Array.isArray(youJson.profile) && youJson.profile.length > 0) {
    const first = youJson.profile[0] as Record<string, unknown>;
    if (first && typeof first.slug === "string" && typeof first.content === "string") {
      return "array";
    }
  }
  return "unknown";
}

// ─── Standard directories ────────────────────────────────────────────

const STANDARD_DIRS = ["profile", "preferences", "voice", "directives", "private"];

function ensureStandardDirs(bundleDir: string): void {
  for (const dir of STANDARD_DIRS) {
    fs.mkdirSync(path.join(bundleDir, dir), { recursive: true });
  }
}

// ─── Nested format → files ───────────────────────────────────────────

function decompileNested(bundleDir: string, youJson: Record<string, unknown>): number {
  let filesWritten = 0;

  const profileDir = path.join(bundleDir, "profile");
  const prefsDir = path.join(bundleDir, "preferences");
  const voiceDir = path.join(bundleDir, "voice");
  const directivesDir = path.join(bundleDir, "directives");

  const identity = (youJson.identity as Record<string, unknown>) || {};
  const bio = (identity.bio as Record<string, string>) || {};
  const now = (youJson.now as Record<string, unknown>) || {};
  const projects = (youJson.projects as Array<Record<string, string>>) || [];
  const values = (youJson.values as string[]) || [];
  const links = (youJson.links as Record<string, string>) || {};
  const prefs = (youJson.preferences as Record<string, Record<string, unknown>>) || {};
  const voice = (youJson.voice as Record<string, unknown>) || {};
  const analysis = (youJson.analysis as Record<string, unknown>) || {};
  const agentDirectives = (youJson.agent_directives as Record<string, unknown>) || {};
  const customSections = (youJson.custom_sections as Array<Record<string, string>>) || [];

  // profile/about.md
  {
    const lines: string[] = ['---', 'title: "About"', '---', ''];
    const nameStr = (identity.name as string) || "";
    // Only emit the # heading if we have a non-empty name — an empty `# ` would
    // round-trip as `"#"` in bio.long because the compiler's parseAboutMd only
    // matches `# <something>` (with a space and content after it).
    if (nameStr) {
      lines.push(`# ${nameStr}`);
    }
    if (identity.tagline) lines.push(`\n${identity.tagline}`);
    if (identity.location) lines.push(`\n*${identity.location}*`);
    const bioText = bio.long || bio.medium || bio.short || "";
    if (bioText) lines.push(`\n${bioText}`);
    lines.push("");
    fs.writeFileSync(path.join(profileDir, "about.md"), lines.join("\n"));
    filesWritten++;
  }

  // profile/now.md
  {
    const focus = (now.focus as string[]) || [];
    if (focus.length > 0) {
      const lines: string[] = ['---', 'title: "Now"', '---', ''];
      lines.push(...focus.map((f) => `- ${f}`));
      lines.push("");
      fs.writeFileSync(path.join(profileDir, "now.md"), lines.join("\n"));
      filesWritten++;
    }
  }

  // profile/projects.md
  {
    const lines: string[] = ['---', 'title: "Projects"', '---', ''];
    if (projects.length > 0) {
      for (const p of projects) {
        lines.push(`## ${p.name}`);
        if (p.role) lines.push(`**Role:** ${p.role}`);
        if (p.status) lines.push(`**Status:** ${p.status}`);
        if (p.url) lines.push(`**URL:** ${p.url}`);
        if (p.description) lines.push(`\n${p.description}`);
        lines.push("");
      }
      fs.writeFileSync(path.join(profileDir, "projects.md"), lines.join("\n"));
      filesWritten++;
    }
  }

  // profile/values.md
  {
    const lines: string[] = ['---', 'title: "Values"', '---', ''];
    if (values.length > 0) {
      lines.push(...values.map((v) => `- ${v}`));
      lines.push("");
      fs.writeFileSync(path.join(profileDir, "values.md"), lines.join("\n"));
      filesWritten++;
    }
  }

  // profile/links.md
  {
    const linkEntries = Object.entries(links).filter(([, url]) => url);
    const lines: string[] = ['---', 'title: "Links"', '---', ''];
    if (linkEntries.length > 0) {
      for (const [platform, url] of linkEntries) {
        lines.push(`- **${platform}**: ${url}`);
      }
      lines.push("");
      fs.writeFileSync(path.join(profileDir, "links.md"), lines.join("\n"));
      filesWritten++;
    }
  }

  // Custom sections → profile/{id}.md
  for (const section of customSections) {
    if (section.id && section.content) {
      const slug = section.id.toLowerCase().replace(/[^a-z0-9-]/g, "-");
      const lines: string[] = [
        '---',
        `title: "${section.title || section.id}"`,
        '---',
        '',
        `# ${section.title || section.id}`,
        '',
        section.content,
        '',
      ];
      fs.writeFileSync(path.join(profileDir, `${slug}.md`), lines.join("\n"));
      filesWritten++;
    }
  }

  // preferences/agent.md
  {
    const agent = prefs.agent || {};
    const lines: string[] = ['---', 'title: "Agent Preferences"', '---', ''];
    const rawMarkdown = typeof agent.markdown === "string" ? agent.markdown.trim() : "";
    if (rawMarkdown) {
      lines.push(rawMarkdown);
    } else {
      const tone = (agent.tone as string) || "";
      const formality = (agent.formality as string) || "";
      const avoid = (agent.avoid as string[]) || [];
      if (tone) lines.push(`**Tone:** ${tone}`);
      if (formality) lines.push(`**Formality:** ${formality}`);
      if (avoid.length > 0) lines.push(`**Avoid:** ${avoid.join(", ")}`);
    }
    if (lines.length > 4) {
      lines.push("");
      fs.writeFileSync(path.join(prefsDir, "agent.md"), lines.join("\n"));
      filesWritten++;
    }
  }

  // preferences/writing.md
  {
    const writing = prefs.writing || {};
    const lines: string[] = ['---', 'title: "Writing Preferences"', '---', ''];
    const rawMarkdown = typeof writing.markdown === "string" ? writing.markdown.trim() : "";
    if (rawMarkdown) {
      lines.push(rawMarkdown);
    } else {
      const style = (writing.style as string) || "";
      const format = (writing.format as string) || "";
      if (style) lines.push(`**Style:** ${style}`);
      if (format && !(format === "markdown preferred" && !style)) {
        lines.push(`**Format:** ${format}`);
      }
    }
    if (lines.length > 4) {
      lines.push("");
      fs.writeFileSync(path.join(prefsDir, "writing.md"), lines.join("\n"));
      filesWritten++;
    }
  }

  // voice/voice.md — only write if there is actual content
  {
    const rawMarkdown = typeof voice.markdown === "string" ? voice.markdown.trim() : "";
    const overall = (voice.overall as string) || (analysis.voice_summary as string) || "";
    const voiceContent = rawMarkdown || overall;
    if (voiceContent) {
      const lines: string[] = ['---', 'title: "Voice Profile"', '---', ''];
      lines.push(voiceContent);
      lines.push("");
      fs.writeFileSync(path.join(voiceDir, "voice.md"), lines.join("\n"));
      filesWritten++;
    }
  }

  // voice/voice.{platform}.md
  const platforms = (voice.platforms as Record<string, string>) || {};
  for (const [platform, content] of Object.entries(platforms)) {
    if (content) {
      const lines: string[] = [
        '---',
        `title: "${platform.charAt(0).toUpperCase() + platform.slice(1)} Voice"`,
        `platform: ${platform}`,
        '---',
        '',
        content,
        '',
      ];
      fs.writeFileSync(path.join(voiceDir, `voice.${platform}.md`), lines.join("\n"));
      filesWritten++;
    }
  }

  // directives/agent.md
  {
    const lines: string[] = ['---', 'title: "Agent Directives"', '---', ''];
    const rawMarkdown = typeof agentDirectives.markdown === "string" ? agentDirectives.markdown.trim() : "";
    if (rawMarkdown) {
      lines.push(rawMarkdown);
    } else {
      if (agentDirectives.communication_style) {
        lines.push(`**Communication Style:** ${agentDirectives.communication_style}`);
      }
      const negPrompts = (agentDirectives.negative_prompts as string[]) || [];
      if (negPrompts.length > 0) lines.push(`**Never:** ${negPrompts.join(". ")}`);
      if (agentDirectives.default_stack) {
        lines.push(`**Default Stack:** ${agentDirectives.default_stack}`);
      }
      if (agentDirectives.decision_framework) {
        lines.push(`**Decision Framework:** ${agentDirectives.decision_framework}`);
      }
      if (agentDirectives.current_goal) {
        lines.push(`**Current Goal:** ${agentDirectives.current_goal}`);
      }
    }
    if (lines.length > 4) {
      lines.push("");
      fs.writeFileSync(path.join(directivesDir, "agent.md"), lines.join("\n"));
      filesWritten++;
    }
  }

  return filesWritten;
}

// ─── Array format → files ────────────────────────────────────────────

function decompileArray(bundleDir: string, youJson: Record<string, unknown>): number {
  let filesWritten = 0;

  const profileSections = (youJson.profile as Array<{ slug: string; title?: string; content: string }>) || [];
  const prefSections = (youJson.preferences as Array<{ slug: string; title?: string; content: string }>) || [];

  const profileDir = path.join(bundleDir, "profile");
  const prefsDir = path.join(bundleDir, "preferences");

  for (const section of profileSections) {
    const filename = `${section.slug}.md`;
    const frontmatter = `---\ntitle: "${section.title || section.slug}"\n---\n\n`;
    fs.writeFileSync(path.join(profileDir, filename), frontmatter + section.content + "\n");
    filesWritten++;
  }

  for (const section of prefSections) {
    const filename = `${section.slug}.md`;
    const frontmatter = `---\ntitle: "${section.title || section.slug}"\n---\n\n`;
    fs.writeFileSync(path.join(prefsDir, filename), frontmatter + section.content + "\n");
    filesWritten++;
  }

  return filesWritten;
}

// ─── Manifest verification ───────────────────────────────────────────

interface Sha256Manifest {
  schema_version: number;
  sections: Record<string, string>;
  full_sha: string;
}

/**
 * Load manifest.sha256.json from a bundle directory if present.
 * Returns null when the file is absent or unparseable.
 */
function loadSha256Manifest(bundleDir: string): Sha256Manifest | null {
  const manifestPath = path.join(bundleDir, "manifest.sha256.json");
  if (!fs.existsSync(manifestPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(manifestPath, "utf-8")) as Sha256Manifest;
  } catch {
    return null;
  }
}

/**
 * Verify a single section hash from the manifest against the decompiled youJson.
 * Returns a warning string if the hash mismatches, or null if it matches / cannot verify.
 * Warnings are non-fatal — callers should print them dimly.
 */
function verifySectionHash(
  sectionKey: string,
  expectedHash: string,
  youJson: Record<string, unknown>,
): string | null {
  const [dir, slug] = sectionKey.split("/");
  let value: unknown;

  // Mirror extractSectionValue logic from compiler.ts
  const identity = (youJson.identity as Record<string, unknown>) || {};
  const now = (youJson.now as Record<string, unknown>) || {};
  const prefs = (youJson.preferences as Record<string, Record<string, unknown>>) || {};
  const voice = (youJson.voice as Record<string, unknown>) || {};
  const directives = (youJson.agent_directives as Record<string, unknown>) || {};

  if (dir === "profile") {
    if (slug === "about") value = identity;
    else if (slug === "now") value = now.focus;
    else if (slug === "projects") value = youJson.projects;
    else if (slug === "values") value = youJson.values;
    else if (slug === "links") value = youJson.links;
    else {
      const customs = (youJson.custom_sections as Array<Record<string, unknown>>) || [];
      value = customs.find((s) => s.id === slug) ?? slug;
    }
  } else if (dir === "preferences") {
    if (slug === "agent") value = prefs.agent;
    else if (slug === "writing") value = prefs.writing;
    else value = slug;
  } else if (dir === "voice") {
    if (slug === "voice") value = { overall: voice.overall, markdown: voice.markdown };
    else {
      const platforms = (voice.platforms as Record<string, unknown>) || {};
      const platform = slug.startsWith("voice.") ? slug.slice("voice.".length) : slug;
      value = platforms[platform] ?? slug;
    }
  } else if (dir === "directives") {
    if (slug === "agent") value = directives;
    else value = slug;
  } else {
    return null;
  }

  const actualHash = createHash("sha256")
    .update(canonicalJsonString(value), "utf-8")
    .digest("hex");

  if (actualHash !== expectedHash) {
    return `manifest.sha256.json: section "${sectionKey}" hash mismatch (expected ${expectedHash.slice(0, 12)}… got ${actualHash.slice(0, 12)}…)`;
  }
  return null;
}

// ─── Public API ──────────────────────────────────────────────────────

/**
 * Decompile a youJson bundle to the filesystem.
 * Creates all standard directories and writes markdown files.
 * Returns the number of files written.
 *
 * If manifest.sha256.json is present in bundleDir, verifies each section hash
 * and emits a dim warning (to stderr) for any mismatch — non-fatal.
 */
export function decompileToFilesystem(
  bundleDir: string,
  youJson: Record<string, unknown>,
  options?: { warnOnHashMismatch?: (msg: string) => void },
): number {
  ensureStandardDirs(bundleDir);

  const format = detectFormat(youJson);
  let filesWritten = 0;

  switch (format) {
    case "nested":
      filesWritten = decompileNested(bundleDir, youJson);
      break;
    case "array":
      filesWritten = decompileArray(bundleDir, youJson);
      break;
    default:
      // Unknown format — still create scaffold files
      filesWritten = 0;
  }

  // Verify manifest if present
  const sha256Manifest = loadSha256Manifest(bundleDir);
  if (sha256Manifest && typeof sha256Manifest.sections === "object") {
    const warn = options?.warnOnHashMismatch ?? ((msg: string) => {
      process.stderr.write("\x1b[2m" + msg + "\x1b[0m\n");
    });
    for (const [sectionKey, expectedHash] of Object.entries(sha256Manifest.sections)) {
      const warning = verifySectionHash(sectionKey, expectedHash, youJson);
      if (warning) warn(warning);
    }
  }

  return filesWritten;
}
