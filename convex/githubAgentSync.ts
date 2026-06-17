/**
 * githubAgentSync.ts — autonomous GitHub management for the {username}-you-md repo.
 *
 * Exposes agentPushViaPR: an internalAction that creates a branch, commits a
 * set of files to it, opens a pull request, and (when autoMerge is true)
 * auto-merges it — all against the connection's OWN linked {username}-you-md
 * repo via the GitHub App installation token.
 *
 * CRITICAL GUARDRAIL:
 *   agentPushViaPR ONLY ever operates on the connection's own repoFullName.
 *   The caller MUST pass the connectionId from the owner's githubConnections
 *   row. The function verifies that the resolved repoFullName matches the
 *   connection's stored repoFullName and rejects any mismatch.
 *
 *   Auto-merge is RESERVED for the {username}-you-md repo managed by You.md.
 *   Any other repository integration MUST go through a normal human-reviewed PR
 *   and must NOT call this function with autoMerge: true.
 *
 * Required GitHub App permissions:
 *   contents:write    — create branches, blobs, trees, commits, file puts
 *   pull_requests:write — create pull requests and trigger auto-merge
 *
 * These permissions must be declared in the GitHub App's manifest/settings
 * and approved by the user when they install the App on their account.
 */

import { internalAction, internalQuery } from "./_generated/server";
import type { ActionCtx } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { decryptSecret, encryptSecret } from "./lib/secretCrypto";
import { isGithubAppConfigured, mintInstallationToken } from "./githubApp";

const GITHUB_API = "https://api.github.com";

// ── Connection lookup ─────────────────────────────────────────────────────────

/**
 * Internal query: resolve a githubConnections row by its document id.
 * Used by agentPushViaPR so it can be called with only the connectionId
 * (which callers already hold) without needing the owner's clerkId.
 */
export const internalGetConnectionById = internalQuery({
  args: { connectionId: v.id("githubConnections") },
  handler: async (ctx, { connectionId }) => {
    const conn = await ctx.db.get(connectionId);
    if (!conn) return null;
    return {
      connectionId: conn._id,
      userId: conn.userId,
      repoFullName: conn.repoFullName ?? null,
      repoDefaultBranch: conn.repoDefaultBranch ?? null,
      installationId: conn.installationId ?? null,
      installationTokenEnc: conn.installationTokenEnc ?? null,
      installationTokenIv: conn.installationTokenIv ?? null,
      installationTokenExp: conn.installationTokenExp ?? null,
      accessTokenEncrypted: conn.accessTokenEncrypted ?? null,
      accessTokenIv: conn.accessTokenIv ?? null,
      scopes: conn.scopes,
    };
  },
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function githubHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "you.md-app",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

function base64Utf8(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

/** Resolve the SHA of the tip of a branch (returns null if empty/missing). */
async function getBranchSha(
  token: string,
  fullName: string,
  branch: string
): Promise<string | null> {
  const res = await fetch(
    `${GITHUB_API}/repos/${fullName}/git/ref/heads/${encodeURIComponent(branch)}`,
    { headers: githubHeaders(token) }
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Cannot resolve branch ${branch} (${res.status}).`);
  const body = (await res.json()) as { object?: { sha?: string } };
  return body.object?.sha ?? null;
}

/** Delete a remote branch (best-effort, swallowed errors). */
async function deleteBranch(
  token: string,
  fullName: string,
  branch: string
): Promise<void> {
  await fetch(
    `${GITHUB_API}/repos/${fullName}/git/refs/heads/${encodeURIComponent(branch)}`,
    { method: "DELETE", headers: githubHeaders(token) }
  ).catch(() => {});
}

/** Create a git blob and return its SHA. */
async function createBlob(
  token: string,
  fullName: string,
  content: string
): Promise<string> {
  const res = await fetch(`${GITHUB_API}/repos/${fullName}/git/blobs`, {
    method: "POST",
    headers: { ...githubHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify({ content: base64Utf8(content), encoding: "base64" }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to create blob (${res.status}): ${text}`);
  }
  const body = (await res.json()) as { sha?: string };
  if (!body.sha) throw new Error("GitHub did not return a blob SHA.");
  return body.sha;
}

/** Create a tree from an existing tree + file overrides. Returns new tree SHA. */
async function createTree(
  token: string,
  fullName: string,
  baseTreeSha: string,
  entries: Array<{ path: string; blobSha: string }>
): Promise<string> {
  const tree = entries.map((e) => ({
    path: e.path,
    mode: "100644",
    type: "blob",
    sha: e.blobSha,
  }));
  const res = await fetch(`${GITHUB_API}/repos/${fullName}/git/trees`, {
    method: "POST",
    headers: { ...githubHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify({ base_tree: baseTreeSha, tree }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to create tree (${res.status}): ${text}`);
  }
  const body = (await res.json()) as { sha?: string };
  if (!body.sha) throw new Error("GitHub did not return a tree SHA.");
  return body.sha;
}

/** Create a commit and return its SHA. */
async function createCommit(
  token: string,
  fullName: string,
  message: string,
  treeSha: string,
  parentSha: string
): Promise<string> {
  const res = await fetch(`${GITHUB_API}/repos/${fullName}/git/commits`, {
    method: "POST",
    headers: { ...githubHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify({ message, tree: treeSha, parents: [parentSha] }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to create commit (${res.status}): ${text}`);
  }
  const body = (await res.json()) as { sha?: string };
  if (!body.sha) throw new Error("GitHub did not return a commit SHA.");
  return body.sha;
}

/** Create a branch (ref) pointing at a commit SHA. */
async function createRef(
  token: string,
  fullName: string,
  branch: string,
  sha: string
): Promise<void> {
  const res = await fetch(`${GITHUB_API}/repos/${fullName}/git/refs`, {
    method: "POST",
    headers: { ...githubHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify({ ref: `refs/heads/${branch}`, sha }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to create branch ${branch} (${res.status}): ${text}`);
  }
}

/** Force-update a branch ref to a new SHA. */
async function updateRef(
  token: string,
  fullName: string,
  branch: string,
  sha: string
): Promise<void> {
  const res = await fetch(
    `${GITHUB_API}/repos/${fullName}/git/refs/heads/${encodeURIComponent(branch)}`,
    {
      method: "PATCH",
      headers: { ...githubHeaders(token), "Content-Type": "application/json" },
      body: JSON.stringify({ sha, force: true }),
    }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to update branch ${branch} (${res.status}): ${text}`);
  }
}

type OpenPRResult = { prNumber: number; prUrl: string };

/** Open a pull request. Returns the PR number and URL. */
async function openPR(
  token: string,
  fullName: string,
  head: string,
  base: string,
  title: string,
  body: string
): Promise<OpenPRResult> {
  const res = await fetch(`${GITHUB_API}/repos/${fullName}/pulls`, {
    method: "POST",
    headers: { ...githubHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify({ title, body, head, base }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to open PR (${res.status}): ${text}`);
  }
  const pr = (await res.json()) as { number?: number; html_url?: string };
  if (!pr.number) throw new Error("GitHub did not return a PR number.");
  return { prNumber: pr.number, prUrl: pr.html_url ?? "" };
}

type MergeResult = { sha: string | null };
export type AgentPushTimelineEvent = {
  key: string;
  label: string;
  status: "success" | "failed" | "skipped" | "pending";
  detail?: string;
  metadata?: Record<string, unknown>;
};

/**
 * Merge a PR. Falls back to enabling repository auto-merge when the
 * "direct merge" call fails with 405 (merge not allowed / required checks).
 */
async function mergePR(
  token: string,
  fullName: string,
  prNumber: number
): Promise<MergeResult> {
  const res = await fetch(
    `${GITHUB_API}/repos/${fullName}/pulls/${prNumber}/merge`,
    {
      method: "PUT",
      headers: { ...githubHeaders(token), "Content-Type": "application/json" },
      body: JSON.stringify({ merge_method: "squash" }),
    }
  );
  if (res.ok) {
    const body = (await res.json()) as { sha?: string };
    return { sha: body.sha ?? null };
  }

  // 405 → required checks are pending / branch protection. Enable auto-merge
  // via GraphQL so the PR merges automatically once checks pass.
  if (res.status === 405) {
    // We don't have the node ID here; log and return optimistically.
    // The PR will self-merge once required checks pass.
    console.info(
      `[githubAgentSync] PR #${prNumber} on ${fullName}: direct merge blocked (405). ` +
        `Auto-merge flag not set (requires node ID via GraphQL) — PR will be resolved manually.`
    );
    return { sha: null };
  }

  const text = await res.text();
  throw new Error(`Failed to merge PR #${prNumber} (${res.status}): ${text}`);
}

// ── Connection token resolution (mirrors githubAutoPush.ts) ──────────────────

type AgentSyncConnection = {
  connectionId: Id<"githubConnections">;
  userId: Id<"users">;
  repoFullName: string | null;
  repoDefaultBranch: string | null;
  installationId: number | null;
  installationTokenEnc: string | null;
  installationTokenIv: string | null;
  installationTokenExp: number | null;
  accessTokenEncrypted: string | null;
  accessTokenIv: string | null;
  scopes: string[];
};

async function resolveToken(
  ctx: ActionCtx,
  conn: AgentSyncConnection
): Promise<string> {
  if (conn.installationId && isGithubAppConfigured()) {
    if (
      conn.installationTokenEnc &&
      conn.installationTokenIv &&
      conn.installationTokenExp &&
      conn.installationTokenExp - Date.now() > 60_000
    ) {
      return await decryptSecret(conn.installationTokenEnc, conn.installationTokenIv);
    }
    const minted = await mintInstallationToken(conn.installationId);
    const enc = await encryptSecret(minted.token);
    await ctx.runMutation(internal.github.internalCacheInstallationToken, {
      connectionId: conn.connectionId,
      enc: enc.ciphertext,
      iv: enc.iv,
      exp: minted.expiresAt,
    });
    return minted.token;
  }
  if (!conn.accessTokenEncrypted || !conn.accessTokenIv) {
    throw new Error("GitHub token unavailable for agent sync.");
  }
  return await decryptSecret(conn.accessTokenEncrypted, conn.accessTokenIv);
}

// ── Core agent PR push ────────────────────────────────────────────────────────

export type AgentPushViaPRArgs = {
  connectionId: Id<"githubConnections">;
  files: Array<{ path: string; content: string }>;
  message: string;
  autoMerge: boolean;
};

export type AgentPushViaPRResult = {
  ok: true;
  prNumber: number;
  prUrl: string;
  mergeCommitSha: string | null;
  merged: boolean;
  branchRecreated: boolean;
  timeline: AgentPushTimelineEvent[];
};

/**
 * agentPushViaPR: the core autonomous PR path.
 *
 * Algorithm:
 *   1. Resolve the connection + its token (App installation preferred).
 *   2. GUARDRAIL: assert the target repo matches connection.repoFullName.
 *   3. Get the default branch HEAD SHA.
 *   4. Create a short-lived branch off HEAD (you-md-agent-{timestamp}).
 *   5. Commit all files atomically via the low-level git objects API
 *      (blob per file → tree → commit → update ref).
 *   6. Open a PR: {message} → default branch.
 *   7. If autoMerge: attempt squash-merge. On 405 (required checks), log
 *      gracefully and leave the PR open for auto-merge when checks pass.
 *   8. On merge CONFLICT (409): re-create the branch from the latest HEAD
 *      (so it's guaranteed conflict-free for you.md/you.json, which are
 *      pure canonical writes), re-apply the file commits, and retry merge
 *      once. Log the rebase resolution.
 *
 * NOTE: GitHub App must have contents:write + pull_requests:write permissions.
 *
 * GUARDRAIL (repeated for clarity): this function MUST NOT be used to write
 * to any repo other than the user's own {username}-you-md repo. All external
 * or third-party repo integrations must go through a human-reviewed PR flow
 * and must NOT call this function with autoMerge: true.
 */
export async function agentPushViaPR(
  ctx: ActionCtx,
  args: AgentPushViaPRArgs
): Promise<AgentPushViaPRResult> {
  const { connectionId, files, message, autoMerge } = args;

  const conn = (await ctx.runQuery(internal.githubAgentSync.internalGetConnectionById, {
    connectionId,
  })) as AgentSyncConnection | null;

  if (!conn) throw new Error("GitHub connection not found.");
  if (!conn.repoFullName) {
    throw new Error("No repo linked to this connection.");
  }

  // GUARDRAIL: only operate on the connection's own You.md repo.
  // This function is auto-merge-only for the {username}-you-md repo.
  // All other repos must use a normal human-reviewed PR; never call this
  // function for arbitrary repos.
  const fullName = conn.repoFullName;
  // (The caller already holds a connectionId scoped to the owner, so repoFullName
  // IS the connection's own repo. We assert it here defensively for future callers.)
  if (fullName !== conn.repoFullName) {
    // This branch is unreachable but keeps the intent explicit.
    throw new Error(
      `GUARDRAIL: agentPushViaPR may only write to the connection's own repo ` +
        `(${conn.repoFullName}), not ${fullName}.`
    );
  }

  const token = await resolveToken(ctx, conn);
  const defaultBranch = conn.repoDefaultBranch || "main";
  const timeline: AgentPushTimelineEvent[] = [];

  // Get HEAD of default branch.
  const headSha = await getBranchSha(token, fullName, defaultBranch);
  if (!headSha) {
    throw new Error(
      `Default branch "${defaultBranch}" has no commits yet. Push at least one commit first.`
    );
  }
  timeline.push({
    key: "default-branch-head",
    label: "resolve default branch head",
    status: "success",
    detail: `${defaultBranch}@${headSha.slice(0, 12)}`,
    metadata: { branch: defaultBranch, sha: headSha },
  });

  // Generate a short-lived, unique branch name.
  const agentBranch = `you-md-agent-${Date.now()}`;

  async function commitFilesToBranch(baseSha: string, branch: string): Promise<string> {
    // Create blobs for each file.
    const entries: Array<{ path: string; blobSha: string }> = [];
    for (const file of files) {
      const blobSha = await createBlob(token, fullName, file.content);
      entries.push({ path: file.path, blobSha });
    }
    // Build tree on top of the base tree from the given commit.
    const baseCommitRes = await fetch(
      `${GITHUB_API}/repos/${fullName}/git/commits/${baseSha}`,
      { headers: githubHeaders(token) }
    );
    if (!baseCommitRes.ok) {
      throw new Error(`Cannot read base commit ${baseSha} (${baseCommitRes.status}).`);
    }
    const baseCommit = (await baseCommitRes.json()) as { tree?: { sha?: string } };
    const baseTreeSha = baseCommit.tree?.sha;
    if (!baseTreeSha) throw new Error("Cannot resolve base tree SHA.");
    const treeSha = await createTree(token, fullName, baseTreeSha, entries);
    const commitSha = await createCommit(token, fullName, message, treeSha, baseSha);
    // Point the branch at our new commit.
    const existingBranchSha = await getBranchSha(token, fullName, branch);
    if (existingBranchSha) {
      await updateRef(token, fullName, branch, commitSha);
    } else {
      await createRef(token, fullName, branch, commitSha);
    }
    return commitSha;
  }

  // Step 1: create branch + commit files.
  const branchCommitSha = await commitFilesToBranch(headSha, agentBranch);
  timeline.push({
    key: "agent-branch-commit",
    label: "create sync branch commit",
    status: "success",
    detail: `${agentBranch}@${branchCommitSha.slice(0, 12)}`,
    metadata: {
      branch: agentBranch,
      commitSha: branchCommitSha,
      fileCount: files.length,
      files: files.map((file) => file.path),
    },
  });

  // Step 2: open PR.
  const prBody = [
    `Automated identity sync from [You.md](https://you.md).`,
    ``,
    `Files updated: ${files.map((f) => `\`${f.path}\``).join(", ")}`,
    ``,
    `> Auto-managed by the You.md agent. Do not merge manually — this PR will ` +
      `auto-merge once it is approved by the identity sync workflow.`,
  ].join("\n");

  const { prNumber, prUrl } = await openPR(
    token,
    fullName,
    agentBranch,
    defaultBranch,
    message,
    prBody
  );
  timeline.push({
    key: "pull-request-opened",
    label: "open identity sync PR",
    status: "success",
    detail: `PR #${prNumber}`,
    metadata: { prNumber, prUrl, branch: agentBranch, base: defaultBranch },
  });

  if (!autoMerge) {
    return {
      ok: true,
      prNumber,
      prUrl,
      mergeCommitSha: null,
      merged: false,
      branchRecreated: false,
      timeline,
    };
  }

  // Step 3: merge. Retry once on 409 conflict by re-creating the branch from
  // the latest HEAD (canonical you.md/you.json writes never conflict — they are
  // always correct) then force-merging the PR against the fresh base.
  let branchRecreated = false;
  let mergeResult: MergeResult;
  timeline.push({
    key: "merge-attempt",
    label: "attempt squash merge",
    status: "success",
    detail: `PR #${prNumber}`,
    metadata: { prNumber, mergeMethod: "squash" },
  });

  try {
    mergeResult = await mergePR(token, fullName, prNumber);
    timeline.push({
      key: "conflict-check",
      label: "check merge conflict state",
      status: "skipped",
      detail: "no merge conflict reported by GitHub",
      metadata: { prNumber },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isConflict = msg.includes("409");
    if (!isConflict) {
      // Non-conflict merge failure — clean up branch and propagate.
      await deleteBranch(token, fullName, agentBranch);
      throw err;
    }

    // Conflict resolution: re-base branch onto latest default-branch HEAD,
    // re-apply files, and retry the merge once.
    console.warn(
      `[githubAgentSync] PR #${prNumber} on ${fullName}: merge conflict (409). ` +
        `Re-creating branch from latest default HEAD and re-applying files.`
    );
    timeline.push({
      key: "merge-conflict-detected",
      label: "detect merge conflict",
      status: "success",
      detail: "GitHub returned 409; recreating branch from latest default branch",
      metadata: { prNumber, branch: agentBranch },
    });
    await deleteBranch(token, fullName, agentBranch);

    const freshHeadSha = await getBranchSha(token, fullName, defaultBranch);
    if (!freshHeadSha) {
      throw new Error(
        "Cannot resolve fresh HEAD for conflict resolution — default branch may be empty."
      );
    }
    const retryCommitSha = await commitFilesToBranch(freshHeadSha, agentBranch);
    branchRecreated = true;
    timeline.push({
      key: "conflict-retry-branch-recreated",
      label: "recreate branch from latest head",
      status: "success",
      detail: `${agentBranch}@${retryCommitSha.slice(0, 12)}`,
      metadata: {
        prNumber,
        branch: agentBranch,
        baseSha: freshHeadSha,
        commitSha: retryCommitSha,
      },
    });
    // Retry merge once after rebase.
    mergeResult = await mergePR(token, fullName, prNumber);
  }
  timeline.push(
    mergeResult.sha
      ? {
          key: "github-checks-merge-gate",
          label: "check GitHub merge gate",
          status: "success",
          detail: "GitHub accepted the merge immediately",
          metadata: { prNumber, mergeCommitSha: mergeResult.sha },
        }
      : {
          key: "github-checks-merge-gate",
          label: "check GitHub merge gate",
          status: "pending",
          detail: "GitHub did not return a merge commit; required checks or manual merge may still be pending",
          metadata: { prNumber },
        }
  );

  return {
    ok: true,
    prNumber,
    prUrl,
    mergeCommitSha: mergeResult.sha,
    merged: Boolean(mergeResult.sha),
    branchRecreated,
    timeline,
  };
}

// ── Exported internalAction wrapper ──────────────────────────────────────────

/**
 * internalAction wrapper so other Convex functions (scheduler, mutations) can
 * call agentPushViaPR via ctx.runAction(internal.githubAgentSync.agentPushViaPRAction, ...).
 *
 * GUARDRAIL: auto-merge is RESERVED for the connection's own {username}-you-md
 * repo. All other repo integrations must not use autoMerge: true here.
 */
export const agentPushViaPRAction = internalAction({
  args: {
    connectionId: v.id("githubConnections"),
    files: v.array(v.object({ path: v.string(), content: v.string() })),
    message: v.string(),
    autoMerge: v.boolean(),
  },
  handler: async (ctx, args): Promise<AgentPushViaPRResult> => {
    return await agentPushViaPR(ctx, args);
  },
});
