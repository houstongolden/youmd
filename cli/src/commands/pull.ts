import * as fs from "fs";
import * as path from "path";
import chalk from "chalk";
import { getMe, getPublicProfile, getPrivateContext } from "../lib/api";
import { readGlobalConfig, getLocalBundleDir, readLocalConfig, writeLocalConfig } from "../lib/config";
import { writePrivateContextToLocal } from "./private";
import { computeContentHash, shortHash } from "../lib/hash";
import { syncAllSkills } from "../lib/skills";
import { readSkillCatalog } from "../lib/skill-catalog";
import { decompileToFilesystem, detectFormat } from "../lib/decompile";

export async function pullCommand() {
  const config = readGlobalConfig();

  if (!config.token) {
    console.log(chalk.hex("#C46A3A")("  not authenticated. run: youmd login"));
    return;
  }

  if (!config.username) {
    console.log(chalk.hex("#C46A3A")("  no username configured. run: youmd login"));
    return;
  }

  const username = config.username;
  console.log(chalk.dim(`  pulling profile for @${username}...`));

  // Fetch the published profile from the API
  const profile = await getPublicProfile(username);

  // If public profile has no youJson, fall back to /me endpoint (latest bundle)
  let youJsonSource: { youJson: unknown; youMd?: string | null } | null = null;

  if (profile && profile.youJson) {
    youJsonSource = { youJson: profile.youJson, youMd: profile.youMd };
  } else {
    console.log(chalk.dim("  no published profile found, checking your latest bundle..."));
    try {
      const meRes = await getMe();
      if (meRes.ok && meRes.data?.latestBundle?.youJson) {
        youJsonSource = {
          youJson: meRes.data.latestBundle.youJson,
          youMd: meRes.data.latestBundle.youMd ?? null,
        };
        console.log(chalk.dim(`  found bundle v${meRes.data.latestBundle.version} (${meRes.data.latestBundle.isPublished ? "published" : "draft"})`));
      }
    } catch {
      // getMe failed — fall through to error
    }
  }

  if (!youJsonSource) {
    console.log(chalk.hex("#C46A3A")("  no published bundle found on you.md"));
    console.log(chalk.dim("  publish your local bundle first: youmd build && youmd publish"));
    return;
  }

  const bundleDir = getLocalBundleDir();
  const youJson = youJsonSource.youJson as Record<string, unknown>;

  // Detect format and log it
  const format = detectFormat(youJson);
  console.log(chalk.dim(`  format: ${format}`));

  // Decompile youJson → all markdown files in standard directories
  const filesWritten = decompileToFilesystem(bundleDir, youJson);

  // Log each directory that was written
  for (const dir of ["profile", "preferences", "voice", "directives"]) {
    const dirPath = path.join(bundleDir, dir);
    if (fs.existsSync(dirPath)) {
      const files = fs.readdirSync(dirPath).filter((f) => f.endsWith(".md"));
      for (const file of files) {
        console.log(chalk.green("  \u2713") + chalk.dim(` ${dir}/${file}`));
      }
    }
  }

  let totalFiles = filesWritten;

  // Write you.json
  fs.writeFileSync(path.join(bundleDir, "you.json"), JSON.stringify(youJson, null, 2));
  totalFiles++;
  console.log(chalk.green("  \u2713") + chalk.dim(" you.json"));

  // Write you.md
  if (youJsonSource.youMd) {
    fs.writeFileSync(path.join(bundleDir, "you.md"), youJsonSource.youMd);
    totalFiles++;
    console.log(chalk.green("  \u2713") + chalk.dim(" you.md"));
  }

  // Pull private context
  try {
    const privateRes = await getPrivateContext();
    if (privateRes.ok && privateRes.data) {
      const privateFiles = writePrivateContextToLocal(bundleDir, privateRes.data);
      if (privateFiles > 0) {
        totalFiles += privateFiles;
        if (privateRes.data.privateNotes) {
          console.log(chalk.green("  \u2713") + chalk.dim(" private/notes.md"));
        }
        if (privateRes.data.internalLinks && Object.keys(privateRes.data.internalLinks).length > 0) {
          console.log(chalk.green("  \u2713") + chalk.dim(" private/links.json"));
        }
        if (privateRes.data.privateProjects && privateRes.data.privateProjects.length > 0) {
          console.log(chalk.green("  \u2713") + chalk.dim(" private/projects.json"));
        }
      }
    }
  } catch {
    console.log(chalk.dim("  skipped private context (not available)"));
  }

  // Track the remote hash we pulled so push/publish can detect divergence
  try {
    const meRes = await getMe();
    if (meRes.ok) {
      const remoteVersion = meRes.data.publishedBundle?.version || meRes.data.latestBundle?.version || 0;
      const remoteContentHash = meRes.data.latestBundle?.contentHash;
      const lc = readLocalConfig() || { version: 1, sources: [] };
      lc.lastKnownRemoteVersion = remoteVersion;
      lc.localContentHash = remoteContentHash || computeContentHash(
        youJson,
        youJsonSource.youMd ?? ""
      );
      if (remoteContentHash) {
        lc.lastPulledHash = remoteContentHash;
      }
      writeLocalConfig(lc);

      // Save base.json — the "common ancestor" for future merges
      const baseJsonPath = path.join(bundleDir, "base.json");
      fs.writeFileSync(baseJsonPath, JSON.stringify(youJson, null, 2));

      if (remoteContentHash) {
        console.log(chalk.dim(`  remote hash: ${shortHash(remoteContentHash)}`));
      }
    }
  } catch {
    // non-fatal
  }

  // Auto re-interpolate installed skills after identity pull
  const catalog = readSkillCatalog();
  const installedCount = catalog.skills.filter((s) => s.installed).length;
  if (installedCount > 0) {
    console.log("");
    console.log(chalk.dim("  re-interpolating skills against updated identity..."));
    const syncResult = syncAllSkills();
    if (syncResult.synced.length > 0) {
      console.log(
        chalk.green("  \u2713") +
        chalk.dim(` ${syncResult.synced.length} skill${syncResult.synced.length === 1 ? "" : "s"} synced`)
      );
    }
    if (syncResult.errors.length > 0) {
      for (const err of syncResult.errors) {
        console.log(chalk.hex("#C46A3A")(`  skill sync error: ${err}`));
      }
    }
  }

  // Content-aware summary
  const summaryParts: string[] = [];
  const identity = (youJson.identity as Record<string, unknown>) || {};
  if (identity.name) summaryParts.push(chalk.hex("#C46A3A")(String(identity.name)));
  const projects = (youJson.projects as unknown[]) || [];
  if (projects.length > 0) summaryParts.push(`${projects.length} project${projects.length === 1 ? "" : "s"}`);
  const values = (youJson.values as unknown[]) || [];
  if (values.length > 0) summaryParts.push(`${values.length} value${values.length === 1 ? "" : "s"}`);
  const voice = (youJson.voice as Record<string, unknown>) || {};
  if (voice.overall) summaryParts.push("voice");
  const ad = (youJson.agent_directives as Record<string, unknown>) || {};
  if (ad.communication_style || (ad.negative_prompts as unknown[])?.length) summaryParts.push("directives");

  console.log("");
  console.log(chalk.green(`  pulled ${totalFiles} files from you.md/${username}`));
  if (summaryParts.length > 0) {
    console.log(chalk.dim(`  ${summaryParts.join(chalk.dim(" / "))}`));
  }
  console.log(chalk.dim(`  bundle dir: ${bundleDir}`));
}
