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
const DIM = chalk.dim;
const LABEL_W = 11; // fixed label width for alignment

function label(name: string): string {
  return ACCENT(name.padEnd(LABEL_W));
}

export async function statusCommand(): Promise<void> {
  const config = readGlobalConfig();

  console.log("");
  console.log("  " + chalk.bold("you.md") + DIM(" -- system status"));
  console.log("");

  // ── Auth ──────────────────────────────────────────────────────────
  const authed = isAuthenticated();
  if (authed && config.username) {
    console.log("  " + label("auth") + chalk.green("@" + config.username));
  } else if (authed) {
    console.log("  " + label("auth") + chalk.green("authenticated"));
  } else {
    console.log("  " + label("auth") + chalk.yellow("not logged in"));
  }

  // ── Bundle ────────────────────────────────────────────────────────
  const hasBundle = localBundleExists();
  if (hasBundle) {
    const bundleDir = getLocalBundleDir();
    const manifestPath = path.join(bundleDir, "manifest.json");
    let versionStr = chalk.green("initialized");
    let contentHash = "";
    if (fs.existsSync(manifestPath)) {
      try {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
        if (manifest.version > 0) {
          versionStr = chalk.green("v" + manifest.version);
          if (manifest.contentHash) {
            contentHash = manifest.contentHash;
          }
        }
      } catch { /* skip */ }
    }
    const localConfig = readLocalConfig();
    const hashSuffix = localConfig?.localContentHash
      ? DIM(" #" + shortHash(localConfig.localContentHash))
      : contentHash
        ? DIM(" #" + shortHash(contentHash))
        : "";
    console.log("  " + label("bundle") + versionStr + hashSuffix);
  } else {
    console.log("  " + label("bundle") + chalk.yellow("not initialized"));
  }

  // ── Skills ────────────────────────────────────────────────────────
  try {
    const catalog = readSkillCatalog();
    const installedSkills = catalog.skills.filter((s) => s.installed);
    if (installedSkills.length > 0) {
      console.log(
        "  " + label("skills") + chalk.green(`${installedSkills.length} installed`) +
        DIM(` / ${catalog.skills.length} in catalog`)
      );
    } else {
      console.log(
        "  " + label("skills") + DIM("none installed") +
        DIM(` (${catalog.skills.length} available)`)
      );
    }
  } catch {
    console.log("  " + label("skills") + DIM("catalog not initialized"));
  }

  // ── MCP server ────────────────────────────────────────────────────
  console.log(
    "  " + label("mcp") + chalk.green("available") +
    DIM(" (youmd mcp --install claude|cursor)")
  );

  if (!hasBundle) {
    console.log("");
    if (!authed) {
      console.log("  " + ACCENT("\u2192") + " Run " + chalk.cyan("youmd login") + " to get started");
    } else {
      console.log("  " + ACCENT("\u2192") + " Run " + chalk.cyan("youmd init") + " to create your identity");
    }
    console.log("");
    if (authed) {
      await showRemoteStatus();
    }
    return;
  }

  const bundleDir = getLocalBundleDir();

  // ── Sources ───────────────────────────────────────────────────────
  const localConfig = readLocalConfig();
  if (localConfig && localConfig.sources.length > 0) {
    console.log("  " + label("sources") + String(localConfig.sources.length));
  } else {
    console.log("  " + label("sources") + chalk.yellow("none"));
  }

  // ── Publish ───────────────────────────────────────────────────────
  if (localConfig && localConfig.lastPublished) {
    console.log("  " + label("publish") + localConfig.lastPublished);
  } else {
    console.log("  " + label("publish") + chalk.yellow("never"));
  }

  // ── Last build ────────────────────────────────────────────────────
  const manifestPath = path.join(bundleDir, "manifest.json");
  if (fs.existsSync(manifestPath)) {
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
      if (manifest.generatedAt) {
        const builtDate = new Date(manifest.generatedAt);
        const ago = timeSince(builtDate);
        console.log("  " + label("built") + DIM(ago + " ago"));
      }
    } catch { /* skip */ }
  }

  // ── Local bundle tree ─────────────────────────────────────────────
  console.log("");
  console.log("  " + chalk.bold("local bundle:"));

  const dirs = [
    { dir: "profile", label: "profile" },
    { dir: "preferences", label: "preferences" },
    { dir: "voice", label: "voice" },
    { dir: "directives", label: "directives" },
  ];

  for (let d = 0; d < dirs.length; d++) {
    const { dir, label: dirLabel } = dirs[d];
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

    console.log("  " + dirConnector + " " + chalk.bold(dirLabel));

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

      const statusIcon = hasContent ? chalk.green("\u2713") : DIM("\u2022");
      const nameStr = hasContent ? chalk.cyan(name + ".md") : DIM(name + ".md");
      const previewStr = hasContent
        ? DIM(" -- " + preview)
        : DIM(" (empty)");

      console.log("  " + dirPipe + fileConnector + " " + statusIcon + " " + nameStr + previewStr);
    }
  }

  // ── Identity coverage ─────────────────────────────────────────────
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
        const bar = chalk.green("\u2588".repeat(filledBar)) + DIM("\u2591".repeat(barWidth - filledBar));
        console.log("");
        console.log("  " + chalk.bold("identity coverage:"));
        console.log(`    ${bar} ${pct}% (${filled}/${allFields.size} fields)`);
      }
    }
  } catch {
    // skip
  }

  // ── Recommendations ───────────────────────────────────────────────
  const recs: string[] = [];
  if (!authed) {
    recs.push("Run " + chalk.cyan("youmd login") + " to get started");
  } else if (!localConfig?.lastPublished) {
    recs.push("Run " + chalk.cyan("youmd push") + " to publish your profile");
  }
  try {
    const catalog = readSkillCatalog();
    if (catalog.skills.filter((s) => s.installed).length === 0) {
      recs.push("Run " + chalk.cyan("youmd skill install all") + " to set up agent skills");
    }
    const claudeSkills = path.join(process.cwd(), ".claude", "skills", "youmd");
    if (catalog.skills.some((s) => s.installed) && !fs.existsSync(claudeSkills)) {
      recs.push("Run " + chalk.cyan("youmd skill link claude") + " to connect skills to this project");
    }
  } catch { /* skip */ }

  // If everything looks healthy, celebrate.
  if (recs.length === 0 && authed && hasBundle && localConfig?.lastPublished) {
    console.log("");
    const remoteUsername = config.username || "you";
    console.log(
      "  " + chalk.green("\u2713") + " Profile live at " +
      chalk.cyan("https://you.md/@" + remoteUsername)
    );
  }

  if (recs.length > 0) {
    console.log("");
    console.log("  " + ACCENT("next:"));
    for (const r of recs) {
      console.log(`    ${ACCENT("\u2192")} ${r}`);
    }
  }

  // ── Remote status ─────────────────────────────────────────────────
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
  console.log("  " + DIM("\u2500\u2500\u2500 remote \u2500\u2500\u2500"));

  try {
    const res = await getMe();

    if (!res.ok) {
      console.log(
        "  " + label("remote") +
          chalk.yellow("could not fetch") +
          DIM(" (status " + res.status + ")")
      );
      console.log("");
      return;
    }

    const me = res.data;
    const remoteUsername = me.user?.username || me.username;
    console.log("  " + label("user") + chalk.green("@" + (remoteUsername || "unknown")));
    console.log("  " + label("bundles") + String(me.bundleCount));

    if (me.publishedBundle) {
      const pubDate = me.publishedBundle.publishedAt
        ? DIM(" (" + new Date(me.publishedBundle.publishedAt).toISOString().split("T")[0] + ")")
        : "";
      console.log("  " + label("live") + "v" + me.publishedBundle.version + pubDate);
    } else {
      console.log("  " + label("live") + chalk.yellow("nothing published"));
    }

    if (me.latestBundle && !me.latestBundle.isPublished) {
      console.log(
        "  " + label("draft") + "v" + me.latestBundle.version + DIM(" (unpublished)")
      );
    }

    // ── Sync ──────────────────────────────────────────────────────
    const localConfig = readLocalConfig();
    const localHash = localConfig?.localContentHash;
    const remoteHash = me.latestBundle?.contentHash;

    if (localHash || remoteHash) {
      console.log("");
      console.log("  " + DIM("\u2500\u2500\u2500 sync \u2500\u2500\u2500"));
      if (localHash) {
        console.log("  " + label("local") + chalk.cyan(shortHash(localHash)));
      } else {
        console.log("  " + label("local") + DIM("no hash") + DIM(" (run youmd build)"));
      }
      if (remoteHash) {
        console.log("  " + label("remote") + chalk.cyan(shortHash(remoteHash)));
      } else {
        console.log("  " + label("remote") + DIM("no hash"));
      }

      const lastPulledHash = localConfig?.lastPulledHash;
      let syncStatus: string;

      if (!localHash || !remoteHash) {
        syncStatus = DIM("unknown");
      } else if (localHash === remoteHash) {
        syncStatus = chalk.green("in sync");
      } else if (lastPulledHash === remoteHash) {
        syncStatus = chalk.yellow("local ahead");
      } else if (lastPulledHash === localHash || !lastPulledHash) {
        syncStatus = chalk.yellow("remote ahead");
      } else {
        syncStatus = chalk.red("diverged");
      }

      console.log("  " + label("status") + syncStatus);
    }

    console.log(
      "  " + label("url") +
        chalk.cyan("https://you.md/@" + (me.user?.username || me.username || "unknown"))
    );
    console.log("");
  } catch (err) {
    console.log(
      "  " + label("remote") + chalk.yellow("unreachable")
    );
    if (err instanceof Error) {
      console.log("  " + DIM(err.message));
    }
    console.log("");
  }
}
