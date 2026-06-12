import { internalAction } from "./_generated/server";
import type { ActionCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { decryptSecret, encryptSecret } from "./lib/secretCrypto";
import { isGithubAppConfigured, mintInstallationToken } from "./githubApp";
import {
  fetchRepoFile,
  fetchRepoHeadSha,
  putRepoFile,
} from "./lib/githubPushApi";
import {
  AUTO_PUSH_MAX_RETRIES,
  AUTO_PUSH_RETRY_DELAY_MS,
  hasMirrorDiverged,
} from "./lib/githubSync";

/**
 * P17 (PRODUCT-AUDIT #19) — debounced GitHub mirror auto-push.
 *
 * Scheduled by scheduleGithubAutoPush (convex/github.ts) from the bundle
 * save/publish mutations. Pushes the user's latest compiled identity
 * (you.md + you.json) to their linked repo so the mirror stops going stale
 * between explicit syncs.
 *
 * Ancestry: before writing, the live head sha is compared against the
 * push-time anchor (lastPushedCommitSha). If they differ, the repo moved out
 * from under us (manual user pushes count) — the connection is flagged
 * mirrorStale and the push proceeds anyway: the canonical Convex store ALWAYS
 * wins, we force-update the repo file-by-file (last-writer-wins via each
 * file's current sha) and never merge from the mirror.
 *
 * Failure: log + retry exactly once with backoff. Attempt 1 failing clears
 * the debounce marker so the next save can schedule fresh — no infinite loops.
 *
 * GitHub API calls are isolated in convex/lib/githubPushApi.ts so tests can
 * mock the wrapper and exercise this orchestration under convex-test.
 */

type PushConnection = {
  connectionId: Id<"githubConnections">;
  userId: Id<"users">;
  username: string;
  githubLogin: string;
  scopes: string[];
  accessTokenEncrypted: string | null;
  accessTokenIv: string | null;
  repoFullName: string | null;
  repoDefaultBranch: string | null;
  installationId: number | null;
  installationTokenEnc: string | null;
  installationTokenIv: string | null;
  installationTokenExp: number | null;
  pendingPushAt: number | null;
  lastPushedCommitSha: string | null;
  mirrorStale: boolean;
};

/**
 * Slim token loader for the scheduler context (no requireOwner — internal
 * functions are server-only). Mirrors githubRepo.ts loadConnectionToken:
 * prefer a cached/minted GitHub App installation token, fall back to the
 * encrypted OAuth token.
 */
async function loadPushToken(
  ctx: ActionCtx,
  conn: PushConnection
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
    throw new Error("GitHub token unavailable for auto-push.");
  }
  return await decryptSecret(conn.accessTokenEncrypted, conn.accessTokenIv);
}

async function performAutoPush(
  ctx: ActionCtx,
  clerkId: string
): Promise<
  | { ok: true; pushed: string[]; commitSha: string | null; forced: boolean; upToDate: boolean }
  | { ok: false; reason: string }
> {
  const conn = (await ctx.runQuery(internal.github.internalGetConnectionContext, {
    clerkId,
  })) as PushConnection | null;

  if (!conn) return { ok: false, reason: "no_connection" };
  if (!conn.repoFullName) {
    // Repo was unlinked between scheduling and running — clear the marker so
    // future saves aren't debounced against a push that will never happen.
    await ctx.runMutation(internal.github.internalClearPendingPush, {
      connectionId: conn.connectionId,
    });
    return { ok: false, reason: "no_repo" };
  }

  const fullName = conn.repoFullName;
  const branch = conn.repoDefaultBranch || "main";
  const token = await loadPushToken(ctx, conn);

  // Ancestor check: did the repo head move past what we last pushed?
  const headSha = await fetchRepoHeadSha(token, fullName, branch);
  const diverged = hasMirrorDiverged(conn.lastPushedCommitSha, headSha);
  if (diverged && !conn.mirrorStale) {
    console.warn(
      `[github auto-push] mirror diverged for ${conn.username} ` +
        `(${fullName}: pushed ${conn.lastPushedCommitSha} → head ${headSha}); ` +
        `canonical content wins, force-updating.`
    );
    await ctx.runMutation(internal.github.internalSetMirrorStale, {
      connectionId: conn.connectionId,
      stale: true,
    });
  }

  const seed = (await ctx.runQuery(internal.github.internalGetSeedContent, {
    userId: conn.userId,
  })) as { youMd: string | null; youJson: unknown };

  if (!seed.youMd && seed.youJson == null) {
    // Nothing compiled yet — clear the marker, don't claim a sync happened.
    await ctx.runMutation(internal.github.internalClearPendingPush, {
      connectionId: conn.connectionId,
    });
    return { ok: false, reason: "nothing_to_push" };
  }

  const files: { path: string; content: string }[] = [
    { path: "you.md", content: seed.youMd ?? "" },
    { path: "you.json", content: JSON.stringify(seed.youJson ?? {}, null, 2) },
  ];

  let commitSha: string | undefined;
  const pushed: string[] = [];
  for (const file of files) {
    const existing = await fetchRepoFile(token, fullName, file.path, branch);
    // Skip byte-identical content (avoids empty commits).
    if (existing && existing.content === file.content) continue;
    commitSha =
      (await putRepoFile(
        token,
        fullName,
        file.path,
        file.content,
        branch,
        `chore(you.md): auto-sync ${file.path} from you.md`,
        existing?.sha
      )) ?? commitSha;
    pushed.push(file.path);
  }

  // Re-anchor ancestry at the new commit (or the observed head when the repo
  // already matched canonical), clear debounce + staleness + failure note.
  await ctx.runMutation(internal.github.internalMarkAutoPushed, {
    connectionId: conn.connectionId,
    commitSha: commitSha ?? headSha ?? undefined,
  });

  // Refresh the server-side mirror snapshot so reads see the reconciled head.
  if (pushed.length > 0 || diverged) {
    await ctx.scheduler.runAfter(0, internal.githubRepo.internalMirrorForConnection, {
      clerkId,
    });
  }

  return {
    ok: true,
    pushed,
    commitSha: commitSha ?? null,
    forced: diverged,
    upToDate: pushed.length === 0,
  };
}

/**
 * Internal: the scheduled auto-push entry point. attempt 0 is the debounced
 * run; on failure it logs, records the error on the connection, and schedules
 * exactly one retry (attempt 1) with backoff. Attempt 1 failing stops — the
 * next save schedules a fresh push.
 */
export const runAutoPush = internalAction({
  args: { clerkId: v.string(), attempt: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const attempt = args.attempt ?? 0;
    try {
      return await performAutoPush(ctx, args.clerkId);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const willRetry = attempt < AUTO_PUSH_MAX_RETRIES;
      console.error(
        `[github auto-push] attempt ${attempt} failed for ${args.clerkId}: ${message}` +
          (willRetry ? ` — retrying in ${AUTO_PUSH_RETRY_DELAY_MS}ms` : " — giving up")
      );
      await ctx.runMutation(internal.github.internalRecordAutoPushFailure, {
        clerkId: args.clerkId,
        error: message,
        retryAt: willRetry ? Date.now() + AUTO_PUSH_RETRY_DELAY_MS : null,
      });
      if (willRetry) {
        await ctx.scheduler.runAfter(
          AUTO_PUSH_RETRY_DELAY_MS,
          internal.githubAutoPush.runAutoPush,
          { clerkId: args.clerkId, attempt: attempt + 1 }
        );
      }
      return { ok: false as const, reason: "error", retryScheduled: willRetry };
    }
  },
});
