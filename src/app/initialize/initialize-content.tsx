"use client";

import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useRouter } from "next/navigation";
import { useState, useEffect, useRef, useCallback } from "react";
import { useYouAgent, buildProfileContext } from "@/hooks/useYouAgent";
import { TerminalShell } from "@/components/terminal/TerminalShell";
import Link from "next/link";
import PixelYOU from "@/components/PixelYOU";

/* ── Boot sequence lines ───────────────────────────────────── */

const BOOT_SEQUENCE = [
  { text: "you.md/v1 -- identity context protocol", delay: 80 },
  { text: "", delay: 200 },
  { text: "authenticated.", delay: 100 },
  { text: "loading identity protocol...", delay: 150 },
  { text: "you-md/v1 initialized.", delay: 120 },
  { text: "", delay: 100 },
  { text: "claiming username: {username}...", delay: 200 },
  { text: "username claimed.", delay: 100 },
  { text: "allocating identity bundle...", delay: 180 },
  { text: "identity bundle created.", delay: 100 },
  { text: "", delay: 150 },
  { text: "connecting to agent network...", delay: 250 },
  { text: "agent online.", delay: 100 },
  { text: "", delay: 200 },
];

/* ── Main component ────────────────────────────────────────── */

export function InitializeContent() {
  const { user } = useUser();
  const router = useRouter();
  const createUser = useMutation(api.users.createUser);

  // Check if user already exists in Convex
  const existingUser = useQuery(
    api.users.getByClerkId,
    user?.id ? { clerkId: user.id } : "skip"
  );

  const [phase, setPhase] = useState<"booting" | "claiming" | "ready" | "error">("booting");
  const [bootLines, setBootLines] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const claimAttempted = useRef(false);

  // If user already has a Convex account, redirect to dashboard
  useEffect(() => {
    if (existingUser && existingUser.username) {
      router.replace("/dashboard");
    }
  }, [existingUser, router]);

  // Run boot sequence and auto-claim
  useEffect(() => {
    if (!user || claimAttempted.current) return;
    if (existingUser !== null) return; // still loading (undefined) or already exists
    if (existingUser === undefined) return; // still loading

    claimAttempted.current = true;

    const username =
      user.username ||
      user.firstName?.toLowerCase().replace(/[^a-z0-9-]/g, "") ||
      "user";

    // Build boot lines with username interpolated
    const lines = BOOT_SEQUENCE.map((l) => ({
      ...l,
      text: l.text.replace("{username}", username),
    }));

    let i = 0;
    let totalDelay = 0;

    // Stagger each line
    for (const line of lines) {
      totalDelay += line.delay;
      const idx = i;
      setTimeout(() => {
        setBootLines((prev) => [...prev, lines[idx].text]);
      }, totalDelay);
      i++;
    }

    // After boot sequence, create the user
    const claimDelay = totalDelay + 200;
    setTimeout(async () => {
      setPhase("claiming");
      try {
        await createUser({
          clerkId: user.id,
          username: username.toLowerCase(),
          email: user.emailAddresses[0]?.emailAddress ?? "",
          displayName: user.fullName ?? undefined,
        });
        setBootLines((prev) => [...prev, "identity initialized.", ""]);
        setPhase("ready");
      } catch (err) {
        setError(err instanceof Error ? err.message : "failed to claim username");
        setPhase("error");
      }
    }, claimDelay);
  }, [user, existingUser, createUser]);

  // Loading state
  if (!user || existingUser === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[hsl(var(--bg))]">
        <p className="text-[hsl(var(--text-secondary))] font-mono text-sm animate-pulse">
          loading...
        </p>
      </div>
    );
  }

  // Boot sequence / claiming phase
  if (phase !== "ready") {
    return (
      <div className="min-h-screen flex flex-col bg-[hsl(var(--bg))] text-[hsl(var(--text-primary))]">
        {/* Nav */}
        <nav className="flex items-center justify-between px-4 py-2.5 border-b border-[hsl(var(--border))] shrink-0">
          <Link href="/" className="inline-block">
            <PixelYOU />
          </Link>
          <div className="flex items-center gap-3 text-xs font-mono text-[hsl(var(--text-secondary))]">
            <span>initializing</span>
          </div>
        </nav>

        {/* Terminal */}
        <div className="flex-1 flex flex-col max-w-2xl mx-auto w-full">
          <div className="terminal-panel-header">
            <div className="terminal-dot" />
            <div className="terminal-dot" />
            <div className="terminal-dot" />
            <span className="font-mono text-[10px] text-[hsl(var(--text-secondary))] opacity-50 ml-2">
              initialize
            </span>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-5">
            <div className="space-y-0.5 font-mono text-[13px]">
              {bootLines.map((line, i) =>
                line === "" ? (
                  <div key={i} className="h-3" />
                ) : (
                  <p
                    key={i}
                    className="text-[hsl(var(--text-secondary))] opacity-70 leading-relaxed"
                  >
                    &gt; {line}
                  </p>
                )
              )}
              {phase === "claiming" && (
                <p className="text-[hsl(var(--accent-mid))] animate-pulse">
                  &gt; claiming...
                </p>
              )}
              {phase === "error" && (
                <div className="space-y-2 mt-2">
                  <p className="text-[hsl(var(--accent))]">
                    &gt; error: {error}
                  </p>
                  <button
                    onClick={() => router.push("/sign-up")}
                    className="text-xs font-mono text-[hsl(var(--accent-mid))] hover:text-[hsl(var(--accent))] transition-colors"
                  >
                    &gt; try again
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Ready — show full-width terminal with agent conversation
  return <OnboardingTerminal />;
}

/* ── Onboarding Terminal ───────────────────────────────────── */

function OnboardingTerminal() {
  const router = useRouter();
  const { user } = useUser();
  const convexUser = useQuery(
    api.users.getByClerkId,
    user?.id ? { clerkId: user.id } : "skip"
  );
  const latestBundle = useQuery(
    api.bundles.getLatestBundle,
    convexUser?._id ? { userId: convexUser._id } : "skip"
  );

  const username = convexUser?.username || user?.username || "";

  const profileContext = buildProfileContext(
    (latestBundle?.youJson as Record<string, unknown>) || null
  );

  const onboardingGreeting = `${profileContext}\n\nthe user just signed up and claimed the username "${username}". this is their first time here. greet them by name if you know it, otherwise by username. introduce yourself as the you.md agent — you help people build their identity file for the agent internet. ask them about themselves — what they do, what they're building, what they care about. be genuinely curious. keep it natural and terminal-native. don't be generic — make it feel like a real conversation with a sharp, slightly witty AI that actually wants to learn about them.`;

  const agent = useYouAgent({
    isOnboarding: true,
    onboardingGreeting,
    onDone: () => {
      router.push("/dashboard");
    },
  });

  // Track if welcome line has been added
  const welcomeAdded = useRef(false);

  // Add a welcome system notice on mount
  useEffect(() => {
    if (!welcomeAdded.current && convexUser) {
      welcomeAdded.current = true;
      agent.addSystemMessage(
        `identity bundle initialized for @${username}. the agent will help you build your profile.`
      );
    }
  }, [convexUser, username]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!convexUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[hsl(var(--bg))]">
        <p className="text-[hsl(var(--text-secondary))] font-mono text-sm animate-pulse">
          loading...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[hsl(var(--bg))] text-[hsl(var(--text-primary))]">
      {/* Nav */}
      <nav className="flex items-center justify-between px-4 py-2.5 border-b border-[hsl(var(--border))] shrink-0">
        <Link href="/" className="inline-block">
          <PixelYOU />
        </Link>
        <div className="flex items-center gap-3 text-xs font-mono text-[hsl(var(--text-secondary))]">
          <span className="text-[hsl(var(--text-primary))]">@{username}</span>
          <span className="text-[hsl(var(--border))]">|</span>
          <span>onboarding</span>
          <span className="text-[hsl(var(--border))]">|</span>
          <button
            onClick={() => router.push("/dashboard")}
            className="text-[hsl(var(--accent-mid))] hover:text-[hsl(var(--accent))] transition-colors"
          >
            skip &gt;
          </button>
        </div>
      </nav>

      {/* Terminal */}
      <div className="flex-1 flex flex-col max-w-2xl mx-auto w-full min-h-0">
        {/* Terminal header */}
        <div className="terminal-panel-header">
          <div className="terminal-dot" />
          <div className="terminal-dot" />
          <div className="terminal-dot" />
          <span className="font-mono text-[10px] text-[hsl(var(--text-secondary))] opacity-50 ml-2">
            you.md agent
          </span>
        </div>

        <TerminalShell
          displayMessages={agent.displayMessages}
          input={agent.input}
          setInput={agent.setInput}
          isThinking={agent.isThinking}
          thinkingPhrase={agent.thinkingPhrase}
          messagesEndRef={agent.messagesEndRef}
          textareaRef={agent.textareaRef}
          sendMessage={agent.sendMessage}
        />
      </div>
    </div>
  );
}
