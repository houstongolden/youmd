/**
 * Decompile a you.json bundle into individual markdown files.
 * Inverse of convex/lib/compile.ts — takes structured youJson and produces
 * a virtual file tree with markdown content for each section.
 */

export interface VirtualFile {
  path: string;
  content: string;
  section: string; // which youJson section this maps to
  editable: boolean;
}

export interface FileTreeNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileTreeNode[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function decompileBundle(youJson: any, youMd: string): VirtualFile[] {
  const files: VirtualFile[] = [];

  // Root files
  files.push({
    path: "you.md",
    content: youMd,
    section: "youMd",
    editable: false, // compiled output, not directly editable
  });

  files.push({
    path: "you.json",
    content: JSON.stringify(youJson, null, 2),
    section: "youJson",
    editable: false,
  });

  // profile/about.md
  const identity = youJson?.identity;
  if (identity) {
    const lines: string[] = [];
    lines.push(`---`);
    lines.push(`title: About`);
    lines.push(`---`);
    lines.push(``);
    lines.push(`# ${identity.name || ""}`);
    if (identity.tagline) lines.push(`\n${identity.tagline}`);
    if (identity.location) lines.push(`\n*${identity.location}*`);
    if (identity.bio?.long) lines.push(`\n${identity.bio.long}`);
    else if (identity.bio?.medium) lines.push(`\n${identity.bio.medium}`);
    else if (identity.bio?.short) lines.push(`\n${identity.bio.short}`);
    files.push({
      path: "profile/about.md",
      content: lines.join("\n"),
      section: "identity",
      editable: true,
    });
  }

  // profile/now.md
  const now = youJson?.now;
  if (now?.focus?.length > 0) {
    const lines: string[] = [
      `---`,
      `title: Now`,
      `updated: ${now.updated_at || ""}`,
      `---`,
      ``,
      `# Now`,
      ``,
      ...now.focus.map((f: string) => `- ${f}`),
    ];
    files.push({
      path: "profile/now.md",
      content: lines.join("\n"),
      section: "now",
      editable: true,
    });
  }

  // profile/projects.md
  const projects = youJson?.projects;
  if (projects?.length > 0) {
    const lines: string[] = [`---`, `title: Projects`, `---`, ``, `# Projects`, ``];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const p of projects as any[]) {
      lines.push(`## ${p.name}`);
      if (p.role) lines.push(`**Role:** ${p.role}`);
      if (p.status) lines.push(`**Status:** ${p.status}`);
      if (p.url) lines.push(`**URL:** ${p.url}`);
      if (p.description) lines.push(`\n${p.description}`);
      lines.push(``);
    }
    files.push({
      path: "profile/projects.md",
      content: lines.join("\n"),
      section: "projects",
      editable: true,
    });
  }

  // profile/values.md
  const values = youJson?.values;
  if (values?.length > 0) {
    const lines: string[] = [
      `---`,
      `title: Values`,
      `---`,
      ``,
      `# Values`,
      ``,
      ...values.map((v: string) => `- ${v}`),
    ];
    files.push({
      path: "profile/values.md",
      content: lines.join("\n"),
      section: "values",
      editable: true,
    });
  }

  // profile/links.md
  const links = youJson?.links;
  if (links && Object.keys(links).length > 0) {
    const lines: string[] = [`---`, `title: Links`, `---`, ``, `# Links`, ``];
    for (const [platform, url] of Object.entries(links)) {
      lines.push(`- **${platform}:** ${url}`);
    }
    files.push({
      path: "profile/links.md",
      content: lines.join("\n"),
      section: "links",
      editable: true,
    });
  }

  // preferences/agent.md
  const agentPrefs = youJson?.preferences?.agent;
  if (agentPrefs) {
    const lines: string[] = [`---`, `title: Agent Preferences`, `---`, ``, `# Agent Preferences`, ``];
    if (agentPrefs.tone) lines.push(`**Tone:** ${agentPrefs.tone}`);
    if (agentPrefs.formality) lines.push(`**Formality:** ${agentPrefs.formality}`);
    if (agentPrefs.avoid?.length > 0) lines.push(`**Avoid:** ${agentPrefs.avoid.join(", ")}`);
    files.push({
      path: "preferences/agent.md",
      content: lines.join("\n"),
      section: "preferences.agent",
      editable: true,
    });
  }

  // preferences/writing.md
  const writingPrefs = youJson?.preferences?.writing;
  if (writingPrefs) {
    const lines: string[] = [`---`, `title: Writing Preferences`, `---`, ``, `# Writing Preferences`, ``];
    if (writingPrefs.style) lines.push(`**Style:** ${writingPrefs.style}`);
    if (writingPrefs.format) lines.push(`**Format:** ${writingPrefs.format}`);
    files.push({
      path: "preferences/writing.md",
      content: lines.join("\n"),
      section: "preferences.writing",
      editable: true,
    });
  }

  // Voice files
  const voice = youJson?.voice;
  if (voice?.overall) {
    files.push({
      path: "voice/voice.md",
      content: [`---`, `title: Voice`, `---`, ``, `# Voice`, ``, voice.overall].join("\n"),
      section: "voice",
      editable: true,
    });
  }
  const voicePlatforms: Array<[string, string, string]> = [
    ["linkedin", "LinkedIn Voice", "voice.linkedin"],
    ["x", "X Voice", "voice.x"],
    ["blog", "Blog Voice", "voice.blog"],
  ];
  for (const [key, title, section] of voicePlatforms) {
    const content = voice?.platforms?.[key];
    if (content) {
      files.push({
        path: `voice/voice.${key}.md`,
        content: [`---`, `title: ${title}`, `---`, ``, `# ${title}`, ``, content].join("\n"),
        section,
        editable: true,
      });
    }
  }

  // ── Scaffold: ensure all standard directories + files exist ──
  // Even when empty, these should appear in the file tree so users
  // know the structure and can fill them in.
  const existingPaths = new Set(files.map((f) => f.path));

  const scaffold: Array<{ path: string; content: string; section: string; editable: boolean }> = [
    // Profile (public)
    { path: "profile/about.md", content: "---\ntitle: About\n---\n\n# About\n\nTell the agent about yourself.\n", section: "identity", editable: true },
    { path: "profile/now.md", content: "---\ntitle: Now\n---\n\n# Now\n\n- what you're working on right now\n", section: "now", editable: true },
    { path: "profile/projects.md", content: "---\ntitle: Projects\n---\n\n# Projects\n\n## Project Name\nDescription of your project.\n", section: "projects", editable: true },
    { path: "profile/values.md", content: "---\ntitle: Values\n---\n\n# Values\n\n- your core principles\n", section: "values", editable: true },
    { path: "profile/links.md", content: "---\ntitle: Links\n---\n\n# Links\n\n- **website:** https://\n- **github:** https://github.com/\n- **x:** https://x.com/\n", section: "links", editable: true },
    { path: "profile/skills.md", content: "---\ntitle: Skills\n---\n\n# Skills\n\n- your key skills and expertise\n", section: "skills", editable: true },
    { path: "profile/experience.md", content: "---\ntitle: Experience\n---\n\n# Experience\n\nYour professional background.\n", section: "experience", editable: true },

    // Preferences
    { path: "preferences/agent.md", content: "---\ntitle: Agent Preferences\n---\n\n# Agent Preferences\n\n**Tone:** direct, curious\n**Formality:** casual-professional\n**Avoid:** corporate speak, emoji\n", section: "preferences.agent", editable: true },
    { path: "preferences/writing.md", content: "---\ntitle: Writing Style\n---\n\n# Writing Style\n\n**Style:** concise, lowercase, terminal-native\n**Format:** markdown preferred\n", section: "preferences.writing", editable: true },
    { path: "preferences/tools.md", content: "---\ntitle: Tools\n---\n\n# Tools & Stack\n\nTools, languages, frameworks you use.\n", section: "preferences.tools", editable: true },

    // Voice (platform-specific writing styles)
    { path: "voice/voice.md", content: "---\ntitle: Voice\n---\n\n# Overall Voice\n\nYour general communication style across all platforms.\n", section: "voice", editable: true },
    { path: "voice/voice.linkedin.md", content: "---\ntitle: LinkedIn Voice\nplatform: linkedin\n---\n\n# LinkedIn Voice\n\nHow you communicate on LinkedIn.\n", section: "voice.linkedin", editable: true },
    { path: "voice/voice.x.md", content: "---\ntitle: X Voice\nplatform: x\n---\n\n# X Voice\n\nHow you communicate on X/Twitter.\n", section: "voice.x", editable: true },
    { path: "voice/voice.email.md", content: "---\ntitle: Email Voice\nplatform: email\n---\n\n# Email Voice\n\nHow you write emails.\n", section: "voice.email", editable: true },
    { path: "voice/voice.blog.md", content: "---\ntitle: Blog Voice\nplatform: blog\n---\n\n# Blog Voice\n\nHow you write long-form content.\n", section: "voice.blog", editable: true },
    { path: "voice/voice.slack.md", content: "---\ntitle: Slack Voice\nplatform: slack\n---\n\n# Slack Voice\n\nHow you communicate in team chat.\n", section: "voice.slack", editable: true },

    // Private (owner-only, never public)
    { path: "private/notes.md", content: "---\ntitle: Private Notes\nvisibility: private\n---\n\n# Private Notes\n\nPersonal notes, internal context, things agents should know but the public shouldn't see.\n", section: "private.notes", editable: true },
    { path: "private/projects.md", content: "---\ntitle: Private Projects\nvisibility: private\n---\n\n# Private Projects\n\nStealth projects, internal initiatives, confidential work.\n", section: "private.projects", editable: true },
    { path: "private/internal-links.md", content: "---\ntitle: Internal Links\nvisibility: private\n---\n\n# Internal Links\n\nPrivate URLs, internal tools, team resources.\n", section: "private.links", editable: true },
    { path: "private/context.md", content: "---\ntitle: Private Context\nvisibility: private\n---\n\n# Private Context\n\nAdditional context for trusted agents: priorities, preferences, working style details.\n", section: "private.context", editable: true },
    { path: "private/calendar.md", content: "---\ntitle: Calendar Context\nvisibility: private\n---\n\n# Calendar Context\n\nAvailability signals, meeting preferences, timezone.\n", section: "private.calendar", editable: true },

    // Projects (individual project directories)
    { path: "projects/README.md", content: "---\ntitle: Projects Directory\n---\n\n# Projects\n\nEach project can have its own directory with context files.\nCreate a folder per project: projects/project-name/\n", section: "projects.index", editable: true },

    // Memory
    { path: "memory/index.md", content: "---\ntitle: Memory Index\n---\n\n# Memory\n\nAgent memories and learned context. Managed automatically.\n", section: "memory", editable: false },

    // Sessions
    { path: "sessions/history.md", content: "---\ntitle: Session History\n---\n\n# Session History\n\nConversation history and session logs.\n", section: "sessions", editable: false },
  ];

  // Only add scaffold files that don't already exist from real data
  for (const s of scaffold) {
    if (!existingPaths.has(s.path)) {
      files.push(s);
    }
  }

  // FOLDER.md — the directory contract (inspired by folder.md)
  const username = youJson?.username || "";
  files.push({
    path: "FOLDER.md",
    content: `# you.md/${username} — Directory Structure

This is a you-md/v1 identity context protocol. It contains structured context
about who you are, what you do, and how you communicate.

## Directory Layout

\`\`\`
profile/        public identity (bio, projects, values, links, skills)
preferences/    how agents should interact with you (tone, tools, writing)
voice/          platform-specific communication styles
private/        owner-only context (never shared publicly)
projects/       individual project directories
memory/         agent-learned context (auto-managed)
sessions/       conversation history
\`\`\`

## Visibility

- **profile/** — always public, readable by any agent
- **preferences/** — public, guides agent behavior
- **voice/** — public, helps agents write like you
- **private/** — NEVER public, only shared via scoped tokens
- **projects/** — public by default, can be scoped private
- **memory/** — private, auto-managed by the agent
- **sessions/** — private, conversation logs

## For Agents

Read this file first. Check profile/about.md for identity context.
Check preferences/agent.md for communication preferences.
Check voice/ for platform-specific writing style.

Full structured data: see you.json
`,
    section: "folder",
    editable: false,
  });

  // manifest.json
  const allPaths = files.map((f) => f.path);
  files.push({
    path: "manifest.json",
    content: JSON.stringify({
      schema: youJson?.schema || "you-md/v1",
      username,
      generated_at: youJson?.generated_at || new Date().toISOString(),
      compiler_version: youJson?.meta?.compiler_version || "0.2.0",
      paths: {
        public: allPaths.filter((p) => !p.startsWith("private/") && !p.startsWith("memory/") && !p.startsWith("sessions/")),
        private: allPaths.filter((p) => p.startsWith("private/")),
        managed: allPaths.filter((p) => p.startsWith("memory/") || p.startsWith("sessions/")),
      },
    }, null, 2),
    section: "manifest",
    editable: false,
  });

  return files;
}

/**
 * Build a file tree structure from a flat list of virtual files.
 */
export function buildFileTree(files: VirtualFile[]): FileTreeNode[] {
  const root: FileTreeNode[] = [];
  const dirs = new Map<string, FileTreeNode>();

  // Sort files so directories come first, then alphabetically
  const sorted = [...files].sort((a, b) => {
    const aDepth = a.path.split("/").length;
    const bDepth = b.path.split("/").length;
    if (aDepth !== bDepth) return aDepth - bDepth;
    return a.path.localeCompare(b.path);
  });

  for (const file of sorted) {
    const parts = file.path.split("/");

    if (parts.length === 1) {
      // Root-level file
      root.push({ name: parts[0], path: file.path, type: "file" });
    } else {
      // Ensure parent directories exist
      const dirPath = parts.slice(0, -1).join("/");
      if (!dirs.has(dirPath)) {
        const dirNode: FileTreeNode = {
          name: parts[parts.length - 2],
          path: dirPath,
          type: "directory",
          children: [],
        };
        dirs.set(dirPath, dirNode);
        root.push(dirNode);
      }

      // Add file to directory
      const dir = dirs.get(dirPath)!;
      dir.children!.push({
        name: parts[parts.length - 1],
        path: file.path,
        type: "file",
      });
    }
  }

  return root;
}

// ── Memory file generation ────────────────────────────────────────

export interface MemoryEntry {
  _id: unknown;
  category: string;
  content: string;
  source: string;
  sourceAgent?: string;
  tags?: string[];
  createdAt: number;
}

export interface SessionEntry {
  _id: unknown;
  sessionId: string;
  surface: string;
  summary?: string;
  messageCount: number;
  lastMessageAt: number;
  createdAt: number;
}

const CATEGORY_ORDER = ["fact", "insight", "decision", "preference", "context", "goal", "relationship"];

/**
 * Generate memory files from memory entries.
 * Groups by category into individual .md files under memory/.
 */
export function generateMemoryFiles(memories: MemoryEntry[], sessions: SessionEntry[]): VirtualFile[] {
  const files: VirtualFile[] = [];

  if (memories.length === 0 && sessions.length === 0) return files;

  // Group memories by category
  const byCategory = new Map<string, MemoryEntry[]>();
  for (const mem of memories) {
    const cat = mem.category || "uncategorized";
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat)!.push(mem);
  }

  // Generate a file per category
  for (const cat of CATEGORY_ORDER) {
    const mems = byCategory.get(cat);
    if (!mems || mems.length === 0) continue;

    const lines: string[] = [
      `---`,
      `title: ${cat.charAt(0).toUpperCase() + cat.slice(1)}s`,
      `count: ${mems.length}`,
      `---`,
      ``,
      `# ${cat.charAt(0).toUpperCase() + cat.slice(1)}s`,
      ``,
    ];

    for (const mem of mems.sort((a, b) => b.createdAt - a.createdAt)) {
      const date = new Date(mem.createdAt).toISOString().split("T")[0];
      const tags = mem.tags?.length ? ` [${mem.tags.join(", ")}]` : "";
      const source = mem.source !== "you-agent" ? ` (via ${mem.sourceAgent || mem.source})` : "";
      lines.push(`- ${mem.content}${tags}${source} — *${date}*`);
    }

    files.push({
      path: `memory/${cat}s.md`,
      content: lines.join("\n"),
      section: `memory.${cat}`,
      editable: false, // memories are agent-managed
    });
  }

  // Handle any categories not in CATEGORY_ORDER
  for (const [cat, mems] of byCategory) {
    if (CATEGORY_ORDER.includes(cat)) continue;
    const lines: string[] = [
      `---`,
      `title: ${cat.charAt(0).toUpperCase() + cat.slice(1)}`,
      `count: ${mems.length}`,
      `---`,
      ``,
      `# ${cat.charAt(0).toUpperCase() + cat.slice(1)}`,
      ``,
    ];
    for (const mem of mems.sort((a, b) => b.createdAt - a.createdAt)) {
      const date = new Date(mem.createdAt).toISOString().split("T")[0];
      lines.push(`- ${mem.content} — *${date}*`);
    }
    files.push({
      path: `memory/${cat}.md`,
      content: lines.join("\n"),
      section: `memory.${cat}`,
      editable: false,
    });
  }

  // Generate memory/index.md — overview
  const indexLines: string[] = [
    `---`,
    `title: Memory Index`,
    `total: ${memories.length}`,
    `---`,
    ``,
    `# Memory`,
    ``,
    `Total memories: ${memories.length}`,
    ``,
  ];
  for (const cat of CATEGORY_ORDER) {
    const count = byCategory.get(cat)?.length ?? 0;
    if (count > 0) indexLines.push(`- **${cat}s**: ${count}`);
  }
  files.push({
    path: "memory/index.md",
    content: indexLines.join("\n"),
    section: "memory.index",
    editable: false,
  });

  // Generate sessions/history.md
  if (sessions.length > 0) {
    const sessionLines: string[] = [
      `---`,
      `title: Session History`,
      `count: ${sessions.length}`,
      `---`,
      ``,
      `# Session History`,
      ``,
    ];
    for (const s of sessions.sort((a, b) => b.createdAt - a.createdAt).slice(0, 20)) {
      const date = new Date(s.createdAt).toISOString().replace("T", " ").slice(0, 16);
      const summary = s.summary ? ` — ${s.summary}` : "";
      sessionLines.push(`- **${date}** [${s.surface}] ${s.messageCount} messages${summary}`);
    }
    files.push({
      path: "sessions/history.md",
      content: sessionLines.join("\n"),
      section: "sessions",
      editable: false,
    });
  }

  return files;
}
