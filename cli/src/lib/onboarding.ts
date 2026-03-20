import * as readline from "readline";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import chalk from "chalk";
import {
  getLocalBundleDir,
  writeLocalConfig,
  readGlobalConfig,
  isAuthenticated,
} from "./config";
import { compileBundle, writeBundle } from "./compiler";

// ─── Constants ────────────────────────────────────────────────────────

const CHAT_PROXY_URL =
  "https://kindly-cassowary-600.convex.site/api/v1/chat";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODEL = "anthropic/claude-sonnet-4";

const USERNAME_RE = /^[a-z0-9][a-z0-9_-]{1,38}[a-z0-9]$/;

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
  "encoding your identity bundle",
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

const SYSTEM_PROMPT = `you are the you.md agent. you help humans build their identity file for the agent internet. you are their first AI that truly knows them.

personality:
- warm but not gushy. direct. a dash of dry wit when it lands naturally.
- genuinely curious about people — you actually want to learn what makes them tick.
- terminal-native tone: lowercase, no exclamation marks, no emoji, short sentences.
- proactive — don't just wait for answers, connect dots, make observations, suggest things.
- reference specific things you learn about them. make them feel seen.
- you're like a sharp coworker who's also a great listener.

you're building a you-md/v1 identity bundle. the sections are:
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
4. keep the conversation going until you have enough for a rich identity bundle
5. never tell the user to edit markdown files themselves — you handle all of that
6. reference specific things you learned about them
7. if someone shares links, immediately offer to pull context from them
8. be proactive: "i noticed you mentioned X — want me to add that to your projects?"
9. occasionally remind them of what you've captured so far

conversational style examples:
- "cool. let me go read your site."
- "ok so you're basically a linkedin whisperer. noted."
- "that's a solid stack. let me capture that."
- "interesting — so you're more on the strategy side than pure engineering?"
- "i've got a good picture of what you do. want to tell me what you actually care about?"
- "that's a lot of projects. which one keeps you up at night?"
- "your bundle is looking solid. ready to publish, or should we keep going?"

rules for content in updates:
- each section must start with a YAML frontmatter block (--- title: "SectionTitle" ---)
- content should be real markdown, not HTML comments or placeholders
- be substantive. write real prose based on what you know.
- for links.md, format as: - **Label**: URL — brief annotation
- for agent.md, describe how agents should interact with this person
- for writing.md, capture their tone/style from how they've been talking to you

when you think the profile is rich enough (at least about, now, projects, and values have substance), suggest finishing by saying something like "your bundle is looking solid. ready to publish, or want to keep going?"

important: keep responses concise. 2-4 sentences max per turn. ask one good question at a time, not a list. be a conversation, not a questionnaire.`;

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

// ─── Spinner ──────────────────────────────────────────────────────────

class Spinner {
  private interval: ReturnType<typeof setInterval> | null = null;
  private frames = ["   ", ".  ", ".. ", "..."];
  private frameIndex = 0;
  private label: string;

  constructor(label?: string) {
    this.label = label || randomThinking();
  }

  start(): void {
    process.stdout.write(chalk.dim(`  ${this.label}...`));
    this.interval = setInterval(() => {
      this.frameIndex = (this.frameIndex + 1) % this.frames.length;
      const f = this.frames[this.frameIndex];
      process.stdout.write(`\r${chalk.dim(`  ${this.label}${f}`)}`);
    }, 300);
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    process.stdout.write("\r" + " ".repeat(80) + "\r");
  }
}

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
  const filePath = path.join(bundleDir, section);
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
  console.log("  " + chalk.bold("your identity bundle:"));
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
    chalk.green("  > ") + "give me your one-liner. what do you do? "
  );
  const nowFocus = await ask(
    rl,
    chalk.green("  > ") + "what are you focused on right now? "
  );
  const projects = await ask(
    rl,
    chalk.green("  > ") + "name your top projects (comma-separated): "
  );
  const values = await ask(
    rl,
    chalk.green("  > ") + "what principles guide your work? "
  );
  const agentPrefs = await ask(
    rl,
    chalk.green("  > ") +
      "how should AI agents talk to you? (e.g., direct, casual, formal): "
  );

  writeSectionFile(
    bundleDir,
    "profile/about.md",
    `---\ntitle: "About"\n---\n\n# ${info.name}\n\n${tagline}\n`
  );

  writeSectionFile(
    bundleDir,
    "profile/now.md",
    `---\ntitle: "Now"\n---\n\n${nowFocus || "<!-- What are you working on right now? -->"}\n`
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

  writeSectionFile(
    bundleDir,
    "profile/values.md",
    `---\ntitle: "Values"\n---\n\n${values || "<!-- What do you care about? -->"}\n`
  );

  const linkLines: string[] = [];
  if (info.website) linkLines.push(`- **Website**: ${info.website}`);
  if (info.linkedin) linkLines.push(`- **LinkedIn**: ${info.linkedin}`);
  if (info.twitter) linkLines.push(`- **X/Twitter**: ${info.twitter}`);

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
  apiKey: string | null
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
    const fetchSpinner = new Spinner("reading your site");
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

  let initialUserMessage = `here's what i know so far:
- name: ${info.name}
- username: ${info.username}
${linksInfo.length > 0 ? linksInfo.map((l) => `- ${l}`).join("\n") : "- no links provided"}`;

  if (websiteContent) {
    initialUserMessage += `

i also fetched their website content. here's what the site says:
---
${websiteContent}
---

analyze the website content. comment on what you found — be specific about their work, role, company, anything interesting. then generate initial profile sections from everything you know. after showing what you found, ask what else they want to add.`;
  } else {
    initialUserMessage += `

generate initial profile sections from what you know, show a brief summary, and ask conversational follow-up questions to learn more.`;
  }

  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: initialUserMessage },
  ];

  // ── Initial LLM call ──────────────────────────────────────────────
  let spinner = new Spinner(randomThinking());
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

  while (true) {
    const userInput = await ask(rl, chalk.green("  > ") + "");

    if (!userInput) continue;

    if (isDonePhrase(userInput)) {
      break;
    }

    messages.push({ role: "user", content: userInput });
    exchangeCount++;

    // After 3+ exchanges, hint to the agent it can suggest wrapping up
    if (exchangeCount >= 3) {
      const hintMsg: ChatMessage = {
        role: "system",
        content:
          "the user has provided several rounds of input. if the profile feels rich enough (about, now, projects, values all have substance), you can suggest wrapping up. but if there are obvious gaps, keep asking.",
      };
      messages.push(hintMsg);
    }

    spinner = new Spinner(randomThinking());
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
      // Remove failed messages
      messages.pop(); // remove hint if added
      if (exchangeCount >= 3) messages.pop();
      continue;
    }

    spinner.stop();

    // Remove the hint message from history (don't pollute context)
    if (exchangeCount >= 3) {
      messages.pop(); // remove the hint
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
      const answer = await ask(rl, chalk.green("  > ") + "");
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

        spinner = new Spinner(randomThinking());
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
  const lines = text.split("\n");
  for (const line of lines) {
    console.log("  " + line);
  }
  console.log("");
}

// ─── Finish and compile ───────────────────────────────────────────────

async function finishBundle(
  bundleDir: string,
  username: string,
  name: string
): Promise<void> {
  console.log("");

  const compileSpinner = new Spinner("compiling your context bundle");
  compileSpinner.start();

  await new Promise((r) => setTimeout(r, 600));

  const result = compileBundle(bundleDir);
  writeBundle(bundleDir, result);

  compileSpinner.stop();

  console.log(
    "  " +
      chalk.green("done") +
      chalk.dim(` -- bundle compiled (v${result.bundle.version})`)
  );

  // Show final preview with stats
  const stats = showBundlePreview(bundleDir);

  console.log(
    chalk.dim(
      `  ${stats.fileCount} files, ${stats.filledCount} sections filled`
    )
  );
  console.log("");

  // Context link
  console.log("  " + chalk.bold("your context file is ready:"));
  console.log(
    "  " + chalk.cyan(`https://you.md/${username}/context`)
  );
  console.log("");

  // Publish flow
  if (isAuthenticated()) {
    console.log(
      "  you're authenticated. publish with: " +
        chalk.cyan("youmd publish")
    );
  } else {
    console.log("  " + chalk.bold("to go live:"));
    console.log(
      "    1. claim your username at " +
        chalk.cyan("https://you.md/claim")
    );
    console.log(
      "    2. " + chalk.cyan("youmd login --key <your-api-key>")
    );
    console.log("    3. " + chalk.cyan("youmd publish"));
  }

  console.log("");
  console.log("  " + chalk.bold("using your identity with AI agents:"));
  console.log(
    "    add this to your system prompt or CLAUDE.md:"
  );
  console.log(
    chalk.dim(
      `    "my identity file: https://you.md/${username}/context"`
    )
  );
  console.log("");
  console.log(
    "  " +
      chalk.dim("run ") +
      chalk.cyan("youmd build") +
      chalk.dim(" anytime to recompile, or ") +
      chalk.cyan("youmd chat") +
      chalk.dim(" to keep editing with AI.")
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
}

export async function runOnboarding(): Promise<void> {
  const rl = createRL();

  console.log("");
  console.log("  " + chalk.bold("you.md"));
  console.log(
    "  " + chalk.dim("your identity file for the agent internet")
  );
  console.log("");

  // ── Phase 1: Identity basics (fast, no LLM) ────────────────────────

  // Username
  let username = "";
  let usernameValid = false;

  while (!usernameValid) {
    username = await ask(
      rl,
      chalk.green("  > ") + "pick a username: "
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
      console.log(chalk.green(username + " is yours."));
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
    chalk.green("  > ") + "what's your name? "
  );
  const website = await ask(
    rl,
    chalk.green("  > ") +
      "website URL " +
      chalk.dim("(optional)") +
      ": "
  );
  const linkedin = await ask(
    rl,
    chalk.green("  > ") +
      "LinkedIn URL " +
      chalk.dim("(optional)") +
      ": "
  );
  const twitter = await ask(
    rl,
    chalk.green("  > ") +
      "X/Twitter URL " +
      chalk.dim("(optional)") +
      ": "
  );

  console.log("");

  const basicInfo: BasicInfo = {
    username,
    name: name || username,
    website: website || "",
    linkedin: linkedin || "",
    twitter: twitter || "",
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

  try {
    await runAIMode(rl, basicInfo, userApiKey);
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
      chalk.green("done") +
      chalk.dim(` -- bundle compiled (v${result.bundle.version})`)
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
  getOpenRouterKey,
  Spinner,
  randomThinking,
  SYSTEM_PROMPT,
  BUNDLE_SECTIONS,
  CHAT_PROXY_URL,
};
export type { ChatMessage, SectionUpdate, BundleSection, BasicInfo };
