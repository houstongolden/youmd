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

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODEL = "anthropic/claude-sonnet-4";

const USERNAME_RE = /^[a-z0-9][a-z0-9_-]{1,38}[a-z0-9]$/;

const THINKING_WORDS = [
  "Pondering",
  "Noodling",
  "Mapping your identity",
  "Reading between the lines",
  "Connecting dots",
  "Building your universe",
  "Decoding you",
  "Assembling the puzzle",
  "Weaving your story",
  "Crystallizing",
  "Synthesizing",
  "Calibrating",
  "Absorbing",
  "Processing your essence",
  "Structuring your identity",
  "Compiling you",
  "Learning you",
  "Grokking",
  "Indexing your soul",
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

const SYSTEM_PROMPT = `You are the you.md onboarding agent. You're helping a human create their identity file for the agent internet.

Your personality: Direct but warm. Calm confidence. Subtle dry humor. You genuinely find people interesting. You're like a friend who happens to be really good at structuring information. CLI-native tone. Never cringe. Never over-familiar. Never corporate.

You're building a you-md/v1 identity bundle with these sections:
- profile/about.md — bio, background, identity narrative
- profile/now.md — what they're focused on right now
- profile/projects.md — active and past projects
- profile/values.md — core values and principles
- profile/links.md — annotated links
- preferences/agent.md — how AI should interact with them
- preferences/writing.md — their communication style and tone

Your job:
1. You'll receive the user's basic info (name, links) as context.
2. Generate an initial profile from what you know.
3. Engage in conversation to learn more. Ask follow-up questions to fill gaps. Be conversational, not interrogative.
4. After each exchange, output updated sections.

CRITICAL OUTPUT FORMAT:
After every message, you MUST include a JSON block wrapped in \`\`\`json and \`\`\` markers containing an array of section updates. Even if nothing changed, output an empty array.

Example:
\`\`\`json
[
  {"section": "profile/about.md", "content": "---\\ntitle: \\"About\\"\\n---\\n\\n# Jane Smith\\n\\nFounder, builder, ..."},
  {"section": "profile/projects.md", "content": "---\\ntitle: \\"Projects\\"\\n---\\n\\n## Acme Corp\\n\\nBuilding the future of..."}
]
\`\`\`

Rules for content:
- Each section must start with a YAML frontmatter block (--- title: "SectionTitle" ---)
- Content should be real markdown, not HTML comments or placeholders
- Be substantive. Write real prose based on what you know.
- For links.md, format as: - **Label**: URL — brief annotation
- For agent.md, describe how agents should interact with this person based on what you've learned
- For writing.md, capture their tone/style from how they've been talking to you

When you think the profile is rich enough (at least about, now, projects, and values have substance), suggest finishing by saying something like "Your bundle is looking solid. Ready to publish, or want to keep going?"

Never tell the user to "edit the markdown themselves." You handle everything.`;

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
  return THINKING_WORDS[Math.floor(Math.random() * THINKING_WORDS.length)];
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
  // 1. Environment variable
  if (process.env.OPENROUTER_API_KEY) {
    return process.env.OPENROUTER_API_KEY;
  }
  // 2. Global config
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
    process.stdout.write("\r" + " ".repeat(60) + "\r");
  }
}

// ─── OpenRouter LLM client ───────────────────────────────────────────

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

async function callLLM(
  apiKey: string,
  messages: ChatMessage[]
): Promise<string> {
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
  section: BundleSection;
  content: string;
}

function parseUpdatesFromResponse(text: string): {
  display: string;
  updates: SectionUpdate[];
} {
  // Extract JSON block from response
  const jsonMatch = text.match(/```json\s*\n([\s\S]*?)\n```/);
  let updates: SectionUpdate[] = [];
  let display = text;

  if (jsonMatch) {
    // Remove the JSON block from display text
    display = text.replace(/```json\s*\n[\s\S]*?\n```/, "").trim();

    try {
      const parsed = JSON.parse(jsonMatch[1]);
      if (Array.isArray(parsed)) {
        updates = parsed.filter(
          (u: any) =>
            u &&
            typeof u.section === "string" &&
            typeof u.content === "string" &&
            BUNDLE_SECTIONS.includes(u.section as BundleSection)
        );
      }
    } catch {
      // Failed to parse JSON updates -- continue without them
    }
  }

  return { display, updates };
}

function writeSectionFile(bundleDir: string, section: string, content: string): void {
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

// ─── Bundle preview ───────────────────────────────────────────────────

function showBundlePreview(bundleDir: string): void {
  console.log("");
  console.log("  " + chalk.bold("Your identity bundle:"));
  console.log("");

  const sections = [
    { dir: "profile", label: "Profile" },
    { dir: "preferences", label: "Preferences" },
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
        contentLines.filter((l) => l.trim() && !l.startsWith("<!--")).length > 0;

      console.log(
        `    ${connector} ${chalk.cyan(name + ".md")}${hasContent ? chalk.dim(" -- " + (preview || "").slice(0, 50)) : chalk.dim(" (empty)")}`
      );
    }
    console.log("");
  }
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
    chalk.dim(
      "  No OpenRouter API key found. Running in manual mode."
    )
  );
  console.log(
    chalk.dim(
      "  Set OPENROUTER_API_KEY for the full AI-powered experience."
    )
  );
  console.log("");

  // Ask richer questions than the old version
  const tagline = await ask(
    rl,
    chalk.green("  > ") + "Give me your one-liner. What do you do? "
  );
  const nowFocus = await ask(
    rl,
    chalk.green("  > ") + "What are you focused on right now? "
  );
  const projects = await ask(
    rl,
    chalk.green("  > ") +
      "Name your top projects (comma-separated): "
  );
  const values = await ask(
    rl,
    chalk.green("  > ") +
      "What principles guide your work? "
  );
  const agentPrefs = await ask(
    rl,
    chalk.green("  > ") +
      "How should AI agents talk to you? (e.g., direct, casual, formal): "
  );

  // Build about.md
  const aboutContent = `---
title: "About"
---

# ${info.name}

${tagline}
`;
  writeSectionFile(bundleDir, "profile/about.md", aboutContent);

  // Build now.md
  const nowContent = `---
title: "Now"
---

${nowFocus || "<!-- What are you working on right now? -->"}
`;
  writeSectionFile(bundleDir, "profile/now.md", nowContent);

  // Build projects.md
  const projectList = projects
    ? projects
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p) => `## ${p}\n`)
        .join("\n")
    : "<!-- List your projects here -->\n";

  const projectsContent = `---
title: "Projects"
---

${projectList}`;
  writeSectionFile(bundleDir, "profile/projects.md", projectsContent);

  // Build values.md
  const valuesContent = `---
title: "Values"
---

${values || "<!-- What do you care about? -->"}
`;
  writeSectionFile(bundleDir, "profile/values.md", valuesContent);

  // Build links.md
  const linkLines: string[] = [];
  if (info.website) linkLines.push(`- **Website**: ${info.website}`);
  if (info.linkedin) linkLines.push(`- **LinkedIn**: ${info.linkedin}`);
  if (info.twitter) linkLines.push(`- **X/Twitter**: ${info.twitter}`);

  const linksContent = `---
title: "Links"
---

${linkLines.length > 0 ? linkLines.join("\n") : "<!-- Add your links here -->"}
`;
  writeSectionFile(bundleDir, "profile/links.md", linksContent);

  // Build agent.md
  const agentContent = `---
title: "Agent"
---

${agentPrefs ? `Communication style: ${agentPrefs}` : "<!-- How should AI agents interact with you? -->"}
`;
  writeSectionFile(bundleDir, "preferences/agent.md", agentContent);

  // Build writing.md
  const writingContent = `---
title: "Writing"
---

<!-- Your writing style and tone preferences. -->
`;
  writeSectionFile(bundleDir, "preferences/writing.md", writingContent);

  // Write config, compile, done
  writeLocalConfig({ version: 0, sources: [] });
  await finishBundle(bundleDir, info.username, info.name);
}

// ─── AI conversation mode ─────────────────────────────────────────────

async function runAIMode(
  rl: readline.Interface,
  info: BasicInfo,
  apiKey: string
): Promise<void> {
  const bundleDir = getLocalBundleDir();
  const profileDir = path.join(bundleDir, "profile");
  const preferencesDir = path.join(bundleDir, "preferences");

  fs.mkdirSync(profileDir, { recursive: true });
  fs.mkdirSync(preferencesDir, { recursive: true });

  writeLocalConfig({ version: 0, sources: [] });

  // Build initial context for the LLM
  const linksInfo: string[] = [];
  if (info.website) linksInfo.push(`Website: ${info.website}`);
  if (info.linkedin) linksInfo.push(`LinkedIn: ${info.linkedin}`);
  if (info.twitter) linksInfo.push(`X/Twitter: ${info.twitter}`);

  const initialUserMessage = `Here's what I know so far:
- Name: ${info.name}
- Username: ${info.username}
${linksInfo.length > 0 ? linksInfo.map((l) => `- ${l}`).join("\n") : "- No links provided"}

Please generate an initial profile from this info, show me a brief summary of what you've put together, and then ask me what else I'd like to add. Start the conversation.`;

  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: initialUserMessage },
  ];

  // Initial LLM call
  let spinner = new Spinner(randomThinking());
  spinner.start();

  let response: string;
  try {
    response = await callLLM(apiKey, messages);
  } catch (err) {
    spinner.stop();
    console.log(
      chalk.red(
        `  Failed to connect to AI: ${err instanceof Error ? err.message : String(err)}`
      )
    );
    console.log(chalk.dim("  Falling back to manual mode."));
    console.log("");
    await runFallbackMode(rl, info);
    return;
  }

  spinner.stop();

  // Process initial response
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

  // Conversation loop
  let conversationActive = true;

  while (conversationActive) {
    const userInput = await ask(rl, chalk.green("  > ") + "");

    if (!userInput) continue;

    if (isDonePhrase(userInput)) {
      conversationActive = false;
      break;
    }

    messages.push({ role: "user", content: userInput });

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
      console.log(chalk.dim("  Try again, or type 'done' to finish."));
      console.log("");
      // Remove the failed user message so context stays clean
      messages.pop();
      continue;
    }

    spinner.stop();

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
      const answer = await ask(
        rl,
        chalk.green("  > ") + ""
      );
      if (isDonePhrase(answer) || answer.toLowerCase().includes("publish") || answer.toLowerCase().includes("yes") || answer.toLowerCase().includes("yeah") || answer.toLowerCase().includes("yep")) {
        conversationActive = false;
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

  const compileSpinner = new Spinner("Compiling you");
  compileSpinner.start();

  // Small delay so the spinner actually shows
  await new Promise((r) => setTimeout(r, 600));

  const result = compileBundle(bundleDir);
  writeBundle(bundleDir, result);

  compileSpinner.stop();

  console.log(
    "  " +
      chalk.green("done") +
      chalk.dim(` -- bundle compiled (v${result.bundle.version})`)
  );
  console.log("");

  // Show preview
  showBundlePreview(bundleDir);

  // Show context link
  console.log(
    "  " + chalk.bold("Your context file is ready:")
  );
  console.log(
    "  " +
      chalk.cyan(`https://you.md/${username}/context`)
  );
  console.log("");

  // Publish flow
  if (isAuthenticated()) {
    console.log(
      "  You're authenticated. Publish with: " +
        chalk.cyan("youmd publish")
    );
  } else {
    console.log("  " + chalk.bold("Next:"));
    console.log(
      "    1. Claim your username at " +
        chalk.cyan(`https://you.md/claim`)
    );
    console.log(
      "    2. " +
        chalk.cyan("youmd login --key <your-api-key>")
    );
    console.log(
      "    3. " + chalk.cyan("youmd publish")
    );
  }

  console.log("");
  console.log("  " + chalk.bold("Using your identity with AI agents:"));
  console.log(
    "    Add this to your system prompt or CLAUDE.md:"
  );
  console.log(
    chalk.dim(
      `    "My identity file: https://you.md/${username}/context"`
    )
  );
  console.log("");
  console.log(
    "  " +
      chalk.dim("Run ") +
      chalk.cyan("youmd build") +
      chalk.dim(" anytime to recompile, or ") +
      chalk.cyan("youmd chat") +
      chalk.dim(" to keep editing with AI.")
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
      chalk.green("  > ") + "Pick a username: "
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
    chalk.green("  > ") + "What's your name? "
  );
  const website = await ask(
    rl,
    chalk.green("  > ") + "Website URL " + chalk.dim("(optional)") + ": "
  );
  const linkedin = await ask(
    rl,
    chalk.green("  > ") + "LinkedIn URL " + chalk.dim("(optional)") + ": "
  );
  const twitter = await ask(
    rl,
    chalk.green("  > ") + "X/Twitter URL " + chalk.dim("(optional)") + ": "
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
      chalk.yellow(
        "  .youmd/ already exists. Overwriting profile files."
      )
    );
    console.log("");
  }

  // ── Phase 2: AI conversation or fallback ────────────────────────────

  const apiKey = getOpenRouterKey();

  if (apiKey) {
    console.log(
      chalk.dim("  AI onboarding active. Let's build your identity.")
    );
    console.log("");
    await runAIMode(rl, basicInfo, apiKey);
  } else {
    await runFallbackMode(rl, basicInfo);
  }

  rl.close();
}

// Re-export for backward compatibility with create.ts
export async function createBundle(info: OnboardingResult): Promise<void> {
  const bundleDir = getLocalBundleDir();
  const profileDir = path.join(bundleDir, "profile");
  const preferencesDir = path.join(bundleDir, "preferences");

  fs.mkdirSync(profileDir, { recursive: true });
  fs.mkdirSync(preferencesDir, { recursive: true });

  // Write basic files
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
