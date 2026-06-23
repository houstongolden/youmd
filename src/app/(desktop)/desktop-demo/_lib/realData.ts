// Server-only loader: reads the REAL local you.md state off disk so the desktop
// demo can show actual projects, skills, brain files, and activity — not mock.
// Best-effort: every read is guarded; if a path is missing we just omit it, so
// the demo still renders on a machine without a you.md install.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const HOME = os.homedir();
const CODE_ROOT = path.join(HOME, "Desktop", "CODE_YOU");
const YOUMD = path.join(HOME, ".youmd");
const AGENT_SHARED = path.join(HOME, ".agent-shared");

export type RealProject = {
  name: string;
  remote?: string;
  hasEnvLocal: boolean;
  hasAgentDocs: boolean;
  hasProjectContext: boolean;
  blurb?: string;
  files: string[]; // top-level entries (dirs suffixed with "/")
  isBrainRepo?: boolean; // the *-you-md source-of-truth repo
  label?: string;
};
export type RealFile = { id: string; name: string; group: string; content?: string };
export type RealSkill = { name: string; source: "agent-shared" | "you.md" };
export type RealActivity = { id: string; actor: string; kind: "agent" | "machine"; text: string; at: string };
export type RealData = {
  available: boolean;
  root: string;
  projects: RealProject[];
  skills: RealSkill[];
  stacks: string[];
  brain: RealFile[];
  activity: RealActivity[];
  machine?: { host?: string; ready?: number; scanned?: number; envLocal?: number; needsEnv?: number };
  counts: { projects: number; skills: number; brain: number };
};

function exists(p: string) {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}
function readDirs(p: string): string[] {
  try {
    return fs
      .readdirSync(p, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith("."))
      .map((d) => d.name);
  } catch {
    return [];
  }
}
function readText(p: string, max = 8000): string | undefined {
  try {
    return fs.readFileSync(p, "utf8").slice(0, max);
  } catch {
    return undefined;
  }
}
function gitRemote(dir: string): string | undefined {
  const cfg = readText(path.join(dir, ".git", "config"), 4000);
  if (!cfg) return undefined;
  const m = cfg.match(/url\s*=\s*(.+)/);
  return m ? m[1].trim() : undefined;
}
function firstHeading(md?: string): string | undefined {
  if (!md) return undefined;
  for (const line of md.split("\n")) {
    const t = line.replace(/^#+\s*/, "").trim();
    if (t && !t.startsWith("#")) return t.slice(0, 90);
  }
  return undefined;
}

export function loadRealData(): RealData {
  const projectNames = readDirs(CODE_ROOT);
  const projects: RealProject[] = projectNames.map((name) => {
    const dir = path.join(CODE_ROOT, name);
    const readme = readText(path.join(dir, "README.md"), 2000);
    let files: string[] = [];
    try {
      files = fs
        .readdirSync(dir, { withFileTypes: true })
        .filter((d) => !d.name.startsWith(".") || d.name === ".env.local")
        .sort((a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name))
        .slice(0, 40)
        .map((d) => (d.isDirectory() ? `${d.name}/` : d.name));
    } catch {
      /* unreadable */
    }
    const isBrainRepo = /you-md$/.test(name) || name.includes("-you-md");
    return {
      name,
      remote: gitRemote(dir),
      hasEnvLocal: exists(path.join(dir, ".env.local")),
      hasAgentDocs: exists(path.join(dir, "CLAUDE.md")) || exists(path.join(dir, "AGENTS.md")),
      hasProjectContext: exists(path.join(dir, "project-context")),
      blurb: firstHeading(readme),
      files,
      isBrainRepo,
      label: isBrainRepo ? "source of truth" : undefined,
    };
  });
  // Pin the *-you-md brain repo to the very top.
  projects.sort((a, b) => Number(Boolean(b.isBrainRepo)) - Number(Boolean(a.isBrainRepo)));

  const sharedSkills = readDirs(path.join(AGENT_SHARED, "claude-skills")).map(
    (name): RealSkill => ({ name, source: "agent-shared" }),
  );
  const youmdSkills = readDirs(path.join(YOUMD, "skills")).map(
    (name): RealSkill => ({ name, source: "you.md" }),
  );
  // de-dupe by name, prefer agent-shared
  const seen = new Set<string>();
  const skills: RealSkill[] = [];
  for (const s of [...sharedSkills, ...youmdSkills]) {
    if (seen.has(s.name)) continue;
    seen.add(s.name);
    skills.push(s);
  }

  const stacks = readDirs(path.join(YOUMD, "stacks")).length
    ? readDirs(path.join(YOUMD, "stacks"))
    : ["YouStack", "BAMFStack", "ResearchStack", "MyoStack", "HubStack"];

  // Brain: real identity/profile markdown with content.
  const brain: RealFile[] = [];
  const profileDir = path.join(YOUMD, "profile");
  try {
    for (const f of fs.readdirSync(profileDir)) {
      if (!f.endsWith(".md")) continue;
      brain.push({ id: `profile/${f}`, name: f, group: "identity", content: readText(path.join(profileDir, f)) });
    }
  } catch {
    /* no profile dir */
  }
  for (const top of ["you.md", "stack-runtime.md"]) {
    const c = readText(path.join(YOUMD, top));
    if (c) brain.push({ id: top, name: top, group: "identity", content: c });
  }

  // Machine readiness proof.
  let machine: RealData["machine"];
  try {
    const j = JSON.parse(readText(path.join(YOUMD, "machine-reports", "latest.json"), 200000) ?? "{}");
    const find = (o: unknown, k: string): unknown => {
      if (o && typeof o === "object") {
        for (const [kk, v] of Object.entries(o as Record<string, unknown>)) {
          if (kk === k) return v;
          const r = find(v, k);
          if (r !== undefined) return r;
        }
      }
      return undefined;
    };
    machine = {
      host: find(j, "hostName") as string | undefined,
      ready: find(j, "ready") as number | undefined,
      scanned: find(j, "scanned") as number | undefined,
      envLocal: find(j, "envLocal") as number | undefined,
      needsEnv: find(j, "needsEnv") as number | undefined,
    };
  } catch {
    /* no report */
  }

  // Activity: real agent-bus inbox messages.
  const activity: RealActivity[] = [];
  try {
    const inbox = JSON.parse(readText(path.join(YOUMD, "agent-bus", "inbox.json"), 100000) ?? "[]");
    const msgs = Array.isArray(inbox) ? inbox : inbox?.messages ?? [];
    for (const m of msgs.slice(-20).reverse()) {
      activity.push({
        id: String(m.id ?? Math.abs(Math.random())),
        actor: String(m.from ?? m.agent ?? "agent"),
        kind: String(m.from ?? "").includes("machine") || /mini|mbp|vps|host/i.test(String(m.device ?? "")) ? "machine" : "agent",
        text: String(m.text ?? m.message ?? ""),
        at: String(m.at ?? m.channel ?? ""),
      });
    }
  } catch {
    /* no inbox */
  }

  return {
    available: projects.length > 0 || brain.length > 0,
    root: CODE_ROOT,
    projects,
    skills,
    stacks,
    brain,
    activity,
    machine,
    counts: { projects: projects.length, skills: skills.length, brain: brain.length },
  };
}
