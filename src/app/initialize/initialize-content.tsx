"use client";

import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useRouter } from "next/navigation";
import { useState, useEffect, useRef, useCallback, type ReactNode } from "react";
import { useYouAgent, buildProfileContext } from "@/hooks/useYouAgent";
import { TerminalShell } from "@/components/terminal/TerminalShell";
import { TerminalHeader } from "@/components/terminal/TerminalHeader";

/** Read a cookie by name */
function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

/** Clear a cookie by name */
function clearCookie(name: string): void {
  document.cookie = `${name}=;path=/;max-age=0`;
}

/* ── Boot sequence items ───────────────────────────────────── */

const BOOT_SEQUENCE = [
  { text: "you.md v0.1.0", className: "text-[hsl(var(--accent))]", delay: 200 },
  { text: "identity context protocol for the agent internet", className: "text-[hsl(var(--text-secondary))] opacity-60", delay: 500 },
  { text: "", delay: 700 },
  { text: "loading identity protocol...", className: "text-[hsl(var(--text-secondary))] opacity-50", delay: 900 },
  { text: "connecting to agent network...", className: "text-[hsl(var(--text-secondary))] opacity-50", delay: 1200 },
  { text: "loading you-md/v1 engine...", className: "text-[hsl(var(--text-secondary))] opacity-50", delay: 1500 },
  { text: "  \u2713 identity schema loaded", className: "text-[hsl(var(--success))]", delay: 1800 },
  { text: "  \u2713 agent framework ready", className: "text-[hsl(var(--success))]", delay: 2000 },
  { text: "  \u2713 source connectors online", className: "text-[hsl(var(--success))]", delay: 2200 },
  { text: "", delay: 2400 },
];

/* ── Main component ────────────────────────────────────────── */

export function InitializeContent() {
  const { user } = useUser();
  const router = useRouter();
  const createUser = useMutation(api.users.createUser);
  const claimProfile = useMutation(api.profiles.claimProfile);

  const existingUser = useQuery(
    api.users.getByClerkId,
    user?.id ? { clerkId: user.id } : "skip"
  );

  // Check if there's an unclaimed profile from /create flow (session cookie)
  const [sessionToken] = useState<string | null>(() => {
    if (typeof document !== "undefined") {
      return getCookie("youmd_session");
    }
    return null;
  });
  const sessionProfile = useQuery(
    api.profiles.getBySessionToken,
    sessionToken ? { sessionToken } : "skip"
  );

  const [phase, setPhase] = useState<"boot" | "claim" | "portrait" | "ready" | "error">("boot");
  const [lines, setLines] = useState<{ id: string; content: ReactNode; className?: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const claimAttempted = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lineCounter = useRef(0);

  const addLine = useCallback((content: ReactNode, className?: string) => {
    const id = `l${lineCounter.current++}`;
    setLines((prev) => [...prev, { id, content, className }]);
  }, []);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [lines, phase]);

  // Redirect if user already exists
  useEffect(() => {
    if (existingUser && existingUser.username) {
      router.replace("/dashboard");
    }
  }, [existingUser, router]);

  // Run boot sequence and auto-claim
  useEffect(() => {
    if (!user || claimAttempted.current) return;
    if (existingUser !== null) return;
    if (existingUser === undefined) return;

    claimAttempted.current = true;

    const username =
      user.username ||
      user.firstName?.toLowerCase().replace(/[^a-z0-9-]/g, "") ||
      "user";

    // Boot sequence
    BOOT_SEQUENCE.forEach((item) => {
      setTimeout(() => {
        if (item.text) {
          addLine(item.text, item.className);
        } else {
          addLine("\u00A0");
        }
      }, item.delay);
    });

    // Claim username phase
    const claimDelay = 2600;
    setTimeout(() => {
      setPhase("claim");
      addLine(
        <span>
          claiming @<span className="text-[hsl(var(--accent))]">{username}</span>...
        </span>,
        "text-[hsl(var(--text-secondary))]"
      );
    }, claimDelay);

    // Create user in Convex (also auto-creates/claims profile in the mutation)
    setTimeout(async () => {
      try {
        await createUser({
          clerkId: user.id,
          username: username.toLowerCase(),
          email: user.emailAddresses[0]?.emailAddress ?? "",
          displayName: user.fullName ?? undefined,
        });

        // If there's an unclaimed profile from /create flow, claim it
        if (sessionProfile && sessionToken) {
          try {
            await claimProfile({
              clerkId: user.id,
              profileId: sessionProfile._id,
              sessionToken,
            });
          } catch {
            // Profile claim via session is best-effort — createUser may have already claimed it
          }
          clearCookie("youmd_session");
        }

        addLine(
          <span>
            <span className="text-[hsl(var(--success))]">{"\u2713"}</span>{" "}
            @<span className="text-[hsl(var(--accent))]">{username}</span>{" "}
            <span className="text-[hsl(var(--text-secondary))]">{"\u2014"} claimed and registered</span>
          </span>
        );
        addLine("\u00A0");

        // Portrait phase
        setTimeout(() => {
          setPhase("portrait");
          addLine("generating ascii portrait...", "text-[hsl(var(--text-secondary))] opacity-50");

          setTimeout(() => {
            const art = [
              "    \u2591\u2591\u2592\u2592\u2593\u2593\u2588\u2588\u2593\u2593\u2592\u2592\u2591\u2591    ",
              "  \u2591\u2592\u2593\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2593\u2592\u2591  ",
              "  \u2592\u2588\u2588\u2588    \u2588\u2588\u2588\u2588    \u2588\u2588\u2588\u2592  ",
              "  \u2593\u2588\u2588  \u25CF  \u2588\u2588\u2588\u2588  \u25CF  \u2588\u2588\u2593  ",
              "  \u2592\u2588\u2588\u2588    \u2588\u2588\u2588\u2588    \u2588\u2588\u2588\u2592  ",
              "  \u2591\u2592\u2593\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2593\u2592\u2591  ",
              "    \u2591\u2591\u2592\u2592\u2593\u2593\u2588\u2588\u2588\u2588\u2593\u2593\u2592\u2592\u2591\u2591    ",
            ];
            art.forEach((line) => addLine(
              <span className="text-[hsl(var(--accent-mid))]">{line}</span>
            ));
            addLine("\u00A0");

            setTimeout(() => {
              addLine(
                <span>
                  <span className="text-[hsl(var(--success))]">{"\u2713"}</span>{" "}
                  portrait generated {"\u2014"} 120 col detail
                </span>
              );
              addLine("\u00A0");
              setTimeout(() => setPhase("ready"), 400);
            }, 400);
          }, 600);
        }, 800);
      } catch (err) {
        setError(err instanceof Error ? err.message : "failed to claim username");
        setPhase("error");
      }
    }, claimDelay + 800);
  }, [user, existingUser, createUser, claimProfile, sessionProfile, sessionToken, addLine]);

  // Loading state
  if (!user || existingUser === undefined) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-[hsl(var(--bg))]">
        <p className="text-[hsl(var(--text-secondary))] font-mono text-sm animate-pulse">
          loading...
        </p>
      </div>
    );
  }

  // Boot/claim/portrait phase — show centered terminal
  if (phase !== "ready") {
    return (
      <div className="min-h-[100dvh] bg-[hsl(var(--bg))] flex flex-col">
        <div className="flex-1 flex flex-col max-w-3xl mx-auto w-full p-4">
          <div
            className="flex-1 flex flex-col bg-[hsl(var(--bg-raised))] border border-[hsl(var(--border))] overflow-hidden"
            style={{ borderRadius: "8px" }}
          >
            <TerminalHeader title="you.md — initialize" />
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-6 md:p-8 font-mono text-[14px] leading-relaxed"
            >
              {lines.map((line) => (
                <div key={line.id} className={line.className || ""}>
                  {line.content || "\u00A0"}
                </div>
              ))}
              {phase === "error" && (
                <div className="mt-2 space-y-2">
                  <div className="text-[hsl(var(--accent))]">ERR: {error}</div>
                  <button
                    onClick={() => router.push("/sign-up")}
                    className="text-[hsl(var(--accent-mid))] hover:text-[hsl(var(--accent))] transition-colors text-sm"
                  >
                    {"\u2192"} try again
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Ready — onboarding agent
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
    onDone: () => router.push("/dashboard"),
  });

  if (!convexUser) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-[hsl(var(--bg))]">
        <p className="text-[hsl(var(--text-secondary))] font-mono text-sm animate-pulse">
          loading...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[hsl(var(--bg))] flex flex-col">
      <div className="flex-1 flex flex-col max-w-3xl mx-auto w-full p-4">
        <div
          className="flex-1 flex flex-col bg-[hsl(var(--bg-raised))] border border-[hsl(var(--border))] overflow-hidden"
          style={{ borderRadius: "8px" }}
        >
          <TerminalHeader title="you.md — agent" />

          {/* Skip to dashboard */}
          <div className="flex items-center justify-between px-4 py-1.5 border-b border-[hsl(var(--border))]">
            <span className="text-[11px] font-mono text-[hsl(var(--text-secondary))] opacity-50">
              onboarding @{username}
            </span>
            <button
              onClick={() => router.push("/dashboard")}
              className="text-[11px] font-mono text-[hsl(var(--accent-mid))] hover:text-[hsl(var(--accent))] transition-colors"
            >
              skip {"\u2192"}
            </button>
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
    </div>
  );
}
