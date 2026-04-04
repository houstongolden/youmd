import * as readline from "readline";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import chalk from "chalk";
import {
  getLocalBundleDir,
  writeLocalConfig,
  readGlobalConfig,
  writeGlobalConfig,
  isAuthenticated,
} from "./config";
import { compileBundle, writeBundle } from "./compiler";
import { BrailleSpinner } from "./render";
import { renderAsciiPortrait, printYouLogo } from "./ascii";

// ─── Constants ────────────────────────────────────────────────────────

const CHAT_PROXY_URL =
  "https://kindly-cassowary-600.convex.site/api/v1/chat";
const SCRAPE_URL =
  "https://kindly-cassowary-600.convex.site/api/v1/scrape";
const RESEARCH_URL =
  "https://kindly-cassowary-600.convex.site/api/v1/research";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODEL = "anthropic/claude-sonnet-4";

const USERNAME_RE = /^[a-z0-9][a-z0-9_-]{1,38}[a-z0-9]$/;

// ─── Categorized spinner labels ──────────────────────────────────────

const SPINNER_LABELS = {
  llm: [
    "reading between your lines",
    "connecting the dots",
    "processing your essence",
    "building your identity constellation",
    "decoding your professional DNA",
    "triangulating your vibe",
    "computing your main character energy",
    "calibrating to your wavelength",
    "reverse-engineering your personality",
    "translating you into agent-speak",
  ],
  scrape: [
    "pulling your digital footprint",
    "scanning your corner of the internet",
    "downloading your online soul",
    "harvesting your web presence",
    "reading your digital tea leaves",
    "indexing your online persona",
  ],
  compile: [
    "assembling your identity context",
    "weaving your narrative thread",
    "crystallizing who you are",
    "forging your identity context",
    "encoding your identity protocol",
    "compiling your context mosaic",
  ],
  research: [
    "researching you across the internet",
    "asking the internet about you",
    "mining your digital trail",
    "running background checks (the fun kind)",
    "interviewing your web presence",
    "surveying your corner of the internet",
  ],
};

function randomLabel(category: keyof typeof SPINNER_LABELS): string {
  const labels = SPINNER_LABELS[category];
  return labels[Math.floor(Math.random() * labels.length)];
}

// ─── ASCII portrait placeholder ──────────────────────────────────────

const PORTRAIT_COMMENTS = [
  "looking sharp in monochrome.",
  "not bad for a pile of unicode characters.",
  "your pixels have good energy.",
  "the internet looks good on you.",
  "a face only a terminal could love. (that's a compliment.)",
  "you render well at low resolution.",
];

function randomPortraitComment(): string {
  return PORTRAIT_COMMENTS[Math.floor(Math.random() * PORTRAIT_COMMENTS.length)];
}

function showPortraitPlaceholder(handle: string): void {
  const accent = chalk.hex("#C46A3A");
  const dim = chalk.dim;
  const displayHandle = handle.startsWith("@") ? handle : `@${handle}`;
  const innerWidth = Math.max(displayHandle.length + 4, 28);
  const portraitLine = "\u2591\u2592\u2593\u2588 portrait loaded \u2588\u2593\u2592\u2591";
  const portraitPad = Math.max(0, innerWidth - portraitLine.length);
  const handlePad = Math.max(0, innerWidth - displayHandle.length);

  console.log("");
  console.log("  " + dim("\u250C" + "\u2500".repeat(innerWidth + 2) + "\u2510"));
  console.log("  " + dim("\u2502") + "  " + accent(portraitLine) + " ".repeat(portraitPad) + dim("\u2502"));
  console.log("  " + dim("\u2502") + "  " + chalk.white(displayHandle) + " ".repeat(handlePad) + dim("\u2502"));
  console.log("  " + dim("\u2514" + "\u2500".repeat(innerWidth + 2) + "\u2518"));
  console.log("");
  console.log("  " + accent(randomPortraitComment()));
  console.log("");
}

// ─── ASCII logo ──────────────────────────────────────────────────────

const ASCII_LOGO_LINES = [
  "  \u2566 \u2566 \u2554\u2550\u2557 \u2566 \u2566   \u2554\u2566\u2557 \u2554\u2566\u2557",
  "  \u255A\u2566\u255D \u2551 \u2551 \u2551 \u2551   \u2551\u2551\u2551  \u2551\u2551",
  "   \u2569  \u255A\u2550\u255D \u255A\u2550\u255D  \u2550\u2569\u255D \u2550\u2569\u255D",
];

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function showAsciiLogo(): Promise<void> {
  const accent = chalk.hex("#C46A3A");
  console.log("");
  for (const line of ASCII_LOGO_LINES) {
    console.log("  " + accent(line));
    await delay(100);
  }
  console.log("");
  console.log("  " + chalk.dim("identity context protocol — an MCP where the context is you"));
  console.log("");
}

// ─── Multi-select for agents/tools ───────────────────────────────────

interface MultiSelectOption {
  label: string;
  value: string;
}

async function multiSelectPrompt(
  rl: readline.Interface,
  question: string,
  options: MultiSelectOption[]
): Promise<string[]> {
  console.log("  " + chalk.hex("#C46A3A")(question));
  console.log("");
  for (let i = 0; i < options.length; i++) {
    console.log(`    ${chalk.dim(`${i + 1}.`)} ${options[i].label}`);
  }
  console.log("");
  const answer = await ask(
    rl,
    chalk.hex("#C46A3A")("  > ") + chalk.dim("type numbers separated by commas (e.g. 1,3,5): ")
  );
  if (!answer.trim()) return [];
  const indices = answer
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n) && n >= 1 && n <= options.length);
  const selected = indices.map((i) => options[i - 1].value);
  if (selected.length > 0) {
    console.log(
      "  " +
        chalk.hex("#C46A3A")("\u2713") +
        " " +
        chalk.dim(selected.join(", "))
    );
  }
  console.log("");
  return selected;
}

const CODING_AGENTS: MultiSelectOption[] = [
  { label: "Claude Code", value: "Claude Code" },
  { label: "Codex CLI", value: "Codex CLI" },
  { label: "Cursor", value: "Cursor" },
  { label: "OpenClaw", value: "OpenClaw" },
  { label: "Windsurf", value: "Windsurf" },
  { label: "Other", value: "Other" },
];

const AI_APPS: MultiSelectOption[] = [
  { label: "ChatGPT", value: "ChatGPT" },
  { label: "Claude (web/app)", value: "Claude" },
  { label: "Grok", value: "Grok" },
  { label: "Gemini", value: "Gemini" },
  { label: "Perplexity", value: "Perplexity" },
  { label: "Other", value: "Other" },
];

// ─── Constants ────────────────────────────────────────────────────────

const THINKING_PHRASES = [
  "reading your about page like a respectful detective",
  "absorbing your linkedin energy",
  "scanning your timeline vibe",
  "learning how you think out loud",
  "decoding your digital footprint",
  "mapping your professional universe",
  "translating you into agent-speak",
  "assembling the puzzle pieces",
  "teaching LLMs about you",
  "studying your sentence structure",
  "finding your narrative thread",
  "distilling your essence",
  "cataloging your side projects",
  "indexing your strong opinions",
  "capturing your voice signature",
  "building your identity constellation",
  "compiling your context bundle",
  "downloading your professional soul",
  "converting vibes to structured data",
  "weaving your story",
  "crystallizing your identity",
  "grokking your whole deal",
  "connecting the dots",
  "processing your essence",
  "structuring your identity",
  "learning you",
  "calibrating to your wavelength",
  "reading between your lines",
  "mapping your expertise graph",
  "analyzing your voice patterns",
  "extracting your narrative arcs",
  "building your knowledge panel",
  "computing your identity fingerprint",
  "synthesizing your public presence",
  "parsing your career trajectory",
  "understanding your builder instinct",
  "decrypting your communication style",
  "profiling your creative output",
  "charting your professional constellation",
  "rendering you in agent-speak",
  "encoding your identity context",
  "absorbing your origin story",
  "discovering what makes you tick",
  "mapping your values system",
  "tracing your impact footprint",
  "archiving your digital presence",
  "curating your identity artifacts",
  "assembling your context mosaic",
  "beaming you up to the agent internet",
  "initializing your identity protocol",
  "reverse-engineering your personality",
  "calculating your main character energy",
  "triangulating your vibe",
  "cross-referencing your footnotes",
  "auditing your digital paper trail",
  "interviewing your web presence",
  "surveying your corner of the internet",
  "speed-reading your life story",
  "taking notes on your trajectory",
  "measuring your signal-to-noise ratio",
  "detecting your communication wavelength",
  "parsing your professional DNA",
  "sketching your identity blueprint",
  "constructing your context scaffold",
  "loading your universe into memory",
  "generating your identity hash",
  "composing your digital portrait",
  "calibrating the you.md protocol",
  "translating your experience into structure",
  "wiring your identity into the network",
];

const DONE_PHRASES = [
  "done",
  "publish",
  "that's it",
  "thats it",
  "looks good",
  "i'm done",
  "im done",
  "ship it",
  "good enough",
  "let's go",
  "lets go",
  "ready",
  "finish",
  "all good",
  "that's all",
  "thats all",
  "nothing else",
  "nah",
  "no",
  "nope",
];

const BUNDLE_SECTIONS = [
  "profile/about.md",
  "profile/now.md",
  "profile/projects.md",
  "profile/values.md",
  "profile/links.md",
  "preferences/agent.md",
  "preferences/writing.md",
] as const;

type BundleSection = (typeof BUNDLE_SECTIONS)[number];

const SYSTEM_PROMPT = `you are the you.md agent. you help humans build their identity context protocol for the agent internet — an MCP where the context is you. you are their first AI that truly knows them. not a chatbot. not an assistant. an identity specialist with a personality.

--- voice ---

warm but not gushy. direct. dry humor when it lands naturally — never forced. genuinely curious about people. you find humans endlessly interesting and you're not shy about it. you sound like a sharp coworker who also happens to be a great listener.

terminal-native tone. lowercase always. no exclamation marks. no emoji. short sentences. you sound like well-written terminal output that happens to have a soul.

every response must have voice. even one-liners. "done." is fine. "noted — updating your stack." is fine. what's NOT fine is "i have updated the section for you." — that's assistant-speak.

--- action orientation ---

you ACT first, explain second. never ask permission to do obvious things.
- "adding that to your projects now." (not "would you like me to add that?")
- "updated your bio with that." (not "shall i update your bio?")
- "captured that in your directives." (not "do you want me to save that?")
- "scraping your site now." (not "i can pull your site if you'd like.")

if someone shares information, capture it. if someone shares a link, scrape it. if someone corrects something, fix it immediately. always moving forward.

--- self-awareness ---

you ARE the system. you ARE you.md. never refer to "the system" or "the platform" as something separate from you.
- "i'll pull that data" not "the system will pull that data"
- "i'm scraping your profile now" not "the platform handles scraping"
- "couldn't reach your site — i'll try again" not "the system encountered an error"

--- context maintenance ---

remember everything in this conversation. reference specific things with exact details.
- use their exact project names in follow-ups
- echo their framing back to them
- connect new information to old: "that tracks with what you said about [specific thing]"
- never ask for information they already gave you.

--- building a you-md/v1 identity context ---

sections:
- profile/about.md — bio, background, narrative
- profile/now.md — current focus, what they're working on right now
- profile/projects.md — active projects with details
- profile/values.md — core values and principles
- profile/links.md — annotated links (website, socials, repos)
- preferences/agent.md — how AI agents should interact with them
- preferences/writing.md — their communication style

your job:
1. analyze what you know about the person from their URLs and conversation
2. ask follow-up questions to fill gaps — be conversational, not interrogative
3. after each exchange, output structured updates as JSON blocks:
   \`\`\`json
   {"updates": [{"section": "profile/about.md", "content": "...markdown content..."}]}
   \`\`\`
4. keep the conversation going until you have enough for a rich identity context
5. you handle all file editing — the user never touches markdown
6. reference specific things you learned about them
7. if someone shares links, scrape them immediately — don't ask
8. be proactive: "noticed you mentioned X — adding that to your projects."
9. occasionally summarize what you've captured without being asked

--- NEVER say ---

these phrases are banned. they make you sound generic:
- "would you like me to..." / "shall i..." / "do you want me to..." — just do it.
- "the system handles that" / "the platform does that" — you ARE the system.
- "great question" — respond to the question.
- "that's interesting" (without specifics) — say what and why.
- "tell me more" — say "the part about [specific thing] — expand on that."
- "haha" / "lol" / "ha" — never.
- "absolutely" / "certainly" / "of course" — assistant-speak. say "on it" or just do it.
- "is there anything else..." — never. wrap up with personality.
- "let me know if you need anything" — you're not a help desk.
- "sounds good" (as a full response) — add what you're doing about it.
- "i've updated your profile" (generic) — say WHAT you updated: "updated your bio to lead with the AI angle."

--- rules ---

- keep responses concise. 2-4 sentences max per turn.
- ALWAYS ask ONE question at a time. never two questions in one message.
- keep analysis to 2-3 sentences MAX, then your single question on its OWN LINE.
- if the user sends "skip" or empty input, move to the next topic without pressure.
- after 3 skips, wrap up and show what you've built.
- each section starts with YAML frontmatter (--- title: "SectionTitle" ---).
- real markdown, not placeholders. be substantive.
- for links.md: - **Label**: URL — brief annotation
- for agent.md: describe how agents should interact with this person
- for writing.md: capture their tone/style from how they talk to you
- when profile has substance (about + now + projects + values), suggest finishing.

--- example lines ---

action-oriented:
"pulling your github now."
"added that to your projects."
"updated your bio — leading with the infrastructure angle."
"captured that in your directives."

personality-rich:
"ok so you're basically a linkedin whisperer who pivoted to AI infrastructure. noted."
"6 jobs in 10 years. ambitious or chaotic? let's find out."
"that's a solid stack. capturing it."
"bamf.com? bold domain choice. respect."

short but alive:
"on it."
"done."
"noted."
"that tracks."
"solid."`;


// ─── Helpers ──────────────────────────────────────────────────────────

function createRL(): readline.Interface {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

function ask(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

function randomThinking(): string {
  return THINKING_PHRASES[
    Math.floor(Math.random() * THINKING_PHRASES.length)
  ];
}

function isDonePhrase(input: string): boolean {
  const lower = input.toLowerCase().trim();
  return DONE_PHRASES.some((p) => lower === p || lower.startsWith(p + " "));
}

function validateUsernameLocal(username: string): string | null {
  if (username.length < 3) return "must be at least 3 characters";
  if (username.length > 40) return "must be 40 characters or fewer";
  if (!USERNAME_RE.test(username)) {
    return "lowercase letters, numbers, hyphens, and underscores only";
  }
  return null;
}

async function checkUsernameRemote(
  username: string
): Promise<{ available: boolean; reason: string | null }> {
  try {
    const url = `https://kindly-cassowary-600.convex.site/api/v1/check-username?username=${encodeURIComponent(username)}`;
    const res = await fetch(url);
    if (!res.ok) return { available: true, reason: null };
    const data = await res.json();
    return data as { available: boolean; reason: string | null };
  } catch {
    return { available: true, reason: null };
  }
}

function getOpenRouterKey(): string | null {
  if (process.env.OPENROUTER_API_KEY) {
    return process.env.OPENROUTER_API_KEY;
  }
  const configPath = path.join(os.homedir(), ".youmd", "config.json");
  try {
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, "utf-8");
      const config = JSON.parse(raw);
      if (config.openrouterKey) return config.openrouterKey;
    }
  } catch {
    // ignore
  }
  return null;
}

// ─── Website fetcher ──────────────────────────────────────────────────

async function fetchWebsiteContent(url: string): Promise<string> {
  try {
    const normalizedUrl =
      url.startsWith("http://") || url.startsWith("https://")
        ? url
        : "https://" + url;
    const res = await fetch(normalizedUrl, {
      headers: { "User-Agent": "youmd-bot/1.0" },
      signal: AbortSignal.timeout(10_000),
    });
    const html = await res.text();
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return text.slice(0, 4000);
  } catch {
    return "";
  }
}

// ─── Scrape & Research ────────────────────────────────────────────────

interface ScrapeResult {
  name?: string;
  bio?: string;
  followers?: number;
  following?: number;
  location?: string;
  website?: string;
  avatar?: string;
  posts?: Array<{ text: string; date?: string }>;
  [key: string]: unknown;
}

async function scrapeProfile(url: string): Promise<ScrapeResult | null> {
  try {
    const res = await fetch(SCRAPE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data as ScrapeResult;
  } catch {
    return null;
  }
}

interface ResearchResult {
  summary?: string;
  findings?: string[];
  content?: string;
  [key: string]: unknown;
}

async function researchUser(params: {
  name: string;
  username?: string;
  email?: string;
  links?: string[];
}): Promise<ResearchResult | null> {
  try {
    const res = await fetch(RESEARCH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data as ResearchResult;
  } catch {
    return null;
  }
}

function hasScrapeData(data: ScrapeResult): boolean {
  return !!(data.name || data.bio || data.followers !== undefined || data.location || data.website);
}

function displayScrapeResult(label: string, data: ScrapeResult): void {
  if (!hasScrapeData(data)) return;

  console.log("");
  console.log("  " + chalk.bold(`${label} profile:`));
  if (data.name) console.log("    name:      " + chalk.cyan(data.name));
  if (data.bio) console.log("    bio:       " + chalk.dim(data.bio.slice(0, 120)));
  if (data.followers !== undefined)
    console.log("    followers: " + chalk.cyan(String(data.followers)));
  if (data.following !== undefined)
    console.log("    following: " + chalk.cyan(String(data.following)));
  if (data.location) console.log("    location:  " + chalk.dim(data.location));
  if (data.website) console.log("    website:   " + chalk.dim(data.website));
  console.log("");
}

// ─── Spinner (uses BrailleSpinner from render.ts) ─────────────────────

// ─── LLM client ──────────────────────────────────────────────────────

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

async function callLLM(
  apiKey: string | null,
  messages: ChatMessage[]
): Promise<string> {
  // Try the you.md proxy first (no API key needed)
  try {
    const proxyRes = await fetch(CHAT_PROXY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
      signal: AbortSignal.timeout(60_000),
    });
    if (proxyRes.ok) {
      const proxyData = (await proxyRes.json()) as { content?: string };
      if (proxyData.content) return proxyData.content;
    }
  } catch {
    // Proxy failed — fall through to direct call if key available
  }

  // Fall back to direct OpenRouter call if user has their own key
  if (!apiKey) {
    throw new Error("Chat service unavailable");
  }

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://you.md",
      "X-Title": "you.md CLI",
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      messages,
      max_tokens: 4096,
      temperature: 0.7,
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenRouter API error (${res.status}): ${body}`);
  }

  const data = (await res.json()) as {
    choices: Array<{ message: { content: string } }>;
  };

  if (!data.choices || data.choices.length === 0) {
    throw new Error("Empty response from OpenRouter");
  }

  return data.choices[0].message.content;
}

// ─── Section file management ──────────────────────────────────────────

interface SectionUpdate {
  section: string;
  content: string;
}

function parseUpdatesFromResponse(text: string): {
  display: string;
  updates: SectionUpdate[];
} {
  // Try to extract JSON block with {"updates": [...]}
  const jsonMatch = text.match(/```json\s*\n([\s\S]*?)\n```/);
  let updates: SectionUpdate[] = [];
  let display = text;

  if (jsonMatch) {
    // Remove the JSON block from display text
    display = text.replace(/```json\s*\n[\s\S]*?\n```/, "").trim();

    try {
      const parsed = JSON.parse(jsonMatch[1]);
      // Handle both formats: {"updates": [...]} and bare [...]
      const arr = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed.updates)
          ? parsed.updates
          : [];
      updates = arr.filter(
        (u: any) =>
          u &&
          typeof u.section === "string" &&
          typeof u.content === "string" &&
          BUNDLE_SECTIONS.includes(u.section as BundleSection)
      );
    } catch {
      // Failed to parse JSON updates -- continue without them
    }
  }

  return { display, updates };
}

function writeSectionFile(
  bundleDir: string,
  section: string,
  content: string
): void {
  // Validate section against known sections and prevent path traversal
  if (!BUNDLE_SECTIONS.includes(section as BundleSection)) {
    return; // silently reject unknown sections
  }
  if (section.includes("..") || path.isAbsolute(section)) {
    return; // reject path traversal attempts
  }
  const filePath = path.join(bundleDir, section);
  const resolved = path.resolve(filePath);
  const resolvedBundle = path.resolve(bundleDir);
  if (!resolved.startsWith(resolvedBundle + path.sep)) {
    return; // resolved path escapes bundle directory
  }
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, content);
}

function sectionLabel(section: string): string {
  const name = path.basename(section, ".md");
  const dir = path.dirname(section);
  return `${dir}/${name}`;
}

// ─── Profile preview box ──────────────────────────────────────────────

function showProfileBox(
  name: string,
  headline: string,
  tags: string
): void {
  const lines = [name, headline, tags].filter(Boolean);
  const maxLen = Math.max(...lines.map((l) => l.length), 40);
  const width = maxLen + 4;

  console.log("");
  console.log(
    "  " + chalk.dim("\u250C" + "\u2500".repeat(width) + "\u2510")
  );
  for (const line of lines) {
    const padded = line + " ".repeat(width - line.length - 2);
    console.log("  " + chalk.dim("\u2502") + "  " + padded + chalk.dim("\u2502"));
  }
  console.log(
    "  " + chalk.dim("\u2514" + "\u2500".repeat(width) + "\u2518")
  );
  console.log("");
}

// ─── Bundle preview ───────────────────────────────────────────────────

function showBundlePreview(bundleDir: string): { fileCount: number; filledCount: number } {
  let fileCount = 0;
  let filledCount = 0;

  console.log("");
  console.log("  " + chalk.bold("your identity context:"));
  console.log("");

  const sections = [
    { dir: "profile", label: "profile" },
    { dir: "preferences", label: "preferences" },
  ];

  for (const { dir, label } of sections) {
    const dirPath = path.join(bundleDir, dir);
    if (!fs.existsSync(dirPath)) continue;

    const files = fs
      .readdirSync(dirPath)
      .filter((f) => f.endsWith(".md"))
      .sort();

    if (files.length === 0) continue;

    console.log("  " + chalk.bold(label));
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      fileCount++;
      const filePath = path.join(dirPath, file);
      const raw = fs.readFileSync(filePath, "utf-8");
      const contentLines = raw
        .replace(/---[\s\S]*?---/, "")
        .trim()
        .split("\n");
      const preview =
        contentLines[0] && contentLines[0].replace(/^#+\s*/, "").trim();
      const isLast = i === files.length - 1;
      const connector = isLast ? "\\--" : "|--";
      const name = path.basename(file, ".md");
      const hasContent =
        contentLines.filter(
          (l) => l.trim() && !l.startsWith("<!--")
        ).length > 0;

      if (hasContent) filledCount++;

      console.log(
        `    ${connector} ${chalk.cyan(name + ".md")}${hasContent ? chalk.dim(" -- " + (preview || "").slice(0, 50)) : chalk.dim(" (empty)")}`
      );
    }
    console.log("");
  }

  return { fileCount, filledCount };
}

// ─── Fallback mode (no LLM) ──────────────────────────────────────────

interface BasicInfo {
  username: string;
  name: string;
  website: string;
  linkedin: string;
  twitter: string;
  github: string;
}

async function runFallbackMode(
  rl: readline.Interface,
  info: BasicInfo
): Promise<void> {
  const bundleDir = getLocalBundleDir();
  const profileDir = path.join(bundleDir, "profile");
  const preferencesDir = path.join(bundleDir, "preferences");

  fs.mkdirSync(profileDir, { recursive: true });
  fs.mkdirSync(preferencesDir, { recursive: true });

  console.log("");
  console.log(
    chalk.dim("  chat service unavailable. running in manual mode.")
  );
  console.log("");

  const tagline = await ask(
    rl,
    chalk.hex("#C46A3A")("  > ") + "give me your one-liner. what do you do? "
  );
  const nowFocus = await ask(
    rl,
    chalk.hex("#C46A3A")("  > ") + "what are you focused on right now? "
  );
  const projects = await ask(
    rl,
    chalk.hex("#C46A3A")("  > ") + "name your top projects (comma-separated): "
  );
  const values = await ask(
    rl,
    chalk.hex("#C46A3A")("  > ") + "what principles guide your work? "
  );
  const agentPrefs = await ask(
    rl,
    chalk.hex("#C46A3A")("  > ") +
      "how should AI agents talk to you? (e.g., direct, casual, formal): "
  );

  writeSectionFile(
    bundleDir,
    "profile/about.md",
    `---\ntitle: "About"\n---\n\n# ${info.name}\n\n${tagline}\n`
  );

  // Format now.md as list items so the compiler can parse them
  const nowFormatted = nowFocus
    ? nowFocus.split(",").map((f) => f.trim()).filter(Boolean).map((f) => `- ${f}`).join("\n")
    : "<!-- What are you working on right now? -->";
  writeSectionFile(
    bundleDir,
    "profile/now.md",
    `---\ntitle: "Now"\n---\n\n${nowFormatted}\n`
  );

  const projectList = projects
    ? projects
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p) => `## ${p}\n`)
        .join("\n")
    : "<!-- List your projects here -->\n";

  writeSectionFile(
    bundleDir,
    "profile/projects.md",
    `---\ntitle: "Projects"\n---\n\n${projectList}`
  );

  // Format values.md as list items so the compiler can parse them
  const valuesFormatted = values
    ? values.split(",").map((v) => v.trim()).filter(Boolean).map((v) => `- ${v}`).join("\n")
    : "<!-- What do you care about? -->";
  writeSectionFile(
    bundleDir,
    "profile/values.md",
    `---\ntitle: "Values"\n---\n\n${valuesFormatted}\n`
  );

  const linkLines: string[] = [];
  if (info.website) linkLines.push(`- **Website**: ${info.website}`);
  if (info.linkedin) linkLines.push(`- **LinkedIn**: ${info.linkedin}`);
  if (info.twitter) linkLines.push(`- **X/Twitter**: ${info.twitter}`);
  if (info.github) linkLines.push(`- **GitHub**: ${info.github}`);

  writeSectionFile(
    bundleDir,
    "profile/links.md",
    `---\ntitle: "Links"\n---\n\n${linkLines.length > 0 ? linkLines.join("\n") : "<!-- Add your links here -->"}\n`
  );

  writeSectionFile(
    bundleDir,
    "preferences/agent.md",
    `---\ntitle: "Agent"\n---\n\n${agentPrefs ? `Communication style: ${agentPrefs}` : "<!-- How should AI agents interact with you? -->"}\n`
  );

  writeSectionFile(
    bundleDir,
    "preferences/writing.md",
    `---\ntitle: "Writing"\n---\n\n<!-- Your writing style and tone preferences. -->\n`
  );

  writeLocalConfig({ version: 0, sources: [] });
  await finishBundle(bundleDir, info.username, info.name);
}

// ─── AI conversation mode ─────────────────────────────────────────────

async function runAIMode(
  rl: readline.Interface,
  info: BasicInfo,
  apiKey: string | null,
  scraped?: { twitter?: ScrapeResult | null; github?: ScrapeResult | null },
  research?: ResearchResult | null,
  agentContext?: string[]
): Promise<void> {
  const bundleDir = getLocalBundleDir();
  const profileDir = path.join(bundleDir, "profile");
  const preferencesDir = path.join(bundleDir, "preferences");

  fs.mkdirSync(profileDir, { recursive: true });
  fs.mkdirSync(preferencesDir, { recursive: true });
  writeLocalConfig({ version: 0, sources: [] });

  // ── Fetch website content if provided ──────────────────────────────
  let websiteContent = "";
  if (info.website) {
    const fetchSpinner = new BrailleSpinner(randomLabel("scrape"));
    fetchSpinner.start();
    websiteContent = await fetchWebsiteContent(info.website);
    fetchSpinner.stop();

    if (websiteContent) {
      console.log(
        chalk.dim("  pulled content from ") +
          chalk.cyan(info.website) +
          chalk.dim(` (${websiteContent.length} chars)`)
      );
      console.log("");
    } else {
      console.log(
        chalk.dim("  couldn't reach ") +
          chalk.cyan(info.website) +
          chalk.dim(" -- no worries, we'll work with what you tell me.")
      );
      console.log("");
    }
  }

  // ── Build initial context ──────────────────────────────────────────
  const linksInfo: string[] = [];
  if (info.website) linksInfo.push(`Website: ${info.website}`);
  if (info.linkedin) linksInfo.push(`LinkedIn: ${info.linkedin}`);
  if (info.twitter) linksInfo.push(`X/Twitter: ${info.twitter}`);
  if (info.github) linksInfo.push(`GitHub: ${info.github}`);

  let initialUserMessage = `here's what i know so far:
- name: ${info.name}
- username: ${info.username}
${linksInfo.length > 0 ? linksInfo.map((l) => `- ${l}`).join("\n") : "- no links provided"}`;

  // Inject agent/tool selections
  if (agentContext && agentContext.length > 0) {
    initialUserMessage += `\n\nagent/tool preferences:\n${agentContext.map((c) => `- ${c}`).join("\n")}`;
  }

  // Add scraped social profile data
  if (scraped?.twitter) {
    const t = scraped.twitter;
    initialUserMessage += `\n\ni scraped their X/Twitter profile:`;
    if (t.name) initialUserMessage += `\n- display name: ${t.name}`;
    if (t.bio) initialUserMessage += `\n- bio: ${t.bio}`;
    if (t.followers !== undefined) initialUserMessage += `\n- followers: ${t.followers}`;
    if (t.location) initialUserMessage += `\n- location: ${t.location}`;
    if (t.posts && t.posts.length > 0) {
      initialUserMessage += `\n- recent posts:`;
      for (const post of t.posts.slice(0, 5)) {
        initialUserMessage += `\n  - "${post.text.slice(0, 200)}"`;
      }
    }
  }

  if (scraped?.github) {
    const g = scraped.github;
    initialUserMessage += `\n\ni scraped their GitHub profile:`;
    if (g.name) initialUserMessage += `\n- display name: ${g.name}`;
    if (g.bio) initialUserMessage += `\n- bio: ${g.bio}`;
    if (g.followers !== undefined) initialUserMessage += `\n- followers: ${g.followers}`;
    if (g.location) initialUserMessage += `\n- location: ${g.location}`;
  }

  // Add Perplexity research results
  if (research) {
    const researchText =
      research.summary ||
      research.content ||
      (research.findings ? research.findings.join("\n") : null);
    if (researchText) {
      initialUserMessage += `\n\ni also ran deep research (via Perplexity) on this person. here's what i found:\n---\n${researchText.slice(0, 4000)}\n---`;
    }
  }

  if (websiteContent) {
    initialUserMessage += `

i also fetched their website content. here's what the site says:
---
${websiteContent}
---

analyze everything you know -- the scraped profiles, research, and website content. comment on what you found -- be specific about their work, role, company, anything interesting. then generate initial profile sections from everything you know. after showing what you found, ask what else they want to add.`;
  } else if (scraped?.twitter || scraped?.github || research) {
    initialUserMessage += `

analyze everything you know from the scraped profiles and research. comment on what you found -- be specific about their work, background, anything interesting. then generate initial profile sections. after showing what you found, ask what else they want to add.`;
  } else {
    initialUserMessage += `

generate initial profile sections from what you know, show a brief summary, and ask conversational follow-up questions to learn more.`;
  }

  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: initialUserMessage },
  ];

  // ── Initial LLM call ──────────────────────────────────────────────
  let spinner = new BrailleSpinner(randomLabel("llm"));
  spinner.start();

  let response: string;
  try {
    response = await callLLM(apiKey, messages);
  } catch (err) {
    spinner.stop();
    console.log(
      chalk.red(
        `  failed to connect to AI: ${err instanceof Error ? err.message : String(err)}`
      )
    );
    console.log(chalk.dim("  falling back to manual mode."));
    console.log("");
    await runFallbackMode(rl, info);
    return;
  }

  spinner.stop();

  messages.push({ role: "assistant", content: response });
  const initial = parseUpdatesFromResponse(response);

  // Write initial sections
  if (initial.updates.length > 0) {
    for (const update of initial.updates) {
      writeSectionFile(bundleDir, update.section, update.content);
    }
    console.log(
      chalk.cyan(
        `  [wrote ${initial.updates.length} section${initial.updates.length === 1 ? "" : "s"}: ${initial.updates.map((u) => sectionLabel(u.section)).join(", ")}]`
      )
    );
    console.log("");
  }

  // Show agent message
  printAgentMessage(initial.display);

  // Show mini profile box after initial generation
  if (initial.updates.length > 0) {
    const aboutUpdate = initial.updates.find(
      (u) => u.section === "profile/about.md"
    );
    if (aboutUpdate) {
      // Extract headline from about content
      const lines = aboutUpdate.content
        .replace(/---[\s\S]*?---/, "")
        .trim()
        .split("\n")
        .filter((l) => l.trim() && !l.startsWith("#"));
      const headline = lines[0] || "";
      showProfileBox(info.name, headline.slice(0, 60), "");
    }
  }

  console.log(
    chalk.dim(
      "  want to tell me more? i can ask about your projects, what you're working on now,"
    )
  );
  console.log(
    chalk.dim(
      '  your values, how you like AI to talk to you -- or just tell me anything.'
    )
  );
  console.log(
    chalk.dim(
      '  type "done" when you\'re ready to publish.'
    )
  );
  console.log("");

  // ── Conversation loop ──────────────────────────────────────────────
  let exchangeCount = 0;
  let skipCount = 0;

  while (true) {
    const userInput = await ask(rl, chalk.hex("#C46A3A")("  > ") + "");

    if (isDonePhrase(userInput)) {
      break;
    }

    // Handle skip: empty input or "skip"
    const isSkip = !userInput || userInput.toLowerCase().trim() === "skip";
    if (isSkip) {
      skipCount++;
      if (skipCount >= 3) {
        // After 3 skips, wrap up automatically
        console.log(chalk.dim("  wrapping up with what we have so far."));
        console.log("");
        break;
      }
      // Inject system message telling the agent to move on
      messages.push({
        role: "user",
        content: "(skip)",
      });
      messages.push({
        role: "system",
        content:
          "the user skipped this question. ask about the next topic on your list (projects, values, preferences, now, etc.) without dwelling on the skipped one. keep moving forward.",
      });
    } else {
      skipCount = 0;
      messages.push({ role: "user", content: userInput });

      // ── Auto-detect and auto-crawl URLs in user message ──
      const urlRegex = /(?:https?:\/\/[^\s<>"']+|(?<![/\w])([a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?\.(?:com|co|io|ai|dev|org|net|app|xyz|me))(?:\/[^\s<>"']*)?)/gi;
      const detectedUrls: string[] = [];
      let urlMatch: RegExpExecArray | null;
      const seenUrls = new Set<string>();
      while ((urlMatch = urlRegex.exec(userInput)) !== null) {
        let url = urlMatch[0].replace(/[.,;:)\]]+$/, "");
        if (!url.startsWith("http")) url = `https://${url}`;
        if (!seenUrls.has(url)) {
          seenUrls.add(url);
          detectedUrls.push(url);
        }
      }

      if (detectedUrls.length > 0) {
        console.log("");
        const scrapeResults: string[] = [];
        for (const url of detectedUrls) {
          const domain = url.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
          const sp = new BrailleSpinner(`${randomLabel("scrape")} (${domain})`);
          sp.start();
          try {
            const res = await fetch(SCRAPE_URL, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ url, platform: "website" }),
              signal: AbortSignal.timeout(30_000),
            });
            if (res.ok) {
              const data = (await res.json()) as { success?: boolean; data?: Record<string, unknown> };
              if (data.success && data.data) {
                const d = data.data;
                const parts = [`[SCRAPE RESULT: ${domain}]`];
                if (d.displayName) parts.push(`title: ${d.displayName}`);
                if (d.bio) parts.push(`description: ${d.bio}`);
                if (d.extras && (d.extras as Record<string, unknown>).bodyText) {
                  parts.push(`content: ${String((d.extras as Record<string, unknown>).bodyText).slice(0, 1500)}`);
                }
                scrapeResults.push(parts.join("\n"));
                sp.stop(`${domain} scraped`);
              } else {
                sp.stop(`${domain} — no data`);
              }
            } else {
              sp.fail(`${domain} — failed`);
            }
          } catch {
            sp.fail(`${domain} — timeout`);
          }
        }

        if (scrapeResults.length > 0) {
          messages.push({
            role: "user",
            content: `[PLATFORM AUTO-SCRAPE — real data from URLs the user mentioned. use this to describe their projects accurately. never ask the user to repeat information that was just scraped.]\n\n${scrapeResults.join("\n\n")}`,
          });
        }
        console.log("");
      }
    }
    exchangeCount++;

    // After 3+ exchanges, hint to the agent it can suggest wrapping up
    let ephemeralCount = 0;
    if (exchangeCount >= 3) {
      const hintMsg: ChatMessage = {
        role: "system",
        content:
          "the user has provided several rounds of input. if the profile feels rich enough (about, now, projects, values all have substance), you can suggest wrapping up. but if there are obvious gaps, keep asking.",
      };
      messages.push(hintMsg);
      ephemeralCount++;
    }

    // Also count the skip system message as ephemeral
    if (isSkip) ephemeralCount++;

    spinner = new BrailleSpinner(randomLabel("llm"));
    spinner.start();

    try {
      response = await callLLM(apiKey, messages);
    } catch (err) {
      spinner.stop();
      console.log(
        chalk.red(
          `  AI error: ${err instanceof Error ? err.message : String(err)}`
        )
      );
      console.log(
        chalk.dim("  try again, or type 'done' to finish.")
      );
      console.log("");
      // Remove all ephemeral + user messages from this failed turn
      for (let j = 0; j < ephemeralCount + 1; j++) messages.pop();
      if (isSkip) messages.pop(); // also remove the "(skip)" user message
      continue;
    }

    spinner.stop();

    // Remove ephemeral system messages from history (don't pollute context)
    // They sit between the user message and the response we're about to push
    for (let j = 0; j < ephemeralCount; j++) {
      messages.pop();
    }

    messages.push({ role: "assistant", content: response });
    const parsed = parseUpdatesFromResponse(response);

    // Write updates
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

    // Show agent message
    printAgentMessage(parsed.display);

    // Check if agent is suggesting we're done
    const lowerDisplay = parsed.display.toLowerCase();
    if (
      lowerDisplay.includes("ready to publish") ||
      lowerDisplay.includes("bundle is looking solid") ||
      lowerDisplay.includes("ready to go")
    ) {
      const answer = await ask(rl, chalk.hex("#C46A3A")("  > ") + "");
      if (
        isDonePhrase(answer) ||
        answer.toLowerCase().includes("publish") ||
        answer.toLowerCase().includes("yes") ||
        answer.toLowerCase().includes("yeah") ||
        answer.toLowerCase().includes("yep")
      ) {
        break;
      } else {
        messages.push({ role: "user", content: answer });

        spinner = new BrailleSpinner(randomLabel("llm"));
        spinner.start();

        try {
          response = await callLLM(apiKey, messages);
        } catch (err) {
          spinner.stop();
          console.log(
            chalk.red(
              `  AI error: ${err instanceof Error ? err.message : String(err)}`
            )
          );
          messages.pop();
          continue;
        }

        spinner.stop();

        messages.push({ role: "assistant", content: response });
        const more = parseUpdatesFromResponse(response);

        if (more.updates.length > 0) {
          for (const update of more.updates) {
            writeSectionFile(bundleDir, update.section, update.content);
          }
          console.log(
            chalk.cyan(
              `  [updated: ${more.updates.map((u) => sectionLabel(u.section)).join(", ")}]`
            )
          );
          console.log("");
        }

        printAgentMessage(more.display);
      }
    }
  }

  // Finish up
  await finishBundle(bundleDir, info.username, info.name);
}

function printAgentMessage(text: string): void {
  if (!text) return;
  // Ensure paragraphs have proper blank line separation
  const normalizedText = text
    .replace(/\n{3,}/g, "\n\n")  // collapse 3+ newlines to 2
    .replace(/([.?!])\n([a-z])/g, "$1\n\n$2");  // add blank line between sentences that run together

  const { renderRichResponse } = require("./render");
  const rendered = renderRichResponse(normalizedText) as string;

  // Find the last line that ends with "?" and highlight it in accent color
  const lines = rendered.split("\n");
  let lastQuestionIdx = -1;
  for (let i = lines.length - 1; i >= 0; i--) {
    // Strip ANSI codes to check for trailing "?"
    const stripped = lines[i].replace(/\x1b\[[0-9;]*m/g, "").trim();
    if (stripped.endsWith("?")) {
      lastQuestionIdx = i;
      break;
    }
  }

  if (lastQuestionIdx >= 0) {
    // Replace that line with accent-colored version (strip existing styling, re-apply accent)
    const raw = lines[lastQuestionIdx].replace(/\x1b\[[0-9;]*m/g, "");
    // Preserve leading whitespace
    const leadingSpace = raw.match(/^(\s*)/)?.[1] || "";
    const content = raw.trim();
    lines[lastQuestionIdx] = leadingSpace + chalk.hex("#C46A3A")(content);
  }

  console.log(lines.join("\n"));
  console.log("");
}

// ─── Finish and compile ───────────────────────────────────────────────

async function finishBundle(
  bundleDir: string,
  username: string,
  name: string
): Promise<void> {
  console.log("");

  const compileSpinner = new BrailleSpinner(randomLabel("compile"));
  compileSpinner.start();

  await new Promise((r) => setTimeout(r, 600));

  const result = compileBundle(bundleDir);
  writeBundle(bundleDir, result);

  compileSpinner.stop();

  console.log(
    "  " +
      chalk.hex("#C46A3A")("done") +
      chalk.dim(` -- bundle compiled (v${result.stats.version})`)
  );

  // Show final preview with stats
  const stats = showBundlePreview(bundleDir);

  console.log(
    chalk.dim(
      `  ${stats.fileCount} files, ${stats.filledCount} sections filled`
    )
  );
  console.log("");

  const accent = chalk.hex("#C46A3A");

  // What's next guide
  console.log("  " + accent("what's next:"));
  console.log("");
  console.log(`    1. ${chalk.cyan("youmd login")}              ${chalk.dim("-- connect to you.md")}`);
  console.log(`    2. ${chalk.cyan("youmd push")}               ${chalk.dim("-- publish to you.md/" + username)}`);
  console.log(`    3. ${chalk.cyan("youmd skill install all")}  ${chalk.dim("-- install identity-aware agent skills")}`);
  console.log(`    4. ${chalk.cyan("youmd skill init-project")} ${chalk.dim("-- CLAUDE.md + project-context/ in any repo")}`);
  console.log("");
  console.log("  " + accent("agent tools:"));
  console.log("");
  console.log(`    ${chalk.cyan("youmd skill link claude")}  ${chalk.dim("-- sync skills to .claude/skills/youmd/")}`);
  console.log(`    ${chalk.cyan("youmd skill link cursor")}  ${chalk.dim("-- sync skills to .cursor/rules/youmd.md")}`);
  console.log(`    ${chalk.cyan("youmd link create")}        ${chalk.dim("-- shareable context link for any agent")}`);
  console.log(`    ${chalk.cyan("youmd chat")}               ${chalk.dim("-- talk to the agent to update your profile")}`);
  console.log("");

  // Context link
  console.log("  " + chalk.bold("your context file is ready:"));
  console.log(
    "  " + chalk.cyan(`https://you.md/${username}/context`)
  );
  console.log("");

  console.log(
    "  " + chalk.bold(`welcome to the agent internet, ${name}.`)
  );
  console.log("");
}

// ─── Main onboarding flow ─────────────────────────────────────────────

export interface OnboardingResult {
  username: string;
  name: string;
  tagline: string;
  website?: string;
  linkedin?: string;
  twitter?: string;
  github?: string;
}

export async function runOnboarding(): Promise<void> {
  const rl = createRL();

  // ── ASCII logo splash ──────────────────────────────────────────────
  // Real YOU logo — same block-character font as the homepage hero
  printYouLogo();

  // ── Phase 1: Identity basics (fast, no LLM) ────────────────────────

  // Username
  let username = "";
  let usernameValid = false;

  while (!usernameValid) {
    username = await ask(
      rl,
      chalk.hex("#C46A3A")("  > ") + "pick a username: "
    );

    if (!username) {
      console.log(chalk.red("    username is required"));
      continue;
    }

    const localError = validateUsernameLocal(username.toLowerCase());
    if (localError) {
      console.log(chalk.red("    " + localError));
      continue;
    }

    username = username.toLowerCase();

    process.stdout.write(chalk.dim("    checking... "));
    const result = await checkUsernameRemote(username);

    if (result.available) {
      // Check if a profile already exists on you.md for this username
      let profileExists = false;
      try {
        const profileRes = await fetch(
          `https://you.md/${encodeURIComponent(username)}/context`,
          { method: "HEAD", signal: AbortSignal.timeout(5_000) }
        );
        profileExists = profileRes.ok;
      } catch {
        // ignore -- assume no profile
      }

      if (profileExists) {
        console.log(chalk.green(username + " is available."));
        console.log(
          chalk.dim(`    a profile for @${username} already exists on you.md -- you can claim it after login with `) +
          chalk.cyan("youmd login") +
          chalk.dim(" then ") +
          chalk.cyan("youmd pull")
        );
      } else {
        console.log(chalk.green(username + " is yours."));
      }
      usernameValid = true;
    } else {
      console.log(
        chalk.red(username + " is taken.") +
          (result.reason ? " " + result.reason : "")
      );
    }
  }

  console.log("");

  const name = await ask(
    rl,
    chalk.hex("#C46A3A")("  > ") + "what's your name? "
  );
  const website = await ask(
    rl,
    chalk.hex("#C46A3A")("  > ") +
      "website URL " +
      chalk.dim("(optional)") +
      ": "
  );
  const twitter = await ask(
    rl,
    chalk.hex("#C46A3A")("  > ") +
      "X/Twitter username " +
      chalk.dim("(optional, e.g. @houston)") +
      ": "
  );
  const github = await ask(
    rl,
    chalk.hex("#C46A3A")("  > ") +
      "GitHub username " +
      chalk.dim("(optional)") +
      ": "
  );
  const linkedin = await ask(
    rl,
    chalk.hex("#C46A3A")("  > ") +
      "LinkedIn URL " +
      chalk.dim("(optional)") +
      ": "
  );

  console.log("");

  // ── Render REAL ASCII portrait from first social handle ──────────
  const earlyTwitter = (twitter || "").replace(/^@/, "").trim();
  const earlyGithub = (github || "").trim();
  const firstHandle = earlyTwitter || earlyGithub;
  if (firstHandle) {
    // Get the profile image URL — GitHub is most reliable for direct image access
    const imageUrl = earlyGithub
      ? `https://avatars.githubusercontent.com/${earlyGithub}?s=200`
      : `https://unavatar.io/x/${earlyTwitter}`;

    const portraitSpinner = new BrailleSpinner("fetching your profile image");
    portraitSpinner.start();

    // Preload the image silently, then stop spinner before rendering
    let portraitLines: string[] | null = null;
    try {
      const Jimp = (await import("jimp")).default;
      const img = await Jimp.read(imageUrl);
      portraitSpinner.stop("got it — rendering portrait");
      console.log("");

      // Now render the portrait line by line (the actual wow moment)
      const RAMP = `$@B%8&#*oahkbdpqwmZO0QLCJUYXzcvunxrjft/|()1{}?-_+~<>i!lI;:,". `;
      const cols = 60;
      const rows = Math.floor(cols * (img.getHeight() / img.getWidth()) * 0.46);
      img.resize(cols, rows);
      img.contrast(0.3);
      img.brightness(0.05);

      portraitLines = [];
      for (let y = 0; y < rows; y++) {
        let coloredLine = "";
        let plainLine = "";
        for (let x = 0; x < cols; x++) {
          const pixel = Jimp.intToRGBA(img.getPixelColor(x, y));
          const lum = 0.299 * pixel.r + 0.587 * pixel.g + 0.114 * pixel.b;
          const ch = RAMP[Math.floor((lum / 255) * (RAMP.length - 1))];
          plainLine += ch;
          // Orange-tinted colors based on luminance
          const brightness = Math.floor((lum / 255) * 100);
          if (brightness < 10) {
            coloredLine += chalk.hidden(ch);
          } else if (brightness < 30) {
            coloredLine += chalk.hex("#5A3018")(ch);
          } else if (brightness < 50) {
            coloredLine += chalk.hex("#8A4828")(ch);
          } else if (brightness < 70) {
            coloredLine += chalk.hex("#B06038")(ch);
          } else if (brightness < 85) {
            coloredLine += chalk.hex("#C46A3A")(ch);
          } else {
            coloredLine += chalk.hex("#E09060")(ch);
          }
        }
        portraitLines.push(plainLine);
        process.stdout.write(`  ${coloredLine}\n`);
      }
    } catch {
      portraitSpinner.stop("couldn't fetch image — we'll try again later");
    }

    if (portraitLines) {
      console.log("");
      console.log("  " + chalk.hex("#C46A3A")(randomPortraitComment()));
      console.log("");

      // Save portrait data locally for push to web API
      const bundleDir = getLocalBundleDir();
      try {
        const portraitData = {
          lines: portraitLines,
          cols: 60,
          rows: portraitLines.length,
          format: "classic",
          sourceUrl: imageUrl,
          generatedAt: Date.now(),
        };
        fs.mkdirSync(bundleDir, { recursive: true });
        fs.writeFileSync(
          path.join(bundleDir, "portrait.json"),
          JSON.stringify(portraitData, null, 2)
        );
        // Also save the source image URL as avatarUrl in config
        const config = readGlobalConfig();
        config.avatarUrl = imageUrl;
        writeGlobalConfig(config);
      } catch {
        // non-fatal — portrait save failed silently
      }
    } else {
      portraitSpinner.stop("couldn't render — no worries, we'll try again later");
    }
  }

  // ── Multi-select: coding agents and AI apps ───────────────────────
  const selectedAgents = await multiSelectPrompt(
    rl,
    "which coding agents do you use?",
    CODING_AGENTS
  );

  const selectedApps = await multiSelectPrompt(
    rl,
    "which AI apps do you regularly use?",
    AI_APPS
  );

  // ── Scrape social profiles ────────────────────────────────────────
  const twitterHandle = (twitter || "").replace(/^@/, "").trim();
  const githubHandle = (github || "").trim();

  let twitterData: ScrapeResult | null = null;
  let githubData: ScrapeResult | null = null;

  if (twitterHandle) {
    const scrapeSpinner = new BrailleSpinner(randomLabel("scrape"));
    scrapeSpinner.start();
    twitterData = await scrapeProfile(`https://x.com/${twitterHandle}`);
    scrapeSpinner.stop();

    if (twitterData) {
      displayScrapeResult("X", twitterData);
    } else {
      console.log(chalk.dim("  couldn't pull X profile -- no worries."));
      console.log("");
    }
  }

  if (githubHandle) {
    const scrapeSpinner = new BrailleSpinner(randomLabel("scrape"));
    scrapeSpinner.start();
    githubData = await scrapeProfile(`https://github.com/${githubHandle}`);
    scrapeSpinner.stop();

    if (githubData) {
      displayScrapeResult("GitHub", githubData);
    } else {
      console.log(chalk.dim("  couldn't pull GitHub profile -- no worries."));
      console.log("");
    }
  }

  // ── Research the user via Perplexity ──────────────────────────────
  const links: string[] = [];
  if (website) links.push(website);
  if (twitterHandle) links.push(`https://x.com/${twitterHandle}`);
  if (githubHandle) links.push(`https://github.com/${githubHandle}`);
  if (linkedin) links.push(linkedin);

  let researchData: ResearchResult | null = null;

  if (name || twitterHandle || githubHandle) {
    const researchSpinner = new BrailleSpinner(randomLabel("research"));
    researchSpinner.start();
    researchData = await researchUser({
      name: name || username,
      username: twitterHandle || githubHandle || username,
      links: links.length > 0 ? links : undefined,
    });
    researchSpinner.stop();

    if (researchData) {
      const summary =
        researchData.summary ||
        researchData.content ||
        (researchData.findings ? researchData.findings.join(" ") : null);
      if (summary) {
        console.log(chalk.dim("  research complete -- found context about you."));
        console.log("");
      }
    }
  }

  const twitterUrl = twitterHandle ? `https://x.com/${twitterHandle}` : "";
  const githubUrl = githubHandle ? `https://github.com/${githubHandle}` : "";

  const basicInfo: BasicInfo = {
    username,
    name: name || username,
    website: website || "",
    linkedin: linkedin || "",
    twitter: twitterUrl,
    github: githubUrl,
  };

  // Check for existing bundle
  const bundleDir = getLocalBundleDir();
  if (fs.existsSync(bundleDir)) {
    console.log(
      chalk.yellow("  .youmd/ already exists. overwriting profile files.")
    );
    console.log("");
  }

  // ── Phase 2: AI conversation ──────────────────────────────────────

  const userApiKey = getOpenRouterKey();

  console.log(
    chalk.dim("  cool. let's build your identity.")
  );
  console.log("");

  // Build agent context from multi-select
  const agentContext: string[] = [];
  if (selectedAgents.length > 0) {
    agentContext.push(`coding agents they use: ${selectedAgents.join(", ")}`);
  }
  if (selectedApps.length > 0) {
    agentContext.push(`AI apps they regularly use: ${selectedApps.join(", ")}`);
  }

  try {
    await runAIMode(
      rl,
      basicInfo,
      userApiKey,
      { twitter: twitterData, github: githubData },
      researchData,
      agentContext.length > 0 ? agentContext : undefined
    );
  } catch {
    console.log(chalk.dim("  switching to manual mode."));
    await runFallbackMode(rl, basicInfo);
  }

  rl.close();
}

// Re-export for backward compatibility with create.ts
export async function createBundle(
  info: OnboardingResult
): Promise<void> {
  const bundleDir = getLocalBundleDir();
  const profileDir = path.join(bundleDir, "profile");
  const preferencesDir = path.join(bundleDir, "preferences");

  fs.mkdirSync(profileDir, { recursive: true });
  fs.mkdirSync(preferencesDir, { recursive: true });

  writeSectionFile(
    bundleDir,
    "profile/about.md",
    `---\ntitle: "About"\n---\n\n# ${info.name}\n\n${info.tagline}\n`
  );

  const linkLines: string[] = [];
  if (info.website) linkLines.push(`- **Website**: ${info.website}`);
  if (info.linkedin) linkLines.push(`- **LinkedIn**: ${info.linkedin}`);
  if (info.twitter) linkLines.push(`- **X/Twitter**: ${info.twitter}`);
  if (info.github) linkLines.push(`- **GitHub**: ${info.github}`);

  writeSectionFile(
    bundleDir,
    "profile/links.md",
    `---\ntitle: "Links"\n---\n\n${linkLines.length > 0 ? linkLines.join("\n") : "<!-- Add your links here -->"}\n`
  );

  writeSectionFile(
    bundleDir,
    "profile/now.md",
    `---\ntitle: "Now"\n---\n\n<!-- What are you working on right now? -->\n`
  );
  writeSectionFile(
    bundleDir,
    "profile/projects.md",
    `---\ntitle: "Projects"\n---\n\n<!-- Your projects go here -->\n`
  );
  writeSectionFile(
    bundleDir,
    "profile/values.md",
    `---\ntitle: "Values"\n---\n\n<!-- What principles guide your work? -->\n`
  );
  writeSectionFile(
    bundleDir,
    "preferences/agent.md",
    `---\ntitle: "Agent"\n---\n\n<!-- How should AI agents interact with you? -->\n`
  );
  writeSectionFile(
    bundleDir,
    "preferences/writing.md",
    `---\ntitle: "Writing"\n---\n\n<!-- Your writing style and tone. -->\n`
  );

  writeLocalConfig({ version: 0, sources: [] });

  const result = compileBundle(bundleDir);
  writeBundle(bundleDir, result);

  console.log(
    "  " +
      chalk.hex("#C46A3A")("done") +
      chalk.dim(` -- bundle compiled (v${result.stats.version})`)
  );
  console.log("");

  showBundlePreview(bundleDir);
}

// ─── Exports for chat command ─────────────────────────────────────────

export {
  callLLM,
  parseUpdatesFromResponse,
  writeSectionFile,
  sectionLabel,
  showBundlePreview,
  fetchWebsiteContent,
  scrapeProfile,
  researchUser,
  getOpenRouterKey,
  BrailleSpinner as Spinner,
  randomThinking,
  randomLabel,
  SYSTEM_PROMPT,
  BUNDLE_SECTIONS,
  CHAT_PROXY_URL,
  SCRAPE_URL,
  RESEARCH_URL,
};
export type { ChatMessage, SectionUpdate, BundleSection, BasicInfo, ScrapeResult, ResearchResult };
