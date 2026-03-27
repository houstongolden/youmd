/**
 * Bundle compilation utilities.
 * Generates you.json, you.md, and manifest.json from structured profile data.
 */

export interface ProfileData {
  name: string;
  username: string;
  tagline?: string;
  location?: string;
  bio?: {
    short?: string;
    medium?: string;
    long?: string;
  };
  now?: string[];
  projects?: Array<{
    name: string;
    role?: string;
    status?: string;
    url?: string;
    description?: string;
  }>;
  values?: string[];
  links?: Record<string, string>;
  preferences?: {
    agent?: {
      tone?: string;
      formality?: string;
      avoid?: string[];
    };
    writing?: {
      style?: string;
      format?: string;
    };
  };
  analysis?: {
    topics?: string[];
    voice_summary?: string;
    credibility_signals?: string[];
    voice_linkedin?: string;
    voice_x?: string;
    voice_blog?: string;
  };
  socialImages?: {
    x?: string;
    github?: string;
    linkedin?: string;
    custom?: string;
  };
  agentDirectives?: {
    communication_style?: string;
    negative_prompts?: string[];
    default_stack?: string;
    decision_framework?: string;
    current_goal?: string;
  };
  // Dynamic custom sections — user can add any section they want
  customSections?: Array<{
    id: string;      // slug like "speaking", "investments", "reading-list"
    title: string;   // display title like "Speaking", "Investment Thesis"
    content: string; // markdown content
  }>;
}

export function compileYouJson(data: ProfileData): Record<string, unknown> {
  const now = new Date().toISOString();

  return {
    schema: "you-md/v1",
    username: data.username,
    generated_at: now,

    identity: {
      name: data.name,
      tagline: data.tagline ?? "",
      location: data.location ?? "",
      bio: {
        short: data.bio?.short ?? "",
        medium: data.bio?.medium ?? "",
        long: data.bio?.long ?? "",
      },
    },

    now: {
      focus: data.now ?? [],
      updated_at: now.split("T")[0],
    },

    projects: (data.projects ?? []).map((p) => ({
      name: p.name,
      role: p.role ?? "",
      status: p.status ?? "active",
      url: p.url ?? "",
      description: p.description ?? "",
    })),

    values: data.values ?? [],

    links: data.links ?? {},

    preferences: {
      agent: {
        tone: data.preferences?.agent?.tone ?? "",
        formality: data.preferences?.agent?.formality ?? "casual-professional",
        avoid: data.preferences?.agent?.avoid ?? [],
      },
      writing: {
        style: data.preferences?.writing?.style ?? "",
        format: data.preferences?.writing?.format ?? "markdown preferred",
      },
    },

    analysis: {
      topics: data.analysis?.topics ?? [],
      voice_summary: data.analysis?.voice_summary ?? "",
      credibility_signals: data.analysis?.credibility_signals ?? [],
    },

    voice: {
      overall: data.analysis?.voice_summary ?? "",
      platforms: {
        linkedin: data.analysis?.voice_linkedin ?? null,
        x: data.analysis?.voice_x ?? null,
        blog: data.analysis?.voice_blog ?? null,
      },
    },

    social_images: data.socialImages ?? {},

    // Agent directives — behavioral instructions for any AI interacting with this person
    agent_directives: {
      communication_style: data.agentDirectives?.communication_style ?? "",
      negative_prompts: data.agentDirectives?.negative_prompts ?? [],
      default_stack: data.agentDirectives?.default_stack ?? "",
      decision_framework: data.agentDirectives?.decision_framework ?? "",
      current_goal: data.agentDirectives?.current_goal ?? "",
    },

    // Agent navigation guide — tells agents where to find specific context
    agent_guide: {
      summary: "this is a you-md/v1 identity context protocol. use it to understand who this person is before working with them.",
      quick_context: [
        "identity.bio.short — one-line summary",
        "now.focus — what they're working on right now",
        "agent_directives — behavioral instructions for how to interact",
        "preferences.agent — communication tone preferences",
        "projects — their active projects with context",
        "voice.overall — their communication style",
      ],
      for_writing: "check preferences.writing and voice.platforms for platform-specific style",
      for_coding: "check projects for tech stack context, agent_directives.default_stack for preferred stack",
      for_research: "check analysis.topics and links for their areas of expertise",
    },

    // Custom sections — dynamic user-defined content
    custom_sections: (data.customSections ?? []).map((s) => ({
      id: s.id,
      title: s.title,
      content: s.content,
    })),

    meta: {
      sources_used: [],
      last_updated: now,
      compiler_version: "0.3.0",
    },

    verification: null,
  };
}

export function compileYouMd(data: ProfileData): string {
  const now = new Date().toISOString().split("T")[0];

  const sections: string[] = [];

  // Frontmatter
  sections.push(`---
schema: you-md/v1
name: ${data.name}
username: ${data.username}
generated_at: ${now}
---`);

  // Header
  sections.push(`# ${data.name}`);
  if (data.tagline) sections.push(data.tagline);
  if (data.location) sections.push(`*${data.location}*`);

  // Bio
  if (data.bio?.long) {
    sections.push(`## About\n\n${data.bio.long}`);
  }

  // Now
  if (data.now && data.now.length > 0) {
    sections.push(
      `## Now\n\n${data.now.map((f) => `- ${f}`).join("\n")}`
    );
  }

  // Projects
  if (data.projects && data.projects.length > 0) {
    const projectLines = data.projects.map(
      (p) =>
        `- **${p.name}**${p.description ? ` — ${p.description}` : ""}${p.role ? ` (${p.role}${p.status ? `, ${p.status}` : ""})` : ""}`
    );
    sections.push(`## Projects\n\n${projectLines.join("\n")}`);
  }

  // Values
  if (data.values && data.values.length > 0) {
    sections.push(
      `## Values\n\n${data.values.map((v) => `- ${v}`).join("\n")}`
    );
  }

  // Agent Preferences
  if (data.preferences?.agent) {
    const prefs: string[] = [];
    if (data.preferences.agent.tone)
      prefs.push(`Tone: ${data.preferences.agent.tone}`);
    if (data.preferences.agent.avoid && data.preferences.agent.avoid.length > 0)
      prefs.push(`Avoid: ${data.preferences.agent.avoid.join(", ")}`);
    if (data.preferences?.writing?.style)
      prefs.push(`Format: ${data.preferences.writing.style}`);
    if (prefs.length > 0) {
      sections.push(`## Agent Preferences\n\n${prefs.join("\n")}`);
    }
  }

  // Agent Directives
  if (data.agentDirectives) {
    const dirs: string[] = [];
    if (data.agentDirectives.communication_style)
      dirs.push(`Communication Style: ${data.agentDirectives.communication_style}`);
    if (data.agentDirectives.negative_prompts && data.agentDirectives.negative_prompts.length > 0)
      dirs.push(`Never: ${data.agentDirectives.negative_prompts.join(". ")}`);
    if (data.agentDirectives.default_stack)
      dirs.push(`Default Stack: ${data.agentDirectives.default_stack}`);
    if (data.agentDirectives.decision_framework)
      dirs.push(`Decision Framework: ${data.agentDirectives.decision_framework}`);
    if (data.agentDirectives.current_goal)
      dirs.push(`Current Goal: ${data.agentDirectives.current_goal}`);
    if (dirs.length > 0) {
      sections.push(`## Agent Directives\n\n${dirs.join("\n")}`);
    }
  }

  // Links
  if (data.links) {
    const linkEntries = Object.entries(data.links).filter(
      ([, url]) => url
    );
    if (linkEntries.length > 0) {
      sections.push(
        `## Links\n\n${linkEntries.map(([platform, url]) => `- ${platform}: ${url}`).join("\n")}`
      );
    }
  }

  // Voice
  if (data.analysis?.voice_summary) {
    sections.push(`## Voice\n\n${data.analysis.voice_summary}`);
  }

  // Custom sections
  if (data.customSections && data.customSections.length > 0) {
    for (const section of data.customSections) {
      sections.push(`## ${section.title}\n\n${section.content}`);
    }
  }

  // Footer with agent navigation guide
  sections.push(`---

> **For agents**: this is a you-md/v1 identity context protocol.
> Quick context: check identity.bio.short, now.focus, and preferences.agent.
> For writing help: check voice section and preferences.writing.
> Full structured data: see you.json. Directory: see manifest.json.`);

  return sections.join("\n\n");
}

export function compileManifest(
  data: ProfileData,
  sourcesUsed: string[] = []
): Record<string, unknown> {
  const now = new Date().toISOString();

  const publicPaths = ["you.md", "you.json"];

  // Add paths based on what data exists
  if (data.bio?.long) publicPaths.push("profile/about.md");
  if (data.now && data.now.length > 0) publicPaths.push("profile/now.md");
  if (data.projects && data.projects.length > 0)
    publicPaths.push("profile/projects.md");
  if (data.values && data.values.length > 0)
    publicPaths.push("profile/values.md");
  if (data.links && Object.keys(data.links).length > 0)
    publicPaths.push("profile/links.md");
  if (data.preferences?.agent) publicPaths.push("preferences/agent.md");
  if (data.preferences?.writing) publicPaths.push("preferences/writing.md");
  if (data.agentDirectives?.communication_style || data.agentDirectives?.negative_prompts?.length || data.agentDirectives?.default_stack)
    publicPaths.push("directives/agent.md");

  // Voice artifacts
  if (data.analysis?.voice_summary) publicPaths.push("voice/voice.md");
  if (data.analysis?.voice_linkedin) publicPaths.push("voice/voice.linkedin.md");
  if (data.analysis?.voice_x) publicPaths.push("voice/voice.x.md");
  if (data.analysis?.voice_blog) publicPaths.push("voice/voice.blog.md");

  // Private paths
  const privatePaths = [
    "private/notes.md",
    "private/projects.md",
    "private/internal-links.md",
    "private/context.md",
  ];

  return {
    schema: "you-md/v1",
    username: data.username,
    generated_at: now,
    compiler_version: "0.2.0",

    paths: {
      public: publicPaths,
      private: privatePaths,
      scoped: [], // future: per-project scoped access
    },

    sources: Object.fromEntries(
      sourcesUsed.map((s) => [
        s,
        {
          url: "",
          last_fetched: now,
          status: "active",
        },
      ])
    ),

    update_policy: {
      auto_refresh: false,
      refresh_interval_days: null,
      require_approval: true,
    },

    custom_paths: [],
  };
}
