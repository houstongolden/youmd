"use client";

import { useUser } from "@/lib/you-auth";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { api } from "../../../../convex/_generated/api";
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
  const { isAuthenticated } = useConvexAuth();
  const router = useRouter();
  const createUser = useMutation(api.users.createUser);
  const claimProfile = useMutation(api.profiles.claimProfile);

  const existingUser = useQuery(
    api.users.getByClerkId,
    isAuthenticated && user?.id ? { clerkId: user.id } : "skip"
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

  const [phase, setPhase] = useState<"boot" | "claim" | "ready" | "error">("boot");
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
      router.replace("/shell");
    }
  }, [existingUser, router]);

  // Run boot sequence and auto-claim
  useEffect(() => {
    if (!user || claimAttempted.current) return;
    // Wait for query to finish loading
    if (existingUser === undefined) return;
    // If user already exists, the redirect effect above will handle it
    if (existingUser !== null) return;

    // existingUser is null — no Convex user yet, time to create
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

        // Proceed to onboarding agent
        setTimeout(() => {
          addLine(
            <span className="text-[hsl(var(--success))]">{"\u2713"} identity engine ready</span>
          );
          addLine("\u00A0");
          setTimeout(() => setPhase("ready"), 400);
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
      <main className="min-h-[100dvh] flex items-center justify-center bg-[hsl(var(--bg))]">
        <p className="text-[hsl(var(--text-secondary))] font-mono text-sm animate-pulse">
          loading...
        </p>
      </main>
    );
  }

  // Boot/claim phase — show centered terminal
  if (phase !== "ready") {
    return (
      <main className="min-h-[100dvh] bg-[hsl(var(--bg))] flex flex-col">
        <div className="flex-1 flex flex-col max-w-3xl mx-auto w-full p-4">
          <div
            className="flex-1 flex flex-col bg-[hsl(var(--bg-raised))] border border-[hsl(var(--border))] overflow-hidden"
            style={{ borderRadius: "2px" }}
          >
            <TerminalHeader title="you.md — initialize" asHeading />
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
      </main>
    );
  }

  // Ready — onboarding agent
  return <OnboardingTerminal />;
}

/* ── Onboarding Terminal ───────────────────────────────────── */

function OnboardingTerminal() {
  const router = useRouter();
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

  const username = convexUser?.username || user?.username || "";

  const profileContext = buildProfileContext(
    (latestBundle?.youJson as Record<string, unknown>) || null
  );

  const onboardingGreeting = `${profileContext}\n\nthe user just signed up and claimed the username "${username}". this is their first time here.

instructions for this greeting:
1. greet them warmly by username. introduce yourself in one sentence — you're the you.md agent, you help build identity context protocols for the agent internet.
2. immediately ask for their x (twitter) or github username so you can generate their ascii portrait. say something like: "first things first — drop me your x or github username and i'll generate your ascii portrait. it's your identity in code."
3. be genuinely curious and specific, not generic. make them feel like this is going to be a real conversation, not a form.
4. keep it to 3-4 sentences max. no lists. no "here's what we'll do" — just start the conversation.
5. terminal-native: lowercase, no emoji, no exclamation marks.`;

  const agent = useYouAgent({
    isOnboarding: true,
    onboardingGreeting,
    onDone: () => router.push("/shell"),
  });

  if (!convexUser) {
    return (
      <main className="min-h-[100dvh] flex items-center justify-center bg-[hsl(var(--bg))]">
        <p className="text-[hsl(var(--text-secondary))] font-mono text-sm animate-pulse">
          loading...
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-[100dvh] bg-[hsl(var(--bg))] flex flex-col">
      <div className="flex-1 flex flex-col max-w-3xl mx-auto w-full p-4">
        <div
          className="flex-1 flex flex-col bg-[hsl(var(--bg-raised))] border border-[hsl(var(--border))] overflow-hidden"
          style={{ borderRadius: "2px" }}
        >
          <TerminalHeader title="you.md — agent" asHeading />

          {/* Skip to dashboard */}
          <div className="flex items-center justify-between px-4 py-1.5 border-b border-[hsl(var(--border))]">
            <span className="text-[11px] font-mono text-[hsl(var(--text-secondary))] opacity-50">
              onboarding @{username}
            </span>
            <button
              onClick={() => router.push("/shell")}
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
    </main>
  );
}
