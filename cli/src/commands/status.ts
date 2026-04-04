import * as fs from "fs";
import * as path from "path";
import chalk from "chalk";
import {
  getLocalBundleDir,
  localBundleExists,
  readLocalConfig,
  isAuthenticated,
  readGlobalConfig,
} from "../lib/config";
import { getMe } from "../lib/api";
import { shortHash } from "../lib/hash";
import { readSkillCatalog } from "../lib/skill-catalog";
import { loadIdentityData, resolveVariable } from "../lib/skill-renderer";

const ACCENT = chalk.hex("#C46A3A");

export async function statusCommand(): Promise<void> {
  console.log("");
  console.log("  " + chalk.bold("you.md") + chalk.dim(" -- status"));
  console.log("");

  // Check authentication
  const authed = isAuthenticated();
  console.log(
    "  auth:    " +
      (authed ? chalk.green("authenticated") : chalk.yellow("not authenticated"))
  );

  // Check local bundle
  const hasBundle = localBundleExists();
  console.log(
    "  bundle:  " +
      (hasBundle ? chalk.green("initialized") : chalk.yellow("not initialized"))
  );

  // Skills summary (show regardless of bundle status — skills are global)
  try {
    const catalog = readSkillCatalog();
    const installedSkills = catalog.skills.filter((s) => s.installed);
    if (installedSkills.length > 0) {
      console.log(
        "  skills:  " + chalk.green(`${installedSkills.length} installed`) +
        chalk.dim(` / ${catalog.skills.length} in catalog`)
      );
    } else {
      console.log(
        "  skills:  " + chalk.dim("none installed") +
        chalk.dim(` (${catalog.skills.length} available)`)
      );
    }
  } catch {
    // skill catalog not initialized — skip
  }

  if (!hasBundle) {
    console.log("");
    console.log("  run " + chalk.cyan("youmd init") + " to create a local bundle.");
    console.log("");
    // Still show remote status if authenticated
    if (authed) {
      await showRemoteStatus();
    }
    return;
  }

  const bundleDir = getLocalBundleDir();

  // Check manifest for build status
  const manifestPath = path.join(bundleDir, "manifest.json");
  let lastBuildTime = "";
  if (fs.existsSync(manifestPath)) {
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
      if (manifest.version > 0) {
        console.log("  version: " + chalk.green("v" + manifest.version));
        lastBuildTime = manifest.generatedAt;
      } else {
        console.log("  version: " + chalk.yellow("not built"));
      }
    } catch {
      console.log("  version: " + chalk.yellow("unknown"));
    }
  }

  // Check local config for sources
  const localConfig = readLocalConfig();
  if (localConfig && localConfig.sources.length > 0) {
    console.log("  sources: " + localConfig.sources.length);
  } else {
    console.log("  sources: " + chalk.yellow("none"));
  }

  // Check publish status
  if (localConfig && localConfig.lastPublished) {
    console.log("  publish: " + localConfig.lastPublished);
  } else {
    console.log("  publish: " + chalk.yellow("never"));
  }

  // Last build timestamp
  if (lastBuildTime) {
    const builtDate = new Date(lastBuildTime);
    const ago = timeSince(builtDate);
    console.log("  built:   " + chalk.dim(ago + " ago"));
  }

  // Rich section summary with tree characters
  console.log("");
  console.log("  " + chalk.bold("local bundle:"));

  const dirs = [
    { dir: "profile", label: "profile" },
    { dir: "preferences", label: "preferences" },
    { dir: "voice", label: "voice" },
    { dir: "directives", label: "directives" },
  ];

  for (let d = 0; d < dirs.length; d++) {
    const { dir, label } = dirs[d];
    const dirPath = path.join(bundleDir, dir);
    if (!fs.existsSync(dirPath)) continue;

    const files = fs
      .readdirSync(dirPath)
      .filter((f) => f.endsWith(".md"))
      .sort();

    if (files.length === 0) continue;

    const isLastDir = d === dirs.length - 1;
    const dirConnector = isLastDir ? "\u2514\u2500\u2500" : "\u251C\u2500\u2500";
    const dirPipe = isLastDir ? "   " : "\u2502  ";

    console.log("  " + dirConnector + " " + chalk.bold(label));

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const filePath = path.join(dirPath, file);
      const raw = fs.readFileSync(filePath, "utf-8");
      const contentLines = raw
        .replace(/---[\s\S]*?---/, "")
        .trim()
        .split("\n")
        .filter((l) => l.trim() && !l.startsWith("<!--"));
      const hasContent = contentLines.length > 0;
      const preview = hasContent
        ? contentLines[0].replace(/^#+\s*/, "").trim().slice(0, 45)
        : "";
      const isLast = i === files.length - 1;
      const fileConnector = isLast ? "\u2514\u2500\u2500" : "\u251C\u2500\u2500";
      const name = path.basename(file, ".md");

      const statusIcon = hasContent ? chalk.green("\u2713") : chalk.dim("\u2022");
      const nameStr = hasContent ? chalk.cyan(name + ".md") : chalk.dim(name + ".md");
      const previewStr = hasContent
        ? chalk.dim(" -- " + preview)
        : chalk.dim(" (empty)");

      console.log("  " + dirPipe + fileConnector + " " + statusIcon + " " + nameStr + previewStr);
    }
  }

  // Identity coverage for skills
  try {
    const catalog = readSkillCatalog();
    const installedSkills = catalog.skills.filter((s) => s.installed);
    if (installedSkills.length > 0) {
      const identity = loadIdentityData();
      const allFields = new Set<string>();
      for (const s of catalog.skills) {
        for (const f of s.identity_fields) allFields.add(f);
      }

      let filled = 0;
      for (const field of allFields) {
        if (resolveVariable(field, identity)) filled++;
      }

      if (allFields.size > 0) {
        const pct = Math.round((filled / allFields.size) * 100);
        const barWidth = 20;
        const filledBar = Math.round((filled / allFields.size) * barWidth);
        const bar = chalk.green("\u2588".repeat(filledBar)) + chalk.dim("\u2591".repeat(barWidth - filledBar));
        console.log("");
        console.log("  " + chalk.bold("identity coverage:"));
        console.log(`    ${bar} ${pct}% (${filled}/${allFields.size} fields)`);
      }
    }
  } catch {
    // skip
  }

  // Recommendations
  const recs: string[] = [];
  if (!authed) recs.push("run " + chalk.cyan("youmd login") + " to authenticate");
  try {
    const catalog = readSkillCatalog();
    if (catalog.skills.filter((s) => s.installed).length === 0) {
      recs.push("run " + chalk.cyan("youmd skill install all") + " to set up agent skills");
    }
    const claudeSkills = path.join(process.cwd(), ".claude", "skills", "youmd");
    if (catalog.skills.some((s) => s.installed) && !fs.existsSync(claudeSkills)) {
      recs.push("run " + chalk.cyan("youmd skill link claude") + " to connect skills to this project");
    }
  } catch { /* skip */ }

  if (recs.length > 0) {
    console.log("");
    console.log("  " + ACCENT("next:"));
    for (const r of recs) {
      console.log(`    ${ACCENT("\u203A")} ${r}`);
    }
  }

  // Remote status
  if (authed) {
    console.log("");
    await showRemoteStatus();
  } else {
    console.log("");
  }
}

function timeSince(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return minutes + "m";
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours + "h";
  const days = Math.floor(hours / 24);
  return days + "d";
}

async function showRemoteStatus(): Promise<void> {
  console.log("  " + chalk.dim("--- remote ---"));

  try {
    const res = await getMe();

    if (!res.ok) {
      console.log(
        "  remote:  " +
          chalk.yellow("could not fetch") +
          " (status " +
          res.status +
          ")"
      );
      console.log("");
      return;
    }

    const me = res.data;
    const remoteUsername = me.user?.username || me.username;
    console.log("  user:    " + chalk.green(remoteUsername || "unknown"));
    console.log("  bundles: " + me.bundleCount);

    if (me.publishedBundle) {
      console.log(
        "  live:    v" +
          me.publishedBundle.version +
          (me.publishedBundle.publishedAt
            ? " (published " +
              new Date(me.publishedBundle.publishedAt).toISOString() +
              ")"
            : "")
      );
    } else {
      console.log("  live:    " + chalk.yellow("nothing published"));
    }

    if (me.latestBundle && !me.latestBundle.isPublished) {
      console.log(
        "  draft:   v" +
          me.latestBundle.version +
          " (unpublished)"
      );
    }

    // Hash-based sync status
    const localConfig = readLocalConfig();
    const localHash = localConfig?.localContentHash;
    const remoteHash = me.latestBundle?.contentHash;

    if (localHash || remoteHash) {
      console.log("");
      console.log("  " + chalk.dim("--- sync ---"));
      if (localHash) {
        console.log("  local:   " + chalk.cyan(shortHash(localHash)));
      } else {
        console.log("  local:   " + chalk.dim("no hash (run youmd build)"));
      }
      if (remoteHash) {
        console.log("  remote:  " + chalk.cyan(shortHash(remoteHash)));
      } else {
        console.log("  remote:  " + chalk.dim("no hash"));
      }

      // Determine sync status
      const lastPulledHash = localConfig?.lastPulledHash;
      let syncStatus: string;

      if (!localHash || !remoteHash) {
        syncStatus = chalk.dim("unknown");
      } else if (localHash === remoteHash) {
        syncStatus = chalk.green("in sync");
      } else if (lastPulledHash === remoteHash) {
        // Remote hasn't changed since pull, but local has — local is ahead
        syncStatus = chalk.yellow("local ahead");
      } else if (lastPulledHash === localHash || !lastPulledHash) {
        // Local hasn't changed since pull, but remote has — remote is ahead
        syncStatus = chalk.yellow("remote ahead");
      } else {
        // Both have changed since last pull
        syncStatus = chalk.red("diverged");
      }

      console.log("  status:  " + syncStatus);
    }

    console.log(
      "  url:     " +
        chalk.cyan("https://you.md/" + (me.user?.username || me.username || "unknown"))
    );
    console.log("");
  } catch (err) {
    console.log(
      "  remote:  " +
        chalk.yellow("unreachable")
    );
    if (err instanceof Error) {
      console.log("  " + chalk.dim(err.message));
    }
    console.log("");
  }
}
