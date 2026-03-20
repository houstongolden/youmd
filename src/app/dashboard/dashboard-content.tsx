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

  const [rightPane, setRightPane] = useState<RightPane>("preview");
  const [mobileShowPreview, setMobileShowPreview] = useState(false);

  const agent = useYouAgent({
    onPaneSwitch: (pane) => {
      setRightPane(pane);
      setMobileShowPreview(true);
    },
  });

  // No Convex user — redirect to /initialize
  useEffect(() => {
    if (convexUser === null) {
      router.replace("/initialize");
    }
  }, [convexUser, router]);

  if (!convexUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[hsl(var(--bg))]">
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

  return (
    <div className="h-screen flex flex-col bg-[hsl(var(--bg))] text-[hsl(var(--text-primary))]">
      {/* Top bar — matching reference shell */}
      <div className="h-12 border-b border-[hsl(var(--border))] flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[hsl(var(--accent))] font-bold text-sm">YOU</span>
          <span className="text-[10px] font-mono text-[hsl(var(--text-secondary))] opacity-40">
            v{version ?? "0"}.0
          </span>
          <span className="text-[hsl(var(--border))]">|</span>
          <span className="text-[11px] font-mono text-[hsl(var(--text-secondary))] opacity-50">
            @{username}
          </span>
          <span className="text-[hsl(var(--border))]">|</span>
          <span
            className={`text-[10px] font-mono ${
              isPublished
                ? "text-[hsl(var(--success))]"
                : "text-[hsl(var(--text-secondary))] opacity-40"
            }`}
          >
            {isPublished ? "published" : "draft"}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {/* Mobile toggle */}
          <button
            onClick={() => setMobileShowPreview(!mobileShowPreview)}
            className="md:hidden font-mono text-[11px] text-[hsl(var(--text-secondary))] opacity-60 hover:text-[hsl(var(--accent))] transition-colors"
          >
            {mobileShowPreview ? "terminal" : "preview"}
          </button>
          <SignOutButton>
            <button className="font-mono text-[11px] text-[hsl(var(--text-secondary))] opacity-40 hover:text-[hsl(var(--text-primary))] transition-colors">
              sign out
            </button>
          </SignOutButton>
          <div className="w-7 h-7 rounded-full bg-[hsl(var(--accent))]/20 flex items-center justify-center">
            <span className="text-[hsl(var(--accent))] text-xs font-mono">
              {username[0]?.toUpperCase()}
            </span>
          </div>
        </div>
      </div>

      {/* Split layout */}
      <div className="flex-1 flex min-h-0">
        {/* Left: Terminal — 35% */}
        <div
          className={`${mobileShowPreview ? "hidden md:flex" : "flex"} md:w-[35%] w-full flex-col border-r border-[hsl(var(--border))] min-h-0`}
        >
          <TerminalHeader title="terminal" />
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

        {/* Right: Preview — 65% */}
        <div
          className={`${mobileShowPreview ? "flex" : "hidden md:flex"} md:w-[65%] w-full flex-col min-h-0`}
        >
          {/* Pane tab bar */}
          <div className="flex items-center justify-between px-4 py-1.5 border-b border-[hsl(var(--border))] shrink-0">
            <div className="flex items-center gap-0.5">
              {(
                ["preview", "json", "settings", "tokens", "billing"] as RightPane[]
              ).map((pane) => (
                <button
                  key={pane}
                  onClick={() => setRightPane(pane)}
                  className={`px-2.5 py-1 text-[10px] font-mono transition-colors ${
                    rightPane === pane
                      ? "text-[hsl(var(--text-primary))] bg-[hsl(var(--bg-raised))] border border-[hsl(var(--border))]"
                      : "text-[hsl(var(--text-secondary))] opacity-40 hover:opacity-70"
                  }`}
                  style={{ borderRadius: "2px" }}
                >
                  {pane}
                </button>
              ))}
            </div>
          </div>

          {/* Active pane */}
          <div className="flex-1 min-h-0 overflow-y-auto">
            {rightPane === "preview" && (
              <ProfilePreviewPane userId={convexUser._id} username={username} />
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
          </div>
        </div>
      </div>
    </div>
  );
}
