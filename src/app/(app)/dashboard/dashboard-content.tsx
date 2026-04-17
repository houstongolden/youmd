"use client";

import { useUser } from "@/lib/you-auth";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useYouAgent, type RightPane } from "@/hooks/useYouAgent";
import { TerminalShell } from "@/components/terminal/TerminalShell";
import { TerminalHeader } from "@/components/terminal/TerminalHeader";
import { ProfilePane } from "@/components/panes/ProfilePane";
import { EditPane } from "@/components/panes/EditPane";
import { SharePane } from "@/components/panes/SharePane";
import { SettingsPane } from "@/components/panes/SettingsPane";
import { PortraitPane } from "@/components/panes/PortraitPane";
import { SkillsPane } from "@/components/panes/SkillsPane";
import { HistoryPane } from "@/components/panes/HistoryPane";
import { AnalyticsPane } from "@/components/panes/AnalyticsPane";
import { AgentsPane } from "@/components/panes/AgentsPane";
import { VaultPane } from "@/components/panes/VaultPane";
import { HelpPane } from "@/components/panes/HelpPane";
import { ErrorBoundary } from "@/components/ErrorBoundary";

type PrimaryPaneGroup = "profile" | "content" | "share" | "agents" | "insights" | "portrait" | "account";

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
    label: "content",
    defaultPane: "edit",
    panes: [
      { key: "edit", label: "files" },
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
    label: "agents",
    defaultPane: "agents",
    panes: [
      { key: "agents", label: "agents" },
      { key: "skills", label: "skills" },
    ],
  },
  {
    key: "insights",
    label: "insights",
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

export function DashboardContent() {
  const { user } = useUser();
  const { isAuthenticated } = useConvexAuth();
  const router = useRouter();
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

  const [rightPane, setRightPane] = useState<RightPane>("profile");
  const [mobileView, setMobileView] = useState<"terminal" | "preview">("terminal");
  const [panelOpen, setPanelOpen] = useState(false); // collapsed by default

  const createUser = useMutation(api.users.createUser);
  const claimProfile = useMutation(api.profiles.claimProfile);
  const autoCreateAttempted = useRef(false);

  const agent = useYouAgent({
    onPaneSwitch: (pane) => {
      setRightPane(pane);
      setMobileView("preview");
      setPanelOpen(true); // auto-open the panel when agent switches to it
    },
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
      <div className="h-[calc(100dvh-2.25rem)] bg-[hsl(var(--bg))] flex flex-col">
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
              {/* Left: terminal skeleton */}
              <div className="w-full md:w-[35%] md:border-r md:border-[hsl(var(--border))] flex flex-col p-4 gap-3 animate-pulse">
                <div className="w-32 h-3 bg-[hsl(var(--text-secondary))] opacity-10 rounded-sm" />
                <div className="w-full h-3 bg-[hsl(var(--text-secondary))] opacity-[0.06] rounded-sm" />
                <div className="w-3/4 h-3 bg-[hsl(var(--text-secondary))] opacity-[0.06] rounded-sm" />
                <div className="flex-1" />
                <div className="w-full h-8 bg-[hsl(var(--text-secondary))] opacity-[0.06] rounded-sm" />
              </div>
              {/* Right: pane skeleton */}
              <div className="hidden md:flex md:w-[65%] flex-col">
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
      </div>
    );
  }

  const username = convexUser.username;
  const plan = convexUser.plan ?? "free";
  const version = latestBundle?.version ?? null;
  const isPublished = latestBundle?.isPublished ?? false;
  const activePaneGroup =
    PANE_GROUPS.find((group) => group.panes.some((pane) => pane.key === rightPane)) ??
    PANE_GROUPS[0];
  const activePreviewTab = activePaneGroup.key;

  // Which mobile tab is active?
  const activeMobileTab = mobileView === "terminal" ? "terminal" : activePreviewTab;

  return (
    <div className="h-[calc(100dvh-2.25rem)] bg-[hsl(var(--bg))] flex flex-col">
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
            </div>
            <div className="flex items-center gap-3">
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
                    className={`px-2.5 py-2 text-[10px] font-mono transition-colors whitespace-nowrap ${
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
                    className={`px-2 py-1 text-[10px] font-mono whitespace-nowrap transition-colors border ${
                      rightPane === pane.key
                        ? "text-[hsl(var(--text-primary))] bg-[hsl(var(--bg))] border-[hsl(var(--border))]"
                        : "text-[hsl(var(--text-secondary))] opacity-40 border-transparent hover:opacity-75"
                    }`}
                    style={{ borderRadius: "2px" }}
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
                        className={`px-2.5 py-1 text-[10px] font-mono transition-colors whitespace-nowrap ${
                          activePaneGroup.key === group.key
                            ? "text-[hsl(var(--text-primary))] bg-[hsl(var(--bg))] border border-[hsl(var(--border))]"
                            : "text-[hsl(var(--text-secondary))] opacity-30 hover:opacity-60"
                        }`}
                        style={{ borderRadius: "2px" }}
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
                        className={`px-2 py-1 text-[10px] font-mono whitespace-nowrap transition-colors border ${
                          rightPane === pane.key
                            ? "text-[hsl(var(--text-primary))] bg-[hsl(var(--bg))] border-[hsl(var(--border))]"
                            : "text-[hsl(var(--text-secondary))] opacity-40 border-transparent hover:opacity-75"
                        }`}
                        style={{ borderRadius: "2px" }}
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
                    <iframe
                      src={`/${username}`}
                      className="w-full h-full border-0"
                      title="profile preview"
                    />
                  )}
                  {rightPane === "portrait" && (
                    <PortraitPane username={username} ownerId={convexUser._id} />
                  )}
                  {rightPane === "edit" && (
                    <EditPane userId={convexUser._id} username={username} isWritingFiles={isWritingFiles} />
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
    </div>
  );
}
