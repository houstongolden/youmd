"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useState } from "react";
import { useUser, useClerk } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { PaneSectionLabel as SectionLabel, PaneDivider as Divider, PaneHeader } from "./shared";

interface SettingsPaneProps {
  clerkId: string;
  username: string;
  plan: string;
  profileId?: Id<"profiles">;
}

function SettingRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between font-mono text-[11px] py-2 border-b border-[hsl(var(--border))]/50 last:border-0">
      <span className="text-[hsl(var(--text-secondary))] opacity-60">{label}</span>
      <span className={accent ? "text-[hsl(var(--accent-mid))]" : "text-[hsl(var(--text-primary))] opacity-70"}>{value}</span>
    </div>
  );
}

// ── Activity log types ──────────────────────────────────────

const EVENT_ICONS: Record<string, string> = {
  profile_created: "\u2295",
  profile_claimed: "\u2295",
  token_created: "\u25C7",
  token_used: "\u25C7",
  token_revoked: "\u2717",
  profile_updated: "\u25B3",
  source_added: "\u21BB",
  private_context_updated: "\u25A0",
};

const EVENT_COLORS: Record<string, string> = {
  profile_created: "text-[hsl(var(--success))]",
  profile_claimed: "text-[hsl(var(--success))]",
  token_created: "text-[hsl(var(--accent))]",
  token_used: "text-[hsl(var(--text-primary))] opacity-60",
  token_revoked: "text-red-500",
  profile_updated: "text-[hsl(var(--accent))]",
  source_added: "text-[hsl(var(--accent))]",
  private_context_updated: "text-[hsl(var(--accent))]",
};

function formatLogDetails(details: Record<string, unknown> | undefined): string {
  if (!details) return "";
  const parts: string[] = [];
  if (details.username) parts.push(`@${details.username}`);
  if (details.token_name) parts.push(`"${details.token_name}"`);
  if (details.reason) parts.push(`${details.reason}`);
  return parts.length > 0 ? ` -- ${parts.join(", ")}` : "";
}

export function SettingsPane({ clerkId, username, plan, profileId }: SettingsPaneProps) {
  const { user } = useUser();
  const { signOut } = useClerk();
  const router = useRouter();

  // API keys
  const keys = useQuery(api.apiKeys.listKeys, clerkId ? { clerkId } : "skip");
  const createKey = useMutation(api.apiKeys.createKey);
  const revokeKey = useMutation(api.apiKeys.revokeKey);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [creatingKey, setCreatingKey] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);
  const [confirmRevokeKey, setConfirmRevokeKey] = useState<string | null>(null);
  const [showAllKeys, setShowAllKeys] = useState(false);

  // Sort: active (not revoked) first, then revoked. Within each group, newest first.
  const sortedKeys = keys
    ? [...keys].sort((a, b) => {
        if (a.isRevoked !== b.isRevoked) return a.isRevoked ? 1 : -1;
        // newer createdAt first
        const aTs = a.createdAt ? Date.parse(a.createdAt) : 0;
        const bTs = b.createdAt ? Date.parse(b.createdAt) : 0;
        return bTs - aTs;
      })
    : [];

  const KEY_LIMIT = 5;
  const visibleKeys = showAllKeys ? sortedKeys : sortedKeys.slice(0, KEY_LIMIT);
  const hiddenKeyCount = Math.max(0, sortedKeys.length - KEY_LIMIT);

  // Activity logs from Convex
  const logs = useQuery(
    api.profiles.getSecurityLogs,
    profileId && clerkId ? { clerkId, profileId } : "skip"
  );

  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleCreateKey = async () => {
    setCreatingKey(true);
    setKeyError(null);
    try {
      const result = await createKey({
        clerkId,
        label: "CLI key",
        scopes: ["read:public"],
      });
      setNewKey(result.key);
    } catch (err) {
      setKeyError(err instanceof Error ? err.message : "failed to create key.");
    }
    setCreatingKey(false);
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
          <SettingRow label="plan" value={plan} />
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

        {/* API Keys */}
        <div className="flex items-center justify-between mb-3">
          <SectionLabel>api keys</SectionLabel>
          <button
            onClick={handleCreateKey}
            disabled={creatingKey}
            className="text-[10px] font-mono px-2 py-1 border border-[hsl(var(--border))] text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))] hover:border-[hsl(var(--accent))]/40 transition-colors disabled:opacity-30"
            style={{ borderRadius: "2px" }}
          >
            {creatingKey ? "creating..." : "create key"}
          </button>
        </div>

        {keyError && (
          <p className="text-[10px] text-[hsl(var(--accent))] font-mono mb-2">
            {keyError}
          </p>
        )}

        {newKey && (
          <div
            className="p-3 border border-[hsl(var(--accent))]/20 bg-[hsl(var(--accent-wash))] space-y-2 mb-3"
            style={{ borderRadius: "2px" }}
          >
            <p className="text-[10px] text-[hsl(var(--accent-mid))] font-mono">
              key created. copy it now -- it will not be shown again.
            </p>
            <code className="block text-[10px] font-mono text-[hsl(var(--text-primary))] bg-[hsl(var(--bg))] p-2 break-all select-all">
              {newKey}
            </code>
            <button
              onClick={() => {
                navigator.clipboard.writeText(newKey);
                setNewKey(null);
              }}
              className="text-[10px] text-[hsl(var(--accent-mid))] hover:text-[hsl(var(--accent))] font-mono transition-colors"
            >
              copy and dismiss
            </button>
          </div>
        )}

        {keys && sortedKeys.length > 0 ? (
          <div className="space-y-2">
            {visibleKeys.map((k) => (
              <div
                key={k.id}
                className="flex items-center justify-between px-3 py-2.5 border border-[hsl(var(--border))] bg-[hsl(var(--bg-raised))] text-[10px] font-mono"
                style={{ borderRadius: "2px" }}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <code className="text-[hsl(var(--text-primary))] px-1.5 py-0.5 bg-[hsl(var(--bg))] border border-[hsl(var(--border))]">
                      {k.keyPrefix}...
                    </code>
                    {k.label && (
                      <span className="text-[hsl(var(--text-secondary))] opacity-40">
                        {k.label}
                      </span>
                    )}
                  </div>
                  <div className="text-[hsl(var(--text-secondary))] opacity-40">
                    {k.scopes.join(", ")}
                    {k.lastUsedAt &&
                      ` -- last used ${k.lastUsedAt.split("T")[0]}`}
                  </div>
                </div>
                {!k.isRevoked ? (
                  <button
                    onClick={() => {
                      if (confirmRevokeKey === k.id) {
                        revokeKey({ clerkId, keyId: k.id });
                        setConfirmRevokeKey(null);
                      } else {
                        setConfirmRevokeKey(k.id);
                        setTimeout(() => setConfirmRevokeKey((c) => c === k.id ? null : c), 3000);
                      }
                    }}
                    className={`transition-colors ${confirmRevokeKey === k.id ? "text-red-400 hover:text-red-300" : "text-[hsl(var(--accent))] hover:text-[hsl(var(--accent-dark))]"}`}
                  >
                    {confirmRevokeKey === k.id ? "confirm?" : "revoke"}
                  </button>
                ) : (
                  <span className="text-[hsl(var(--text-secondary))] opacity-25">
                    revoked
                  </span>
                )}
              </div>
            ))}

            {/* Footer: count + load more / collapse */}
            <div className="flex items-center justify-between pt-1">
              <p className="text-[10px] font-mono text-[hsl(var(--text-secondary))] opacity-30">
                {visibleKeys.length} of {sortedKeys.length} keys shown
              </p>
              {hiddenKeyCount > 0 && (
                <button
                  onClick={() => setShowAllKeys((v) => !v)}
                  className="text-[10px] font-mono text-[hsl(var(--accent))] opacity-60 hover:opacity-100 transition-opacity"
                >
                  {showAllKeys
                    ? "[show less]"
                    : `[load more keys (${hiddenKeyCount} hidden)]`}
                </button>
              )}
            </div>
          </div>
        ) : (
          <p className="text-[10px] text-[hsl(var(--text-secondary))] opacity-25 font-mono">
            no api keys yet. create one to use the cli.
          </p>
        )}

        <Divider />

        {/* Billing */}
        <SectionLabel>billing</SectionLabel>
        <div
          className="border border-[hsl(var(--border))] p-4 bg-[hsl(var(--bg-raised))] font-mono text-[10px] space-y-1.5 text-[hsl(var(--text-secondary))]"
          style={{ borderRadius: "2px" }}
        >
          <p>-- public profile at you.md/{username}</p>
          <p>-- cli access (youmd)</p>
          <p>-- web agent chat</p>
          <p>-- api keys</p>
          <p>-- context links</p>
          {plan === "pro" && (
            <p className="text-[hsl(var(--accent))]">-- priority pipeline</p>
          )}
          {plan === "pro" && (
            <p className="text-[hsl(var(--accent))]">-- custom domain</p>
          )}
          <p className="opacity-30 mt-2">
            billing management coming soon. you.md is free during beta.
          </p>
        </div>

        <Divider />

        {/* Activity */}
        <SectionLabel>activity log</SectionLabel>
        {logs === undefined ? (
          <p className="text-[10px] text-[hsl(var(--text-secondary))] opacity-40 font-mono mb-2 animate-pulse">
            loading...
          </p>
        ) : logs && logs.length > 0 ? (
          <div className="space-y-0 mb-2">
            {logs.map((log) => (
              <div
                key={log._id}
                className="flex items-center gap-3 py-2 border-b border-[hsl(var(--border))] opacity-60 last:border-0"
              >
                <span className={`font-mono text-[12px] w-4 text-center shrink-0 ${EVENT_COLORS[log.eventType] || "text-[hsl(var(--text-secondary))] opacity-50"}`}>
                  {EVENT_ICONS[log.eventType] || "\u00B7"}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-[11px] text-[hsl(var(--text-primary))] opacity-80 truncate">
                    {log.eventType.replace(/_/g, " ")}
                    {formatLogDetails(log.details as Record<string, unknown> | undefined)}
                  </p>
                </div>
                <span className="font-mono text-[9px] text-[hsl(var(--text-secondary))] opacity-40 shrink-0">
                  {new Date(log.createdAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[10px] text-[hsl(var(--text-secondary))] opacity-25 font-mono mb-2">
            no activity recorded yet.
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
