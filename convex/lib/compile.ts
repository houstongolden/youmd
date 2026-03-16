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
  };
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

    meta: {
      sources_used: [],
      last_updated: now,
      compiler_version: "0.1.0",
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

  // Footer
  sections.push(`---\n\n> Full context: see manifest.json`);

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

  return {
    schema: "you-md/v1",
    username: data.username,
    generated_at: now,
    compiler_version: "0.1.0",

    paths: {
      public: publicPaths,
      private: [],
      scoped: [],
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
