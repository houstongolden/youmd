"use client";

import { useUser, SignOutButton } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useYouAgent, type RightPane } from "@/hooks/useYouAgent";
import { TerminalShell } from "@/components/terminal/TerminalShell";
import { TerminalHeader } from "@/components/terminal/TerminalHeader";
import { ProfilePreviewPane } from "@/components/panes/ProfilePreviewPane";
import { SettingsPane } from "@/components/panes/SettingsPane";
import { BillingPane } from "@/components/panes/BillingPane";
import { TokensPane } from "@/components/panes/TokensPane";
import { JsonPane } from "@/components/panes/JsonPane";
import { SourcesPane } from "@/components/panes/SourcesPane";
import { PortraitPane } from "@/components/panes/PortraitPane";
import { PublishPane } from "@/components/panes/PublishPane";
import { AgentsPane } from "@/components/panes/AgentsPane";
import { ActivityPane } from "@/components/panes/ActivityPane";
import { HelpPane } from "@/components/panes/HelpPane";

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

  const [rightPane, setRightPane] = useState<RightPane>("preview");
  const [mobileView, setMobileView] = useState<"terminal" | "preview">("terminal");

  const agent = useYouAgent({
    onPaneSwitch: (pane) => {
      setRightPane(pane);
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
  const profileName = userProfile?.name ?? null;

  return (
    <div className="h-[100dvh] bg-[hsl(var(--bg))] flex flex-col">
      <div className="flex-1 flex flex-col max-w-[1400px] mx-auto w-full p-0 md:p-4 min-h-0">
        <div
          className="flex-1 flex flex-col bg-[hsl(var(--bg-raised))] md:border md:border-[hsl(var(--border))] overflow-hidden min-h-0"
          style={{ borderRadius: "0px" }}
        >
          {/* Header — same as initialize page */}
          <TerminalHeader title="you.md — shell" />

          {/* Status bar — desktop: full, mobile: compact */}
          <div className="flex items-center justify-between px-3 md:px-4 py-1.5 border-b border-[hsl(var(--border))] shrink-0">
            <div className="flex items-center gap-2 text-[10px] md:text-[11px] font-mono text-[hsl(var(--text-secondary))]">
              <span className="text-[hsl(var(--text-primary))] opacity-70">
                @{username}
              </span>
              <span className="opacity-20">|</span>
              <span className="opacity-40 hidden sm:inline">{plan}</span>
              <span className="opacity-20 hidden sm:inline">|</span>
              <span className="opacity-40">v{version ?? "0"}</span>
              <span className="opacity-20">|</span>
              <span className={isPublished ? "text-[hsl(var(--success))]" : "opacity-40"}>
                {isPublished ? "published" : "draft"}
              </span>
            </div>
            <SignOutButton>
              <button className="text-[10px] md:text-[11px] font-mono text-[hsl(var(--text-secondary))] opacity-40 hover:opacity-80 transition-opacity">
                sign out
              </button>
            </SignOutButton>
          </div>

          {/* Mobile view toggle */}
          <div className="md:hidden flex shrink-0 border-b border-[hsl(var(--border))]">
            <button
              onClick={() => setMobileView("terminal")}
              className={`flex-1 py-2 text-[11px] font-mono text-center transition-colors ${
                mobileView === "terminal"
                  ? "text-[hsl(var(--text-primary))] bg-[hsl(var(--bg))]"
                  : "text-[hsl(var(--text-secondary))] opacity-40"
              }`}
            >
              terminal
            </button>
            <button
              onClick={() => setMobileView("preview")}
              className={`flex-1 py-2 text-[11px] font-mono text-center transition-colors ${
                mobileView === "preview"
                  ? "text-[hsl(var(--text-primary))] bg-[hsl(var(--bg))]"
                  : "text-[hsl(var(--text-secondary))] opacity-40"
              }`}
            >
              preview
            </button>
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
                messagesEndRef={agent.messagesEndRef}
                textareaRef={agent.textareaRef}
                sendMessage={agent.sendMessage}
              />
            </div>

            {/* Preview panes — visible on desktop always, toggled on mobile */}
            <div className={`${mobileView === "terminal" ? "hidden md:flex" : "flex"} w-full md:w-[65%] flex-col min-h-0`}>
              {/* Pane tabs */}
              <div className="relative shrink-0 border-b border-[hsl(var(--border))]">
                <div className="flex items-center px-2 md:px-4 py-1 md:py-1.5 overflow-x-auto scrollbar-none">
                  <div className="flex items-center gap-0.5">
                    {(["preview", "json", "sources", "portrait", "publish", "agents", "activity", "settings", "tokens", "billing", "help"] as RightPane[]).map((pane) => (
                      <button
                        key={pane}
                        onClick={() => setRightPane(pane)}
                        className={`px-2 md:px-2.5 py-1.5 md:py-1 text-[10px] font-mono transition-colors whitespace-nowrap ${
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
                {/* Scroll fade hint on the right */}
                <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[hsl(var(--bg-raised))] to-transparent pointer-events-none md:hidden" />
              </div>

              {/* Active pane */}
              <div className="flex-1 min-h-0 overflow-y-auto">
                {rightPane === "preview" && (
                  <ProfilePreviewPane userId={convexUser._id} username={username} ownerId={convexUser._id} />
                )}
                {rightPane === "json" && <JsonPane userId={convexUser._id} />}
                {rightPane === "settings" && user?.id && (
                  <SettingsPane clerkId={user.id} username={username} />
                )}
                {rightPane === "tokens" && user?.id && (
                  <TokensPane clerkId={user.id} />
                )}
                {rightPane === "billing" && (
                  <BillingPane plan={plan} username={username} />
                )}
                {rightPane === "sources" && (
                  <SourcesPane username={username} />
                )}
                {rightPane === "portrait" && (
                  <PortraitPane username={username} />
                )}
                {rightPane === "publish" && (
                  <PublishPane username={username} userId={convexUser._id} />
                )}
                {rightPane === "agents" && (
                  <AgentsPane username={username} profileId={userProfile?._id} />
                )}
                {rightPane === "activity" && (
                  <ActivityPane username={username} />
                )}
                {rightPane === "help" && <HelpPane />}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
