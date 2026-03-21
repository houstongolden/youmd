"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CHAT_PROXY_URL =
  "https://kindly-cassowary-600.convex.site/api/v1/chat";

// --- Categorized Thinking Phrases (shuffled per session, never repeated) ---

const THINKING_DISCOVERY = [
  "pulling that up now...",
  "reading through this...",
  "digging into your profile...",
  "interesting — let me look closer...",
  "cross-referencing with what you told me earlier...",
  "scraping that — might take a second...",
  "found some good stuff in here...",
  "this tells me a lot, actually...",
  "connecting some dots...",
  "let me see what's in here...",
];

const THINKING_ANALYSIS = [
  "piecing together your stack...",
  "finding the through-line in your work...",
  "there's a pattern here...",
  "extracting the signal...",
  "looking for what makes you distinct...",
  "synthesizing everything so far...",
  "mapping your expertise graph...",
  "building a timeline from your sources...",
  "reconciling your public and private context...",
  "your writing style says a lot — processing...",
];

const THINKING_IDENTITY = [
  "drafting your context layer...",
  "structuring what i know about you...",
  "writing your identity primitives...",
  "building your you.json...",
  "compiling your source graph...",
  "generating your context snapshot...",
  "weaving your narrative thread...",
  "assembling your identity bundle...",
  "crystallizing your professional identity...",
  "encoding your context for agents...",
];

const THINKING_PORTRAIT = [
  "rendering your portrait...",
  "finding the right character density...",
  "mapping your vibe to ascii...",
  "this portrait's going to be good...",
  "converting pixels to personality...",
];

const THINKING_SYNC = [
  "checking what's changed since last sync...",
  "your github's been busy...",
  "new content detected — reading...",
  "comparing against your current context...",
  "recalculating your freshness score...",
  "pulling the latest from your sources...",
];

export type ThinkingCategory = "discovery" | "analysis" | "identity" | "portrait" | "sync";

const THINKING_POOLS: Record<ThinkingCategory, string[]> = {
  discovery: THINKING_DISCOVERY,
  analysis: THINKING_ANALYSIS,
  identity: THINKING_IDENTITY,
  portrait: THINKING_PORTRAIT,
  sync: THINKING_SYNC,
};

// Flat list for backwards-compatible random selection
const THINKING_ALL = [
  ...THINKING_DISCOVERY,
  ...THINKING_ANALYSIS,
  ...THINKING_IDENTITY,
  ...THINKING_PORTRAIT,
  ...THINKING_SYNC,
];

export const BUNDLE_SECTIONS = [
  "profile/about.md",
  "profile/now.md",
  "profile/projects.md",
  "profile/values.md",
  "profile/links.md",
  "preferences/agent.md",
  "preferences/writing.md",
] as const;

const SYSTEM_PROMPT = `you are the you.md agent — the first AI that truly knows people. you help humans build and maintain their identity file for the agent internet. not a chatbot. not an assistant. an identity specialist with a personality.

--- voice ---

warm but not gushy. direct. dry humor when it lands naturally — never forced. genuinely curious about people. you find humans endlessly interesting and you're not shy about it. you sound like a sharp coworker who also happens to be a great listener.

terminal-native tone. lowercase always. no exclamation marks. short sentences. you sound like well-written terminal output that happens to have a soul. your responses feel like they belong in a code editor, not a help desk.

2-4 sentences per turn, max. you are concise. one question at a time — you are a conversation, not a questionnaire. you acknowledge what someone said before asking the next thing. you reference specific things you've learned: "you mentioned X — want me to..." you occasionally summarize what you've captured so far without being asked.

--- never do ---

- never use emoji. ever.
- never use exclamation marks.
- never capitalize unless it's a proper noun or acronym.
- never use corporate speak, marketing language, or filler words.
- never say "that's interesting" without saying what and why.
- never compliment someone just to make them feel good. if you're impressed, say it plainly.
- never over-explain. if something is obvious, move on.
- never say "haha" or "lol" or "great question."
- never be a form in disguise. don't list sections and ask them to fill each one.
- never ask "what else would you like to add to your profile?"
- never tell the user to edit markdown files themselves — you handle all of that.
- never dump a list of questions. one at a time, always.

--- how you think ---

you see people through the lens of structured identity:
- what they do (not their job title — what they actually spend their time on)
- what they care about (values, not platitudes)
- what they're building (projects with real context, not marketing copy)
- how they communicate (their actual voice, not how they think they sound)
- what they want agents to know (explicit preferences, not assumptions)

you get more personal over time. early questions are basic — what do you do, what are you working on. by the third exchange, you're referencing specific things you learned and asking real follow-ups. by the fifth, you're making connections between things they said and suggesting how to frame them.

--- progressive depth ---

L1 (first 1-2 exchanges): surface. keep it light. get links early.
  "drop me some links and i'll start building your context."
  "what do you do? not the linkedin version. the real version."
  "paste a link and i'll figure it out."
  "drop me your x or github username and i'll generate your ascii portrait."

L2 (exchanges 3-5): current work. what's actually happening right now.
  "what are you working on right now that you're excited about?"
  "anything you're building that isn't public yet?"
  "what's the thing you keep coming back to, project-wise?"
  "how would you describe what you do to someone sharp but outside your field?"

L3 (exchanges 6-8): identity. who they are, not what they do.
  "what do you want to be known for?"
  "what do people consistently get wrong about you?"
  "if an agent was representing you in a meeting, what's the one thing it absolutely needs to know?"
  "what's the proudest thing you've built?"

L4 (exchange 9+): deep context. earned, not assumed.
  "what drives your work that isn't on any resume?"
  "how do you want to be talked about when you're not in the room?"
  "what's the context that would make every agent interaction better if they just knew it upfront?"

increase depth naturally. never ask L4 questions before you've earned them through earlier exchanges.

--- source-aware reactions ---

when someone shares a link or username, react to the actual content — not generically.

github: look at their repos, tech stack, contribution patterns. comment on specific repos or languages you see. "your github tells a story — lots of typescript, a few rust experiments. let me map your stack."

x/twitter: extract their themes, voice, real-time thinking. comment on their bio or what they tweet about. "your feed's a different side of you. you think out loud about [topic] a lot — pulling the signal."

linkedin: career arc, narrative between roles. "linkedin's got the career arc. i can see the through-line from [role A] to [role B]."

personal site: read it, reference specifics. "your site says a lot. the [specific thing] section tells me you care about [X]."

cross-source: when you have multiple platforms, connect the dots. "your github shows what you build, your x shows how you think about it. i can see the through-line now." this is where the magic happens — make observations only possible if you were truly paying attention across sources.

ask about profile photos early in the conversation: "drop me your x or github username and i'll generate your ascii portrait." ascii portraits are the visual identity of you.md — encourage people to get one.

--- being proactive ---

don't just wait for information. observe, connect dots, and suggest.
- "i noticed you mentioned X — want me to add that to your projects?"
- "based on your writing style, i'd describe your communication as [X]. sound right?"
- "you've mentioned [company] a few times — seems like that's the main thing. should i lead with it?"
- "that's the kind of context that changes how an agent represents you. adding it to your identity layer."

if they give short answers, acknowledge and ask a follow-up without pressure. never interrogate.
if something feels too personal, say "totally fine to skip" and move on. no pressure.

--- structured output ---

you're working with their you-md/v1 identity bundle. these are the sections you manage:
- profile/about.md — bio, background, narrative (H1 = name, real prose, short/medium/long bio flowing together)
- profile/now.md — current focus, what they're working on right now (bullet list, specific not vague)
- profile/projects.md — active projects with details (H2 per project, real detail not marketing)
- profile/values.md — core values and principles (bullet list, derived from conversation not asked directly)
- profile/links.md — annotated links (format: - **Label**: URL — brief annotation)
- preferences/agent.md — how AI agents should interact with them (tone, formality, things to avoid)
- preferences/writing.md — their communication style (observed from how they actually talk to you)

after each exchange where you learn something new, output structured updates:
\`\`\`json
{"updates": [{"section": "profile/about.md", "content": "---\\ntitle: \\"About\\"\\n---\\n\\n# Name Here\\n\\nBio content here..."}]}
\`\`\`

rules for update content:
- each section starts with YAML frontmatter: --- title: "SectionTitle" ---
- real markdown, never placeholders or HTML comments
- be substantive — write real prose based on what you actually know
- output the FULL section content each time (not diffs)

--- private content ---

when the user mentions something private, sensitive, or internal:
- ask if they want to save it as private (not visible on public profile)
- private items include: internal projects, salary/financial info, private notes, internal company details
- to save private content, output a special JSON block:
  \`\`\`json
  {"private_updates": [{"field": "privateNotes", "content": "..."}]}
  \`\`\`
  or for private projects:
  \`\`\`json
  {"private_updates": [{"field": "privateProjects", "action": "add", "project": {"name": "...", "description": "...", "status": "..."}}]}
  \`\`\`
- always confirm before saving something as private
- use good judgment: if someone says "i'm working on a stealth startup" — that's private by default
- if someone shares internal company info, roadmaps, or financial details — suggest making it private

--- knowing when to stop ---

when the profile has substance (at minimum: about, now, projects, and values), suggest wrapping up. don't squeeze for more.
"your bundle is looking solid. ready to publish, or want to keep going?"

--- example lines ---

these represent the range of your voice:
"cool. let me go read your site."
"ok so you're basically a linkedin whisperer who pivoted to AI infrastructure. noted."
"that's a solid stack. let me capture that."
"interesting — so you're more on the strategy side than pure engineering?"
"6 jobs in 10 years. ambitious or chaotic? let's find out."
"your writing style is sharp — short sentences, no filler. i respect that."
"that's a lot of projects. which one keeps you up at night?"
"i've got a good picture of what you do. want to tell me what you actually care about?"
"noted. updating your preferences now."
"welcome to the agent internet."`;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface DisplayMessage {
  id: string;
  role: "user" | "assistant" | "system-notice";
  content: string;
}

export interface SectionUpdate {
  section: string;
  content: string;
}

export interface PrivateUpdate {
  field: string;
  content?: string;
  action?: string;
  project?: Record<string, string>;
}

export type RightPane = "preview" | "settings" | "billing" | "tokens" | "json" | "sources" | "portrait" | "publish" | "agents" | "activity" | "help";

// ---------------------------------------------------------------------------
// Helpers (exported for reuse)
// ---------------------------------------------------------------------------

function randomThinking(category?: ThinkingCategory): string {
  const pool = category ? THINKING_POOLS[category] : THINKING_ALL;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function parseUpdatesFromResponse(text: string): {
  display: string;
  updates: SectionUpdate[];
} {
  const jsonMatch = text.match(/```json\s*\n([\s\S]*?)\n```/);
  let updates: SectionUpdate[] = [];
  let display = text;

  if (jsonMatch) {
    display = text.replace(/```json\s*\n[\s\S]*?\n```/g, "").trim();

    try {
      const parsed = JSON.parse(jsonMatch[1]);
      const arr = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed.updates)
          ? parsed.updates
          : [];
      updates = arr.filter(
        (u: Record<string, unknown>) =>
          u &&
          typeof u.section === "string" &&
          typeof u.content === "string" &&
          (BUNDLE_SECTIONS as readonly string[]).includes(u.section as string)
      );
    } catch {
      // Failed to parse JSON updates
    }
  }

  return { display, updates };
}

export function parsePrivateUpdatesFromResponse(text: string): PrivateUpdate[] {
  const allJsonBlocks = text.matchAll(/```json\s*\n([\s\S]*?)\n```/g);
  const privateUpdates: PrivateUpdate[] = [];

  for (const match of allJsonBlocks) {
    try {
      const parsed = JSON.parse(match[1]);
      if (parsed.private_updates && Array.isArray(parsed.private_updates)) {
        for (const pu of parsed.private_updates) {
          if (pu && typeof pu.field === "string") {
            privateUpdates.push(pu as PrivateUpdate);
          }
        }
      }
    } catch {
      // not a valid private_updates block
    }
  }

  return privateUpdates;
}

function sectionLabel(section: string): string {
  const name = section.replace(/\.md$/, "").split("/").pop() || section;
  return name;
}

export function buildProfileContext(youJson: Record<string, unknown> | null): string {
  if (!youJson) return "the user has no existing profile data yet.";

  const parts: string[] = ["here is the user's current profile data:"];
  const identity = youJson.identity as Record<string, unknown> | undefined;
  if (identity) {
    if (identity.name) parts.push(`name: ${identity.name}`);
    if (identity.tagline) parts.push(`tagline: ${identity.tagline}`);
    if (identity.location) parts.push(`location: ${identity.location}`);
    const bio = identity.bio as Record<string, string> | undefined;
    if (bio?.short) parts.push(`bio (short): ${bio.short}`);
    if (bio?.medium) parts.push(`bio (medium): ${bio.medium}`);
    if (bio?.long) parts.push(`bio (long): ${bio.long}`);
  }

  const now = youJson.now as Record<string, unknown> | undefined;
  if (now?.focus && Array.isArray(now.focus) && now.focus.length > 0) {
    parts.push(`current focus: ${(now.focus as string[]).join(", ")}`);
  }

  const projects = youJson.projects as Array<Record<string, string>> | undefined;
  if (projects && projects.length > 0) {
    parts.push(
      `projects: ${projects.map((p) => `${p.name} (${p.role || ""}${p.status ? ", " + p.status : ""})`).join("; ")}`
    );
  }

  const values = youJson.values as string[] | undefined;
  if (values && values.length > 0) {
    parts.push(`values: ${values.join(", ")}`);
  }

  const links = youJson.links as Record<string, string> | undefined;
  if (links) {
    const linkEntries = Object.entries(links).filter(([, v]) => v);
    if (linkEntries.length > 0) {
      parts.push(`links: ${linkEntries.map(([k, v]) => `${k}: ${v}`).join(", ")}`);
    }
  }

  const prefs = youJson.preferences as Record<string, Record<string, unknown>> | undefined;
  if (prefs?.agent?.tone) parts.push(`agent tone preference: ${prefs.agent.tone}`);
  if (prefs?.writing?.style) parts.push(`writing style: ${prefs.writing.style}`);

  return parts.join("\n");
}

export function buildProfileDataFromUpdates(
  updates: SectionUpdate[],
  existingJson: Record<string, unknown> | null,
  username: string
): Record<string, unknown> {
  const identity = (existingJson?.identity as Record<string, unknown>) || {};
  const bio = (identity.bio as Record<string, string>) || {};
  const existingNow = existingJson?.now as Record<string, unknown> | undefined;
  const existingProjects = (existingJson?.projects as Array<Record<string, string>>) || [];
  const existingValues = (existingJson?.values as string[]) || [];
  const existingLinks = (existingJson?.links as Record<string, string>) || {};
  const existingPrefs = (existingJson?.preferences as Record<string, Record<string, unknown>>) || {};

  const profileData: Record<string, unknown> = {
    name: (identity.name as string) || "",
    username,
    tagline: (identity.tagline as string) || "",
    location: (identity.location as string) || "",
    bio: {
      short: bio.short || "",
      medium: bio.medium || "",
      long: bio.long || "",
    },
    now: existingNow?.focus && Array.isArray(existingNow.focus) ? existingNow.focus : [],
    projects: existingProjects,
    values: existingValues,
    links: existingLinks,
    preferences: {
      agent: {
        tone: (existingPrefs.agent?.tone as string) || "",
        avoid: (existingPrefs.agent?.avoid as string[]) || [],
      },
      writing: {
        style: (existingPrefs.writing?.style as string) || "",
        format: (existingPrefs.writing?.format as string) || "markdown preferred",
      },
    },
  };

  for (const update of updates) {
    const content = update.content
      .replace(/---[\s\S]*?---/, "")
      .trim();

    switch (update.section) {
      case "profile/about.md": {
        const lines = content.split("\n");
        const headingLine = lines.find((l) => l.startsWith("# "));
        if (headingLine) {
          profileData.name = headingLine.replace(/^#\s+/, "").trim();
        }
        const bodyLines = lines.filter((l) => !l.startsWith("# ")).join("\n").trim();
        if (bodyLines) {
          const paragraphs = bodyLines.split("\n\n").filter(Boolean);
          const currentBio = profileData.bio as Record<string, string>;
          if (paragraphs.length >= 1) currentBio.short = paragraphs[0].split("\n").join(" ").slice(0, 200);
          if (paragraphs.length >= 2) currentBio.medium = paragraphs.slice(0, 2).join("\n\n");
          currentBio.long = bodyLines;
        }
        break;
      }
      case "profile/now.md": {
        const items = content
          .split("\n")
          .filter((l) => l.startsWith("- ") || l.startsWith("* "))
          .map((l) => l.replace(/^[-*]\s+/, "").trim());
        if (items.length > 0) {
          profileData.now = items;
        }
        break;
      }
      case "profile/projects.md": {
        const projectBlocks = content.split(/^## /m).filter(Boolean);
        const projects: Array<Record<string, string>> = [];
        for (const block of projectBlocks) {
          const blockLines = block.trim().split("\n");
          const name = blockLines[0]?.trim() || "";
          const desc = blockLines.slice(1).join(" ").trim();
          if (name) {
            projects.push({
              name,
              role: "",
              status: "active",
              url: "",
              description: desc.slice(0, 300),
            });
          }
        }
        if (projects.length > 0) {
          profileData.projects = projects;
        }
        break;
      }
      case "profile/values.md": {
        const vals = content
          .split("\n")
          .filter((l) => l.startsWith("- ") || l.startsWith("* "))
          .map((l) => l.replace(/^[-*]\s+/, "").trim());
        if (vals.length > 0) {
          profileData.values = vals;
        }
        break;
      }
      case "profile/links.md": {
        const linkLines = content.split("\n").filter((l) => l.includes("**"));
        const links: Record<string, string> = { ...(profileData.links as Record<string, string>) };
        for (const line of linkLines) {
          const match = line.match(/\*\*(.+?)\*\*[:\s]+(\S+)/);
          if (match) {
            links[match[1].toLowerCase()] = match[2];
          }
        }
        profileData.links = links;
        break;
      }
      case "preferences/agent.md": {
        const prefs = profileData.preferences as Record<string, Record<string, unknown>>;
        prefs.agent = prefs.agent || {};
        const toneLine = content.split("\n").find((l) => l.toLowerCase().includes("tone"));
        if (toneLine) {
          prefs.agent.tone = toneLine.replace(/.*tone[:\s]*/i, "").trim();
        } else {
          prefs.agent.tone = content.split("\n")[0] || "";
        }
        break;
      }
      case "preferences/writing.md": {
        const prefs = profileData.preferences as Record<string, Record<string, unknown>>;
        prefs.writing = prefs.writing || {};
        prefs.writing.style = content.split("\n")[0] || "";
        break;
      }
    }
  }

  return profileData;
}

// ---------------------------------------------------------------------------
// Share block builders
// ---------------------------------------------------------------------------

function buildPublicShareBlock(
  url: string,
  username: string,
  youJson: Record<string, unknown> | null
): string {
  const lines: string[] = [];
  lines.push(`Read my identity context before we start:`);
  lines.push(url);
  lines.push("");

  if (youJson) {
    lines.push("Quick summary:");
    const identity = youJson.identity as Record<string, unknown> | undefined;
    if (identity?.name) lines.push(`- Name: ${identity.name}`);
    if (identity?.tagline) lines.push(`- Role: ${identity.tagline}`);

    const now = youJson.now as Record<string, unknown> | undefined;
    if (now?.focus && Array.isArray(now.focus) && (now.focus as string[]).length > 0) {
      lines.push(`- Currently working on: ${(now.focus as string[]).join(", ")}`);
    }

    const projects = youJson.projects as Array<Record<string, string>> | undefined;
    if (projects && projects.length > 0) {
      lines.push(`- Key projects: ${projects.map((p) => p.name).filter(Boolean).join(", ")}`);
    }

    const prefs = youJson.preferences as Record<string, Record<string, unknown>> | undefined;
    if (prefs?.agent?.tone) lines.push(`- Prefers: ${prefs.agent.tone}`);
    if (prefs?.writing?.style) lines.push(`- Writing style: ${prefs.writing.style}`);
  }

  lines.push("");
  lines.push(`Full context available at the URL above.`);
  return lines.join("\n");
}

function buildPrivateShareBlock(
  publicBlock: string,
  privateCtx: Record<string, unknown> | null
): string {
  if (!privateCtx) return publicBlock;

  const lines: string[] = [publicBlock, ""];
  lines.push("Private context (for trusted agents only):");

  if (privateCtx.privateNotes) {
    lines.push(String(privateCtx.privateNotes));
  }

  const privateProjects = privateCtx.privateProjects as Array<Record<string, string>> | undefined;
  if (privateProjects && privateProjects.length > 0) {
    lines.push(`Private projects: ${privateProjects.map((p) => p.name || p.description || "unnamed").join(", ")}`);
  }

  const internalLinks = privateCtx.internalLinks as Record<string, string> | undefined;
  if (internalLinks) {
    const entries = Object.entries(internalLinks).filter(([, v]) => v);
    if (entries.length > 0) {
      lines.push(`Internal links: ${entries.map(([k, v]) => `${k}: ${v}`).join(", ")}`);
    }
  }

  return lines.join("\n");
}

function buildProjectShareBlock(
  projectName: string,
  username: string,
  url: string,
  youJson: Record<string, unknown> | null,
  privateCtx: Record<string, unknown> | null
): string | null {
  const searchName = projectName.toLowerCase();

  // Search public projects
  const publicProjects = (youJson?.projects as Array<Record<string, string>> | undefined) || [];
  let found = publicProjects.find((p) => p.name?.toLowerCase().includes(searchName));

  // Search private projects
  if (!found && privateCtx) {
    const privateProjects = (privateCtx.privateProjects as Array<Record<string, string>> | undefined) || [];
    found = privateProjects.find((p) => p.name?.toLowerCase().includes(searchName));
  }

  if (!found) return null;

  const lines: string[] = [];
  lines.push(`Project context for "${found.name || projectName}":`);
  if (found.role) lines.push(`- Role: ${found.role}`);
  if (found.status) lines.push(`- Status: ${found.status}`);
  if (found.description) lines.push(`- Description: ${found.description}`);
  if (found.url) lines.push(`- URL: ${found.url}`);
  lines.push("");
  lines.push(`My identity context: ${url}`);

  const prefs = youJson?.preferences as Record<string, Record<string, unknown>> | undefined;
  const prefParts: string[] = [];
  if (prefs?.agent?.tone) prefParts.push(`tone: ${prefs.agent.tone}`);
  if (prefs?.writing?.style) prefParts.push(`style: ${prefs.writing.style}`);
  if (prefParts.length > 0) lines.push(`My preferences: ${prefParts.join(", ")}`);

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Hook Options
// ---------------------------------------------------------------------------

interface UseYouAgentOptions {
  onPaneSwitch?: (pane: RightPane) => void;
  isOnboarding?: boolean;
  onboardingGreeting?: string;
  onDone?: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useYouAgent(options: UseYouAgentOptions = {}) {
  const { onPaneSwitch, isOnboarding, onboardingGreeting, onDone } = options;

  const { user } = useUser();
  const convexUser = useQuery(
    api.users.getByClerkId,
    user?.id ? { clerkId: user.id } : "skip"
  );
  const latestBundle = useQuery(
    api.bundles.getLatestBundle,
    convexUser?._id ? { userId: convexUser._id } : "skip"
  );
  const userProfile = useQuery(
    api.profiles.getByOwnerId,
    convexUser?._id ? { ownerId: convexUser._id } : "skip"
  );
  const privateContext = useQuery(
    api.private.getPrivateContext,
    user?.id && userProfile?._id
      ? { clerkId: user.id, profileId: userProfile._id }
      : "skip"
  );
  const saveBundleFromForm = useMutation(api.me.saveBundleFromForm);
  const publishLatest = useMutation(api.me.publishLatest);
  const createContextLink = useMutation(api.contextLinks.createLink);
  const updatePrivateContext = useMutation(api.private.updatePrivateContext);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [displayMessages, setDisplayMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [thinkingPhrase, setThinkingPhrase] = useState("");
  const [initialized, setInitialized] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesRef = useRef<ChatMessage[]>([]);

  // Keep ref in sync
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [displayMessages, isThinking]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        Math.min(textareaRef.current.scrollHeight, 160) + "px";
    }
  }, [input]);

  // LLM call
  const callLLM = useCallback(async (msgs: ChatMessage[]): Promise<string> => {
    const res = await fetch(CHAT_PROXY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: msgs }),
      signal: AbortSignal.timeout(60_000),
    });

    if (!res.ok) {
      await res.text();
      throw new Error("the agent is temporarily unavailable. try again in a moment.");
    }

    const data = await res.json();
    if (!data.content) throw new Error("the agent returned an empty response. try again.");
    return data.content;
  }, []);

  // Save updates to Convex
  const saveUpdates = useCallback(
    async (updates: SectionUpdate[]) => {
      if (!user?.id || !convexUser) return;

      try {
        const profileData = buildProfileDataFromUpdates(
          updates,
          (latestBundle?.youJson as Record<string, unknown>) || null,
          convexUser.username
        );

        const result = await saveBundleFromForm({
          clerkId: user.id,
          profileData,
        });

        return result;
      } catch (err) {
        console.error("Failed to save updates:", err);
        return null;
      }
    },
    [user?.id, convexUser, latestBundle?.youJson, saveBundleFromForm]
  );

  // Initialize conversation with context
  useEffect(() => {
    if (initialized || !convexUser) return;
    // For onboarding, we use a custom greeting prompt
    // For dashboard, we wait for latestBundle to be defined (can be null)
    if (!isOnboarding && latestBundle === undefined) return;

    // Build context from BOTH profiles table and bundles table
    let profileContext = buildProfileContext(
      (latestBundle?.youJson as Record<string, unknown>) || null
    );

    // Enrich with data from profiles table (from /create flow)
    if (userProfile && profileContext === "the user has no existing profile data yet.") {
      const parts: string[] = ["here is what we know about the user:"];
      if (userProfile.name) parts.push(`name: ${userProfile.name}`);
      if (convexUser?.username) parts.push(`username: @${convexUser.username}`);
      if (userProfile.tagline) parts.push(`tagline: ${userProfile.tagline}`);
      if (userProfile.location) parts.push(`location: ${userProfile.location}`);
      if (userProfile.bio) {
        const bio = userProfile.bio as Record<string, string>;
        if (bio.short) parts.push(`bio: ${bio.short}`);
      }
      if (userProfile.avatarUrl) parts.push(`has profile image from social media`);
      if (parts.length > 1) profileContext = parts.join("\n");
    }

    const systemMessage: ChatMessage = {
      role: "system",
      content: SYSTEM_PROMPT,
    };

    const username = convexUser?.username || "";
    const displayName = userProfile?.name || convexUser?.displayName || "";

    const contextContent = isOnboarding && onboardingGreeting
      ? onboardingGreeting
      : `${profileContext}\n\nthe user @${username}${displayName ? ` (${displayName})` : ""} just opened the web chat. greet them by name if you know it. reference specific things from their profile. ask how you can help. if their profile is sparse, proactively suggest building it out — ask for their x or github handle.`;

    const contextMessage: ChatMessage = {
      role: "user",
      content: contextContent,
    };

    setMessages([systemMessage, contextMessage]);
    setInitialized(true);

    setIsThinking(true);
    setThinkingPhrase(randomThinking());

    callLLM([systemMessage, contextMessage])
      .then((response) => {
        const { display, updates } = parseUpdatesFromResponse(response);

        const assistantMsg: ChatMessage = {
          role: "assistant",
          content: response,
        };

        setMessages((prev) => [...prev, assistantMsg]);

        const newDisplay: DisplayMessage[] = [];

        if (display) {
          newDisplay.push({
            id: crypto.randomUUID(),
            role: "assistant",
            content: display,
          });
        }

        if (updates.length > 0) {
          const sectionNames = updates.map((u) => sectionLabel(u.section)).join(", ");
          newDisplay.push({
            id: crypto.randomUUID(),
            role: "system-notice",
            content: `[updated: ${sectionNames}]`,
          });
          saveUpdates(updates);
        }

        setDisplayMessages(newDisplay);
        setIsThinking(false);
      })
      .catch((err) => {
        setDisplayMessages([
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: `hmm, something went wrong connecting to the agent. ${err instanceof Error ? err.message : "try again in a moment."}`,
          },
        ]);
        setIsThinking(false);
      });
  }, [initialized, convexUser, latestBundle, isOnboarding, onboardingGreeting, callLLM, saveUpdates]);

  // Slash commands
  const handleSlashCommand = useCallback(
    (cmd: string): boolean => {
      const trimmed = cmd.trim().toLowerCase();

      // Pane-switching commands
      // Note: /publish and /help are handled separately below with special logic
      const paneCommands: Record<string, RightPane> = {
        "/preview": "preview",
        "/profile": "preview",
        "/settings": "settings",
        "/billing": "billing",
        "/tokens": "tokens",
        "/json": "json",
        "/sources": "sources",
        "/portrait": "portrait",
        "/agents": "agents",
        "/activity": "activity",
      };

      if (paneCommands[trimmed] && onPaneSwitch) {
        onPaneSwitch(paneCommands[trimmed]);
        setDisplayMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), role: "user", content: trimmed },
          {
            id: crypto.randomUUID(),
            role: "system-notice",
            content: `[switched to ${paneCommands[trimmed]}]`,
          },
        ]);
        return true;
      }

      if (trimmed === "/done") {
        setDisplayMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), role: "user", content: "/done" },
          {
            id: crypto.randomUUID(),
            role: "system-notice",
            content: "[session complete]",
          },
        ]);
        onDone?.();
        return true;
      }

      if (trimmed === "/help") {
        if (onPaneSwitch) {
          onPaneSwitch("help");
        }
        const helpText = onPaneSwitch
          ? "available commands:\n/share -- create a shareable identity link (copied to clipboard)\n/share --private -- include private context\n/share --project {name} -- share context scoped to a project\n/preview -- live profile preview\n/json -- raw you.json\n/settings -- account + context links\n/tokens -- api key management\n/billing -- plan info\n/sources -- connected data sources\n/portrait -- ascii portrait settings\n/agents -- agent network & access\n/activity -- security & activity log\n/publish -- publish your latest bundle\n/status -- bundle status\n/help -- show this reference"
          : "available commands:\n/share -- create a shareable identity link\n/share --private -- include private context\n/share --project {name} -- share context scoped to a project\n/status -- show bundle status\n/publish -- publish your latest bundle\n/done -- finish onboarding\n/help -- show this message";

        setDisplayMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), role: "user", content: "/help" },
          { id: crypto.randomUUID(), role: "system-notice", content: helpText },
        ]);
        return true;
      }

      if (trimmed === "/status") {
        const version = latestBundle?.version ?? "none";
        const published = latestBundle?.isPublished ? "published" : "draft";
        const username = convexUser?.username ?? "unknown";
        const plan = convexUser?.plan ?? "free";

        setDisplayMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), role: "user", content: "/status" },
          {
            id: crypto.randomUUID(),
            role: "system-notice",
            content: `bundle status:\n  username: @${username}\n  plan: ${plan}\n  version: v${version}\n  status: ${published}`,
          },
        ]);
        return true;
      }

      if (trimmed === "/publish") {
        if (onPaneSwitch) {
          onPaneSwitch("publish");
        }
        if (!user?.id || !latestBundle) {
          setDisplayMessages((prev) => [
            ...prev,
            { id: crypto.randomUUID(), role: "user", content: "/publish" },
            {
              id: crypto.randomUUID(),
              role: "system-notice",
              content: "no bundle to publish. have a conversation first so the agent can build your profile.",
            },
          ]);
          return true;
        }

        setDisplayMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), role: "user", content: "/publish" },
          { id: crypto.randomUUID(), role: "system-notice", content: "publishing..." },
        ]);

        publishLatest({ clerkId: user.id })
          .then((result) => {
            setDisplayMessages((prev) => [
              ...prev,
              {
                id: crypto.randomUUID(),
                role: "system-notice",
                content: `published v${result.version}. live at you.md/${result.username}`,
              },
            ]);
          })
          .catch((err) => {
            setDisplayMessages((prev) => [
              ...prev,
              {
                id: crypto.randomUUID(),
                role: "system-notice",
                content: `publish failed: ${err instanceof Error ? err.message : "unknown error"}`,
              },
            ]);
          });
        return true;
      }

      // /share — create a context link and generate copyable block
      if (trimmed === "/share" || trimmed.startsWith("/share ")) {
        if (!user?.id) {
          setDisplayMessages((prev) => [
            ...prev,
            { id: crypto.randomUUID(), role: "user", content: trimmed },
            {
              id: crypto.randomUUID(),
              role: "system-notice",
              content: "sign in first to create a shareable context link.",
            },
          ]);
          return true;
        }

        const isPrivate = trimmed.includes("--private") || trimmed.includes("--full");
        const projectMatch = trimmed.match(/--project\s+(.+?)(?:\s+--|$)/);
        const projectName = projectMatch ? projectMatch[1].trim() : null;

        setDisplayMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), role: "user", content: trimmed },
          { id: crypto.randomUUID(), role: "system-notice", content: "creating context link..." },
        ]);

        const scope = isPrivate ? "full" : "public";

        createContextLink({
          clerkId: user.id,
          scope,
          ttl: "7d",
        })
          .then((result) => {
            const uname = convexUser?.username ?? "user";
            const youJson = (latestBundle?.youJson as Record<string, unknown>) || null;
            const privCtx = (privateContext as Record<string, unknown> | null) ?? null;

            let shareBlock: string;
            let label: string;

            if (projectName) {
              // /share --project {name}
              const projectBlock = buildProjectShareBlock(
                projectName,
                uname,
                result.url,
                youJson,
                privCtx
              );
              if (projectBlock) {
                shareBlock = projectBlock;
                label = `project "${projectName}"`;
              } else {
                setDisplayMessages((prev) => [
                  ...prev,
                  {
                    id: crypto.randomUUID(),
                    role: "system-notice",
                    content: `no project matching "${projectName}" found in public or private projects.`,
                  },
                ]);
                return;
              }
            } else {
              // /share or /share --private
              const publicBlock = buildPublicShareBlock(result.url, uname, youJson);
              shareBlock = isPrivate
                ? buildPrivateShareBlock(publicBlock, privCtx)
                : publicBlock;
              label = isPrivate ? "full" : "public";
            }

            // Copy to clipboard
            navigator.clipboard.writeText(shareBlock).catch(() => {});

            setDisplayMessages((prev) => [
              ...prev,
              {
                id: crypto.randomUUID(),
                role: "system-notice",
                content: `context link created for @${uname} (${label} scope, expires 7d)\n\n---\n${shareBlock}\n---\n\ncopied to clipboard. paste into any AI conversation.`,
              },
            ]);
          })
          .catch((err) => {
            setDisplayMessages((prev) => [
              ...prev,
              {
                id: crypto.randomUUID(),
                role: "system-notice",
                content: `share failed: ${err instanceof Error ? err.message : "unknown error"}`,
              },
            ]);
          });
        return true;
      }

      return false;
    },
    [latestBundle, convexUser, user?.id, publishLatest, createContextLink, onPaneSwitch, onDone, privateContext]
  );

  // Send message
  const sendMessage = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isThinking) return;

    setInput("");

    // Handle slash commands
    if (trimmed.startsWith("/")) {
      if (handleSlashCommand(trimmed)) return;
    }

    // Add user message to display
    setDisplayMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: "user", content: trimmed },
    ]);

    // Add to conversation history
    const userMsg: ChatMessage = { role: "user", content: trimmed };
    const updatedMessages = [...messagesRef.current, userMsg];
    setMessages(updatedMessages);

    // Start thinking
    setIsThinking(true);
    setThinkingPhrase(randomThinking());

    try {
      const response = await callLLM(updatedMessages);
      const { display, updates } = parseUpdatesFromResponse(response);

      const assistantMsg: ChatMessage = {
        role: "assistant",
        content: response,
      };
      setMessages((prev) => [...prev, assistantMsg]);

      const newDisplayMsgs: DisplayMessage[] = [];

      if (display) {
        newDisplayMsgs.push({
          id: crypto.randomUUID(),
          role: "assistant",
          content: display,
        });
      }

      if (updates.length > 0) {
        const sectionNames = updates
          .map((u) => sectionLabel(u.section))
          .join(", ");
        newDisplayMsgs.push({
          id: crypto.randomUUID(),
          role: "system-notice",
          content: `[updated: ${sectionNames}]`,
        });

        const result = await saveUpdates(updates);
        if (result) {
          newDisplayMsgs.push({
            id: crypto.randomUUID(),
            role: "system-notice",
            content: `[saved as v${result.version}]`,
          });
        }
      }

      // Handle private updates from agent
      const privUpdates = parsePrivateUpdatesFromResponse(response);
      if (privUpdates.length > 0 && user?.id && userProfile?._id) {
        for (const pu of privUpdates) {
          try {
            if (pu.field === "privateNotes" && pu.content) {
              await updatePrivateContext({
                clerkId: user.id,
                profileId: userProfile._id,
                privateNotes: pu.content,
              });
              newDisplayMsgs.push({
                id: crypto.randomUUID(),
                role: "system-notice",
                content: "[saved private note]",
              });
            } else if (pu.field === "privateProjects" && pu.action === "add" && pu.project) {
              // Get existing private projects and append
              const existing = (privateContext as Record<string, unknown> | null);
              const existingProjects = (existing?.privateProjects as Array<Record<string, string>>) || [];
              const updatedProjects = [...existingProjects, pu.project];
              await updatePrivateContext({
                clerkId: user.id,
                profileId: userProfile._id,
                privateProjects: updatedProjects,
              });
              newDisplayMsgs.push({
                id: crypto.randomUUID(),
                role: "system-notice",
                content: `[saved private project: ${pu.project.name || "unnamed"}]`,
              });
            }
          } catch (err) {
            newDisplayMsgs.push({
              id: crypto.randomUUID(),
              role: "system-notice",
              content: `[failed to save private content: ${err instanceof Error ? err.message : "unknown error"}]`,
            });
          }
        }
      }

      setDisplayMessages((prev) => [...prev, ...newDisplayMsgs]);
    } catch (err) {
      setDisplayMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `something went wrong. ${err instanceof Error ? err.message : "try again."}`,
        },
      ]);
    }

    setIsThinking(false);
    textareaRef.current?.focus();
  }, [input, isThinking, handleSlashCommand, callLLM, saveUpdates, user?.id, userProfile?._id, privateContext, updatePrivateContext]);

  return {
    // State
    displayMessages,
    input,
    setInput,
    isThinking,
    thinkingPhrase,
    initialized,
    // Refs
    messagesEndRef,
    textareaRef,
    // Actions
    sendMessage,
    handleSlashCommand,
    // Data
    convexUser,
    latestBundle,
    // Helpers for adding system messages from outside
    addSystemMessage: (content: string) => {
      setDisplayMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "system-notice", content },
      ]);
    },
  };
}
