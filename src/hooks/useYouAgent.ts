"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";

import { CONVEX_SITE_URL } from "@/lib/constants";
import {
  CHAT_PROXY_URL,
  CHAT_ACK_URL,
  SYSTEM_PROMPT,
  BUNDLE_SECTIONS,
  isValidSection,
  detectSourcesInMessage,
  scrapeSource,
  verifyIdentity,
  researchUser,
  randomThinking,
  sectionLabel,
  buildPublicShareBlock,
  buildPrivateShareBlock,
  buildProjectShareBlock,
  buildProfileContext,
  buildProfileDataFromUpdates,
  parseUpdatesFromResponse,
  parsePrivateUpdatesFromResponse,
  parseMemorySavesFromResponse,
  parsePortraitUpdateFromResponse,
  parseCustomSectionsFromResponse,
  type ThinkingCategory,
  type ProgressStep,
  type ChatMessage,
  type DisplayMessage,
  type SectionUpdate,
  type PrivateUpdate,
  type RightPane,
  type MemorySave,
  type PortraitUpdate,
  type CustomSection,
  type UseYouAgentOptions,
  type DetectedSource,
} from "./agent-utils";

// Re-export types and functions that other files import from this module
export type { ThinkingCategory, ProgressStep, ChatMessage, DisplayMessage, SectionUpdate, PrivateUpdate, RightPane, MemorySave, PortraitUpdate, CustomSection } from "./agent-utils";
export { BUNDLE_SECTIONS, isValidSection, buildProfileContext, buildProfileDataFromUpdates, parseUpdatesFromResponse, parsePrivateUpdatesFromResponse, parseMemorySavesFromResponse, parsePortraitUpdateFromResponse, parseCustomSectionsFromResponse } from "./agent-utils";

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
  const updateProfile = useMutation(api.profiles.updateProfile);
  const setProfileImages = useMutation(api.profiles.setProfileImages);
  const saveMemories = useMutation(api.memories.saveMemories);
  const upsertSession = useMutation(api.memories.upsertSession);
  const summarizeSession = useAction(api.chat.summarizeSession);
  const compactSession = useAction(api.chat.compactSession);
  const recentMemories = useQuery(
    api.memories.listMemories,
    convexUser?._id ? { userId: convexUser._id, limit: 30 } : "skip"
  );

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [displayMessages, setDisplayMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [thinkingPhrase, setThinkingPhrase] = useState("");
  const [thinkingCategory, setThinkingCategory] = useState<ThinkingCategory | undefined>();
  const [initialized, setInitialized] = useState(false);
  const [progressSteps, setProgressSteps] = useState<ProgressStep[]>([]);
  const [sessionRestored, setSessionRestored] = useState(false);

  // Progress step helpers
  const addStep = useCallback((label: string, detail?: string): string => {
    const id = crypto.randomUUID();
    setProgressSteps((prev) => [
      ...prev,
      { id, label, status: "running", detail, startedAt: Date.now() },
    ]);
    return id;
  }, []);

  const completeStep = useCallback((id: string, detail?: string) => {
    setProgressSteps((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, status: "done" as const, ...(detail !== undefined ? { detail } : {}) } : s
      )
    );
  }, []);

  const failStep = useCallback((id: string, detail?: string) => {
    setProgressSteps((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, status: "error" as const, ...(detail !== undefined ? { detail } : {}) } : s
      )
    );
  }, []);

  const clearSteps = useCallback(() => {
    setProgressSteps([]);
  }, []);

  // Chat message persistence
  const saveChatMessages = useMutation(api.memories.saveChatMessages);
  const latestChatMessages = useQuery(
    api.memories.loadLatestChatMessages,
    convexUser?._id ? { userId: convexUser._id } : "skip"
  );

  // Session tracking
  const sessionIdRef = useRef<string>(crypto.randomUUID());
  const messageCountRef = useRef<number>(0);
  const lastSummarizedAtRef = useRef<number>(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesRef = useRef<ChatMessage[]>([]);

  // Keep ref in sync
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Auto-rotate thinking phrases while agent is working
  const thinkingCategoryRef = useRef<ThinkingCategory | undefined>(undefined);
  useEffect(() => {
    thinkingCategoryRef.current = thinkingCategory;
  }, [thinkingCategory]);

  // Auto-rotate thinking phrases while agent is working
  // Rotates every 5s (was 2.5s — slower feels more intentional, less fake)
  useEffect(() => {
    if (!isThinking) return;
    const interval = setInterval(() => {
      const cat = thinkingCategoryRef.current;
      // Use the active step label if one exists, otherwise random phrase
      const activeStep = progressSteps.find((s) => s.status === "running");
      if (activeStep && activeStep.label !== "thinking") {
        setThinkingPhrase(activeStep.label);
      } else {
        setThinkingPhrase(randomThinking(cat));
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [isThinking, progressSteps]);

  // Restore session from Convex on mount
  useEffect(() => {
    if (sessionRestored || isOnboarding) return;
    if (latestChatMessages === undefined) return; // still loading
    if (latestChatMessages === null) {
      setSessionRestored(true);
      return;
    }

    // Only restore if the session is recent (within 24h)
    const isRecent = Date.now() - latestChatMessages.updatedAt < 24 * 60 * 60 * 1000;
    if (!isRecent) {
      setSessionRestored(true);
      return;
    }

    // Restore the session
    sessionIdRef.current = latestChatMessages.sessionId;
    messageCountRef.current = latestChatMessages.messageCount || 0;
    const restoredDisplay = latestChatMessages.displayMessages.map(m => ({
      id: m.id,
      role: m.role as DisplayMessage["role"],
      content: m.content,
    }));
    const restoredLLM = latestChatMessages.llmMessages.map(m => ({
      role: m.role as ChatMessage["role"],
      content: m.content,
    }));

    if (restoredDisplay.length > 0) {
      setDisplayMessages(restoredDisplay);
      setMessages(restoredLLM);
      setInitialized(true); // skip the init conversation — we have history
    }
    setSessionRestored(true);
  }, [latestChatMessages, sessionRestored, isOnboarding]);

  // Auto-archival: clean up stale + old archived memories on session start
  const maintenanceRanRef = useRef(false);
  const sessionMaintenance = useMutation(api.memories.sessionMaintenance);
  useEffect(() => {
    if (maintenanceRanRef.current || !user?.id || !sessionRestored) return;
    maintenanceRanRef.current = true;
    sessionMaintenance({ clerkId: user.id }).catch(() => {
      // non-fatal background task
    });
  }, [user?.id, sessionRestored, sessionMaintenance]);

  // Debounced save — persist messages after every change
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!user?.id || !initialized || isOnboarding) return;
    if (displayMessages.length === 0) return;

    // Debounce: save 1s after the last change
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveChatMessages({
        clerkId: user.id,
        sessionId: sessionIdRef.current,
        displayMessages: displayMessages.map(m => ({
          id: m.id,
          role: m.role,
          content: m.content,
        })),
        llmMessages: messages.map(m => ({
          role: m.role,
          content: m.content,
        })),
      }).catch(() => {
        // Non-fatal — session save failure shouldn't break the chat
      });
    }, 1000);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [displayMessages, messages, user?.id, initialized, isOnboarding, saveChatMessages]);

  // Auto-scroll to bottom — but only if the user is already near the bottom.
  // Otherwise streaming chunks would yank the user away from a message
  // they're trying to read further up.
  useEffect(() => {
    const endEl = messagesEndRef.current;
    if (!endEl) return;

    // Walk up to find the nearest scrollable ancestor
    let scrollContainer: HTMLElement | null = endEl.parentElement;
    while (scrollContainer) {
      const overflowY = getComputedStyle(scrollContainer).overflowY;
      if (overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") break;
      scrollContainer = scrollContainer.parentElement;
    }

    if (!scrollContainer) {
      endEl.scrollIntoView({ behavior: "smooth" });
      return;
    }

    // If the user has scrolled up more than ~120px from the bottom, leave them alone
    const distanceFromBottom =
      scrollContainer.scrollHeight - scrollContainer.scrollTop - scrollContainer.clientHeight;
    if (distanceFromBottom > 120) return;

    scrollContainer.scrollTop = scrollContainer.scrollHeight;
  }, [displayMessages, isThinking, progressSteps]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        Math.min(textareaRef.current.scrollHeight, 160) + "px";
    }
  }, [input]);

  // LLM call
  // Non-streaming LLM call (used for init where we need the full response before displaying)
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

  // Streaming LLM call — streams tokens into a display message in real-time
  // Uses requestAnimationFrame batching to avoid excessive React re-renders
  const callLLMStreaming = useCallback(async (
    msgs: ChatMessage[],
    displayMessageId: string,
    onFirstToken?: () => void,
  ): Promise<string> => {
    const streamUrl = CHAT_PROXY_URL.replace("/chat", "/chat/stream");

    try {
      const res = await fetch(streamUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: msgs }),
        signal: AbortSignal.timeout(60_000), // 60s — fail faster than 90s
      });

      if (!res.ok || !res.body) {
        // Fall back to non-streaming (DON'T call onFirstToken — let caller handle)
        const fallback = await callLLM(msgs);
        return fallback;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";
      let buffer = "";
      let notifiedFirstToken = false;
      let rafPending = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        let textAdded = false;
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") continue;

          try {
            const parsed = JSON.parse(data);
            if (parsed.text) {
              if (!notifiedFirstToken) {
                notifiedFirstToken = true;
                onFirstToken?.();
              }
              fullText += parsed.text;
              textAdded = true;
            }
          } catch {
            // Unparseable SSE chunk — skip
          }
        }

        // Batch display updates via requestAnimationFrame to reduce React re-renders
        if (textAdded && !rafPending) {
          rafPending = true;
          const currentText = fullText;
          requestAnimationFrame(() => {
            rafPending = false;
            setDisplayMessages(prev => prev.map(m =>
              m.id === displayMessageId ? { ...m, content: currentText } : m
            ));
          });
        }
      }

      // Final update to ensure all text is displayed
      setDisplayMessages(prev => prev.map(m =>
        m.id === displayMessageId ? { ...m, content: fullText } : m
      ));

      return fullText || "";
    } catch {
      // Fall back to non-streaming on any error (DON'T call onFirstToken)
      const fallback = await callLLM(msgs);
      return fallback;
    }
  }, [callLLM]);

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
          source: "web-shell",
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
  // Extract links from profile/bundle for auto-scraping on init
  // ---------------------------------------------------------------------------
  function extractLinksFromProfile(
    youJson: Record<string, unknown> | null,
    profile: Record<string, unknown> | null
  ): DetectedSource[] {
    const sources: DetectedSource[] = [];
    const seen = new Set<string>();

    // Collect all link URLs from both youJson and profile
    const allUrls: string[] = [];

    if (youJson) {
      const links = youJson.links as Record<string, string> | undefined;
      if (links) {
        for (const url of Object.values(links)) {
          if (url) allUrls.push(url);
        }
      }
    }

    if (profile) {
      const links = profile.links as Record<string, string> | undefined;
      if (links) {
        for (const url of Object.values(links)) {
          if (url) allUrls.push(url);
        }
      }
    }

    // Parse each URL into a DetectedSource
    for (const url of allUrls) {
      const xMatch = url.match(/(?:x\.com|twitter\.com)\/([a-zA-Z0-9_]+)/i);
      if (xMatch && !seen.has(`x:${xMatch[1]}`)) {
        seen.add(`x:${xMatch[1]}`);
        sources.push({ platform: "x", url: `https://x.com/${xMatch[1]}`, username: xMatch[1] });
        continue;
      }
      const ghMatch = url.match(/github\.com\/([a-zA-Z0-9_-]+)/i);
      if (ghMatch && !["orgs", "topics", "settings"].includes(ghMatch[1].toLowerCase()) && !seen.has(`github:${ghMatch[1]}`)) {
        seen.add(`github:${ghMatch[1]}`);
        sources.push({ platform: "github", url: `https://github.com/${ghMatch[1]}`, username: ghMatch[1] });
        continue;
      }
      const liMatch = url.match(/linkedin\.com\/in\/([a-zA-Z0-9_-]+)/i);
      if (liMatch && !seen.has(`linkedin:${liMatch[1]}`)) {
        seen.add(`linkedin:${liMatch[1]}`);
        sources.push({ platform: "linkedin", url: `https://linkedin.com/in/${liMatch[1]}`, username: liMatch[1] });
        continue;
      }
    }

    return sources;
  }

  // Initialize conversation with context + auto-scrape existing links
  useEffect(() => {
    if (initialized || !convexUser) return;
    // Wait for session restore to complete before initializing a new conversation
    if (!isOnboarding && !sessionRestored) return;
    // For onboarding, we use a custom greeting prompt
    // For dashboard, we wait for latestBundle to be defined (can be null)
    if (!isOnboarding && latestBundle === undefined) return;

    // Build context from BOTH profiles table and bundles table
    const memoryContext = (recentMemories ?? []).map((m) => ({
      category: m.category,
      content: m.content,
      tags: m.tags,
    }));
    let profileContext = buildProfileContext(
      (latestBundle?.youJson as Record<string, unknown>) || null,
      memoryContext.length > 0 ? memoryContext : undefined
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
        if (bio.long) parts.push(`bio: ${bio.long}`);
        else if (bio.medium) parts.push(`bio: ${bio.medium}`);
        else if (bio.short) parts.push(`bio: ${bio.short}`);
      }
      const profileLinks = userProfile.links as Record<string, string> | undefined;
      if (profileLinks) {
        const linkEntries = Object.entries(profileLinks).filter(([, v]) => v);
        if (linkEntries.length > 0) {
          parts.push(`links: ${linkEntries.map(([k, v]) => `${k}: ${v}`).join(", ")}`);
        }
      }
      const profileNow = userProfile.now as string[] | undefined;
      if (profileNow && profileNow.length > 0) {
        parts.push(`current focus: ${profileNow.join(", ")}`);
      }
      const profileProjects = userProfile.projects as Array<Record<string, string>> | undefined;
      if (profileProjects && profileProjects.length > 0) {
        parts.push(`projects: ${profileProjects.map((p) => `${p.name} (${p.status || "active"})${p.description ? ` — ${p.description}` : ""}`).join("; ")}`);
      }
      if (userProfile.avatarUrl) parts.push(`has profile image from social media`);
      if (parts.length > 1) profileContext = parts.join("\n");
    }

    // Merge identity context INTO the system prompt so it's baked into every turn.
    // This makes the agent consistently personal — identity isn't just a user message
    // the LLM might deprioritize; it's core instructions.
    const systemMessage: ChatMessage = {
      role: "system",
      content: `${SYSTEM_PROMPT}\n\n--- THIS USER'S IDENTITY CONTEXT ---\n\n${profileContext}`,
    };

    const username = convexUser?.username || "";
    const displayName = userProfile?.name || convexUser?.displayName || "";

    const hasSubstantialProfile = profileContext !== "the user has no existing profile data yet." &&
      profileContext.split("\n").length > 3;

    // Inject portrait/image context so the agent knows what images are available
    const socialImgs = (userProfile as Record<string, unknown> | null)?.socialImages as Record<string, string> | undefined;
    const currentAvatar = (userProfile as Record<string, unknown> | null)?.avatarUrl as string | undefined;
    const primaryImg = (userProfile as Record<string, unknown> | null)?.primaryImage as string | undefined;

    let portraitContext = "";
    if (currentAvatar || socialImgs) {
      const parts = ["\n--- portrait context ---"];
      if (currentAvatar) parts.push(`current portrait url: ${currentAvatar}`);
      if (primaryImg) parts.push(`primary source: ${primaryImg}`);
      if (socialImgs) {
        const entries = Object.entries(socialImgs).filter(([, v]) => v);
        if (entries.length > 0) {
          parts.push("available images from scraped sources:");
          for (const [platform, url] of entries) {
            parts.push(`  ${platform}: ${url}`);
          }
        }
      }
      parts.push("you can show these images inline using ![alt](url) format and update the portrait using portrait_update JSON blocks.");
      portraitContext = parts.join("\n");
    }

    // Determine if this is a returning user (has existing profile data)
    const isReturning = hasSubstantialProfile;

    // --- Proactive Stale Source Detection ---
    // Check if any linked sources haven't been refreshed in >7 days
    let staleSourceNote = "";
    if (hasSubstantialProfile) {
      const youJson = (latestBundle?.youJson as Record<string, unknown>) || null;
      const meta = youJson?.meta as Record<string, unknown> | undefined;
      const sourcesUsed = meta?.sources_used as Record<string, string | number> | undefined;
      const lastUpdated = meta?.last_updated as string | number | undefined;
      const now = Date.now();
      const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
      const staleSources: string[] = [];

      if (sourcesUsed) {
        for (const [source, timestamp] of Object.entries(sourcesUsed)) {
          const ts = typeof timestamp === "string" ? new Date(timestamp).getTime() : Number(timestamp);
          if (!isNaN(ts) && ts > 0 && now - ts > SEVEN_DAYS_MS) {
            const daysAgo = Math.floor((now - ts) / (24 * 60 * 60 * 1000));
            staleSources.push(`${source} last synced ${daysAgo} days ago`);
          }
        }
      } else if (lastUpdated) {
        // Fallback: check the global last_updated timestamp
        const ts = typeof lastUpdated === "string" ? new Date(lastUpdated).getTime() : Number(lastUpdated);
        if (!isNaN(ts) && ts > 0 && now - ts > SEVEN_DAYS_MS) {
          const daysAgo = Math.floor((now - ts) / (24 * 60 * 60 * 1000));
          staleSources.push(`profile last updated ${daysAgo} days ago`);
        }
      }

      if (staleSources.length > 0) {
        staleSourceNote = `\n\n[STALE SOURCES DETECTED: ${staleSources.join(", ")}. suggest the user re-scrape these.]`;
      }
    }

    // --- Proactive Empty/Thin Section Detection ---
    // Scan the bundle for empty or thin sections the agent should offer to fill.
    // This drives the proactive context-fill behavior described in the system prompt.
    let emptySectionNote = "";
    if (hasSubstantialProfile) {
      const youJson = (latestBundle?.youJson as Record<string, unknown>) || null;
      const gaps: string[] = [];

      // 1) profile/projects.md lists projects, but project subdirectories are missing
      const publicProjects = (youJson?.projects as Array<Record<string, string>> | undefined) || [];
      const projectSubdirs = (youJson?.project_subdirs as Record<string, unknown> | undefined) || {};
      const projectSubdirsCount = Object.keys(projectSubdirs).length;
      if (publicProjects.length > 0 && projectSubdirsCount < publicProjects.length) {
        gaps.push(
          `projects/ subdirectories are empty or incomplete (profile lists ${publicProjects.length} project${publicProjects.length === 1 ? "" : "s"}, but only ${projectSubdirsCount} subdirector${projectSubdirsCount === 1 ? "y exists" : "ies exist"})`
        );
      }

      // 2) profile/about.md is sparse (under 100 chars)
      const identity = youJson?.identity as Record<string, unknown> | undefined;
      const bio = identity?.bio as Record<string, string> | undefined;
      const aboutLen = (bio?.long || bio?.medium || bio?.short || "").length;
      if (aboutLen > 0 && aboutLen < 100) {
        gaps.push(`profile/about.md is sparse (~${aboutLen} chars, typical 300+)`);
      } else if (aboutLen === 0) {
        gaps.push("profile/about.md is empty");
      }

      // 3) preferences/agent.md is empty
      const prefs = youJson?.preferences as Record<string, Record<string, unknown>> | undefined;
      const agentTone = (prefs?.agent?.tone as string) || "";
      const agentAvoid = (prefs?.agent?.avoid as string[]) || [];
      if (!agentTone && agentAvoid.length === 0) {
        gaps.push("preferences/agent.md is empty (no tone or avoid rules set)");
      }

      // 4) voice/voice.md has no content
      const voice = youJson?.voice as Record<string, unknown> | undefined;
      const voiceOverall = (voice?.overall as string) || "";
      if (voiceOverall.length < 100) {
        gaps.push(
          voiceOverall.length === 0
            ? "voice/voice.md is empty"
            : `voice profile is thin (~${voiceOverall.length} chars vs typical 300+)`
        );
      }

      // 5) sources/ has no entries
      const meta = youJson?.meta as Record<string, unknown> | undefined;
      const sourcesUsed = (meta?.sources_used as Record<string, unknown> | undefined) || {};
      if (Object.keys(sourcesUsed).length === 0) {
        gaps.push("sources/ has no entries");
      }

      // 6) directives/agent.md is empty
      const dirs = youJson?.agent_directives as Record<string, unknown> | undefined;
      const hasDirectives =
        (dirs?.communication_style as string)?.length ||
        (Array.isArray(dirs?.negative_prompts) && (dirs?.negative_prompts as unknown[]).length > 0) ||
        (dirs?.default_stack as string)?.length ||
        (dirs?.decision_framework as string)?.length ||
        (dirs?.current_goal as string)?.length;
      if (!hasDirectives) {
        gaps.push("directives/agent.md is empty (no agent directives set)");
      }

      // 7) memory has fewer than 5 items
      const memCount = recentMemories?.length ?? 0;
      if (memCount < 5) {
        gaps.push(`memory has only ${memCount} item${memCount === 1 ? "" : "s"} (typical 5+)`);
      }

      if (gaps.length > 0) {
        emptySectionNote = `\n\n[EMPTY/THIN SECTIONS DETECTED — proactively mention ONE of these in your greeting and offer to fill it. don't list everything, pick the most impactful gap. always offer YES/SKIP/ASK_LATER. gaps:\n- ${gaps.join("\n- ")}\n]`;
      }
    }

    const contextContent = isOnboarding && onboardingGreeting
      ? onboardingGreeting
      : hasSubstantialProfile
        ? `${profileContext}${portraitContext}${staleSourceNote}${emptySectionNote}\n\nthe user @${username}${displayName ? ` (${displayName})` : ""} just opened the web chat. write a short greeting (2-3 sentences MAX). do three things: (1) greet them by name, (2) reference ONE specific recent thing from their profile data above (a project, a value, a bio detail), (3) IF empty/thin sections were detected above, mention the most impactful one and offer to fill it. don't make this a wall of text. example: "hey houston. saw you pushed v49 yesterday. one thing — your projects/ dir is empty even though your profile lists 6 projects. want me to scaffold them out?"`
        : `${profileContext}${portraitContext}\n\nthe user @${username}${displayName ? ` (${displayName})` : ""} just opened the web chat. greet them${displayName ? ` by name (${displayName})` : ""}. their profile is sparse — proactively suggest building it out. ask for their x, github, or linkedin handle so you can pull real context. mention that the platform will auto-scrape their profiles.`;

    const contextMessage: ChatMessage = {
      role: "user",
      content: contextContent,
    };

    setInitialized(true);
    setIsThinking(true);
    clearSteps();
    setThinkingPhrase(randomThinking("identity"));
    setThinkingCategory("identity");

    // --- Auto-scrape existing links on init (for returning users) ---
    const existingYouJson = (latestBundle?.youJson as Record<string, unknown>) || null;
    const existingLinks = extractLinksFromProfile(
      existingYouJson,
      userProfile as Record<string, unknown> | null
    );
    // Only auto-scrape if user has links but profile is sparse (thin bundle)
    const bundleSections = existingYouJson
      ? Object.keys(existingYouJson).filter((k) => {
          const val = (existingYouJson as Record<string, unknown>)[k];
          if (typeof val === "string") return val.length > 20;
          if (Array.isArray(val)) return val.length > 0;
          if (typeof val === "object" && val !== null) return Object.keys(val).length > 0;
          return false;
        }).length
      : 0;
    const shouldAutoScrape = existingLinks.length > 0 && bundleSections < 4;
    const shouldAutoResearch = !isReturning && displayName;

    async function initConversation() {
      let allMessages: ChatMessage[] = [systemMessage, contextMessage];

      try {
        // Auto-scrape existing links for sparse profiles
        if (shouldAutoScrape) {
          setThinkingPhrase(randomThinking("sync"));
          setThinkingCategory("sync");

          // Add progress steps for each source (activity shown via ThinkingIndicator at bottom)
          const initScrapeStepIds = existingLinks.map((s) => {
            const sourceLabel = s.username ? `${s.platform}/${s.username}` : s.url;
            return addStep(`fetching ${sourceLabel}`);
          });

          const scrapeResults = await Promise.all(
            existingLinks.map((s, i) =>
              scrapeSource(s).then((result) => {
                completeStep(initScrapeStepIds[i], result ? "data received" : "no data");
                return result;
              }).catch(() => {
                failStep(initScrapeStepIds[i], "failed");
                return "";
              })
            )
          );

          // Mark as scraped so sendMessage won't re-scrape
          for (const s of existingLinks) {
            scrapedSourcesRef.current.add(`${s.platform}:${s.username || s.url}`);
          }

          // Save profile images from scrape results
          if (userProfile?._id && user?.id) {
            // Prefer LinkedIn > GitHub > X for profile images
            const platformPriority = ["linkedin", "github", "x"];
            let bestImage: string | null = null;
            let bestPriority = platformPriority.length;
            for (let i = 0; i < existingLinks.length; i++) {
              const imgMatch = scrapeResults[i]?.match(/profile_image: (https?:\/\/[^\s]+)/);
              if (imgMatch?.[1]) {
                const idx = platformPriority.indexOf(existingLinks[i].platform);
                if (idx >= 0 && idx < bestPriority) {
                  bestImage = imgMatch[1];
                  bestPriority = idx;
                }
              }
            }
            if (bestImage && !userProfile.avatarUrl) {
              try {
                await updateProfile({
                  profileId: userProfile._id,
                  clerkId: user.id,
                  avatarUrl: bestImage,
                });
              } catch { /* non-fatal */ }
            }
          }

          const scrapeContext = scrapeResults.filter(Boolean).join("\n\n");
          if (scrapeContext) {
            allMessages.push({
              role: "user",
              content: `[PLATFORM AUTO-SCRAPE ON SESSION START — the following data was scraped from the user's existing linked profiles. use this REAL data to make specific, personal observations in your greeting. reference actual names, titles, numbers, and details.]\n\n${scrapeContext}`,
            });
          }

          setThinkingPhrase(randomThinking("analysis"));
          setThinkingCategory("analysis");
        }

        // Auto-research for sparse profiles (Perplexity web search)
        if (shouldAutoResearch) {
          const researchStepId = addStep("researching web context", displayName);
          const allLinks = existingLinks.map((s) => s.url);
          try {
            const researchResult = await researchUser(
              displayName,
              convexUser?.username,
              allLinks.length > 0 ? allLinks : undefined
            );
            if (researchResult) {
              allMessages.push({
                role: "user",
                content: `[PLATFORM AUTO-RESEARCH — web research about this user. use any relevant findings to personalize your greeting.]\n\n${researchResult}`,
              });
              completeStep(researchStepId, "context found");
            } else {
              completeStep(researchStepId, "no results");
            }
          } catch {
            failStep(researchStepId, "failed");
          }
        }

        setMessages(allMessages);

        const initLlmStepId = addStep("generating greeting");
        const response = await callLLM(allMessages);
        completeStep(initLlmStepId);
        const { display, updates } = parseUpdatesFromResponse(response);

        const assistantMsg: ChatMessage = {
          role: "assistant",
          content: response,
        };

        setMessages((prev) => [...prev, assistantMsg]);

        const newDisplay: DisplayMessage[] = [];

        if (shouldAutoScrape) {
          newDisplay.push({
            id: crypto.randomUUID(),
            role: "system-notice",
            content: `[scraped ${existingLinks.length} source${existingLinks.length > 1 ? "s" : ""} from your profile]`,
          });
        }

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

        setDisplayMessages((prev) => [...prev, ...newDisplay]);
        setIsThinking(false);
        setTimeout(() => clearSteps(), 1500);
      } catch (err) {
        setDisplayMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: `hmm, something went wrong connecting to the agent. ${err instanceof Error ? err.message : "try again in a moment."}`,
          },
        ]);
        setIsThinking(false);
      }
    }

    initConversation();
  }, [initialized, sessionRestored, convexUser, latestBundle, isOnboarding, onboardingGreeting, callLLM, saveUpdates, userProfile, user?.id, updateProfile, recentMemories, addStep, completeStep, failStep, clearSteps]);

  // Slash commands
  const handleSlashCommand = useCallback(
    (cmd: string): boolean => {
      const trimmed = cmd.trim().toLowerCase();

      // Pane-switching commands
      // Note: /publish and /help are handled separately below with special logic
      const paneCommands: Record<string, RightPane> = {
        "/preview": "profile",
        "/profile": "profile",
        "/portrait": "portrait",
        "/settings": "settings",
        "/billing": "settings",
        "/tokens": "settings",
        "/activity": "settings",
        "/json": "edit",
        "/sources": "edit",
        "/files": "edit",
        "/vault": "edit",
        "/edit": "edit",
        "/agents": "agents",
        "/skills": "skills",
      };

      if (paneCommands[trimmed] && onPaneSwitch) {
        onPaneSwitch(paneCommands[trimmed]);

        // Custom message for /skills
        const noticeContent = trimmed === "/skills"
          ? "[switched to skills]\n\nidentity-aware agent skills — markdown templates with {{identity}} variables.\ninstall via CLI: `youmd skill install all`\nscaffold a project: `youmd skill init-project`"
          : `[switched to ${paneCommands[trimmed]}]`;

        setDisplayMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), role: "user", content: trimmed },
          {
            id: crypto.randomUUID(),
            role: "system-notice",
            content: noticeContent,
          },
        ]);
        return true;
      }

      // /portrait --regenerate — scrape social profiles and update avatar
      if (trimmed.startsWith("/portrait ") && (trimmed.includes("--regenerate") || trimmed.includes("--regen"))) {
        const username = convexUser?.username || "";
        setDisplayMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), role: "user", content: trimmed },
          { id: crypto.randomUUID(), role: "system-notice", content: "[scraping social profiles for portrait...]" },
        ]);

        // Try X first, then GitHub
        const tryPlatforms = async () => {
          for (const platform of ["x", "github"]) {
            const url = platform === "x" ? `https://x.com/${username}` : `https://github.com/${username}`;
            try {
              const res = await fetch(`${CONVEX_SITE_URL}/api/v1/scrape`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url }),
              });
              if (res.ok) {
                const data = await res.json();
                const imgUrl = data?.data?.profileImageUrl || data?.profileImageUrl;
                if (imgUrl && user?.id && userProfile?._id) {
                  // Save to profile
                  await updateProfile({
                    profileId: userProfile._id,
                    clerkId: user.id,
                    avatarUrl: imgUrl,
                  });
                  setDisplayMessages((prev) => [
                    ...prev,
                    { id: crypto.randomUUID(), role: "system-notice", content: `[portrait updated from ${platform}]` },
                    { id: crypto.randomUUID(), role: "assistant", content: `![your new portrait from ${platform}](${imgUrl})` },
                  ]);
                  return;
                }
              }
            } catch {
              // try next platform
            }
          }
          setDisplayMessages((prev) => [
            ...prev,
            { id: crypto.randomUUID(), role: "system-notice", content: "[could not fetch portrait — check your connected social links]" },
          ]);
        };

        tryPlatforms();
        if (onPaneSwitch) onPaneSwitch("profile");
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
          onPaneSwitch("settings");
        }
        const helpText = onPaneSwitch
          ? "available commands:\n/share -- create a shareable identity link (copied to clipboard)\n/share --private -- include private context\n/share --project {name} -- share context scoped to a project\n/profile -- your identity profile\n/portrait -- ascii portrait editor + format picker\n/portrait --regenerate -- regenerate ascii portrait from sources\n/edit -- edit your identity context (files, json, sources)\n/skills -- identity-aware agent skills\n/publish -- publish your latest bundle\n/settings -- account, api keys, billing\n/memory -- memory summary + stats\n/recall -- show recent memories\n/recall {query} -- search memories\n/status -- bundle status\n/help -- show this reference"
          : "available commands:\n/share -- create a shareable identity link\n/share --private -- include private context\n/share --project {name} -- share context scoped to a project\n/memory -- memory summary\n/recall -- show recent memories\n/status -- show bundle status\n/publish -- publish your latest bundle\n/done -- finish onboarding\n/help -- show this message";

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
          onPaneSwitch("share");
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
        if (onPaneSwitch) onPaneSwitch("share");
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

      // /memory — show memory summary
      if (trimmed === "/memory" || trimmed === "/memories") {
        if (onPaneSwitch) onPaneSwitch("edit");
        const mems = recentMemories ?? [];
        const grouped = new Map<string, number>();
        for (const m of mems) grouped.set(m.category, (grouped.get(m.category) || 0) + 1);
        const summary = mems.length === 0
          ? "no memories yet. keep chatting — the agent saves important context automatically."
          : `memory: ${mems.length} total\n${Array.from(grouped.entries()).map(([c, n]) => `  ${c}s: ${n}`).join("\n")}`;
        setDisplayMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), role: "user", content: trimmed },
          { id: crypto.randomUUID(), role: "system-notice", content: summary },
        ]);
        return true;
      }

      // /recall [query] — search or list recent memories
      if (trimmed === "/recall" || trimmed.startsWith("/recall ")) {
        const query = trimmed.startsWith("/recall ") ? trimmed.slice(8).trim().toLowerCase() : "";
        const mems = recentMemories ?? [];
        const matches = query
          ? mems.filter((m) => m.content.toLowerCase().includes(query) || m.category.includes(query) || m.tags?.some((t) => t.toLowerCase().includes(query)))
          : mems.slice(0, 10);
        const header = query ? `${matches.length} memories matching "${query}"` : "recent memories";
        const body = matches.length === 0
          ? (query ? `no memories matching "${query}"` : "no memories yet.")
          : `${header}:\n${matches.slice(0, 10).map((m) => `  [${m.category}] ${m.content}`).join("\n")}`;
        setDisplayMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), role: "user", content: trimmed },
          { id: crypto.randomUUID(), role: "system-notice", content: body },
        ]);
        return true;
      }

      return false;
    },
    [latestBundle, convexUser, user?.id, publishLatest, createContextLink, onPaneSwitch, onDone, privateContext, recentMemories]
  );

  // Track scraped sources to avoid re-scraping
  const scrapedSourcesRef = useRef<Set<string>>(new Set());

  // Send message
  const sendMessage = useCallback(async (pastedImageUrl?: string) => {
    const trimmed = input.trim();
    if (!trimmed && !pastedImageUrl) return;
    if (isThinking) return;

    setInput("");

    // Handle slash commands (no image for slash commands)
    if (trimmed.startsWith("/")) {
      if (handleSlashCommand(trimmed)) return;
    }

    // Build the user message content — include pasted image if present
    let userContent = trimmed;
    if (pastedImageUrl) {
      userContent = trimmed
        ? `${trimmed}\n\n![pasted image](${pastedImageUrl})`
        : `![pasted image](${pastedImageUrl})`;
    }

    // Add user message to display (show image inline via TerminalBlocks)
    setDisplayMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: "user", content: userContent },
    ]);

    // Detect URLs/usernames in the message for auto-scraping
    const detectedSources = detectSourcesInMessage(trimmed);
    const newSources = detectedSources.filter(
      (s) => !scrapedSourcesRef.current.has(`${s.platform}:${s.username || s.url}`)
    );

    // Add to conversation history
    const userMsg: ChatMessage = { role: "user", content: trimmed };
    let updatedMessages = [...messagesRef.current, userMsg];
    setMessages(updatedMessages);

    // Start thinking with progress steps
    setIsThinking(true);
    clearSteps();
    const cat: ThinkingCategory = newSources.length > 0 ? "discovery" : "analysis";
    setThinkingPhrase(randomThinking(cat));
    setThinkingCategory(cat);

    try {
      // ─── PHASE 1: FAST ACK ───────────────────────────────────
      // Quick Haiku call (~1-2s) to acknowledge the user's message
      // and show what we'll do next. Makes the chat feel responsive.
      const ackMsgId = crypto.randomUUID();
      try {
        const existingYouJson = (latestBundle?.youJson as Record<string, unknown>) || null;
        const userName = (existingYouJson?.identity as Record<string, unknown>)?.name as string ||
          userProfile?.name || convexUser?.displayName || "";
        const contextHint = userName ? `user: ${userName}` : "";

        const ackRes = await fetch(CHAT_ACK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: trimmed, context: contextHint }),
          signal: AbortSignal.timeout(5_000),
        });

        if (ackRes.ok) {
          const ackData = await ackRes.json();
          const ackText = ackData.ack || "";

          if (ackText) {
            // Show the fast ack as an assistant message immediately
            // The ACK is the plan — no need for separate activity log steps
            setDisplayMessages((prev) => [
              ...prev,
              { id: ackMsgId, role: "assistant", content: ackText },
            ]);
            // Use ACK as the thinking phrase (replaces random rotation)
            setThinkingPhrase(ackText);
          }
        }
      } catch {
        // ACK failed — non-fatal, continue with full response
      }

      // ─── PHASE 2: SCRAPE + RESEARCH ──────────────────────────
      // If we detected new sources, scrape them FIRST and inject results
      if (newSources.length > 0) {
        // Add progress steps for each source (activity shown via ThinkingIndicator at bottom)
        const scrapeStepIds = newSources.map((s) => {
          const sourceLabel = s.username ? `${s.platform}/${s.username}` : s.url;
          return addStep(`fetching ${sourceLabel}`);
        });

        // Scrape all sources in parallel, completing steps as they finish
        const scrapeResults = await Promise.all(
          newSources.map((s, i) =>
            scrapeSource(s).then((result) => {
              completeStep(scrapeStepIds[i], result ? "data received" : "no data");
              // Rotate thinking phrase as each source completes
              setThinkingPhrase(randomThinking("discovery"));
              return result;
            }).catch(() => {
              failStep(scrapeStepIds[i], "failed");
              return "";
            })
          )
        );

        // Mark sources as scraped
        for (const s of newSources) {
          scrapedSourcesRef.current.add(`${s.platform}:${s.username || s.url}`);
        }

        // Extract ALL profile images from every scraped source
        if (userProfile?._id && user?.id) {
          const imgStepId = addStep("extracting profile images");
          const platformPriority = ["linkedin", "github", "x"];
          const collectedImages: Record<string, string> = {};
          let bestPlatform = "";
          let bestPriority = platformPriority.length;

          for (let i = 0; i < newSources.length; i++) {
            const imgMatch = scrapeResults[i]?.match(/profile_image: (https?:\/\/[^\s]+)/);
            if (imgMatch?.[1]) {
              const platform = newSources[i].platform;
              collectedImages[platform] = imgMatch[1];
              const idx = platformPriority.indexOf(platform);
              if (idx >= 0 && idx < bestPriority) {
                bestPlatform = platform;
                bestPriority = idx;
              }
            }
          }

          const imageCount = Object.keys(collectedImages).length;
          if (imageCount > 0) {
            try {
              // Merge with existing social images
              const existingSocial = (userProfile.socialImages as Record<string, string | undefined>) || {};
              const mergedImages = {
                x: collectedImages.x || existingSocial.x,
                github: collectedImages.github || existingSocial.github,
                linkedin: collectedImages.linkedin || existingSocial.linkedin,
                custom: existingSocial.custom,
              };
              const primary = bestPlatform || userProfile.primaryImage as string || "github";

              await setProfileImages({
                profileId: userProfile._id,
                clerkId: user.id,
                socialImages: mergedImages,
                primaryImage: primary,
              });
              completeStep(imgStepId, `${imageCount} image${imageCount > 1 ? "s" : ""} saved`);
            } catch {
              failStep(imgStepId, "failed to save");
            }
          } else {
            completeStep(imgStepId, "none found");
          }
        }

        // Run identity verification if we have multiple sources
        const scrapedSourcesForVerify = newSources.map((s, i) => {
          const result = scrapeResults[i] || "";
          const bioMatch = result.match(/bio: (.+)/);
          const companyMatch = result.match(/company: (.+)/);
          const locationMatch = result.match(/location: (.+)/);
          return {
            platform: s.platform,
            username: s.username,
            bio: bioMatch?.[1]?.slice(0, 100),
            company: companyMatch?.[1],
            location: locationMatch?.[1],
          };
        });

        // Run research + identity verification in parallel
        const existingYouJson = (latestBundle?.youJson as Record<string, unknown>) || null;
        const userName = (existingYouJson?.identity as Record<string, unknown>)?.name as string ||
          userProfile?.name || convexUser?.displayName || "";

        let researchResult = "";
        let verificationContext = "";

        if (userName && newSources.length > 0) {
          // Run both in parallel — research via Perplexity Sonar, verify via Sonar Pro
          const researchStepId = addStep("researching web context", userName);
          const verifyStepId = scrapedSourcesForVerify.length >= 2
            ? addStep("verifying identity across sources")
            : null;

          const allLinks = newSources.map((s) => s.url);

          const [researchRes, verifyRes] = await Promise.all([
            researchUser(userName, convexUser?.username, allLinks)
              .then((r) => { completeStep(researchStepId, r ? "context found" : "no results"); return r; })
              .catch(() => { failStep(researchStepId, "failed"); return ""; }),
            scrapedSourcesForVerify.length >= 2
              ? verifyIdentity(userName, convexUser?.username, scrapedSourcesForVerify)
                  .then((v) => { if (verifyStepId) completeStep(verifyStepId, v ? `${v.confidence}% match` : "skipped"); return v; })
                  .catch(() => { if (verifyStepId) failStep(verifyStepId, "failed"); return null; })
              : Promise.resolve(null),
          ]);

          researchResult = researchRes;

          // Format verification result for the agent
          if (verifyRes) {
            const parts = [`[IDENTITY VERIFICATION — Perplexity Sonar Pro cross-reference]`];
            parts.push(`confidence: ${verifyRes.confidence}%`);
            parts.push(`match: ${verifyRes.match ? "yes — profiles belong to same person" : "uncertain — possible discrepancies"}`);
            if (verifyRes.signals?.length > 0) parts.push(`signals: ${verifyRes.signals.join("; ")}`);
            if (verifyRes.discrepancies?.length > 0) parts.push(`discrepancies: ${verifyRes.discrepancies.join("; ")}`);
            if (verifyRes.summary) parts.push(`summary: ${verifyRes.summary}`);
            verificationContext = parts.join("\n");
          }
        }

        // Inject scrape results + research + verification as system context
        const scrapeContext = scrapeResults.filter(Boolean).join("\n\n");
        const contextParts = [scrapeContext, researchResult, verificationContext].filter(Boolean);
        const fullContext = contextParts.join("\n\n");

        if (fullContext) {
          const contextMsg: ChatMessage = {
            role: "user",
            content: `[PLATFORM AUTO-SCRAPE — the following data was scraped from the user's linked profiles. use this REAL data to make specific, personal observations. reference actual names, titles, numbers, and details.]\n\n${fullContext}`,
          };
          updatedMessages = [...updatedMessages, contextMsg];
          setMessages((prev) => [...prev, contextMsg]);

          setThinkingPhrase(randomThinking("analysis"));
          setThinkingCategory("analysis");

          // Auto-save scrape results as source files (sources/linkedin.md, etc.)
          const sourceUpdates: SectionUpdate[] = [];
          for (let i = 0; i < newSources.length; i++) {
            const result = scrapeResults[i];
            if (result && result.length > 50) {
              const platform = newSources[i].platform;
              const slug = `sources/${platform}`;
              // Format as markdown with frontmatter
              const md = `---\ntitle: "${platform} profile"\nscraped_at: "${new Date().toISOString()}"\nplatform: "${platform}"\n---\n\n${result}`;
              sourceUpdates.push({ section: slug, content: md });
            }
          }
          if (sourceUpdates.length > 0 && user?.id) {
            const saveSourceStepId = addStep("saving source profiles");
            try {
              await saveUpdates(sourceUpdates);
              completeStep(saveSourceStepId, `${sourceUpdates.length} source${sourceUpdates.length > 1 ? "s" : ""} saved`);
            } catch {
              failStep(saveSourceStepId, "save failed");
            }
          }
        }
      }

      // Transition to identity/analysis phase
      if (newSources.length > 0) {
        setThinkingPhrase(randomThinking("identity"));
        setThinkingCategory("identity");
      }

      // ─── PHASE 3: FULL RESPONSE (streaming) ────────────────
      // No step added here — the thinking indicator is sufficient.
      // Real steps (scraping, researching) already show in the activity log.
      const llmStepId = "";

      // NEVER replace the ack — always stream into a NEW message below it
      const streamMsgId = crypto.randomUUID();
      let firstTokenReceived = false;

      // Keep thinking/progress visible until first token arrives
      const onFirstToken = () => {
        if (!firstTokenReceived) {
          firstTokenReceived = true;
          if (llmStepId) completeStep(llmStepId);
          setIsThinking(false);
          // Add a new message for the full response (ack stays above)
          setDisplayMessages(prev => [...prev, {
            id: streamMsgId,
            role: "assistant" as const,
            content: "",
          }]);
        }
      };

      // Stream response — thinking stays visible until first token
      const response = await callLLMStreaming(updatedMessages, streamMsgId, onFirstToken);

      // If no tokens came through (fallback path), clean up and show response
      if (!firstTokenReceived) {
        completeStep(llmStepId);
        setIsThinking(false);
        clearSteps();
        // Add full response as new message (ack stays above)
        setDisplayMessages(prev => [...prev, {
          id: streamMsgId,
          role: "assistant" as const,
          content: response,
        }]);
      }

      // Strip JSON blocks from the streamed display (they stream in raw during typing)
      const { display, updates } = parseUpdatesFromResponse(response);

      // Clean display text: strip JSON blocks + collapse excessive blank lines
      const cleanDisplay = display
        .replace(/\n{3,}/g, "\n\n")  // collapse 3+ newlines to 2
        .replace(/^\n+/, "")          // strip leading blank lines
        .replace(/\n+$/, "")          // strip trailing blank lines
        .trim();

      setDisplayMessages(prev => prev.map(m =>
        m.id === streamMsgId ? { ...m, content: cleanDisplay } : m
      ));

      const assistantMsg: ChatMessage = {
        role: "assistant",
        content: response,
      };
      setMessages((prev) => [...prev, assistantMsg]);

      const newDisplayMsgs: DisplayMessage[] = [];

      // NOTE: The assistant's response message was already added during streaming
      // (at streamMsgId). Do NOT add a duplicate here. Only add system notices
      // for updates, memories, etc.

      if (updates.length > 0) {
        const sectionNames = updates
          .map((u) => sectionLabel(u.section))
          .join(", ");
        newDisplayMsgs.push({
          id: crypto.randomUUID(),
          role: "system-notice",
          content: `[updated: ${sectionNames}]`,
        });

        const saveStepId = addStep("saving profile updates", sectionNames);
        const result = await saveUpdates(updates);
        if (result) {
          completeStep(saveStepId, `v${result.version}`);
          newDisplayMsgs.push({
            id: crypto.randomUUID(),
            role: "system-notice",
            content: `[saved as v${result.version}]`,
          });

          // Auto-publish after saving
          if (user?.id) {
            const pubStepId = addStep("publishing changes");
            try {
              await publishLatest({ clerkId: user.id });
              completeStep(pubStepId);
              newDisplayMsgs.push({
                id: crypto.randomUUID(),
                role: "system-notice",
                content: `[published]`,
              });
            } catch {
              failStep(pubStepId, "failed");
            }
          }
        } else {
          failStep(saveStepId, "no changes");
        }
      }

      // Handle private updates from agent
      const privUpdates = parsePrivateUpdatesFromResponse(response);
      if (privUpdates.length > 0 && user?.id && userProfile?._id) {
        const privStepId = addStep("saving private context");
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
        completeStep(privStepId);
      }

      // Handle memory saves from agent
      const memorySaves = parseMemorySavesFromResponse(response);
      if (memorySaves.length > 0 && user?.id) {
        const memStepId = addStep("saving memories", `${memorySaves.length} ${memorySaves.length === 1 ? "memory" : "memories"}`);
        try {
          await saveMemories({
            clerkId: user.id,
            memories: memorySaves.map((ms) => ({
              category: ms.category,
              content: ms.content,
              source: "you-agent",
              tags: ms.tags,
              sessionId: sessionIdRef.current,
            })),
          });
          completeStep(memStepId);
          newDisplayMsgs.push({
            id: crypto.randomUUID(),
            role: "system-notice",
            content: `[saved ${memorySaves.length} ${memorySaves.length === 1 ? "memory" : "memories"}]`,
          });
        } catch {
          failStep(memStepId, "failed");
        }
      }

      // Handle portrait updates from agent
      const portraitUpdate = parsePortraitUpdateFromResponse(response);
      if (portraitUpdate && user?.id && userProfile?._id) {
        const portraitStepId = addStep("updating portrait", portraitUpdate.source);
        try {
          await updateProfile({
            profileId: userProfile._id,
            clerkId: user.id,
            avatarUrl: portraitUpdate.url,
          });
          completeStep(portraitStepId);
          newDisplayMsgs.push({
            id: crypto.randomUUID(),
            role: "system-notice",
            content: `[portrait updated from ${portraitUpdate.source}]`,
          });
          // Show the new portrait inline in the chat
          newDisplayMsgs.push({
            id: crypto.randomUUID(),
            role: "assistant",
            content: `![updated portrait from ${portraitUpdate.source}](${portraitUpdate.url})`,
          });
        } catch {
          failStep(portraitStepId, "failed");
        }
      }

      // Handle custom sections from agent
      const customSections = parseCustomSectionsFromResponse(response);
      if (customSections.length > 0 && user?.id && userProfile?._id) {
        const csStepId = addStep("saving custom sections", `${customSections.length} section${customSections.length > 1 ? "s" : ""}`);
        try {
          // Merge with existing custom sections on the profile
          const existingCustom = ((userProfile as Record<string, unknown>)?.youJson as Record<string, unknown>)?.custom_sections as CustomSection[] || [];
          const merged = [...existingCustom];
          for (const cs of customSections) {
            const idx = merged.findIndex(e => e.id === cs.id);
            if (idx >= 0) {
              merged[idx] = cs; // update existing
            } else {
              merged.push(cs); // add new
            }
          }
          // Save via the profile update (youJson field)
          await updateProfile({
            profileId: userProfile._id,
            clerkId: user.id,
            youJson: {
              ...((userProfile as Record<string, unknown>)?.youJson as Record<string, unknown> || {}),
              custom_sections: merged,
            },
          });
          completeStep(csStepId);
          const titles = customSections.map(cs => cs.title).join(", ");
          newDisplayMsgs.push({
            id: crypto.randomUUID(),
            role: "system-notice",
            content: `[added custom section${customSections.length > 1 ? "s" : ""}: ${titles}]`,
          });
        } catch {
          failStep(csStepId, "failed");
        }
      }

      // --- Context Compaction (Claude Code-style) ---
      // After 15+ turns, summarize older messages + extract durable facts into memory.
      // Turn-based trigger (more predictable than char-based).
      const COMPACTION_TURN_THRESHOLD = 15;
      const currentMessages = messagesRef.current;
      const turnCount = currentMessages.filter((m) => m.role === "user").length;

      if (turnCount >= COMPACTION_TURN_THRESHOLD && currentMessages.length > 10) {
        try {
          const result = await compactSession({
            sessionId: sessionIdRef.current,
            messages: currentMessages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
            keepRecent: 8,
          });

          if (result.compacted && result.messages) {
            setMessages(result.messages as ChatMessage[]);
            messagesRef.current = result.messages as ChatMessage[];

            // Save extracted memories
            if (result.extractedMemories?.length && user?.id) {
              try {
                await saveMemories({
                  clerkId: user.id,
                  memories: result.extractedMemories.map((m: { category: string; content: string; tags?: string[] }) => ({
                    category: m.category,
                    content: m.content,
                    source: "compaction",
                    tags: m.tags,
                    sessionId: sessionIdRef.current,
                  })),
                });
              } catch {
                // Non-fatal: memory save failed
              }
            }

            // Show compaction notice
            newDisplayMsgs.push({
              id: crypto.randomUUID(),
              role: "system-notice",
              content: `[context compacted -- ${result.stats?.messagesRemoved} turns summarized${result.stats?.memoriesExtracted ? `, ${result.stats.memoriesExtracted} memories saved` : ""}]`,
            });
          }
        } catch {
          // Non-fatal — compaction failure shouldn't break the chat
        }
      }

      // Track session
      messageCountRef.current += 2; // user + assistant
      if (user?.id) {
        try {
          let summary: string | undefined;
          const shouldSummarize = messageCountRef.current % 10 === 0 && messageCountRef.current >= 10 && messageCountRef.current !== lastSummarizedAtRef.current;
          if (shouldSummarize) {
            lastSummarizedAtRef.current = messageCountRef.current;
            try {
              const summaryResult = await summarizeSession({
                sessionId: sessionIdRef.current,
                messages: messagesRef.current.map((m) => ({
                  role: m.role,
                  content: m.content,
                })),
              });
              summary = summaryResult.summary ?? undefined;
            } catch {
              // Non-fatal
            }
          }

          await upsertSession({
            clerkId: user.id,
            sessionId: sessionIdRef.current,
            surface: "web",
            messageCount: messageCountRef.current,
            summary,
          });
        } catch {
          // Non-fatal
        }
      }

      // Append system notices (updates, memories, etc.) — NOT the assistant message (already streamed)
      if (newDisplayMsgs.length > 0) {
        setDisplayMessages((prev) => [...prev, ...newDisplayMsgs]);
      }
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

    // Ensure thinking is always cleared (idempotent)
    setIsThinking(false);
    clearSteps();
    textareaRef.current?.focus();
  }, [input, isThinking, handleSlashCommand, callLLM, saveUpdates, user?.id, userProfile?._id, privateContext, updatePrivateContext, latestBundle, userProfile, convexUser, publishLatest, updateProfile, setProfileImages, saveMemories, upsertSession, summarizeSession, addStep, completeStep, failStep, clearSteps]);

  return {
    // State
    displayMessages,
    input,
    setInput,
    isThinking,
    thinkingPhrase,
    thinkingCategory,
    progressSteps,
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
