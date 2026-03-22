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

  // voice/voice.md
  const voice = youJson?.voice;
  if (voice?.overall) {
    files.push({
      path: "voice/voice.md",
      content: [`---`, `title: Voice`, `---`, ``, `# Voice`, ``, voice.overall].join("\n"),
      section: "voice",
      editable: true,
    });
  }

  // voice/voice.linkedin.md
  if (voice?.platforms?.linkedin) {
    files.push({
      path: "voice/voice.linkedin.md",
      content: [`---`, `title: LinkedIn Voice`, `---`, ``, `# LinkedIn Voice`, ``, voice.platforms.linkedin].join("\n"),
      section: "voice.linkedin",
      editable: true,
    });
  }

  // voice/voice.x.md
  if (voice?.platforms?.x) {
    files.push({
      path: "voice/voice.x.md",
      content: [`---`, `title: X Voice`, `---`, ``, `# X Voice`, ``, voice.platforms.x].join("\n"),
      section: "voice.x",
      editable: true,
    });
  }

  // voice/voice.blog.md
  if (voice?.platforms?.blog) {
    files.push({
      path: "voice/voice.blog.md",
      content: [`---`, `title: Blog Voice`, `---`, ``, `# Blog Voice`, ``, voice.platforms.blog].join("\n"),
      section: "voice.blog",
      editable: true,
    });
  }

  // Note: memory/ files are added separately via appendMemoryFiles()

  // manifest.json
  files.push({
    path: "manifest.json",
    content: JSON.stringify(youJson?.meta ? {
      schema: youJson.schema,
      username: youJson.username,
      generated_at: youJson.generated_at,
      compiler_version: youJson.meta?.compiler_version,
      paths: {
        public: files.filter(f => !f.path.startsWith("private/")).map(f => f.path),
        private: ["private/notes.md", "private/projects.md", "private/internal-links.md"],
      },
    } : {}, null, 2),
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
  _id: string;
  category: string;
  content: string;
  source: string;
  sourceAgent?: string;
  tags?: string[];
  createdAt: number;
}

export interface SessionEntry {
  _id: string;
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
