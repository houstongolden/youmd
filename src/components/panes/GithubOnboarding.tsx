"use client";

import { useState, useEffect } from "react";
import { useQuery, useAction, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Connection = {
  githubLogin: string;
  githubName: string | null;
  githubAvatarUrl: string | null;
  scopes: string[];
  hasToken: boolean;
  repoFullName: string | null;
  repoVisibility: string | null;
  repoDefaultBranch: string | null;
  repoConnectedAt: number | null;
  lastSyncedSha: string | null;
  lastSyncedAt: number | null;
  appInstalled: boolean;
  connectedAt: number;
};

type TrackedProject = {
  _id: string;
  fullName: string;
  name: string;
  description?: string;
  primaryLanguage?: string;
  pushedAt: number;
  commitsLast90d: number;
  stars: number;
  isPrivate: boolean;
  insight?: string;
  visibility: "private" | "public";
};

// ---------------------------------------------------------------------------
// Pulse spinner — three dots, burnt-orange, no emoji
// ---------------------------------------------------------------------------

function AnalyzingSpinner({ label }: { label: string }) {
  const [frame, setFrame] = useState(0);
  const frames = ["   ", ".  ", ".. ", "..."];
  useEffect(() => {
    const id = setInterval(() => setFrame((f) => (f + 1) % frames.length), 280);
    return () => clearInterval(id);
  }, [frames.length]);
  return (
    <span className="font-mono text-[10px] text-[hsl(var(--text-secondary))] opacity-60">
      <span className="text-[hsl(var(--accent))]">&gt;</span>{" "}
      {label}
      <span className="text-[hsl(var(--accent))]">{frames[frame]}</span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Step indicator
// ---------------------------------------------------------------------------

function StepDot({
  done,
  active,
}: {
  done: boolean;
  active: boolean;
}) {
  return (
    <span
      className={`inline-block w-1.5 h-1.5 ${
        done
          ? "bg-[hsl(var(--success))]"
          : active
          ? "bg-[hsl(var(--accent))]"
          : "bg-[hsl(var(--border))]"
      }`}
      style={{ borderRadius: "50%" }}
    />
  );
}

// ---------------------------------------------------------------------------
// Step 1 — create repo
// ---------------------------------------------------------------------------

function CreateRepoStep({
  clerkId,
  connection,
  onDone,
}: {
  clerkId: string;
  connection: Connection;
  onDone: () => void;
}) {
  const createRepo = useAction(api.githubRepo.createRepo);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(!!connection.repoFullName);
  const [error, setError] = useState<string | null>(null);
  const [repoName, setRepoName] = useState<string | null>(
    connection.repoFullName ?? null
  );

  useEffect(() => {
    if (connection.repoFullName && !done) {
      setDone(true);
      setRepoName(connection.repoFullName);
    }
  }, [connection.repoFullName, done]);

  const handle = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = (await createRepo({ clerkId, visibility: "private" })) as {
        ok: boolean;
        repoFullName: string;
      };
      setRepoName(res.repoFullName);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "could not create repo.");
    } finally {
      setBusy(false);
    }
  };

  const username = connection.githubLogin;
  const expectedName = `${username}-you-md`;

  if (done) {
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-2 font-mono text-[10px]">
          <span className="text-[hsl(var(--success))]">+</span>
          <span className="text-[hsl(var(--text-secondary))] opacity-60">repo</span>
          <a
            href={`https://github.com/${repoName}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[hsl(var(--accent))] hover:opacity-80 transition-opacity"
          >
            {repoName}
          </a>
        </div>
        <button
          onClick={onDone}
          className="mt-2 font-mono text-[10px] text-[hsl(var(--accent))] opacity-70 hover:opacity-100 transition-opacity"
        >
          continue{" "}
          <span className="opacity-60">{"→"}</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="font-mono text-[10px] text-[hsl(var(--text-secondary))] opacity-70 leading-relaxed">
        we&apos;ll create a private repo named{" "}
        <span className="text-[hsl(var(--accent))]">{expectedName}</span> and seed
        it with your identity files. you can change visibility any time.
      </p>
      <button
        onClick={handle}
        disabled={busy}
        className="inline-flex items-center gap-2 border border-[hsl(var(--border))] px-3 py-2 font-mono text-[10px] text-[hsl(var(--text-primary))] hover:border-[hsl(var(--accent))] transition-colors disabled:opacity-40"
        style={{ borderRadius: "var(--radius)" }}
      >
        {busy ? (
          <AnalyzingSpinner label="creating your repo" />
        ) : (
          <>
            <span className="text-[hsl(var(--accent))]">+</span>
            create {expectedName}
          </>
        )}
      </button>
      {error && (
        <p className="font-mono text-[10px] text-[hsl(var(--accent))]">{error}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 2 — analyze projects
// ---------------------------------------------------------------------------

function AnalyzeProjectsStep({
  clerkId,
  onDone,
}: {
  clerkId: string;
  onDone: () => void;
}) {
  const analyzeProjects = useAction(api.githubProjects.analyzeActiveProjects);
  const projects = useQuery(api.githubProjectsPublic.listTrackedProjects, {
    clerkId,
  });

  const [analyzing, setAnalyzing] = useState(false);
  const [analyzed, setAnalyzed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If projects already exist from a prior run, surface them immediately.
  const hasProjects = projects && projects.length > 0;

  const handle = async () => {
    setAnalyzing(true);
    setError(null);
    try {
      await analyzeProjects({ clerkId });
      setAnalyzed(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "analysis failed. try again."
      );
    } finally {
      setAnalyzing(false);
    }
  };

  const showList = hasProjects && (analyzed || !analyzing);

  return (
    <div className="space-y-4">
      {!hasProjects && !analyzing && !analyzed && (
        <>
          <p className="font-mono text-[10px] text-[hsl(var(--text-secondary))] opacity-70 leading-relaxed">
            we&apos;ll scan your most active repos from the last 90 days and generate
            a concise insight for each one.
          </p>
          <button
            onClick={handle}
            disabled={analyzing}
            className="inline-flex items-center gap-2 border border-[hsl(var(--border))] px-3 py-2 font-mono text-[10px] text-[hsl(var(--text-primary))] hover:border-[hsl(var(--accent))] transition-colors disabled:opacity-40"
            style={{ borderRadius: "var(--radius)" }}
          >
            <span className="text-[hsl(var(--accent))]">{"⟳"}</span>
            analyze my active repos
          </button>
        </>
      )}

      {analyzing && (
        <AnalyzingSpinner label="analyzing your most active repos" />
      )}

      {error && (
        <p className="font-mono text-[10px] text-[hsl(var(--accent))]">{error}</p>
      )}

      {showList && (
        <div className="space-y-3">
          {(projects as TrackedProject[]).map((p) => (
            <div
              key={p.fullName}
              className="border border-[hsl(var(--border))] p-3 space-y-1.5 font-mono text-[10px]"
              style={{ borderRadius: "var(--radius)" }}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-[hsl(var(--text-primary))] opacity-80 truncate">
                  {p.name}
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  {p.primaryLanguage && (
                    <span className="text-[hsl(var(--text-secondary))] opacity-40">
                      {p.primaryLanguage}
                    </span>
                  )}
                  <span className="text-[hsl(var(--text-secondary))] opacity-30">
                    {new Date(p.pushedAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
              </div>
              {p.insight && (
                <p className="text-[hsl(var(--text-secondary))] opacity-60 leading-relaxed">
                  {p.insight}
                </p>
              )}
            </div>
          ))}

          <button
            onClick={onDone}
            className="font-mono text-[10px] text-[hsl(var(--accent))] opacity-70 hover:opacity-100 transition-opacity"
          >
            continue{" "}
            <span className="opacity-60">{"→"}</span>
          </button>
        </div>
      )}

      {/* If already analyzed but no projects found */}
      {analyzed && !hasProjects && !analyzing && (
        <div className="space-y-2">
          <p className="font-mono text-[10px] text-[hsl(var(--text-secondary))] opacity-40">
            no repos pushed in the last 90 days.
          </p>
          <button
            onClick={onDone}
            className="font-mono text-[10px] text-[hsl(var(--accent))] opacity-70 hover:opacity-100 transition-opacity"
          >
            continue{" "}
            <span className="opacity-60">{"→"}</span>
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 3 — visibility toggles
// ---------------------------------------------------------------------------

function VisibilityStep({ clerkId }: { clerkId: string }) {
  const projects = useQuery(api.githubProjectsPublic.listTrackedProjects, {
    clerkId,
  });
  const setVisibility = useMutation(
    api.githubProjectsPublic.setProjectVisibility
  );

  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [optimistic, setOptimistic] = useState<
    Record<string, "private" | "public">
  >({});

  const toggle = async (fullName: string, current: "private" | "public") => {
    const next = current === "private" ? "public" : "private";
    setOptimistic((prev) => ({ ...prev, [fullName]: next }));
    setPending((prev) => ({ ...prev, [fullName]: true }));
    try {
      await setVisibility({ clerkId, fullName, visibility: next });
    } catch {
      // revert on error
      setOptimistic((prev) => ({ ...prev, [fullName]: current }));
    } finally {
      setPending((prev) => ({ ...prev, [fullName]: false }));
    }
  };

  if (!projects) {
    return (
      <AnalyzingSpinner label="loading tracked projects" />
    );
  }

  if (projects.length === 0) {
    return (
      <p className="font-mono text-[10px] text-[hsl(var(--text-secondary))] opacity-40">
        no tracked projects yet. run the analysis step first.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="font-mono text-[10px] text-[hsl(var(--text-secondary))] opacity-60 leading-relaxed">
        these are tracked privately in your you.md repo. choose any to also
        surface on your public profile.
      </p>

      <div className="space-y-1">
        {(projects as TrackedProject[]).map((p) => {
          const vis =
            optimistic[p.fullName] ?? (p.visibility as "private" | "public");
          const isPublic = vis === "public";
          const isToggling = pending[p.fullName] ?? false;

          return (
            <div
              key={p.fullName}
              className="flex items-center justify-between gap-3 py-2 border-b border-[hsl(var(--border))] last:border-0"
            >
              <div className="flex flex-col min-w-0">
                <span className="font-mono text-[10px] text-[hsl(var(--text-primary))] opacity-80 truncate">
                  {p.name}
                </span>
                {p.primaryLanguage && (
                  <span className="font-mono text-[9px] text-[hsl(var(--text-secondary))] opacity-30">
                    {p.primaryLanguage}
                  </span>
                )}
              </div>
              <button
                onClick={() => toggle(p.fullName, vis)}
                disabled={isToggling}
                className={`shrink-0 font-mono text-[10px] px-2 py-1 border transition-colors disabled:opacity-40 ${
                  isPublic
                    ? "border-[hsl(var(--success))] text-[hsl(var(--success))]"
                    : "border-[hsl(var(--border))] text-[hsl(var(--text-secondary))] opacity-50 hover:opacity-100"
                }`}
                style={{ borderRadius: "var(--radius)" }}
              >
                {isToggling ? "..." : isPublic ? "public" : "private"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// GithubOnboarding — orchestrator
// ---------------------------------------------------------------------------

export function GithubOnboarding({
  clerkId,
  connection,
}: {
  clerkId: string;
  connection: Connection;
}) {
  // Start at step 1 unless the repo is already created (then skip to 2).
  const [step, setStep] = useState<1 | 2 | 3>(
    connection.repoFullName ? 2 : 1
  );

  const stepDone = (n: 1 | 2 | 3) => step > n;
  const stepActive = (n: 1 | 2 | 3) => step === n;

  return (
    <div className="space-y-6 font-mono text-[10px]">
      {/* ── Step indicator ── */}
      <div className="flex items-center gap-3">
        {([1, 2, 3] as const).map((n) => (
          <div key={n} className="flex items-center gap-1.5">
            <StepDot done={stepDone(n)} active={stepActive(n)} />
            <span
              className={`text-[9px] uppercase tracking-widest transition-opacity ${
                stepActive(n)
                  ? "text-[hsl(var(--text-primary))] opacity-80"
                  : stepDone(n)
                  ? "text-[hsl(var(--success))] opacity-60"
                  : "text-[hsl(var(--text-secondary))] opacity-25"
              }`}
            >
              {n === 1 ? "repo" : n === 2 ? "projects" : "visibility"}
            </span>
          </div>
        ))}
      </div>

      {/* ── Step 1 — create repo ── */}
      <section>
        <h4 className="mb-3 text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--accent))]">
          &gt; {step > 1 ? "+" : "01."} create your you.md repo
        </h4>
        {step === 1 ? (
          <CreateRepoStep
            clerkId={clerkId}
            connection={connection}
            onDone={() => setStep(2)}
          />
        ) : (
          <div className="font-mono text-[10px] text-[hsl(var(--text-secondary))] opacity-50 flex items-center gap-2">
            <span className="text-[hsl(var(--success))]">+</span>
            <a
              href={`https://github.com/${connection.repoFullName}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[hsl(var(--accent))] opacity-70 hover:opacity-100 transition-opacity"
            >
              {connection.repoFullName}
            </a>
          </div>
        )}
      </section>

      <div className="h-px bg-[hsl(var(--border))]" />

      {/* ── Step 2 — analyze projects ── */}
      <section
        className={step < 2 ? "opacity-30 pointer-events-none" : undefined}
      >
        <h4 className="mb-3 text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--accent))]">
          &gt; {step > 2 ? "+" : "02."} analyze active projects
        </h4>
        {step >= 2 && (
          <AnalyzeProjectsStep
            clerkId={clerkId}
            onDone={() => setStep(3)}
          />
        )}
      </section>

      <div className="h-px bg-[hsl(var(--border))]" />

      {/* ── Step 3 — visibility ── */}
      <section
        className={step < 3 ? "opacity-30 pointer-events-none" : undefined}
      >
        <h4 className="mb-3 text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--accent))]">
          &gt; {step > 3 ? "+" : "03."} choose what goes public
        </h4>
        {step >= 3 && <VisibilityStep clerkId={clerkId} />}
      </section>
    </div>
  );
}
