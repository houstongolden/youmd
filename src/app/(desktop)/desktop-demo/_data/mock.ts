// ──────────────────────────────────────────────────────────────────────────
// Mock data for the you.md desktop app design demo.
// Everything here is static/fake — it exists only to make the UI feel alive.
// Modeled loosely on Houston's real portfolio so the demo reads as real.
// ──────────────────────────────────────────────────────────────────────────

import type { IconName } from "../_components/icons";

export type ViewId =
  | "home"
  | "editor"
  | "projects"
  | "tasks"
  | "graph"
  | "skills"
  | "apps"
  | "agents"
  | "terminal";

export type NavItem = {
  id: ViewId;
  label: string;
  icon: IconName;
};

// Sectioned navigation, mapped to the MECE product model:
//   CONTEXT (who you are + what you know) · STACKS (what agents can do) ·
//   RUNTIME (where work happens). Home sits above; Chat + Terminal are modes.
export const NAV_SECTIONS: { title: string | null; items: NavItem[] }[] = [
  {
    title: null,
    items: [{ id: "home", label: "Home", icon: "home" }],
  },
  {
    title: "Context",
    items: [
      { id: "editor", label: "Brain", icon: "brain" },
      { id: "projects", label: "Projects", icon: "branch" },
      { id: "tasks", label: "Tasks", icon: "check" },
      { id: "graph", label: "Graph", icon: "graph" },
    ],
  },
  {
    title: "Stacks",
    items: [
      { id: "skills", label: "Skills", icon: "layers" },
      { id: "apps", label: "Connections", icon: "plug" },
    ],
  },
  {
    title: "Runtime",
    items: [
      { id: "agents", label: "Agents", icon: "agent" },
      { id: "terminal", label: "Terminal", icon: "terminal" },
    ],
  },
];

// Flat list for title lookups, the command palette, and mobile tab labels.
export const PRIMARY_NAV: NavItem[] = NAV_SECTIONS.flatMap((s) => s.items);

// ── Workspace identity ────────────────────────────────────────────────────
export const WORKSPACE = {
  name: "Houston Golden",
  handle: "@houstongolden",
  brain: "you.md",
  status: "synced",
  lastSync: "just now",
  machines: 3,
};

// ── Projects ──────────────────────────────────────────────────────────────
export type Project = {
  slug: string;
  name: string;
  focus: "focusing" | "active" | "idle";
  shipped7d: number;
  blurb: string;
  stack: string;
};

export const PROJECTS: Project[] = [
  { slug: "youmd", name: "you.md", focus: "focusing", shipped7d: 41, blurb: "Identity context protocol for the agent internet.", stack: "YouStack" },
  { slug: "bamfsite", name: "bamfsite", focus: "active", shipped7d: 18, blurb: "BAMF Media growth marketing site + OS.", stack: "BAMFStack" },
  { slug: "bigbounce", name: "bigbounce", focus: "active", shipped7d: 9, blurb: "Cosmology research — big bounce model.", stack: "ResearchStack" },
  { slug: "fantasyis", name: "fantasy.is", focus: "idle", shipped7d: 3, blurb: "Generative fantasy worldbuilding.", stack: "—" },
  { slug: "creator-new", name: "creator.new", focus: "active", shipped7d: 12, blurb: "Creator content engine.", stack: "ContentStack" },
  { slug: "foldermd", name: "folder.md", focus: "idle", shipped7d: 1, blurb: "Local-first markdown workspace.", stack: "—" },
];

// ── File / notes tree ──────────────────────────────────────────────────────
export type FileNode = {
  id: string;
  name: string;
  type: "folder" | "file";
  children?: FileNode[];
};

export const FILE_TREE: FileNode[] = [
  {
    id: "identity",
    name: "identity",
    type: "folder",
    children: [
      { id: "identity/you.md", name: "you.md", type: "file" },
      { id: "identity/voice.md", name: "voice.md", type: "file" },
      { id: "identity/preferences.md", name: "preferences.md", type: "file" },
    ],
  },
  {
    id: "projects",
    name: "projects",
    type: "folder",
    children: [
      { id: "projects/youmd.md", name: "youmd.md", type: "file" },
      { id: "projects/bamfsite.md", name: "bamfsite.md", type: "file" },
      { id: "projects/bigbounce.md", name: "bigbounce.md", type: "file" },
    ],
  },
  {
    id: "memories",
    name: "memories",
    type: "folder",
    children: [
      { id: "memories/recent.md", name: "recent.md", type: "file" },
      { id: "memories/goals.md", name: "goals.md", type: "file" },
    ],
  },
  { id: "ideas.md", name: "ideas.md", type: "file" },
  { id: "inbox.md", name: "inbox.md", type: "file" },
];

// Body content keyed by file id. Plain markdown — rendered by the tiny renderer.
export const FILE_CONTENT: Record<string, string> = {
  "identity/you.md": `# you.md

> The context every agent should already have.

I'm **Houston Golden** — founder of [you.md](https://you.md) and BAMF Media,
an 8-figure growth marketing agency. Based in Miami. LinkedIn growth pioneer.

## What I'm building
- **you.md** — identity context protocol for the agent internet
- **BAMF.ai** — agentic growth marketing
- **bigbounce** — cosmology research

## How agents should work with me
- Ship fast. I expect fast.
- Address every part of a multi-part request.
- Act decisively — don't ask permission, just do it and tell me.
- Terminal-native taste. Powerful tools, minimal surface area.

\`\`\`
brain → stacks → runtime → protected API / MCP
\`\`\`
`,
  "identity/voice.md": `# voice.md

Dry, sharp, a little weird. Never corporate. Confident, fast, opinionated.
No filler. No hedging. The product should feel **alive**.
`,
  "identity/preferences.md": `# preferences.md

- **Editor:** terminal-native, monochrome + one accent
- **Comms:** dense, multi-part, direct
- **Pet peeve:** repeating myself
- **Definition of done:** works end-to-end in production
`,
  "projects/youmd.md": `# you.md

The identity context protocol — an MCP where the context is *you*.

## Surface area
- CLI (\`youmd\`), HTTP API, MCP server, YouStacks runtime
- Web shell + public profiles
- **Next:** native desktop app (this demo)

## Status
\`\`\`
55 projects tracked · 10 skills · realtime sync live
\`\`\`
`,
  "projects/bamfsite.md": `# bamfsite

BAMF Media's site + internal OS. Powered by you.md identity context.
`,
  "projects/bigbounce.md": `# bigbounce

Cosmology research exploring a cyclic / big-bounce universe model.
Hosted at bigbounce.hubify.com.
`,
  "memories/recent.md": `# recent memories

_Auto-captured by your agents, available to every machine._

- You prefer **Tauri over React Native** for the native desktop build.
- Definition of done = works end-to-end in production, verified.
- Biggest pet peeve: having to repeat yourself.
- Design language: terminal-native roots, modern-SaaS surface.
`,
  "memories/goals.md": `# goals

- Make You.md the unified cross-machine, cross-agent context layer.
- Minimal product surface area; powerful behind the scenes.
- DRY skills — share, never duplicate; group into stacks.
- Realtime sync so any agent on any machine has full context on me.
`,
  "ideas.md": `# ideas

- [ ] Spawn **YOU sub-agents** — clones of me with scoped context
- [ ] Obsidian-style graph that agents drive, not just humans
- [ ] One-keystroke swap between chat and shell mode
- [ ] Mobile capture → inbox → project routing
`,
  "inbox.md": `# inbox

Raw captures land here before routing. Voice, SMS, Slack, screenshots.

> "Need to offboard James Park today, end of day. Sensitive departure."
`,
};

// ── Graph (Obsidian-style node graph) ──────────────────────────────────────
export type GraphNode = {
  id: string;
  label: string;
  kind: "project" | "skill" | "note" | "agent" | "app";
  x: number; // 0..100 (percent of canvas)
  y: number; // 0..100
};

export type GraphEdge = { from: string; to: string };

export const GRAPH_NODES: GraphNode[] = [
  { id: "you", label: "YOU", kind: "agent", x: 50, y: 50 },
  { id: "youmd", label: "you.md", kind: "project", x: 26, y: 28 },
  { id: "bamfsite", label: "bamfsite", kind: "project", x: 74, y: 26 },
  { id: "bigbounce", label: "bigbounce", kind: "project", x: 82, y: 62 },
  { id: "creator", label: "creator.new", kind: "project", x: 24, y: 72 },
  { id: "auditor", label: "graph-auditor", kind: "skill", x: 44, y: 16 },
  { id: "router", label: "task-router", kind: "skill", x: 62, y: 80 },
  { id: "voice", label: "voice.md", kind: "note", x: 14, y: 48 },
  { id: "ideas", label: "ideas.md", kind: "note", x: 60, y: 40 },
  { id: "coder", label: "coding-you", kind: "agent", x: 38, y: 64 },
  { id: "research", label: "research-you", kind: "agent", x: 66, y: 58 },
  { id: "github", label: "GitHub", kind: "app", x: 88, y: 40 },
  { id: "slack", label: "Slack", kind: "app", x: 12, y: 24 },
];

export const GRAPH_EDGES: GraphEdge[] = [
  { from: "you", to: "youmd" },
  { from: "you", to: "bamfsite" },
  { from: "you", to: "bigbounce" },
  { from: "you", to: "creator" },
  { from: "you", to: "voice" },
  { from: "you", to: "ideas" },
  { from: "you", to: "coder" },
  { from: "you", to: "research" },
  { from: "youmd", to: "auditor" },
  { from: "youmd", to: "github" },
  { from: "bamfsite", to: "auditor" },
  { from: "bamfsite", to: "slack" },
  { from: "creator", to: "router" },
  { from: "coder", to: "youmd" },
  { from: "research", to: "bigbounce" },
  { from: "ideas", to: "youmd" },
];

// ── Tasks ───────────────────────────────────────────────────────────────────
export type Task = {
  id: string;
  title: string;
  owner: "you" | "agent";
  status: "open" | "in_progress" | "done";
  priority: "low" | "med" | "high";
  project: string;
};

export const TASKS: Task[] = [
  { id: "t1", title: "Lock desktop app UI/UX (this demo)", owner: "you", status: "in_progress", priority: "high", project: "you.md" },
  { id: "t2", title: "Wire realtime sync across 3 machines", owner: "agent", status: "in_progress", priority: "high", project: "you.md" },
  { id: "t3", title: "Build Obsidian-style graph view", owner: "agent", status: "done", priority: "med", project: "you.md" },
  { id: "t4", title: "Audit Lempod ownership across repos", owner: "agent", status: "open", priority: "med", project: "bamfsite" },
  { id: "t5", title: "Draft big-bounce paper section 3", owner: "you", status: "open", priority: "low", project: "bigbounce" },
  { id: "t6", title: "Spawn writing-you sub-agent", owner: "agent", status: "open", priority: "low", project: "creator.new" },
];

// ── Connected apps ─────────────────────────────────────────────────────────
export type AppConn = {
  id: string;
  name: string;
  category: string;
  status: "connected" | "syncing" | "available";
  detail: string;
  icon: IconName;
};

export const APPS: AppConn[] = [
  { id: "github", name: "GitHub", category: "Code", status: "connected", detail: "55 repos · synced just now", icon: "github" },
  { id: "slack", name: "Slack", category: "Comms", status: "connected", detail: "Capture → inbox", icon: "slack" },
  { id: "linear", name: "Linear", category: "Tasks", status: "syncing", detail: "Importing issues…", icon: "check" },
  { id: "notion", name: "Notion", category: "Notes", status: "connected", detail: "2 workspaces", icon: "file" },
  { id: "x", name: "X", category: "Social", status: "connected", detail: "Enriched via Grok", icon: "at" },
  { id: "linkedin", name: "LinkedIn", category: "Social", status: "connected", detail: "Profile + posts", icon: "at" },
  { id: "gmail", name: "Gmail", category: "Comms", status: "available", detail: "Connect to capture threads", icon: "mail" },
  { id: "figma", name: "Figma", category: "Design", status: "available", detail: "Connect for design context", icon: "plug" },
];

// ── Sub-agents ("YOU sub-agents") ──────────────────────────────────────────
export type SubAgent = {
  id: string;
  name: string;
  role: string;
  status: "active" | "idle" | "spawning";
  scope: string;
  runs: number;
};

export const SUB_AGENTS: SubAgent[] = [
  { id: "coding-you", name: "coding-you", role: "Ships code like you would", status: "active", scope: "youmd, bamfsite", runs: 142 },
  { id: "research-you", name: "research-you", role: "Reads, verifies, synthesizes", status: "active", scope: "bigbounce", runs: 38 },
  { id: "writing-you", name: "writing-you", role: "Writes in your voice", status: "idle", scope: "creator.new", runs: 21 },
  { id: "ops-you", name: "ops-you", role: "Inbox triage + task routing", status: "active", scope: "all", runs: 96 },
];

// ── Chat seed (mirrors the screenshots' assistant tone) ────────────────────
export type ChatRole = "user" | "agent";
export type ChatMessage = {
  id: string;
  role: ChatRole;
  text: string;
};

export const SEED_CHAT: ChatMessage[] = [
  {
    id: "m1",
    role: "user",
    text: "Show me the last 7 days across my projects and tell me what to build next.",
  },
  {
    id: "m2",
    role: "agent",
    text:
      "You shipped 84 changes across 4 active projects this week — you.md leads with 41. The desktop app UI is the highest-leverage open thread.\n\nI can spawn a **coding-you** sub-agent to scaffold the next pane while we talk. Want me to start it?",
  },
];

// AI summary for the Codex-style sticky widget in full-chat mode.
export const SESSION_SUMMARY = {
  title: "Session summary",
  bullets: [
    "Reviewing 7-day portfolio activity (84 shipped)",
    "you.md desktop app flagged as top priority",
    "coding-you sub-agent ready to spawn",
  ],
  tokens: "12.4k / 200k",
  model: "claude-sonnet-4.6",
};

// ── Skills & Stacks (capabilities layer — DRY, shared, grouped) ────────────
export type Skill = {
  name: string;
  category: string;
  sharedAcross: number; // # of machines/agents that use this ONE definition
  projects: string[]; // projects that install it
  meta?: boolean; // self-improving / skill-creating meta-skill
};

export const SKILLS: Skill[] = [
  { name: "portfolio-graph-auditor", category: "Project intelligence", sharedAcross: 3, projects: ["you.md", "bamfsite", "bigbounce"] },
  { name: "braindump-task-router", category: "Capture", sharedAcross: 3, projects: ["you.md", "creator.new"] },
  { name: "machine-bootstrap", category: "Ops", sharedAcross: 3, projects: ["all"] },
  { name: "youstack-maintainer", category: "Stacks", sharedAcross: 2, projects: ["you.md"] },
  { name: "meta-improve", category: "Meta", sharedAcross: 3, projects: ["all"], meta: true },
  { name: "skill-forge", category: "Meta", sharedAcross: 2, projects: ["all"], meta: true },
  { name: "writing-voice", category: "Content", sharedAcross: 2, projects: ["creator.new", "bamfsite"] },
];

export type Stack = {
  name: string;
  domain: string;
  visibility: "private" | "scoped" | "public";
  skills: string[];
  projects: string[];
};

export const STACKS: Stack[] = [
  {
    name: "YouStack",
    domain: "coding",
    visibility: "private",
    skills: ["portfolio-graph-auditor", "braindump-task-router", "machine-bootstrap", "meta-improve"],
    projects: ["you.md", "bamfsite"],
  },
  {
    name: "ContentStack",
    domain: "content creation",
    visibility: "scoped",
    skills: ["writing-voice", "braindump-task-router", "skill-forge"],
    projects: ["creator.new"],
  },
  {
    name: "ResearchStack",
    domain: "scientific research",
    visibility: "private",
    skills: ["portfolio-graph-auditor", "meta-improve"],
    projects: ["bigbounce"],
  },
  {
    name: "BAMFStack",
    domain: "growth marketing (lighthouse)",
    visibility: "public",
    skills: ["writing-voice", "youstack-maintainer"],
    projects: ["bamfsite"],
  },
];

// ── Devices (runtime layer — machines syncing in realtime) ─────────────────
export type Device = {
  name: string;
  os: string;
  status: "active" | "synced" | "idle";
  lastSync: string;
  agents: string[]; // sub-agents currently resident here
  current: boolean;
};

export const DEVICES: Device[] = [
  { name: "Houstons-MBP", os: "macOS · M3 Max", status: "active", lastSync: "just now", agents: ["coding-you", "ops-you"], current: true },
  { name: "Mac-mini", os: "macOS · M2", status: "synced", lastSync: "30s ago", agents: ["research-you"], current: false },
  { name: "studio-vm", os: "Linux · agent host", status: "idle", lastSync: "4m ago", agents: ["writing-you"], current: false },
];

// ── Agent bus (cross-machine, cross-agent realtime messages) ───────────────
export type BusMessage = {
  id: string;
  from: string;
  device: string;
  channel: string;
  text: string;
  at: string;
};

export const AGENT_BUS: BusMessage[] = [
  { id: "b1", from: "coding-you", device: "Houstons-MBP", channel: "you.md", text: "Pushed desktop-demo skills view, tests green.", at: "just now" },
  { id: "b2", from: "research-you", device: "Mac-mini", channel: "bigbounce", text: "Synced 3 new sources, drafting section 3.", at: "1m ago" },
  { id: "b3", from: "ops-you", device: "Houstons-MBP", channel: "machine-sync", text: "studio-vm online, identity + skills pulled.", at: "4m ago" },
];

// ── Background daemons (the "it just works" layer — awareness, never config) ─
// These run behind the scenes via the curl install + resident daemons. The
// desktop app only ever shows their STATE, never controls — that's the
// product line between background and foreground.
export type Daemon = {
  name: string;
  detail: string;
  last: string;
};

export const DAEMONS: Daemon[] = [
  { name: "identity sync", detail: "every 5 min", last: "just now" },
  { name: "skill + stack sync", detail: "every 5 min", last: "1m ago" },
  { name: "project-context sync", detail: "every 15 min", last: "8m ago" },
  { name: "realtime websocket", detail: "live", last: "now" },
  { name: "crawlers", detail: "5 sources · GitHub, Slack, X…", last: "2m ago" },
];

// One-line AI brief for Home (like the Codex/assistant brief in the inspo).
export const DAILY_BRIEF =
  "84 changes shipped across 4 projects this week — you.md leads with 41. Two follow-ups need you, and everything's synced across 3 machines.";
