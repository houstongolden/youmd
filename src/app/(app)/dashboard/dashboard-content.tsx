"use client";

import { useUser } from "@/lib/you-auth";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useYouAgent, type RightPane } from "@/hooks/useYouAgent";
import { TerminalShell } from "@/components/terminal/TerminalShell";
import { TerminalHeader } from "@/components/terminal/TerminalHeader";
import { EditPane } from "@/components/panes/EditPane";
import { SharePane } from "@/components/panes/SharePane";
import { SettingsPane } from "@/components/panes/SettingsPane";
import dynamic from "next/dynamic";

// Heavy panes — lazy-loaded so their JS only ships when the right-pane is opened.
// A brief pulse skeleton fills the slot while the chunk loads.
const PaneSkeleton = () => (
  <div className="flex-1 p-4 space-y-4 animate-pulse">
    <div className="w-40 h-4 bg-[hsl(var(--text-secondary))] opacity-10 rounded-sm" />
    <div className="w-full h-24 bg-[hsl(var(--text-secondary))] opacity-[0.06] rounded-sm" />
    <div className="w-2/3 h-4 bg-[hsl(var(--text-secondary))] opacity-[0.06] rounded-sm" />
  </div>
);

const PortraitPane = dynamic(
  () => import("@/components/panes/PortraitPane").then((m) => ({ default: m.PortraitPane })),
  { ssr: false, loading: PaneSkeleton }
);
const SkillsPane = dynamic(
  () => import("@/components/panes/SkillsPane").then((m) => ({ default: m.SkillsPane })),
  { ssr: false, loading: PaneSkeleton }
);
const HistoryPane = dynamic(
  () => import("@/components/panes/HistoryPane").then((m) => ({ default: m.HistoryPane })),
  { ssr: false, loading: PaneSkeleton }
);
const AnalyticsPane = dynamic(
  () => import("@/components/panes/AnalyticsPane").then((m) => ({ default: m.AnalyticsPane })),
  { ssr: false, loading: PaneSkeleton }
);
const AgentsPane = dynamic(
  () => import("@/components/panes/AgentsPane").then((m) => ({ default: m.AgentsPane })),
  { ssr: false, loading: PaneSkeleton }
);
const VaultPane = dynamic(
  () => import("@/components/panes/VaultPane").then((m) => ({ default: m.VaultPane })),
  { ssr: false, loading: PaneSkeleton }
);
const FilesPane = dynamic(
  () => import("@/components/panes/FilesPane").then((m) => ({ default: m.FilesPane })),
  { ssr: false, loading: PaneSkeleton }
);
const GithubPane = dynamic(
  () => import("@/components/panes/GithubPane").then((m) => ({ default: m.GithubPane })),
  { ssr: false, loading: PaneSkeleton }
);
// Eager panes (commonly accessed on first open — keep synchronous)
import { HelpPane } from "@/components/panes/HelpPane";
import { StacksPane } from "@/components/panes/StacksPane";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ProfileContent } from "../[username]/profile-content";

type PrimaryPaneGroup = "profile" | "content" | "share" | "agents" | "insights" | "portrait" | "account" | "integrations";

const PANE_GROUPS: Array<{
  key: PrimaryPaneGroup;
  label: string;
  defaultPane: RightPane;
  panes: Array<{ key: RightPane; label: string }>;
}> = [
  {
    key: "profile",
    label: "profile",
    defaultPane: "profile",
    panes: [{ key: "profile", label: "profile" }],
  },
  {
    key: "content",
    label: "files",
    defaultPane: "files",
    panes: [
      { key: "files", label: "files" },
      { key: "history", label: "history" },
    ],
  },
  {
    key: "share",
    label: "share",
    defaultPane: "share",
    panes: [{ key: "share", label: "share" }],
  },
  {
    key: "agents",
    label: "stacks",
    defaultPane: "stacks",
    panes: [
      { key: "stacks", label: "stacks" },
      { key: "skills", label: "skills" },
      { key: "agents", label: "activity" },
    ],
  },
  {
    // analytics = aggregate stats (views, reads, referrers);
    // "activity" (the agent event log) lives under stacks → AgentsPane
    key: "insights",
    label: "analytics",
    defaultPane: "analytics",
    panes: [{ key: "analytics", label: "analytics" }],
  },
  {
    key: "portrait",
    label: "portrait",
    defaultPane: "portrait",
    panes: [{ key: "portrait", label: "portrait" }],
  },
  {
    key: "integrations",
    label: "github",
    defaultPane: "github",
    panes: [{ key: "github", label: "github" }],
  },
  {
    key: "account",
    label: "account",
    defaultPane: "settings",
    panes: [
      { key: "settings", label: "settings" },
      { key: "vault", label: "secrets" },
      { key: "help", label: "help" },
    ],
  },
];

const MOBILE_PRIMARY_PANES: Array<{ key: PrimaryPaneGroup | "terminal"; label: string }> = [
  { key: "terminal", label: "shell" },
  ...PANE_GROUPS.map((group) => ({ key: group.key, label: group.label })),
];

const PANEL_OPEN_STORAGE_KEY = "youmd.dashboard.panelOpen";
const STALE_NUDGE_SESSION_KEY = "youmd.dashboard.staleNudgeShown";
const STALE_NUDGE_DAYS = 7;
const FRESH_WINDOW_MS = 24 * 60 * 60 * 1000;

function formatRelativeTime(ts: number): string {
  const diffMin = Math.floor((Date.now() - ts) / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}

function isFreshTimestamp(ts: number): boolean {
  return Date.now() - ts < FRESH_WINDOW_MS;
}

/**
 * Once-per-session staleness nudge. Computed lazily on the first render where
 * bundle data has loaded; result is cached for the page lifetime so the line
 * stays stable across re-renders, and a sessionStorage guard ensures the nudge
 * fires at most once per tab session (reloads included).
 */
let staleNoticeCache: string | null | undefined;
function getStaleNotice(syncedAt: number | null): string | null {
  if (staleNoticeCache !== undefined) return staleNoticeCache;
  if (typeof window === "undefined") return null; // never cache during SSR
  if (syncedAt == null) {
    staleNoticeCache = null;
    return null;
  }
  const days = Math.floor((Date.now() - syncedAt) / 86400000);
  if (days < STALE_NUDGE_DAYS) {
    staleNoticeCache = null;
    return null;
  }
  try {
    if (window.sessionStorage.getItem(STALE_NUDGE_SESSION_KEY) === "1") {
      staleNoticeCache = null;
      return null;
    }
    window.sessionStorage.setItem(STALE_NUDGE_SESSION_KEY, "1");
  } catch {
    // sessionStorage unavailable — skip the nudge rather than risk repeating it
    staleNoticeCache = null;
    return null;
  }
  staleNoticeCache = `your profile hasn't changed in ${days} days — tell me what's new and i'll update it`;
  return staleNoticeCache;
}

/** Status-bar freshness segment: dim relative time + green dot (<24h) / orange dot (older). */
function FreshnessSegment({ timestamp }: { timestamp: number }) {
  // Re-render once a minute so the relative label stays honest
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(id);
  }, []);
  const isFresh = isFreshTimestamp(timestamp);
  return (
    <span className="flex items-center gap-1.5" title={new Date(timestamp).toLocaleString()}>
      <span
        role="img"
        aria-label={isFresh ? "fresh" : "stale"}
        className={`w-1.5 h-1.5 rounded-full ${
          isFresh ? "bg-[hsl(var(--success))]" : "bg-[hsl(var(--accent))]"
        }`}
      />
      <span className="opacity-40">synced {formatRelativeTime(timestamp)}</span>
    </span>
  );
}

/** Open by default; persisted user choice wins. Read lazily so SSR never touches localStorage. */
function readStoredPanelOpen(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(PANEL_OPEN_STORAGE_KEY) !== "false";
  } catch {
    return true;
  }
}

export function DashboardContent() {
  const { user } = useUser();
  const { isAuthenticated } = useConvexAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  // Gate on isAuthenticated so the query only fires AFTER Convex has
  // validated the custom JWT. Without this, there's a timing window
  // where user?.id is set from the session bootstrap but getUserIdentity()
  // returns null on the server, causing requireOwner to throw.
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
  const githubConnection = useQuery(
    api.github.getConnection,
    isAuthenticated && user?.id ? { clerkId: user.id } : "skip"
  );

  // Post-OAuth redirect lands at /shell?integration=github — open the github
  // pane from the initial state (deriving here avoids a setState-in-effect that
  // can trigger cascading renders).
  const wantsGithub = searchParams.get("integration") === "github";
  const [rightPane, setRightPane] = useState<RightPane>(wantsGithub ? "github" : "profile");
  const [mobileView, setMobileView] = useState<"terminal" | "preview">("terminal");
  const [panelOpen, setPanelOpen] = useState<boolean>(() =>
    wantsGithub ? true : readStoredPanelOpen()
  );

  // Staleness nudge — derived once bundle data loads; guarded once per session
  const staleNotice =
    latestBundle === undefined
      ? null
      : getStaleNotice(latestBundle ? latestBundle.publishedAt ?? latestBundle.createdAt : null);

  // Persist the user's panel choice
  useEffect(() => {
    try {
      window.localStorage.setItem(PANEL_OPEN_STORAGE_KEY, String(panelOpen));
    } catch {
      // localStorage unavailable (private mode etc.) — non-fatal
    }
  }, [panelOpen]);

  const createUser = useMutation(api.users.createUser);
  const claimProfile = useMutation(api.profiles.claimProfile);
  const autoCreateAttempted = useRef(false);

  const agent = useYouAgent({
    onPaneSwitch: (pane) => {
      setRightPane(pane);
      setMobileView("preview");
      setPanelOpen(true); // auto-open the panel when agent switches to it
    },
    // Pass the connected repo name so the agent runs the post-connect protocol.
    // githubConnection is null when not connected, undefined while loading.
    // repoFullName is null until the user creates/connects a repo.
    githubRepoName: githubConnection?.repoFullName ?? null,
  });

  const isWritingFiles = agent.progressSteps.some(
    (s) => s.status === "running" && s.label === "writing profile files"
  );

  // Auto-create Convex user for /create flow (session cookie present),
  // or redirect to /initialize for /sign-up flow users
  useEffect(() => {
    if (convexUser === null && user && !autoCreateAttempted.current) {
      // Check for session cookie from /create flow
      const sessionMatch = document.cookie.match(/(?:^|; )youmd_session=([^;]*)/);
      const sessionToken = sessionMatch ? decodeURIComponent(sessionMatch[1]) : null;

      if (sessionToken) {
        // /create flow — auto-create Convex user + claim profile
        autoCreateAttempted.current = true;
        const username = user.username || user.firstName?.toLowerCase().replace(/[^a-z0-9-]/g, "") || "user";

        (async () => {
          try {
            await createUser({
              clerkId: user.id,
              username: username.toLowerCase(),
              email: user.emailAddresses[0]?.emailAddress ?? "",
              displayName: user.fullName ?? undefined,
            });
            // Clear session cookie
            document.cookie = "youmd_session=;path=/;max-age=0";
          } catch (err) {
            console.error("auto-create user failed:", err);
            // Fallback: redirect to /initialize
            router.replace("/initialize");
          }
        })();
      } else {
        // /sign-up flow — redirect to /initialize for full boot sequence
        router.replace("/initialize");
      }
    }
  }, [convexUser, user, createUser, claimProfile, router]);

  if (!convexUser) {
    return (
      <main aria-busy="true" className="h-[calc(100dvh-2.25rem)] bg-[hsl(var(--bg))] flex flex-col">
        <div className="flex-1 flex flex-col max-w-[1400px] mx-auto w-full p-0 md:p-4 min-h-0">
          <div
            className="flex-1 flex flex-col bg-[hsl(var(--bg-raised))] md:border md:border-[hsl(var(--border))] overflow-hidden min-h-0"
            style={{ borderRadius: "0px" }}
          >
            {/* Skeleton header */}
            <div className="hidden md:block px-4 py-2 border-b border-[hsl(var(--border))]">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-[hsl(var(--text-secondary))] opacity-10" />
                <div className="w-2.5 h-2.5 rounded-full bg-[hsl(var(--text-secondary))] opacity-10" />
                <div className="w-2.5 h-2.5 rounded-full bg-[hsl(var(--text-secondary))] opacity-10" />
                <div className="w-24 h-3 bg-[hsl(var(--text-secondary))] opacity-10 ml-2 rounded-sm" />
              </div>
            </div>
            {/* Skeleton status bar */}
            <div className="hidden md:flex items-center px-4 py-1.5 border-b border-[hsl(var(--border))]">
              <div className="w-48 h-3 bg-[hsl(var(--text-secondary))] opacity-10 rounded-sm animate-pulse" />
            </div>
            {/* Skeleton split layout */}
            <div className="flex-1 flex min-h-0">
              {/* Left: terminal skeleton — mirrors the panelOpen split so there is no layout flash */}
              <div
                className={`w-full ${
                  panelOpen ? "md:w-[35%] md:border-r md:border-[hsl(var(--border))]" : "md:w-full"
                } flex flex-col p-4 gap-3 animate-pulse`}
              >
                <div className="w-32 h-3 bg-[hsl(var(--text-secondary))] opacity-10 rounded-sm" />
                <div className="w-full h-3 bg-[hsl(var(--text-secondary))] opacity-[0.06] rounded-sm" />
                <div className="w-3/4 h-3 bg-[hsl(var(--text-secondary))] opacity-[0.06] rounded-sm" />
                <div className="flex-1" />
                <div className="w-full h-8 bg-[hsl(var(--text-secondary))] opacity-[0.06] rounded-sm" />
              </div>
              {/* Right: pane skeleton */}
              <div className={`hidden ${panelOpen ? "md:flex" : "md:hidden"} md:w-[65%] flex-col`}>
                <div className="flex items-center px-4 py-1.5 border-b border-[hsl(var(--border))] gap-2 animate-pulse">
                  <div className="w-14 h-5 bg-[hsl(var(--text-secondary))] opacity-10 rounded-sm" />
                  <div className="w-14 h-5 bg-[hsl(var(--text-secondary))] opacity-[0.06] rounded-sm" />
                  <div className="w-14 h-5 bg-[hsl(var(--text-secondary))] opacity-[0.06] rounded-sm" />
                </div>
                <div className="flex-1 p-4 space-y-4 animate-pulse">
                  <div className="w-40 h-4 bg-[hsl(var(--text-secondary))] opacity-10 rounded-sm" />
                  <div className="w-full h-24 bg-[hsl(var(--text-secondary))] opacity-[0.06] rounded-sm" />
                  <div className="w-2/3 h-4 bg-[hsl(var(--text-secondary))] opacity-[0.06] rounded-sm" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const username = convexUser.username;
  const plan = convexUser.plan ?? "free";
  const version = latestBundle?.version ?? null;
  const isPublished = latestBundle?.isPublished ?? false;
  const syncedAt = latestBundle ? latestBundle.publishedAt ?? latestBundle.createdAt : null;
  const activePaneGroup =
    PANE_GROUPS.find((group) => group.panes.some((pane) => pane.key === rightPane)) ??
    PANE_GROUPS[0];
  const activePreviewTab = activePaneGroup.key;

  // Which mobile tab is active?
  const activeMobileTab = mobileView === "terminal" ? "terminal" : activePreviewTab;

  return (
    <main className="h-[calc(100dvh-2.25rem)] bg-[hsl(var(--bg))] flex flex-col">
      <div className="flex-1 flex flex-col max-w-[1400px] mx-auto w-full p-0 md:p-4 min-h-0">
        <div
          className="flex-1 flex flex-col bg-[hsl(var(--bg-raised))] md:border md:border-[hsl(var(--border))] overflow-hidden min-h-0"
          style={{ borderRadius: "0px" }}
        >
          {/* Terminal header — desktop only */}
          <div className="hidden md:block">
            <TerminalHeader title="you.md — shell" />
          </div>

          {/* Status bar — desktop only (mobile gets it in the nav row) */}
          <div className="hidden md:flex items-center justify-between px-4 py-1.5 border-b border-[hsl(var(--border))] shrink-0">
            <div className="flex items-center gap-2 text-[11px] font-mono text-[hsl(var(--text-secondary))]">
              <span className="text-[hsl(var(--text-primary))] opacity-70">
                @{username}
              </span>
              <span className="opacity-20">|</span>
              <span className="opacity-40">{plan}</span>
              <span className="opacity-20">|</span>
              <span className="opacity-40">v{version ?? "0"}</span>
              <span className="opacity-20">|</span>
              <span className={isPublished ? "text-[hsl(var(--success))]" : "opacity-40"}>
                {isPublished ? "published" : "draft"}
              </span>
              {syncedAt != null && (
                <>
                  <span className="opacity-20">|</span>
                  <FreshnessSegment timestamp={syncedAt} />
                </>
              )}
            </div>
            <div className="flex items-center gap-3">
              {/* GitHub icon + unconnected warning dot */}
              <button
                onClick={() => {
                  setPanelOpen(true);
                  setRightPane("github");
                }}
                className="relative flex items-center justify-center w-5 h-5 text-[hsl(var(--text-secondary))] opacity-30 hover:opacity-70 transition-opacity"
                title={githubConnection === null ? "github not connected" : "github"}
                aria-label="open github pane"
              >
                {/* GitHub mark — inline SVG */}
                <svg
                  viewBox="0 0 16 16"
                  width="14"
                  height="14"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
                </svg>
                {/* Warning dot — shown when not connected (null = not connected, undefined = loading) */}
                {githubConnection === null && (
                  <span
                    aria-hidden="true"
                    className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-[hsl(var(--accent))]"
                    style={{ borderRadius: "50%" }}
                  />
                )}
              </button>
              <button
                onClick={() => {
                  setPanelOpen(true);
                  setRightPane("profile");
                }}
                className="text-[10px] font-mono text-[hsl(var(--text-secondary))] opacity-30 hover:opacity-60 transition-opacity"
              >
                profile
              </button>
              <button
                onClick={() => setPanelOpen(!panelOpen)}
                className="text-[10px] font-mono text-[hsl(var(--accent))] opacity-50 hover:opacity-90 transition-opacity"
              >
                {panelOpen ? "close panel" : "open panel"}
              </button>
            </div>
          </div>

          {/* Mobile nav — single row: scrollable pane tabs + compact status */}
          <div className="md:hidden shrink-0 border-b border-[hsl(var(--border))]">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center overflow-x-auto scrollbar-none">
                {MOBILE_PRIMARY_PANES.map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => {
                      if (key === "terminal") {
                        setMobileView("terminal");
                      } else {
                        setMobileView("preview");
                        const group = PANE_GROUPS.find((g) => g.key === key);
                        if (group) setRightPane(group.defaultPane);
                      }
                    }}
                    className={`min-h-11 px-2.5 text-[10px] font-mono transition-colors whitespace-nowrap ${
                      activeMobileTab === key
                        ? "text-[hsl(var(--text-primary))]"
                        : "text-[hsl(var(--text-secondary))] opacity-30"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1.5 pr-2 shrink-0">
                {syncedAt != null && (
                  <span
                    role="img"
                    aria-label={`synced ${formatRelativeTime(syncedAt)}${isFreshTimestamp(syncedAt) ? "" : " — stale"}`}
                    title={`synced ${formatRelativeTime(syncedAt)}`}
                    className={`w-1.5 h-1.5 rounded-full ${
                      isFreshTimestamp(syncedAt)
                        ? "bg-[hsl(var(--success))]"
                        : "bg-[hsl(var(--accent))]"
                    }`}
                  />
                )}
                <span className="font-mono text-[9px] text-[hsl(var(--text-secondary))] opacity-40">
                  v{version ?? "0"}
                </span>
                <span className={`font-mono text-[9px] ${isPublished ? "text-[hsl(var(--success))]" : "text-[hsl(var(--text-secondary))] opacity-30"}`}>
                  {isPublished ? "live" : "draft"}
                </span>
              </div>
            </div>
            {mobileView === "preview" && activePaneGroup.panes.length > 1 && (
              <div className="flex items-center gap-1 px-2 pb-2 overflow-x-auto scrollbar-none">
                {activePaneGroup.panes.map((pane) => (
                  <button
                    key={pane.key}
                    onClick={() => setRightPane(pane.key)}
                    className={`min-h-9 px-2 text-[10px] font-mono whitespace-nowrap transition-colors border ${
                      rightPane === pane.key
                        ? "text-[hsl(var(--text-primary))] bg-[hsl(var(--bg))] border-[hsl(var(--border))]"
                        : "text-[hsl(var(--text-secondary))] opacity-40 border-transparent hover:opacity-75"
                    }`}
                    style={{ borderRadius: "var(--radius)" }}
                  >
                    {pane.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Content — split on desktop, toggled on mobile */}
          <div className="flex-1 flex min-h-0 relative">
            {/* Terminal — always rendered on desktop; on mobile only when active */}
            <div
              className={[
                "flex flex-col min-h-0",
                // Desktop: full width when panel closed, 35% when open
                panelOpen
                  ? "md:w-[35%] md:border-r md:border-[hsl(var(--border))]"
                  : "md:w-full",
                "md:relative md:opacity-100 md:translate-x-0",
                // Mobile: full width, absolute positioned for transitions
                "w-full",
                mobileView === "terminal"
                  ? "relative opacity-100 translate-x-0"
                  : "absolute inset-0 opacity-0 -translate-x-4 pointer-events-none md:pointer-events-auto md:relative md:inset-auto",
              ].join(" ")}
              style={{ transition: "width 200ms ease, opacity 200ms ease, transform 200ms ease" }}
            >
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
                staleNotice={staleNotice}
              />
            </div>

            {/* Panes — always rendered on desktop; on mobile only when active */}
            <div
              className={[
                "flex flex-col min-h-0",
                // Desktop: hidden when panel is closed
                panelOpen
                  ? "md:w-[65%] md:relative md:opacity-100 md:translate-x-0"
                  : "md:hidden",
                // Mobile: full width, absolute positioned for transitions
                "w-full",
                mobileView === "preview"
                  ? "relative opacity-100 translate-x-0"
                  : "absolute inset-0 opacity-0 translate-x-4 pointer-events-none md:pointer-events-auto md:relative md:inset-auto",
              ].join(" ")}
              style={{ transition: "opacity 200ms ease, transform 200ms ease" }}
            >
              {/* Desktop pane tabs — hidden on mobile (mobile nav handles it) */}
              <div className="hidden md:block relative shrink-0 border-b border-[hsl(var(--border))]">
                <div className="flex items-center px-4 py-1.5 overflow-x-auto scrollbar-none">
                  <div className="flex items-center gap-0.5">
                    {PANE_GROUPS.map((group) => (
                      <button
                        key={group.key}
                        onClick={() => setRightPane(group.defaultPane)}
                        className={`h-8 px-2.5 text-[10px] font-mono transition-colors whitespace-nowrap border ${
                          activePaneGroup.key === group.key
                            ? "text-[hsl(var(--text-primary))] bg-[hsl(var(--bg))] border border-[hsl(var(--border))]"
                            : "border-transparent text-[hsl(var(--text-secondary))] opacity-30 hover:opacity-60"
                        }`}
                        style={{ borderRadius: "var(--radius)" }}
                      >
                        {group.label}
                      </button>
                    ))}
                  </div>
                </div>
                {activePaneGroup.panes.length > 1 && (
                  <div className="flex items-center gap-1 px-4 pb-2 overflow-x-auto scrollbar-none">
                    {activePaneGroup.panes.map((pane) => (
                      <button
                        key={pane.key}
                        onClick={() => setRightPane(pane.key)}
                        className={`h-8 px-2 text-[10px] font-mono whitespace-nowrap transition-colors border ${
                          rightPane === pane.key
                            ? "text-[hsl(var(--text-primary))] bg-[hsl(var(--bg))] border-[hsl(var(--border))]"
                            : "text-[hsl(var(--text-secondary))] opacity-40 border-transparent hover:opacity-75"
                        }`}
                        style={{ borderRadius: "var(--radius)" }}
                      >
                        {pane.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Active pane */}
              <div className="flex-1 min-h-0 overflow-y-auto">
                <ErrorBoundary>
                  {rightPane === "profile" && (
                    /* Direct inline render of the public profile (no iframe —
                       no double app load, no style clashes). Same Convex query
                       the public page subscribes to; preview mode disables
                       view counting, owner affordances, and the claim banner. */
                    <div className="min-h-full w-full">
                      <ProfileContent preview previewUsername={username} />
                    </div>
                  )}
                  {rightPane === "portrait" && (
                    <PortraitPane username={username} ownerId={convexUser._id} />
                  )}
                  {rightPane === "edit" && (
                    <EditPane userId={convexUser._id} username={username} isWritingFiles={isWritingFiles} />
                  )}
                  {rightPane === "files" && (
                    <FilesPane userId={convexUser._id} isWritingFiles={isWritingFiles} />
                  )}
                  {rightPane === "github" && user?.id && (
                    <GithubPane clerkId={user.id} />
                  )}
                  {rightPane === "share" && user?.id && (
                    <SharePane
                      username={username}
                      userId={convexUser._id}
                      clerkId={user.id}
                      profileId={userProfile?._id}
                      plan={plan}
                    />
                  )}
                  {rightPane === "skills" && (
                    <SkillsPane userId={convexUser._id} />
                  )}
                  {rightPane === "stacks" && (
                    <StacksPane />
                  )}
                  {rightPane === "history" && user?.id && (
                    <HistoryPane userId={convexUser._id} clerkId={user.id} />
                  )}
                  {rightPane === "analytics" && user?.id && (
                    <AnalyticsPane clerkId={user.id} profileId={userProfile?._id} />
                  )}
                  {rightPane === "agents" && <AgentsPane />}
                  {rightPane === "vault" && user?.id && (
                    <VaultPane clerkId={user.id} />
                  )}
                  {rightPane === "settings" && user?.id && (
                    <SettingsPane clerkId={user.id} username={username} plan={plan} profileId={userProfile?._id} />
                  )}
                  {rightPane === "help" && (
                    <HelpPane username={username} />
                  )}
                </ErrorBoundary>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
