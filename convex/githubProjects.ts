"use node";

/**
 * GitHub active-project analysis (githubProjects.ts)
 *
 * analyzeActiveProjects  — action: scans the user's repos pushed in the last
 *   90 days, counts recent commits, calls the LLM for a 1-2 sentence insight
 *   per project, and upserts into `trackedProjects`.
 *
 * listTrackedProjects    — query:  owner-gated; returns projects ordered by
 *   pushedAt descending so the most-recently-active appear first.
 *
 * setProjectVisibility   — mutation: owner-gated; lets the user flip a project
 *   between "private" (default) and "public" for the onboarding flow.
 *
 * Auth: all three functions call requireOwner (same pattern as memories.ts,
 * me.ts, etc.) and never leak GitHub tokens beyond the Convex trust boundary.
 * Token resolution follows the exact same path as githubRepo.ts
 * (loadConnectionToken → installationId fast-path → OAuth fallback).
 *
 * Note: listTrackedProjects and setProjectVisibility are re-exported from
 * githubProjectsPublic.ts (non-Node.js runtime) because Convex does not allow
 * queries or mutations in Node.js action bundles.
 */

import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import type { ActionCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireOwner } from "./lib/auth";
import { decryptSecret, encryptSecret } from "./lib/secretCrypto";
import { isGithubAppConfigured, mintInstallationToken } from "./githubApp";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GITHUB_API = "https://api.github.com";
const DAYS_90_MS = 90 * 24 * 60 * 60 * 1000;
const MAX_REPOS = 10; // analyze at most 10 repos to stay within rate limits

// ---------------------------------------------------------------------------
// Types (private, not exported)
// ---------------------------------------------------------------------------

type ConnectionContext = {
  connectionId: Id<"githubConnections">;
  userId: Id<"users">;
  username: string;
  githubLogin: string;
  scopes: string[];
  accessTokenEncrypted: string | null;
  accessTokenIv: string | null;
  repoFullName: string | null;
  repoDefaultBranch: string | null;
  webhookId: number | null;
  installationId: number | null;
  installationTokenEnc: string | null;
  installationTokenIv: string | null;
  installationTokenExp: number | null;
};

type GithubRepo = {
  id: number;
  full_name: string;
  name: string;
  description: string | null;
  language: string | null;
  pushed_at: string | null;
  stargazers_count: number;
  private: boolean;
};

type GithubCommit = {
  sha: string;
  commit: {
    message: string;
    author?: { date?: string } | null;
  };
};

type ProjectAnalysis = {
  id: string;
  fullName: string;
  name: string;
  description: string | null;
  primaryLanguage: string | null;
  pushedAt: number;
  commitsLast90d: number;
  stars: number;
  isPrivate: boolean;
  insight: string | null;
  visibility: "private" | "public";
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function githubHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "you.md-app",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

/**
 * Resolve a GitHub token for the given clerkId — mirrors the pattern from
 * githubRepo.ts loadConnectionToken but is self-contained so we don't
 * import from the agent-owned file.
 */
async function resolveGithubToken(
  ctx: ActionCtx,
  clerkId: string
): Promise<{ context: ConnectionContext; token: string }> {
  const context = (await ctx.runQuery(
    internal.github.internalGetConnectionContext,
    { clerkId }
  )) as ConnectionContext | null;

  if (!context) {
    throw new Error(
      "No GitHub account connected. Connect GitHub first so we can analyze your projects."
    );
  }

  // Prefer a fine-grained GitHub App installation token when available.
  if (context.installationId && isGithubAppConfigured()) {
    if (
      context.installationTokenEnc &&
      context.installationTokenIv &&
      context.installationTokenExp &&
      context.installationTokenExp - Date.now() > 60_000
    ) {
      const token = await decryptSecret(
        context.installationTokenEnc,
        context.installationTokenIv
      );
      return { context, token };
    }
    const minted = await mintInstallationToken(context.installationId);
    const enc = await encryptSecret(minted.token);
    await ctx.runMutation(internal.github.internalCacheInstallationToken, {
      connectionId: context.connectionId,
      enc: enc.ciphertext,
      iv: enc.iv,
      exp: minted.expiresAt,
    });
    return { context, token: minted.token };
  }

  // Fall back to the stored OAuth token.
  if (!context.accessTokenEncrypted || !context.accessTokenIv) {
    throw new Error(
      "GitHub token unavailable. Reconnect GitHub to refresh access."
    );
  }
  const token = await decryptSecret(
    context.accessTokenEncrypted,
    context.accessTokenIv
  );
  return { context, token };
}

/** Call GitHub REST — throws on non-2xx. */
async function githubGet<T>(token: string, url: string): Promise<T> {
  const res = await fetch(url, { headers: githubHeaders(token) });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub ${res.status} ${url}: ${text.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

/**
 * Call LLM (Anthropic direct, then OpenRouter fallback) to generate a 1-2
 * sentence insight. Same approach as chat.ts onboardingChat, but uses Haiku
 * for cost efficiency since these are short one-shot summaries.
 */
async function callLlmForInsight(
  repoFullName: string,
  description: string | null,
  language: string | null,
  recentMessages: string[]
): Promise<string> {
  const commitSample = recentMessages.slice(0, 6).join(" | ");
  const userPrompt =
    `Repo: ${repoFullName}\n` +
    (description ? `Description: ${description}\n` : "") +
    (language ? `Language: ${language}\n` : "") +
    (commitSample ? `Recent commits: ${commitSample}\n` : "") +
    `\nIn 1-2 sentences, describe what this project is and what the recent work suggests. ` +
    `Be specific. No filler phrases like "it appears" or "this project seems". Just facts.`;

  const systemPrompt =
    "You are a concise technical writer summarizing GitHub projects for a developer profile. " +
    "Write exactly 1-2 sentences. Be factual, direct, and specific. Lowercase is fine.";

  // Try Anthropic first (Haiku for cost efficiency — 1-2 sentence summaries).
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (anthropicKey) {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 200,
          temperature: 0.3,
          system: systemPrompt,
          messages: [{ role: "user", content: userPrompt }],
        }),
        signal: AbortSignal.timeout(30_000),
      });
      if (res.ok) {
        const data = (await res.json()) as { content?: Array<{ text?: string }> };
        const text = data.content?.[0]?.text;
        if (text) return text.trim();
      }
    } catch {
      // fall through to OpenRouter
    }
  }

  // OpenRouter fallback.
  const openrouterKey = process.env.OPENROUTER_API_KEY;
  if (openrouterKey) {
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openrouterKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://you.md",
          "X-Title": "You.md Agent",
        },
        body: JSON.stringify({
          model: "anthropic/claude-haiku-4-5",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          max_tokens: 200,
          temperature: 0.3,
        }),
        signal: AbortSignal.timeout(30_000),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const text = data.choices?.[0]?.message?.content;
        if (text) return text.trim();
      }
    } catch {
      // fall through to best-effort fallback
    }
  }

  // Best-effort fallback: no LLM available.
  return description
    ? description.slice(0, 160)
    : `${repoFullName} (${language ?? "unknown language"})`;
}

// ---------------------------------------------------------------------------
// analyzeActiveProjects — public action (owner-gated)
// ---------------------------------------------------------------------------

export const analyzeActiveProjects = action({
  args: {
    clerkId: v.string(),
    _internalAuthToken: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<ProjectAnalysis[]> => {
    await requireOwner(ctx, args.clerkId, args._internalAuthToken);

    const { context, token } = await resolveGithubToken(ctx, args.clerkId);
    const userId = context.userId;

    // 1. Fetch all user repos sorted by pushed_at, most-recent first.
    //    We cap at 100 per page; the 90-day filter will reduce this further.
    const allRepos = await githubGet<GithubRepo[]>(
      token,
      `${GITHUB_API}/user/repos?sort=pushed&direction=desc&per_page=100&affiliation=owner`
    );

    const cutoff90d = Date.now() - DAYS_90_MS;
    const cutoff90dIso = new Date(cutoff90d).toISOString();

    // Keep only repos pushed within the last 90 days (take up to MAX_REPOS).
    const activeRepos = allRepos
      .filter((r) => r.pushed_at && Date.parse(r.pushed_at) >= cutoff90d)
      .slice(0, MAX_REPOS);

    const results: ProjectAnalysis[] = [];

    // 2. For each active repo: fetch recent commits, count them, generate insight.
    //    Sequential to respect GitHub rate limits (5000 req/hr for OAuth).
    for (const repo of activeRepos) {
      let commits: GithubCommit[] = [];
      try {
        commits = await githubGet<GithubCommit[]>(
          token,
          `${GITHUB_API}/repos/${repo.full_name}/commits?since=${cutoff90dIso}&per_page=30`
        );
      } catch {
        // If commits endpoint fails (e.g. empty repo), keep count at 0.
        commits = [];
      }

      const recentMessages = commits.map(
        (c) => c.commit.message.split("\n")[0] ?? ""
      );
      const commitCount = commits.length;
      const pushedAt = repo.pushed_at ? Date.parse(repo.pushed_at) : Date.now();

      // 3. Generate LLM insight.
      let insight: string | null = null;
      try {
        insight = await callLlmForInsight(
          repo.full_name,
          repo.description,
          repo.language,
          recentMessages
        );
      } catch {
        // Non-fatal: store without insight rather than failing the whole batch.
        insight = null;
      }

      // 4. Upsert into trackedProjects via the non-Node.js internal mutation.
      await ctx.runMutation(
        internal.githubProjectsMutations.internalUpsertProject,
        {
          userId,
          githubRepoId: repo.id,
          fullName: repo.full_name,
          name: repo.name,
          description: repo.description ?? undefined,
          primaryLanguage: repo.language ?? undefined,
          pushedAt,
          commitsLast90d: commitCount,
          stars: repo.stargazers_count,
          isPrivate: repo.private,
          insight: insight ?? undefined,
        }
      );

      results.push({
        id: `${repo.id}`,
        fullName: repo.full_name,
        name: repo.name,
        description: repo.description,
        primaryLanguage: repo.language,
        pushedAt,
        commitsLast90d: commitCount,
        stars: repo.stargazers_count,
        isPrivate: repo.private,
        insight,
        visibility: "private",
      });
    }

    return results;
  },
});
