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
  | "loops"
  | "terminal"
  | "provision"
  | "sync"
  | "livelog";

export type NavItem = {
  id: ViewId;
  label: string;
  icon: IconName;
};

// ── Information architecture: 6 destinations, not 16 panes ──────────────────
// A *destination* is one entry in the left rail. Some destinations hold several
// *segments* (sub-views) shown as a segmented control in the workspace header.
// This is the core IA move: collapse the old 16-pane / 4-nav-group / 2-tab-row
// sprawl into 6 clear places + progressive disclosure (segments + inspector).
export type Segment = { id: ViewId; label: string };
export type Destination = {
  id: string;
  label: string;
  icon: IconName;
  group: "top" | "workspace" | "system";
  segments: Segment[];
};

export const DESTINATIONS: Destination[] = [
  {
    id: "home",
    label: "Home",
    icon: "home",
    group: "top",
    segments: [{ id: "home", label: "Home" }],
  },
  {
    // Brain = the second brain: a vault of markdown AND the Obsidian-style graph
    // of how everything interrelates — two modes of the same thing.
    id: "brain",
    label: "Brain",
    icon: "brain",
    group: "workspace",
    segments: [
      { id: "editor", label: "Vault" },
      { id: "graph", label: "Graph" },
      { id: "livelog", label: "Live Log" },
    ],
  },
  {
    id: "projects",
    label: "Projects",
    icon: "branch",
    group: "workspace",
    segments: [{ id: "projects", label: "Projects" }],
  },
  {
    id: "tasks",
    label: "Tasks",
    icon: "check",
    group: "workspace",
    segments: [{ id: "tasks", label: "Tasks" }],
  },
  {
    id: "stacks",
    label: "Skills & Stacks",
    icon: "stack",
    group: "workspace",
    segments: [{ id: "skills", label: "Skills & Stacks" }],
  },
  {
    // Runtime = where work happens + ops, consolidated. The old machine / agents
    // / github / apis / vault / analytics panes fold in here, plus the hero
    // "Provision" flow for spinning up a new Mac / VPS / container.
    id: "runtime",
    label: "Runtime",
    icon: "sync",
    group: "system",
    segments: [
      { id: "sync", label: "Sync" },
      { id: "agents", label: "Agents" },
      { id: "loops", label: "Loops" },
      { id: "apps", label: "Connections" },
      { id: "provision", label: "Provision" },
    ],
  },
];

// Flat list for title lookups, the command palette, and mobile tab labels.
export const PRIMARY_NAV: NavItem[] = DESTINATIONS.flatMap((d) =>
  d.segments.map((s) => ({ id: s.id, label: s.label, icon: d.icon })),
);

// Which destination owns a given segment/view (drives rail highlight + header).
export function destinationForView(view: ViewId): Destination {
  return (
    DESTINATIONS.find((d) => d.segments.some((s) => s.id === view)) ?? DESTINATIONS[0]
  );
}

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
  { slug: "bamfsite", name: "bamfsite", focus: "active", shipped7d: 18, blurb: "BAMF Media growth site + admin OS.", stack: "BAMFStack" },
  { slug: "myo", name: "myo", focus: "active", shipped7d: 12, blurb: "Agentic personal-automation platform.", stack: "MyoStack" },
  { slug: "bigbounce", name: "bigbounce", focus: "active", shipped7d: 9, blurb: "Cyclic-universe cosmology research.", stack: "ResearchStack" },
  { slug: "hubify", name: "hubify", focus: "idle", shipped7d: 4, blurb: "Creator hub + lab sites monorepo.", stack: "HubStack" },
  { slug: "tipnes-ai", name: "tipnes.ai", focus: "idle", shipped7d: 3, blurb: "Realtime voice AI tutor.", stack: "YouStack" },
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
  domain: string; // for the favicon (google s2 favicons)
  account?: string;
  scopes?: string[];
  lastSync?: string;
};

export const APPS: AppConn[] = [
  { id: "github", name: "GitHub", category: "Code", status: "connected", detail: "55 repos · synced just now", domain: "github.com", account: "@houstongolden", scopes: ["repo", "read:org", "workflow"], lastSync: "just now" },
  { id: "slack", name: "Slack", category: "Comms", status: "connected", detail: "Capture → inbox", domain: "slack.com", account: "BAMF workspace", scopes: ["channels:history", "chat:write"], lastSync: "2m ago" },
  { id: "linear", name: "Linear", category: "Tasks", status: "syncing", detail: "Importing issues…", domain: "linear.app", account: "you.md team", scopes: ["read", "write"], lastSync: "syncing" },
  { id: "notion", name: "Notion", category: "Notes", status: "connected", detail: "2 workspaces", domain: "notion.so", account: "Houston Golden", scopes: ["read content"], lastSync: "1h ago" },
  { id: "x", name: "X", category: "Social", status: "connected", detail: "Enriched via Grok", domain: "x.com", account: "@houstongolden", scopes: ["read profile", "read posts"], lastSync: "4h ago" },
  { id: "linkedin", name: "LinkedIn", category: "Social", status: "connected", detail: "Profile + posts", domain: "linkedin.com", account: "Houston Golden", scopes: ["r_liteprofile", "posts"], lastSync: "1d ago" },
  { id: "gmail", name: "Gmail", category: "Comms", status: "available", detail: "Connect to capture threads", domain: "gmail.com" },
  { id: "figma", name: "Figma", category: "Design", status: "available", detail: "Connect for design context", domain: "figma.com" },
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
  { name: "Houstons-Mini", os: "macOS · M2", status: "synced", lastSync: "30s ago", agents: ["research-you"], current: false },
  { name: "cloud-vps", os: "Linux · agent host", status: "idle", lastSync: "4m ago", agents: ["writing-you"], current: false },
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
  { id: "b1", from: "ops-you", device: "Houstons-Mini", channel: "machine-sync", text: "Fresh machine restored env vault through trusted-device Secret Vault.", at: "just now" },
  { id: "b2", from: "coding-you", device: "Houstons-MBP", channel: "you.md", text: "Promoted desktop shell to the 6-destination layout, lint green.", at: "2m ago" },
  { id: "b3", from: "research-you", device: "Houstons-Mini", channel: "bigbounce", text: "Synced 3 new sources, drafting section 3.", at: "6m ago" },
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

// ── Loops (recurring automations — workflows + crawlers run on their own) ───
// A loop is anything that runs on a schedule/trigger without you: scheduled
// workflows, self-improvement loops, and the crawlers that feed your brain.
export type Loop = {
  id: string;
  name: string;
  kind: "workflow" | "crawler";
  trigger: string;
  does: string;
  scope: string;
  status: "running" | "paused";
  lastRun: string;
};

export const LOOPS: Loop[] = [
  { id: "l1", name: "Morning brief", kind: "workflow", trigger: "daily · 8am", does: "Compiles your day across projects, tasks, and machines.", scope: "all", status: "running", lastRun: "2h ago" },
  { id: "l2", name: "Brain-dump router", kind: "workflow", trigger: "on capture", does: "Routes captures into the right project + proposes tasks.", scope: "all", status: "running", lastRun: "1m ago" },
  { id: "l3", name: "Skill self-improve", kind: "workflow", trigger: "weekly", does: "meta-improve refines installed skills from usage.", scope: "all", status: "running", lastRun: "1d ago" },
  { id: "l4", name: "GitHub crawler", kind: "crawler", trigger: "every 15 min", does: "Pulls commits/PRs into the portfolio graph.", scope: "all", status: "running", lastRun: "2m ago" },
  { id: "l5", name: "Social enrich", kind: "crawler", trigger: "daily", does: "Refreshes X / LinkedIn context for your profile.", scope: "you.md", status: "running", lastRun: "4h ago" },
  { id: "l6", name: "Stale-source check", kind: "crawler", trigger: "daily", does: "Flags sources older than 7 days for refresh.", scope: "all", status: "paused", lastRun: "—" },
];

// ── Recent chats (sidebar history — like Claude/ChatGPT) ───────────────────
export type ChatThread = { id: string; title: string; at: string };

export const CHATS: ChatThread[] = [
  { id: "c1", title: "Lock the desktop app UI/UX", at: "now" },
  { id: "c2", title: "Triage bamfsite tasks and follow-ups", at: "2h" },
  { id: "c3", title: "Draft big-bounce paper section 3", at: "5h" },
  { id: "c4", title: "Spawn writing-you for creator.new", at: "1d" },
  { id: "c5", title: "Audit Lempod ownership across repos", at: "1d" },
  { id: "c6", title: "Weekly portfolio review", at: "2d" },
  { id: "c7", title: "New computer setup for the Mac mini", at: "3d" },
];

// ── Provision (the hero "set up a whole synced environment" flow) ───────────
// The single biggest differentiator: spin up a new Mac / VPS / container with
// your entire synced agentic working environment in one guided flow. This is
// the visual front-end of the machine-bootstrap CLI.
export type ProvisionTarget = {
  id: string;
  label: string;
  detail: string;
  icon: IconName;
};

export const PROVISION_TARGETS: ProvisionTarget[] = [
  { id: "mac", label: "New Mac", detail: "macOS · Apple Silicon", icon: "device" },
  { id: "vps", label: "Cloud VPS", detail: "Linux · headless agent host", icon: "sync" },
  { id: "container", label: "Dev container", detail: "Ephemeral sandbox", icon: "stack" },
];

export type ProvisionStep = {
  id: string;
  label: string;
  detail: string;
  state: "done" | "active" | "pending";
};

export const PROVISION_STEPS: ProvisionStep[] = [
  { id: "prereq", label: "Prerequisites", detail: "Homebrew · Node 22 · git · gh · bun", state: "done" },
  { id: "runtime", label: "Install you.md runtime", detail: "curl install.sh → youmd 0.8.12", state: "done" },
  { id: "identity", label: "Pull identity + sync brain", detail: "profile · preferences · voice · memories", state: "done" },
  { id: "skills", label: "Install skills + stacks", detail: "12 shared skills · mesh-synced", state: "active" },
  { id: "mcp", label: "Wire MCP across agents", detail: "shared AGENTS.md → Claude · Codex · Cursor", state: "pending" },
  { id: "repos", label: "Clone active projects", detail: "30-day ACTIVE + Top Priority/Focusing", state: "pending" },
  { id: "vault", label: "Restore env vault", detail: "trusted-device envelope · secrets stay local", state: "pending" },
  { id: "proof", label: "Sync machine proof", detail: "readiness report → you.md", state: "pending" },
];

// ── Legibility: what this is + how it actually helps you ────────────────────
// The single sentence a first-time user should read and immediately get it.
export const VALUE_PROP =
  "Your second brain for AI agents. you.md gives every agent — on every machine — full context on who you are, what you're building, and how you work, then keeps it all in sync as you and your agents get things done.";

export type HowStep = { icon: IconName; title: string; body: string };
export const HOW_IT_WORKS: HowStep[] = [
  {
    icon: "brain",
    title: "Your brain stays current",
    body: "Identity, projects, skills, and memories live in one place — edited by you, enriched by your agents.",
  },
  {
    icon: "agent",
    title: "Your agents work with it",
    body: "Spawn scoped clones of you. Each starts with full context — no re-explaining who you are or what matters.",
  },
  {
    icon: "sync",
    title: "Everything stays in sync",
    body: "Open any machine, any agent (Claude · Codex · Cursor) — same brain, same skills, same projects, live.",
  },
];

// ── Live activity (the "it's working for you" feed) ─────────────────────────
// Pixel-character actors make agents + machines feel alive and legible.
export type ActivityActor = "agent" | "machine";
export type ActivityEvent = {
  id: string;
  actor: string;
  kind: ActivityActor;
  status: "active" | "ready" | "idle";
  text: string;
  at: string;
};

// ── Agent sessions (the unified shell: chat + terminals, local + remote) ────
// The conductor surface: every live agent session you can switch between,
// grouped by project. Remote sessions run on OTHER you.md-synced machines and
// can be watched in real time (peekaboo) — like local-vs-cloud agents, but the
// "cloud" is your own other computers.
// The CLI agents / models a session can run — shown in a compact dropdown with
// per-agent marks (faux favicons) so it never eats horizontal space.
export type ModelId = "you" | "claude-code" | "codex" | "cursor" | "pi" | "openclaw" | "hermes" | "shell";
export type ModelDef = { id: ModelId; label: string; mark: string; color: string };
export const MODELS: ModelDef[] = [
  { id: "you", label: "You", mark: "Y", color: "#C46A3A" },
  { id: "claude-code", label: "Claude Code", mark: "✻", color: "#C46A3A" },
  { id: "codex", label: "Codex", mark: "◇", color: "#10A37F" },
  { id: "cursor", label: "Cursor", mark: "▸", color: "#8B8B8B" },
  { id: "pi", label: "Pi.dev", mark: "π", color: "#6E56CF" },
  { id: "openclaw", label: "OpenClaw", mark: "⌗", color: "#D9A441" },
  { id: "hermes", label: "Hermes", mark: "✦", color: "#3B82F6" },
  { id: "shell", label: "Shell", mark: "❯", color: "#8B8B8B" },
];

export type SessionKind = "chat" | "terminal";
export type SessionStatus = "active" | "idle" | "waiting" | "blocked";
export type AgentSession = {
  id: string;
  title: string;
  kind: SessionKind;
  agent: string; // pixel-character seed + display
  model: ModelId;
  project: string;
  machine: string;
  local: boolean; // this machine vs another synced computer (watch)
  status: SessionStatus;
  summary: string; // what it's doing — shown when watching a remote session
  task?: string; // the tracked task this session is working on
  needsYou?: string; // if set, this session is blocked on you — surfaced loudly
  subAgents?: number; // sub-agents this agent spawned itself (you don't manage these)
};

export const SESSIONS: AgentSession[] = [
  // you.md — three agents on different slices
  { id: "ss1", title: "Lock desktop UI/UX", kind: "chat", agent: "you-agent", model: "you", project: "you.md", machine: "Houstons-MBP", local: true, status: "active", summary: "Designing the unified shell with you.", task: "Lock desktop app UI/UX" },
  { id: "ss2", title: "Build session rail", kind: "terminal", agent: "coding-you", model: "claude-code", project: "you.md", machine: "Houstons-MBP", local: true, status: "active", summary: "Editing DesktopShell.tsx, running lint.", task: "Unified sessions shell", subAgents: 2 },
  { id: "ss3", title: "Graph data model", kind: "terminal", agent: "codex", model: "codex", project: "you.md", machine: "Houstons-MBP", local: true, status: "idle", summary: "Scaffolding the brain graph model.", task: "Obsidian-style graph view" },
  // bamfsite — one working, one blocked on you
  { id: "ss4", title: "Restore env + build", kind: "terminal", agent: "ops-you", model: "codex", project: "bamfsite", machine: "Houstons-MBP", local: true, status: "blocked", summary: "Build is red — needs the Supabase anon key.", task: "bamfsite green build", needsYou: "Paste VITE_SUPABASE_ANON_KEY to unblock the build" },
  { id: "ss5", title: "Triage Slack captures", kind: "chat", agent: "ops-you", model: "claude-code", project: "bamfsite", machine: "Houstons-MBP", local: true, status: "active", summary: "Routing captures into tasks.", task: "Inbox triage" },
  // bigbounce — remote, watchable
  { id: "ss6", title: "Draft section 3", kind: "chat", agent: "research-you", model: "pi", project: "bigbounce", machine: "Houstons-Mini", local: false, status: "active", summary: "Reading 3 sources; drafting the bounce-entropy argument.", task: "Big-bounce paper §3", subAgents: 1 },
  // creator.new — remote, waiting on you to choose
  { id: "ss7", title: "Creator post", kind: "chat", agent: "writing-you", model: "hermes", project: "creator.new", machine: "cloud-vps", local: false, status: "waiting", summary: "Drafted a post in your voice; 2 hooks proposed.", task: "Weekly creator post", needsYou: "Pick one of the 2 hooks it proposed" },
];

// A remote session's streaming summary lines (for the watch / peekaboo view).
export const WATCH_FEED: Record<string, string[]> = {
  ss6: [
    "opened bigbounce/paper/section-3.md",
    "pulled 3 sources from the brain (semantic-scholar, NASA ADS)",
    "drafting: entropy across the bounce — paragraph 2/5",
    "flagged 1 claim for your review",
  ],
  ss7: [
    "loaded your voice profile + last 20 posts",
    "topic: shipping the you.md desktop app",
    "proposed 2 hooks — waiting for you to pick one",
    "draft 1 ready for review",
  ],
};

export const ACTIVITY: ActivityEvent[] = [
  { id: "e1", actor: "ops-you", kind: "agent", status: "active", text: "Routed a Slack capture into bamfsite · proposed 2 tasks", at: "now" },
  { id: "e2", actor: "Houstons-Mini", kind: "machine", status: "ready", text: "Restored env vault · 8 projects ready to run", at: "1m" },
  { id: "e3", actor: "coding-you", kind: "agent", status: "active", text: "Pushed the 6-destination desktop shell · lint green", at: "2m" },
  { id: "e4", actor: "research-you", kind: "agent", status: "active", text: "Synced 3 new sources into the bigbounce brain", at: "6m" },
  { id: "e5", actor: "skill-mesh", kind: "machine", status: "ready", text: "12 shared skills synced across 3 machines", at: "8m" },
  { id: "e6", actor: "writing-you", kind: "agent", status: "idle", text: "Drafted a creator post in your voice · awaiting review", at: "14m" },
];
