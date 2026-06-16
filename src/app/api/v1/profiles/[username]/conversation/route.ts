import { NextResponse } from "next/server";
import { CONVEX_SITE_URL } from "@/lib/constants";

export const dynamic = "force-dynamic";

const MAX_MESSAGE_LENGTH = 1200;

type PublicProfilePayload = {
  youJson?: Record<string, unknown> | null;
  _profile?: Record<string, unknown> | null;
  displayName?: string | null;
};

type PublicContextSection = {
  label: string;
  value: string;
};

const privateContextOmissions = [
  "private memories",
  "private loop reports",
  "private connected-app data",
  "private source snapshots",
  "owner-only agent logs",
  "scoped API/MCP grants",
];

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asStringList(value: unknown, limit = 6): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => asString(item))
    .filter(Boolean)
    .slice(0, limit);
}

function firstString(...values: unknown[]): string {
  for (const value of values) {
    const text = asString(value);
    if (text) return text;
  }
  return "";
}

function truncate(text: string, max = 220): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trim()}...`;
}

function projectSummaries(projects: unknown): string[] {
  if (!Array.isArray(projects)) return [];
  return projects
    .map((project) => {
      const record = asRecord(project);
      const name = asString(record.name);
      if (!name || name.startsWith("#")) return "";
      const status = asString(record.status);
      const description = asString(record.description);
      const role = asString(record.role);
      const details = [status, role, description].filter(Boolean).join(" / ");
      return details ? `${name}: ${truncate(details, 180)}` : name;
    })
    .filter(Boolean)
    .slice(0, 6);
}

function linkSummaries(links: unknown): string[] {
  const record = asRecord(links);
  return Object.entries(record)
    .filter(([, url]) => typeof url === "string" && url.trim())
    .map(([label, url]) => `${label}: ${url}`)
    .slice(0, 8);
}

function wants(message: string, keywords: string[]): boolean {
  return keywords.some((keyword) => message.includes(keyword));
}

function buildSections(profile: PublicProfilePayload): {
  name: string;
  data: Record<string, unknown>;
  sections: PublicContextSection[];
  followups: string[];
} {
  const data = asRecord(profile.youJson ?? profile);
  const identity = asRecord(data.identity);
  const bio = asRecord(identity.bio);
  const analysis = asRecord(data.analysis);
  const preferences = asRecord(data.preferences);
  const agentPreferences = asRecord(preferences.agent);
  const now = asRecord(data.now);

  const name = firstString(identity.name, profile.displayName, "this person");
  const username = asString(asRecord(profile._profile).username);
  const projects = projectSummaries(data.projects);
  const focus = asStringList(now.focus, 6);
  const values = asStringList(data.values, 6);
  const topics = asStringList(analysis.topics, 8);
  const skills = asStringList(identity.skills, 8);
  const links = linkSummaries(data.links ?? identity.links);

  const sections: PublicContextSection[] = [
    { label: "identity.name", value: name },
    { label: "identity.tagline", value: asString(identity.tagline) },
    { label: "identity.location", value: asString(identity.location) },
    { label: "identity.bio", value: firstString(bio.long, bio.medium, bio.short) },
    { label: "analysis.voice_summary", value: asString(analysis.voice_summary) },
    { label: "preferences.agent.tone", value: asString(agentPreferences.tone) },
    { label: "now.focus", value: focus.join("; ") },
    { label: "projects", value: projects.join("; ") },
    { label: "values", value: values.join("; ") },
    { label: "topics", value: topics.join(", ") },
    { label: "skills", value: skills.join(", ") },
    { label: "links", value: links.join("; ") },
  ].filter((section) => section.value);

  return {
    name,
    data,
    sections,
    followups: [
      `What is ${name} building right now?`,
      `What should I ask ${name} about?`,
      `Summarize ${name}'s public expertise.`,
      username ? `Which public endpoints exist for @${username}?` : "Which public endpoints exist?",
    ],
  };
}

function buildPublicProfileConversationResponse(
  username: string,
  profile: PublicProfilePayload,
  message: string
) {
  const normalizedMessage = message.toLowerCase();
  const { name, data, sections, followups } = buildSections(profile);
  const identity = asRecord(data.identity);
  const analysis = asRecord(data.analysis);

  const selected: PublicContextSection[] = [];
  const push = (labels: string[]) => {
    for (const section of sections) {
      if (labels.includes(section.label) && !selected.some((item) => item.label === section.label)) {
        selected.push(section);
      }
    }
  };

  if (wants(normalizedMessage, ["project", "building", "work", "startup", "company", "build"])) {
    push(["projects", "now.focus", "identity.tagline"]);
  }
  if (wants(normalizedMessage, ["today", "now", "current", "focus", "agenda"])) {
    push(["now.focus", "identity.location", "projects"]);
  }
  if (wants(normalizedMessage, ["about", "bio", "background", "who", "story"])) {
    push(["identity.name", "identity.tagline", "identity.bio", "topics", "skills"]);
  }
  if (wants(normalizedMessage, ["voice", "style", "personality", "advice", "perspective", "consult"])) {
    push(["analysis.voice_summary", "preferences.agent.tone", "values", "topics"]);
  }
  if (wants(normalizedMessage, ["link", "contact", "social", "github", "linkedin", "website"])) {
    push(["links"]);
  }
  if (wants(normalizedMessage, ["api", "mcp", "endpoint", "json", "agent"])) {
    push(["analysis.voice_summary", "preferences.agent.tone"]);
  }

  if (selected.length === 0) {
    push(["identity.name", "identity.tagline", "identity.bio", "now.focus", "projects", "analysis.voice_summary"]);
  }

  const compact = selected.slice(0, 5);
  const summary = compact
    .map((section) => `- ${section.label}: ${truncate(section.value, 260)}`)
    .join("\n");

  const endpointHint = `Agents can read https://you.md/${username}/you.json or https://you.md/${username}/you.txt for the same public brain surface.`;
  const voiceSummary = asString(analysis.voice_summary);
  const publicName = firstString(asString(identity.name), name, `@${username}`);
  const answer = [
    `From ${publicName}'s public You.md context:`,
    summary || "- No detailed public context has been published yet.",
    voiceSummary && wants(normalizedMessage, ["voice", "style", "advice", "consult"])
      ? `Public voice note: ${truncate(voiceSummary, 260)}`
      : "",
    endpointHint,
    `I did not use private memories, private reports, connected-app data, or scoped grants for this answer.`,
  ].filter(Boolean).join("\n\n");

  return {
    answer,
    username,
    subject: publicName,
    voice_mode: "public-context-summary",
    sources: [
      {
        label: "public you.json",
        href: `https://you.md/${username}/you.json`,
        scope: "public",
      },
      {
        label: "public you.txt",
        href: `https://you.md/${username}/you.txt`,
        scope: "public",
      },
    ],
    public_context_used: compact.map((section) => section.label),
    omitted_private_context: privateContextOmissions,
    suggested_followups: followups,
  };
}

async function fetchPublicProfile(username: string): Promise<PublicProfilePayload | null> {
  const upstreamUrl = new URL(`${CONVEX_SITE_URL}/api/v1/profiles`);
  upstreamUrl.searchParams.set("username", username);

  const upstream = await fetch(upstreamUrl.toString(), {
    headers: {
      Accept: "application/json",
      "User-Agent": "you.md-public-profile-conversation",
    },
    cache: "no-store",
  });

  if (upstream.status === 404) return null;
  if (!upstream.ok) {
    throw new Error(`profile upstream returned ${upstream.status}`);
  }

  return (await upstream.json()) as PublicProfilePayload;
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  return NextResponse.json(
    {
      endpoint: `/api/v1/profiles/${username}/conversation`,
      method: "POST",
      description: "Ask a public-context-only question about a You.md profile.",
      request: {
        message: "What is this person building right now?",
      },
      response: {
        answer: "string",
        voice_mode: "public-context-summary",
        public_context_used: ["identity.bio", "projects"],
        omitted_private_context: privateContextOmissions,
      },
    },
    { headers: corsHeaders() }
  );
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  const trimmedUsername = username.trim().toLowerCase();

  if (!/^[a-z0-9_-]{2,64}$/.test(trimmedUsername)) {
    return NextResponse.json({ error: "invalid_username" }, { status: 400, headers: corsHeaders() });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400, headers: corsHeaders() });
  }

  const message = asString(asRecord(body).message);
  if (!message) {
    return NextResponse.json({ error: "message_required" }, { status: 400, headers: corsHeaders() });
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json({ error: "message_too_long" }, { status: 413, headers: corsHeaders() });
  }

  try {
    const profile = await fetchPublicProfile(trimmedUsername);
    if (!profile) {
      return NextResponse.json({ error: "profile_not_found" }, { status: 404, headers: corsHeaders() });
    }

    return NextResponse.json(
      buildPublicProfileConversationResponse(trimmedUsername, profile, message),
      { headers: corsHeaders() }
    );
  } catch (error) {
    console.error("public profile conversation failed", error);
    return NextResponse.json({ error: "conversation_failed" }, { status: 502, headers: corsHeaders() });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(),
  });
}
