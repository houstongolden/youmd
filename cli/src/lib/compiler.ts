/**
 * Bundle compiler — reads markdown files from profile/, preferences/, voice/,
 * directives/ and compiles them into the nested server format (you-md/v1).
 *
 * Output matches convex/lib/compile.ts so the server stores it correctly
 * and the web can render it without transformation.
 */

import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { createHash } from "node:crypto";
import matter from "gray-matter";
import { readGlobalConfig } from "./config";
import { canonicalJsonString } from "./canonical-json";
import { decompileToFilesystem } from "./decompile";

// ─── Types ─────────────────────────────────────────────────────────

/** Shape of an existing you.json / base.json skeleton (nested you-md/v1 format). */
interface SkeletonYouJson {
  username?: string;
  identity?: {
    name?: string;
    tagline?: string;
    location?: string;
    bio?: { short?: string; medium?: string; long?: string };
  };
  now?: { focus?: string[] };
  projects?: unknown[];
  values?: string[];
  links?: Record<string, string>;
  preferences?: {
    agent?: { tone?: string; formality?: string; avoid?: string[]; markdown?: string };
    writing?: { style?: string; format?: string; markdown?: string };
  };
  voice?: {
    overall?: string;
    markdown?: string;
    platforms?: Record<string, string | null>;
  };
  analysis?: { topics?: string[]; voice_summary?: string; credibility_signals?: string[] };
  social_images?: Record<string, unknown>;
  agent_directives?: {
    communication_style?: string;
    negative_prompts?: string[];
    default_stack?: string;
    decision_framework?: string;
    current_goal?: string;
    markdown?: string;
  };
  agent_guide?: unknown;
  custom_sections?: Array<{ id: string; title: string; content: string }>;
  meta?: { sources_used?: unknown[] };
  verification?: unknown;
}

export interface CompileResult {
  youJson: Record<string, unknown>;
  markdown: string;
  manifest: Record<string, unknown>;
  filesRead: Array<{ type: string; file: string }>;
  stats: {
    version: number;
    totalSections: number;
    filledSections: number;
    directories: string[];
  };
}

export interface Sha256Manifest {
  schema_version: 1;
  sections: Record<string, string>;
  full_sha: string;
}

export interface RoundtripMismatch {
  section: string;
  before: string;
  after: string;
}

export interface RoundtripResult {
  ok: boolean;
  mismatches: RoundtripMismatch[];
}

// ─── Helpers ───────────────────────────────────────────────────────

function simpleHash(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(8, "0");
}

function readDirectory(dirPath: string): string[] {
  if (!fs.existsSync(dirPath)) return [];
  return fs.readdirSync(dirPath).filter((f) => f.endsWith(".md")).sort();
}

function readMarkdownFile(filePath: string): { slug: string; title: string; content: string; metadata: Record<string, unknown> } {
  const raw = fs.readFileSync(filePath, "utf-8");
  const { data, content } = matter(raw);
  const slug = path.basename(filePath, ".md");
  const title = (data.title as string) || slug.split(/[-_]/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  return { slug, title, content: content.trim(), metadata: data };
}

// ─── Section parsers ───────────────────────────────────────────────

function parseAboutMd(content: string): { name: string; tagline: string; location: string; bio: { short: string; medium: string; long: string } } {
  const lines = content.split("\n");
  let name = "";
  let tagline = "";
  let location = "";
  const bodyLines: string[] = [];
  let foundName = false;
  let seenNonEmpty = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("# ")) {
      name = trimmed.slice(2).trim();
      foundName = true;
    } else if (trimmed.startsWith("*") && trimmed.endsWith("*") && !trimmed.startsWith("**")) {
      location = trimmed.replace(/^\*|\*$/g, "").trim();
    } else if (!foundName && !trimmed) {
      continue;
    } else if (foundName && !seenNonEmpty && !tagline && trimmed && !trimmed.startsWith("#") && !trimmed.startsWith("-") && !trimmed.startsWith("**")) {
      // First non-empty line after name that isn't location → tagline candidate
      // Accept taglines even if they end with period (common in real usage)
      if (trimmed.length < 120) {
        tagline = trimmed;
      } else {
        bodyLines.push(trimmed);
      }
      seenNonEmpty = true;
    } else if (trimmed) {
      bodyLines.push(trimmed);
      seenNonEmpty = true;
    }
  }

  const long = bodyLines.join("\n").trim();
  const medium = long.split("\n").slice(0, 3).join("\n").trim();
  const short = long.split(/\.\s/)[0]?.trim() || medium.split("\n")[0]?.trim() || "";
  // Restore the period if we split on it
  const shortWithPeriod = short && long.startsWith(short) && long[short.length] === "." ? short + "." : short;

  return { name, tagline, location, bio: { short: shortWithPeriod, medium, long } };
}

function parseProjectsMd(content: string): Array<{ name: string; role: string; status: string; url: string; description: string }> {
  const projects: Array<{ name: string; role: string; status: string; url: string; description: string }> = [];
  const sections = content.split(/^## /m).filter(Boolean);

  for (const section of sections) {
    const lines = section.split("\n");
    const name = lines[0]?.trim() || "";
    if (!name || name.startsWith("#")) continue;

    let role = "";
    let status = "active";
    let url = "";
    const descLines: string[] = [];

    for (const line of lines.slice(1)) {
      const trimmed = line.trim();
      if (trimmed.match(/^\*?\*?Role:?\*?\*?\s*/i)) {
        role = trimmed.replace(/^\*?\*?Role:?\*?\*?\s*/i, "").trim();
      } else if (trimmed.match(/^\*?\*?Status:?\*?\*?\s*/i)) {
        status = trimmed.replace(/^\*?\*?Status:?\*?\*?\s*/i, "").trim();
      } else if (trimmed.match(/^\*?\*?URL:?\*?\*?\s*/i)) {
        url = trimmed.replace(/^\*?\*?URL:?\*?\*?\s*/i, "").trim();
      } else if (trimmed.match(/^- Role:\s*/i)) {
        role = trimmed.replace(/^- Role:\s*/i, "").trim();
      } else if (trimmed.match(/^- Status:\s*/i)) {
        status = trimmed.replace(/^- Status:\s*/i, "").trim();
      } else if (trimmed.match(/^- URL:\s*/i)) {
        url = trimmed.replace(/^- URL:\s*/i, "").trim();
      } else if (trimmed) {
        descLines.push(trimmed);
      }
    }

    projects.push({
      name,
      role,
      status,
      url,
      description: descLines.join("\n").trim(),
    });
  }

  return projects;
}

function parseListMd(content: string): string[] {
  // Primary: bullet items (-, *, +)
  const bullets = content.split("\n")
    .map((l) => l.trim())
    .filter((l) => /^[-*+]\s/.test(l))
    .map((l) => l.replace(/^[-*+]\s+/, "").trim())
    .filter(Boolean);

  if (bullets.length > 0) return bullets;

  // Fallback: ## headings (common in values sections from onboarding)
  const headings = content.split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("## "))
    .map((l) => l.slice(3).trim())
    .filter(Boolean);

  if (headings.length > 0) return headings;

  // Last resort: non-empty paragraphs that aren't headings or frontmatter
  const paragraphs = content.split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#") && !l.startsWith("---") && !l.startsWith("<!--") && !l.startsWith("("))
    .map((l) => l.trim());

  return paragraphs.length > 0 ? paragraphs : [];
}

function parseLinksMd(content: string): Record<string, string> {
  const links: Record<string, string> = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    // "- **platform**: url" or "- **platform:** url" or "- platform: url"
    const boldMatch = trimmed.match(/^-\s+\*\*(.+?)\*\*:?\s+(.+)$/);
    if (boldMatch) {
      links[boldMatch[1].replace(/:$/, "").trim()] = boldMatch[2].trim();
      continue;
    }
    const simpleMatch = trimmed.match(/^-\s+(.+?):\s+(.+)$/);
    if (simpleMatch) {
      links[simpleMatch[1].trim()] = simpleMatch[2].trim();
    }
  }
  return links;
}

function parseAgentPrefsMd(content: string): { tone: string; formality: string; avoid: string[] } {
  let tone = "";
  let formality = "casual-professional";
  let avoid: string[] = [];

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.match(/^\*?\*?Tone:?\*?\*?\s*/i)) {
      tone = trimmed.replace(/^\*?\*?Tone:?\*?\*?\s*/i, "").trim();
    } else if (trimmed.match(/^\*?\*?Formality:?\*?\*?\s*/i)) {
      formality = trimmed.replace(/^\*?\*?Formality:?\*?\*?\s*/i, "").trim();
    } else if (trimmed.match(/^\*?\*?Avoid:?\*?\*?\s*/i)) {
      const avoidStr = trimmed.replace(/^\*?\*?Avoid:?\*?\*?\s*/i, "").trim();
      avoid = avoidStr.split(",").map((a) => a.trim()).filter(Boolean);
    } else if (trimmed.match(/^Tone:\s*/i)) {
      tone = trimmed.replace(/^Tone:\s*/i, "").trim();
    } else if (trimmed.match(/^Formality:\s*/i)) {
      formality = trimmed.replace(/^Formality:\s*/i, "").trim();
    } else if (trimmed.match(/^Avoid:\s*/i)) {
      const avoidStr = trimmed.replace(/^Avoid:\s*/i, "").trim();
      avoid = avoidStr.split(",").map((a) => a.trim()).filter(Boolean);
    }
  }

  return { tone, formality, avoid };
}

function parseWritingPrefsMd(content: string): { style: string; format: string } {
  let style = "";
  let format = "";

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.match(/^\*?\*?Style:?\*?\*?\s*/i)) {
      style = trimmed.replace(/^\*?\*?Style:?\*?\*?\s*/i, "").trim();
    } else if (trimmed.match(/^\*?\*?Format:?\*?\*?\s*/i)) {
      format = trimmed.replace(/^\*?\*?Format:?\*?\*?\s*/i, "").trim();
    } else if (trimmed.match(/^Style:\s*/i)) {
      style = trimmed.replace(/^Style:\s*/i, "").trim();
    } else if (trimmed.match(/^Format:\s*/i)) {
      format = trimmed.replace(/^Format:\s*/i, "").trim();
    }
  }

  return { style, format };
}

function parseVoiceMd(content: string): string {
  // Strip frontmatter heading, return the body
  return content.replace(/^#\s+.+\n*/m, "").trim();
}

function parseDirectivesMd(content: string): {
  communication_style: string;
  negative_prompts: string[];
  default_stack: string;
  decision_framework: string;
  current_goal: string;
} {
  let communication_style = "";
  let negative_prompts: string[] = [];
  let default_stack = "";
  let decision_framework = "";
  let current_goal = "";

  const allLines = content.split("\n");
  let inNeverBlock = false;

  for (const line of allLines) {
    const trimmed = line.trim();

    if (trimmed.match(/^\*?\*?Communication Style:?\*?\*?\s*/i)) {
      communication_style = trimmed.replace(/^\*?\*?Communication Style:?\*?\*?\s*/i, "").trim();
      inNeverBlock = false;
    } else if (trimmed.match(/^\*?\*?Never:?\*?\*?\s*/i)) {
      const inline = trimmed.replace(/^\*?\*?Never:?\*?\*?\s*/i, "").trim();
      if (inline) {
        // Inline format: "Never: don't ask permission. avoid jargon."
        // Split on sentence boundaries but be careful with abbreviations
        // Use comma-separation if commas present, otherwise sentence-split
        if (inline.includes(",")) {
          negative_prompts = inline.split(",").map((s) => s.trim().replace(/\.$/, "")).filter(Boolean);
        } else {
          negative_prompts = inline.split(/(?<=[a-z])\.\s+/i).map((s) => s.trim().replace(/\.$/, "")).filter(Boolean);
        }
      }
      inNeverBlock = true;
    } else if (trimmed.match(/^\*?\*?Default Stack:?\*?\*?\s*/i)) {
      default_stack = trimmed.replace(/^\*?\*?Default Stack:?\*?\*?\s*/i, "").trim();
      inNeverBlock = false;
    } else if (trimmed.match(/^\*?\*?Decision Framework:?\*?\*?\s*/i)) {
      decision_framework = trimmed.replace(/^\*?\*?Decision Framework:?\*?\*?\s*/i, "").trim();
      inNeverBlock = false;
    } else if (trimmed.match(/^\*?\*?Current Goal:?\*?\*?\s*/i)) {
      current_goal = trimmed.replace(/^\*?\*?Current Goal:?\*?\*?\s*/i, "").trim();
      inNeverBlock = false;
    } else if (/^[-*+]\s/.test(trimmed)) {
      // List item — collect as negative prompt if we're in a Never block,
      // otherwise as a generic directive
      const item = trimmed.replace(/^[-*+]\s+/, "").trim();
      if (item) {
        if (inNeverBlock) {
          negative_prompts.push(item);
        } else if (!communication_style && !default_stack) {
          // Unlabeled list items before any labeled field → generic directives
          // Treat as communication style hints
          negative_prompts.push(item);
        }
      }
    } else if (trimmed && !trimmed.startsWith("#")) {
      // Non-labeled, non-list line — if we're in a never block, treat as continuation
      if (inNeverBlock && trimmed) {
        negative_prompts.push(trimmed);
      }
      // A labeled field resets the never block
      if (trimmed.includes(":")) {
        inNeverBlock = false;
      }
    }
  }

  return { communication_style, negative_prompts, default_stack, decision_framework, current_goal };
}

// ─── Main compilation ──────────────────────────────────────────────

export function compileBundle(bundleDir: string): CompileResult {
  const profileDir = path.join(bundleDir, "profile");
  const preferencesDir = path.join(bundleDir, "preferences");
  const voiceDir = path.join(bundleDir, "voice");
  const directivesDir = path.join(bundleDir, "directives");

  const profileFiles = readDirectory(profileDir);
  const preferenceFiles = readDirectory(preferencesDir);
  const voiceFiles = readDirectory(voiceDir);
  const directiveFiles = readDirectory(directivesDir);

  const filesRead: Array<{ type: string; file: string }> = [];

  // Read all files
  const profileSections = profileFiles.map((file) => {
    filesRead.push({ type: "profile", file });
    return readMarkdownFile(path.join(profileDir, file));
  });
  const prefSections = preferenceFiles.map((file) => {
    filesRead.push({ type: "preference", file });
    return readMarkdownFile(path.join(preferencesDir, file));
  });
  const voiceSections = voiceFiles.map((file) => {
    filesRead.push({ type: "voice", file });
    return readMarkdownFile(path.join(voiceDir, file));
  });
  const directiveSections = directiveFiles.map((file) => {
    filesRead.push({ type: "directive", file });
    return readMarkdownFile(path.join(directivesDir, file));
  });

  // Load existing skeleton from you.json or base.json to preserve fields we don't model
  let skeleton: SkeletonYouJson = {};
  const youJsonPath = path.join(bundleDir, "you.json");
  const baseJsonPath = path.join(bundleDir, "base.json");
  if (fs.existsSync(youJsonPath)) {
    try {
      const existing = JSON.parse(fs.readFileSync(youJsonPath, "utf-8"));
      // Only use as skeleton if it's nested format (has identity or schema)
      if (existing.identity || existing.schema === "you-md/v1") {
        skeleton = existing;
      }
    } catch { /* ignore corrupt */ }
  }
  if (Object.keys(skeleton).length === 0 && fs.existsSync(baseJsonPath)) {
    try {
      skeleton = JSON.parse(fs.readFileSync(baseJsonPath, "utf-8"));
    } catch { /* ignore */ }
  }

  // Determine version
  const manifestPath = path.join(bundleDir, "manifest.json");
  let version = 1;
  if (fs.existsSync(manifestPath)) {
    try {
      const existingManifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
      version = (existingManifest.version || 0) + 1;
    } catch { /* version 1 */ }
  }

  const now = new Date().toISOString();
  // Read username from skeleton, falling back to global config
  let username = (skeleton.username as string) || "";
  if (!username) {
    try {
      const globalConfig = readGlobalConfig();
      username = globalConfig.username || "";
    } catch {
      // config not available
    }
  }

  // ── Parse profile files ────────────────────────────────────────

  const aboutSection = profileSections.find((s) => s.slug === "about");
  const projectsSection = profileSections.find((s) => s.slug === "projects");
  const nowSection = profileSections.find((s) => s.slug === "now");
  const valuesSection = profileSections.find((s) => s.slug === "values");
  const linksSection = profileSections.find((s) => s.slug === "links");

  const about = aboutSection ? parseAboutMd(aboutSection.content) : { name: "", tagline: "", location: "", bio: { short: "", medium: "", long: "" } };
  const projects = projectsSection ? parseProjectsMd(projectsSection.content) : [];
  const nowItems = nowSection ? parseListMd(nowSection.content) : [];
  const values = valuesSection ? parseListMd(valuesSection.content) : [];
  const links = linksSection ? parseLinksMd(linksSection.content) : {};

  // Collect custom sections (any profile file not in the standard set)
  const standardSlugs = new Set(["about", "now", "projects", "values", "links", "skills", "experience"]);
  const customSections = profileSections
    .filter((s) => !standardSlugs.has(s.slug))
    .map((s) => ({ id: s.slug, title: s.title, content: s.content }));

  // ── Parse preferences ──────────────────────────────────────────

  const agentPrefSection = prefSections.find((s) => s.slug === "agent");
  const writingPrefSection = prefSections.find((s) => s.slug === "writing");

  const agentPrefs = agentPrefSection ? parseAgentPrefsMd(agentPrefSection.content) : { tone: "", formality: "casual-professional", avoid: [] };
  const writingPrefs = writingPrefSection ? parseWritingPrefsMd(writingPrefSection.content) : { style: "", format: "" };

  // ── Parse voice ────────────────────────────────────────────────

  const voiceOverall = voiceSections.find((s) => s.slug === "voice");
  const voicePlatforms: Record<string, string> = {};
  for (const v of voiceSections) {
    if (v.slug.startsWith("voice.")) {
      const platform = v.slug.slice("voice.".length);
      voicePlatforms[platform] = parseVoiceMd(v.content);
    }
  }

  // ── Parse directives ───────────────────────────────────────────

  const agentDirective = directiveSections.find((s) => s.slug === "agent");
  const directives = agentDirective ? parseDirectivesMd(agentDirective.content) : {
    communication_style: "", negative_prompts: [], default_stack: "", decision_framework: "", current_goal: ""
  };

  // ── Build youJson (nested server format) ───────────────────────

  const youJson: Record<string, unknown> = {
    schema: "you-md/v1",
    username,
    generated_at: now,

    identity: {
      name: about.name || skeleton?.identity?.name || "",
      tagline: about.tagline || skeleton?.identity?.tagline || "",
      location: about.location || skeleton?.identity?.location || "",
      bio: {
        short: about.bio.short || skeleton?.identity?.bio?.short || "",
        medium: about.bio.medium || skeleton?.identity?.bio?.medium || "",
        long: about.bio.long || skeleton?.identity?.bio?.long || "",
      },
    },

    now: {
      focus: nowItems.length > 0 ? nowItems : (skeleton?.now?.focus || []),
      updated_at: now.split("T")[0],
    },

    projects: projects.length > 0 ? projects : (skeleton?.projects || []),
    values: values.length > 0 ? values : (skeleton?.values || []),
    links: Object.keys(links).length > 0 ? links : (skeleton?.links || {}),

    preferences: {
      agent: {
        tone: agentPrefs.tone || skeleton?.preferences?.agent?.tone || "",
        formality: agentPrefs.formality || skeleton?.preferences?.agent?.formality || "casual-professional",
        avoid: agentPrefs.avoid.length > 0 ? agentPrefs.avoid : (skeleton?.preferences?.agent?.avoid || []),
        markdown: agentPrefSection?.content || skeleton?.preferences?.agent?.markdown || "",
      },
      writing: {
        style: writingPrefs.style || skeleton?.preferences?.writing?.style || "",
        format: writingPrefs.format || skeleton?.preferences?.writing?.format || "",
        markdown: writingPrefSection?.content || skeleton?.preferences?.writing?.markdown || "",
      },
    },

    voice: {
      overall: voiceOverall ? parseVoiceMd(voiceOverall.content) : (skeleton?.voice?.overall || ""),
      markdown: voiceOverall?.content || skeleton?.voice?.markdown || "",
      platforms: {
        linkedin: voicePlatforms.linkedin || skeleton?.voice?.platforms?.linkedin || null,
        x: voicePlatforms.x || skeleton?.voice?.platforms?.x || null,
        blog: voicePlatforms.blog || skeleton?.voice?.platforms?.blog || null,
        ...(Object.fromEntries(
          Object.entries(voicePlatforms).filter(([k]) => !["linkedin", "x", "blog"].includes(k))
        )),
      },
    },

    analysis: skeleton?.analysis || {
      topics: [],
      voice_summary: voiceOverall ? parseVoiceMd(voiceOverall.content) : "",
      credibility_signals: [],
    },

    social_images: skeleton?.social_images || {},

    agent_directives: {
      communication_style: directives.communication_style || skeleton?.agent_directives?.communication_style || "",
      negative_prompts: directives.negative_prompts.length > 0 ? directives.negative_prompts : (skeleton?.agent_directives?.negative_prompts || []),
      default_stack: directives.default_stack || skeleton?.agent_directives?.default_stack || "",
      decision_framework: directives.decision_framework || skeleton?.agent_directives?.decision_framework || "",
      current_goal: directives.current_goal || skeleton?.agent_directives?.current_goal || "",
      markdown: agentDirective?.content || skeleton?.agent_directives?.markdown || "",
    },

    agent_guide: skeleton?.agent_guide || {
      summary: "this is a you-md/v1 identity context protocol. use it to understand who this person is before working with them.",
      quick_context: [
        "identity.bio.short -- one-line summary",
        "now.focus -- what they're working on right now",
        "agent_directives -- behavioral instructions for how to interact",
        "preferences.agent -- communication tone preferences",
        "projects -- their active projects with context",
        "voice.overall -- their communication style",
      ],
      for_writing: "check preferences.writing and voice.platforms for platform-specific style",
      for_coding: "check projects for tech stack context, agent_directives.default_stack for preferred stack",
      for_research: "check analysis.topics and links for their areas of expertise",
    },

    custom_sections: customSections.length > 0 ? customSections : (skeleton?.custom_sections || []),

    meta: {
      sources_used: skeleton?.meta?.sources_used || [],
      last_updated: now,
      compiler_version: "0.5.0",
    },

    verification: skeleton?.verification || null,
  };

  // ── Build you.md ───────────────────────────────────────────────

  const mdParts: string[] = [];
  mdParts.push(`---\nschema: you-md/v1\nname: ${about.name || username}\nusername: ${username}\ngenerated_at: ${now}\n---`);
  mdParts.push(`\n# ${about.name || username}`);
  if (about.tagline) mdParts.push(about.tagline);
  if (about.location) mdParts.push(`*${about.location}*`);
  if (about.bio.long) mdParts.push(`\n## About\n\n${about.bio.long}`);
  if (nowItems.length > 0) mdParts.push(`\n## Now\n\n${nowItems.map((f) => `- ${f}`).join("\n")}`);
  if (projects.length > 0) {
    const pLines = projects.map((p) => `- **${p.name}**${p.description ? ` -- ${p.description}` : ""}${p.role ? ` (${p.role})` : ""}`);
    mdParts.push(`\n## Projects\n\n${pLines.join("\n")}`);
  }
  if (values.length > 0) mdParts.push(`\n## Values\n\n${values.map((v) => `- ${v}`).join("\n")}`);
  if (agentPrefs.tone) {
    const prefLines: string[] = [];
    prefLines.push(`Tone: ${agentPrefs.tone}`);
    if (agentPrefs.avoid.length > 0) prefLines.push(`Avoid: ${agentPrefs.avoid.join(", ")}`);
    mdParts.push(`\n## Agent Preferences\n\n${prefLines.join("\n")}`);
  }
  const linkEntries = Object.entries(links).filter(([, url]) => url);
  if (linkEntries.length > 0) mdParts.push(`\n## Links\n\n${linkEntries.map(([p, u]) => `- ${p}: ${u}`).join("\n")}`);
  if (voiceOverall) mdParts.push(`\n## Voice\n\n${parseVoiceMd(voiceOverall.content)}`);
  for (const cs of customSections) {
    mdParts.push(`\n## ${cs.title}\n\n${cs.content}`);
  }
  mdParts.push(`\n---\n\n> **For agents**: this is a you-md/v1 identity context protocol.\n> Quick context: check identity.bio.short, now.focus, and preferences.agent.\n> For writing help: check voice section and preferences.writing.\n> Full structured data: see you.json.`);

  const markdown = mdParts.join("\n") + "\n";

  // ── Build manifest ─────────────────────────────────────────────

  const manifestEntries: Array<{ file: string; type: string; slug: string; hash: string }> = [];
  const allDirs: [string, string, string[]][] = [
    [profileDir, "profile", profileFiles],
    [preferencesDir, "preference", preferenceFiles],
    [voiceDir, "voice", voiceFiles],
    [directivesDir, "directive", directiveFiles],
  ];

  for (const [dir, type, files] of allDirs) {
    for (const file of files) {
      const content = fs.readFileSync(path.join(dir, file), "utf-8");
      const dirName = path.basename(dir);
      manifestEntries.push({
        file: `${dirName}/${file}`,
        type,
        slug: path.basename(file, ".md"),
        hash: simpleHash(content),
      });
    }
  }

  const manifest = {
    version,
    generatedAt: now,
    entries: manifestEntries,
  };

  // Count filled sections
  const allSections = [...profileSections, ...prefSections, ...voiceSections, ...directiveSections];
  const filledSections = allSections.filter(
    (s) => s.content.split("\n").filter((l) => l.trim() && !l.startsWith("<!--") && !l.startsWith("(")).length > 0
  ).length;

  const directories = ["profile", "preferences", "voice", "directives"].filter((d) => {
    const dir = path.join(bundleDir, d);
    return fs.existsSync(dir) && readDirectory(dir).length > 0;
  });

  return {
    youJson,
    markdown,
    manifest,
    filesRead,
    stats: {
      version,
      totalSections: allSections.length,
      filledSections,
      directories,
    },
  };
}

// ─── SHA-256 manifest ──────────────────────────────────────────────

/**
 * Build a sha256 manifest from a compiled result.
 * Sections are keyed by "<dir>/<slug>" (e.g. "profile/about").
 * Each section hash is the sha256 of its normalized markdown content.
 * full_sha is the sha256 of the canonical JSON string of you.json.
 */
export function buildSha256Manifest(result: CompileResult): Sha256Manifest {
  const youJsonStr = canonicalJsonString(result.youJson);
  const full_sha = createHash("sha256").update(youJsonStr, "utf-8").digest("hex");

  const sections: Record<string, string> = {};
  for (const entry of result.filesRead) {
    const dirName = entry.type === "preference" ? "preferences"
      : entry.type === "directive" ? "directives"
      : entry.type === "voice" ? "voice"
      : "profile";
    const slug = path.basename(entry.file, ".md");
    const sectionKey = `${dirName}/${slug}`;
    // Read actual file content from bundleDir if available; stored hash computed from raw file bytes
    // Since we don't store raw bytes in CompileResult, we use the youJson field that corresponds.
    // For a stable hash, we hash the canonical section value from youJson.
    const sectionValue = extractSectionValue(result.youJson, entry.type, slug);
    sections[sectionKey] = createHash("sha256")
      .update(canonicalJsonString(sectionValue), "utf-8")
      .digest("hex");
  }

  return { schema_version: 1, sections, full_sha };
}

/**
 * Extract the logical value for a section from a compiled youJson, used for
 * deterministic per-section hashing. Returns the structured value (not raw
 * markdown) so the hash is stable across whitespace normalization.
 */
function extractSectionValue(
  youJson: Record<string, unknown>,
  type: string,
  slug: string,
): unknown {
  const identity = (youJson.identity as Record<string, unknown>) || {};
  const now = (youJson.now as Record<string, unknown>) || {};
  const prefs = (youJson.preferences as Record<string, unknown>) || {};
  const voice = (youJson.voice as Record<string, unknown>) || {};
  const directives = (youJson.agent_directives as Record<string, unknown>) || {};

  if (type === "profile") {
    if (slug === "about") return identity;
    if (slug === "now") return now.focus;
    if (slug === "projects") return youJson.projects;
    if (slug === "values") return youJson.values;
    if (slug === "links") return youJson.links;
    // custom section
    const customs = (youJson.custom_sections as Array<Record<string, unknown>>) || [];
    return customs.find((s) => s.id === slug) ?? slug;
  }
  if (type === "preference") {
    if (slug === "agent") return prefs.agent;
    if (slug === "writing") return prefs.writing;
    return slug;
  }
  if (type === "voice") {
    if (slug === "voice") return { overall: voice.overall, markdown: voice.markdown };
    const platforms = (voice.platforms as Record<string, unknown>) || {};
    const platform = slug.startsWith("voice.") ? slug.slice("voice.".length) : slug;
    return platforms[platform] ?? slug;
  }
  if (type === "directive") {
    if (slug === "agent") return directives;
    return slug;
  }
  return slug;
}

export function writeBundle(bundleDir: string, result: CompileResult): void {
  fs.writeFileSync(
    path.join(bundleDir, "you.json"),
    JSON.stringify(result.youJson, null, 2) + "\n"
  );
  fs.writeFileSync(path.join(bundleDir, "you.md"), result.markdown);
  fs.writeFileSync(
    path.join(bundleDir, "manifest.json"),
    JSON.stringify(result.manifest, null, 2) + "\n"
  );
  // T27: emit sha256 manifest adjacent to you.json
  const sha256Manifest = buildSha256Manifest(result);
  fs.writeFileSync(
    path.join(bundleDir, "manifest.sha256.json"),
    JSON.stringify(sha256Manifest, null, 2) + "\n"
  );
}

// ─── Round-trip identity check ─────────────────────────────────────

/**
 * Compile bundleDir, decompile the result into a temp dir, recompile the
 * temp dir, and compare per-section values. Returns a list of mismatches.
 *
 * This is a semantic round-trip — whitespace normalization is applied so
 * cosmetic differences in markdown formatting do not register as failures.
 * The check covers: identity, now.focus, projects, values, links,
 * preferences.agent (structured), preferences.writing (structured),
 * voice.overall, agent_directives (structured).
 */
export function roundtripIdentity(bundleDir: string): RoundtripResult {
  const first = compileBundle(bundleDir);

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "youmd-rt-"));
  try {
    decompileToFilesystem(tmpDir, first.youJson);
    const second = compileBundle(tmpDir);

    const mismatches: RoundtripMismatch[] = [];

    function check(key: string, a: unknown, b: unknown): void {
      const aStr = canonicalJsonString(normalizeValue(a));
      const bStr = canonicalJsonString(normalizeValue(b));
      if (aStr !== bStr) {
        mismatches.push({ section: key, before: aStr, after: bStr });
      }
    }

    const id1 = (first.youJson.identity as Record<string, unknown>) || {};
    const id2 = (second.youJson.identity as Record<string, unknown>) || {};
    check("identity.name", id1.name, id2.name);
    check("identity.tagline", id1.tagline, id2.tagline);
    check("identity.location", id1.location, id2.location);
    check("identity.bio.long", (id1.bio as Record<string, unknown>)?.long, (id2.bio as Record<string, unknown>)?.long);

    check("now.focus", (first.youJson.now as Record<string, unknown>)?.focus, (second.youJson.now as Record<string, unknown>)?.focus);
    check("projects", first.youJson.projects, second.youJson.projects);
    check("values", first.youJson.values, second.youJson.values);
    check("links", first.youJson.links, second.youJson.links);

    const p1 = (first.youJson.preferences as Record<string, Record<string, unknown>>) || {};
    const p2 = (second.youJson.preferences as Record<string, Record<string, unknown>>) || {};
    check("preferences.agent.tone", p1.agent?.tone, p2.agent?.tone);
    check("preferences.agent.formality", p1.agent?.formality, p2.agent?.formality);
    check("preferences.agent.avoid", p1.agent?.avoid, p2.agent?.avoid);
    check("preferences.writing.style", p1.writing?.style, p2.writing?.style);
    check("preferences.writing.format", p1.writing?.format, p2.writing?.format);

    check("voice.overall", (first.youJson.voice as Record<string, unknown>)?.overall, (second.youJson.voice as Record<string, unknown>)?.overall);

    const d1 = (first.youJson.agent_directives as Record<string, unknown>) || {};
    const d2 = (second.youJson.agent_directives as Record<string, unknown>) || {};
    check("agent_directives.communication_style", d1.communication_style, d2.communication_style);
    check("agent_directives.negative_prompts", d1.negative_prompts, d2.negative_prompts);
    check("agent_directives.default_stack", d1.default_stack, d2.default_stack);

    return { ok: mismatches.length === 0, mismatches };
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

/** Normalize a value for round-trip comparison (trim strings, sort arrays of strings). */
function normalizeValue(v: unknown): unknown {
  if (typeof v === "string") return v.trim();
  if (Array.isArray(v)) return v.map(normalizeValue);
  if (v !== null && typeof v === "object") {
    const rec = v as Record<string, unknown>;
    return Object.fromEntries(Object.keys(rec).sort().map((k) => [k, normalizeValue(rec[k])]));
  }
  return v;
}
