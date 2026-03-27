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
import { initProject as skillInitProject } from "../lib/skills";
import { readSkillCatalog } from "../lib/skill-catalog";

export async function initCommand(options: {
  skipPrompts?: boolean;
}): Promise<void> {
  const bundleDir = getLocalBundleDir();

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
    const claudeMdPath = path.join(projectCtx.root, "CLAUDE.md");
    const pcDir = path.join(projectCtx.root, "project-context");
    const needsSkills = !fs.existsSync(claudeMdPath) || !fs.existsSync(pcDir);

    if (needsSkills) {
      const rl2 = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      const skillAnswer = await new Promise<string>((resolve) => {
        rl2.question(
          chalk.dim(`\n  set up agent skills? (CLAUDE.md + project-context/ + .claude/skills/) [Y/n]: `),
          (a) => resolve(a.trim())
        );
      });

      rl2.close();

      if (!skillAnswer || skillAnswer.toLowerCase() !== "n") {
        console.log("");
        const result = skillInitProject();
        for (const step of result.steps) {
          const icon = step.ok ? chalk.green("\u2713") : chalk.hex("#C46A3A")("\u2717");
          const detail = step.detail ? chalk.dim(` ${step.detail}`) : "";
          console.log(`  ${icon} ${step.name}${detail}`);
        }
        if (result.ok) {
          console.log("");
          console.log(chalk.dim("  every agent that touches this repo now knows who you are."));
        }
      }
    }
  }
}
