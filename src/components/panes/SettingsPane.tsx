"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useState } from "react";
import { useUser, useClerk } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { CopyButton } from "@/components/ui/CopyButton";
import { PaneSectionLabel as SectionLabel, PaneDivider as Divider, PaneHeader } from "./shared";

interface SettingsPaneProps {
  clerkId: string;
  username: string;
}

function SettingRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between font-mono text-[11px] py-2 border-b border-[hsl(var(--border))]/50 last:border-0">
      <span className="text-[hsl(var(--text-secondary))] opacity-60">{label}</span>
      <span className={accent ? "text-[hsl(var(--accent-mid))]" : "text-[hsl(var(--text-primary))] opacity-70"}>{value}</span>
    </div>
  );
}

export function SettingsPane({ clerkId, username }: SettingsPaneProps) {
  const { user } = useUser();
  const { signOut } = useClerk();
  const router = useRouter();
  const links = useQuery(api.contextLinks.listLinks, clerkId ? { clerkId } : "skip");
  const createLink = useMutation(api.contextLinks.createLink);
  const revokeLink = useMutation(api.contextLinks.revokeLink);
  const [creating, setCreating] = useState(false);
  const [newLink, setNewLink] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

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

  const handleSignOut = () => {
    signOut({ redirectUrl: "/" });
  };

  return (
    <div className="h-full overflow-y-auto">
      <PaneHeader>settings</PaneHeader>

      <div className="px-6 py-6 space-y-0 max-w-xl">
        {/* Account info */}
        <SectionLabel>account</SectionLabel>
        <div
          className="border border-[hsl(var(--border))] p-4 bg-[hsl(var(--bg-raised))] font-mono text-xs space-y-0"
          style={{ borderRadius: "2px" }}
        >
          <SettingRow label="username" value={`@${username}`} />
          <SettingRow label="email" value={user?.emailAddresses?.[0]?.emailAddress || "--"} />
          <SettingRow label="plan" value="free" />
          <SettingRow label="profile" value={`you.md/${username}`} accent />
        </div>

        <Divider />

        {/* Identity preferences */}
        <SectionLabel>identity preferences</SectionLabel>
        <div
          className="border border-[hsl(var(--border))] p-4 bg-[hsl(var(--bg-raised))] font-mono text-xs space-y-0"
          style={{ borderRadius: "2px" }}
        >
          <SettingRow label="default context" value="public" />
          <SettingRow label="agent access" value="all agents" />
          <SettingRow label="update mode" value="auto-publish" />
          <SettingRow label="portrait style" value="ascii 120-col" />
        </div>

        <Divider />

        {/* Context Links */}
        <div className="flex items-center justify-between mb-3">
          <SectionLabel>context links</SectionLabel>
          <button
            onClick={handleCreateLink}
            disabled={creating}
            className="text-[10px] font-mono px-2 py-1 border border-[hsl(var(--border))] text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))] hover:border-[hsl(var(--accent))]/40 transition-colors disabled:opacity-30"
            style={{ borderRadius: "2px" }}
          >
            {creating ? "creating..." : "create link"}
          </button>
        </div>

        <p className="text-[11px] text-[hsl(var(--text-secondary))] opacity-40 mb-3">
          share your identity bundle with any AI agent. paste into any
          conversation.
        </p>

        {newLink && (
          <div
            className="p-3 border border-[hsl(var(--accent))]/20 bg-[hsl(var(--accent-wash))] space-y-2 mb-3"
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

        <Divider />

        {/* Actions */}
        <SectionLabel>actions</SectionLabel>
        <div className="space-y-3">
          <button
            onClick={handleSignOut}
            className="font-mono text-[11px] text-[hsl(var(--text-secondary))] opacity-60 hover:text-[hsl(var(--text-primary))] transition-colors"
          >
            &gt; sign out
          </button>

          <div>
            <button
              onClick={() => {
                if (!confirmDelete) {
                  setConfirmDelete(true);
                  return;
                }
                // TODO: implement profile deletion mutation
                router.push("/");
              }}
              className="font-mono text-[11px] text-[hsl(var(--accent))] opacity-70 hover:opacity-100 transition-opacity"
            >
              {confirmDelete ? "confirm permanent deletion" : "> delete profile"}
            </button>
            {confirmDelete && (
              <p className="font-mono text-[9px] text-[hsl(var(--accent))] opacity-50 mt-1">
                this will permanently delete your profile, sources, tokens, and private data. click again to confirm.
              </p>
            )}
          </div>
        </div>

        <div className="mt-6 font-mono text-[10px] text-[hsl(var(--text-secondary))] opacity-30">
          tip: update settings via terminal -- <span className="text-[hsl(var(--accent))] opacity-60">set context private</span>
        </div>
      </div>
    </div>
  );
}
