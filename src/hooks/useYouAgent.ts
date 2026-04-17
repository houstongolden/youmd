"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useUser } from "@/lib/you-auth";
import { useQuery, useMutation, useAction, useConvexAuth } from "convex/react";
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
  buildProjectDirectoryScaffold,
  isProjectDirectoryScaffoldRequest,
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
  const { isAuthenticated } = useConvexAuth();
  const convexUser = useQuery(
    api.users.getByClerkId,
    isAuthenticated && user?.id ? { clerkId: user.id } : "skip"
  );
  const latestBundle = useQuery(
    api.bundles.getLatestBundle,
    user?.id && convexUser?._id ? { clerkId: user.id, userId: convexUser._id } : "skip"
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
  const scaffoldProjectDirectories = useMutation(api.me.scaffoldProjectDirectories);
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
    user?.id && convexUser?._id ? { clerkId: user.id, userId: convexUser._id, limit: 30 } : "skip"
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
    user?.id && convexUser?._id ? { clerkId: user.id, userId: convexUser._id } : "skip"
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

  const buildAuthoritativeProfileContext = useCallback(() => {
    const memoryContext = (recentMemories ?? []).map((m) => ({
      category: m.category,
      content: m.content,
      tags: m.tags,
    }));

    let profileContext = buildProfileContext(
      (latestBundle?.youJson as Record<string, unknown>) || null,
      memoryContext.length > 0 ? memoryContext : undefined
    );

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
        const linkEntries = Object.entries(profileLinks).filter(([, value]) => value);
        if (linkEntries.length > 0) {
          parts.push(`links: ${linkEntries.map(([key, value]) => `${key}: ${value}`).join(", ")}`);
        }
      }
      const profileNow = userProfile.now as string[] | undefined;
      if (profileNow && profileNow.length > 0) {
        parts.push(`current focus: ${profileNow.join(", ")}`);
      }
      const profileProjects = userProfile.projects as Array<Record<string, string>> | undefined;
      if (profileProjects && profileProjects.length > 0) {
        parts.push(`projects: ${profileProjects.map((project) => `${project.name} (${project.status || "active"})${project.description ? ` — ${project.description}` : ""}`).join("; ")}`);
      }
      if (userProfile.avatarUrl) parts.push("has profile image from social media");
      if (parts.length > 1) profileContext = parts.join("\n");
    }

    return profileContext;
  }, [recentMemories, latestBundle?.youJson, userProfile, convexUser?.username]);

  const buildTurnScaffold = useCallback(() => {
    const profileContext = buildAuthoritativeProfileContext();
    return {
      profileContext,
      systemMessage: {
        role: "system" as const,
        content: `${SYSTEM_PROMPT}\n\n--- THIS USER'S IDENTITY CONTEXT ---\n\n${profileContext}`,
      },
      contextMessage: {
        role: "user" as const,
        content:
          `[CURRENT PROFILE SNAPSHOT — authoritative latest saved state. ` +
          `If earlier conversation turns conflict with this snapshot, trust this snapshot. ` +
          `Treat completed mutations in this snapshot as already done, and do not repeat or re-apply them unless the user explicitly asks again.]\n\n${profileContext}`,
      },
    };
  }, [buildAuthoritativeProfileContext]);

  const pruneResolvedMutationTurns = useCallback((conversation: ChatMessage[]) => {
    const pruned: ChatMessage[] = [];

    const isMutationRequest = (content: string) => {
      const normalized = content.toLowerCase();
      const hasMutationVerb =
        /\b(add|create|make|update|change|set|save|remember|switch|use)\b/.test(normalized);
      const hasMutationTarget =
        /\b(custom section|section called|portrait|avatar|profile image|profile photo|private note|private context|bio|tagline|location|link|links|project|directive|memory)\b/.test(normalized);
      return hasMutationVerb && hasMutationTarget;
    };

    const isCompletedMutationReply = (content: string) =>
      /\b(updated|saved|added|switched|set|created|generated)\b/i.test(content);

    for (let index = 0; index < conversation.length; index += 1) {
      const current = conversation[index];
      const next = conversation[index + 1];

      if (
        current.role === "user" &&
        typeof current.content === "string" &&
        next?.role === "assistant" &&
        typeof next.content === "string" &&
        isMutationRequest(current.content) &&
        isCompletedMutationReply(next.content)
      ) {
        index += 1;
        continue;
      }

      pruned.push(current);
    }

    return pruned;
  }, []);

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
    // Restore only the last 30/40 messages — prevents stale bloated sessions
    // from causing slow loads (large payload over Convex WebSocket).
    const restoredDisplay = latestChatMessages.displayMessages.slice(-30).map(m => ({
      id: m.id,
      role: m.role as DisplayMessage["role"],
      content: m.content,
    }));
    const restoredLLM = latestChatMessages.llmMessages.slice(-40).map(m => ({
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
      // Truncate to last 30 display + 40 LLM messages to prevent session bloat.
      // Large sessions slow down the initial load (full payload over WebSocket).
      const MAX_DISPLAY = 30;
      const MAX_LLM = 40;
      const trimmedDisplay = displayMessages.slice(-MAX_DISPLAY);
      const trimmedLLM = messages.slice(-MAX_LLM);
      saveChatMessages({
        clerkId: user.id,
        sessionId: sessionIdRef.current,
        displayMessages: trimmedDisplay.map(m => ({
          id: m.id,
          role: m.role,
          content: m.content,
        })),
        llmMessages: trimmedLLM.map(m => ({
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

  // Track whether the initial scroll-to-bottom has happened, and whether the
  // user has actively scrolled up since the last assistant message started.
  // - On first load: ALWAYS jump to the bottom (the user wants to see the
  //   most recent state)
  // - During streaming: ALWAYS follow the bottom unless the user manually
  //   scrolled up
  // - After scroll-up: respect their position until they scroll back to bottom
  const hasInitialScrolledRef = useRef(false);
  const userScrolledUpRef = useRef(false);
  const lastScrollTopRef = useRef(0);

  // Track manual user scroll-up to detach from auto-follow
  useEffect(() => {
    const endEl = messagesEndRef.current;
    if (!endEl) return;

    let scrollContainer: HTMLElement | null = endEl.parentElement;
    while (scrollContainer) {
      const overflowY = getComputedStyle(scrollContainer).overflowY;
      if (overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") break;
      scrollContainer = scrollContainer.parentElement;
    }
    if (!scrollContainer) return;
    const container = scrollContainer;

    const onScroll = () => {
      const currentTop = container.scrollTop;
      const distanceFromBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight;
      // If the user is now within 80px of the bottom, re-attach to auto-follow
      if (distanceFromBottom < 80) {
        userScrolledUpRef.current = false;
      } else if (currentTop < lastScrollTopRef.current - 5) {
        // Detected manual upward scroll (>5px) — detach from auto-follow
        userScrolledUpRef.current = true;
      }
      lastScrollTopRef.current = currentTop;
    };
    container.addEventListener("scroll", onScroll, { passive: true });
    return () => container.removeEventListener("scroll", onScroll);
  }, []);

  // Auto-scroll to bottom.
  // - First render with messages: ALWAYS scroll to bottom (force jump, no smooth)
  // - During streaming / new messages: ALWAYS follow unless user manually scrolled up
  useEffect(() => {
    const endEl = messagesEndRef.current;
    if (!endEl) return;
    if (displayMessages.length === 0) return;

    // Walk up to find the nearest scrollable ancestor
    let scrollContainer: HTMLElement | null = endEl.parentElement;
    while (scrollContainer) {
      const overflowY = getComputedStyle(scrollContainer).overflowY;
      if (overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") break;
      scrollContainer = scrollContainer.parentElement;
    }

    if (!scrollContainer) {
      if (!userScrolledUpRef.current) {
        endEl.scrollIntoView({ behavior: hasInitialScrolledRef.current ? "smooth" : "auto" });
      }
      hasInitialScrolledRef.current = true;
      return;
    }

    // FIRST render with messages: force jump to bottom (defer to next frame
    // so the DOM has actually painted the messages)
    if (!hasInitialScrolledRef.current) {
      requestAnimationFrame(() => {
        scrollContainer!.scrollTop = scrollContainer!.scrollHeight;
        requestAnimationFrame(() => {
          scrollContainer!.scrollTop = scrollContainer!.scrollHeight;
          lastScrollTopRef.current = scrollContainer!.scrollTop;
        });
      });
      hasInitialScrolledRef.current = true;
      return;
    }

    // Subsequent updates (streaming or new messages): follow bottom UNLESS
    // the user has manually scrolled up. This fixes Houston's complaint that
    // streaming responses weren't auto-scrolling.
    if (userScrolledUpRef.current) return;

    scrollContainer.scrollTop = scrollContainer.scrollHeight;
    lastScrollTopRef.current = scrollContainer.scrollTop;
  }, [displayMessages, isThinking, progressSteps]);

  // Whenever the user sends a new message, re-attach to auto-follow
  useEffect(() => {
    if (isThinking) {
      userScrolledUpRef.current = false;
    }
  }, [isThinking]);

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
      signal: AbortSignal.timeout(240_000),
    });

    if (!res.ok) {
      await res.text();
      throw new Error("the agent is temporarily unavailable. try again in a moment.");
    }

    const data = await res.json();
    if (!data.content) throw new Error("the agent returned an empty response. try again.");
    return data.content;
  }, []);

  // Tool calls collected from Anthropic tool_use SSE events during streaming
  interface AgentToolCall {
    name: string;
    input: {
      updates?: { section: string; content: string }[];
      private_updates?: { section: string; content: string }[];
      custom_sections?: { id: string; title: string; content: string }[];
      memories?: { key: string; value: string; category: string }[];
      urls?: string[];
      purpose?: string;
      avatar_url?: string;
      avatar_source?: string;
    };
  }

  // Streaming LLM call — streams tokens into a display message in real-time
  // Uses requestAnimationFrame batching to avoid excessive React re-renders
  // Returns both the streamed text AND any tool_use calls emitted by the model
  const callLLMStreaming = useCallback(async (
    msgs: ChatMessage[],
    displayMessageId: string,
    onFirstToken?: () => void,
  ): Promise<{ text: string; toolCalls: AgentToolCall[] }> => {
    const streamUrl = CHAT_PROXY_URL.replace("/chat", "/chat/stream");

    // Hoisted so catch block can return partial results
    let fullText = "";
    const toolCalls: AgentToolCall[] = [];

    try {
      const res = await fetch(streamUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: msgs }),
        signal: AbortSignal.timeout(240_000), // 240s — scaffolding many files needs time
      });

      if (!res.ok || !res.body) {
        // Streaming endpoint failed (both Anthropic + OpenRouter down).
        // Return empty rather than falling back to the onboarding /chat endpoint
        // (wrong endpoint: no tools, 50K payload limit).
        return { text: "", toolCalls: [] };
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let notifiedFirstToken = false;
      let rafPending = false;
      // Track active tool calls for real-time progress display
      const activeToolSteps = new Map<string, string>(); // toolName → stepId

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
            // Collect complete tool_use blocks emitted by transformAnthropicStream
            if (parsed.tool_use && typeof parsed.tool_use === "object") {
              toolCalls.push(parsed.tool_use as AgentToolCall);
              // Complete the tool's progress step when we have the full input
              const stepId = activeToolSteps.get(parsed.tool_use.name);
              if (stepId) {
                const updateCount = parsed.tool_use.input?.updates?.length || 0;
                completeStep(stepId, updateCount > 0 ? `${updateCount} file${updateCount > 1 ? "s" : ""}` : "done");
                activeToolSteps.delete(parsed.tool_use.name);
              }
            }
            // Handle real-time tool streaming progress events
            if (parsed.tool_streaming && typeof parsed.tool_streaming === "object") {
              const { name, status, bytes } = parsed.tool_streaming;
              if (status === "started") {
                // Show a progress step immediately when the tool call begins
                if (!notifiedFirstToken) {
                  notifiedFirstToken = true;
                  onFirstToken?.();
                }
                // Auto-switch to files pane so user sees files being created live
                if (name === "update_profile" && onPaneSwitch) {
                  onPaneSwitch("edit");
                }
                const label = name === "update_profile" ? "writing profile files"
                  : name === "save_memory" ? "saving memories"
                  : name === "fetch_website" ? "fetching websites"
                  : `calling ${name}`;
                const stepId = addStep(label);
                activeToolSteps.set(name, stepId);
              } else if (status === "writing" && bytes) {
                // Update step label with byte progress for large writes
                const stepId = activeToolSteps.get(name);
                if (stepId) {
                  const kb = Math.round(bytes / 100) / 10;
                  // Only update label periodically to avoid flooding React
                  setThinkingPhrase(`writing... ${kb}kb`);
                }
              }
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

      return { text: fullText || "", toolCalls };
    } catch {
      // Streaming failed — return whatever was streamed so far rather than
      // falling back to callLLM (which hits the onboarding endpoint with a 50K char limit
      // and no tools — wrong endpoint for the main agent).
      return { text: fullText || "", toolCalls };
    }
  }, []);

  // Save updates to Convex
  const saveUpdates = useCallback(
    async (updates: SectionUpdate[], customSections: CustomSection[] = []) => {
      if (!user?.id || !convexUser) return;

      try {
        const profileData = buildProfileDataFromUpdates(
          updates,
          (latestBundle?.youJson as Record<string, unknown>) || null,
          convexUser.username,
          customSections
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

  const handleProjectDirectoryScaffold = useCallback(
    async (trimmed: string, priorConversation: ChatMessage[], userMsg: ChatMessage) => {
      if (!user?.id) return false;

      const fallbackProjects = Array.isArray(userProfile?.projects)
        ? (userProfile.projects as Array<Record<string, unknown>>)
        : [];
      const preview = buildProjectDirectoryScaffold(
        (latestBundle?.youJson as Record<string, unknown>) || null,
        fallbackProjects
      );

      setIsThinking(true);
      clearSteps();
      setThinkingCategory("building");
      setThinkingPhrase("scaffolding your private project directories");

      const scaffoldStepId = addStep(
        "scaffolding project directories",
        preview.projectCount > 0 ? `${preview.projectCount} projects` : undefined
      );

      try {
        if (preview.projectCount === 0) {
          failStep(scaffoldStepId, "no projects found");
          const assistantContent =
            "i don’t see any projects in your profile yet, so there’s nothing to scaffold under private/projects. add projects first, then i can build the folder tree in one shot.";
          setMessages([...priorConversation, userMsg, { role: "assistant", content: assistantContent }]);
          setDisplayMessages((prev) => [
            ...prev,
            { id: crypto.randomUUID(), role: "assistant", content: assistantContent },
          ]);
          return true;
        }

        onPaneSwitch?.("edit");

        const result = await scaffoldProjectDirectories({ clerkId: user.id });
        const projectList = result.projectSlugs.join(", ");
        const createdCount = result.createdPaths.length;

        let assistantContent = "";
        const notices: DisplayMessage[] = [];

        if (!result.changed || createdCount === 0) {
          completeStep(scaffoldStepId, "already scaffolded");
          assistantContent = `your private/projects scaffold is already in place for ${result.projectCount} projects (${projectList}).`;
        } else {
          completeStep(scaffoldStepId, `${createdCount} files`);
          assistantContent = `done. scaffolded private/projects for ${result.projectCount} projects and created ${createdCount} files across ${result.projectSlugs.length} directories (${projectList}).`;
          notices.push({
            id: crypto.randomUUID(),
            role: "system-notice",
            content: `[updated: ${createdCount} files under private/projects (${projectList})]`,
          });
          notices.push({
            id: crypto.randomUUID(),
            role: "system-notice",
            content: `[saved as v${result.version}]`,
          });
          notices.push({
            id: crypto.randomUUID(),
            role: "system-notice",
            content: "[published]",
          });
        }

        const assistantMsg: ChatMessage = { role: "assistant", content: assistantContent };
        setMessages([...priorConversation, userMsg, assistantMsg]);
        setDisplayMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), role: "assistant", content: assistantContent },
          ...notices,
        ]);

        messageCountRef.current += 2;
        if (user?.id) {
          await upsertSession({
            clerkId: user.id,
            sessionId: sessionIdRef.current,
            surface: "web",
            messageCount: messageCountRef.current,
          }).catch(() => {
            // Non-fatal — session persistence failure should not break the shell
          });
        }

        return true;
      } catch (err) {
        failStep(scaffoldStepId, "failed");
        const assistantContent = `something went wrong while scaffolding your project directories. ${err instanceof Error ? err.message : "try again."}`;
        setMessages([...priorConversation, userMsg, { role: "assistant", content: assistantContent }]);
        setDisplayMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), role: "assistant", content: assistantContent },
        ]);
        return true;
      } finally {
        setIsThinking(false);
        clearSteps();
      }
    },
    [
      user?.id,
      userProfile?.projects,
      latestBundle?.youJson,
      clearSteps,
      addStep,
      completeStep,
      failStep,
      onPaneSwitch,
      scaffoldProjectDirectories,
      upsertSession,
    ]
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

    const { profileContext, systemMessage } = buildTurnScaffold();

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

        // Stream the greeting into a new display message so tokens appear
        // as they arrive instead of waiting for the full response.
        const initStreamMsgId = crypto.randomUUID();
        let initFirstToken = false;

        // Show pre-stream notices then add an empty assistant placeholder
        const preDisplay: DisplayMessage[] = [];
        if (shouldAutoScrape) {
          preDisplay.push({
            id: crypto.randomUUID(),
            role: "system-notice",
            content: `[scraped ${existingLinks.length} source${existingLinks.length > 1 ? "s" : ""} from your profile]`,
          });
        }
        preDisplay.push({ id: initStreamMsgId, role: "assistant", content: "" });
        setDisplayMessages((prev) => [...prev, ...preDisplay]);

        const onInitFirstToken = () => {
          if (!initFirstToken) {
            initFirstToken = true;
            // Turn off the spinner once the greeting starts flowing
            setIsThinking(false);
            clearSteps();
          }
        };

        const { text: response, toolCalls: initToolCalls } = await callLLMStreaming(allMessages, initStreamMsgId, onInitFirstToken);

        if (!initFirstToken) {
          // Fallback: streaming returned nothing, show what we got
          setIsThinking(false);
          clearSteps();
        }

        const { display, updates: jsonUpdates } = parseUpdatesFromResponse(response);

        // Clean the streamed display (strip JSON blocks, collapse extra newlines)
        const cleanDisplay = display
          .replace(/\n{3,}/g, "\n\n")
          .replace(/^\n+/, "")
          .replace(/\n+$/, "")
          .trim();

        // Update the streaming message to the cleaned display text
        setDisplayMessages((prev) => prev.map(m =>
          m.id === initStreamMsgId ? { ...m, content: cleanDisplay } : m
        ));

        const assistantMsg: ChatMessage = { role: "assistant", content: response };
        setMessages((prev) => [...prev, assistantMsg]);

        // Use tool_use calls if available (Anthropic streaming), else fall back to JSON blocks (OpenRouter)
        const updates = initToolCalls.length > 0
          ? initToolCalls.filter(tc => tc.name === "update_profile").flatMap(tc => tc.input.updates || [])
          : jsonUpdates;

        if (updates.length > 0) {
          const sectionNames = updates.map((u) => sectionLabel(u.section)).join(", ");
          setDisplayMessages((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              role: "system-notice",
              content: `[updated: ${sectionNames}]`,
            },
          ]);
          saveUpdates(updates);
        }

        // Save memories from tool calls (init path)
        const initMemories = initToolCalls.filter(tc => tc.name === "save_memory").flatMap(tc => tc.input.memories || []);
        if (initMemories.length > 0 && user?.id) {
          saveMemories({
            clerkId: user.id,
            memories: initMemories.map((m) => ({
              category: m.category,
              content: `${m.key}: ${m.value}`,
              source: "you-agent",
              tags: [m.category],
              sessionId: sessionIdRef.current,
            })),
          }).catch(() => { /* non-fatal */ });
        }

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
  }, [initialized, sessionRestored, convexUser, latestBundle, isOnboarding, onboardingGreeting, callLLM, callLLMStreaming, saveUpdates, saveMemories, userProfile, user?.id, updateProfile, recentMemories, addStep, completeStep, failStep, clearSteps, buildTurnScaffold]);

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
        "/vault": "vault",
        "/edit": "edit",
        "/agents": "agents",
        "/skills": "skills",
        "/history": "history",
        "/versions": "history",
        "/analytics": "analytics",
        "/stats": "analytics",
        // /share and /help are handled separately below (special logic)
      };

      if (paneCommands[trimmed] && onPaneSwitch) {
        onPaneSwitch(paneCommands[trimmed]);

        // Custom message for /skills
        const noticeContent = trimmed === "/skills"
          ? "[switched to skills]\n\nidentity-aware agent skills — markdown templates with {{identity}} variables.\n\nuse in chat: /skill use claude-md-generator\ninstall via CLI: youmd skill install all\nscaffold a project: youmd skill init-project\n\navailable: claude-md-generator, project-context-init, voice-sync, meta-improve, proactive-context-fill, you-logs"
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

      // /skill use {name} — fetch skill from registry and inject into conversation
      if (trimmed.startsWith("/skill use ") || trimmed.startsWith("/skill ")) {
        const skillName = trimmed.startsWith("/skill use ")
          ? trimmed.slice(11).trim()
          : trimmed.slice(7).trim();

        if (!skillName || skillName === "use") {
          setDisplayMessages((prev) => [
            ...prev,
            { id: crypto.randomUUID(), role: "user", content: trimmed },
            {
              id: crypto.randomUUID(),
              role: "system-notice",
              content: `usage: /skill use <name>\navailable skills: claude-md-generator, project-context-init, voice-sync, meta-improve, proactive-context-fill, you-logs\ninstall via CLI: youmd skill install all`,
            },
          ]);
          return true;
        }

        setDisplayMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), role: "user", content: trimmed },
          { id: crypto.randomUUID(), role: "system-notice", content: `[fetching skill: ${skillName}...]` },
        ]);

        // Fetch skill from registry
        fetch(`${CONVEX_SITE_URL}/api/v1/skills?name=${encodeURIComponent(skillName)}`)
          .then((res) => res.ok ? res.json() : null)
          .then((skillData) => {
            if (!skillData || !skillData.content) {
              setDisplayMessages((prev) => [
                ...prev,
                {
                  id: crypto.randomUUID(),
                  role: "system-notice",
                  content: `skill "${skillName}" not found in registry. install via CLI: youmd skill install ${skillName}`,
                },
              ]);
              return;
            }

            // Inject skill as context into conversation for the agent to follow
            const youJson = (latestBundle?.youJson as Record<string, unknown>) || null;
            let renderedContent = skillData.content as string;

            // Simple identity interpolation for known fields
            if (youJson) {
              const prefs = (youJson as Record<string, unknown>)?.["preferences/agent.md"] as string || "";
              const directives = (youJson as Record<string, unknown>)?.["directives/agent.md"] as string || "";
              const voice = (youJson as Record<string, unknown>)?.["voice/voice.md"] as string || "";
              const about = (youJson as Record<string, unknown>)?.["profile/about.md"] as string || "";
              renderedContent = renderedContent
                .replace(/\{\{preferences\.agent\}\}/g, prefs || "(not set)")
                .replace(/\{\{directives\.agent\}\}/g, directives || "(not set)")
                .replace(/\{\{voice\.overall\}\}/g, voice || "(not set)")
                .replace(/\{\{profile\.about\}\}/g, about || "(not set)");
            }

            const skillMsg: ChatMessage = {
              role: "system",
              content: `[SKILL ACTIVATED: ${skillName}]\n\nFollow these instructions for this conversation:\n\n${renderedContent}\n\n[END SKILL]\n\nExecute this skill now for the user. Start immediately.`,
            };

            setMessages((prev) => [...prev, skillMsg]);
            setDisplayMessages((prev) => [
              ...prev,
              {
                id: crypto.randomUUID(),
                role: "system-notice",
                content: `[skill loaded: ${skillName} (${skillData.version})]\n\n${skillData.description}\n\nidentity fields: ${(skillData.identityFields || []).join(", ")}\n\nthe agent will now follow the skill instructions. you can guide it from here.`,
              },
            ]);
          })
          .catch(() => {
            setDisplayMessages((prev) => [
              ...prev,
              {
                id: crypto.randomUUID(),
                role: "system-notice",
                content: `failed to fetch skill "${skillName}" — check your connection.`,
              },
            ]);
          });

        return true;
      }

      // /portrait show — render portrait inline in chat
      if (trimmed === "/portrait show") {
        const avatarUrl = (userProfile as Record<string, unknown> | null)?.avatarUrl as string | undefined;
        const socialImages = (userProfile as Record<string, unknown> | null)?.socialImages as Record<string, string> | undefined;
        const primaryImage = (userProfile as Record<string, unknown> | null)?.primaryImage as string | undefined;

        const msgs: DisplayMessage[] = [
          { id: crypto.randomUUID(), role: "user", content: trimmed },
        ];

        if (avatarUrl || socialImages) {
          // Show the primary portrait first
          if (avatarUrl) {
            msgs.push({
              id: crypto.randomUUID(),
              role: "assistant",
              content: `![your portrait](${avatarUrl})\n\ncurrent portrait — sourced from ${primaryImage || "profile"}`,
            });
          }

          // Show all available platform images
          if (socialImages) {
            const platforms = Object.entries(socialImages).filter(([, url]) => url && typeof url === "string");
            if (platforms.length > 1) {
              const gallery = platforms
                .map(([platform, url]) => `![${platform} photo](${url})`)
                .join("\n");
              msgs.push({
                id: crypto.randomUUID(),
                role: "assistant",
                content: `${gallery}\n\navailable from ${platforms.length} sources. say "use my [platform] photo" to switch.`,
              });
            }
          }
        } else {
          msgs.push({
            id: crypto.randomUUID(),
            role: "system-notice",
            content: "no portrait yet. share your x, github, or linkedin handle and i'll pull your photo.",
          });
        }

        setDisplayMessages((prev) => [...prev, ...msgs]);
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
          onPaneSwitch("help");
        }
        const helpText = onPaneSwitch
          ? "available commands:\n\nIDENTITY\n/profile -- live profile preview\n/portrait -- ascii portrait editor + format picker\n/portrait show -- render portrait variants inline\n/portrait --regenerate -- re-scrape sources and update portrait\n/edit -- edit identity context (files, json, sources)\n/json -- raw identity json\n/files -- file browser\n/sources -- manage connected sources\n\nSHARING\n/share -- create shareable identity link (copies to clipboard)\n/share --private -- include private context in link\n/share --project {name} -- project-scoped context link\n/publish -- publish latest bundle publicly\n\nSKILLS\n/skills -- browse + install skills\n/skill use {name} -- activate skill in this conversation\n\nACCOUNT\n/vault -- api keys + secrets manager\n/agents -- connected agent integrations (MCP)\n/settings -- account, billing, session log\n/activity -- agent activity log\n\nDATA\n/analytics -- profile views + agent reads\n/history -- bundle version history\n\nMEMORY\n/memory -- memory stats by category\n/recall -- recent memories\n/recall {query} -- search memories by keyword\n\nSYSTEM\n/status -- @username | plan | version | published/draft\n/help -- show this reference"
          : "available commands:\n/profile, /portrait, /edit, /json, /files, /sources\n/share, /share --private, /share --project {name}, /publish\n/skills, /skill use {name}\n/vault, /agents, /settings, /activity\n/analytics, /history\n/memory, /recall, /recall {query}\n/status, /help";

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

    const priorConversation = pruneResolvedMutationTurns(messagesRef.current.filter((message, index) => {
      if (index === 0 && message.role === "system") return false;
      if (
        message.role === "user" &&
        typeof message.content === "string" &&
        message.content.includes("just opened the web chat")
      ) {
        return false;
      }
      return true;
    }));
    const userMsg: ChatMessage = { role: "user", content: trimmed };

    if (trimmed && isProjectDirectoryScaffoldRequest(trimmed)) {
      const handled = await handleProjectDirectoryScaffold(trimmed, priorConversation, userMsg);
      if (handled) {
        textareaRef.current?.focus();
        return;
      }
    }

    // Detect URLs/usernames in the message for auto-scraping
    const detectedSources = detectSourcesInMessage(trimmed);
    const newSources = detectedSources.filter(
      (s) => !scrapedSourcesRef.current.has(`${s.platform}:${s.username || s.url}`)
    );

    const { systemMessage: liveSystemMessage, contextMessage: liveContextMessage } = buildTurnScaffold();

    // Add to conversation history
    let updatedMessages = [liveSystemMessage, liveContextMessage, ...priorConversation, userMsg];
    setMessages([...priorConversation, userMsg]);

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
      let mainResponseStarted = false;
      const ackPromise = (async () => {
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

          if (!ackRes.ok) return;

          const ackData = await ackRes.json();
          const ackText = ackData.ack || "";

          // Only inject the ACK while the main response has not started yet.
          // Once streaming begins, the real response should own the surface.
          if (ackText && !mainResponseStarted) {
            setDisplayMessages((prev) => [
              ...prev,
              { id: ackMsgId, role: "assistant", content: ackText },
            ]);
            setThinkingPhrase(ackText);
          }
        } catch {
          // ACK failed — non-fatal, continue with full response
        }
      })();

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
          mainResponseStarted = true;
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
      const { text: response, toolCalls } = await callLLMStreaming(updatedMessages, streamMsgId, onFirstToken);
      void ackPromise;

      if (!response.trim() && toolCalls.length === 0) {
        mainResponseStarted = true;
        setIsThinking(false);
        clearSteps();
        setDisplayMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: "hmm. the model never finished that response. try again in a second.",
          },
        ]);
        return;
      }

      // If no tokens came through (fallback path), clean up and show response
      if (!firstTokenReceived) {
        mainResponseStarted = true;
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
      const { display, updates: jsonUpdates } = parseUpdatesFromResponse(response);

      // Clean display text: strip JSON blocks + collapse excessive blank lines
      const cleanDisplay = display
        .replace(/\n{3,}/g, "\n\n")  // collapse 3+ newlines to 2
        .replace(/^\n+/, "")          // strip leading blank lines
        .replace(/\n+$/, "")          // strip trailing blank lines
        .trim();
      let finalAssistantDisplay = cleanDisplay;
      let savedMemoryCount = 0;
      let updatedPortraitSource: string | null = null;
      let fetchedWebsiteCount = 0;

      setDisplayMessages(prev => prev.map(m =>
        m.id === streamMsgId ? { ...m, content: cleanDisplay } : m
      ));

      const assistantMsg: ChatMessage = {
        role: "assistant",
        content: cleanDisplay || response,
      };
      setMessages((prev) => [...prev, assistantMsg]);

      const newDisplayMsgs: DisplayMessage[] = [];

      // NOTE: The assistant's response message was already added during streaming
      // (at streamMsgId). Do NOT add a duplicate here. Only add system notices
      // for updates, memories, etc.

      // Use structured tool_use calls if available (Anthropic path), else fall back to JSON block parsing (OpenRouter)
      const updates = toolCalls.length > 0
        ? toolCalls.filter(tc => tc.name === "update_profile").flatMap(tc => tc.input.updates || [])
        : jsonUpdates;
      const toolCustomSections = toolCalls
        .filter(tc => tc.name === "update_profile")
        .flatMap(tc => tc.input.custom_sections || []);
      const customSections = toolCustomSections.length > 0
        ? toolCustomSections
        : parseCustomSectionsFromResponse(response);
      const updatedSectionLabels = updates.map((u) => sectionLabel(u.section));
      const customSectionTitles = customSections.map((section) => section.title);

      // LYING DETECTION: if the assistant claimed PAST-TENSE completed actions but
      // didn't actually emit any updates via tool_use OR JSON blocks, warn the user.
      // Only fires on definitive past-tense claims — not on future-tense commitments
      // like "let me scaffold..." or "i'll create..." (those are promises, not lies).
      if (updates.length === 0 && toolCalls.length === 0) {
        const pastTenseClaims = [
          // Only definitive past-tense: "done.", "created X", "scaffolded Y", "i've added"
          /\b(i'?ve\s+(added|created|updated|scaffolded|written|generated|built|set\s+up|populated))\b/i,
          /\b(done\.|scaffolded\s+(all|your|those|the)\s+\d*\s*(project|file|director|section))/i,
          /\b(infrastructure\s+is\s+now|properly\s+documented|all\s+\d+\s+project.*\bcreated\b)\b/i,
        ];
        const futureTensePatterns = [
          /\b(let\s+me|i'?ll|going\s+to|will\s+(create|scaffold|add|build)|i\s+can\s+(scaffold|create))\b/i,
          /\b(here'?s?\s+(what|the)|starting\s+(with|on)|working\s+on)\b/i,
          /\b(should\s+i|want\s+me\s+to|ok\s+to\s+(start|proceed)|shall\s+i)\b/i,
        ];
        const claimsPastAction = pastTenseClaims.some((rx) => rx.test(cleanDisplay));
        const isFutureTense = futureTensePatterns.some((rx) => rx.test(cleanDisplay));
        if (claimsPastAction && !isFutureTense && cleanDisplay.length > 50) {
          newDisplayMsgs.push({
            id: crypto.randomUUID(),
            role: "system-notice",
            content: `[warning: agent claimed completed actions but no updates were saved. use the update_profile tool or emit a json block to actually write files.]`,
          });
        }
      }

      if (updates.length > 0 || customSections.length > 0) {
        const sectionNames = updates
          .map((u) => sectionLabel(u.section))
          .concat(customSections.map((section) => `${section.title} section`))
          .join(", ");
        newDisplayMsgs.push({
          id: crypto.randomUUID(),
          role: "system-notice",
          content: `[updated: ${sectionNames}]`,
        });

        const saveStepId = addStep("saving profile updates", sectionNames);
        const result = await saveUpdates(updates, customSections);
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
        if (customSections.length > 0) {
          const titles = customSections.map(section => section.title).join(", ");
          newDisplayMsgs.push({
            id: crypto.randomUUID(),
            role: "system-notice",
            content: `[added custom section${customSections.length > 1 ? "s" : ""}: ${titles}]`,
          });
        }
      }

      // Handle private updates from tool_use calls (Anthropic path)
      const toolPrivateUpdates = toolCalls
        .filter(tc => tc.name === "update_profile")
        .flatMap(tc => tc.input.private_updates || []);

      // Handle private updates from update_profile tool calls (Anthropic path)
      if (toolPrivateUpdates.length > 0 && user?.id && userProfile?._id) {
        const privStepId = addStep("saving private context");
        for (const pu of toolPrivateUpdates) {
          try {
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

      // Handle private updates from JSON blocks (OpenRouter fallback path only)
      if (toolCalls.length === 0) {
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
      }

      // Handle memory saves — tool_use calls (Anthropic) OR JSON block fallback (OpenRouter)
      const toolMemories = toolCalls.filter(tc => tc.name === "save_memory").flatMap(tc => tc.input.memories || []);
      const memorySaves = toolMemories.length > 0
        ? toolMemories.map((m) => ({ category: m.category, content: `${m.key}: ${m.value}`, tags: [m.category] as string[] }))
        : parseMemorySavesFromResponse(response).map((ms) => ({ category: ms.category, content: ms.content, tags: ms.tags || [] }));
      if (memorySaves.length > 0 && user?.id) {
        savedMemoryCount = memorySaves.length;
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

      // Handle fetch_website tool calls — agent requests scraping specific URLs
      const fetchWebsiteCalls = toolCalls.filter(tc => tc.name === "fetch_website");
      if (fetchWebsiteCalls.length > 0) {
        const allUrls = fetchWebsiteCalls.flatMap(tc => tc.input.urls || []).filter(Boolean);
        if (allUrls.length > 0) {
          const fetchStepId = addStep("fetching websites", allUrls.join(", "));
          const scrapeResults: string[] = [];
          await Promise.all(allUrls.map(async (url) => {
            try {
              // Detect what kind of source this is
              const xMatch = url.match(/(?:x\.com|twitter\.com)\/([a-zA-Z0-9_]+)/i);
              const ghMatch = url.match(/github\.com\/([a-zA-Z0-9_-]+)/i);
              const liMatch = url.match(/linkedin\.com\/in\/([a-zA-Z0-9_-]+)/i);
              let source: DetectedSource;
              if (xMatch) source = { platform: "x", url, username: xMatch[1] };
              else if (ghMatch) source = { platform: "github", url, username: ghMatch[1] };
              else if (liMatch) source = { platform: "linkedin", url, username: liMatch[1] };
              else source = { platform: "website", url };

              const result = await scrapeSource(source);
              if (result) {
                scrapeResults.push(result);
                scrapedSourcesRef.current.add(`${source.platform}:${source.username || url}`);
              }
            } catch { /* non-fatal */ }
          }));
          completeStep(fetchStepId, `${scrapeResults.length} fetched`);

          if (scrapeResults.length > 0) {
            fetchedWebsiteCount = scrapeResults.length;
            // Inject scrape results back into conversation so agent sees real data
            const scrapeMsg: ChatMessage = {
              role: "user",
              content: `[PLATFORM SCRAPE RESULTS — fetched per agent request]\n\n${scrapeResults.join("\n\n")}`,
            };
            setMessages(prev => [...prev, scrapeMsg]);
            newDisplayMsgs.push({
              id: crypto.randomUUID(),
              role: "system-notice",
              content: `[fetched ${scrapeResults.length} site${scrapeResults.length > 1 ? "s" : ""} — data injected into context]`,
            });
          } else {
            newDisplayMsgs.push({
              id: crypto.randomUUID(),
              role: "system-notice",
              content: `[could not fetch ${allUrls.length} site${allUrls.length > 1 ? "s" : ""} — check the URLs]`,
            });
          }
        }
      }

      // Handle portrait updates from agent — prefer tool_use, fall back to JSON blocks.
      const toolPortraitUpdate = toolCalls
        .filter(tc => tc.name === "update_profile" && typeof tc.input.avatar_url === "string")
        .map(tc => ({
          source: tc.input.avatar_source || "profile",
          url: tc.input.avatar_url as string,
        }))
        .at(-1);
      const portraitUpdate = toolPortraitUpdate || parsePortraitUpdateFromResponse(response);
      if (portraitUpdate && user?.id && userProfile?._id) {
        updatedPortraitSource = portraitUpdate.source;
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

      if (toolCalls.length > 0 && finalAssistantDisplay.length < 24) {
        const clauses: string[] = [];
        if (updatedSectionLabels.length > 0 || customSectionTitles.length > 0) {
          const targets = updatedSectionLabels
            .concat(customSectionTitles.map((title) => `${title.toLowerCase()} section`))
            .join(", ");
          clauses.push(`updated ${targets}`);
        }
        if (savedMemoryCount > 0) {
          clauses.push(`saved ${savedMemoryCount} ${savedMemoryCount === 1 ? "memory" : "memories"}`);
        }
        if (fetchedWebsiteCount > 0) {
          clauses.push(`pulled ${fetchedWebsiteCount} site${fetchedWebsiteCount === 1 ? "" : "s"} into context`);
        }
        if (updatedPortraitSource) {
          clauses.push(`switched your portrait to ${updatedPortraitSource}`);
        }
        if (clauses.length > 0) {
          finalAssistantDisplay = `${clauses.join(", ")}.`;
          setDisplayMessages(prev => prev.map(m =>
            m.id === streamMsgId ? { ...m, content: finalAssistantDisplay } : m
          ));
        }
      }

      if (finalAssistantDisplay && finalAssistantDisplay !== assistantMsg.content) {
        setMessages((prev) => {
          const next = [...prev];
          for (let index = next.length - 1; index >= 0; index -= 1) {
            if (
              next[index].role === "assistant" &&
              next[index].content === assistantMsg.content
            ) {
              next[index] = { ...next[index], content: finalAssistantDisplay };
              break;
            }
          }
          return next;
        });
      }

      // --- Context Compaction (Claude Code-style) ---
      // After 15+ turns, summarize older messages + extract durable facts into memory.
      // Turn-based trigger (more predictable than char-based).
      const COMPACTION_TURN_THRESHOLD = 15;
      const currentMessages = messagesRef.current;
      const turnCount = currentMessages.filter((m) => m.role === "user").length;

      if (turnCount >= COMPACTION_TURN_THRESHOLD && currentMessages.length > 10 && user?.id) {
        try {
          const result = await compactSession({
            clerkId: user.id,
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
                clerkId: user.id,
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
  }, [input, isThinking, handleSlashCommand, callLLM, saveUpdates, user?.id, userProfile?._id, privateContext, updatePrivateContext, latestBundle, userProfile, convexUser, publishLatest, updateProfile, setProfileImages, saveMemories, upsertSession, summarizeSession, addStep, completeStep, failStep, clearSteps, buildTurnScaffold, pruneResolvedMutationTurns, handleProjectDirectoryScaffold]);

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
