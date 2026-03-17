"use client";

import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import Link from "next/link";
import { useState, useEffect, useRef, useCallback, KeyboardEvent } from "react";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CHAT_PROXY_URL =
  "https://kindly-cassowary-600.convex.site/api/v1/chat";

const THINKING_PHRASES = [
  "reading between your lines",
  "mapping your expertise graph",
  "grokking your whole deal",
  "connecting the dots",
  "learning you",
  "calibrating to your wavelength",
  "decoding your digital footprint",
  "weaving your story",
  "crystallizing your identity",
  "assembling the puzzle pieces",
  "distilling your essence",
  "processing your essence",
  "structuring your identity",
  "analyzing your voice patterns",
  "building your identity constellation",
  "converting vibes to structured data",
  "finding your narrative thread",
  "capturing your voice signature",
  "computing your identity fingerprint",
  "synthesizing your public presence",
];

const BUNDLE_SECTIONS = [
  "profile/about.md",
  "profile/now.md",
  "profile/projects.md",
  "profile/values.md",
  "profile/links.md",
  "preferences/agent.md",
  "preferences/writing.md",
] as const;

const SYSTEM_PROMPT = `you are the you.md agent. you're helping a human build and refine their identity file for the agent internet.

personality: warm but not gushy. direct. dry humor when natural. genuinely curious about people. terminal-native tone — lowercase, no exclamation marks, no emoji, short sentences.

you're working with their you-md/v1 identity bundle. ask questions, learn about them, and generate updates to their profile sections. after each exchange, include structured updates as JSON blocks when relevant.

the sections are:
- profile/about.md — bio, background, narrative
- profile/now.md — current focus
- profile/projects.md — active projects
- profile/values.md — core values
- profile/links.md — annotated links
- preferences/agent.md — how AI should interact with them
- preferences/writing.md — communication style

your job:
1. analyze what you know about the person from their existing profile and conversation
2. ask follow-up questions to fill gaps — be conversational, not interrogative
3. after each exchange, output structured updates as JSON blocks:
   \`\`\`json
   {"updates": [{"section": "profile/about.md", "content": "...markdown content..."}]}
   \`\`\`
4. keep the conversation going until you have enough for a rich identity bundle
5. never tell the user to edit markdown files themselves
6. reference specific things you learned about them

rules for content in updates:
- each section must start with a YAML frontmatter block (--- title: "SectionTitle" ---)
- content should be real markdown, not HTML comments or placeholders
- be substantive. write real prose based on what you know.
- for links.md, format as: - **Label**: URL — brief annotation
- for agent.md, describe how agents should interact with this person
- for writing.md, capture their tone/style from how they've been talking to you

when you think the profile is rich enough (at least about, now, projects, and values have substance), suggest finishing by saying something like "your bundle is looking solid. ready to publish, or want to keep going?"`;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface DisplayMessage {
  id: string;
  role: "user" | "assistant" | "system-notice";
  content: string;
}

interface SectionUpdate {
  section: string;
  content: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function randomThinking(): string {
  return THINKING_PHRASES[Math.floor(Math.random() * THINKING_PHRASES.length)];
}

function parseUpdatesFromResponse(text: string): {
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

function buildProfileContext(youJson: Record<string, unknown> | null): string {
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

function buildProfileDataFromUpdates(
  updates: SectionUpdate[],
  existingJson: Record<string, unknown> | null,
  username: string
): Record<string, unknown> {
  // Start from existing data or empty
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

  // Apply updates by extracting content from markdown sections
  for (const update of updates) {
    const content = update.content
      .replace(/---[\s\S]*?---/, "")
      .trim();

    switch (update.section) {
      case "profile/about.md": {
        // Extract name from # heading, rest is bio
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
        // Parse ## headings as projects
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
        // Parse links like - **Label**: URL
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
        // Extract tone from content
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
// Main Component
// ---------------------------------------------------------------------------

export function ChatContent() {
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

  // ---------------------------------------------------------------------------
  // LLM call
  // ---------------------------------------------------------------------------

  const callLLM = useCallback(async (msgs: ChatMessage[]): Promise<string> => {
    const res = await fetch(CHAT_PROXY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: msgs }),
      signal: AbortSignal.timeout(60_000),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Chat error (${res.status}): ${body.slice(0, 200)}`);
    }

    const data = await res.json();
    if (!data.content) throw new Error("Empty response from agent");
    return data.content;
  }, []);

  // ---------------------------------------------------------------------------
  // Save updates to Convex
  // ---------------------------------------------------------------------------

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

  // ---------------------------------------------------------------------------
  // Initialize conversation with context
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (initialized || !convexUser) return;

    const profileContext = buildProfileContext(
      (latestBundle?.youJson as Record<string, unknown>) || null
    );

    const systemMessage: ChatMessage = {
      role: "system",
      content: SYSTEM_PROMPT,
    };

    const contextMessage: ChatMessage = {
      role: "user",
      content: `${profileContext}\n\nthe user just opened the web chat. greet them briefly and ask how you can help with their identity bundle. if they have existing data, reference something specific from it. if not, suggest getting started.`,
    };

    setMessages([systemMessage, contextMessage]);
    setInitialized(true);

    // Make initial LLM call
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
  }, [initialized, convexUser, latestBundle?.youJson, callLLM, saveUpdates]);

  // ---------------------------------------------------------------------------
  // Slash commands
  // ---------------------------------------------------------------------------

  const handleSlashCommand = useCallback(
    (cmd: string): boolean => {
      const trimmed = cmd.trim().toLowerCase();

      if (trimmed === "/help") {
        setDisplayMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "user",
            content: "/help",
          },
          {
            id: crypto.randomUUID(),
            role: "system-notice",
            content:
              "available commands:\n/status -- show bundle status\n/publish -- publish your latest bundle\n/preview -- link to your profile page\n/help -- show this message",
          },
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
          {
            id: crypto.randomUUID(),
            role: "user",
            content: "/status",
          },
          {
            id: crypto.randomUUID(),
            role: "system-notice",
            content: `bundle status:\n  username: @${username}\n  plan: ${plan}\n  version: v${version}\n  status: ${published}`,
          },
        ]);
        return true;
      }

      if (trimmed === "/publish") {
        if (!user?.id || !latestBundle) {
          setDisplayMessages((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              role: "user",
              content: "/publish",
            },
            {
              id: crypto.randomUUID(),
              role: "system-notice",
              content: "no bundle to publish. save some changes first.",
            },
          ]);
          return true;
        }

        setDisplayMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "user",
            content: "/publish",
          },
          {
            id: crypto.randomUUID(),
            role: "system-notice",
            content: "publishing...",
          },
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

      if (trimmed === "/preview") {
        const username = convexUser?.username;
        setDisplayMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "user",
            content: "/preview",
          },
          {
            id: crypto.randomUUID(),
            role: "system-notice",
            content: username
              ? `your profile: https://you.md/${username}`
              : "no username found.",
          },
        ]);
        return true;
      }

      return false;
    },
    [latestBundle, convexUser, user?.id, publishLatest]
  );

  // ---------------------------------------------------------------------------
  // Send message
  // ---------------------------------------------------------------------------

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
      {
        id: crypto.randomUUID(),
        role: "user",
        content: trimmed,
      },
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

  // ---------------------------------------------------------------------------
  // Key handler
  // ---------------------------------------------------------------------------

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    },
    [sendMessage]
  );

  // ---------------------------------------------------------------------------
  // Loading state
  // ---------------------------------------------------------------------------

  if (!convexUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-foreground-secondary font-mono text-sm">loading...</p>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* Header */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard"
            className="text-sm text-foreground-secondary hover:text-foreground transition-colors"
          >
            &larr; dashboard
          </Link>
          <span className="text-border">|</span>
          <span className="font-mono text-sm text-foreground tracking-tight">
            you.md agent
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs font-mono text-foreground-secondary">
          <span>@{convexUser.username}</span>
          <span className="text-border">|</span>
          <span>
            {latestBundle ? `v${latestBundle.version}` : "no bundle"}
          </span>
          <span className="text-border">|</span>
          <span
            className={
              latestBundle?.isPublished
                ? "text-accent-secondary"
                : "text-accent-primary"
            }
          >
            {latestBundle?.isPublished ? "published" : "draft"}
          </span>
        </div>
      </nav>

      {/* Messages area */}
      <main className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-2xl mx-auto space-y-4">
          {displayMessages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}

          {isThinking && <ThinkingIndicator phrase={thinkingPhrase} />}

          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Input area */}
      <div className="shrink-0 border-t border-border bg-background px-4 py-4">
        <div className="max-w-2xl mx-auto flex gap-3">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="tell me about yourself, or ask me anything..."
            rows={1}
            disabled={isThinking}
            className="flex-1 px-4 py-3 text-sm font-mono bg-background-secondary border border-border rounded-lg outline-none focus:border-accent-secondary focus:shadow-[0_0_12px_rgba(122,190,208,0.15)] transition-all resize-none text-foreground placeholder:text-foreground-secondary/40 disabled:opacity-50"
          />
          <button
            onClick={sendMessage}
            disabled={isThinking || !input.trim()}
            className="px-4 py-3 text-sm font-mono bg-accent-primary text-void rounded-lg hover:opacity-90 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
          >
            send
          </button>
        </div>
        <div className="max-w-2xl mx-auto mt-2 flex items-center gap-3">
          <span className="text-[10px] font-mono text-foreground-secondary/50">
            enter to send, shift+enter for newline
          </span>
          <span className="text-foreground-secondary/30">|</span>
          <span className="text-[10px] font-mono text-foreground-secondary/50">
            try /help for commands
          </span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Message Bubble
// ---------------------------------------------------------------------------

function MessageBubble({ message }: { message: DisplayMessage }) {
  if (message.role === "system-notice") {
    return (
      <div className="flex justify-center">
        <div className="px-3 py-1.5 text-xs font-mono text-accent-secondary bg-accent-secondary/5 border border-accent-secondary/20 rounded-md whitespace-pre-wrap">
          {message.content}
        </div>
      </div>
    );
  }

  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] px-4 py-3 bg-coral/10 rounded-lg">
          <p className="text-sm whitespace-pre-wrap leading-relaxed">
            {message.content}
          </p>
        </div>
      </div>
    );
  }

  // assistant
  return (
    <div className="flex justify-start">
      <div className="max-w-[80%] px-4 py-3 bg-background-secondary rounded-lg">
        <p className="text-sm whitespace-pre-wrap leading-relaxed">
          {message.content}
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Thinking Indicator
// ---------------------------------------------------------------------------

function ThinkingIndicator({ phrase }: { phrase: string }) {
  const [dots, setDots] = useState("");

  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => {
        if (prev === "...") return "";
        return prev + ".";
      });
    }, 400);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex justify-start">
      <div className="max-w-[80%] px-4 py-3 bg-background-secondary rounded-lg">
        <p className="text-sm text-foreground-secondary/60 font-mono">
          {phrase}
          <span className="inline-block w-6">{dots}</span>
        </p>
      </div>
    </div>
  );
}
