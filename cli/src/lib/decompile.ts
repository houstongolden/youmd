/**
 * Decompile a you.json bundle into individual markdown files on disk.
 * Handles both the nested server format (identity.name, projects[], etc.)
 * and the legacy array format ({profile: [{slug, content}]}).
 *
 * This is the CLI counterpart of src/lib/decompile.ts (web).
 */

import * as fs from "fs";
import * as path from "path";

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
    lines.push(`# ${(identity.name as string) || youJson.username || ""}`);
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
    const tone = (agent.tone as string) || "";
    const formality = (agent.formality as string) || "";
    const avoid = (agent.avoid as string[]) || [];
    if (tone) lines.push(`**Tone:** ${tone}`);
    if (formality) lines.push(`**Formality:** ${formality}`);
    if (avoid.length > 0) lines.push(`**Avoid:** ${avoid.join(", ")}`);
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
    const style = (writing.style as string) || "";
    const format = (writing.format as string) || "";
    if (style) lines.push(`**Style:** ${style}`);
    if (format && !(format === "markdown preferred" && !style)) {
      lines.push(`**Format:** ${format}`);
    }
    if (lines.length > 4) {
      lines.push("");
      fs.writeFileSync(path.join(prefsDir, "writing.md"), lines.join("\n"));
      filesWritten++;
    }
  }

  // voice/voice.md
  {
    const overall = (voice.overall as string) || (analysis.voice_summary as string) || "";
    const lines: string[] = ['---', 'title: "Voice Profile"', '---', ''];
    lines.push(overall || "(your overall communication style)");
    lines.push("");
    fs.writeFileSync(path.join(voiceDir, "voice.md"), lines.join("\n"));
    filesWritten++;
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

// ─── Public API ──────────────────────────────────────────────────────

/**
 * Decompile a youJson bundle to the filesystem.
 * Creates all standard directories and writes markdown files.
 * Returns the number of files written.
 */
export function decompileToFilesystem(
  bundleDir: string,
  youJson: Record<string, unknown>,
): number {
  ensureStandardDirs(bundleDir);

  const format = detectFormat(youJson);

  switch (format) {
    case "nested":
      return decompileNested(bundleDir, youJson);
    case "array":
      return decompileArray(bundleDir, youJson);
    default:
      // Unknown format — still create scaffold files
      return 0;
  }
}
