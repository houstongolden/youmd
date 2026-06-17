"use client";

import { SignOutButton, useUser } from "@/lib/you-auth";
import { useAction, useQuery, useMutation, useConvex, useConvexAuth } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AsciiAvatar from "@/components/AsciiAvatar";
import { useYouAgent, type RestorableChatSession, type RightPane } from "@/hooks/useYouAgent";
import { TerminalShell } from "@/components/terminal/TerminalShell";
import { EditPane, type EditSubTab } from "@/components/panes/EditPane";
import { SharePane } from "@/components/panes/SharePane";
import { SettingsPane } from "@/components/panes/SettingsPane";
import dynamic from "next/dynamic";
import {
  Activity,
  BarChart3,
  BookOpen,
  Bot,
  ChevronDown,
  ChevronRight,
  Clock3,
  Code2,
  CreditCard,
  Database,
  FileText,
  FolderGit2,
  Github,
  History,
  Image,
  KeyRound,
  Layers3,
  LogOut,
  MessageSquareText,
  Monitor,
  Moon,
  Plug,
  Plus,
  Radar,
  Search,
  Settings,
  Share2,
  Shield,
  Sun,
  UserRound,
  Wrench,
} from "lucide-react";
import PixelYOU from "@/components/landing/PixelYOU";

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
import { ProfilePane } from "@/components/panes/ProfilePane";
import { StacksPane } from "@/components/panes/StacksPane";
import { PortfolioGraphPane } from "@/components/panes/PortfolioGraphPane";
import { ApiEnvPane } from "@/components/panes/ApiEnvPane";
import { ErrorBoundary } from "@/components/ErrorBoundary";

type PrimaryPaneGroup = "profile" | "projects" | "share" | "agents" | "insights" | "portrait" | "account" | "integrations";

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
    key: "projects",
    label: "projects",
    defaultPane: "portfolio",
    panes: [
      { key: "portfolio", label: "portfolio" },
      { key: "files", label: "files" },
      { key: "edit", label: "context" },
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
    key: "integrations",
    label: "apis",
    defaultPane: "apis",
    panes: [
      { key: "apis", label: "apis/env" },
      { key: "github", label: "api/mcp" },
    ],
  },
  {
    // analytics = aggregate stats (views, reads, referrers);
    // "activity" (the agent event log) lives under stacks → AgentsPane
    key: "insights",
    label: "stats",
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
const SIDEBAR_COLLAPSED_STORAGE_KEY = "youmd.shell.sidebarCollapsed";
const SIDEBAR_COLLAPSE_MODE_STORAGE_KEY = "youmd.shell.sidebarCollapseMode";
const CHAT_WIDTH_STORAGE_KEY = "youmd.shell.chatWidth";
const STALE_NUDGE_SESSION_KEY = "youmd.dashboard.staleNudgeShown";
const STALE_NUDGE_DAYS = 7;
const FRESH_WINDOW_MS = 24 * 60 * 60 * 1000;
const DEFAULT_CHAT_WIDTH = 46;
const MIN_CHAT_WIDTH = 34;
const MAX_CHAT_WIDTH = 54;
const MIN_CHAT_WIDTH_PX = 460;
const MIN_DETAIL_WIDTH_PX = 440;
const SIDEBAR_AUTO_COLLAPSE_PX = 1520;

type SidebarCollapseMode = "auto" | "collapsed" | "expanded";

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

type ShellChatSession = {
  sessionId: string;
  surface: string;
  summary?: string;
  messageCount: number;
  lastMessageAt: number;
  createdAt: number;
};

type ShellGitHubConnection = {
  repoFullName?: string | null;
  lastSyncedAt?: number | null;
  hasToken?: boolean | null;
  appInstalled?: boolean | null;
} | null | undefined;

type ShellRepoMirror = {
  repoFullName?: string | null;
  syncedAt?: number | null;
  stale?: boolean | null;
  pendingPushAt?: number | null;
  lastPushError?: string | null;
} | null | undefined;

type ShellGitHubChromeStatus = {
  label: string;
  detail: string;
  color: string;
  toneClass: string;
};

function chatSessionTitle(session: ShellChatSession): string {
  const summary = session.summary?.trim();
  if (summary) return summary;
  const shortId = session.sessionId.slice(0, 8);
  return `chat ${shortId}`;
}

function getShellGitHubStatus(
  connection: ShellGitHubConnection,
  mirror: ShellRepoMirror
): ShellGitHubChromeStatus {
  if (connection === undefined || mirror === undefined) {
    return {
      label: "checking",
      detail: "loading repository sync state",
      color: "#8b949e",
      toneClass: "text-[hsl(var(--text-secondary))]",
    };
  }

  if (!connection?.repoFullName) {
    return {
      label: "reconnect",
      detail: "connect a repo",
      color: "#f85149",
      toneClass: "text-[#f85149]",
    };
  }

  if (mirror?.lastPushError) {
    return {
      label: "blocked",
      detail: "push needs attention",
      color: "#f85149",
      toneClass: "text-[#f85149]",
    };
  }

  if (mirror?.pendingPushAt) {
    return {
      label: "ahead",
      detail: "local context queued",
      color: "#d29922",
      toneClass: "text-[#d29922]",
    };
  }

  if (mirror?.stale) {
    return {
      label: "behind",
      detail: "remote changed",
      color: "#a371f7",
      toneClass: "text-[#a371f7]",
    };
  }

  if (mirror?.repoFullName || connection.repoFullName) {
    return {
      label: "synced",
      detail: "repo mirror current",
      color: "#3fb950",
      toneClass: "text-[#3fb950]",
    };
  }

  return {
    label: "setup",
    detail: "repo mirror pending",
    color: "#d29922",
    toneClass: "text-[#d29922]",
  };
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

/** Open by default; persisted user choice wins. Read lazily so SSR never touches localStorage. */
function readStoredPanelOpen(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(PANEL_OPEN_STORAGE_KEY) !== "false";
  } catch {
    return true;
  }
}

function readStoredSidebarCollapseMode(): SidebarCollapseMode {
  if (typeof window === "undefined") return "auto";
  try {
    const stored = window.localStorage.getItem(SIDEBAR_COLLAPSE_MODE_STORAGE_KEY);
    if (stored === "auto" || stored === "collapsed" || stored === "expanded") {
      return stored;
    }

    const legacy = window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY);
    if (legacy === "true") return "collapsed";
    return "auto";
  } catch {
    return "auto";
  }
}

function readStoredChatWidth(): number {
  if (typeof window === "undefined") return DEFAULT_CHAT_WIDTH;
  try {
    const raw = Number(window.localStorage.getItem(CHAT_WIDTH_STORAGE_KEY));
    if (!Number.isFinite(raw)) return DEFAULT_CHAT_WIDTH;
    if (raw < DEFAULT_CHAT_WIDTH) return DEFAULT_CHAT_WIDTH;
    return Math.min(MAX_CHAT_WIDTH, Math.max(MIN_CHAT_WIDTH, raw));
  } catch {
    return DEFAULT_CHAT_WIDTH;
  }
}

type ThemePreference = "light" | "dark" | "system";

function isThemePreference(value: string | null): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

function applyThemePreference(theme: ThemePreference) {
  const root = document.documentElement;
  if (theme === "system") {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    root.classList.toggle("light", !prefersDark);
    return;
  }
  root.classList.toggle("light", theme === "light");
}

function readThemePreference(): ThemePreference {
  if (typeof window === "undefined") return "dark";
  try {
    const stored = window.localStorage.getItem("theme");
    return isThemePreference(stored) ? stored : "dark";
  } catch {
    return "dark";
  }
}

type ShellIcon = typeof UserRound;

type ShellSidebarItem = {
  label: string;
  detail?: string;
  icon: ShellIcon;
  pane: RightPane;
  subTab?: EditSubTab;
  status?: string;
};

type ShellSidebarGroup = {
  label: string;
  icon: ShellIcon;
  items: ShellSidebarItem[];
};

function ShellSidebarButton({
  item,
  active,
  collapsed,
  onClick,
}: {
  item: ShellSidebarItem;
  active: boolean;
  collapsed: boolean;
  onClick: () => void;
}) {
  const Icon = item.icon;
  const title = item.detail ? `${item.label} - ${item.detail}` : item.label;
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={item.label}
      className={[
        "group relative flex h-8 w-full items-center gap-2.5 px-2 text-left font-mono transition-[color,opacity,background] duration-150",
        collapsed ? "justify-center px-0" : "justify-start",
        active
          ? "bg-[hsl(var(--accent))]/[0.055] text-[hsl(var(--text-primary))]"
          : "text-[hsl(var(--text-secondary))] opacity-55 hover:bg-[hsl(var(--bg))]/70 hover:opacity-95",
      ].join(" ")}
      style={{ borderRadius: "var(--radius)" }}
    >
      {active && !collapsed && (
        <span
          aria-hidden="true"
          className="absolute left-0 top-1/2 h-3.5 w-px -translate-y-1/2 bg-[hsl(var(--accent))]"
        />
      )}
      <Icon
        aria-hidden="true"
        size={14}
        strokeWidth={1.75}
        className={active ? "text-[hsl(var(--accent))]" : "text-current"}
      />
      {!collapsed && (
        <>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[10.5px] leading-4">{item.label}</span>
          </span>
          {item.status && (
            <span className="shrink-0 text-[8px] uppercase tracking-[0.12em] text-[hsl(var(--accent))] opacity-65">
              {item.status}
            </span>
          )}
        </>
      )}
    </button>
  );
}

function MenuGlyph({ className = "" }: { className?: string }) {
  return (
    <span aria-hidden="true" className={["flex h-5 w-7 flex-col justify-center gap-1.5", className].join(" ")}>
      <span className="block h-px w-6 bg-current" />
      <span className="block h-px w-4 bg-current" />
    </span>
  );
}

function DetailPanelGlyph({ open }: { open: boolean }) {
  return (
    <span
      aria-hidden="true"
      className="relative block h-4 w-5 text-current"
    >
      <span className="absolute inset-y-0 right-0 w-px bg-current opacity-65" />
      <span className="absolute inset-y-0 left-0 w-px bg-current opacity-20" />
      <span className="absolute left-0 right-0 top-0 h-px bg-current opacity-20" />
      <span className="absolute bottom-0 left-0 right-0 h-px bg-current opacity-20" />
      <span
        className={[
          "absolute right-1 top-1/2 h-2.5 -translate-y-1/2 bg-current transition-[width,opacity]",
          open ? "w-1.5 opacity-45" : "w-px opacity-70",
        ].join(" ")}
      />
    </span>
  );
}

function ShellYouMark({ collapsed, onToggleCollapsed }: { collapsed: boolean; onToggleCollapsed: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggleCollapsed}
      aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      className={[
        "group relative flex shrink-0 cursor-pointer items-center overflow-hidden text-[hsl(var(--text-secondary))] transition-[background,color,opacity]",
        collapsed ? "h-8 w-10 justify-center" : "h-8 w-[68px] justify-start",
        "hover:bg-[hsl(var(--bg))] hover:text-[hsl(var(--text-primary))]",
      ].join(" ")}
      style={{ borderRadius: "var(--radius)" }}
    >
      <div
        role="img"
        aria-label="YOU"
        className={[
          "absolute top-1/2 -translate-y-1/2 overflow-hidden text-[hsl(var(--text-primary))] transition-[opacity,transform] duration-150 group-hover:-translate-y-3 group-hover:opacity-0",
          collapsed ? "left-0.5 h-5 w-9" : "left-1 h-7 w-[62px]",
        ].join(" ")}
      >
        <div
          className={collapsed ? "origin-top-left scale-[0.094]" : "origin-top-left scale-[0.18]"}
          aria-hidden="true"
        >
          <PixelYOU />
        </div>
      </div>
      <MenuGlyph
        className={[
          "absolute left-1/2 top-1/2 -translate-x-1/2 translate-y-2 text-[hsl(var(--accent))] opacity-0 transition-[opacity,transform] duration-150 group-hover:-translate-y-1/2 group-hover:opacity-90",
          collapsed ? "" : "sm:left-6",
        ].join(" ")}
      />
    </button>
  );
}

function GitHubMark({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      fill="currentColor"
      className={className}
    >
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82A7.62 7.62 0 0 1 8 3.87c.68 0 1.36.09 2 .26 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}

function ShellGitHubChrome({
  repoFullName,
  status,
  lastSyncedAt,
  busy,
  onClick,
}: {
  repoFullName?: string | null;
  status: ShellGitHubChromeStatus;
  lastSyncedAt?: number | null;
  busy?: boolean;
  onClick: () => void;
}) {
  const repoLabel = repoFullName ?? "connect github";
  const syncLabel = busy ? "syncing" : lastSyncedAt ? formatRelativeTime(lastSyncedAt) : status.label;

  return (
    <div className="group relative flex h-8 items-center justify-end">
      <button
        type="button"
        onClick={onClick}
        title={`${repoLabel} - ${status.detail}`}
        aria-label={`GitHub repository: ${repoLabel}. ${status.detail}.`}
        className="flex h-8 cursor-pointer items-center gap-2 px-1.5 font-mono text-[9.5px] text-[hsl(var(--text-secondary))] transition-[background,color,opacity] hover:bg-[hsl(var(--bg-raised))] hover:text-[hsl(var(--text-primary))]"
        style={{ borderRadius: "var(--radius)" }}
      >
        <span className="relative flex h-6 w-6 items-center justify-center bg-[hsl(var(--bg-raised))] text-[hsl(var(--text-primary))] shadow-[inset_0_0_0_1px_hsl(var(--border)/0.62)]">
          <GitHubMark className="h-4 w-4" />
          <span
            aria-hidden="true"
            className={[
              "absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full shadow-[0_0_0_2px_hsl(var(--bg))]",
              busy ? "animate-pulse" : "",
            ].join(" ")}
            style={{ backgroundColor: status.color }}
          />
        </span>
        <span className={["hidden text-[8.5px] uppercase tracking-[0.12em] sm:inline", status.toneClass].join(" ")}>
          {syncLabel}
        </span>
      </button>
      <div
        className="pointer-events-none absolute right-0 top-[calc(100%+6px)] z-40 w-max max-w-[320px] translate-y-1 bg-[hsl(var(--bg-raised))] px-3 py-2 opacity-0 shadow-[0_12px_32px_rgba(0,0,0,0.3)] ring-1 ring-[hsl(var(--border))]/70 transition-[opacity,transform] group-hover:translate-y-0 group-hover:opacity-100"
        style={{ borderRadius: "var(--radius)" }}
      >
        <p className="font-mono text-[10px] text-[hsl(var(--text-primary))]">{repoLabel}</p>
        <p className="mt-1 font-mono text-[8.5px] uppercase tracking-[0.12em] text-[hsl(var(--text-secondary))] opacity-55">
          {status.label} / {status.detail}
          {lastSyncedAt ? ` / ${formatRelativeTime(lastSyncedAt)}` : ""}
        </p>
      </div>
    </div>
  );
}

function ShellUpdateButton({ busy, onClick }: { busy?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="h-7 cursor-pointer px-2.5 font-mono text-[10px] text-[hsl(var(--accent))] opacity-82 transition-[background,opacity] hover:bg-[hsl(var(--accent))]/[0.11] hover:opacity-100"
      style={{ borderRadius: "var(--radius)" }}
      aria-label="Update You.md context and repository"
      title="Update You.md context and repository"
    >
      {busy ? "updating" : "update"}
    </button>
  );
}

function ShellSidebar({
  username,
  displayName,
  email,
  avatarUrl,
  plan,
  version,
  isPublished,
  syncedAt,
  githubRepoName,
  recentSessions,
  activeSessionId,
  loadingSessionId,
  rightPane,
  collapsed,
  onToggleCollapsed,
  onOpenPane,
  onNewChat,
  onSearch,
  onOpenChatSession,
}: {
  username: string;
  displayName?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  plan: string;
  version: number | string | null;
  isPublished: boolean;
  syncedAt: number | null;
  githubRepoName?: string | null;
  recentSessions?: ShellChatSession[];
  activeSessionId?: string | null;
  loadingSessionId?: string | null;
  rightPane: RightPane;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onOpenPane: (pane: RightPane, subTab?: EditSubTab) => void;
  onNewChat: () => void;
  onSearch: () => void;
  onOpenChatSession: (sessionId: string) => void;
}) {
  const [accountOpen, setAccountOpen] = useState(false);
  const [theme, setTheme] = useState<ThemePreference>(() => readThemePreference());
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const accountRef = useRef<HTMLDivElement | null>(null);
  const repoDetail = githubRepoName ?? "connect github";
  const displayLabel = displayName || username;
  const userInitial = (displayLabel || username || "you").slice(0, 1).toUpperCase();

  useEffect(() => {
    try {
      window.localStorage.setItem("theme", theme);
    } catch {
      // Non-fatal when localStorage is unavailable.
    }
    applyThemePreference(theme);
    if (theme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => applyThemePreference("system");
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, [theme]);

  useEffect(() => {
    if (!accountOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (accountRef.current && !accountRef.current.contains(event.target as Node)) {
        setAccountOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [accountOpen]);

  const groups: ShellSidebarGroup[] = [
    {
      label: "projects",
      icon: FolderGit2,
      items: [
        { label: "Portfolio", detail: "projects + dependencies", icon: Database, pane: "portfolio", status: "new" },
        {
          label: githubRepoName ? "Synced Repo" : "GitHub Repo",
          detail: repoDetail,
          icon: FolderGit2,
          pane: githubRepoName ? "files" : "github",
          status: githubRepoName ? "live" : "setup",
        },
        { label: "Repo Link", detail: "create/connect", icon: Github, pane: "github" },
        { label: "History", detail: "versions + sync", icon: History, pane: "history" },
      ],
    },
    {
      label: "personal api",
      icon: Code2,
      items: [
        { label: "APIs / Env", detail: "providers + key map", icon: Database, pane: "apis", status: "new" },
        { label: "API / MCP", detail: "scoped agent access", icon: Code2, pane: "github" },
        { label: "API Tokens", detail: "owner keys", icon: KeyRound, pane: "settings" },
        { label: "Shared Links", detail: "scoped context", icon: Shield, pane: "share" },
        { label: "Vault", detail: "secrets", icon: BookOpen, pane: "vault" },
      ],
    },
    {
      label: "skillstacks",
      icon: Layers3,
      items: [
        { label: "YouStack", detail: "your default stack", icon: Layers3, pane: "stacks" },
        { label: "Skills", detail: "templates + tools", icon: Wrench, pane: "skills" },
        { label: "Agents", detail: "activity + MCP", icon: Bot, pane: "agents" },
      ],
    },
    {
      label: "connect",
      icon: Plug,
      items: [
        { label: "Connectors", detail: "apps + crawlers", icon: Plug, pane: "github" },
        { label: "Sources", detail: "web + repo context", icon: Radar, pane: "edit", subTab: "sources" },
        { label: "Loops", detail: "crons + reports", icon: Clock3, pane: "github" },
        { label: "Activity", detail: "agent run log", icon: Activity, pane: "agents" },
      ],
    },
    {
      label: "identity",
      icon: UserRound,
      items: [
        { label: "Profile", detail: `you.md/${username}`, icon: UserRound, pane: "profile" },
        { label: "Files", detail: "markdown brain", icon: FileText, pane: "files" },
        { label: "Share", detail: "links + publish", icon: Share2, pane: "share" },
        { label: "Portrait", detail: "ascii identity", icon: Image, pane: "portrait" },
        { label: "Analytics", detail: "reads + views", icon: BarChart3, pane: "analytics" },
        { label: "Account", detail: "settings", icon: Settings, pane: "settings" },
      ],
    },
  ];
  const collapsedItems: ShellSidebarItem[] = [
    {
      label: "Portfolio",
      detail: "projects + dependencies",
      icon: FolderGit2,
      pane: "portfolio",
      status: "new",
    },
    { label: "APIs / Env", detail: "providers + key map", icon: Database, pane: "apis" },
    { label: "YouStack", detail: "your default stack", icon: Layers3, pane: "stacks" },
    { label: "Connectors", detail: "github + apps", icon: Plug, pane: "github" },
  ];
  const toggleGroup = (label: string) => {
    setOpenGroups((current) => ({ ...current, [label]: !current[label] }));
  };

  return (
    <aside
      className={[
        "hidden h-full shrink-0 flex-col border-r border-[hsl(var(--border))]/70 bg-[hsl(var(--bg-raised))] transition-[width] duration-200 md:flex",
        collapsed ? "w-14" : "w-[244px]",
      ].join(" ")}
      aria-label="Shell navigation"
    >
      <div className={collapsed ? "flex flex-col items-center gap-2 px-2 py-3" : "px-3 py-3"}>
        <div className={collapsed ? "flex flex-col items-center gap-2" : "flex items-center gap-2"}>
          <ShellYouMark collapsed={collapsed} onToggleCollapsed={onToggleCollapsed} />
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <div className="truncate font-mono text-[9.5px] text-[hsl(var(--text-secondary))] opacity-45">
                @{username}
              </div>
            </div>
          )}
        </div>

        <div className={collapsed ? "mt-2 flex flex-col gap-1" : "mt-3 space-y-1"}>
          <button
            type="button"
            onClick={onNewChat}
            className={[
              "flex h-8 w-full items-center gap-2 px-2 font-mono text-[10.5px] text-[hsl(var(--text-primary))] transition-[color,background] hover:bg-[hsl(var(--bg))]",
              collapsed ? "w-8 justify-center px-0" : "",
            ].join(" ")}
            style={{ borderRadius: "var(--radius)" }}
            aria-label="New chat"
            title="New chat"
          >
            <Plus size={15} className="text-[hsl(var(--accent))]" />
            {!collapsed && <span>new chat</span>}
          </button>
          <button
            type="button"
            onClick={onSearch}
            className={[
              "flex h-8 w-full items-center gap-2 px-2 font-mono text-[10.5px] text-[hsl(var(--text-secondary))] opacity-55 transition-[opacity,background] hover:bg-[hsl(var(--bg))] hover:opacity-95",
              collapsed ? "w-8 justify-center px-0" : "",
            ].join(" ")}
            style={{ borderRadius: "var(--radius)" }}
            aria-label="Search commands"
            title="Search commands"
          >
            <Search size={15} />
            {!collapsed && (
              <>
                <span className="flex-1 text-left">search</span>
                <span className="text-[9px] opacity-35">cmd k</span>
              </>
            )}
          </button>
        </div>
      </div>

      <nav className={collapsed ? "flex-1 overflow-y-auto px-2 pb-3" : "flex-1 overflow-y-auto px-3 pb-3"}>
        <div className="space-y-3.5">
          {collapsed ? (
            <section aria-label="primary shell navigation">
              <div className="space-y-0.5">
                {collapsedItems.map((item) => (
                  <ShellSidebarButton
                    key={item.label}
                    item={item}
                    collapsed
                    active={rightPane === item.pane}
                    onClick={() => onOpenPane(item.pane, item.subTab)}
                  />
                ))}
              </div>
            </section>
          ) : (
            groups.map((group) => {
              const isOpen = Boolean(openGroups[group.label]);
              const isActiveGroup = group.items.some((item) => rightPane === item.pane);
              const GroupIcon = group.icon;
              return (
                <section key={group.label} aria-label={group.label}>
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.label)}
                    aria-expanded={isOpen}
                    className={[
                      "group flex h-8 w-full cursor-pointer items-center gap-2 px-2 text-left font-mono transition-[background,color,opacity]",
                      isActiveGroup
                        ? "text-[hsl(var(--text-primary))]"
                        : "text-[hsl(var(--text-secondary))] opacity-55 hover:opacity-95",
                      "hover:bg-[hsl(var(--bg))]/70",
                    ].join(" ")}
                    style={{ borderRadius: "var(--radius)" }}
                  >
                    <GroupIcon
                      size={13}
                      strokeWidth={1.75}
                      className={isActiveGroup ? "text-[hsl(var(--accent))]" : "text-current"}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1 truncate text-[9px] uppercase tracking-[0.16em]">
                      {group.label}
                    </span>
                    {isActiveGroup && (
                      <span
                        aria-hidden="true"
                        className="h-1.5 w-1.5 shrink-0 rounded-full bg-[hsl(var(--accent))] opacity-75"
                      />
                    )}
                    {isOpen ? <ChevronDown size={13} aria-hidden="true" /> : <ChevronRight size={13} aria-hidden="true" />}
                  </button>
                  {isOpen && (
                    <div className="mt-0.5 space-y-0.5 pl-3">
                      {group.items.map((item) => (
                        <ShellSidebarButton
                          key={`${group.label}-${item.label}`}
                          item={item}
                          collapsed={collapsed}
                          active={rightPane === item.pane}
                          onClick={() => onOpenPane(item.pane, item.subTab)}
                        />
                      ))}
                    </div>
                  )}
                </section>
              );
            })
          )}
          {!collapsed && (
            <section aria-label="saved chats" className="pt-1">
              <button
                type="button"
                onClick={() => toggleGroup("chats")}
                aria-expanded={Boolean(openGroups.chats)}
                className="group flex h-8 w-full cursor-pointer items-center gap-2 px-2 text-left font-mono text-[hsl(var(--text-secondary))] opacity-55 transition-[background,opacity,color] hover:bg-[hsl(var(--bg))]/70 hover:text-[hsl(var(--text-primary))] hover:opacity-95"
                style={{ borderRadius: "var(--radius)" }}
              >
                <MessageSquareText size={13} strokeWidth={1.75} aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate text-[9px] uppercase tracking-[0.16em]">chats</span>
                {recentSessions && recentSessions.length > 0 && (
                  <span className="text-[8px] opacity-45">{Math.min(recentSessions.length, 5)}</span>
                )}
                {openGroups.chats ? <ChevronDown size={13} aria-hidden="true" /> : <ChevronRight size={13} aria-hidden="true" />}
              </button>
              {openGroups.chats && (
                <div className="mt-0.5 space-y-0.5 pl-3">
                {recentSessions === undefined ? (
                <div className="px-2 py-1 font-mono text-[9px] text-[hsl(var(--text-secondary))] opacity-35">
                  syncing sessions...
                </div>
              ) : recentSessions.length === 0 ? (
                <div className="px-2 py-1 font-mono text-[9px] leading-4 text-[hsl(var(--text-secondary))] opacity-35">
                  conversations save here after your first turn
                </div>
              ) : (
                recentSessions.slice(0, 5).map((session) => {
                  const isActive = session.sessionId === activeSessionId;
                  const isLoading = session.sessionId === loadingSessionId;
                  return (
                    <button
                      key={session.sessionId}
                      type="button"
                      onClick={() => onOpenChatSession(session.sessionId)}
                      className={[
                        "group relative flex min-h-8 w-full items-center gap-2 px-2 py-1 text-left font-mono transition-[background,color,opacity]",
                        isActive
                          ? "bg-[hsl(var(--accent))]/[0.055] text-[hsl(var(--text-primary))]"
                          : "text-[hsl(var(--text-secondary))] opacity-55 hover:bg-[hsl(var(--bg))]/70 hover:opacity-95",
                      ].join(" ")}
                      style={{ borderRadius: "var(--radius)" }}
                      title={`${chatSessionTitle(session)} - ${formatRelativeTime(session.lastMessageAt)}`}
                    >
                      {isActive && (
                        <span
                          aria-hidden="true"
                          className="absolute left-0 top-1/2 h-3.5 w-px -translate-y-1/2 bg-[hsl(var(--accent))]"
                        />
                      )}
                      <MessageSquareText
                        size={14}
                        strokeWidth={1.75}
                        className={isActive ? "shrink-0 text-[hsl(var(--accent))]" : "shrink-0 text-current"}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[10px] leading-4">
                          {isLoading ? "opening..." : chatSessionTitle(session)}
                        </span>
                        <span className="block truncate text-[8.5px] opacity-40">
                          {session.messageCount} msgs / {formatRelativeTime(session.lastMessageAt)}
                        </span>
                      </span>
                    </button>
                  );
                })
              )}
                </div>
              )}
            </section>
          )}
        </div>
      </nav>

      <div ref={accountRef} className={collapsed ? "relative border-t border-[hsl(var(--border))]/70 p-2" : "relative border-t border-[hsl(var(--border))]/70 p-3"}>
        {accountOpen && (
          <div
            className={[
              "absolute bottom-full z-30 mb-2 w-64 border border-[hsl(var(--border))]/80 bg-[hsl(var(--bg-raised))] p-2 font-mono shadow-[0_18px_50px_hsl(var(--bg)/0.55)]",
              collapsed ? "left-2" : "left-3",
            ].join(" ")}
            style={{ borderRadius: "var(--radius)" }}
          >
            <div className="px-2 py-2">
              <div className="truncate text-[11px] text-[hsl(var(--text-primary))]">{displayLabel}</div>
              <div className="truncate text-[9px] text-[hsl(var(--text-secondary))] opacity-45">
                {email || `@${username}`}
              </div>
            </div>
            <div className="my-1 h-px bg-[hsl(var(--border))]/70" />
            <button
              type="button"
              onClick={() => {
                setAccountOpen(false);
                onOpenPane("settings");
              }}
              className="flex h-8 w-full items-center gap-2 px-2 text-[10px] text-[hsl(var(--text-secondary))] opacity-70 transition-[opacity,background,color] hover:bg-[hsl(var(--bg))] hover:text-[hsl(var(--text-primary))] hover:opacity-100"
              style={{ borderRadius: "var(--radius)" }}
            >
              <CreditCard size={13} />
              <span>usage</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setAccountOpen(false);
                onOpenPane("settings");
              }}
              className="flex h-8 w-full items-center gap-2 px-2 text-[10px] text-[hsl(var(--text-secondary))] opacity-70 transition-[opacity,background,color] hover:bg-[hsl(var(--bg))] hover:text-[hsl(var(--text-primary))] hover:opacity-100"
              style={{ borderRadius: "var(--radius)" }}
            >
              <Settings size={13} />
              <span>settings</span>
            </button>
            <div className="mt-1 px-2 pb-1 pt-2">
              <div className="mb-1 text-[8px] uppercase tracking-[0.18em] text-[hsl(var(--text-secondary))] opacity-35">
                theme
              </div>
              <div className="grid grid-cols-3 gap-1">
                {([
                  ["dark", Moon],
                  ["light", Sun],
                  ["system", Monitor],
                ] as const).map(([value, Icon]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setTheme(value)}
                    className={[
                      "flex h-7 items-center justify-center gap-1 px-1 text-[9px] transition-[background,color,opacity]",
                      theme === value
                        ? "bg-[hsl(var(--accent))]/[0.12] text-[hsl(var(--accent))]"
                        : "text-[hsl(var(--text-secondary))] opacity-55 hover:bg-[hsl(var(--bg))] hover:opacity-90",
                    ].join(" ")}
                    style={{ borderRadius: "var(--radius)" }}
                    aria-pressed={theme === value}
                  >
                    <Icon size={11} />
                    <span>{value}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="my-1 h-px bg-[hsl(var(--border))]/70" />
            <SignOutButton>
              <button
                type="button"
                className="flex h-8 w-full items-center gap-2 px-2 text-[10px] text-[hsl(var(--text-secondary))] opacity-60 transition-[opacity,background,color] hover:bg-[hsl(var(--bg))] hover:text-[hsl(var(--accent))] hover:opacity-100"
                style={{ borderRadius: "var(--radius)" }}
              >
                <LogOut size={13} />
                <span>sign out</span>
              </button>
            </SignOutButton>
          </div>
        )}
        {!collapsed && (
          <div
            className="mb-2 flex items-center gap-2 px-2 font-mono text-[9px] text-[hsl(var(--text-secondary))]"
            title={syncedAt ? `synced ${formatRelativeTime(syncedAt)}` : undefined}
          >
            <span className="truncate text-[hsl(var(--text-primary))] opacity-65">{plan}</span>
            <span className="opacity-20">/</span>
            <span className="opacity-[0.38]">v{version ?? "0"}</span>
            <span className="opacity-20">/</span>
            <span className="truncate opacity-[0.38]">{isPublished ? "live" : "draft"}</span>
            <span className={`ml-auto h-1.5 w-1.5 rounded-full ${isPublished ? "bg-[hsl(var(--success))]" : "bg-[hsl(var(--accent))]"}`} />
          </div>
        )}
        <button
          type="button"
          onClick={() => setAccountOpen((value) => !value)}
          className={[
            "flex w-full items-center gap-2 px-2 py-1.5 font-mono text-left text-[hsl(var(--text-secondary))] transition-[background,color] hover:bg-[hsl(var(--bg))] hover:text-[hsl(var(--text-primary))]",
            collapsed ? "h-9 justify-center px-0" : "",
          ].join(" ")}
          style={{ borderRadius: "var(--radius)" }}
          aria-haspopup="menu"
          aria-expanded={accountOpen}
          title={`${displayLabel} - account`}
        >
          {avatarUrl ? (
            <span className="h-6 w-6 shrink-0 overflow-hidden bg-[hsl(var(--bg))]" style={{ borderRadius: "var(--radius)" }}>
              <AsciiAvatar
                src={avatarUrl}
                cols={96}
                format="block"
                canvasWidth={40}
                className="h-full w-full object-cover"
              />
            </span>
          ) : (
            <span className="flex h-6 w-6 shrink-0 items-center justify-center bg-[hsl(var(--accent))]/[0.12] text-[10px] text-[hsl(var(--accent))]" style={{ borderRadius: "var(--radius)" }}>
              {userInitial}
            </span>
          )}
          {!collapsed && (
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[10px] text-[hsl(var(--text-primary))] opacity-80">
                @{username}
              </span>
              <span className="block truncate text-[8.5px] opacity-35">account + theme</span>
            </span>
          )}
        </button>
      </div>
    </aside>
  );
}

export function DashboardContent() {
  const { user } = useUser();
  const { isAuthenticated } = useConvexAuth();
  const convex = useConvex();
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
  const repoMirror = useQuery(
    api.github.getRepoMirror,
    isAuthenticated && user?.id ? { clerkId: user.id } : "skip"
  );
  const recentSessions = useQuery(
    api.memories.listSessions,
    isAuthenticated && user?.id && convexUser?._id
      ? { clerkId: user.id, userId: convexUser._id, limit: 8 }
      : "skip"
  );
  const shellUsername =
    convexUser?.username ||
    user?.username ||
    user?.firstName?.toLowerCase().replace(/[^a-z0-9-]/g, "") ||
    "user";

  // Post-OAuth redirect lands at /shell?integration=github — open the github
  // pane from the initial state (deriving here avoids a setState-in-effect that
  // can trigger cascading renders).
  const wantsGithub = searchParams.get("integration") === "github";
  const [rightPane, setRightPane] = useState<RightPane>(wantsGithub ? "github" : "profile");
  const [mobileView, setMobileView] = useState<"terminal" | "preview">("terminal");
  const [panelOpen, setPanelOpen] = useState<boolean>(() =>
    wantsGithub ? true : readStoredPanelOpen()
  );
  const [sidebarCollapseMode, setSidebarCollapseMode] = useState<SidebarCollapseMode>(() =>
    readStoredSidebarCollapseMode()
  );
  const [chatWidth, setChatWidth] = useState<number>(() => readStoredChatWidth());
  const [editInitialSubTab, setEditInitialSubTab] = useState<EditSubTab>("files");
  const [viewportWidth, setViewportWidth] = useState(0);
  const [loadingSessionId, setLoadingSessionId] = useState<string | null>(null);
  const splitContainerRef = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
    try {
      window.localStorage.setItem(SIDEBAR_COLLAPSE_MODE_STORAGE_KEY, sidebarCollapseMode);
      window.localStorage.setItem(
        SIDEBAR_COLLAPSED_STORAGE_KEY,
        String(sidebarCollapseMode === "collapsed")
      );
    } catch {
      // localStorage unavailable (private mode etc.) — non-fatal
    }
  }, [sidebarCollapseMode]);

  useEffect(() => {
    try {
      window.localStorage.setItem(CHAT_WIDTH_STORAGE_KEY, String(chatWidth));
    } catch {
      // localStorage unavailable (private mode etc.) — non-fatal
    }
  }, [chatWidth]);

  useEffect(() => {
    const updateViewportWidth = () => setViewportWidth(window.innerWidth);
    updateViewportWidth();
    window.addEventListener("resize", updateViewportWidth);
    return () => window.removeEventListener("resize", updateViewportWidth);
  }, []);

  const createUser = useMutation(api.users.createUser);
  const claimProfile = useMutation(api.profiles.claimProfile);
  const publishLatest = useMutation(api.me.publishLatest);
  const pushToRepo = useAction(api.githubRepo.pushToRepo);
  const syncMirror = useAction(api.githubRepo.syncMirror);
  const autoCreateAttempted = useRef(false);
  const [repoUpdateBusy, setRepoUpdateBusy] = useState(false);

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

  const openPane = useCallback((pane: RightPane, subTab?: EditSubTab) => {
    if (subTab) setEditInitialSubTab(subTab);
    setPanelOpen(true);
    setMobileView("preview");
    setRightPane(pane);
  }, []);

  const focusShellInput = useCallback(() => {
    requestAnimationFrame(() => agent.textareaRef.current?.focus());
  }, [agent.textareaRef]);

  const startNewChat = useCallback(() => {
    agent.startNewSession();
    agent.setInput("");
    setMobileView("terminal");
    focusShellInput();
  }, [agent, focusShellInput]);

  const openSearch = useCallback(() => {
    setMobileView("terminal");
    agent.setInput("/");
    focusShellInput();
  }, [agent, focusShellInput]);

  const runRepoUpdate = useCallback(async () => {
    setMobileView("terminal");
    if (repoUpdateBusy) return;
    if (!user?.id) {
      agent.addSystemMessage("[update blocked]\n\nsign in first so the web shell can publish and sync your repo.");
      return;
    }
    const repoName = githubConnection?.repoFullName ?? repoMirror?.repoFullName ?? `you.md/${shellUsername}`;
    setRepoUpdateBusy(true);
    agent.addSystemMessage(
      [
        "[update started]",
        "",
        `> repo: ${repoName}`,
        "> step 1: publish current You.md bundle",
        "> step 2: push identity files to linked GitHub repo",
        "> step 3: refresh server mirror that powers the GitHub status dot",
      ].join("\n")
    );
    try {
      const publishResult = await publishLatest({ clerkId: user.id });
      agent.addSystemMessage(
        `[update step 1 complete]\n\npublished v${publishResult.version}. live at you.md/${publishResult.username}`
      );

      const pushResult = await pushToRepo({ clerkId: user.id }) as {
        upToDate: boolean;
        pushed: string[];
        via?: "pr" | "direct";
        prUrl?: string | null;
        prNumber?: number | null;
        merged?: boolean;
        branchRecreated?: boolean;
      };
      const pushLines = [
        "[update step 2 complete]",
        "",
        pushResult.upToDate
          ? "> repo already matched current identity files"
          : `> pushed: ${pushResult.pushed.join(", ") || "identity files"}`,
        `> route: ${pushResult.via ?? "unknown"}`,
        pushResult.prUrl ? `> pr: ${pushResult.prUrl}` : null,
        pushResult.merged === true ? "> merge: complete" : pushResult.merged === false ? "> merge: pending or manual" : null,
        pushResult.branchRecreated ? "> conflict: branch recreated from latest default branch and retried" : null,
      ].filter(Boolean);
      agent.addSystemMessage(pushLines.join("\n"));

      const mirrorResult = await syncMirror({ clerkId: user.id }) as {
        fileCount: number;
        truncated: boolean;
      };
      agent.addSystemMessage(
        [
          "[update complete]",
          "",
          `> mirror refreshed: ${mirrorResult.fileCount} file${mirrorResult.fileCount === 1 ? "" : "s"}${mirrorResult.truncated ? " (capped)" : ""}`,
          "> github status should now show fresh repo mirror time after Convex re-renders",
        ].join("\n")
      );
    } catch (err) {
      agent.addSystemMessage(
        `[update failed]\n\n${err instanceof Error ? err.message : "unknown GitHub sync error"}`
      );
    } finally {
      setRepoUpdateBusy(false);
      focusShellInput();
    }
  }, [agent, focusShellInput, githubConnection?.repoFullName, publishLatest, pushToRepo, repoMirror?.repoFullName, repoUpdateBusy, shellUsername, syncMirror, user?.id]);

  const openChatSession = useCallback(async (sessionId: string) => {
    if (sessionId === agent.currentSessionId) {
      setMobileView("terminal");
      focusShellInput();
      return;
    }
    setMobileView("terminal");
    if (!user?.id || !convexUser?._id) {
      agent.addSystemMessage("[session unavailable]\n\nthat saved chat could not be loaded.");
      return;
    }
    setLoadingSessionId(sessionId);
    try {
      const session = await convex.query(api.memories.loadChatMessagesBySession, {
        clerkId: user.id,
        userId: convexUser._id,
        sessionId,
      });
      if (!session) {
        agent.addSystemMessage("[session unavailable]\n\nthat saved chat could not be loaded.");
        return;
      }
      agent.restoreSession(session as RestorableChatSession);
      focusShellInput();
    } catch {
      agent.addSystemMessage("[session unavailable]\n\nthat saved chat could not be loaded.");
    } finally {
      setLoadingSessionId(null);
    }
  }, [agent, convex, convexUser?._id, focusShellInput, user?.id]);

  const startColumnResize = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    const container = splitContainerRef.current;
    if (!container) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);

    const handleMove = (moveEvent: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      const next = ((moveEvent.clientX - rect.left) / rect.width) * 100;
      const pixelMin = (MIN_CHAT_WIDTH_PX / rect.width) * 100;
      const detailMax = ((rect.width - MIN_DETAIL_WIDTH_PX) / rect.width) * 100;
      const lower = Math.max(MIN_CHAT_WIDTH, pixelMin);
      const upper = Math.min(MAX_CHAT_WIDTH, detailMax);
      const bounded = upper > lower ? Math.min(upper, Math.max(lower, next)) : lower;
      setChatWidth(Math.round(bounded));
    };

    const handleUp = () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp, { once: true });
  }, []);

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
      <main aria-busy="true" className="h-dvh overflow-hidden bg-[hsl(var(--bg))]">
        <div className="flex h-full min-h-0">
          <aside className="hidden h-full w-[244px] shrink-0 border-r border-[hsl(var(--border))]/70 bg-[hsl(var(--bg-raised))] p-3 md:flex md:flex-col">
            <div className="h-9 w-28 animate-pulse bg-[hsl(var(--text-secondary))] opacity-10" />
            <div className="mt-4 h-10 w-full animate-pulse bg-[hsl(var(--text-secondary))] opacity-[0.08]" />
            <div className="mt-2 h-10 w-full animate-pulse bg-[hsl(var(--text-secondary))] opacity-[0.06]" />
            <div className="mt-6 space-y-2">
              {Array.from({ length: 12 }).map((_, idx) => (
                <div
                  key={idx}
                  className="h-9 w-full animate-pulse bg-[hsl(var(--text-secondary))] opacity-[0.05]"
                />
              ))}
            </div>
          </aside>
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex h-11 items-center border-b border-[hsl(var(--border))] px-3 md:hidden">
              <div className="h-3 w-32 animate-pulse bg-[hsl(var(--text-secondary))] opacity-10" />
            </div>
            <div className="flex min-h-0 flex-1">
              <div
                className={`flex w-full flex-col gap-3 p-4 animate-pulse ${
                  panelOpen ? "md:w-[42%] md:border-r md:border-[hsl(var(--border))]/70" : "w-full"
                }`}
              >
                <div className="h-3 w-32 bg-[hsl(var(--text-secondary))] opacity-10" />
                <div className="h-3 w-full bg-[hsl(var(--text-secondary))] opacity-[0.06]" />
                <div className="h-3 w-3/4 bg-[hsl(var(--text-secondary))] opacity-[0.06]" />
                <div className="flex-1" />
                <div className="h-14 w-full bg-[hsl(var(--text-secondary))] opacity-[0.06]" />
              </div>
              <div className={`hidden ${panelOpen ? "md:flex" : "md:hidden"} flex-1 flex-col`}>
                <div className="flex items-center gap-2 border-b border-[hsl(var(--border))] px-4 py-2 animate-pulse">
                  <div className="h-5 w-14 bg-[hsl(var(--text-secondary))] opacity-10" />
                  <div className="h-5 w-14 bg-[hsl(var(--text-secondary))] opacity-[0.06]" />
                  <div className="h-5 w-14 bg-[hsl(var(--text-secondary))] opacity-[0.06]" />
                </div>
                <div className="flex-1 space-y-4 p-4 animate-pulse">
                  <div className="h-4 w-40 bg-[hsl(var(--text-secondary))] opacity-10" />
                  <div className="h-24 w-full bg-[hsl(var(--text-secondary))] opacity-[0.06]" />
                  <div className="h-4 w-2/3 bg-[hsl(var(--text-secondary))] opacity-[0.06]" />
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
  const avatarUrl = (userProfile as Record<string, unknown> | null | undefined)?.avatarUrl as string | undefined
    || user?.imageUrl
    || null;
  const email = user?.emailAddresses[0]?.emailAddress ?? null;
  const displayName = user?.fullName ?? user?.firstName ?? username;
  const autoSidebarCollapsed =
    panelOpen && viewportWidth > 0 && viewportWidth < SIDEBAR_AUTO_COLLAPSE_PX;
  const effectiveSidebarCollapsed =
    sidebarCollapseMode === "collapsed" ||
    (sidebarCollapseMode === "auto" && autoSidebarCollapsed);
  const toggleSidebarCollapsed = () => {
    setSidebarCollapseMode(effectiveSidebarCollapsed ? "expanded" : "collapsed");
  };
  const activePaneGroup =
    PANE_GROUPS.find((group) => group.panes.some((pane) => pane.key === rightPane)) ??
    PANE_GROUPS[0];
  const activePreviewTab = activePaneGroup.key;
  const shellGitHubStatus = repoUpdateBusy
    ? {
        label: "syncing",
        detail: "publishing, pushing, and refreshing the repo mirror",
        color: "#a371f7",
        toneClass: "text-[#a371f7]",
      }
    : getShellGitHubStatus(
        githubConnection as ShellGitHubConnection,
        repoMirror as ShellRepoMirror
      );
  const shellGitHubRepoName = githubConnection?.repoFullName ?? repoMirror?.repoFullName ?? null;
  const shellGitHubSyncedAt = repoMirror?.syncedAt ?? githubConnection?.lastSyncedAt ?? null;

  // Which mobile tab is active?
  const activeMobileTab = mobileView === "terminal" ? "terminal" : activePreviewTab;

  return (
    <main className="h-dvh overflow-hidden bg-[hsl(var(--bg))]">
      <div className="flex h-full min-h-0">
        <ShellSidebar
          username={username}
          displayName={displayName}
          email={email}
          avatarUrl={avatarUrl}
          plan={plan}
          version={version}
          isPublished={isPublished}
          syncedAt={syncedAt}
          githubRepoName={githubConnection?.repoFullName ?? null}
          recentSessions={recentSessions as ShellChatSession[] | undefined}
          activeSessionId={agent.currentSessionId}
          loadingSessionId={loadingSessionId}
          rightPane={rightPane}
          collapsed={effectiveSidebarCollapsed}
          onToggleCollapsed={toggleSidebarCollapsed}
          onOpenPane={openPane}
          onNewChat={startNewChat}
          onSearch={openSearch}
          onOpenChatSession={openChatSession}
        />
        <div className="flex min-w-0 flex-1 flex-col bg-[hsl(var(--bg))]">
          <div className="hidden h-10 shrink-0 items-center justify-end border-b border-[hsl(var(--border))]/60 bg-[hsl(var(--bg))] px-3 md:flex">
            <div className="flex items-center gap-2">
              <ShellGitHubChrome
                repoFullName={shellGitHubRepoName}
                status={shellGitHubStatus}
                lastSyncedAt={shellGitHubSyncedAt}
                busy={repoUpdateBusy}
                onClick={() => openPane("github")}
              />
              <ShellUpdateButton busy={repoUpdateBusy} onClick={runRepoUpdate} />
              <button
                type="button"
                onClick={() => setPanelOpen((value) => !value)}
                className="ml-1 hidden h-8 w-8 cursor-pointer items-center justify-center text-[hsl(var(--text-secondary))] opacity-55 transition-[background,color,opacity] hover:bg-[hsl(var(--bg-raised))] hover:text-[hsl(var(--text-primary))] hover:opacity-95 lg:flex"
                style={{ borderRadius: "var(--radius)" }}
                aria-label={panelOpen ? "Hide detail pane" : "Show detail pane"}
                title={panelOpen ? "Hide detail pane" : "Show detail pane"}
              >
                <DetailPanelGlyph open={panelOpen} />
              </button>
            </div>
          </div>
          {/* Mobile nav — single row: scrollable pane tabs + compact status */}
          <div className="shrink-0 border-b border-[hsl(var(--border))] bg-[hsl(var(--bg-raised))] lg:hidden">
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
                        ? "border-transparent bg-[hsl(var(--accent))]/[0.08] text-[hsl(var(--text-primary))]"
                        : "border-transparent text-[hsl(var(--text-secondary))] opacity-40 hover:opacity-75"
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
          <div ref={splitContainerRef} className="relative flex min-h-0 min-w-0 flex-1 overflow-hidden bg-[hsl(var(--bg))]">
            {/* Terminal — always rendered on desktop; on mobile only when active */}
            <div
              className={[
                "min-h-0 min-w-0 flex flex-col bg-[hsl(var(--bg-raised))]",
                panelOpen ? "lg:w-[var(--shell-chat-width)] lg:flex-none" : "lg:flex-1",
                "lg:relative lg:opacity-100 lg:translate-x-0",
                // Mobile: full width, absolute positioned for transitions
                "w-full",
                mobileView === "terminal"
                  ? "relative opacity-100 translate-x-0"
                  : "absolute inset-0 opacity-0 -translate-x-4 pointer-events-none lg:pointer-events-auto lg:relative lg:inset-auto",
              ].join(" ")}
              style={{
                "--shell-chat-width": `clamp(${MIN_CHAT_WIDTH_PX}px, ${chatWidth}%, calc(100% - ${MIN_DETAIL_WIDTH_PX}px))`,
                transition: "width 140ms ease, opacity 200ms ease, transform 200ms ease",
              } as CSSProperties}
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

            {panelOpen && (
              <button
                type="button"
                onPointerDown={startColumnResize}
                className="group hidden w-2 shrink-0 cursor-col-resize items-stretch justify-center border-x border-[hsl(var(--border))]/60 bg-[hsl(var(--bg))] transition-colors hover:bg-[hsl(var(--bg-raised))] lg:flex"
                aria-label="Resize shell split"
                title="Resize shell split"
              >
                <span className="my-auto h-10 w-px bg-[hsl(var(--accent))] opacity-[0.18] transition-opacity group-hover:opacity-60" />
              </button>
            )}

            {/* Panes — always rendered on desktop; on mobile only when active */}
            <div
              className={[
                "min-h-0 min-w-0 flex flex-col overflow-hidden bg-[hsl(var(--bg-raised))]",
                // Desktop: hidden when panel is closed
                panelOpen
                  ? "lg:relative lg:flex-1 lg:opacity-100 lg:translate-x-0"
                  : "lg:hidden",
                // Mobile: full width, absolute positioned for transitions
                "w-full lg:w-auto",
                mobileView === "preview"
                  ? "relative opacity-100 translate-x-0"
                  : "absolute inset-0 opacity-0 translate-x-4 pointer-events-none lg:pointer-events-auto lg:relative lg:inset-auto",
              ].join(" ")}
              style={{ transition: "opacity 200ms ease, transform 200ms ease" }}
            >
              {/* Desktop pane header — one clean navigation surface, scroll-safe on narrow panes. */}
              <div className="hidden lg:block relative shrink-0 border-b border-[hsl(var(--border))]/60">
                <div className="flex min-h-11 items-center overflow-x-auto px-4 scrollbar-none">
                  <div className="flex min-w-max items-center gap-3" role="tablist" aria-label="Detail pane sections">
                    {PANE_GROUPS.map((group) => (
                      <button
                        key={group.key}
                        onClick={() => openPane(group.defaultPane)}
                        role="tab"
                        aria-selected={activePaneGroup.key === group.key}
                        className={`relative h-11 cursor-pointer px-0.5 text-[10px] font-mono transition-colors whitespace-nowrap ${
                          activePaneGroup.key === group.key
                            ? "text-[hsl(var(--text-primary))]"
                            : "text-[hsl(var(--text-secondary))] opacity-30 hover:opacity-60"
                        }`}
                      >
                        {group.label}
                        {activePaneGroup.key === group.key && (
                          <span aria-hidden="true" className="absolute bottom-0 left-0 h-px w-full bg-[hsl(var(--accent))]" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
                {activePaneGroup.panes.length > 1 && (
                  <div className="flex items-center gap-3 overflow-x-auto border-t border-[hsl(var(--border))]/35 px-4 scrollbar-none">
                    {activePaneGroup.panes.map((pane) => (
                      <button
                        key={pane.key}
                        onClick={() => openPane(pane.key)}
                        className={`relative h-9 cursor-pointer text-[9.5px] font-mono whitespace-nowrap transition-colors ${
                          rightPane === pane.key
                            ? "text-[hsl(var(--text-primary))]"
                            : "text-[hsl(var(--text-secondary))] opacity-[0.38] hover:opacity-75"
                        }`}
                      >
                        {pane.label}
                        {rightPane === pane.key && (
                          <span aria-hidden="true" className="absolute bottom-0 left-0 h-px w-full bg-[hsl(var(--accent))]/80" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Active pane */}
              <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
                <ErrorBoundary>
                  {rightPane === "profile" && (
                    <ProfilePane userId={convexUser._id} username={username} ownerId={convexUser._id} />
                  )}
                  {rightPane === "portfolio" && (
                    <PortfolioGraphPane clerkId={user?.id} />
                  )}
                  {rightPane === "portrait" && (
                    <PortraitPane username={username} ownerId={convexUser._id} />
                  )}
                  {rightPane === "edit" && (
                    <EditPane
                      userId={convexUser._id}
                      username={username}
                      isWritingFiles={isWritingFiles}
                      initialSubTab={editInitialSubTab}
                    />
                  )}
                  {rightPane === "files" && (
                    <FilesPane userId={convexUser._id} isWritingFiles={isWritingFiles} />
                  )}
                  {rightPane === "github" && user?.id && (
                    <GithubPane clerkId={user.id} username={username} userId={convexUser._id} />
                  )}
                  {rightPane === "apis" && (
                    <ApiEnvPane />
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
