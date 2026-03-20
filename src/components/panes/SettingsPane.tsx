"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useState } from "react";
import { CopyButton } from "@/components/ui/CopyButton";

interface SettingsPaneProps {
  clerkId: string;
  username: string;
}

export function SettingsPane({ clerkId, username }: SettingsPaneProps) {
  const links = useQuery(api.contextLinks.listLinks, clerkId ? { clerkId } : "skip");
  const createLink = useMutation(api.contextLinks.createLink);
  const revokeLink = useMutation(api.contextLinks.revokeLink);
  const [creating, setCreating] = useState(false);
  const [newLink, setNewLink] = useState<string | null>(null);

  const handleCreateLink = async () => {
    setCreating(true);
    try {
      const result = await createLink({ clerkId, scope: "public", ttl: "7d" });
      setNewLink(result.url);
    } catch {
      // silently handle
    }
    setCreating(false);
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-6 py-3 border-b border-[hsl(var(--border))]">
        <span className="text-xs font-mono text-[hsl(var(--text-secondary))]">
          settings
        </span>
      </div>

      <div className="px-6 py-6 space-y-8 max-w-xl">
        {/* Account info */}
        <section className="space-y-3">
          <h3 className="text-[10px] font-mono text-[hsl(var(--text-secondary))] opacity-40 uppercase tracking-widest">
            account
          </h3>
          <div
            className="border border-[hsl(var(--border))] p-4 bg-[hsl(var(--bg-raised))] font-mono text-xs space-y-2"
            style={{ borderRadius: "2px" }}
          >
            <div className="flex gap-2">
              <span className="text-[hsl(var(--text-secondary))] opacity-40 w-20">
                username
              </span>
              <span className="text-[hsl(var(--text-primary))]">@{username}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-[hsl(var(--text-secondary))] opacity-40 w-20">
                profile
              </span>
              <span className="text-[hsl(var(--accent-mid))]">
                you.md/{username}
              </span>
            </div>
          </div>
        </section>

        {/* Context Links */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-[10px] font-mono text-[hsl(var(--text-secondary))] opacity-40 uppercase tracking-widest">
              context links
            </h3>
            <button
              onClick={handleCreateLink}
              disabled={creating}
              className="text-[10px] font-mono px-2 py-1 border border-[hsl(var(--border))] text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))] hover:border-[hsl(var(--accent))]/40 transition-colors disabled:opacity-30"
              style={{ borderRadius: "2px" }}
            >
              {creating ? "creating..." : "create link"}
            </button>
          </div>

          <p className="text-[11px] text-[hsl(var(--text-secondary))] opacity-40">
            share your identity bundle with any AI agent. paste into any
            conversation.
          </p>

          {newLink && (
            <div
              className="p-3 border border-[hsl(var(--accent))]/20 bg-[hsl(var(--accent-wash))] space-y-2"
              style={{ borderRadius: "2px" }}
            >
              <p className="text-[10px] text-[hsl(var(--accent-mid))] font-mono">
                link created (expires in 7 days):
              </p>
              <code className="block text-[10px] font-mono text-[hsl(var(--text-primary))] bg-[hsl(var(--bg))] p-2 break-all select-all">
                {newLink}
              </code>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(newLink);
                  setNewLink(null);
                }}
                className="text-[10px] text-[hsl(var(--accent-mid))] hover:text-[hsl(var(--accent))] font-mono transition-colors"
              >
                copy and dismiss
              </button>
            </div>
          )}

          {links && links.length > 0 ? (
            <div className="space-y-2">
              {links.map((link) => (
                <div
                  key={link.id}
                  className={`flex items-center justify-between px-3 py-2.5 border border-[hsl(var(--border))] bg-[hsl(var(--bg-raised))] text-[10px] font-mono ${
                    link.isExpired ? "opacity-30" : ""
                  }`}
                  style={{ borderRadius: "2px" }}
                >
                  <div className="space-y-1 min-w-0 flex-1 mr-3">
                    <div className="flex items-center gap-2">
                      <code className="text-[hsl(var(--accent-mid))] truncate">
                        you.md/ctx/{username}/{link.token}
                      </code>
                      {!link.isExpired && (
                        <CopyButton
                          text={`https://you.md/ctx/${username}/${link.token}`}
                          className="shrink-0 px-1.5 py-0.5 border border-[hsl(var(--border))] text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))] hover:border-[hsl(var(--accent))]/40 transition-colors text-[9px]"
                        />
                      )}
                    </div>
                    <div className="text-[hsl(var(--text-secondary))] opacity-40">
                      {link.scope} -- {link.useCount} uses --{" "}
                      {link.isExpired
                        ? "expired"
                        : `expires ${typeof link.expiresAt === "string" ? link.expiresAt.split("T")[0] : "never"}`}
                    </div>
                  </div>
                  {!link.isExpired && (
                    <button
                      onClick={() => revokeLink({ clerkId, linkId: link.id })}
                      className="text-[hsl(var(--accent))] hover:text-[hsl(var(--accent-dark))] transition-colors"
                    >
                      revoke
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[10px] text-[hsl(var(--text-secondary))] opacity-25 font-mono">
              no context links yet.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
