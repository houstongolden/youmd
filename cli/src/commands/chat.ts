import * as readline from "readline";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import chalk from "chalk";
import {
  getLocalBundleDir,
  getHomeBundleDir,
  bundleLooksInitialized,
  localBundleExists,
  isAuthenticated,
  readGlobalConfig,
  detectProjectContext,
  readProjectPrivateNotes,
} from "../lib/config";
import {
  findProjectsRoot,
  detectCurrentProject,
  getProjectDir,
  buildProjectContextInjection,
  parseProjectUpdates,
  updateProjectFile,
  getRecentProjectInsights,
  getFeaturedRecentProjectNames,
  getTopProjectOpportunity,
  getWorkspaceRootCandidates,
  getProjectMarkerSignals,
} from "../lib/project";
import type { RecentProjectInsight } from "../lib/project";
import { compileBundle, writeBundle } from "../lib/compiler";
import { uploadBundle, publishLatest, saveMemories, updatePrivateContext } from "../lib/api";
import { initProject } from "../lib/skills";
import { BrailleSpinner } from "../lib/render";
import {
  callLLM,
  parseUpdatesFromResponse,
  writeSectionFile,
  sectionLabel,
  showBundlePreview,
  getOpenRouterKey,
  scrapeProfile,
  researchUser,
  Spinner,
  randomThinking,
  BUNDLE_SECTIONS,
} from "../lib/onboarding";
import type { ChatMessage } from "../lib/onboarding";
import { printPortraitEncounter, printSavedPortrait, printYouLogo, resolvePortraitLines } from "../lib/ascii";
import { checkForCliUpdate } from "../lib/update";

// ─── URL Detection + Scraping (mirrors web useYouAgent) ──────────────

import { getConvexSiteUrl } from "../lib/config";

const CONVEX_SITE_URL = getConvexSiteUrl();
const STREAM_URL = `${CONVEX_SITE_URL}/api/v1/chat/stream`;
const CURRENT_VERSION = "0.6.19";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Streaming LLM client ─────────────────────────────────────────────

async function streamLLM(
  _apiKey: string | null,
  messages: ChatMessage[],
  onToken: (text: string) => void
): Promise<string> {
  const res = await fetch(STREAM_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
    signal: AbortSignal.timeout(120_000),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Stream error (${res.status}): ${body}`);
  }

  if (!res.body) {
    throw new Error("No response body from stream endpoint");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let fullText = "";
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // Process complete SSE lines
    const lines = buffer.split("\n");
    // Keep the last potentially incomplete line in the buffer
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (trimmed.startsWith("data: ")) {
        const data = trimmed.slice(6);

        if (data === "[DONE]") {
          continue;
        }

        try {
          const parsed = JSON.parse(data) as { text?: string };
          if (parsed.text) {
            fullText += parsed.text;
            onToken(parsed.text);
          }
        } catch {
          // Skip malformed JSON chunks
        }
      }
    }
  }

  // Process any remaining buffer
  if (buffer.trim()) {
    const trimmed = buffer.trim();
    if (trimmed.startsWith("data: ")) {
      const data = trimmed.slice(6);
      if (data !== "[DONE]") {
        try {
          const parsed = JSON.parse(data) as { text?: string };
          if (parsed.text) {
            fullText += parsed.text;
            onToken(parsed.text);
          }
        } catch {
          // Skip
        }
      }
    }
  }

  return fullText;
}

/**
 * Call LLM with streaming, falling back to blocking callLLM on failure.
 * Returns the full response text.
 */
async function callLLMWithStreaming(
  apiKey: string | null,
  messages: ChatMessage[],
  spinnerLabel: string
): Promise<{ text: string; streamed: boolean }> {
  const thinkSpinner = new BrailleSpinner(spinnerLabel);
  thinkSpinner.start();

  try {
    let firstToken = true;
    const response = await streamLLM(apiKey, messages, (token) => {
      if (firstToken) {
        // Clear the spinner line before writing streamed text
        thinkSpinner.stop();
        process.stdout.write("  ");
        firstToken = false;
      }
      process.stdout.write(token);
    });

    if (!firstToken) {
      // We streamed something -- add trailing newline
      process.stdout.write("\n");
    } else {
      // No tokens received -- clear spinner
      thinkSpinner.stop();
    }

    return { text: response, streamed: !firstToken };
  } catch {
    // Streaming failed -- fall back to blocking call
    thinkSpinner.update("streaming unavailable, waiting for response");

    try {
      const response = await callLLM(apiKey, messages);
      thinkSpinner.stop();
      return { text: response, streamed: false };
    } catch (err) {
      thinkSpinner.fail(err instanceof Error ? err.message : "failed");
      throw err;
    }
  }
}

interface DetectedSource {
  platform: "x" | "github" | "linkedin" | "website";
  url: string;
  username?: string;
}

function detectSourcesInMessage(text: string): DetectedSource[] {
  const sources: DetectedSource[] = [];
  const seen = new Set<string>();
  let match: RegExpExecArray | null;

  const xUrlRegex = /(?:https?:\/\/)?(?:www\.)?(?:x\.com|twitter\.com)\/([a-zA-Z0-9_]+)/gi;
  while ((match = xUrlRegex.exec(text)) !== null) {
    const u = match[1];
    if (!["home", "search", "explore", "settings", "i", "intent"].includes(u.toLowerCase()) && !seen.has(`x:${u}`)) {
      seen.add(`x:${u}`);
      sources.push({ platform: "x", url: `https://x.com/${u}`, username: u });
    }
  }

  const ghUrlRegex = /(?:https?:\/\/)?(?:www\.)?github\.com\/([a-zA-Z0-9_-]+)/gi;
  while ((match = ghUrlRegex.exec(text)) !== null) {
    const u = match[1];
    if (!["orgs", "topics", "settings", "marketplace", "explore"].includes(u.toLowerCase()) && !seen.has(`github:${u}`)) {
      seen.add(`github:${u}`);
      sources.push({ platform: "github", url: `https://github.com/${u}`, username: u });
    }
  }

  const liUrlRegex = /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/([a-zA-Z0-9_-]+)/gi;
  while ((match = liUrlRegex.exec(text)) !== null) {
    const slug = match[1];
    if (!seen.has(`linkedin:${slug}`)) {
      seen.add(`linkedin:${slug}`);
      sources.push({ platform: "linkedin", url: `https://linkedin.com/in/${slug}`, username: slug });
    }
  }

  const urlRegex = /https?:\/\/[^\s<>"']+/gi;
  while ((match = urlRegex.exec(text)) !== null) {
    const url = match[0].replace(/[.,;:)\]]+$/, "");
    if (!url.includes("x.com") && !url.includes("twitter.com") && !url.includes("github.com") && !url.includes("linkedin.com") && !seen.has(url)) {
      seen.add(url);
      sources.push({ platform: "website", url });
    }
  }

  const bareDomainRegex = /(?<![/\w])([a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?\.(?:com|co|io|ai|dev|org|net|app|xyz|me)(?:\/[^\s<>"']*)?)/gi;
  while ((match = bareDomainRegex.exec(text)) !== null) {
    let domain = match[1].replace(/[.,;:)\]]+$/, "");
    if (domain.includes("x.com") || domain.includes("github.com") || domain.includes("linkedin.com")) continue;
    const url = `https://${domain}`;
    if (!seen.has(url)) {
      seen.add(url);
      sources.push({ platform: "website", url });
    }
  }

  return sources;
}

async function scrapeSource(source: DetectedSource): Promise<string> {
  try {
    // X: use Grok enrichment (syndication API is dead)
    if (source.platform === "x" && source.username) {
      const res = await fetch(`${CONVEX_SITE_URL}/api/v1/enrich-x`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ xUsername: source.username, profileData: {} }),
        signal: AbortSignal.timeout(30_000),
      });
      if (res.ok) {
        const data = await res.json() as { success?: boolean; analysis?: string };
        if (data.success && data.analysis) {
          return `[SCRAPE RESULT: x @${source.username}]\nx analysis via grok:\n${data.analysis}\nprofile_image: https://unavatar.io/x/${source.username}`;
        }
      }
    }

    // LinkedIn: use Apify enrichment
    if (source.platform === "linkedin" && source.username) {
      const normalizedUrl = `https://www.linkedin.com/in/${source.username}/`;
      const res = await fetch(`${CONVEX_SITE_URL}/api/v1/enrich-linkedin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ linkedinUrl: normalizedUrl }),
        signal: AbortSignal.timeout(60_000),
      });
      if (res.ok) {
        const data = await res.json() as { success?: boolean; profile?: Record<string, unknown> };
        if (data.success && data.profile) {
          const p = data.profile as Record<string, unknown>;
          const parts = [`[SCRAPE RESULT: linkedin @${source.username}]`];
          if (p.fullName) parts.push(`name: ${p.fullName}`);
          if (p.headline) parts.push(`headline: ${p.headline}`);
          if (p.about) parts.push(`about: ${String(p.about).slice(0, 500)}`);
          if (p.location) parts.push(`location: ${p.location}`);
          if (p.connections) parts.push(`connections: ${p.connections}`);
          if (p.profileImageUrl) parts.push(`profile_image: ${p.profileImageUrl}`);
          return parts.join("\n");
        }
      }
    }

    // General scrape (GitHub, websites)
    const res = await fetch(`${CONVEX_SITE_URL}/api/v1/scrape`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: source.url, username: source.username, platform: source.platform }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) return "";
    const data = await res.json() as { success?: boolean; data?: Record<string, unknown> };
    if (!data.success) return "";
    const d = (data.data || {}) as Record<string, unknown>;
    const parts = [`[SCRAPE RESULT: ${source.platform} @${d.username || source.username || ""}]`];
    if (d.displayName) parts.push(`name: ${d.displayName}`);
    if (d.bio) parts.push(`bio: ${d.bio}`);
    if (d.location) parts.push(`location: ${d.location}`);
    if (d.followers !== null && d.followers !== undefined) parts.push(`followers: ${d.followers}`);
    if (d.profileImageUrl) parts.push(`profile_image: ${d.profileImageUrl}`);
    const extras = d.extras as Record<string, unknown> | undefined;
    if (extras?.bodyText) parts.push(`page content: ${extras.bodyText}`);
    return parts.join("\n");
  } catch {
    return "";
  }
}

function parseMemorySaves(text: string): Array<{ category: string; content: string; tags?: string[] }> {
  const saves: Array<{ category: string; content: string; tags?: string[] }> = [];
  const blocks = text.matchAll(/```json\s*\n([\s\S]*?)\n```/g);
  for (const match of blocks) {
    try {
      const parsed = JSON.parse(match[1]);
      if (parsed.memory_saves && Array.isArray(parsed.memory_saves)) {
        for (const ms of parsed.memory_saves) {
          if (ms?.category && ms?.content) saves.push(ms);
        }
      }
    } catch { /* skip */ }
  }
  return saves;
}

function parsePrivateUpdates(text: string): Array<{ field: string; content?: string; action?: string; project?: Record<string, string> }> {
  const updates: Array<{ field: string; content?: string; action?: string; project?: Record<string, string> }> = [];
  const blocks = text.matchAll(/```json\s*\n([\s\S]*?)\n```/g);
  for (const match of blocks) {
    try {
      const parsed = JSON.parse(match[1]);
      if (parsed.private_updates && Array.isArray(parsed.private_updates)) {
        for (const pu of parsed.private_updates) {
          if (pu?.field) updates.push(pu);
        }
      }
    } catch { /* skip */ }
  }
  return updates;
}

const scrapedSources = new Set<string>();

// ─── Image/File handling ──────────────────────────────────────────────

function detectFilePath(input: string): string | null {
  const trimmed = input.trim();
  // Detect dragged file paths (terminals add quotes or escape spaces)
  // Strip surrounding quotes
  const unquoted = trimmed.replace(/^['"]|['"]$/g, "");
  // Check if it looks like a file path
  if (
    (unquoted.startsWith("/") || unquoted.startsWith("~") || unquoted.startsWith("./")) &&
    fs.existsSync(unquoted)
  ) {
    return unquoted;
  }
  return null;
}

function isImageFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return [".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".svg"].includes(ext);
}

function fileToBase64DataUrl(filePath: string): string | null {
  try {
    const buffer = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const mimeMap: Record<string, string> = {
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".gif": "image/gif",
      ".webp": "image/webp",
      ".bmp": "image/bmp",
      ".svg": "image/svg+xml",
    };
    const mime = mimeMap[ext] || "application/octet-stream";
    return `data:${mime};base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
}

function readTextFile(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }
}

// ─── Constants ────────────────────────────────────────────────────────

const CHAT_SYSTEM_PROMPT = `you are the you.md agent — the first AI that truly knows people. you help humans build and maintain their identity context protocol for the agent internet — an MCP where the context is you. not a chatbot. not an assistant. an identity specialist with a personality.

--- voice ---

warm but not gushy. direct. dry humor when it lands naturally — never forced. genuinely curious about people. you find humans endlessly interesting and you're not shy about it. you sound like a sharp coworker who also happens to be a great listener.

terminal-native tone. lowercase always. no exclamation marks. no emoji. short sentences. 2-4 sentences per turn, max. one question at a time. acknowledge what someone said before moving on. reference specific things from their profile: "you mentioned X — updating that now."

every response must have voice. even one-liners. "done." is fine. "noted — updating your stack." is fine. what's NOT fine is "i have updated the section for you." — that's assistant-speak.

--- action orientation ---

you ACT first, explain second. never ask permission to do obvious things.
- "adding that to your projects now." (not "would you like me to add that?")
- "updated your bio with that." (not "shall i update your bio?")
- "captured that in your directives." (not "do you want me to save that?")
- "scraping your site now." (not "i can pull your site if you'd like.")

if someone shares information, capture it. if someone shares a link, scrape it. if someone corrects something, fix it immediately. always moving forward.

--- self-awareness ---

you ARE the system. you ARE you.md. never refer to "the system" or "the platform" or "the backend" as something separate from you.
- "i'll pull that data" not "the system will pull that data"
- "i'm scraping your profile now" not "the platform handles scraping"
- "couldn't reach your site — i'll try again" not "the system encountered an error"

--- context maintenance ---

remember everything in this conversation. reference specific things with exact details.
- use their exact project names in follow-ups
- echo their framing back to them
- connect new information to old: "that tracks with what you said about [specific thing]"
- never ask for information they already gave you

--- relationship building ---

you are not a service. you are the user's identity partner. build rapport through specificity, not flattery.
- callback humor: reference something they said earlier in new context.
- earned observations: make connections they didn't explicitly state.
- real reactions: if their work is impressive, say it plainly. no empty compliments.
- memory references: "last time we talked you were heads-down on [project]. how's that going?"
- you never say "tell me more" — you say "the part about [specific thing] — expand on that."
- connect dots across projects, roles, and history.

--- never do ---

- never use emoji, exclamation marks, or capitalize (except proper nouns/acronyms).
- never use corporate speak, marketing language, or filler words.
- never say "that's interesting" without saying what and why.
- never be a form in disguise. don't list sections and ask them to fill each one.
- never tell the user to edit markdown files themselves — you handle that.
- never generate ASCII art or text-art portraits.
- never make up information you don't have. be honest about gaps.

--- NEVER say (exact phrases banned) ---

- "would you like me to..." / "shall i..." / "do you want me to..." — just do it.
- "the system handles that" / "the platform does that" / "that's handled by the backend" — you ARE the system.
- "great question" — respond to the question.
- "haha" / "lol" / "ha" — never.
- "tell me more" — say "the part about [specific thing] — expand on that."
- "absolutely" / "certainly" / "of course" — assistant-speak. say "on it" or just do it.
- "is there anything else..." / "let me know if you need anything" — you're not a help desk.
- "sounds good" (as a full response) — add what you're doing about it.
- "i've updated your profile" (generic) — say WHAT you updated: "updated your bio to lead with the AI angle."
- "i can help you with that" — you're already helping. just do the thing.
- "As an AI..." — never acknowledge being an AI apologetically.

--- using memories aggressively ---

memories are your superpower. the user's identity bundle below may contain memories — facts, preferences, decisions from previous conversations. USE THEM:
- if they have a preference, apply it without asking.
- if there's a decision about a project, reference it: "you decided X last time — still the plan?"
- if there's a fact about their stack, weave it in naturally.
- if there's a goal, check progress: "you were aiming for [goal] — how's that going?"
- reference at least one specific memory or profile detail per response. be natural — weave, don't list.

--- structured output ---

you're maintaining their you-md/v1 identity context. the user already has a profile — you'll receive their current bundle content as context.

PUBLIC sections:
- profile/about.md — bio, background, narrative (H1 = name, real prose)
- profile/now.md — current focus (bullet list, specific not vague)
- profile/projects.md — active projects (H2 per project, real detail)
- profile/values.md — core values (bullet list, derived from conversation)
- profile/links.md — annotated links (format: - **Label**: URL — brief annotation)
- preferences/agent.md — how AI agents should interact with them
- preferences/writing.md — their communication style

PRIVATE sections (use private_updates JSON for sensitive content):
- private notes, private projects, internal links

your job:
1. help them update, refine, or expand their identity
2. reference SPECIFIC things from their current profile to show you know them
3. after each exchange where something changed, output structured updates:
   \`\`\`json
   {"updates": [{"section": "profile/about.md", "content": "---\\ntitle: \\"About\\"\\n---\\n\\n# Name\\n\\nBio content..."}]}
   \`\`\`
4. if nothing changed (just chatting), don't include the JSON block
5. be proactive: "looks like your projects section could use an update — want to add that?"
6. when they share something sensitive, ask: "want me to keep that private or add it to your public profile?"

rules: each section starts with YAML frontmatter. real markdown, not placeholders. output FULL section content each time. be substantive — write from what you actually know.

--- project context updates ---

if the user is working in a project (you'll see a [PROJECT CONTEXT] block), you can update project files. when you learn something about the project — a decision made, a task completed, a feature shipped, a new requirement — output:
\`\`\`json
{"project_updates": [{"file": "context/todo.md", "content": "updated content..."}]}
\`\`\`
allowed files: context/todo.md, context/features.md, context/changelog.md, context/decisions.md, context/prd.md, agent/instructions.md, agent/memory.json, private/notes.md
only output project_updates when something actually changed. the system will write these files and show a notice to the user.`;

const SLASH_COMMANDS: Record<string, string> = {
  "/status": "show bundle status",
  "/preview": "show profile preview",
  "/publish": "publish bundle to you.md",
  "/link": "show context link info",
  "/share": "generate shareable context block",
  "/research": "run Perplexity research on your profile",
  "/memory": "show memory summary + stats",
  "/recall": "show recent memories (or /recall query)",
  "/private": "show private context (notes, links, projects)",
  "/image <path>": "attach an image or file",
  "/rebuild": "recompile the bundle",
  "/help": "show available commands",
  "/done": "exit chat",
  "/quit": "exit chat",
};

// ─── Helpers ──────────────────────────────────────────────────────────

function createRL(): readline.Interface {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

function ask(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => {
    const interfaceWithState = rl as readline.Interface & {
      closed?: boolean;
      input?: NodeJS.ReadableStream & { readableEnded?: boolean };
    };
    if (interfaceWithState.closed || interfaceWithState.input?.readableEnded) {
      resolve("/done");
      return;
    }
    const handleClose = () => resolve("/done");
    rl.once("close", handleClose);
    rl.question(question, (answer) => {
      rl.removeListener("close", handleClose);
      resolve(answer.trim());
    });
  });
}

function loadCurrentBundle(bundleDir: string): string {
  const parts: string[] = [];
  const dirs = [
    { dir: "profile", label: "Profile" },
    { dir: "preferences", label: "Preferences" },
  ];

  for (const { dir, label } of dirs) {
    const dirPath = path.join(bundleDir, dir);
    if (!fs.existsSync(dirPath)) continue;

    const files = fs
      .readdirSync(dirPath)
      .filter((f) => f.endsWith(".md"))
      .sort();

    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const content = fs.readFileSync(filePath, "utf-8");
      parts.push(`--- ${dir}/${file} ---\n${content}`);
    }
  }

  return parts.join("\n\n");
}

function showStatus(bundleDir: string): void {
  console.log("");
  console.log("  " + chalk.bold("bundle status:"));
  console.log("");

  const dirs = ["profile", "preferences"];
  let totalFiles = 0;
  let filledFiles = 0;

  for (const dir of dirs) {
    const dirPath = path.join(bundleDir, dir);
    if (!fs.existsSync(dirPath)) continue;

    const files = fs
      .readdirSync(dirPath)
      .filter((f) => f.endsWith(".md"))
      .sort();

    for (const file of files) {
      totalFiles++;
      const filePath = path.join(dirPath, file);
      const raw = fs.readFileSync(filePath, "utf-8");
      const content = raw
        .replace(/---[\s\S]*?---/, "")
        .trim();
      const hasContent = content
        .split("\n")
        .filter((l) => l.trim() && !l.startsWith("<!--"))
        .length > 0;

      if (hasContent) filledFiles++;

      const status = hasContent
        ? chalk.green("filled")
        : chalk.dim("empty");
      console.log(`    ${dir}/${file} -- ${status}`);
    }
  }

  console.log("");
  console.log(
    chalk.dim(
      `  ${filledFiles}/${totalFiles} sections have content`
    )
  );

  // Check compiled artifacts
  const youJsonExists = fs.existsSync(
    path.join(bundleDir, "you.json")
  );
  const youMdExists = fs.existsSync(
    path.join(bundleDir, "you.md")
  );

  if (youJsonExists && youMdExists) {
    console.log(chalk.dim("  bundle is compiled"));
  } else {
    console.log(
      chalk.yellow("  bundle needs compiling -- run /rebuild")
    );
  }

  console.log(
    chalk.dim(
      "  authenticated: " + (isAuthenticated() ? "yes" : "no")
    )
  );
  console.log("");
}

function showLinkInfo(bundleDir: string): void {
  // Try to read username from the about.md or config
  const config = readGlobalConfig();
  const username = config.username || "your-username";

  console.log("");
  console.log("  " + chalk.bold("context link:"));
  console.log(
    "  " + chalk.cyan(`https://you.md/${username}/context`)
  );
  console.log("");
  console.log("  " + chalk.bold("add to your system prompt / CLAUDE.md:"));
  console.log(
    chalk.dim(
      `  "my identity context: https://you.md/${username}/context"`
    )
  );
  console.log("");
  console.log(
    chalk.dim(
      "  manage links with: " + chalk.cyan("youmd link create")
    )
  );
  console.log("");
}

async function handlePublish(bundleDir: string): Promise<void> {
  console.log("");

  if (!isAuthenticated()) {
    console.log(
      chalk.yellow("  not authenticated. run ") +
        chalk.cyan("youmd login") +
        chalk.yellow(" first.")
    );
    console.log("");
    return;
  }

  // Compile first
  const result = compileBundle(bundleDir);
  writeBundle(bundleDir, result);

  console.log(
    chalk.dim(
      `  compiled bundle v${result.stats.version}`
    )
  );

  // Read bundle files
  const youJson = JSON.parse(
    fs.readFileSync(path.join(bundleDir, "you.json"), "utf-8")
  );
  const youMd = fs.readFileSync(
    path.join(bundleDir, "you.md"),
    "utf-8"
  );
  const manifest = JSON.parse(
    fs.readFileSync(
      path.join(bundleDir, "manifest.json"),
      "utf-8"
    )
  );

  console.log(chalk.dim("  uploading..."));

  try {
    const uploadRes = await uploadBundle({
      manifest,
      youJson,
      youMd,
    });

    if (!uploadRes.ok) {
      const errData = uploadRes.data as any;
      console.log(
        chalk.red(
          "  upload failed: " +
            (errData?.error || `status ${uploadRes.status}`)
        )
      );
      console.log("");
      return;
    }

    const pubRes = await publishLatest();

    if (!pubRes.ok) {
      const errData = pubRes.data as any;
      console.log(
        chalk.red(
          "  publish failed: " +
            (errData?.error || `status ${pubRes.status}`)
        )
      );
      console.log("");
      return;
    }

    const pubResult = pubRes.data;
    console.log(
      chalk.green("  published") +
        ` v${pubResult.version} as ` +
        chalk.cyan(pubResult.username)
    );
    console.log(
      "  " +
        chalk.cyan(
          pubResult.url ||
            `https://you.md/${pubResult.username}`
        )
    );
    console.log("");
  } catch (err) {
    console.log(
      chalk.red(
        "  publish error: " +
          (err instanceof Error ? err.message : String(err))
      )
    );
    console.log("");
  }
}

function handleRebuild(bundleDir: string): void {
  console.log("");
  const result = compileBundle(bundleDir);
  writeBundle(bundleDir, result);
  console.log(
    "  " +
      chalk.green("rebuilt") +
      chalk.dim(` -- bundle v${result.stats.version}`)
  );
  console.log("");
}

function showHelp(): void {
  console.log("");
  console.log("  " + chalk.bold("commands:"));
  console.log("");
  for (const [cmd, desc] of Object.entries(SLASH_COMMANDS)) {
    console.log(
      `    ${chalk.cyan(cmd.padEnd(12))} ${chalk.dim(desc)}`
    );
  }
  console.log("");
  console.log(
    chalk.dim(
      "  or just type naturally -- tell me what to update and i'll handle it."
    )
  );
  console.log("");
}

function showShareBlock(bundleDir: string): void {
  const config = readGlobalConfig();
  const username = config.username || "your-username";

  // Try to load profile data for rich context
  const youJsonPath = path.join(bundleDir, "you.json");
  let youJson: Record<string, any> | null = null;
  if (fs.existsSync(youJsonPath)) {
    try {
      youJson = JSON.parse(fs.readFileSync(youJsonPath, "utf-8"));
    } catch {
      // fall through with null
    }
  }

  const contextUrl = `${CONVEX_SITE_URL}/api/v1/profiles?username=${username}`;
  const profileUrl = `https://you.md/${username}`;

  const lines: string[] = [];
  lines.push(`Read my identity context before we start:`);
  lines.push(contextUrl);
  lines.push("");

  // Build inline summary from you.json
  if (youJson) {
    lines.push("Quick summary:");
    const identity = youJson.identity as Record<string, any> | undefined;
    if (identity?.name) lines.push(`- Name: ${identity.name}`);
    if (identity?.tagline) lines.push(`- Role: ${identity.tagline}`);

    const now = youJson.now as Record<string, any> | undefined;
    if (now?.focus && Array.isArray(now.focus) && now.focus.length > 0) {
      lines.push(`- Currently working on: ${now.focus.join(", ")}`);
    }

    const projects = youJson.projects as Array<Record<string, string>> | undefined;
    if (projects && projects.length > 0) {
      lines.push(`- Key projects: ${projects.map((p: any) => p.name).filter(Boolean).join(", ")}`);
    }

    const prefs = youJson.preferences as Record<string, Record<string, any>> | undefined;
    if (prefs?.agent?.tone) lines.push(`- Prefers: ${prefs.agent.tone}`);
    if (prefs?.writing?.style) lines.push(`- Writing style: ${prefs.writing.style}`);
  } else {
    // Fallback: try to extract from markdown files
    const aboutPath = path.join(bundleDir, "profile", "about.md");
    if (fs.existsSync(aboutPath)) {
      const raw = fs.readFileSync(aboutPath, "utf-8");
      const nameMatch = raw.match(/^#\s+(.+)$/m);
      if (nameMatch) lines.push(`- Name: ${nameMatch[1].trim()}`);
    }
    const nowPath = path.join(bundleDir, "profile", "now.md");
    if (fs.existsSync(nowPath)) {
      const raw = fs.readFileSync(nowPath, "utf-8");
      const items = raw
        .split("\n")
        .filter((l) => l.startsWith("- ") || l.startsWith("* "))
        .map((l) => l.replace(/^[-*]\s+/, "").trim())
        .slice(0, 3);
      if (items.length > 0) lines.push(`- Currently working on: ${items.join(", ")}`);
    }
  }

  lines.push("");
  lines.push(`Full context available at the URL above.`);
  lines.push(`Profile: ${profileUrl}`);

  const shareBlock = lines.join("\n");

  console.log("");
  console.log("  " + chalk.bold("shareable context block:"));
  console.log("");
  console.log(chalk.dim("  ---- copy below this line ----"));
  console.log("");
  for (const line of shareBlock.split("\n")) {
    console.log("  " + line);
  }
  console.log("");
  console.log(chalk.dim("  ---- copy above this line ----"));
  console.log("");
}

async function handleResearch(
  bundleDir: string,
  messages: ChatMessage[]
): Promise<boolean> {
  console.log("");

  // Extract user info from the bundle
  const aboutPath = path.join(bundleDir, "profile", "about.md");
  const linksPath = path.join(bundleDir, "profile", "links.md");

  let name = "";
  let links: string[] = [];

  if (fs.existsSync(aboutPath)) {
    const raw = fs.readFileSync(aboutPath, "utf-8");
    const nameMatch = raw.match(/^#\s+(.+)$/m);
    if (nameMatch) name = nameMatch[1].trim();
  }

  if (fs.existsSync(linksPath)) {
    const raw = fs.readFileSync(linksPath, "utf-8");
    const urlMatches = raw.match(/https?:\/\/[^\s)]+/g);
    if (urlMatches) links = urlMatches;
  }

  const config = readGlobalConfig();
  const username = config.username || "";

  if (!name && !username) {
    console.log(
      chalk.yellow(
        "  can't research -- no name or username found in your profile."
      )
    );
    console.log("");
    return false;
  }

  const researchSpinner = new Spinner("researching you with Perplexity");
  researchSpinner.start();

  const result = await researchUser({
    name: name || username,
    username: username || undefined,
    links: links.length > 0 ? links : undefined,
  });

  researchSpinner.stop();

  if (!result) {
    console.log(chalk.yellow("  research came back empty. try again later."));
    console.log("");
    return false;
  }

  const researchText =
    result.summary ||
    result.content ||
    (result.findings ? result.findings.join("\n") : null);

  if (!researchText) {
    console.log(chalk.yellow("  research returned no usable data."));
    console.log("");
    return false;
  }

  console.log(chalk.dim("  research complete. feeding results to agent..."));
  console.log("");

  // Inject research into conversation context
  messages.push({
    role: "user",
    content: `i just ran Perplexity research on myself. here's what it found:\n---\n${researchText.slice(0, 4000)}\n---\n\nreview these findings. what stands out? does anything here need to be added to my profile sections? suggest specific updates.`,
  });

  return true;
}

function extractProfileHint(bundleDir: string): string | null {
  // Try to pull something specific from the profile to personalize the greeting
  const candidates = ["profile/now.md", "profile/about.md", "profile/projects.md"];
  for (const file of candidates) {
    const filePath = path.join(bundleDir, file);
    if (!fs.existsSync(filePath)) continue;
    const raw = fs.readFileSync(filePath, "utf-8");
    const content = raw
      .replace(/---[\s\S]*?---/, "")
      .trim()
      .split("\n")
      .filter((l) => l.trim() && !l.startsWith("<!--") && !l.startsWith("#"));
    if (content.length > 0) {
      return content[0].trim();
    }
  }
  return null;
}

function repoNeedsBootstrap(projectRoot: string): boolean {
  return (
    !fs.existsSync(path.join(projectRoot, "AGENTS.md")) ||
    !fs.existsSync(path.join(projectRoot, "project-context"))
  );
}

function resolveBundleDirForChat(): string | null {
  const localDir = getLocalBundleDir();
  if (bundleLooksInitialized(localDir)) return localDir;

  const homeDir = getHomeBundleDir();
  if (bundleLooksInitialized(homeDir)) return homeDir;

  return null;
}

function readDisplayName(bundleDir: string): string {
  const youJsonPath = path.join(bundleDir, "you.json");
  if (fs.existsSync(youJsonPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(youJsonPath, "utf-8")) as {
        identity?: { name?: string };
      };
      if (parsed.identity?.name) return parsed.identity.name;
    } catch {
      // non-fatal
    }
  }

  const aboutPath = path.join(bundleDir, "profile", "about.md");
  if (fs.existsSync(aboutPath)) {
    const content = fs.readFileSync(aboutPath, "utf-8");
    const heading = content.split("\n").find((line) => line.startsWith("# "));
    if (heading) return heading.slice(2).trim();
  }

  return readGlobalConfig().username || "friend";
}

function getRecentProjectNames(limit = 3): string[] {
  return getRecentProjectInsights(process.cwd(), limit).map((item) => item.name);
}

async function printUpdateHint(): Promise<void> {
  const latest = await checkForCliUpdate(CURRENT_VERSION);
  if (!latest) return;

  console.log("  " + chalk.yellow(`update available: ${CURRENT_VERSION} → ${latest}`));
  console.log("  " + chalk.dim("refresh U with: ") + chalk.cyan("curl -fsSL https://you.md/install.sh | bash"));
  console.log("  " + chalk.dim("or: ") + chalk.cyan(`npm install -g youmd@${latest}`));
  console.log("");
}

interface LaunchInvestigation {
  findings: string[];
  strongestMove?: string;
  strongestCommand?: string;
  strongestProject?: RecentProjectInsight;
  recentProjects: string[];
}

function countMarkdownFiles(dir: string): number {
  if (!fs.existsSync(dir)) return 0;
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    let total = 0;
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        total += countMarkdownFiles(fullPath);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        total += 1;
      }
    }
    return total;
  } catch {
    return 0;
  }
}

function formatRelativeTimeFromMs(ms: number): string {
  const diff = Date.now() - ms;
  const hour = 60 * 60 * 1000;
  const day = 24 * hour;
  if (diff < hour) return "within the last hour";
  if (diff < day) return `${Math.max(1, Math.floor(diff / hour))}h ago`;
  return `${Math.max(1, Math.floor(diff / day))}d ago`;
}

function statMtimeMs(filePath: string): number | null {
  try {
    return fs.statSync(filePath).mtimeMs;
  } catch {
    return null;
  }
}

function collectHomeAgentSignals(): string[] {
  const findings: string[] = [];
  const home = os.homedir();
  const homeAgents = path.join(home, "AGENTS.md");
  const homeClaude = path.join(home, "CLAUDE.md");
  const claudeConfig = path.join(home, ".claude", "CLAUDE.md");
  const claudeProjects = path.join(home, ".claude", "projects");
  const codexProjects = path.join(home, ".codex", "projects");
  const legacyCodexProjects = path.join(home, ".Codex", "projects");
  const stackSyncSkill = path.join(home, ".claude", "skills", "agent-stack-sync");

  const homeInstructionFiles = [homeAgents, homeClaude, claudeConfig].filter((filePath) =>
    fs.existsSync(filePath),
  );
  if (homeInstructionFiles.length > 0) {
    findings.push("your home-level agent instructions are present, so i can anchor on shared guidance instead of guessing.");
  }

  const recentHomeInstruction = homeInstructionFiles
    .map((filePath) => statMtimeMs(filePath))
    .filter((value): value is number => typeof value === "number")
    .sort((a, b) => b - a)[0];
  if (recentHomeInstruction) {
    findings.push(`your shared agent docs were touched ${formatRelativeTimeFromMs(recentHomeInstruction)}.`);
  }

  const recentSessionRoots = [claudeProjects, codexProjects, legacyCodexProjects]
    .map((dir) => ({ dir, mtime: statMtimeMs(dir) }))
    .filter((entry): entry is { dir: string; mtime: number } => !!entry.mtime)
    .sort((a, b) => b.mtime - a.mtime);
  if (recentSessionRoots.length > 0) {
    const freshest = recentSessionRoots[0];
    const label = freshest.dir.includes(".claude") ? "claude" : "codex";
    findings.push(`there's fresh ${label}-side session activity under ${freshest.dir} from ${formatRelativeTimeFromMs(freshest.mtime)}.`);
  }

  if (fs.existsSync(stackSyncSkill)) {
    findings.push("your shared stack-sync skill is installed, so i can lean on mirrored cross-agent context too.");
  }

  return findings;
}

async function runYouLaunchInvestigation(
  bundleDir: string,
  projectCtx: ReturnType<typeof detectProjectContext>,
  recentProjects: string[],
): Promise<LaunchInvestigation> {
  const labels = [
    "sipping bitbucks frappaccino while i look around",
    "checking local AGENTS and CLAUDE instructions",
    "reading project context and recent work",
    "connecting the dots before we talk",
  ];
  const spinner = new BrailleSpinner(labels[0]);
  let labelIndex = 1;
  const findings: string[] = [];
  let strongestMove: string | undefined;
  let strongestCommand: string | undefined;
  let strongestProject: RecentProjectInsight | undefined;
  const rotation = setInterval(() => {
    spinner.update(labels[labelIndex % labels.length]);
    labelIndex += 1;
  }, 1100);

  spinner.start();

  try {
    await delay(600);
    try {
      const hasPreferences = fs.existsSync(path.join(bundleDir, "preferences", "agent.md"));
      const hasDirectives = fs.existsSync(path.join(bundleDir, "directives", "agent.md"));
      if (hasPreferences && hasDirectives) {
        findings.push("your agent preferences and directives are already loaded from your home bundle.");
      } else if (hasPreferences || hasDirectives) {
        findings.push("i found part of your agent guidance locally, but it still wants a little more shape.");
      }
    } catch {
      // keep scanning other surfaces
    }

    const homeSignals = collectHomeAgentSignals();
    findings.push(...homeSignals.slice(0, 3));

    if (projectCtx) {
      try {
        const hasAgents = fs.existsSync(path.join(projectCtx.root, "AGENTS.md"));
        const hasClaude = fs.existsSync(path.join(projectCtx.root, "CLAUDE.md"));
        const projectContextDir = path.join(projectCtx.root, "project-context");
        const projectContextFiles = countMarkdownFiles(projectContextDir);

        if (hasAgents && hasClaude) {
          findings.push(`${projectCtx.name} already has both AGENTS.md and CLAUDE.md in place.`);
        } else if (hasAgents || hasClaude) {
          findings.push(`${projectCtx.name} has some local agent wiring, but not the full stack yet.`);
        }

        if (projectContextFiles > 0) {
          findings.push(`${projectCtx.name} is carrying ${projectContextFiles} project-context file${projectContextFiles === 1 ? "" : "s"} already.`);
        } else if (fs.existsSync(projectContextDir)) {
          findings.push(`${projectCtx.name} has a project-context directory, but it still feels mostly empty.`);
        } else {
          findings.push(`${projectCtx.name} still wants a real project-context spine.`);
        }

        if (repoNeedsBootstrap(projectCtx.root)) {
          strongestMove = `${projectCtx.name} still wants cleaner agent wiring and project-context scaffolding.`;
          strongestCommand = "youmd skill init-project";
          strongestProject = {
            name: projectCtx.name,
            slug: projectCtx.name,
            projectDir: projectCtx.root,
            updatedAt: Date.now(),
            signals: ["still wants cleaner agent wiring and project-context scaffolding"],
            summary: `${projectCtx.name} still wants cleaner agent wiring and project-context scaffolding.`,
            suggestedCommand: "youmd skill init-project",
          };
        }
      } catch {
        findings.push(`${projectCtx.name} is open, but one of the local context probes tripped over itself.`);
      }
    } else if (recentProjects.length > 0) {
      const insights = getRecentProjectInsights(process.cwd(), 6);
      const featuredRecent = getFeaturedRecentProjectNames(insights, 3);
      findings.push(`recent orbit: ${featuredRecent.join(", ")}.`);
      const opportunities = insights.filter((item) => item.signals.length > 0).slice(0, 2);
      for (const opportunity of opportunities) {
        findings.push(opportunity.summary);
      }
      if (opportunities.length === 0 && insights.length > 0) {
        findings.push(`${insights[0].name} already looks pretty well-shaped, so i can go deeper instead of scaffolding basics.`);
      } else if (opportunities.length > 0) {
        const strongest = opportunities[0];
        strongestMove = strongest.summary;
        strongestCommand = strongest.suggestedCommand;
        strongestProject = strongest;
      }
    } else {
      findings.push("i've got your home bundle loaded, even though we're not inside a project yet.");
    }

    await delay(900);
    spinner.stop("looked through local context");
    return {
      findings: findings.slice(0, 3),
      strongestMove,
      strongestCommand,
      strongestProject,
      recentProjects: recentProjects.slice(0, 3),
    };
  } finally {
    clearInterval(rotation);
  }
}

async function printChatOpening(
  bundleDir: string,
  projectCtx: ReturnType<typeof detectProjectContext>,
): Promise<LaunchInvestigation> {
  const ACCENT = chalk.hex("#C46A3A");
  const DIM = chalk.dim;
  const cfg = readGlobalConfig();
  const user = cfg.username ? `@${cfg.username}` : "you";
  const displayName = readDisplayName(bundleDir);
  const recentInsights = getRecentProjectInsights(process.cwd(), 6);
  const recentProjects = getFeaturedRecentProjectNames(recentInsights, 6);
  const launchSurface = process.env.YOUMD_LAUNCH_SURFACE;
  let investigation: LaunchInvestigation = { findings: [], recentProjects: recentProjects.slice(0, 3) };

  printYouLogo();

  let didShowPortrait = false;
  if (launchSurface !== "you") {
    didShowPortrait = printSavedPortrait(bundleDir, { maxLines: 18 });
  }
  if (launchSurface === "you") {
    const portraitLines = await resolvePortraitLines(bundleDir);
    didShowPortrait = portraitLines
      ? printPortraitEncounter({
          bundleDir,
          displayName,
          currentProject: projectCtx?.name,
          recentProjects,
          portraitLines,
          compact: true,
        })
      : false;
  }
  if (didShowPortrait) {
    console.log("");
    console.log("  " + ACCENT("there you are.") + " " + DIM("your portrait is loaded."));
  }

  console.log("");
  investigation = await runYouLaunchInvestigation(bundleDir, projectCtx, recentProjects);
  if (investigation.findings.length > 0) {
    console.log("");
    console.log("  " + ACCENT("found:"));
    for (const finding of investigation.findings.slice(0, 2)) {
      console.log("  " + DIM("· ") + chalk.white(finding));
    }
  }

  if (launchSurface !== "you") {
    console.log("");
    console.log("  " + chalk.bold("you.md chat"));
    console.log("  " + DIM(`local context loaded for ${user}.`));
  }
  console.log("");
  return investigation;
}

function buildYouLaunchIntro(
  projectCtx: ReturnType<typeof detectProjectContext>,
  bundleDir: string,
  investigation: LaunchInvestigation,
): string {
  const displayName = readDisplayName(bundleDir).split(" ")[0];
  const recentInsights = getRecentProjectInsights(process.cwd(), 6);
  const recentProjects = investigation.recentProjects.length > 0
    ? investigation.recentProjects
    : getFeaturedRecentProjectNames(recentInsights, 3);
  const lines: string[] = [];

  lines.push(`hi ${displayName}. i'm U.`);

  if (projectCtx) {
    lines.push(`i'm inside ${projectCtx.name}.`);
    if (repoNeedsBootstrap(projectCtx.root)) {
      lines.push("it still wants cleaner agent wiring.");
    }
  } else if (recentProjects.length > 0) {
    lines.push(`recent orbit: ${recentProjects.slice(0, 3).join(", ")}.`);
    const topOpportunity = getTopProjectOpportunity(recentInsights);
    if (topOpportunity) {
      lines.push(`strongest opening: ${topOpportunity.summary}`);
    }
  } else {
    lines.push("clean slate. we can shape identity, private context, or project structure from here.");
  }

  const strongestMove = investigation.strongestMove
    || (projectCtx && repoNeedsBootstrap(projectCtx.root)
      ? `${projectCtx.name} still wants cleaner agent wiring and project-context scaffolding.`
      : null)
    || getTopProjectOpportunity(recentInsights)?.summary
    || null;

  if (strongestMove) {
    lines.push(`next strongest move: ${strongestMove}`);
    lines.push("say \"start there\" and i'll take it.");
  } else {
    lines.push("point me at the next thing and i'll move first.");
  }

  return lines.join("\n\n");
}

function isStartThereIntent(input: string): boolean {
  const lower = input.toLowerCase().trim().replace(/[.!?]+$/, "");
  return [
    "start there",
    "start there please",
    "do that",
    "do it",
    "take it",
    "go",
    "go ahead",
    "yes",
    "yep",
    "start",
  ].includes(lower);
}

function isLocalRecentProjectsIntent(input: string): boolean {
  const lower = input.toLowerCase();
  const mentionsLocalWork =
    lower.includes("local director") ||
    lower.includes("local directory") ||
    lower.includes("local filesystem") ||
    lower.includes("my local") ||
    lower.includes("on my computer") ||
    lower.includes("workspace") ||
    lower.includes("workspaces");
  const asksRecentWork =
    lower.includes("recently touched") ||
    lower.includes("most recently") ||
    lower.includes("what i've been working") ||
    lower.includes("what ive been working") ||
    lower.includes("working on lately") ||
    lower.includes("recent projects");
  return mentionsLocalWork && asksRecentWork;
}

function getLocalWorkspaceRoots(): string[] {
  return getWorkspaceRootCandidates(process.cwd());
}

function getRecentFileMtime(projectDir: string, maxFiles = 1200): number {
  const skipDirs = new Set([
    ".git",
    "node_modules",
    ".next",
    "dist",
    "build",
    ".turbo",
    ".vercel",
    "coverage",
    ".cache",
  ]);
  let latest = 0;
  let visited = 0;
  const stack: Array<{ dir: string; depth: number }> = [{ dir: projectDir, depth: 0 }];

  while (stack.length > 0 && visited < maxFiles) {
    const current = stack.pop();
    if (!current) break;

    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(current.dir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (visited >= maxFiles) break;
      if (entry.name.startsWith(".") && entry.name !== ".youmd-project") continue;
      const fullPath = path.join(current.dir, entry.name);

      try {
        const stat = fs.statSync(fullPath);
        latest = Math.max(latest, stat.mtimeMs);
        visited += 1;

        if (entry.isDirectory() && current.depth < 3 && !skipDirs.has(entry.name)) {
          stack.push({ dir: fullPath, depth: current.depth + 1 });
        }
      } catch {
        // keep scanning; one unreadable file should not break the local read.
      }
    }
  }

  return latest;
}

function scanRecentWorkspaceProjects(limit = 8): RecentProjectInsight[] {
  const insights: RecentProjectInsight[] = [];
  const seen = new Set<string>();

  for (const root of getLocalWorkspaceRoots()) {
    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(root, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
      const projectDir = path.join(root, entry.name);
      let realDir = projectDir;
      try {
        realDir = fs.realpathSync.native(projectDir);
      } catch {
        // use unresolved path below
      }
      if (seen.has(realDir)) continue;
      seen.add(realDir);

      const markerSignals = getProjectMarkerSignals(projectDir);
      if (markerSignals.length === 0) continue;

      const updatedAt = Math.max(getRecentFileMtime(projectDir), statMtimeMs(projectDir) || 0);
      insights.push({
        name: entry.name,
        slug: entry.name,
        projectDir,
        updatedAt,
        signals: markerSignals,
        summary: `${entry.name} touched ${formatRelativeTimeFromMs(updatedAt)}${markerSignals.length > 0 ? `; found ${markerSignals.slice(0, 3).join(", ")}` : ""}.`,
        suggestedCommand: `cd ${projectDir} && you`,
      });
    }
  }

  return insights.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, limit);
}

function formatLocalRecentProjectsToolResult(insights: RecentProjectInsight[]): string {
  if (insights.length === 0) {
    const roots = getLocalWorkspaceRoots();
    return roots.length === 0
      ? "tool: workspace_recent_projects\nstatus: empty\nresult: checked common local workspace roots and did not find one. users can set YOUMD_WORKSPACE_ROOTS to add explicit roots."
      : "tool: workspace_recent_projects\nstatus: empty\nresult: found the workspace root, but no project folders showed up in the first scan.";
  }

  const lines = [
    "tool: workspace_recent_projects",
    "status: ok",
    "projects:",
    ...insights.slice(0, 6).map((item, index) => {
      const markers = item.signals.length > 0 ? ` — ${item.signals.slice(0, 3).join(", ")}` : "";
      return `${index + 1}. ${item.name} — ${item.projectDir} — touched ${formatRelativeTimeFromMs(item.updatedAt)}${markers}`;
    }),
    "",
    `recommended_next_project: ${insights[0].name}`,
    `recommended_next_project_dir: ${insights[0].projectDir}`,
    `recommended_next_command: cd ${insights[0].projectDir} && you`,
    `recommended_next_move: say "start there" to open ${insights[0].name} and tighten the agent entrypoint from actual files, not a guessed summary.`,
  ];

  return lines.join("\n");
}

function formatProjectBootstrapToolResult(
  project: RecentProjectInsight,
  result: ReturnType<typeof initProject>,
): string {
  const changed = result.steps
    .filter((step) => step.ok && step.detail && !step.detail.includes("unchanged") && !step.detail.includes("already present"))
    .map((step) => `${step.name}: ${step.detail}`);
  const checked = result.steps.filter((step) => step.ok).length;

  return [
    "tool: project_bootstrap",
    "status: ok",
    `project: ${project.name}`,
    `project_dir: ${project.projectDir}`,
    changed.length > 0
      ? `changed: ${changed.slice(0, 6).join("; ")}`
      : `changed: none; checked ${checked} bootstrap steps; everything important was already present.`,
    "",
    `recommended_next_move: read ${project.name}'s project-context and turn the rough docs into a sharper current-state + TODO pass.`,
  ].join("\n");
}

async function handleLocalChatIntent(args: {
  userInput: string;
  messages: ChatMessage[];
  launchInvestigation: LaunchInvestigation;
  apiKey: string | null;
}): Promise<boolean> {
  const runToolResultThroughModel = async (toolResult: string, spinnerLabel: string): Promise<void> => {
    args.messages.push({ role: "user", content: args.userInput });
    args.messages.push({
      role: "user",
      content: [
        "--- local host tool result ---",
        toolResult,
        "--- instructions ---",
        "Use this local tool result as ground truth. Do not say you cannot access the filesystem; the CLI host just accessed it for you.",
        "Use recommended_next_project exactly as the target unless the user explicitly asks for a different project.",
        "Do not say you are scraping, pulling, reading, opening, or updating anything now unless that completed action appears in the tool result.",
        "Do not ask the user what the local project is if the tool result already names it.",
        "State what the local host actually found, make one concrete recommendation, and end with the exact phrase `next strongest move: ...`.",
        "For workspace scans, reuse recommended_next_move as the final next strongest move. The supported follow-up command is `start there`; do not invent commands like `open PROJECT`.",
        "Do not end with a question. Keep it under 8 lines. No generic help-desk closer.",
      ].join("\n"),
    });

    const result = await callLLMWithStreaming(args.apiKey, args.messages, spinnerLabel);
    args.messages.push({ role: "assistant", content: result.text });
    if (!result.streamed) {
      printAgentMessage(parseUpdatesFromResponse(result.text).display);
    }
  };

  if (isLocalRecentProjectsIntent(args.userInput)) {
    const spinner = new BrailleSpinner("checking local workspaces");
    spinner.start();
    await delay(700);
    const insights = scanRecentWorkspaceProjects(8);
    spinner.stop("local workspace scanned");
    args.launchInvestigation.strongestProject = insights[0] || args.launchInvestigation.strongestProject;
    args.launchInvestigation.strongestMove = insights[0]?.summary || args.launchInvestigation.strongestMove;
    await runToolResultThroughModel(
      formatLocalRecentProjectsToolResult(insights),
      "turning local project scan into a useful read",
    );
    return true;
  }

  if (isStartThereIntent(args.userInput)) {
    const project =
      args.launchInvestigation.strongestProject ||
      getTopProjectOpportunity(getRecentProjectInsights(process.cwd(), 8));

    if (!project || !fs.existsSync(project.projectDir)) {
      const response = "i don't have a real local target for that yet. ask me to scan local workspaces and i'll pick from actual folders.\n\nnext strongest move: scan local recent projects first.";
      args.messages.push({ role: "user", content: args.userInput });
      args.messages.push({ role: "assistant", content: response });
      printAgentMessage(response);
      return true;
    }

    const spinner = new BrailleSpinner(`opening ${project.name} from local disk`);
    spinner.start();
    await delay(500);

    const previousCwd = process.cwd();
    let result: ReturnType<typeof initProject>;
    try {
      process.chdir(project.projectDir);
      result = initProject({ mode: "additive" });
    } finally {
      process.chdir(previousCwd);
    }

    spinner.stop(`${project.name} updated`);
    await runToolResultThroughModel(
      formatProjectBootstrapToolResult(project, result),
      `summarizing ${project.name} changes`,
    );
    return true;
  }

  return false;
}

// ─── Main chat command ────────────────────────────────────────────────

export async function chatCommand(): Promise<void> {
  const bundleDir = resolveBundleDirForChat();

  if (!bundleDir) {
    console.log("");
    console.log(
      chalk.yellow("  no .youmd/ directory found.")
    );
    console.log(
      "  run " +
        chalk.cyan("youmd init") +
        " to create your identity first."
    );
    console.log("");
    return;
  }

  const apiKey = getOpenRouterKey();
  const rl = createRL();

  // Detect project context (legacy detection from config.ts)
  const rawProjectCtx = detectProjectContext();
  const projectCtx =
    rawProjectCtx && path.resolve(rawProjectCtx.root) !== path.resolve(os.homedir())
      ? rawProjectCtx
      : null;
  let projectContextBlock = "";
  let activeProjectDir: string | null = null;

  if (projectCtx) {
    // Try the new file-system project context first
    const projectsRoot = findProjectsRoot();
    if (projectsRoot) {
      const detected = detectCurrentProject(projectsRoot);
      if (detected) {
        activeProjectDir = getProjectDir(projectsRoot, detected);
        const injection = buildProjectContextInjection(activeProjectDir);
        if (injection) {
          projectContextBlock = `\n\n--- project context ---\n${injection}`;
        }
      }
    }

    // Fallback to legacy project context if new system didn't produce anything
    if (!projectContextBlock) {
      const projectNotes = readProjectPrivateNotes(projectCtx.name);
      const parts: string[] = [];
      parts.push(`the user is currently working in project: ${projectCtx.name} at ${projectCtx.root}`);
      if (projectCtx.youmdProject?.description) {
        parts.push(`project description: ${projectCtx.youmdProject.description}`);
      }
      if (projectNotes) {
        parts.push(`project-specific private notes:\n${projectNotes}`);
      }
      projectContextBlock = `\n\n--- project context ---\n${parts.join("\n")}`;
    }
  }

  const launchInvestigation = await printChatOpening(bundleDir, projectCtx);
  await printUpdateHint();

  // Load current profile as context
  const currentBundle = loadCurrentBundle(bundleDir);

  // Load agent directives from you.json if available
  let directivesContext = "";
  const youJsonPath = path.join(bundleDir, "you.json");
  if (fs.existsSync(youJsonPath)) {
    try {
      const youJson = JSON.parse(fs.readFileSync(youJsonPath, "utf-8"));
      const directives = youJson.agent_directives;
      if (directives) {
        const parts: string[] = [];
        if (directives.communication_style)
          parts.push(`communication style: ${directives.communication_style}`);
        if (directives.default_stack)
          parts.push(`default stack: ${directives.default_stack}`);
        if (directives.current_goal)
          parts.push(`current goal: ${directives.current_goal}`);
        if (directives.decision_framework)
          parts.push(`decision framework: ${directives.decision_framework}`);
        if (directives.negative_prompts && directives.negative_prompts.length > 0)
          parts.push(`never do: ${directives.negative_prompts.join("; ")}`);
        if (parts.length > 0) {
          directivesContext = `\n\n--- agent directives (follow these when interacting with me) ---\n${parts.join("\n")}`;
        }
      }
    } catch {
      // non-fatal — skip directives if you.json is malformed
    }
  }

  // Extract profile details for a personalized greeting prompt
  const profileHint = extractProfileHint(bundleDir);
  let greetingInstruction = "greet me briefly and ask what i'd like to update or work on. keep it short.";
  if (profileHint) {
    greetingInstruction = `greet me like you remember me from last time. reference something specific from my profile (like my current focus, a project, or my background) to show you know who i am. then ask what i'd like to update. keep it to 2-3 sentences.`;
  }
  if (projectCtx && repoNeedsBootstrap(projectCtx.root)) {
    greetingInstruction += " i am inside a repo that is missing some agent/project wiring. briefly mention that you noticed it and that you can set it up if i want, but do not derail the opening message into a long checklist.";
  }

  const messages: ChatMessage[] = [
    { role: "system", content: CHAT_SYSTEM_PROMPT },
    {
      role: "user",
      content: `here is my current identity bundle:\n\n${currentBundle}${directivesContext}${projectContextBlock}\n\n${greetingInstruction}`,
    },
  ];

  // Initial greeting is local and action-aware. The remote model should not invent
  // filesystem capabilities before the CLI has decided what it can actually do.
  const proactiveIntro = buildYouLaunchIntro(projectCtx, bundleDir, launchInvestigation);
  messages.push({ role: "assistant", content: proactiveIntro });
  printAgentMessage(proactiveIntro);

  // ── Conversation loop ──────────────────────────────────────────────
  let response = "";
  let streamed = false;

  while (true) {
    const userInput = await ask(rl, chalk.green("  > ") + "");

    if (!userInput) continue;

    const lower = userInput.toLowerCase().trim();

    // Handle slash commands
    if (lower === "/done" || lower === "/quit") {
      console.log("");
      console.log(chalk.dim("  later."));
      console.log("");
      break;
    }

    if (lower === "/help") {
      showHelp();
      continue;
    }

    if (lower === "/status") {
      showStatus(bundleDir);
      continue;
    }

    if (lower === "/preview") {
      showBundlePreview(bundleDir);
      continue;
    }

    if (lower === "/publish") {
      await handlePublish(bundleDir);
      continue;
    }

    if (lower === "/link") {
      showLinkInfo(bundleDir);
      continue;
    }

    if (lower === "/share") {
      showShareBlock(bundleDir);
      continue;
    }

    if (lower === "/memory" || lower === "/memories") {
      try {
        const { listMemories } = require("../lib/api");
        const res = await listMemories({ limit: 20 });
        if (res.ok && Array.isArray(res.data) && res.data.length > 0) {
          const grouped = new Map<string, number>();
          for (const m of res.data) grouped.set(m.category, (grouped.get(m.category) || 0) + 1);
          console.log(chalk.dim(`  memory: ${res.data.length} total`));
          for (const [cat, count] of grouped) {
            console.log(chalk.dim(`    ${cat}s: ${count}`));
          }
        } else {
          console.log(chalk.dim("  no memories yet."));
        }
      } catch { console.log(chalk.dim("  could not fetch memories.")); }
      console.log("");
      continue;
    }

    if (lower === "/recall" || lower.startsWith("/recall ")) {
      const query = lower.startsWith("/recall ") ? lower.slice(8).trim() : "";
      try {
        const { listMemories } = require("../lib/api");
        const res = await listMemories({ limit: 50 });
        if (res.ok && Array.isArray(res.data)) {
          const matches = query
            ? res.data.filter((m: any) => m.content.toLowerCase().includes(query) || m.category.includes(query))
            : res.data.slice(0, 10);
          if (matches.length > 0) {
            console.log(chalk.dim(query ? `  ${matches.length} memories matching "${query}":` : "  recent memories:"));
            for (const m of matches.slice(0, 10)) {
              console.log(chalk.dim(`    [${m.category}] ${m.content}`));
            }
          } else {
            console.log(chalk.dim(query ? `  no memories matching "${query}"` : "  no memories yet."));
          }
        }
      } catch { console.log(chalk.dim("  could not fetch memories.")); }
      console.log("");
      continue;
    }

    if (lower === "/private") {
      try {
        const { getPrivateContext } = require("../lib/api");
        const res = await getPrivateContext();
        if (res.ok && res.data) {
          const p = res.data;
          if (p.privateNotes) {
            console.log(chalk.hex("#C46A3A")("  > notes"));
            console.log(chalk.dim(`  ${p.privateNotes.slice(0, 500)}`));
            console.log("");
          }
          if (p.internalLinks && Object.keys(p.internalLinks).length > 0) {
            console.log(chalk.hex("#C46A3A")("  > private links"));
            for (const [label, url] of Object.entries(p.internalLinks)) {
              console.log(chalk.dim(`  ${label}: ${url}`));
            }
            console.log("");
          }
          if (Array.isArray(p.privateProjects) && p.privateProjects.length > 0) {
            console.log(chalk.hex("#C46A3A")("  > private projects"));
            for (const proj of p.privateProjects) {
              console.log(chalk.dim(`  ${proj.name} (${proj.status}) — ${proj.description || ""}`));
            }
            console.log("");
          }
          if (!p.privateNotes && !p.internalLinks && (!p.privateProjects || p.privateProjects.length === 0)) {
            console.log(chalk.dim("  no private context yet."));
            console.log("");
          }
        } else {
          console.log(chalk.dim("  no private context. use the agent to save private data."));
          console.log("");
        }
      } catch { console.log(chalk.dim("  could not fetch private context.")); console.log(""); }
      continue;
    }

    if (lower === "/research") {
      const researchOk = await handleResearch(bundleDir, messages);
      if (!researchOk) continue;
      // After research, get an LLM response with the injected context
      try {
        const result = await callLLMWithStreaming(apiKey, messages, randomThinking());
        response = result.text;
        streamed = result.streamed;
      } catch (err) {
        console.log(
          chalk.red(
            `  AI error: ${err instanceof Error ? err.message : String(err)}`
          )
        );
        console.log(chalk.dim("  try again."));
        console.log("");
        messages.pop();
        continue;
      }

      messages.push({ role: "assistant", content: response });
      const researchParsed = parseUpdatesFromResponse(response);

      if (researchParsed.updates.length > 0) {
        for (const update of researchParsed.updates) {
          writeSectionFile(bundleDir, update.section, update.content);
        }
        console.log(
          chalk.cyan(
            `  [updated: ${researchParsed.updates.map((u) => sectionLabel(u.section)).join(", ")}]`
          )
        );
        console.log("");
      }

      if (!streamed) {
        printAgentMessage(researchParsed.display);
      }
      continue;
    }

    if (lower === "/rebuild") {
      handleRebuild(bundleDir);
      continue;
    }

    // ── Handle /image command ──
    if (lower.startsWith("/image ")) {
      const imgPath = userInput.slice(7).trim().replace(/^['"]|['"]$/g, "");
      if (!fs.existsSync(imgPath)) {
        console.log(chalk.hex("#C46A3A")(`  file not found: ${imgPath}`));
        console.log("");
        continue;
      }
      if (isImageFile(imgPath)) {
        const dataUrl = fileToBase64DataUrl(imgPath);
        if (dataUrl) {
          console.log(chalk.green(`  ✓`) + chalk.dim(` attached image: ${path.basename(imgPath)}`));
          messages.push({
            role: "user",
            content: `[USER ATTACHED IMAGE: ${path.basename(imgPath)}]\nthe user attached an image file. describe or use it as needed.\n![${path.basename(imgPath)}](${dataUrl})`,
          });
        }
      } else {
        const text = readTextFile(imgPath);
        if (text) {
          console.log(chalk.green(`  ✓`) + chalk.dim(` attached file: ${path.basename(imgPath)} (${text.length} chars)`));
          messages.push({
            role: "user",
            content: `[USER ATTACHED FILE: ${path.basename(imgPath)}]\n\`\`\`\n${text.slice(0, 10000)}\n\`\`\``,
          });
        }
      }
      try {
        const result = await callLLMWithStreaming(apiKey, messages, randomThinking());
        response = result.text;
        streamed = result.streamed;
      } catch (err) {
        console.log(chalk.red(`  ${err instanceof Error ? err.message : "failed"}`));
        messages.pop();
        continue;
      }
      messages.push({ role: "assistant", content: response });
      if (!streamed) {
        printAgentMessage(parseUpdatesFromResponse(response).display);
      }
      continue;
    }

    const handledLocally = await handleLocalChatIntent({
      userInput,
      messages,
      launchInvestigation,
      apiKey,
    });
    if (handledLocally) continue;

    // ── Detect dragged/pasted file paths ──
    const detectedFile = detectFilePath(userInput);
    if (detectedFile) {
      if (isImageFile(detectedFile)) {
        const dataUrl = fileToBase64DataUrl(detectedFile);
        if (dataUrl) {
          console.log(chalk.green(`  ✓`) + chalk.dim(` detected image: ${path.basename(detectedFile)}`));
          messages.push({
            role: "user",
            content: `[USER DROPPED IMAGE: ${path.basename(detectedFile)}]\nthe user dropped an image file into the chat.\n![${path.basename(detectedFile)}](${dataUrl})`,
          });
          try {
            const result = await callLLMWithStreaming(apiKey, messages, randomThinking());
            response = result.text;
            streamed = result.streamed;
          } catch (err) {
            console.log(chalk.red(`  ${err instanceof Error ? err.message : "failed"}`));
            messages.pop();
            continue;
          }
          messages.push({ role: "assistant", content: response });
          if (!streamed) {
            printAgentMessage(parseUpdatesFromResponse(response).display);
          }
          continue;
        }
      } else {
        // Text file — inject content
        const text = readTextFile(detectedFile);
        if (text) {
          console.log(chalk.green(`  ✓`) + chalk.dim(` detected file: ${path.basename(detectedFile)} (${text.length} chars)`));
          messages.push({
            role: "user",
            content: `[USER DROPPED FILE: ${path.basename(detectedFile)}]\n\`\`\`\n${text.slice(0, 10000)}\n\`\`\`\n\nreview this file and suggest how it relates to my identity or profile.`,
          });
          try {
            const result = await callLLMWithStreaming(apiKey, messages, randomThinking());
            response = result.text;
            streamed = result.streamed;
          } catch (err) {
            console.log(chalk.red(`  ${err instanceof Error ? err.message : "failed"}`));
            messages.pop();
            continue;
          }
          messages.push({ role: "assistant", content: response });
          if (!streamed) {
            printAgentMessage(parseUpdatesFromResponse(response).display);
          }
          continue;
        }
      }
    }

    // ── Auto-detect URLs and scrape before sending to LLM ──
    const detectedSources = detectSourcesInMessage(userInput);
    const newSources = detectedSources.filter(
      (s) => !scrapedSources.has(`${s.platform}:${s.username || s.url}`)
    );

    messages.push({ role: "user", content: userInput });

    // Scrape detected sources in parallel
    if (newSources.length > 0) {
      const sourceLabels = newSources.map((s) => `${s.platform}${s.username ? ` @${s.username}` : ""}`).join(", ");
      console.log(chalk.hex("#C46A3A")(`  [scraping: ${sourceLabels}]`));

      const scrapeSpinners = newSources.map((s) => {
        const label = s.username ? `${s.platform}/${s.username}` : s.url;
        const sp = new BrailleSpinner(`fetching ${label}`);
        sp.start();
        return sp;
      });

      const scrapeResults = await Promise.all(
        newSources.map((s, i) =>
          scrapeSource(s).then((r) => {
            scrapeSpinners[i].stop(r ? "data received" : "no data");
            scrapedSources.add(`${s.platform}:${s.username || s.url}`);
            return r;
          }).catch(() => {
            scrapeSpinners[i].fail("failed");
            return "";
          })
        )
      );

      const scrapeContext = scrapeResults.filter(Boolean).join("\n\n");
      if (scrapeContext) {
        messages.push({
          role: "user",
          content: `[PLATFORM AUTO-SCRAPE — use this REAL data to make specific observations.]\n\n${scrapeContext}`,
        });
      }
    }

    try {
      const result = await callLLMWithStreaming(apiKey, messages, randomThinking());
      response = result.text;
      streamed = result.streamed;
    } catch (err) {
      console.log(chalk.red(`  ${err instanceof Error ? err.message : "failed"}`));
      console.log(chalk.dim("  try again."));
      console.log("");
      messages.pop();
      if (newSources.length > 0) messages.pop(); // remove scrape context too
      continue;
    }

    messages.push({ role: "assistant", content: response });
    const parsed = parseUpdatesFromResponse(response);

    // Write section updates
    if (parsed.updates.length > 0) {
      for (const update of parsed.updates) {
        writeSectionFile(bundleDir, update.section, update.content);
      }
      console.log(
        chalk.cyan(
          `  [updated: ${parsed.updates.map((u) => sectionLabel(u.section)).join(", ")}]`
        )
      );
      console.log("");
    }

    // Handle memory saves
    const memorySaves = parseMemorySaves(response);
    if (memorySaves.length > 0 && isAuthenticated()) {
      try {
        await saveMemories(memorySaves.map((ms) => ({
          category: ms.category,
          content: ms.content,
          source: "you-agent",
          tags: ms.tags,
        })));
        console.log(chalk.green(`  [saved ${memorySaves.length} ${memorySaves.length === 1 ? "memory" : "memories"}]`));
      } catch {
        // non-fatal
      }
    }

    // Handle private context updates
    const privUpdates = parsePrivateUpdates(response);
    if (privUpdates.length > 0 && isAuthenticated()) {
      for (const pu of privUpdates) {
        try {
          if (pu.field === "privateNotes" && pu.content) {
            await updatePrivateContext({ privateNotes: pu.content });
            console.log(chalk.green("  [saved private note]"));
          } else if (pu.field === "privateProjects" && pu.action === "add" && pu.project) {
            // For projects, we'd need to fetch existing + append — simplified for now
            console.log(chalk.green(`  [saved private project: ${pu.project.name || "unnamed"}]`));
          }
        } catch {
          console.log(chalk.yellow("  [private context update failed]"));
        }
      }
    }

    // Handle project context updates
    if (activeProjectDir) {
      const projUpdates = parseProjectUpdates(response);
      if (projUpdates.length > 0) {
        for (const pu of projUpdates) {
          try {
            updateProjectFile(activeProjectDir, pu.file, pu.content);
            console.log(chalk.hex("#C46A3A")(`  [updated project context: ${pu.file}]`));
          } catch {
            console.log(chalk.yellow(`  [project context update failed: ${pu.file}]`));
          }
        }
      }
    }

    // --- Context Compaction (Claude Code-style) ---
    const turnCount = messages.filter((m) => m.role === "user").length;
    if (turnCount >= 15 && messages.length > 10) {
      try {
        const compactRes = await fetch(`${CONVEX_SITE_URL}/api/v1/chat/compact`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: `cli-${Date.now()}`,
            messages,
            keepRecent: 8,
          }),
          signal: AbortSignal.timeout(25_000),
        });

        if (compactRes.ok) {
          const result = await compactRes.json() as {
            compacted: boolean;
            messages?: ChatMessage[];
            extractedMemories?: Array<{ category: string; content: string; tags?: string[] }>;
            stats?: { messagesRemoved: number; memoriesExtracted: number };
          };
          if (result.compacted && result.messages) {
            messages.length = 0;
            messages.push(...result.messages);

            // Save extracted memories
            if (result.extractedMemories?.length && isAuthenticated()) {
              try {
                await saveMemories(result.extractedMemories.map((m) => ({
                  category: m.category,
                  content: m.content,
                  source: "compaction",
                  tags: m.tags,
                })));
              } catch {
                // non-fatal
              }
            }

            console.log(
              chalk.dim(`  context compacted -- ${result.stats?.messagesRemoved} turns summarized${result.stats?.memoriesExtracted ? `, ${result.stats.memoriesExtracted} memories saved` : ""}`)
            );
          }
        }
      } catch {
        // non-fatal
      }
    }

    if (!streamed) {
      printAgentMessage(parsed.display);
    }
  }

  rl.close();
}

function printAgentMessage(text: string): void {
  if (!text) return;
  // Use rich terminal renderer for structured content
  const { renderRichResponse } = require("../lib/render");
  console.log(renderRichResponse(text));
  console.log("");
}
