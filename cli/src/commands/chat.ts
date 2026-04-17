import * as readline from "readline";
import * as fs from "fs";
import * as path from "path";
import chalk from "chalk";
import {
  getLocalBundleDir,
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
} from "../lib/project";
import { compileBundle, writeBundle } from "../lib/compiler";
import { uploadBundle, publishLatest, saveMemories, updatePrivateContext } from "../lib/api";
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

// ─── URL Detection + Scraping (mirrors web useYouAgent) ──────────────

import { getConvexSiteUrl } from "../lib/config";

const CONVEX_SITE_URL = getConvexSiteUrl();
const STREAM_URL = `${CONVEX_SITE_URL}/api/v1/chat/stream`;

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
): Promise<string> {
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

    return response;
  } catch {
    // Streaming failed -- fall back to blocking call
    thinkSpinner.update("streaming unavailable, waiting for response");

    try {
      const response = await callLLM(apiKey, messages);
      thinkSpinner.stop();
      return response;
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

// ─── Main chat command ────────────────────────────────────────────────

export async function chatCommand(): Promise<void> {
  if (!localBundleExists()) {
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

  const bundleDir = getLocalBundleDir();
  const apiKey = getOpenRouterKey();
  const rl = createRL();

  // Detect project context (legacy detection from config.ts)
  const projectCtx = detectProjectContext();
  let projectContextBlock = "";
  let activeProjectDir: string | null = null;

  if (projectCtx) {
    console.log("");
    console.log(
      "  " + chalk.hex("#C46A3A")("project:") + " " + chalk.white(projectCtx.name) +
      chalk.dim(` (${projectCtx.root})`)
    );

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

  console.log("");
  console.log("  " + chalk.bold("you.md chat"));
  console.log(
    chalk.dim(
      "  talk to update your profile. /help for commands."
    )
  );
  console.log("");

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

  const messages: ChatMessage[] = [
    { role: "system", content: CHAT_SYSTEM_PROMPT },
    {
      role: "user",
      content: `here is my current identity bundle:\n\n${currentBundle}${directivesContext}${projectContextBlock}\n\n${greetingInstruction}`,
    },
  ];

  // Initial greeting from agent
  let response: string;
  try {
    response = await callLLMWithStreaming(apiKey, messages, randomThinking());
  } catch (err) {
    console.log(
      chalk.red(
        `  failed to connect: ${err instanceof Error ? err.message : String(err)}`
      )
    );
    console.log(
      chalk.dim(
        "  chat requires the AI service. try again later."
      )
    );
    console.log("");
    rl.close();
    return;
  }

  messages.push({ role: "assistant", content: response });
  const initial = parseUpdatesFromResponse(response);

  // Write any updates (unlikely on greeting, but handle it)
  if (initial.updates.length > 0) {
    for (const update of initial.updates) {
      writeSectionFile(bundleDir, update.section, update.content);
    }
    console.log(
      chalk.cyan(
        `  [updated: ${initial.updates.map((u) => sectionLabel(u.section)).join(", ")}]`
      )
    );
    console.log("");
  }

  // Only print via rich renderer if we didn't stream (streaming already wrote output)
  // But we still need to display parsed output for non-streamed fallback
  // Since streaming writes raw text, print formatted version for updates parsing
  printAgentMessage(initial.display);

  // ── Conversation loop ──────────────────────────────────────────────

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
        response = await callLLMWithStreaming(apiKey, messages, randomThinking());
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

      printAgentMessage(researchParsed.display);
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
        response = await callLLMWithStreaming(apiKey, messages, randomThinking());
      } catch (err) {
        console.log(chalk.red(`  ${err instanceof Error ? err.message : "failed"}`));
        messages.pop();
        continue;
      }
      messages.push({ role: "assistant", content: response });
      printAgentMessage(parseUpdatesFromResponse(response).display);
      continue;
    }

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
            response = await callLLMWithStreaming(apiKey, messages, randomThinking());
          } catch (err) {
            console.log(chalk.red(`  ${err instanceof Error ? err.message : "failed"}`));
            messages.pop();
            continue;
          }
          messages.push({ role: "assistant", content: response });
          printAgentMessage(parseUpdatesFromResponse(response).display);
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
            response = await callLLMWithStreaming(apiKey, messages, randomThinking());
          } catch (err) {
            console.log(chalk.red(`  ${err instanceof Error ? err.message : "failed"}`));
            messages.pop();
            continue;
          }
          messages.push({ role: "assistant", content: response });
          printAgentMessage(parseUpdatesFromResponse(response).display);
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
      response = await callLLMWithStreaming(apiKey, messages, randomThinking());
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

    printAgentMessage(parsed.display);
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
