"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useState } from "react";

interface TokensPaneProps {
  clerkId: string;
}

export function TokensPane({ clerkId }: TokensPaneProps) {
  const keys = useQuery(api.apiKeys.listKeys, clerkId ? { clerkId } : "skip");
  const createKey = useMutation(api.apiKeys.createKey);
  const revokeKey = useMutation(api.apiKeys.revokeKey);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);

  const handleCreate = async () => {
    setCreating(true);
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
    setCreating(false);
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-6 py-3 border-b border-[hsl(var(--border))] flex items-center justify-between">
        <span className="text-xs font-mono text-[hsl(var(--text-secondary))]">
          api keys
        </span>
        <button
          onClick={handleCreate}
          disabled={creating}
          className="text-[10px] font-mono px-2 py-1 border border-[hsl(var(--border))] text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))] hover:border-[hsl(var(--accent))]/40 transition-colors disabled:opacity-30"
          style={{ borderRadius: "2px" }}
        >
          {creating ? "creating..." : "create key"}
        </button>
      </div>

      <div className="px-6 py-6 space-y-4 max-w-xl">
        {keyError && (
          <p className="text-[10px] text-[hsl(var(--accent))] font-mono">
            {keyError}
          </p>
        )}

        {newKey && (
          <div
            className="p-3 border border-[hsl(var(--accent))]/20 bg-[hsl(var(--accent-wash))] space-y-2"
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

        {keys && keys.length > 0 ? (
          <div className="space-y-2">
            {keys.map((k) => (
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
                    onClick={() => revokeKey({ clerkId, keyId: k.id })}
                    className="text-[hsl(var(--accent))] hover:text-[hsl(var(--accent-dark))] transition-colors"
                  >
                    revoke
                  </button>
                ) : (
                  <span className="text-[hsl(var(--text-secondary))] opacity-25">
                    revoked
                  </span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[10px] text-[hsl(var(--text-secondary))] opacity-25 font-mono">
            no api keys yet. create one to use the cli.
          </p>
        )}
      </div>
    </div>
  );
}
