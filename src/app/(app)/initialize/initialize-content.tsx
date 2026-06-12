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

function sampleLine(line: string, maxCols: number): string {
  if (line.length <= maxCols) return line;
  const step = line.length / maxCols;
  let next = "";
  for (let col = 0; col < maxCols; col++) {
    next += line[Math.floor(col * step)] || "";
  }
  return next;
}

function fitPreRenderedPortrait(
  portrait: PreRenderedPortrait | undefined,
  maxCols: number,
  maxRows: number
): PreRenderedPortrait | undefined {
  if (!portrait?.lines?.length) return portrait;

  const rowCount = Math.min(maxRows, portrait.lines.length);
  const rowStep = portrait.lines.length / rowCount;
  const rows = Array.from({ length: rowCount }, (_, row) => Math.floor(row * rowStep));

  return {
    ...portrait,
    lines: rows.map((row) => sampleLine(portrait.lines[row] || "", maxCols)),
    coloredLines: portrait.coloredLines
      ? rows.map((row) => {
          const source = portrait.coloredLines?.[row] || [];
          if (source.length <= maxCols) return source;
          const step = source.length / maxCols;
          return Array.from(
            { length: maxCols },
            (_, col) => source[Math.floor(col * step)] || { char: " ", color: "transparent" }
          );
        })
      : undefined,
    cols: Math.min(maxCols, portrait.cols || maxCols),
    rows: rowCount,
  };
}

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

/**
 * Boot lines are gated on real readiness events where one exists:
 * - "auth"           -> web session resolved (useUser returned a user)
 * - "agentNetwork"   -> Convex websocket auth established (useConvexAuth)
 * - "userQuery"      -> users.getByClerkId query resolved
 * - "sessionProfile" -> profiles.getBySessionToken resolved (or no session cookie)
 *
 * A line is appended only after its min delay elapses AND its gate is open,
 * so a checkmark never claims "ready" while the real dependency is loading.
 * Ungated lines stay on short timers. If a gate had to be waited on, the
 * line resumes near-instantly once the gate opens.
 */
type BootGate = "auth" | "agentNetwork" | "userQuery" | "sessionProfile";

const BOOT_STEPS: { text: string; className?: string; delay: number; gate?: BootGate }[] = [
  { text: "you.md", className: "text-[hsl(var(--accent))]", delay: 200 },
  { text: "agent brain + expertise stacks for the agent internet", className: "text-[hsl(var(--text-secondary))] opacity-60", delay: 300 },
  { text: "", delay: 200 },
  { text: "loading brain runtime...", className: "text-[hsl(var(--text-secondary))] opacity-50", delay: 200, gate: "auth" },
  { text: "connecting to agent network...", className: "text-[hsl(var(--text-secondary))] opacity-50", delay: 300 },
  { text: "loading you-md/v1 engine...", className: "text-[hsl(var(--text-secondary))] opacity-50", delay: 300 },
  { text: "  \u2713 brain schema loaded", className: "text-[hsl(var(--success))]", delay: 300, gate: "userQuery" },
  { text: "  \u2713 agent framework ready", className: "text-[hsl(var(--success))]", delay: 200, gate: "agentNetwork" },
  { text: "  \u2713 source connectors online", className: "text-[hsl(var(--success))]", delay: 200, gate: "sessionProfile" },
  { text: "", delay: 200 },
];

/** Per-line delay once the user has requested skip */
const SKIP_DELAY = 25;
/** Delay used when a line was blocked on a gate and the gate just opened */
const GATE_RESUME_DELAY = 50;

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
  // Used to decide whether onboarding actually finished (see redirect effect below)
  const existingBundle = useQuery(
    api.bundles.getLatestBundle,
    user?.id && existingUser?._id ? { clerkId: user.id, userId: existingUser._id } : "skip"
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
  // State mirror of claimAttempted for use during render (refs can't be read in render)
  const [claimFlowActive, setClaimFlowActive] = useState(false);
  // How many boot lines have been emitted so far
  const [bootIndex, setBootIndex] = useState(0);
  // Enter / click fast-forwards the remaining boot theater
  const [skipRequested, setSkipRequested] = useState(false);
  const skipRef = useRef(false);
  // id of the honest "still loading..." line shown when skip hits a pending gate
  const stillLoadingId = useRef<string | null>(null);
  // index of the boot line currently blocked on a real readiness gate (if any)
  const blockedAtIndex = useRef<number | null>(null);
  const claimStarted = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lineCounter = useRef(0);

  const addLine = useCallback((content: ReactNode, className?: string) => {
    const id = `l${lineCounter.current++}`;
    setLines((prev) => [...prev, { id, content, className }]);
    return id;
  }, []);

  /* Real readiness signals each boot gate maps to */
  const authReady = Boolean(user);
  const agentNetworkReady = isAuthenticated;
  const userQueryReady = existingUser !== undefined;
  const sessionProfileReady = !sessionToken || sessionProfile !== undefined;

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [lines, phase]);

  // Redirect only when onboarding actually finished. A bare username alone means
  // a half-initialized account (claimed handle, never finished onboarding) — those
  // resume the onboarding agent instead of skipping ahead. There is no explicit
  // onboardingComplete flag in the client payload, so the closest truthful proxy
  // is a published bundle (onboarding auto-publishes after the first saved update).
  useEffect(() => {
    // Fresh sign-up flow (claim in progress) manages its own phase transitions
    if (claimAttempted.current) return;
    if (!existingUser?.username) return;
    if (existingBundle === undefined) return; // bundle query still loading
    if (existingBundle?.isPublished) {
      router.replace("/shell");
    }
  }, [existingUser, existingBundle, router]);

  // Start the boot flow for fresh sign-ups (no Convex user yet)
  useEffect(() => {
    if (!user || claimAttempted.current) return;
    // Wait for query to finish loading
    if (existingUser === undefined) return;
    // If user already exists, the redirect effect above will handle it
    if (existingUser !== null) return;

    // existingUser is null — no Convex user yet, time to create
    claimAttempted.current = true;
    // Mirror into state for render-time checks (deferred — lint forbids sync setState in effects)
    setTimeout(() => setClaimFlowActive(true), 0);
  }, [user, existingUser]);

  // Keep a ref mirror of skipRequested for async callbacks below
  useEffect(() => {
    skipRef.current = skipRequested;
  }, [skipRequested]);

  // Enter fast-forwards the remaining boot theater
  useEffect(() => {
    if (!claimFlowActive || skipRequested) return;
    if (phase === "ready" || phase === "error") return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Enter") {
        event.preventDefault();
        setSkipRequested(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [claimFlowActive, skipRequested, phase]);

  // Advance the boot sequence one line at a time. Each line waits for its
  // min delay AND its readiness gate (a real event) before appearing — a
  // checkmark never claims "ready" while its dependency is still loading,
  // and when data resolves fast the lines accelerate instead of stalling.
  useEffect(() => {
    if (!claimFlowActive || phase === "error") return;
    if (bootIndex >= BOOT_STEPS.length) return;

    const step = BOOT_STEPS[bootIndex];
    const gates: Record<BootGate, boolean> = {
      auth: authReady,
      agentNetwork: agentNetworkReady,
      userQuery: userQueryReady,
      sessionProfile: sessionProfileReady,
    };
    const gateOpen = !step.gate || gates[step.gate];

    if (!gateOpen) {
      blockedAtIndex.current = bootIndex;
      // Skip was requested but a real dependency is pending — show a single
      // honest "still loading..." line until it resolves
      if (skipRequested && stillLoadingId.current === null) {
        const timer = setTimeout(() => {
          stillLoadingId.current = addLine(
            "still loading...",
            "text-[hsl(var(--text-secondary))] opacity-50 animate-pulse"
          );
        }, 0);
        return () => clearTimeout(timer);
      }
      return; // effect re-runs when the gate's readiness signal flips
    }

    const delay = skipRequested
      ? SKIP_DELAY
      : blockedAtIndex.current === bootIndex
        ? GATE_RESUME_DELAY
        : step.delay;
    const timer = setTimeout(() => {
      if (stillLoadingId.current !== null) {
        const removeId = stillLoadingId.current;
        stillLoadingId.current = null;
        setLines((prev) => prev.filter((line) => line.id !== removeId));
      }
      addLine(step.text, step.className);
      setBootIndex((index) => index + 1);
    }, delay);
    return () => clearTimeout(timer);
  }, [
    claimFlowActive,
    phase,
    bootIndex,
    skipRequested,
    authReady,
    agentNetworkReady,
    userQueryReady,
    sessionProfileReady,
    addLine,
  ]);

  // Claim phase — runs once every boot line (and its real gate) has finished.
  // The "claimed and registered" checkmark is tied to the actual createUser
  // mutation resolving, and the sessionProfile gate above guarantees any
  // unclaimed /create-flow profile is known before we claim.
  useEffect(() => {
    if (!claimFlowActive || phase === "error") return;
    if (bootIndex < BOOT_STEPS.length) return;
    if (claimStarted.current || !user) return;

    const username =
      user.username ||
      user.firstName?.toLowerCase().replace(/[^a-z0-9-]/g, "") ||
      "user";

    const timer = setTimeout(async () => {
      if (claimStarted.current) return;
      claimStarted.current = true;
      setPhase("claim");
      addLine(
        <span>
          claiming @<span className="text-[hsl(var(--accent))]">{username}</span>...
        </span>,
        "text-[hsl(var(--text-secondary))]"
      );
      try {
        // Create user in Convex (also auto-creates/claims profile in the mutation)
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
            <span className="text-[hsl(var(--success))]">{"✓"}</span>{" "}
            @<span className="text-[hsl(var(--accent))]">{username}</span>{" "}
            <span className="text-[hsl(var(--text-secondary))]">{"—"} claimed and registered</span>
          </span>
        );
        addLine("");

        // Proceed to onboarding agent
        setTimeout(() => {
          addLine(
            <span className="text-[hsl(var(--success))]">{"✓"} identity engine ready</span>
          );
          addLine("");
          setTimeout(() => setPhase("ready"), skipRef.current ? SKIP_DELAY : 400);
        }, skipRef.current ? SKIP_DELAY : 800);
      } catch (err) {
        setError(err instanceof Error ? err.message : "failed to claim username");
        setPhase("error");
      }
    }, skipRef.current ? SKIP_DELAY : 300);
    return () => clearTimeout(timer);
  }, [
    claimFlowActive,
    phase,
    bootIndex,
    user,
    createUser,
    claimProfile,
    sessionProfile,
    sessionToken,
    addLine,
  ]);

  // Returning half-initialized user: claimed handle exists but nothing was ever
  // published — skip the claim boot animation and resume the onboarding agent
  const resumeOnboarding =
    !claimFlowActive &&
    Boolean(existingUser?.username) &&
    existingBundle !== undefined &&
    !existingBundle?.isPublished;

  // Loading state — for returning users, also wait for the bundle check (and the
  // /shell redirect, if published) so the resume-vs-redirect decision happens
  // before any boot UI renders
  if (
    !user ||
    existingUser === undefined ||
    (!claimFlowActive &&
      existingUser?.username &&
      (existingBundle === undefined || existingBundle?.isPublished))
  ) {
    return (
      <main className="min-h-[100dvh] flex items-center justify-center bg-[hsl(var(--bg))]">
        <p className="text-[hsl(var(--text-secondary))] font-mono text-sm animate-pulse">
          loading...
        </p>
      </main>
    );
  }

  // Boot/claim phase — show centered terminal
  if (phase !== "ready" && !resumeOnboarding) {
    return (
      <main className="min-h-[100dvh] bg-[hsl(var(--bg))] flex flex-col">
        <div className="flex-1 flex flex-col max-w-3xl mx-auto w-full p-4">
          <div
            className="flex-1 flex flex-col bg-[hsl(var(--bg-raised))] border border-[hsl(var(--border))] overflow-hidden"
            style={{ borderRadius: "2px" }}
            onClick={() => setSkipRequested(true)}
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
              {!skipRequested && phase !== "error" && (
                <div className="mt-4 text-[11px] text-[hsl(var(--text-secondary))] opacity-40 select-none">
                  press enter to skip
                </div>
              )}
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
2. immediately ask for their x (twitter) or github username so you can generate their ascii portrait. say some version of: "first things first — drop me your x or github username and i'll generate your ascii portrait. it's the visual signature of your brain."
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
  const compactPortrait = fitPreRenderedPortrait(storedPortrait, 44, 12);
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

      <div className="grid gap-4 md:grid-cols-[minmax(150px,220px)_minmax(0,1fr)] md:items-center">
        <div className="min-w-0 max-w-[220px]">
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
                cols={44}
                canvasWidth={220}
                format="classic"
                className="block w-full"
                preRendered={compactPortrait}
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
