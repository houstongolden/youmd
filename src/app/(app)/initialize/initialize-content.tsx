"use client";

import { useUser } from "@/lib/you-auth";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useRouter } from "next/navigation";
import { useState, useEffect, useRef, useCallback, type ReactNode } from "react";
import { useYouAgent, buildProfileContext } from "@/hooks/useYouAgent";
import { TerminalShell } from "@/components/terminal/TerminalShell";
import { TerminalHeader } from "@/components/terminal/TerminalHeader";
import AsciiAvatar from "@/components/AsciiAvatar";
import type { PreRenderedPortrait } from "@/components/AsciiAvatar";

const BOT_LINES = [
  "   ▄▄▄▄▄   ",
  "  █ ▄▄ █   ",
  "  █ ◉◉ █   ",
  "  █ ▀▀ █   ",
  "  ██████   ",
  " ▄█ ██ █▄  ",
  "   ▀  ▀    ",
];

const YOU_LOGO_LINES = [
  "  ██╗   ██╗   ██████╗   ██╗   ██╗",
  "  ╚██╗ ██╔╝  ██╔═══██╗  ██║   ██║",
  "   ╚████╔╝   ██║   ██║  ██║   ██║",
  "    ╚██╔╝    ██║   ██║  ██║   ██║",
  "     ██║     ╚██████╔╝  ╚██████╔╝",
  "     ╚═╝      ╚═════╝    ╚═════╝ ",
];

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
  { text: "you.md", className: "text-[hsl(var(--accent))]", delay: 200 },
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
  const userProfile = useQuery(
    api.profiles.getByOwnerId,
    convexUser?._id ? { ownerId: convexUser._id } : "skip"
  );

  const username = convexUser?.username || user?.username || "";

  const profileContext = buildProfileContext(
    (latestBundle?.youJson as Record<string, unknown>) || null
  );
  const knownProjects = Array.isArray((latestBundle?.youJson as Record<string, unknown> | null)?.projects)
    ? ((latestBundle?.youJson as Record<string, unknown>).projects as Array<Record<string, unknown>>)
        .map((project) => String(project.name || "").trim())
        .filter(Boolean)
        .slice(0, 3)
    : [];
  const projectHint =
    knownProjects.length > 0
      ? `if the saved context already points at projects like ${knownProjects.map((name) => `"${name}"`).join(", ")}, mention one naturally so the user feels recognized immediately.`
      : "if we do not know much yet, lean into the clean-slate energy without sounding generic.";

  const onboardingGreeting = `${profileContext}\n\nthe user just signed up and claimed the username "${username}". this is their first time here.

instructions for this greeting:
1. greet them by username and introduce yourself as U in one sentence. sound like the same wingman they meet in the local \`you\` launcher.
2. immediately ask for their x (twitter) or github username so you can generate their ascii portrait. say some version of: "first things first — drop me your x or github username and i'll generate your ascii portrait. it's your identity in code."
3. be genuinely curious and specific, not generic. this should feel like a real encounter, not a form.
4. ${projectHint}
5. keep it to 3-4 sentences max. no lists. no "here's what we'll do" — just start the conversation.
6. terminal-native: lowercase, no emoji, no exclamation marks.`;

  const agent = useYouAgent({
    isOnboarding: true,
    onboardingGreeting,
    onDone: () => router.push("/shell"),
  });
  const storedPortrait = userProfile?.asciiPortrait as PreRenderedPortrait | undefined;
  const profileMeta = ((latestBundle?.youJson as Record<string, unknown> | null)?._profile ??
    null) as Record<string, unknown> | null;
  const bundleAvatarUrl =
    profileMeta && typeof profileMeta.avatarUrl === "string" ? profileMeta.avatarUrl : "";
  const avatarUrl = userProfile?.avatarUrl || bundleAvatarUrl;

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

          {/* Skip to shell */}
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

          <div className="border-b border-[hsl(var(--border))] px-4 py-4 bg-[hsl(var(--bg))]">
            <InitializeEncounter
              username={username}
              displayName={convexUser?.displayName || user?.fullName || username}
              avatarUrl={avatarUrl}
              storedPortrait={storedPortrait}
              knownProjects={knownProjects}
            />
          </div>

          <TerminalShell
            displayMessages={agent.displayMessages}
            input={agent.input}
            setInput={agent.setInput}
            isThinking={agent.isThinking}
            thinkingPhrase={agent.thinkingPhrase}
            thinkingCategory={agent.thinkingCategory}
            progressSteps={agent.progressSteps}
            messagesEndRef={agent.messagesEndRef}
            textareaRef={agent.textareaRef}
            sendMessage={agent.sendMessage}
          />
        </div>
      </div>
    </main>
  );
}

function InitializeEncounter({
  username,
  displayName,
  avatarUrl,
  storedPortrait,
  knownProjects,
}: {
  username: string;
  displayName: string;
  avatarUrl?: string;
  storedPortrait?: PreRenderedPortrait;
  knownProjects: string[];
}) {
  const firstName = displayName.split(" ")[0] || username;
  const speechLines = [
    `hi ${firstName}, i'm U.`,
    "i help other agents know you.",
    knownProjects.length > 0
      ? `i already know a little about ${knownProjects.slice(0, 2).join(" and ")}.`
      : "first things first — let's render your face in code.",
    "drop your x or github username and i'll get to work.",
  ];

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto border-b border-[hsl(var(--border))] pb-4">
        <pre className="font-mono text-[10px] sm:text-[12px] leading-[1.05] text-[hsl(var(--accent))] whitespace-pre">
          {YOU_LOGO_LINES.join("\n")}
        </pre>
        <div className="mt-2 font-mono text-[11px] text-[hsl(var(--text-secondary))] opacity-70">
          ──────────────────────────────────
        </div>
        <div className="mt-1 font-mono text-[12px] text-[hsl(var(--text-secondary))] opacity-80">
          <span className="text-[hsl(var(--text-secondary))] opacity-90">you.md</span> — identity for the agent internet
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_260px] md:items-center">
      <div className="min-w-0">
        <div className="mb-3 text-[10px] font-mono uppercase tracking-[0.18em] text-[hsl(var(--accent))] opacity-70">
          there you are
        </div>
        <div
          className="border border-[hsl(var(--border))] bg-[hsl(var(--bg-raised))] overflow-hidden"
          style={{ borderRadius: "2px" }}
        >
          {avatarUrl || storedPortrait ? (
            <AsciiAvatar
              src={avatarUrl || ""}
              cols={120}
              canvasWidth={520}
              format="classic"
              className="block w-full"
              preRendered={storedPortrait}
            />
          ) : (
            <div className="px-4 py-8 font-mono text-[11px] leading-relaxed text-[hsl(var(--text-secondary))] opacity-70">
              portrait incoming.
              <br />
              give U your x or github username and this turns into your face in code.
            </div>
          )}
        </div>
      </div>

      <div className="font-mono text-[12px] leading-relaxed text-[hsl(var(--text-secondary))]">
        <div className="mb-3 whitespace-pre text-[hsl(var(--accent))] opacity-90">
          {BOT_LINES.join("\n")}
        </div>
        <div className="space-y-1">
          {speechLines.map((line, index) => (
            <div key={line} className="whitespace-pre-wrap">
              {index === 0 ? `> ${line}` : `  ${line}`}
            </div>
          ))}
        </div>
      </div>
    </div>
    </div>
  );
}
