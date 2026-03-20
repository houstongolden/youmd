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

  return (
    <div className="h-[100dvh] flex flex-col bg-[hsl(var(--bg))] text-[hsl(var(--text-primary))] p-0 md:p-3">
      {/* Terminal panel wrapper — consistent with auth pages */}
      <div
        className="flex-1 flex flex-col bg-[hsl(var(--bg-raised))] md:border md:border-[hsl(var(--border))] overflow-hidden min-h-0"
        style={{ borderRadius: "0px" }}
      >
        {/* Header — colored dots + status (matches TerminalHeader style) */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[hsl(var(--border))] shrink-0">
          <div className="flex gap-1.5">
            <span className="w-3 h-3 rounded-full" style={{ background: "rgba(239, 68, 68, 0.6)" }} />
            <span className="w-3 h-3 rounded-full" style={{ background: "rgba(234, 179, 8, 0.6)" }} />
            <span className="w-3 h-3 rounded-full" style={{ background: "rgba(34, 197, 94, 0.6)" }} />
          </div>
          <span className="text-sm font-mono text-[hsl(var(--text-secondary))] opacity-60 ml-2">
            you.md — shell
          </span>

          {/* Status items pushed right */}
          <div className="flex-1" />
          <div className="flex items-center gap-2 text-[10px] font-mono text-[hsl(var(--text-secondary))]">
            <span className="text-[hsl(var(--text-primary))] opacity-70">@{username}</span>
            <span className="opacity-20">|</span>
            <span className="opacity-40">{plan}</span>
            <span className="opacity-20">|</span>
            <span className="opacity-40">v{version ?? "0"}</span>
            <span className="opacity-20">|</span>
            <span className={isPublished ? "text-[hsl(var(--success))]" : "opacity-40"}>
              {isPublished ? "published" : "draft"}
            </span>
            <span className="opacity-20">|</span>
            <SignOutButton>
              <button className="opacity-40 hover:opacity-80 transition-opacity">
                sign out
              </button>
            </SignOutButton>
          </div>
        </div>

        {/* Mobile view toggle */}
        <div className="md:hidden flex items-center border-b border-[hsl(var(--border))] shrink-0">
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

        {/* Content area */}
        <div className="flex-1 flex min-h-0">
          {/* Left: Terminal */}
          <div
            className={`${mobileView === "preview" ? "hidden md:flex" : "flex"} md:w-[35%] w-full flex-col md:border-r md:border-[hsl(var(--border))] min-h-0`}
          >
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

          {/* Right: Preview panes */}
          <div
            className={`${mobileView === "terminal" ? "hidden md:flex" : "flex"} md:w-[65%] w-full flex-col min-h-0`}
          >
            {/* Pane tabs */}
            <div className="flex items-center px-4 py-1.5 border-b border-[hsl(var(--border))] shrink-0">
              <div className="flex items-center gap-0.5">
                {(["preview", "json", "settings", "tokens", "billing"] as RightPane[]).map((pane) => (
                  <button
                    key={pane}
                    onClick={() => setRightPane(pane)}
                    className={`px-2.5 py-1 text-[10px] font-mono transition-colors ${
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
    </div>
  );
}
