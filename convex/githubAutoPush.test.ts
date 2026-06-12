/**
 * P17 — debounced GitHub auto-push + mirror ancestry tests (PRODUCT-AUDIT #19).
 *
 * Covers:
 *   - pure helpers (debounce gate, sha divergence, read-time staleness)
 *   - debounce: second save inside the window doesn't double-schedule; a save
 *     after the window does
 *   - save/publish hooks (me.saveBundleFromForm, bundles.publishBundle,
 *     bundles.rollbackToVersion) schedule the push; users without a linked
 *     repo are a no-op
 *   - runAutoPush orchestration: push + re-anchor, force-push on divergence,
 *     up-to-date short-circuit, retry-once semantics with backoff
 *   - staleness: internalUpsertMirror sets/clears the flag; reads
 *     (internalGetMirrorByClerkId, getRepoMirror) flag staleness and overlay
 *     canonical you.md/you.json (canonical store always wins)
 *
 * NOTE: real GitHub API calls can't run under convex-test, so the push action
 * talks to GitHub exclusively through convex/lib/githubPushApi.ts, which is
 * vi.mock'd here. The orchestration (queries, mutations, scheduler) is real.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";

import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import { encryptSecret } from "./lib/secretCrypto";
import {
  AUTO_PUSH_RETRY_DELAY_MS,
  GITHUB_PUSH_DEBOUNCE_MS,
  hasMirrorDiverged,
  isMirrorStale,
  shouldDebounceAutoPush,
} from "./lib/githubSync";

vi.mock("./lib/githubPushApi", () => ({
  fetchRepoHeadSha: vi.fn(),
  fetchRepoFile: vi.fn(),
  putRepoFile: vi.fn(),
}));
import * as githubPushApi from "./lib/githubPushApi";
const ghApi = vi.mocked(githubPushApi);

// Secret needed by lib/secretCrypto to encrypt/decrypt the stored OAuth token.
process.env.API_KEY_ENCRYPTION_SECRET = "test-secret-".padEnd(48, "x");

const CLERK = "clerk_pushy";
const REPO = "pushy/you-md";
const YOU_MD = "# Pushy\n";
const YOU_JSON = { identity: { name: "Pushy" } };
const YOU_JSON_STR = JSON.stringify(YOU_JSON, null, 2);

type SeedOpts = {
  repo?: boolean;
  token?: boolean;
  bundle?: boolean;
  lastPushedCommitSha?: string;
  pendingPushAt?: number;
};

async function seed(t: ReturnType<typeof convexTest>, opts: SeedOpts = {}) {
  const enc = opts.token === false ? null : await encryptSecret("gh_test_token");
  return await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      clerkId: CLERK,
      username: "pushy",
      email: "pushy@example.com",
      plan: "pro",
      createdAt: Date.now(),
    });
    const connectionId = await ctx.db.insert("githubConnections", {
      userId,
      githubUserId: 42,
      githubLogin: "pushy",
      scopes: ["repo"],
      connectedAt: Date.now(),
      ...(opts.repo === false
        ? {}
        : {
            repoFullName: REPO,
            repoVisibility: "public",
            repoDefaultBranch: "main",
          }),
      ...(enc
        ? { accessTokenEncrypted: enc.ciphertext, accessTokenIv: enc.iv }
        : {}),
      ...(opts.lastPushedCommitSha
        ? { lastPushedCommitSha: opts.lastPushedCommitSha }
        : {}),
      ...(opts.pendingPushAt ? { pendingPushAt: opts.pendingPushAt } : {}),
    });
    let bundleId: Id<"bundles"> | null = null;
    if (opts.bundle !== false) {
      bundleId = await ctx.db.insert("bundles", {
        userId,
        version: 1,
        schemaVersion: "you-md/v1",
        manifest: {},
        youJson: YOU_JSON,
        youMd: YOU_MD,
        isPublished: true,
        createdAt: Date.now(),
        contentHash: "hash-v1",
      });
    }
    return { userId, connectionId, bundleId };
  });
}

async function getConn(
  t: ReturnType<typeof convexTest>,
  connectionId: Id<"githubConnections">
) {
  const conn = await t.run((ctx) => ctx.db.get(connectionId));
  if (!conn) throw new Error("connection vanished");
  return conn;
}

async function scheduledCount(t: ReturnType<typeof convexTest>) {
  const jobs = await t.run((ctx) =>
    ctx.db.system.query("_scheduled_functions").collect()
  );
  return jobs.filter((j) => j.state.kind === "pending").length;
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

// ── Pure helpers ────────────────────────────────────────────────────────────

describe("githubSync pure helpers", () => {
  it("shouldDebounceAutoPush only debounces while the pending run is in the future", () => {
    expect(shouldDebounceAutoPush(undefined, 1000)).toBe(false);
    expect(shouldDebounceAutoPush(null, 1000)).toBe(false);
    expect(shouldDebounceAutoPush(999, 1000)).toBe(false); // already ran — self-heals
    expect(shouldDebounceAutoPush(1000, 1000)).toBe(false);
    expect(shouldDebounceAutoPush(1001, 1000)).toBe(true);
  });

  it("hasMirrorDiverged compares shas only when both are known", () => {
    expect(hasMirrorDiverged(undefined, "c2")).toBe(false);
    expect(hasMirrorDiverged(null, "c2")).toBe(false);
    expect(hasMirrorDiverged("c1", null)).toBe(false);
    expect(hasMirrorDiverged("c1", undefined)).toBe(false);
    expect(hasMirrorDiverged("c1", "c1")).toBe(false);
    expect(hasMirrorDiverged("c1", "c2")).toBe(true);
  });

  it("isMirrorStale honors the flag and the ancestry check", () => {
    expect(isMirrorStale(null, "c2")).toBe(false);
    expect(isMirrorStale({}, "c2")).toBe(false);
    expect(isMirrorStale({ mirrorStale: true }, undefined)).toBe(true);
    expect(isMirrorStale({ lastPushedCommitSha: "c1" }, "c1")).toBe(false);
    expect(isMirrorStale({ lastPushedCommitSha: "c1" }, "c2")).toBe(true);
    expect(
      isMirrorStale({ mirrorStale: false, lastPushedCommitSha: "c1" }, "c1")
    ).toBe(false);
  });
});

// ── Debounce scheduling ─────────────────────────────────────────────────────

describe("scheduleGithubAutoPush debounce", () => {
  it("is a no-op without a linked repo", async () => {
    const t = convexTest(schema);
    const { userId } = await seed(t, { repo: false });
    const result = await t.mutation(internal.github.internalScheduleAutoPush, {
      userId,
    });
    expect(result).toEqual({ scheduled: false, reason: "no_repo" });
    expect(await scheduledCount(t)).toBe(0);
  });

  it("schedules once and debounces a second save inside the window", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
    const t = convexTest(schema);
    const { userId, connectionId } = await seed(t);

    const first = await t.mutation(internal.github.internalScheduleAutoPush, {
      userId,
    });
    expect(first.scheduled).toBe(true);
    expect(first.runAt).toBe(1_000_000 + GITHUB_PUSH_DEBOUNCE_MS);

    // Second save 10s later — still inside the window: no double-schedule.
    vi.setSystemTime(1_010_000);
    const second = await t.mutation(internal.github.internalScheduleAutoPush, {
      userId,
    });
    expect(second.scheduled).toBe(false);
    expect(second.reason).toBe("debounced");
    expect(await scheduledCount(t)).toBe(1);

    const conn = await getConn(t, connectionId);
    expect(conn.pendingPushAt).toBe(1_000_000 + GITHUB_PUSH_DEBOUNCE_MS);
  });

  it("schedules again after the window has passed", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
    const t = convexTest(schema);
    const { userId } = await seed(t);

    const first = await t.mutation(internal.github.internalScheduleAutoPush, {
      userId,
    });
    expect(first.scheduled).toBe(true);

    // Save lands after the pending push's run time — schedule a fresh one.
    vi.setSystemTime(1_000_000 + GITHUB_PUSH_DEBOUNCE_MS + 1);
    const later = await t.mutation(internal.github.internalScheduleAutoPush, {
      userId,
    });
    expect(later.scheduled).toBe(true);
    expect(later.runAt).toBe(1_000_000 + GITHUB_PUSH_DEBOUNCE_MS + 1 + GITHUB_PUSH_DEBOUNCE_MS);
  });
});

// ── Save/publish hooks ──────────────────────────────────────────────────────

describe("save/publish hooks schedule the auto-push", () => {
  it("saveBundleFromForm sets the debounce marker for linked users", async () => {
    const t = convexTest(schema);
    const { connectionId } = await seed(t);
    const asUser = t.withIdentity({ subject: CLERK });

    await asUser.mutation(api.me.saveBundleFromForm, {
      clerkId: CLERK,
      profileData: {
        _rawBundle: true,
        youJson: YOU_JSON,
        youMd: YOU_MD,
        manifest: {},
      },
      source: "cli",
    });

    const conn = await getConn(t, connectionId);
    expect(typeof conn.pendingPushAt).toBe("number");
    expect(await scheduledCount(t)).toBe(1);
  });

  it("saveBundleFromForm still works for users without a GitHub repo", async () => {
    const t = convexTest(schema);
    await seed(t, { repo: false });
    const asUser = t.withIdentity({ subject: CLERK });

    const result = await asUser.mutation(api.me.saveBundleFromForm, {
      clerkId: CLERK,
      profileData: {
        _rawBundle: true,
        youJson: YOU_JSON,
        youMd: YOU_MD,
        manifest: {},
      },
    });
    expect(result.version).toBe(2);
    expect(await scheduledCount(t)).toBe(0);
  });

  it("bundles.publishBundle and rollbackToVersion schedule (debounced) pushes", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(2_000_000);
    const t = convexTest(schema);
    const { connectionId, bundleId } = await seed(t);
    const asUser = t.withIdentity({ subject: CLERK });

    await asUser.mutation(api.bundles.publishBundle, {
      clerkId: CLERK,
      bundleId: bundleId!,
    });
    let conn = await getConn(t, connectionId);
    expect(conn.pendingPushAt).toBe(2_000_000 + GITHUB_PUSH_DEBOUNCE_MS);
    expect(await scheduledCount(t)).toBe(1);

    // Rollback right after — inside the debounce window, no second job.
    await asUser.mutation(api.bundles.rollbackToVersion, {
      clerkId: CLERK,
      targetVersion: 1,
    });
    conn = await getConn(t, connectionId);
    expect(conn.pendingPushAt).toBe(2_000_000 + GITHUB_PUSH_DEBOUNCE_MS);
    expect(await scheduledCount(t)).toBe(1);
  });
});

// ── runAutoPush orchestration (GitHub API wrapper mocked) ──────────────────

describe("runAutoPush", () => {
  it("pushes changed files and re-anchors ancestry at the new commit", async () => {
    const t = convexTest(schema);
    const { connectionId } = await seed(t, {
      lastPushedCommitSha: "c1",
      pendingPushAt: Date.now() + 60_000,
    });

    ghApi.fetchRepoHeadSha.mockResolvedValue("c1"); // in sync — no divergence
    ghApi.fetchRepoFile.mockResolvedValue(null); // files don't exist yet
    ghApi.putRepoFile.mockResolvedValue("c2");

    const result = await t.action(internal.githubAutoPush.runAutoPush, {
      clerkId: CLERK,
      attempt: 0,
    });
    expect(result).toMatchObject({
      ok: true,
      pushed: ["you.md", "you.json"],
      commitSha: "c2",
      forced: false,
      upToDate: false,
    });

    const conn = await getConn(t, connectionId);
    expect(conn.lastPushedCommitSha).toBe("c2");
    expect(conn.pendingPushAt).toBeUndefined();
    expect(conn.mirrorStale).toBe(false);
    expect(conn.lastPushError).toBeUndefined();
  });

  it("short-circuits when repo content already matches canonical", async () => {
    const t = convexTest(schema);
    const { connectionId } = await seed(t, { lastPushedCommitSha: "c1" });

    ghApi.fetchRepoHeadSha.mockResolvedValue("c1");
    ghApi.fetchRepoFile.mockImplementation(async (_t, _r, path) =>
      path === "you.md"
        ? { content: YOU_MD, sha: "f1" }
        : { content: YOU_JSON_STR, sha: "f2" }
    );

    const result = await t.action(internal.githubAutoPush.runAutoPush, {
      clerkId: CLERK,
      attempt: 0,
    });
    expect(result).toMatchObject({ ok: true, pushed: [], upToDate: true });
    expect(ghApi.putRepoFile).not.toHaveBeenCalled();

    const conn = await getConn(t, connectionId);
    expect(conn.lastPushedCommitSha).toBe("c1");
  });

  it("force-updates a diverged mirror (canonical wins) and clears the stale flag", async () => {
    const t = convexTest(schema);
    const { connectionId } = await seed(t, { lastPushedCommitSha: "c1" });

    ghApi.fetchRepoHeadSha.mockResolvedValue("c9"); // manual push moved head
    ghApi.fetchRepoFile.mockResolvedValue({ content: "manual edit", sha: "f9" });
    ghApi.putRepoFile.mockResolvedValue("c10");

    const result = await t.action(internal.githubAutoPush.runAutoPush, {
      clerkId: CLERK,
      attempt: 0,
    });
    expect(result).toMatchObject({ ok: true, forced: true });
    // Force update: writes against the mirror's current file shas — never merges.
    expect(ghApi.putRepoFile).toHaveBeenCalledWith(
      expect.any(String),
      REPO,
      "you.md",
      YOU_MD,
      "main",
      expect.any(String),
      "f9"
    );

    const conn = await getConn(t, connectionId);
    expect(conn.lastPushedCommitSha).toBe("c10");
    expect(conn.mirrorStale).toBe(false); // reconciled
  });

  it("flags the mirror stale when divergence is detected but the push fails", async () => {
    const t = convexTest(schema);
    const { connectionId } = await seed(t, { lastPushedCommitSha: "c1" });

    ghApi.fetchRepoHeadSha.mockResolvedValue("c9");
    ghApi.fetchRepoFile.mockResolvedValue(null);
    ghApi.putRepoFile.mockRejectedValue(new Error("github 502"));

    const result = await t.action(internal.githubAutoPush.runAutoPush, {
      clerkId: CLERK,
      attempt: 0,
    });
    expect(result).toMatchObject({ ok: false, retryScheduled: true });

    const conn = await getConn(t, connectionId);
    expect(conn.mirrorStale).toBe(true); // flag stays until a push succeeds
    expect(conn.lastPushError).toContain("github 502");
  });

  it("retries exactly once with backoff, then stops", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(5_000_000);
    const t = convexTest(schema);
    // No token stored → loadPushToken throws (a real failure mode).
    const { connectionId } = await seed(t, { token: false });

    const first = await t.action(internal.githubAutoPush.runAutoPush, {
      clerkId: CLERK,
      attempt: 0,
    });
    expect(first).toMatchObject({ ok: false, retryScheduled: true });
    let conn = await getConn(t, connectionId);
    expect(conn.lastPushError).toContain("GitHub token unavailable");
    // Debounce marker moved to the retry time — saves in between don't double-schedule.
    expect(conn.pendingPushAt).toBe(5_000_000 + AUTO_PUSH_RETRY_DELAY_MS);
    expect(await scheduledCount(t)).toBe(1); // the single retry

    // The retry (attempt 1) fails too → gives up, no further scheduling.
    const second = await t.action(internal.githubAutoPush.runAutoPush, {
      clerkId: CLERK,
      attempt: 1,
    });
    expect(second).toMatchObject({ ok: false, retryScheduled: false });
    conn = await getConn(t, connectionId);
    expect(conn.pendingPushAt).toBeUndefined(); // next save can schedule fresh
    expect(await scheduledCount(t)).toBe(1); // unchanged — no retry loop
  });

  it("clears the pending marker when there is nothing to push", async () => {
    const t = convexTest(schema);
    const { connectionId } = await seed(t, {
      bundle: false,
      pendingPushAt: Date.now() + 60_000,
    });

    const result = await t.action(internal.githubAutoPush.runAutoPush, {
      clerkId: CLERK,
      attempt: 0,
    });
    expect(result).toMatchObject({ ok: false, reason: "nothing_to_push" });
    const conn = await getConn(t, connectionId);
    expect(conn.pendingPushAt).toBeUndefined();
    expect(ghApi.putRepoFile).not.toHaveBeenCalled();
  });

  it("clears the pending marker when the repo was unlinked before the run", async () => {
    const t = convexTest(schema);
    const { connectionId } = await seed(t, {
      repo: false,
      pendingPushAt: Date.now() + 60_000,
    });

    const result = await t.action(internal.githubAutoPush.runAutoPush, {
      clerkId: CLERK,
      attempt: 0,
    });
    expect(result).toMatchObject({ ok: false, reason: "no_repo" });
    const conn = await getConn(t, connectionId);
    expect(conn.pendingPushAt).toBeUndefined();
  });
});

// ── Staleness on mirror reads ───────────────────────────────────────────────

describe("mirror staleness (ancestor check on reads)", () => {
  const MIRROR_FILES = [
    { path: "you.md", content: "stale mirror copy", size: 17 },
    { path: "stacks/growth/manifest.json", content: "{}", size: 2 },
  ];

  async function seedMirror(
    t: ReturnType<typeof convexTest>,
    userId: Id<"users">,
    commitSha: string
  ) {
    await t.run(async (ctx) => {
      await ctx.db.insert("repoMirror", {
        userId,
        repoFullName: REPO,
        commitSha,
        files: MIRROR_FILES,
        fileCount: MIRROR_FILES.length,
        totalBytes: 19,
        truncated: false,
        syncedAt: Date.now(),
      });
    });
  }

  it("internalUpsertMirror sets the stale flag on divergence and clears it on agreement", async () => {
    const t = convexTest(schema);
    const { userId, connectionId } = await seed(t, { lastPushedCommitSha: "c1" });

    await t.mutation(internal.github.internalUpsertMirror, {
      userId,
      repoFullName: REPO,
      commitSha: "c2", // mirror head moved past what we pushed
      files: MIRROR_FILES,
      truncated: false,
    });
    expect((await getConn(t, connectionId)).mirrorStale).toBe(true);

    await t.mutation(internal.github.internalUpsertMirror, {
      userId,
      repoFullName: REPO,
      commitSha: "c1", // back in agreement
      files: MIRROR_FILES,
      truncated: false,
    });
    expect((await getConn(t, connectionId)).mirrorStale).toBe(false);
  });

  it("internalGetMirrorByClerkId overlays canonical content when stale", async () => {
    const t = convexTest(schema);
    const { userId } = await seed(t, { lastPushedCommitSha: "c1" });
    await seedMirror(t, userId, "c2"); // diverged

    const mirror = await t.query(internal.github.internalGetMirrorByClerkId, {
      clerkId: CLERK,
    });
    expect(mirror?.stale).toBe(true);
    const youMd = mirror?.files.find((f: { path: string }) => f.path === "you.md");
    expect(youMd?.content).toBe(YOU_MD); // canonical wins, not "stale mirror copy"
    const youJson = mirror?.files.find(
      (f: { path: string }) => f.path === "you.json"
    );
    expect(youJson?.content).toBe(YOU_JSON_STR); // added even though mirror lacked it
    const stack = mirror?.files.find((f: { path: string }) =>
      f.path.startsWith("stacks/")
    );
    expect(stack?.content).toBe("{}"); // stacks have no canonical copy — untouched
  });

  it("internalGetMirrorByClerkId serves the mirror as-is when in sync", async () => {
    const t = convexTest(schema);
    const { userId } = await seed(t, { lastPushedCommitSha: "c2" });
    await seedMirror(t, userId, "c2");

    const mirror = await t.query(internal.github.internalGetMirrorByClerkId, {
      clerkId: CLERK,
    });
    expect(mirror?.stale).toBe(false);
    const youMd = mirror?.files.find((f: { path: string }) => f.path === "you.md");
    expect(youMd?.content).toBe("stale mirror copy"); // no overlay when fresh
  });

  it("getRepoMirror surfaces the stale flag to the owner UI", async () => {
    const t = convexTest(schema);
    const { userId } = await seed(t, { lastPushedCommitSha: "c1" });
    await seedMirror(t, userId, "c2");
    const asUser = t.withIdentity({ subject: CLERK });

    const summary = await asUser.query(api.github.getRepoMirror, {
      clerkId: CLERK,
    });
    expect(summary?.stale).toBe(true);
    expect(summary?.stacks).toEqual([
      { slug: "growth", fileCount: 1, hasManifest: true },
    ]);
  });
});
