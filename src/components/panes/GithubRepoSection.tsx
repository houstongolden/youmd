"use client";

import { useState } from "react";
import { useQuery, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import {
  PaneSectionLabel as SectionLabel,
  PaneCard,
  PaneButton,
} from "./shared";

type RepoResult = {
  ok: boolean;
  created: boolean;
  repoFullName: string;
  visibility: string;
  defaultBranch: string;
  htmlUrl: string;
};

type RepoListItem = {
  fullName: string;
  name: string;
  visibility: string;
  defaultBranch: string;
  updatedAt: string;
};

/**
 * Phase 2: connect or create the user's own You.md GitHub repo (public or
 * private). Terminal-native — visibility is a toggle, existing repos are a
 * pickable list. No text-input forms.
 */
export function GithubRepoSection({ clerkId }: { clerkId: string }) {
  const connection = useQuery(
    api.github.getConnection,
    clerkId ? { clerkId } : "skip"
  );
  const createRepo = useAction(api.githubRepo.createRepo);
  const connectRepo = useAction(api.githubRepo.connectRepo);
  const listRepos = useAction(api.githubRepo.listRepos);

  const [visibility, setVisibility] = useState<"private" | "public">("private");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RepoResult | null>(null);
  const [repoList, setRepoList] = useState<RepoListItem[] | null>(null);
  const [reconfiguring, setReconfiguring] = useState(false);

  const startUrl = `/api/auth/github/start?next=${encodeURIComponent("/shell")}`;

  const handleCreate = async () => {
    setBusy("create");
    setError(null);
    try {
      const res = (await createRepo({ clerkId, visibility })) as RepoResult;
      setResult(res);
      setReconfiguring(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "could not create repo.");
    }
    setBusy(null);
  };

  const handleLoadRepos = async () => {
    setBusy("list");
    setError(null);
    try {
      const repos = (await listRepos({ clerkId })) as RepoListItem[];
      setRepoList(repos);
    } catch (err) {
      setError(err instanceof Error ? err.message : "could not list repos.");
    }
    setBusy(null);
  };

  const handleConnect = async (repoFullName: string) => {
    setBusy(`connect:${repoFullName}`);
    setError(null);
    try {
      const res = (await connectRepo({ clerkId, repoFullName })) as RepoResult;
      setResult(res);
      setRepoList(null);
      setReconfiguring(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "could not connect repo.");
    }
    setBusy(null);
  };

  // ── Loading ──────────────────────────────────────────────
  if (connection === undefined) {
    return (
      <>
        <SectionLabel>github repo</SectionLabel>
        <p className="text-[10px] text-[hsl(var(--text-secondary))] opacity-40 font-mono animate-pulse">
          loading...
        </p>
      </>
    );
  }

  // ── No GitHub connection yet (e.g. signed up via email) ───
  if (connection === null) {
    return (
      <>
        <SectionLabel>github repo</SectionLabel>
        <PaneCard className="space-y-2 font-mono text-[10px] text-[hsl(var(--text-secondary))]">
          <p className="opacity-70">
            host your full You.md and stacks in your own GitHub repo — public or
            private. connect GitHub to begin.
          </p>
          <a
            href={startUrl}
            className="inline-flex items-center gap-2 border border-[hsl(var(--border))] px-3 py-2 text-[hsl(var(--text-primary))] hover:border-[hsl(var(--accent))] transition-colors"
            style={{ borderRadius: "2px" }}
          >
            connect github{" "}
            <span className="text-[hsl(var(--accent))]">{"\u2192"}</span>
          </a>
        </PaneCard>
      </>
    );
  }

  const linkedRepo = result?.repoFullName || connection.repoFullName;
  const linkedVisibility = result?.visibility || connection.repoVisibility;
  const linkedBranch = result?.defaultBranch || connection.repoDefaultBranch;
  const repoUrl = linkedRepo ? `https://github.com/${linkedRepo}` : null;

  // ── Repo already linked ──────────────────────────────────
  if (linkedRepo && !reconfiguring) {
    return (
      <>
        <SectionLabel>github repo</SectionLabel>
        <PaneCard className="space-y-2 font-mono text-[10px]">
          <div className="flex items-center justify-between">
            <span className="text-[hsl(var(--text-secondary))] opacity-60">
              repo
            </span>
            {repoUrl ? (
              <a
                href={repoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[hsl(var(--accent-mid))] hover:text-[hsl(var(--accent))] transition-colors"
              >
                {linkedRepo}
              </a>
            ) : (
              <span className="text-[hsl(var(--text-primary))]">{linkedRepo}</span>
            )}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[hsl(var(--text-secondary))] opacity-60">
              visibility
            </span>
            <span
              className={
                linkedVisibility === "private"
                  ? "text-[hsl(var(--accent-mid))]"
                  : "text-[hsl(var(--success))]"
              }
            >
              {linkedVisibility}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[hsl(var(--text-secondary))] opacity-60">
              branch
            </span>
            <span className="text-[hsl(var(--text-primary))] opacity-70">
              {linkedBranch || "main"}
            </span>
          </div>
          {connection.connectedAt && (
            <div className="flex items-center justify-between">
              <span className="text-[hsl(var(--text-secondary))] opacity-60">
                github
              </span>
              <span className="text-[hsl(var(--text-primary))] opacity-70">
                @{connection.githubLogin}
              </span>
            </div>
          )}
          {result?.created && (
            <p className="text-[hsl(var(--success))] opacity-80 pt-1">
              {"\u2713"} repo created and seeded with your identity files.
            </p>
          )}
        </PaneCard>
        <button
          onClick={() => {
            setReconfiguring(true);
            setResult(null);
          }}
          className="mt-2 font-mono text-[10px] text-[hsl(var(--text-secondary))] opacity-50 hover:opacity-100 transition-opacity"
        >
          &gt; change repo
        </button>
      </>
    );
  }

  // ── Connected, no repo yet (or reconfiguring) ────────────
  return (
    <>
      <SectionLabel>github repo</SectionLabel>
      <PaneCard className="space-y-3 font-mono text-[10px]">
        <p className="text-[hsl(var(--text-secondary))] opacity-70">
          create your You.md repo (named{" "}
          <span className="text-[hsl(var(--accent))]">you-md</span>) and we&apos;ll
          seed it with your identity files. choose visibility:
        </p>

        <div className="flex items-center gap-2">
          {(["private", "public"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setVisibility(v)}
              className={`px-3 py-1.5 border transition-colors ${
                visibility === v
                  ? "border-[hsl(var(--accent))] text-[hsl(var(--accent))]"
                  : "border-[hsl(var(--border))] text-[hsl(var(--text-secondary))] opacity-60 hover:opacity-100"
              }`}
              style={{ borderRadius: "2px" }}
            >
              {visibility === v ? "\u25C9 " : "\u25CB "}
              {v}
            </button>
          ))}
        </div>

        <PaneButton
          onClick={handleCreate}
          disabled={busy !== null}
          variant="secondary"
          className="text-accent"
        >
          {busy === "create" ? "creating..." : "create my you.md repo"}
        </PaneButton>

        <div className="flex items-center gap-3 text-[hsl(var(--text-secondary))] opacity-40">
          <span className="h-px flex-1 bg-[hsl(var(--border))]" />
          or connect an existing repo
          <span className="h-px flex-1 bg-[hsl(var(--border))]" />
        </div>

        {repoList === null ? (
          <button
            onClick={handleLoadRepos}
            disabled={busy !== null}
            className="text-[hsl(var(--accent))] opacity-70 hover:opacity-100 transition-opacity disabled:opacity-30"
          >
            {busy === "list" ? "loading your repos..." : "> list my repos"}
          </button>
        ) : repoList.length === 0 ? (
          <p className="text-[hsl(var(--text-secondary))] opacity-40">
            no repos with write access found.
          </p>
        ) : (
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {repoList.map((r) => (
              <button
                key={r.fullName}
                onClick={() => handleConnect(r.fullName)}
                disabled={busy !== null}
                className="w-full flex items-center justify-between px-2 py-1.5 border border-[hsl(var(--border))] hover:border-[hsl(var(--accent))] transition-colors text-left disabled:opacity-40"
                style={{ borderRadius: "2px" }}
              >
                <span className="text-[hsl(var(--text-primary))] opacity-80 truncate">
                  {r.name}
                </span>
                <span
                  className={`shrink-0 pl-2 ${
                    r.visibility === "private"
                      ? "text-[hsl(var(--accent-mid))]"
                      : "text-[hsl(var(--success))] opacity-70"
                  }`}
                >
                  {busy === `connect:${r.fullName}` ? "connecting..." : r.visibility}
                </span>
              </button>
            ))}
          </div>
        )}

        {reconfiguring && (
          <button
            onClick={() => setReconfiguring(false)}
            className="text-[hsl(var(--text-secondary))] opacity-50 hover:opacity-100 transition-opacity"
          >
            &gt; cancel
          </button>
        )}
      </PaneCard>

      {error && (
        <p className="mt-2 text-[10px] text-[hsl(var(--accent))] font-mono">{error}</p>
      )}
    </>
  );
}
