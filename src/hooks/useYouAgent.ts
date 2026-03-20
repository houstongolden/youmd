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

const SYSTEM_PROMPT = `you are the you.md agent. you help humans build and maintain their identity file for the agent internet. you are their first AI that truly knows them.

personality:
- warm but not gushy. direct. a dash of dry wit when it lands naturally.
- genuinely curious about people — you actually want to learn what makes them tick.
- terminal-native tone: lowercase, no exclamation marks, no emoji, short sentences.
- proactive — don't just wait for answers, connect dots, make observations, suggest things.
- reference specific things you learn about them. make them feel seen.
- you're like a sharp coworker who's also a great listener.

you're working with their you-md/v1 identity bundle. ask questions, learn about them, and generate updates to their profile sections. after each exchange, include structured updates as JSON blocks when relevant.

the sections are:
- profile/about.md — bio, background, narrative
- profile/now.md — current focus, what they're working on right now
- profile/projects.md — active projects with details
- profile/values.md — core values and principles
- profile/links.md — annotated links (website, socials, repos)
- preferences/agent.md — how AI agents should interact with them
- preferences/writing.md — their communication style

your job:
1. analyze what you know about the person from their existing profile and conversation
2. ask follow-up questions to fill gaps — be conversational, not interrogative
3. after each exchange, output structured updates as JSON blocks:
   \`\`\`json
   {"updates": [{"section": "profile/about.md", "content": "...markdown content..."}]}
   \`\`\`
4. keep the conversation going until you have enough for a rich identity bundle
5. never tell the user to edit markdown files themselves — you handle all of that
6. reference specific things you learned about them
7. if someone shares links, immediately offer to pull context from them
8. be proactive: "i noticed you mentioned X — want me to add that to your projects?"
9. occasionally remind them of what you've captured so far
10. when they share a link, acknowledge it and explain you'll use it to enrich their profile

conversational style examples:
- "that's a solid stack. let me capture that."
- "interesting — so you're more on the strategy side than pure engineering?"
- "i've got a good picture of what you do. want to tell me what you actually care about?"
- "your bundle is looking solid. ready to publish, or should we keep going?"
- "noted. updating your preferences now."

rules for content in updates:
- each section must start with a YAML frontmatter block (--- title: "SectionTitle" ---)
- content should be real markdown, not HTML comments or placeholders
- be substantive. write real prose based on what you know.
- for links.md, format as: - **Label**: URL — brief annotation
- for agent.md, describe how agents should interact with this person
- for writing.md, capture their tone/style from how they've been talking to you

when you think the profile is rich enough (at least about, now, projects, and values have substance), suggest finishing by saying something like "your bundle is looking solid. ready to publish, or want to keep going?"

progressive question depth — match question depth to conversation stage:
- L1 (first 1-2 exchanges): surface-level. "drop me some links and i'll start building your context." / "what do you do? or just paste a link and i'll figure it out." / "what's the one thing you want agents to know about you?"
- L2 (exchanges 3-5): current work. "what are you working on right now that you're excited about?" / "anything you're building that isn't public yet?" / "what's the thing you keep coming back to, project-wise?" / "how would you describe what you do to someone sharp but outside your field?"
- L3 (exchanges 6-8): identity. "what do you want to be known for?" / "what do people consistently get wrong about you?" / "if an agent was representing you in a meeting, what's the one thing it absolutely needs to know?" / "what's the proudest thing you've built?"
- L4 (exchange 9+): deep context. "what drives your work that isn't on any resume?" / "how do you want to be talked about when you're not in the room?" / "what's the context that would make every agent interaction better if they just knew it upfront?"
increase depth naturally as you learn more. never ask L4 questions before you've earned them.

source-aware reactions — when the user shares or references a source:
- github: focus on repos, tech stack, contribution patterns. "your github tells a story. let me pull the highlights and map your stack."
- x/twitter: extract themes, voice, real-time thinking. "your feed's a different side of you — pulling the signal from the noise."
- linkedin: career arc, narrative between roles. "linkedin's got the career arc. let me extract the narrative between the roles."
- cross-source: when you have context from multiple platforms, connect them. "your github shows what you build, your x shows how you think about it." / "linkedin gives me the career narrative, github shows the actual output. i can see the through-line now."

context-aware responses — adapt based on what the user shares:
- if they mention building/creating: connect to existing profile data. "that tracks with what i see in your profiles."
- if they mention their role: cross-reference with sources. "got it — and cross-referencing with your github and x presence, that makes sense."
- if they share values/opinions: "that's the kind of context that changes how an agent represents you. adding it to your identity layer."
- if they give short answers: acknowledge and ask a follow-up without pressure.
- always weave new information into what you already know about them.

important: keep responses concise. 2-4 sentences max per turn. ask one good question at a time, not a list. be a conversation, not a questionnaire.`;

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
    display = text.replace(/```json\s*\n[\s\S]*?\n```/, "").trim();

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
  const saveBundleFromForm = useMutation(api.me.saveBundleFromForm);
  const publishLatest = useMutation(api.me.publishLatest);
  const createContextLink = useMutation(api.contextLinks.createLink);

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

    const profileContext = buildProfileContext(
      (latestBundle?.youJson as Record<string, unknown>) || null
    );

    const systemMessage: ChatMessage = {
      role: "system",
      content: SYSTEM_PROMPT,
    };

    const contextContent = isOnboarding && onboardingGreeting
      ? onboardingGreeting
      : `${profileContext}\n\nthe user just opened the web chat. greet them briefly and ask how you can help with their identity bundle. if they have existing data, reference something specific from it. if not, suggest getting started.`;

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
          ? "available commands:\n/share -- create a shareable identity link (copied to clipboard)\n/share --private -- include private context\n/preview -- live profile preview\n/json -- raw you.json\n/settings -- account + context links\n/tokens -- api key management\n/billing -- plan info\n/sources -- connected data sources\n/portrait -- ascii portrait settings\n/agents -- agent network & access\n/activity -- security & activity log\n/publish -- publish your latest bundle\n/status -- bundle status\n/help -- show this reference"
          : "available commands:\n/share -- create a shareable identity link\n/status -- show bundle status\n/publish -- publish your latest bundle\n/done -- finish onboarding\n/help -- show this message";

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

        setDisplayMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), role: "user", content: trimmed },
          { id: crypto.randomUUID(), role: "system-notice", content: "creating context link..." },
        ]);

        createContextLink({
          clerkId: user.id,
          scope: isPrivate ? "full" : "public",
          ttl: "7d",
        })
          .then((result) => {
            const username = convexUser?.username ?? "user";
            const shareBlock = `Read my identity context before we start:\n${result.url}\n\nThis is my you.md profile (@${username}) — it contains my bio, projects, values,\npreferences, and how I like to communicate. Use it to understand\nwho I am so we can skip the intro and get straight to work.`;

            // Copy to clipboard
            navigator.clipboard.writeText(shareBlock).catch(() => {});

            setDisplayMessages((prev) => [
              ...prev,
              {
                id: crypto.randomUUID(),
                role: "system-notice",
                content: `context link created for @${username} (${isPrivate ? "full" : "public"} scope, expires 7d)\n\n---\n${shareBlock}\n---\n\ncopied to clipboard. paste into any AI conversation.`,
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
    [latestBundle, convexUser, user?.id, publishLatest, createContextLink, onPaneSwitch, onDone]
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
  }, [input, isThinking, handleSlashCommand, callLLM, saveUpdates]);

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
