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
