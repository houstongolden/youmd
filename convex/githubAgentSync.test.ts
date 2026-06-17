import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ActionCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

vi.mock("./lib/secretCrypto", () => ({
  decryptSecret: vi.fn(async () => "gh_test_token"),
  encryptSecret: vi.fn(async (value: string) => ({ ciphertext: `enc:${value}`, iv: "iv" })),
}));

vi.mock("./githubApp", () => ({
  isGithubAppConfigured: vi.fn(() => false),
  mintInstallationToken: vi.fn(),
}));

import { agentPushViaPR } from "./githubAgentSync";

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

describe("agentPushViaPR conflict retry timeline", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-17T12:00:00Z"));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("recreates the sync branch from fresh default HEAD after a 409 merge conflict", async () => {
    const connectionId = "conn_agent_push" as Id<"githubConnections">;
    const ctx = {
      runQuery: vi.fn(async () => ({
        connectionId,
        userId: "user_agent_push" as Id<"users">,
        repoFullName: "houstongolden/houstongolden-you-md",
        repoDefaultBranch: "main",
        installationId: null,
        installationTokenEnc: null,
        installationTokenIv: null,
        installationTokenExp: null,
        accessTokenEncrypted: "encrypted-token",
        accessTokenIv: "token-iv",
        scopes: ["repo"],
      })),
      runMutation: vi.fn(),
    } as unknown as ActionCtx;

    const calls: Array<{ method: string; url: string }> = [];
    let mainHeadCalls = 0;
    let blobCalls = 0;
    let treeCalls = 0;
    let commitCalls = 0;
    let mergeCalls = 0;

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = input instanceof Request ? input.url : String(input);
      const method = init?.method ?? (input instanceof Request ? input.method : "GET");
      calls.push({ method, url });

      if (method === "GET" && url.endsWith("/git/ref/heads/main")) {
        mainHeadCalls += 1;
        return jsonResponse({
          object: {
            sha: mainHeadCalls === 1 ? "base111111111111" : "fresh222222222222",
          },
        });
      }

      if (method === "POST" && url.endsWith("/git/blobs")) {
        blobCalls += 1;
        return jsonResponse({ sha: `blob${blobCalls}` });
      }

      if (method === "GET" && url.includes("/git/commits/base111111111111")) {
        return jsonResponse({ tree: { sha: "tree-base-1" } });
      }

      if (method === "GET" && url.includes("/git/commits/fresh222222222222")) {
        return jsonResponse({ tree: { sha: "tree-base-2" } });
      }

      if (method === "POST" && url.endsWith("/git/trees")) {
        treeCalls += 1;
        return jsonResponse({ sha: `tree-new-${treeCalls}` });
      }

      if (method === "POST" && url.endsWith("/git/commits")) {
        commitCalls += 1;
        return jsonResponse({
          sha: commitCalls === 1 ? "commit-branch-1" : "commit-branch-2",
        });
      }

      if (method === "GET" && url.includes("/git/ref/heads/you-md-agent-")) {
        return new Response("not found", { status: 404 });
      }

      if (method === "POST" && url.endsWith("/git/refs")) {
        return jsonResponse({ ref: "refs/heads/you-md-agent-1781697600000" });
      }

      if (method === "POST" && url.endsWith("/pulls")) {
        return jsonResponse({
          number: 42,
          html_url: "https://github.com/houstongolden/houstongolden-you-md/pull/42",
        });
      }

      if (method === "PUT" && url.endsWith("/pulls/42/merge")) {
        mergeCalls += 1;
        if (mergeCalls === 1) {
          return jsonResponse({ message: "Merge conflict" }, { status: 409 });
        }
        return jsonResponse({ sha: "merge333333333333" });
      }

      if (method === "DELETE" && url.includes("/git/refs/heads/you-md-agent-")) {
        return new Response(null, { status: 204 });
      }

      throw new Error(`Unexpected GitHub API call: ${method} ${url}`);
    });

    const result = await agentPushViaPR(ctx, {
      connectionId,
      files: [{ path: "you.md", content: "# Houston\n" }],
      message: "chore(identity): sync you.md",
      autoMerge: true,
    });

    expect(result).toMatchObject({
      ok: true,
      prNumber: 42,
      prUrl: "https://github.com/houstongolden/houstongolden-you-md/pull/42",
      mergeCommitSha: "merge333333333333",
      merged: true,
      branchRecreated: true,
    });

    expect(result.timeline.map((event) => event.key)).toEqual([
      "default-branch-head",
      "agent-branch-commit",
      "pull-request-opened",
      "merge-attempt",
      "merge-conflict-detected",
      "conflict-retry-branch-recreated",
      "github-checks-merge-gate",
    ]);
    expect(result.timeline[4]).toMatchObject({
      label: "detect merge conflict",
      status: "success",
      detail: "GitHub returned 409; recreating branch from latest default branch",
      metadata: {
        prNumber: 42,
        branch: "you-md-agent-1781697600000",
      },
    });
    expect(result.timeline[5]).toMatchObject({
      label: "recreate branch from latest head",
      status: "success",
      detail: "you-md-agent-1781697600000@commit-branc",
      metadata: {
        prNumber: 42,
        branch: "you-md-agent-1781697600000",
        baseSha: "fresh222222222222",
        commitSha: "commit-branch-2",
      },
    });
    expect(result.timeline[6]).toMatchObject({
      label: "check GitHub merge gate",
      status: "success",
      metadata: {
        prNumber: 42,
        mergeCommitSha: "merge333333333333",
      },
    });

    expect(mainHeadCalls).toBe(2);
    expect(mergeCalls).toBe(2);
    expect(calls.some((call) => call.method === "DELETE" && call.url.includes("/git/refs/heads/you-md-agent-"))).toBe(true);
    expect(calls.some((call) => call.method === "GET" && call.url.includes("/git/commits/fresh222222222222"))).toBe(true);
  });
});
