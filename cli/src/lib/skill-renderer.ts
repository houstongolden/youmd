/**
 * Skill renderer — identity-aware template interpolation.
 *
 * Resolves {{var}} template variables in skill markdown against
 * the user's live identity context data.
 *
 * Variable paths use dot notation:
 *   {{voice.overall}}       → preferences/voice.md or profile section
 *   {{preferences.agent}}   → preferences/agent.md content
 *   {{directives.agent}}    → preferences/directives.md or agent section
 *   {{profile.about}}       → profile/about.md content
 *   {{project_name}}        → detected project name
 */

import * as fs from "fs";
import * as path from "path";
import matter from "gray-matter";
import { getLocalBundleDir, localBundleExists, detectProjectContext } from "./config";

export interface IdentityData {
  profile: Record<string, string>;
  preferences: Record<string, string>;
  voice: Record<string, string>;
  directives: Record<string, string>;
  project_name: string;
  username: string;
}

/**
 * Load identity data from the local .youmd/ bundle.
 * Reads profile/ and preferences/ directories, plus you.json if available.
 */
export function loadIdentityData(): IdentityData {
  const data: IdentityData = {
    profile: {},
    preferences: {},
    voice: {},
    directives: {},
    project_name: "",
    username: "",
  };

  // Try to detect project name
  const project = detectProjectContext();
  if (project) {
    data.project_name = project.name;
  }

  if (!localBundleExists()) {
    return data;
  }

  const bundleDir = getLocalBundleDir();

  // Read username from config
  const configPath = path.join(require("os").homedir(), ".youmd", "config.json");
  if (fs.existsSync(configPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      data.username = config.username || "";
    } catch {
      // skip
    }
  }

  // Read profile sections
  const profileDir = path.join(bundleDir, "profile");
  if (fs.existsSync(profileDir)) {
    for (const file of fs.readdirSync(profileDir).filter((f) => f.endsWith(".md"))) {
      const slug = path.basename(file, ".md");
      const raw = fs.readFileSync(path.join(profileDir, file), "utf-8");
      const { content } = matter(raw);
      data.profile[slug] = content.trim();
    }
  }

  // Read preference sections
  const prefsDir = path.join(bundleDir, "preferences");
  if (fs.existsSync(prefsDir)) {
    for (const file of fs.readdirSync(prefsDir).filter((f) => f.endsWith(".md"))) {
      const slug = path.basename(file, ".md");
      const raw = fs.readFileSync(path.join(prefsDir, file), "utf-8");
      const { content } = matter(raw);
      const text = content.trim();

      data.preferences[slug] = text;

      // Also map to voice/directives if the slug matches
      if (slug === "voice" || slug.startsWith("voice-")) {
        const voiceKey = slug === "voice" ? "overall" : slug.replace("voice-", "");
        data.voice[voiceKey] = text;
      }
      if (slug === "directives" || slug.startsWith("directives-")) {
        const dirKey = slug === "directives" ? "agent" : slug.replace("directives-", "");
        data.directives[dirKey] = text;
      }
    }
  }

  // Read voice/ directory (pull creates voice/voice.md, voice/voice.linkedin.md, etc.)
  const voiceDir = path.join(bundleDir, "voice");
  if (fs.existsSync(voiceDir)) {
    for (const file of fs.readdirSync(voiceDir).filter((f) => f.endsWith(".md"))) {
      const raw = fs.readFileSync(path.join(voiceDir, file), "utf-8");
      const { content } = matter(raw);
      const text = content.trim();

      if (file === "voice.md") {
        if (!data.voice.overall) data.voice.overall = text;
      } else {
        // voice.linkedin.md → voice.linkedin, voice.writing.md → voice.writing
        const key = path.basename(file, ".md").replace("voice.", "");
        if (!data.voice[key]) data.voice[key] = text;
      }
    }
  }

  // Read from you.json — handles both compiled bundle format AND API/pull format
  const youJsonPath = path.join(bundleDir, "you.json");
  if (fs.existsSync(youJsonPath)) {
    try {
      const youJson = JSON.parse(fs.readFileSync(youJsonPath, "utf-8"));
      extractFromYouJson(youJson, data);
    } catch {
      // skip
    }
  }

  return data;
}

/**
 * Extract identity data from a you.json object.
 * Handles both formats:
 *   - Compiled bundle: { profile: [{slug, content}], preferences: [{slug, content}] }
 *   - API/pull format: { identity: {bio: {long}}, preferences: {agent: {tone}}, voice: {overall} }
 */
function extractFromYouJson(youJson: Record<string, unknown>, data: IdentityData): void {
  // Format 1: Compiled bundle (array-based sections)
  if (Array.isArray(youJson.preferences)) {
    for (const pref of youJson.preferences) {
      if (typeof pref !== "object" || pref === null) continue;
      const p = pref as Record<string, unknown>;
      if (typeof p.slug === "string" && typeof p.content === "string" && !data.preferences[p.slug]) {
        data.preferences[p.slug] = p.content;
      }
      if (typeof p.slug === "string" && (p.slug === "voice" || p.slug.startsWith("voice"))) {
        const key = p.slug === "voice" ? "overall" : p.slug.replace(/^voice[-_]?/, "");
        if (typeof p.content === "string" && !data.voice[key]) data.voice[key] = p.content;
      }
    }
  }
  if (Array.isArray(youJson.profile)) {
    for (const section of youJson.profile) {
      if (typeof section !== "object" || section === null) continue;
      const s = section as Record<string, unknown>;
      if (typeof s.slug === "string" && typeof s.content === "string" && !data.profile[s.slug]) {
        data.profile[s.slug] = s.content;
      }
    }
  }

  // Format 2: API/pull nested structure
  const identity = youJson.identity as Record<string, unknown> | undefined;
  if (identity) {
    const bio = identity.bio as Record<string, string> | undefined;
    if (bio) {
      const aboutText = bio.long || bio.medium || bio.short || "";
      if (aboutText && !data.profile.about) {
        const name = (identity.name as string) || data.username;
        data.profile.about = name ? `# ${name}\n\n${aboutText}` : aboutText;
      }
    }
    if (identity.name && !data.profile.name) {
      data.profile.name = identity.name as string;
    }
  }

  // API preferences: { agent: { tone, formality, avoid }, writing: { style, format } }
  const apiPrefs = youJson.preferences as Record<string, unknown> | undefined;
  if (apiPrefs && !Array.isArray(apiPrefs)) {
    if (apiPrefs.agent && typeof apiPrefs.agent === "object" && !data.preferences.agent) {
      const agent = apiPrefs.agent as Record<string, unknown>;
      const parts: string[] = [];
      if (agent.tone) parts.push(`Tone: ${agent.tone}`);
      if (agent.formality) parts.push(`Formality: ${agent.formality}`);
      if (Array.isArray(agent.avoid) && agent.avoid.length) parts.push(`Avoid: ${agent.avoid.join(", ")}`);
      if (agent.custom_instructions) parts.push(`\n${agent.custom_instructions}`);
      if (parts.length) data.preferences.agent = parts.join("\n");
    }
    if (apiPrefs.writing && typeof apiPrefs.writing === "object" && !data.preferences.writing) {
      const writing = apiPrefs.writing as Record<string, unknown>;
      const parts: string[] = [];
      if (writing.style) parts.push(`Style: ${writing.style}`);
      if (writing.format) parts.push(`Format: ${writing.format}`);
      if (parts.length) data.preferences.writing = parts.join("\n");
    }
  }

  // API voice: { overall, platforms: { linkedin, twitter } }
  const apiVoice = youJson.voice as Record<string, unknown> | undefined;
  if (apiVoice) {
    if (typeof apiVoice.overall === "string" && !data.voice.overall) {
      data.voice.overall = apiVoice.overall;
    }
    if (typeof apiVoice.writing === "string" && !data.voice.writing) {
      data.voice.writing = apiVoice.writing;
    }
    if (typeof apiVoice.speaking === "string" && !data.voice.speaking) {
      data.voice.speaking = apiVoice.speaking;
    }
    const platforms = apiVoice.platforms as Record<string, string> | undefined;
    if (platforms) {
      for (const [platform, content] of Object.entries(platforms)) {
        if (content && !data.voice[platform]) {
          data.voice[platform] = content;
        }
      }
    }
  }

  // API analysis: { voice_summary }
  const analysis = youJson.analysis as Record<string, unknown> | undefined;
  if (analysis) {
    if (typeof analysis.voice_summary === "string" && !data.voice.overall) {
      data.voice.overall = analysis.voice_summary;
    }
  }

  // API projects
  const projects = youJson.projects as Array<Record<string, string>> | undefined;
  if (Array.isArray(projects) && projects.length > 0 && !data.profile.projects) {
    data.profile.projects = projects
      .map((p) => `- **${p.name}**: ${p.description || ""} (${p.status || "active"})`)
      .join("\n");
  }

  // API values
  const values = youJson.values as string[] | undefined;
  if (Array.isArray(values) && values.length > 0 && !data.profile.values) {
    data.profile.values = values.map((v) => `- ${v}`).join("\n");
  }

  // API now/focus
  const now = youJson.now as Record<string, unknown> | undefined;
  if (now) {
    const focus = now.focus as string[] | undefined;
    if (Array.isArray(focus) && focus.length > 0 && !data.profile.now) {
      data.profile.now = focus.map((f) => `- ${f}`).join("\n");
    }
  }

  // API directives (if stored as a top-level field)
  const directives = youJson.directives as Record<string, string> | undefined;
  if (directives) {
    for (const [key, val] of Object.entries(directives)) {
      if (val && !data.directives[key]) data.directives[key] = val;
    }
  }
}

/**
 * Resolve a dot-path variable against identity data.
 *
 * Examples:
 *   "voice.overall" → data.voice.overall
 *   "preferences.agent" → data.preferences.agent
 *   "profile.about" → data.profile.about
 *   "project_name" → data.project_name
 *   "username" → data.username
 */
export function resolveVariable(varPath: string, data: IdentityData): string {
  const parts = varPath.split(".");

  if (parts.length === 1) {
    // Top-level: project_name, username
    const key = parts[0] as keyof IdentityData;
    const val = data[key];
    if (typeof val === "string") return val;
    return "";
  }

  if (parts.length === 2) {
    const [namespace, key] = parts;
    const ns = data[namespace as keyof IdentityData];
    if (typeof ns === "object" && ns !== null && !Array.isArray(ns)) {
      return (ns as Record<string, string>)[key] || "";
    }
    return "";
  }

  return "";
}

/**
 * Render a skill template by interpolating all {{var}} placeholders.
 */
export function renderSkillTemplate(template: string, data?: IdentityData): string {
  const identity = data || loadIdentityData();

  return template.replace(/\{\{([^}]+)\}\}/g, (_match, varPath: string) => {
    const resolved = resolveVariable(varPath.trim(), identity);
    return resolved || `(not set: ${varPath.trim()})`;
  });
}

/**
 * Extract all {{var}} references from a skill template.
 */
export function extractTemplateVars(template: string): string[] {
  const vars: string[] = [];
  const regex = /\{\{([^}]+)\}\}/g;
  let match;
  while ((match = regex.exec(template)) !== null) {
    const v = match[1].trim();
    if (!vars.includes(v)) {
      vars.push(v);
    }
  }
  return vars;
}

/**
 * Check which identity fields a skill template references
 * and which ones have actual data.
 */
export function checkTemplateReadiness(template: string, data?: IdentityData): {
  total: number;
  filled: number;
  missing: string[];
} {
  const identity = data || loadIdentityData();
  const vars = extractTemplateVars(template);
  const missing: string[] = [];

  for (const v of vars) {
    const resolved = resolveVariable(v, identity);
    if (!resolved) {
      missing.push(v);
    }
  }

  return {
    total: vars.length,
    filled: vars.length - missing.length,
    missing,
  };
}
