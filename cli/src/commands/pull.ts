import * as fs from "fs";
import * as path from "path";
import chalk from "chalk";
import { getMe, getPublicProfile, getPrivateContext } from "../lib/api";
import { readGlobalConfig, getLocalBundleDir, localBundleExists, readLocalConfig, writeLocalConfig } from "../lib/config";
import { writePrivateContextToLocal } from "./private";
import { computeContentHash, shortHash } from "../lib/hash";
import { syncAllSkills } from "../lib/skills";
import { readSkillCatalog } from "../lib/skill-catalog";

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

  // Create directories if needed
  const profileDir = path.join(bundleDir, "profile");
  const prefsDir = path.join(bundleDir, "preferences");
  const voiceDir = path.join(bundleDir, "voice");
  fs.mkdirSync(profileDir, { recursive: true });
  fs.mkdirSync(prefsDir, { recursive: true });
  fs.mkdirSync(voiceDir, { recursive: true });

  const youJson = youJsonSource.youJson as Record<string, unknown>;
  const identity = youJson.identity as Record<string, unknown> || {};
  const bio = identity.bio as Record<string, string> || {};
  const now = youJson.now as Record<string, unknown> || {};
  const projects = youJson.projects as Array<Record<string, string>> || [];
  const values = youJson.values as string[] || [];
  const links = youJson.links as Record<string, string> || {};
  const prefs = youJson.preferences as Record<string, Record<string, unknown>> || {};
  const analysis = youJson.analysis as Record<string, unknown> || {};
  const voice = youJson.voice as Record<string, unknown> || {};

  let filesWritten = 0;

  // Write profile/about.md
  if (bio.long || bio.medium || bio.short || identity.name) {
    const aboutContent = `---
title: "About"
---

# ${identity.name || username}

${bio.long || bio.medium || bio.short || ""}
`;
    fs.writeFileSync(path.join(profileDir, "about.md"), aboutContent);
    filesWritten++;
    console.log(chalk.green("  ✓") + chalk.dim(" profile/about.md"));
  }

  // Write profile/now.md
  const focus = (now.focus as string[]) || [];
  if (focus.length > 0) {
    const nowContent = `---
title: "Now"
---

${focus.map((f) => `- ${f}`).join("\n")}
`;
    fs.writeFileSync(path.join(profileDir, "now.md"), nowContent);
    filesWritten++;
    console.log(chalk.green("  ✓") + chalk.dim(" profile/now.md"));
  }

  // Write profile/projects.md
  if (projects.length > 0) {
    const projectsContent = `---
title: "Projects"
---

${projects.map((p) => `## ${p.name}\n${p.description || ""}\n- Role: ${p.role || "contributor"}\n- Status: ${p.status || "active"}\n${p.url ? `- URL: ${p.url}` : ""}`).join("\n\n")}
`;
    fs.writeFileSync(path.join(profileDir, "projects.md"), projectsContent);
    filesWritten++;
    console.log(chalk.green("  ✓") + chalk.dim(" profile/projects.md"));
  }

  // Write profile/values.md
  if (values.length > 0) {
    const valuesContent = `---
title: "Values"
---

${values.map((v) => `- ${v}`).join("\n")}
`;
    fs.writeFileSync(path.join(profileDir, "values.md"), valuesContent);
    filesWritten++;
    console.log(chalk.green("  ✓") + chalk.dim(" profile/values.md"));
  }

  // Write profile/links.md
  const linkEntries = Object.entries(links).filter(([, url]) => url);
  if (linkEntries.length > 0) {
    const linksContent = `---
title: "Links"
---

${linkEntries.map(([platform, url]) => `- **${platform}**: ${url}`).join("\n")}
`;
    fs.writeFileSync(path.join(profileDir, "links.md"), linksContent);
    filesWritten++;
    console.log(chalk.green("  ✓") + chalk.dim(" profile/links.md"));
  }

  // Write preferences/agent.md
  if (prefs.agent) {
    const agentContent = `---
title: "Agent Preferences"
---

Tone: ${prefs.agent.tone || "direct, curious"}
Formality: ${prefs.agent.formality || "casual-professional"}
${(prefs.agent.avoid as string[])?.length ? `Avoid: ${(prefs.agent.avoid as string[]).join(", ")}` : ""}
`;
    fs.writeFileSync(path.join(prefsDir, "agent.md"), agentContent);
    filesWritten++;
    console.log(chalk.green("  ✓") + chalk.dim(" preferences/agent.md"));
  }

  // Write preferences/writing.md
  if (prefs.writing) {
    const writingContent = `---
title: "Writing Style"
---

Style: ${prefs.writing.style || ""}
Format: ${prefs.writing.format || "markdown preferred"}
`;
    fs.writeFileSync(path.join(prefsDir, "writing.md"), writingContent);
    filesWritten++;
    console.log(chalk.green("  ✓") + chalk.dim(" preferences/writing.md"));
  }

  // Write voice/voice.md (overall)
  if (voice.overall || analysis.voice_summary) {
    const voiceContent = `---
title: "Voice Profile"
---

${(voice.overall as string) || (analysis.voice_summary as string) || ""}
`;
    fs.writeFileSync(path.join(voiceDir, "voice.md"), voiceContent);
    filesWritten++;
    console.log(chalk.green("  ✓") + chalk.dim(" voice/voice.md"));
  }

  // Write voice platform-specific files
  const platforms = (voice.platforms as Record<string, string>) || {};
  for (const [platform, content] of Object.entries(platforms)) {
    if (content) {
      fs.writeFileSync(path.join(voiceDir, `voice.${platform}.md`), content);
      filesWritten++;
      console.log(chalk.green("  ✓") + chalk.dim(` voice/voice.${platform}.md`));
    }
  }

  // Write you.json
  fs.writeFileSync(path.join(bundleDir, "you.json"), JSON.stringify(youJson, null, 2));
  filesWritten++;
  console.log(chalk.green("  ✓") + chalk.dim(" you.json"));

  // Write you.md
  if (youJsonSource.youMd) {
    fs.writeFileSync(path.join(bundleDir, "you.md"), youJsonSource.youMd);
    filesWritten++;
    console.log(chalk.green("  ✓") + chalk.dim(" you.md"));
  }

  // Pull private context
  try {
    const privateRes = await getPrivateContext();
    if (privateRes.ok && privateRes.data) {
      const privateFiles = writePrivateContextToLocal(bundleDir, privateRes.data);
      if (privateFiles > 0) {
        filesWritten += privateFiles;
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

  console.log("");
  console.log(chalk.green(`  pulled ${filesWritten} files from you.md/${username}`));
  console.log(chalk.dim(`  bundle dir: ${bundleDir}`));
}
