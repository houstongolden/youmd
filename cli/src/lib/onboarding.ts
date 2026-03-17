import * as readline from "readline";
import * as fs from "fs";
import * as path from "path";
import chalk from "chalk";
import { getLocalBundleDir, writeLocalConfig } from "./config";
import { compileBundle, writeBundle } from "./compiler";

// ─── Prompt helpers ──────────────────────────────────────────────────

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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Username validation ─────────────────────────────────────────────

const USERNAME_RE = /^[a-z0-9][a-z0-9_-]{1,38}[a-z0-9]$/;

function validateUsernameLocal(username: string): string | null {
  if (username.length < 3) {
    return "must be at least 3 characters";
  }
  if (username.length > 40) {
    return "must be 40 characters or fewer";
  }
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
    if (!res.ok) {
      return { available: true, reason: null }; // fail open
    }
    const data = await res.json();
    return data as { available: boolean; reason: string | null };
  } catch {
    // Network error -- don't block onboarding
    return { available: true, reason: null };
  }
}

// ─── File content generators ─────────────────────────────────────────

function generateAboutMd(name: string, tagline: string): string {
  return `---
title: "About"
---

# ${name}

${tagline}
`;
}

function generateLinksMd(links: {
  website?: string;
  linkedin?: string;
  twitter?: string;
}): string {
  const lines: string[] = [
    '---',
    'title: "Links"',
    '---',
    '',
  ];

  if (links.website) {
    lines.push(`- **Website**: ${links.website}`);
  }
  if (links.linkedin) {
    lines.push(`- **LinkedIn**: ${links.linkedin}`);
  }
  if (links.twitter) {
    lines.push(`- **X/Twitter**: ${links.twitter}`);
  }

  if (!links.website && !links.linkedin && !links.twitter) {
    lines.push("<!-- Add your links here -->");
  }

  lines.push("");
  return lines.join("\n");
}

function generateNowMd(): string {
  return `---
title: "Now"
---

<!-- What are you working on right now? What's top of mind? -->
`;
}

function generateProjectsMd(): string {
  return `---
title: "Projects"
---

<!-- List your current and past projects. What have you built? -->
`;
}

function generateValuesMd(): string {
  return `---
title: "Values"
---

<!-- What do you care about? What principles guide your work? -->
`;
}

function generateAgentMd(): string {
  return `---
title: "Agent"
---

<!-- How should AI agents interact with your identity? -->
<!-- What context should they have? What permissions do they get? -->
`;
}

function generateWritingMd(): string {
  return `---
title: "Writing"
---

<!-- Your writing style, tone, and preferences. -->
<!-- Agents use this to communicate on your behalf. -->
`;
}

// ─── Tree progress display ───────────────────────────────────────────

function treeStep(label: string, isLast: boolean): void {
  const connector = isLast ? "\\--" : "|--";
  console.log(`  ${connector} ${label}`);
}

// ─── Main onboarding flow ────────────────────────────────────────────

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
  console.log("  your identity file for the agent internet");
  console.log("");
  console.log("  Agents have soul.md. Humans need you.md.");
  console.log("");

  // ── Username ─────────────────────────────────────────────────────

  let username = "";
  let usernameValid = false;

  while (!usernameValid) {
    username = await ask(rl, chalk.green("  ? ") + "Choose a username: ");

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

    process.stdout.write("    checking... ");
    const result = await checkUsernameRemote(username);

    if (result.available) {
      console.log(chalk.green(username + " is available."));
      usernameValid = true;
    } else {
      console.log(
        chalk.red(username + " is taken.") +
          (result.reason ? " " + result.reason : "")
      );
    }
  }

  console.log("");

  // ── Profile info ─────────────────────────────────────────────────

  const name = await ask(rl, chalk.green("  ? ") + "Your name: ");
  const website = await ask(
    rl,
    chalk.green("  ? ") + "Your website (optional): "
  );
  const linkedin = await ask(
    rl,
    chalk.green("  ? ") + "Your LinkedIn URL (optional): "
  );
  const twitter = await ask(
    rl,
    chalk.green("  ? ") + "Your X/Twitter URL (optional): "
  );
  const tagline = await ask(
    rl,
    chalk.green("  ? ") + "One-line tagline: "
  );

  rl.close();

  console.log("");

  // ── Build the bundle ─────────────────────────────────────────────

  await createBundle({
    username,
    name: name || username,
    tagline: tagline || "",
    website: website || undefined,
    linkedin: linkedin || undefined,
    twitter: twitter || undefined,
  });
}

export async function createBundle(info: OnboardingResult): Promise<void> {
  const bundleDir = getLocalBundleDir();
  const profileDir = path.join(bundleDir, "profile");
  const preferencesDir = path.join(bundleDir, "preferences");

  // Check if directory already exists
  if (fs.existsSync(bundleDir)) {
    console.log(
      chalk.yellow("  warning: .youmd/ directory already exists. Overwriting profile files.")
    );
    console.log("");
  }

  console.log("  Building your identity bundle...");

  // Create directories
  fs.mkdirSync(profileDir, { recursive: true });
  fs.mkdirSync(preferencesDir, { recursive: true });

  treeStep("Initializing .youmd/ directory", false);

  // Write profile files with actual user data
  fs.writeFileSync(
    path.join(profileDir, "about.md"),
    generateAboutMd(info.name, info.tagline)
  );
  treeStep("Writing profile/about.md", false);

  fs.writeFileSync(
    path.join(profileDir, "links.md"),
    generateLinksMd({
      website: info.website,
      linkedin: info.linkedin,
      twitter: info.twitter,
    })
  );
  treeStep("Writing profile/links.md", false);

  // Write remaining profile stubs
  fs.writeFileSync(path.join(profileDir, "now.md"), generateNowMd());
  fs.writeFileSync(
    path.join(profileDir, "projects.md"),
    generateProjectsMd()
  );
  fs.writeFileSync(path.join(profileDir, "values.md"), generateValuesMd());

  // Write preference stubs
  fs.writeFileSync(
    path.join(preferencesDir, "agent.md"),
    generateAgentMd()
  );
  treeStep("Writing preferences/agent.md", false);

  fs.writeFileSync(
    path.join(preferencesDir, "writing.md"),
    generateWritingMd()
  );

  // Write local config
  writeLocalConfig({
    version: 0,
    sources: [],
  });

  // Compile the bundle
  const result = compileBundle(bundleDir);
  treeStep("Compiling you.json", false);

  treeStep("Generating you.md", false);

  // Write compiled output
  writeBundle(bundleDir, result);
  treeStep("Writing manifest.json", true);

  console.log("");
  console.log(
    "  " +
      chalk.green("done") +
      " -- bundle compiled (v" +
      result.bundle.version +
      ")"
  );
  console.log("");

  // ── Preview ────────────────────────────────────────────────────────

  console.log("  " + chalk.bold(info.name));
  console.log("  " + info.tagline);
  console.log("");

  // ── Next steps ─────────────────────────────────────────────────────

  console.log("  Next steps:");
  console.log("");
  console.log("  1. Edit your profile in .youmd/profile/");
  console.log("     Flesh out about.md, now.md, projects.md, values.md");
  console.log("");
  console.log("  2. Build and preview");
  console.log("     " + chalk.cyan("youmd build"));
  console.log("     " + chalk.cyan("youmd preview"));
  console.log("");
  console.log("  3. Create an account to publish");
  console.log(
    "     Visit " +
      chalk.cyan("https://you.md/claim") +
      ' to claim "' +
      info.username +
      '"'
  );
  console.log(
    "     Then: " + chalk.cyan("youmd login --key <your-api-key>")
  );
  console.log("     Then: " + chalk.cyan("youmd publish"));
  console.log("");
  console.log("  Your bundle is ready. Make it yours.");
  console.log("");
}
