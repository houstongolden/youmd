"use client";

import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useYouAgent, type RightPane } from "@/hooks/useYouAgent";
import { TerminalShell } from "@/components/terminal/TerminalShell";
import { TerminalStatusBar } from "@/components/terminal/TerminalStatusBar";
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

  // Clerk user exists but no Convex user — redirect to /initialize
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
      {/* Status bar */}
      <TerminalStatusBar
        username={username}
        plan={plan}
        version={version}
        isPublished={isPublished}
      />

      {/* Split-screen content */}
      <div className="flex-1 flex min-h-0">
        {/* Left: Terminal (35% on desktop, full on mobile) */}
        <div
          className={`${mobileShowPreview ? "hidden md:flex" : "flex"} md:w-[35%] w-full flex-col border-r border-[hsl(var(--border))] min-h-0`}
        >
          {/* Terminal label bar */}
          <div className="flex items-center justify-between px-4 py-1.5 border-b border-[hsl(var(--border))] shrink-0">
            <div className="flex items-center gap-2">
              <div className="flex gap-1.5">
                <div className="terminal-dot" />
                <div className="terminal-dot" />
                <div className="terminal-dot" />
              </div>
              <span className="text-[10px] font-mono text-[hsl(var(--text-secondary))] opacity-50">
                agent
              </span>
            </div>
            {/* Mobile: toggle to preview */}
            <button
              onClick={() => setMobileShowPreview(true)}
              className="md:hidden text-[10px] font-mono text-[hsl(var(--accent-mid))]"
            >
              preview &gt;
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

        {/* Right: Preview pane (65% on desktop, toggled on mobile) */}
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
            {/* Mobile: back to terminal */}
            <button
              onClick={() => setMobileShowPreview(false)}
              className="md:hidden text-[10px] font-mono text-[hsl(var(--accent-mid))]"
            >
              &lt; terminal
            </button>
          </div>

          {/* Active pane */}
          <div className="flex-1 min-h-0">
            {rightPane === "preview" && (
              <ProfilePreviewPane
                userId={convexUser._id}
                username={username}
              />
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
