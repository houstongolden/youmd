/**
 * Bundle compiler — reads markdown files from profile/, preferences/, voice/,
 * directives/ and compiles them into the nested server format (you-md/v1).
 *
 * Output matches convex/lib/compile.ts so the server stores it correctly
 * and the web can render it without transformation.
 */

import * as fs from "fs";
import * as path from "path";
import matter from "gray-matter";
import { readGlobalConfig } from "./config";

// ─── Types ─────────────────────────────────────────────────────────

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
  let format = "markdown preferred";

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
  let skeleton: Record<string, unknown> = {};
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
  const writingPrefs = writingPrefSection ? parseWritingPrefsMd(writingPrefSection.content) : { style: "", format: "markdown preferred" };

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
      name: about.name || (skeleton as any)?.identity?.name || "",
      tagline: about.tagline || (skeleton as any)?.identity?.tagline || "",
      location: about.location || (skeleton as any)?.identity?.location || "",
      bio: {
        short: about.bio.short || (skeleton as any)?.identity?.bio?.short || "",
        medium: about.bio.medium || (skeleton as any)?.identity?.bio?.medium || "",
        long: about.bio.long || (skeleton as any)?.identity?.bio?.long || "",
      },
    },

    now: {
      focus: nowItems.length > 0 ? nowItems : ((skeleton as any)?.now?.focus || []),
      updated_at: now.split("T")[0],
    },

    projects: projects.length > 0 ? projects : ((skeleton as any)?.projects || []),
    values: values.length > 0 ? values : ((skeleton as any)?.values || []),
    links: Object.keys(links).length > 0 ? links : ((skeleton as any)?.links || {}),

    preferences: {
      agent: {
        tone: agentPrefs.tone || (skeleton as any)?.preferences?.agent?.tone || "",
        formality: agentPrefs.formality || (skeleton as any)?.preferences?.agent?.formality || "casual-professional",
        avoid: agentPrefs.avoid.length > 0 ? agentPrefs.avoid : ((skeleton as any)?.preferences?.agent?.avoid || []),
      },
      writing: {
        style: writingPrefs.style || (skeleton as any)?.preferences?.writing?.style || "",
        format: writingPrefs.format || (skeleton as any)?.preferences?.writing?.format || "markdown preferred",
      },
    },

    voice: {
      overall: voiceOverall ? parseVoiceMd(voiceOverall.content) : ((skeleton as any)?.voice?.overall || ""),
      platforms: {
        linkedin: voicePlatforms.linkedin || (skeleton as any)?.voice?.platforms?.linkedin || null,
        x: voicePlatforms.x || (skeleton as any)?.voice?.platforms?.x || null,
        blog: voicePlatforms.blog || (skeleton as any)?.voice?.platforms?.blog || null,
        ...(Object.fromEntries(
          Object.entries(voicePlatforms).filter(([k]) => !["linkedin", "x", "blog"].includes(k))
        )),
      },
    },

    analysis: (skeleton as any)?.analysis || {
      topics: [],
      voice_summary: voiceOverall ? parseVoiceMd(voiceOverall.content) : "",
      credibility_signals: [],
    },

    social_images: (skeleton as any)?.social_images || {},

    agent_directives: {
      communication_style: directives.communication_style || (skeleton as any)?.agent_directives?.communication_style || "",
      negative_prompts: directives.negative_prompts.length > 0 ? directives.negative_prompts : ((skeleton as any)?.agent_directives?.negative_prompts || []),
      default_stack: directives.default_stack || (skeleton as any)?.agent_directives?.default_stack || "",
      decision_framework: directives.decision_framework || (skeleton as any)?.agent_directives?.decision_framework || "",
      current_goal: directives.current_goal || (skeleton as any)?.agent_directives?.current_goal || "",
    },

    agent_guide: (skeleton as any)?.agent_guide || {
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

    custom_sections: customSections.length > 0 ? customSections : ((skeleton as any)?.custom_sections || []),

    meta: {
      sources_used: (skeleton as any)?.meta?.sources_used || [],
      last_updated: now,
      compiler_version: "0.5.0",
    },

    verification: (skeleton as any)?.verification || null,
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
}
