import * as readline from "readline";
import * as fs from "fs";
import * as path from "path";
import chalk from "chalk";
import {
  getLocalBundleDir,
  localBundleExists,
  isAuthenticated,
  readGlobalConfig,
} from "../lib/config";
import { compileBundle, writeBundle } from "../lib/compiler";
import { uploadBundle, publishLatest } from "../lib/api";
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

// ─── Constants ────────────────────────────────────────────────────────

const CHAT_SYSTEM_PROMPT = `you are the you.md agent. you help humans maintain their identity file for the agent internet. you are their first AI that truly knows them.

personality:
- warm but not gushy. direct. a dash of dry wit when it lands naturally.
- genuinely curious about people — you actually want to learn what makes them tick.
- terminal-native tone: lowercase, no exclamation marks, no emoji, short sentences.
- proactive — connect dots, make observations, suggest updates.
- reference specific things from their current profile. make them feel seen.
- you're like a sharp coworker who's also a great listener.

you're maintaining a you-md/v1 identity bundle. the sections are:
- profile/about.md — bio, background, narrative
- profile/now.md — current focus, what they're working on right now
- profile/projects.md — active projects with details
- profile/values.md — core values and principles
- profile/links.md — annotated links
- preferences/agent.md — how AI agents should interact with them
- preferences/writing.md — their communication style

the user already has a profile. you'll receive their current bundle content as context. your job:
1. help them update, refine, or expand their identity
2. if they tell you something new, update the relevant sections
3. after each exchange where something changed, output structured updates as JSON blocks:
   \`\`\`json
   {"updates": [{"section": "profile/about.md", "content": "...full markdown content for that section..."}]}
   \`\`\`
4. if nothing changed (just chatting), don't include the JSON block
5. never tell the user to edit markdown files themselves — you handle that
6. reference specific things from their current profile
7. be proactive: "looks like your projects section could use an update — want to add that?"

rules for content in updates:
- each section must start with a YAML frontmatter block (--- title: "SectionTitle" ---)
- content should be real markdown, not HTML comments or placeholders
- be substantive. always output the FULL section content (not just the changed part)
- for links.md, format as: - **Label**: URL — brief annotation
- for agent.md, describe how agents should interact with this person
- for writing.md, capture their tone/style

important: keep responses concise. 2-4 sentences max per turn. ask one good question at a time. be a conversation, not a questionnaire.`;

const SLASH_COMMANDS: Record<string, string> = {
  "/status": "show bundle status",
  "/preview": "show profile preview",
  "/publish": "publish bundle to you.md",
  "/link": "show context link info",
  "/share": "generate shareable context block",
  "/research": "run Perplexity research on your profile",
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
    rl.question(question, (answer) => {
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
      `  "my identity file: https://you.md/${username}/context"`
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
      `  compiled bundle v${result.bundle.version}`
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
      chalk.dim(` -- bundle v${result.bundle.version}`)
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

  const contextUrl = `https://kindly-cassowary-600.convex.site/api/v1/profiles?username=${username}`;
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
      content: `here is my current identity bundle:\n\n${currentBundle}\n\n${greetingInstruction}`,
    },
  ];

  // Initial greeting from agent
  const spinner = new Spinner(randomThinking());
  spinner.start();

  let response: string;
  try {
    response = await callLLM(apiKey, messages);
  } catch (err) {
    spinner.stop();
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

  spinner.stop();

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

    if (lower === "/research") {
      const researchOk = await handleResearch(bundleDir, messages);
      if (!researchOk) continue;
      // After research, get an LLM response with the injected context
      const researchSpinner = new Spinner(randomThinking());
      researchSpinner.start();

      try {
        response = await callLLM(apiKey, messages);
      } catch (err) {
        researchSpinner.stop();
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

      researchSpinner.stop();

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

    // Regular conversation -- send to LLM
    messages.push({ role: "user", content: userInput });

    const thinkSpinner = new Spinner(randomThinking());
    thinkSpinner.start();

    try {
      response = await callLLM(apiKey, messages);
    } catch (err) {
      thinkSpinner.stop();
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

    thinkSpinner.stop();

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

    printAgentMessage(parsed.display);
  }

  rl.close();
}

function printAgentMessage(text: string): void {
  if (!text) return;
  const lines = text.split("\n");
  for (const line of lines) {
    console.log("  " + line);
  }
  console.log("");
}
