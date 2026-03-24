"use client";

import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useYouAgent, type RightPane } from "@/hooks/useYouAgent";
import { TerminalShell } from "@/components/terminal/TerminalShell";
import { TerminalHeader } from "@/components/terminal/TerminalHeader";
import { ProfilePane } from "@/components/panes/ProfilePane";
import { EditPane } from "@/components/panes/EditPane";
import { SharePane } from "@/components/panes/SharePane";
import { SettingsPane } from "@/components/panes/SettingsPane";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// Mobile nav shows these panes as top-level tabs
const MOBILE_PANES: Array<{ key: RightPane | "terminal"; label: string }> = [
  { key: "terminal", label: "terminal" },
  { key: "profile", label: "profile" },
  { key: "edit", label: "edit" },
  { key: "share", label: "share" },
  { key: "settings", label: "settings" },
];

// Desktop pane tab row (shown inside the right panel)
const DESKTOP_PANES: RightPane[] = ["profile", "edit", "share", "settings"];

export function DashboardContent() {
  const { user } = useUser();
  const router = useRouter();
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

  const [rightPane, setRightPane] = useState<RightPane>("profile");
  const [mobileView, setMobileView] = useState<"terminal" | "preview">("terminal");

  const agent = useYouAgent({
    onPaneSwitch: (pane) => {
      setRightPane(pane);
      setMobileView("preview");
    },
  });

  useEffect(() => {
    if (convexUser === null) {
      router.replace("/initialize");
    }
  }, [convexUser, router]);

  if (!convexUser) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-[hsl(var(--bg))]">
        <p className="text-[hsl(var(--text-secondary))] font-mono text-sm animate-pulse">
          loading...
        </p>
      </div>
    );
  }

  const username = convexUser.username;
  const plan = convexUser.plan ?? "free";
  const version = latestBundle?.version ?? null;
  const isPublished = latestBundle?.isPublished ?? false;

  // Which mobile tab is active?
  const activeMobileTab = mobileView === "terminal" ? "terminal" : rightPane;

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
          </div>

          {/* Mobile nav — single row: scrollable pane tabs + compact status */}
          <div className="md:hidden shrink-0 border-b border-[hsl(var(--border))]">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center overflow-x-auto scrollbar-none">
                {MOBILE_PANES.map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => {
                      if (key === "terminal") {
                        setMobileView("terminal");
                      } else {
                        setMobileView("preview");
                        setRightPane(key);
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
          </div>

          {/* Content — split on desktop, toggled on mobile */}
          <div className="flex-1 flex min-h-0">
            {/* Terminal */}
            <div className={`${mobileView === "preview" ? "hidden md:flex" : "flex"} w-full md:w-[35%] flex-col md:border-r md:border-[hsl(var(--border))] min-h-0`}>
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

            {/* Panes — visible on desktop always, toggled on mobile */}
            <div className={`${mobileView === "terminal" ? "hidden md:flex" : "flex"} w-full md:w-[65%] flex-col min-h-0`}>
              {/* Desktop pane tabs — hidden on mobile (mobile nav handles it) */}
              <div className="hidden md:block relative shrink-0 border-b border-[hsl(var(--border))]">
                <div className="flex items-center px-4 py-1.5 overflow-x-auto scrollbar-none">
                  <div className="flex items-center gap-0.5">
                    {DESKTOP_PANES.map((pane) => (
                      <button
                        key={pane}
                        onClick={() => setRightPane(pane)}
                        className={`px-2.5 py-1 text-[10px] font-mono transition-colors whitespace-nowrap ${
                          rightPane === pane
                            ? "text-[hsl(var(--text-primary))] bg-[hsl(var(--bg))] border border-[hsl(var(--border))]"
                            : "text-[hsl(var(--text-secondary))] opacity-30 hover:opacity-60"
                        }`}
                        style={{ borderRadius: "2px" }}
                      >
                        {pane}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Active pane */}
              <div className="flex-1 min-h-0 overflow-y-auto">
                <ErrorBoundary>
                  {rightPane === "profile" && (
                    <ProfilePane userId={convexUser._id} username={username} ownerId={convexUser._id} />
                  )}
                  {rightPane === "edit" && (
                    <EditPane userId={convexUser._id} username={username} />
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
                  {rightPane === "settings" && user?.id && (
                    <SettingsPane clerkId={user.id} username={username} plan={plan} />
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
