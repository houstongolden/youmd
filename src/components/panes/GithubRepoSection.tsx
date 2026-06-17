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

type RepoUpdateStep = {
  _id: string;
  order: number;
  stepKey: string;
  label: string;
  status: string;
  detail?: string;
};

type RepoUpdateRun = {
  _id: string;
  source: string;
  trigger: string;
  status: string;
  summary?: string;
  repoFullName?: string;
  publishVersion?: number;
  pushedFiles: string[];
  route?: string;
  prUrl?: string;
  prNumber?: number;
  merged?: boolean;
  commitSha?: string;
  mirrorFileCount?: number;
  error?: string;
  startedAt: number;
  completedAt?: number;
  steps: RepoUpdateStep[];
};

function relativeTime(value?: number | null): string {
  if (!value) return "never";
  const diff = Date.now() - value;
  const minutes = Math.max(0, Math.round(diff / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

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
  const pushToRepo = useAction(api.githubRepo.pushToRepo);
  const pullFromRepo = useAction(api.githubRepo.pullFromRepo);
  const syncMirror = useAction(api.githubRepo.syncMirror);
  const mirror = useQuery(
    api.github.getRepoMirror,
    clerkId ? { clerkId } : "skip"
  );
  const updateRuns = useQuery(
    api.portfolio.listRepoUpdateRuns,
    clerkId ? { clerkId, limit: 5, includeSteps: true } : "skip"
  ) as RepoUpdateRun[] | undefined;

  const [visibility, setVisibility] = useState<"private" | "public">("private");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RepoResult | null>(null);
  const [repoList, setRepoList] = useState<RepoListItem[] | null>(null);
  const [reconfiguring, setReconfiguring] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const startUrl = `/api/auth/github/start?next=${encodeURIComponent("/shell")}`;
  const appSlug = process.env.NEXT_PUBLIC_GITHUB_APP_SLUG;

  const handlePush = async () => {
    setBusy("push");
    setError(null);
    setSyncMsg(null);
    try {
      const res = (await pushToRepo({ clerkId })) as {
        upToDate: boolean;
        pushed: string[];
      };
      setSyncMsg(
        res.upToDate
          ? "already up to date — nothing to push."
          : `pushed ${res.pushed.join(", ")} to your repo.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "push failed.");
    }
    setBusy(null);
  };

  const handlePull = async () => {
    setBusy("pull");
    setError(null);
    setSyncMsg(null);
    try {
      const res = (await pullFromRepo({ clerkId })) as {
        version: number;
        pulledFiles: string[];
      };
      setSyncMsg(
        `pulled ${res.pulledFiles.join(", ")} from your repo (saved as v${res.version}).`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "pull failed.");
    }
    setBusy(null);
  };

  const handleMirror = async () => {
    setBusy("mirror");
    setError(null);
    setSyncMsg(null);
    try {
      const res = (await syncMirror({ clerkId })) as {
        fileCount: number;
        truncated: boolean;
      };
      setSyncMsg(
        `mirrored ${res.fileCount} file${res.fileCount === 1 ? "" : "s"} from your repo${res.truncated ? " (capped)" : ""}.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "mirror refresh failed.");
    }
    setBusy(null);
  };

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
          {appSlug && (
            <div className="flex items-center justify-between">
              <span className="text-[hsl(var(--text-secondary))] opacity-60">
                github app
              </span>
              {connection.appInstalled ? (
                <span className="text-[hsl(var(--success))]">
                  installed (fine-grained)
                </span>
              ) : (
                <a
                  href={`https://github.com/apps/${appSlug}/installations/new`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[hsl(var(--accent))] opacity-80 hover:opacity-100"
                >
                  install {"\u2192"}
                </a>
              )}
            </div>
          )}
          {connection.lastSyncedAt && (
            <div className="flex items-center justify-between">
              <span className="text-[hsl(var(--text-secondary))] opacity-60">
                last synced
              </span>
              <span className="text-[hsl(var(--text-primary))] opacity-70">
                {new Date(connection.lastSyncedAt).toLocaleString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          )}
          {result?.created && (
            <p className="text-[hsl(var(--success))] opacity-80 pt-1">
              {"\u2713"} repo created and seeded with your identity files.
            </p>
          )}
        </PaneCard>

        <div className="mt-2 flex items-center gap-2">
          <PaneButton onClick={handlePush} disabled={busy !== null} variant="secondary">
            {busy === "push" ? "pushing..." : "push to repo"}
          </PaneButton>
          <PaneButton onClick={handlePull} disabled={busy !== null} variant="secondary">
            {busy === "pull" ? "pulling..." : "pull from repo"}
          </PaneButton>
          <PaneButton onClick={handleMirror} disabled={busy !== null} variant="secondary">
            {busy === "mirror" ? "mirroring..." : "refresh mirror"}
          </PaneButton>
        </div>

        {mirror && (
          <div
            className="mt-2 border border-[hsl(var(--border))] p-3 font-mono text-[10px] space-y-1"
            style={{ borderRadius: "var(--radius)" }}
          >
            <div className="flex items-center justify-between">
              <span className="text-[hsl(var(--text-secondary))] opacity-60">
                server mirror
              </span>
              <span className="text-[hsl(var(--text-primary))] opacity-70">
                {mirror.fileCount} file{mirror.fileCount === 1 ? "" : "s"}
                {mirror.truncated ? " (capped)" : ""}
              </span>
            </div>
            {mirror.stacks.length > 0 && (
              <div className="flex items-start justify-between gap-3">
                <span className="text-[hsl(var(--text-secondary))] opacity-60 shrink-0">
                  stacks
                </span>
                <span className="text-[hsl(var(--accent-mid))] text-right">
                  {mirror.stacks.map((s) => s.slug).join(", ")}
                </span>
              </div>
            )}
            <p className="text-[hsl(var(--text-secondary))] opacity-40 pt-1">
              agents read these via the API at /api/v1/me/repo/files
            </p>
          </div>
        )}

        {updateRuns && updateRuns.length > 0 && (
          <div className="mt-3 font-mono text-[10px]">
            <SectionLabel>update history</SectionLabel>
            <div className="divide-y divide-[hsl(var(--border))]/55 border-y border-[hsl(var(--border))]/55">
              {updateRuns.map((run) => (
                <details key={run._id} className="group py-2">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                    <span className="min-w-0">
                      <span
                        className={
                          run.status === "success"
                            ? "text-[hsl(var(--success))]"
                            : run.status === "failed"
                              ? "text-[hsl(var(--accent))]"
                              : "text-[#a371f7]"
                        }
                      >
                        {run.status}
                      </span>
                      <span className="ml-2 text-[hsl(var(--text-primary))] opacity-70">
                        {run.prNumber ? `PR #${run.prNumber}` : run.trigger}
                      </span>
                      <span className="ml-2 text-[hsl(var(--text-secondary))] opacity-45">
                        {relativeTime(run.completedAt ?? run.startedAt)}
                      </span>
                    </span>
                    <span className="shrink-0 text-[hsl(var(--text-secondary))] opacity-35 transition-opacity group-open:opacity-70">
                      {run.mirrorFileCount ? `${run.mirrorFileCount} files` : run.route ?? run.source}
                    </span>
                  </summary>
                  <div className="mt-2 space-y-2 pl-3 text-[hsl(var(--text-secondary))]">
                    {run.summary && <p className="opacity-65">{run.summary}</p>}
                    <div className="grid gap-1 opacity-60">
                      {run.publishVersion && <span>published v{run.publishVersion}</span>}
                      {run.pushedFiles.length > 0 && (
                        <span>pushed {run.pushedFiles.join(", ")}</span>
                      )}
                      {run.prUrl && (
                        <a
                          href={run.prUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[hsl(var(--accent-mid))] hover:text-[hsl(var(--accent))]"
                        >
                          open PR {run.prNumber ? `#${run.prNumber}` : ""}
                        </a>
                      )}
                      {run.commitSha && <span>commit {run.commitSha.slice(0, 12)}</span>}
                      {run.error && <span className="text-[hsl(var(--accent))]">{run.error}</span>}
                    </div>
                    {run.steps.length > 0 && (
                      <ol className="space-y-1 border-l border-[hsl(var(--border))]/55 pl-3">
                        {run.steps.map((step) => (
                          <li key={step._id}>
                            <span className="text-[hsl(var(--text-primary))] opacity-70">
                              {step.label}
                            </span>
                            <span className="ml-2 opacity-45">{step.status}</span>
                            {step.detail && (
                              <span className="block opacity-45">{step.detail}</span>
                            )}
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                </details>
              ))}
            </div>
          </div>
        )}

        {syncMsg && (
          <p className="mt-2 font-mono text-[10px] text-[hsl(var(--success))] opacity-80">
            {syncMsg}
          </p>
        )}
        {error && (
          <p className="mt-2 font-mono text-[10px] text-[hsl(var(--accent))]">{error}</p>
        )}

        <button
          onClick={() => {
            setReconfiguring(true);
            setResult(null);
            setSyncMsg(null);
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
              style={{ borderRadius: "var(--radius)" }}
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
                style={{ borderRadius: "var(--radius)" }}
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
