import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import chalk from "chalk";
import {
  getLocalBundleDir,
  detectProjectContext,
  ensureProjectDirs,
  YoumdProjectFile,
} from "../lib/config";
import { runOnboarding, createBundle } from "../lib/onboarding";
import {
  findProjectsRoot,
  initProjectFiles,
  getProjectDir,
} from "../lib/project";
import { initProject as skillInitProject, installSkill, installSkillAsync } from "../lib/skills";
import { readSkillCatalog } from "../lib/skill-catalog";
import { compileBundle, writeBundle } from "../lib/compiler";

// Available example bundle names. Resolved to cli/examples/<name>/ relative
// to the installed package.
const AVAILABLE_EXAMPLES = ["houston", "priya", "jordan"] as const;
type ExampleName = (typeof AVAILABLE_EXAMPLES)[number];

function findExamplesDir(): string | null {
  // dist/commands/init.js -> ../../examples
  // src/commands/init.ts  -> ../../examples
  // Try a couple of plausible locations.
  const candidates = [
    path.join(__dirname, "..", "..", "examples"),
    path.join(__dirname, "..", "..", "..", "examples"),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

function copyDirRecursive(src: string, dest: string): void {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else if (entry.isFile()) {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

async function initFromExample(exampleName: string): Promise<void> {
  const bundleDir = getLocalBundleDir();

  if (!AVAILABLE_EXAMPLES.includes(exampleName as ExampleName)) {
    console.log("");
    console.log(chalk.red(`  unknown example: ${exampleName}`));
    console.log(
      chalk.dim("  available: ") + chalk.cyan(AVAILABLE_EXAMPLES.join(", "))
    );
    console.log("");
    process.exit(1);
  }

  const examplesDir = findExamplesDir();
  if (!examplesDir) {
    console.log("");
    console.log(chalk.red("  examples directory not found in this install"));
    console.log(chalk.dim("  try reinstalling the youmd package"));
    console.log("");
    process.exit(1);
  }

  const sourceDir = path.join(examplesDir, exampleName);
  if (!fs.existsSync(sourceDir)) {
    console.log("");
    console.log(chalk.red(`  example not found on disk: ${sourceDir}`));
    console.log("");
    process.exit(1);
  }

  if (fs.existsSync(bundleDir)) {
    console.log("");
    console.log(
      chalk.yellow("  .youmd/ already exists -- not overwriting")
    );
    console.log(
      chalk.dim("  remove .youmd/ first or run init in a fresh directory")
    );
    console.log("");
    return;
  }

  console.log("");
  console.log(
    "  " +
      chalk.hex("#C46A3A")("scaffolding") +
      chalk.dim(` -- using example "${exampleName}"`)
  );

  copyDirRecursive(sourceDir, bundleDir);

  // Compile the bundle so users immediately see you.json + you.md.
  try {
    const result = compileBundle(bundleDir);
    writeBundle(bundleDir, result);
    console.log(
      "  " +
        chalk.green("done") +
        chalk.dim(` -- bundle compiled (v${result.stats.version})`)
    );
  } catch (err) {
    console.log(
      chalk.dim(
        "  files copied, but initial compile failed: " +
          (err instanceof Error ? err.message : String(err))
      )
    );
  }

  console.log("");
  console.log("  " + chalk.bold("next steps:"));
  console.log("");
  console.log(
    `    1. ${chalk.cyan("youmd login")}    ${chalk.dim("-- connect to you.md")}`
  );
  console.log(
    `    2. ${chalk.cyan("youmd push")}     ${chalk.dim("-- publish to your handle")}`
  );
  console.log(
    `    3. ${chalk.cyan("you")}            ${chalk.dim("-- meet U and keep shaping your identity")}`
  );
  console.log("");
}

export async function initCommand(options: {
  skipPrompts?: boolean;
  example?: string;
}): Promise<void> {
  const bundleDir = getLocalBundleDir();

  if (options.example) {
    await initFromExample(options.example);
    return;
  }

  if (options.skipPrompts) {
    // Non-interactive: create empty bundle like the old behavior
    if (fs.existsSync(bundleDir)) {
      console.log(chalk.yellow("warning: .youmd/ directory already exists"));
      return;
    }

    await createBundle({
      username: "anonymous",
      name: "Anonymous",
      tagline: "",
    });
    return;
  }

  // Interactive: run the full onboarding wizard
  try {
    await runOnboarding();
  } catch (err) {
    if (err instanceof Error && err.message === "readline was closed") {
      console.log("");
      console.log("  aborted.");
      console.log("");
      process.exit(0);
    }
    throw err;
  }

  // After onboarding, check if we're in a project directory and offer project context
  const projectCtx = detectProjectContext();
  if (projectCtx) {
    const youmdProjectPath = path.join(projectCtx.root, ".youmd-project");
    if (!fs.existsSync(youmdProjectPath)) {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      const answer = await new Promise<string>((resolve) => {
        rl.question(
          chalk.dim(`\n  detected project: ${projectCtx.name}. create project-specific context? [Y/n]: `),
          (a) => resolve(a.trim())
        );
      });

      rl.close();

      if (!answer || answer.toLowerCase() !== "n") {
        // Create .youmd-project marker
        const projectFile: YoumdProjectFile = {
          name: projectCtx.name,
          createdAt: new Date().toISOString(),
        };
        fs.writeFileSync(youmdProjectPath, JSON.stringify(projectFile, null, 2) + "\n");

        // Create project dirs in global .youmd
        ensureProjectDirs(projectCtx.name);

        // Also create file-based project context if projects root exists
        const projectsRoot = findProjectsRoot();
        if (projectsRoot) {
          const projectDir = getProjectDir(projectsRoot, projectCtx.name);
          if (!fs.existsSync(path.join(projectDir, "project.json"))) {
            initProjectFiles(projectDir, projectCtx.name, "");
          }
        }

        console.log(chalk.green("  project context initialized."));
        console.log(chalk.dim(`  ${youmdProjectPath}`));
      }
    }
  }

  // After everything, offer to set up skills for this project
  if (projectCtx) {
    const youDir = path.join(projectCtx.root, ".you");
    const hasBootstrap = fs.existsSync(youDir);
    const rl2 = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const prompt = hasBootstrap
      ? `\n  refresh repo agent bootstrap? (managed AGENTS/CLAUDE block + project-context/ + .you/ + links) [Y/n]: `
      : `\n  set up repo agent bootstrap? (managed AGENTS/CLAUDE block + project-context/ + .you/ + links) [Y/n]: `;

    const skillAnswer = await new Promise<string>((resolve) => {
      rl2.question(chalk.dim(prompt), (a) => resolve(a.trim()));
    });

    rl2.close();

    if (!skillAnswer || skillAnswer.toLowerCase() !== "n") {
      // Auto-install all bundled skills before init-project
      const catalog = readSkillCatalog();
      const toInstall = catalog.skills.filter((s) => !s.installed);
      if (toInstall.length > 0) {
        console.log(chalk.dim(`\n  installing ${toInstall.length} bundled skills...`));
        for (const entry of toInstall) {
          let result = installSkill(entry.name);
          if (!result.ok && (entry.source.startsWith("github:") || entry.source.startsWith("https://"))) {
            result = await installSkillAsync(entry.name);
          }
          if (result.ok) {
            console.log(chalk.green("  \u2713") + chalk.dim(` ${entry.name}`));
          }
        }
      }

      console.log("");
      const result = skillInitProject({ mode: "auto" });
      for (const step of result.steps) {
        const icon = step.ok ? chalk.green("\u2713") : chalk.hex("#C46A3A")("\u2717");
        const detail = step.detail ? chalk.dim(` ${step.detail}`) : "";
        console.log(`  ${icon} ${step.name}${detail}`);
      }
      if (result.ok) {
        console.log("");
        console.log(chalk.dim(`  repo bootstrap refreshed in ${result.mode} mode.`));
      }
    }
  }
}
