import { action, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import type { ActionCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireOwner } from "./lib/auth";
import { decryptSecret, encryptSecret } from "./lib/secretCrypto";
import { isGithubAppConfigured, mintInstallationToken } from "./githubApp";
import { agentPushViaPR } from "./githubAgentSync";
import type { AgentPushTimelineEvent } from "./githubAgentSync";
import { buildPortfolioRepoSnapshotFiles } from "./lib/portfolioRepoSnapshot";
import type { PortfolioRepoSnapshotGraph } from "./lib/portfolioRepoSnapshot";

/**
 * GitHub repo actions (Phase 2): create or connect the user's own You.md repo
 * — public or private — from the web shell. These are Convex actions so the
 * decrypted OAuth token never leaves the Convex trust boundary; the browser
 * only ever calls them with the authenticated user's identity (requireOwner).
 *
 * The repo becomes the source of truth for the user's identity `.md` + stacks;
 * later phases pull/compile it and mirror it server-side for API/MCP.
 */

const DEFAULT_REPO_NAME = "you-md"; // used only as a final fallback
const GITHUB_API = "https://api.github.com";

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

function githubHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "you.md-app",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

/**
 * Sanitize a candidate repo name to a GitHub-safe slug.
 * Falls back to DEFAULT_REPO_NAME only as a last resort.
 */
function sanitizeRepoName(name: string | undefined): string {
  const cleaned = (name || DEFAULT_REPO_NAME)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 100);
  return cleaned || DEFAULT_REPO_NAME;
}

/**
 * Build the default repo name from the GitHub login: "{login}-you-md".
 * Falls back to DEFAULT_REPO_NAME if login is empty after sanitization.
 */
function defaultRepoNameForLogin(githubLogin: string): string {
  const slug = githubLogin
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 90); // leave room for "-you-md" suffix
  return slug ? `${slug}-you-md` : DEFAULT_REPO_NAME;
}

function base64Utf8(input: string): string {
  // btoa needs a binary string; encode UTF-8 first so non-ASCII content survives.
  const bytes = new TextEncoder().encode(input);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function decodeBase64Utf8(b64: string): string {
  const binary = atob(b64.replace(/\n/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

/** Read a single file from a repo. Returns null on 404. */
async function getRepoFile(
  token: string,
  fullName: string,
  path: string,
  ref: string
): Promise<{ content: string; sha: string } | null> {
  const res = await fetch(
    `${GITHUB_API}/repos/${fullName}/contents/${path}?ref=${encodeURIComponent(ref)}`,
    { headers: githubHeaders(token) }
  );
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Could not read ${path} from the repo (${res.status}).`);
  }
  const body = (await res.json()) as { content?: string; sha: string };
  return {
    content: body.content ? decodeBase64Utf8(body.content) : "",
    sha: body.sha,
  };
}

// Mirror caps — keep the snapshot inside Convex document limits.
const MIRROR_MAX_FILES = 100;
const MIRROR_MAX_FILE_BYTES = 128 * 1024;
const MIRROR_MAX_TOTAL_BYTES = 700 * 1024;

/** Whether a repo path should be mirrored server-side. */
function isMirrorablePath(path: string): boolean {
  // Never mirror private/* server-side. Private files belong in the
  // zero-knowledge vault (client-side encrypted), not the plaintext mirror.
  if (path.startsWith("private/")) return false;
  if (path === "you.md" || path === "you.json" || path === "README.md") return true;
  if (path.startsWith("stacks/")) return true;
  if (path.startsWith("identity/")) return true;   // per-section markdown
  if (path.startsWith("projects/")) return true;   // per-project context files
  if (path.startsWith("context/")) return true;    // runtime context drop zone
  if (/^[^/]+\.md$/.test(path)) return true; // top-level markdown
  return false;
}

/** Fetch a blob's decoded UTF-8 content by sha. */
async function getRepoBlob(
  token: string,
  fullName: string,
  sha: string
): Promise<string | null> {
  const res = await fetch(`${GITHUB_API}/repos/${fullName}/git/blobs/${sha}`, {
    headers: githubHeaders(token),
  });
  if (!res.ok) return null;
  const body = (await res.json()) as { content?: string; encoding?: string };
  if (!body.content) return null;
  if (body.encoding && body.encoding !== "base64") return null;
  return decodeBase64Utf8(body.content);
}

/** Create or update a single file. Returns the resulting commit sha. */
async function putRepoFile(
  token: string,
  fullName: string,
  path: string,
  content: string,
  branch: string,
  message: string,
  sha?: string
): Promise<string | undefined> {
  const res = await fetch(`${GITHUB_API}/repos/${fullName}/contents/${path}`, {
    method: "PUT",
    headers: { ...githubHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      content: base64Utf8(content),
      branch,
      ...(sha ? { sha } : {}),
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Could not write ${path} to the repo (${res.status}): ${text}`);
  }
  const body = (await res.json()) as { commit?: { sha?: string } };
  return body.commit?.sha;
}

async function loadConnectionToken(
  ctx: ActionCtx,
  clerkId: string,
  opts: { requireRepoScope?: boolean } = {}
): Promise<{ context: ConnectionContext; token: string }> {
  const context = (await ctx.runQuery(
    internal.github.internalGetConnectionContext,
    { clerkId }
  )) as ConnectionContext | null;

  if (!context) {
    throw new Error(
      "No GitHub account connected. Sign in with GitHub first to host your You.md in a repo."
    );
  }

  // Phase 5: prefer a fine-grained, short-lived GitHub App installation token
  // when the App is configured and this user has installed it. Installation
  // tokens carry repo permissions (not OAuth scopes), so the scope check below
  // only applies to the OAuth fallback. The minted token is cached (encrypted)
  // until ~1 min before expiry to avoid minting one per op.
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

  if (!context.accessTokenEncrypted || !context.accessTokenIv) {
    throw new Error(
      "GitHub token unavailable. Reconnect GitHub to refresh access."
    );
  }
  if (opts.requireRepoScope && !context.scopes.includes("repo")) {
    throw new Error(
      "GitHub access was granted without repo permission. Reconnect GitHub and approve repository access."
    );
  }

  const token = await decryptSecret(
    context.accessTokenEncrypted,
    context.accessTokenIv
  );
  return { context, token };
}

/**
 * Build the canonical seed file set for a freshly created repo.
 *
 * Canonical layout:
 *   README.md             — agent-managed You.md repo explainer
 *   you.md                — compiled identity context (human + agent readable)
 *   you.json              — structured identity bundle
 *   identity/             — per-section markdown from the compiled bundle
 *   projects/README.md    — placeholder; per-project files populated by agents
 *   stacks/.gitkeep       — YouStacks home; one subfolder per named stack
 *   context/.gitkeep      — runtime context drop zone for agents
 */
function buildSeedFiles(seed: {
  youMd: string | null;
  youJson: unknown;
  name: string | null;
  username: string | null;
  tagline: string | null;
}): { path: string; content: string }[] {
  const displayName = seed.name || seed.username || "you";
  const handle = seed.username || "you";

  const readme = `# ${displayName} — You.md

This repository is **agent-managed** by [You.md](https://you.md). It is the
portable identity brain for **${handle}** — AI agents read it to understand who
${handle} is, what they're working on, and how to work with them without starting
from scratch every session.

Edits made here sync back to the You.md account automatically. Edits made on
the You.md web shell or CLI push back here.

- Public profile: https://you.md/${handle}
- Edit on the web: https://you.md/shell
- Learn more: https://you.md

## Layout

| Path | Contents |
|---|---|
| \`you.md\` | Compiled identity context — the main agent-readable document |
| \`you.json\` | Structured identity bundle (schema: you-md/v1) |
| \`identity/\` | Per-section markdown (bio, skills, values, projects, etc.) |
| \`projects/\` | Per-project context files (one file per tracked project) |
| \`stacks/\` | Named YouStacks — one sub-folder per stack |
| \`context/\` | Drop zone for runtime context files used by agents |

> **Do not delete or rename \`you.md\` or \`you.json\`** — they are the source
> of truth consumed by every agent that reads this repo.
`;

  const youMd =
    seed.youMd ||
    `# ${displayName}\n\n${seed.tagline ? seed.tagline + "\n\n" : ""}> This is ${handle}'s You.md. Start building your agent brain at https://you.md/shell\n`;

  const youJson = JSON.stringify(
    seed.youJson ?? {
      schema: "you-md/v1",
      username: handle,
      name: displayName,
      tagline: seed.tagline ?? null,
    },
    null,
    2
  );

  const identityReadme = `# identity/

Per-section identity markdown, auto-generated from the compiled You.md bundle.
Each file mirrors a section of \`you.md\` so agents can load just the slice
they need without parsing the full document.

Files here are managed automatically — do not edit them directly.
Edit your identity at https://you.md/shell and the sections will regenerate.
`;

  const projectsReadme = `# projects/

One Markdown file per tracked project. Files here are populated by the You.md
agent as you work and are updated when you mention or update a project in the
web shell or CLI.

Format: \`{project-slug}.md\`

To add a project: use \`youmd project add\` or mention it to the You Agent.
`;

  return [
    { path: "README.md", content: readme },
    { path: "you.md", content: youMd },
    { path: "you.json", content: youJson },
    { path: "identity/README.md", content: identityReadme },
    { path: "projects/README.md", content: projectsReadme },
    {
      path: "stacks/.gitkeep",
      content: "# YouStacks live here. One folder per named stack.\n",
    },
    {
      path: "context/.gitkeep",
      content:
        "# Drop runtime context files here. Agents read from this directory.\n",
    },
  ];
}

function isSafeRepoPath(filePath: string): boolean {
  return (
    filePath.length > 0 &&
    filePath.length <= 220 &&
    !filePath.startsWith("/") &&
    !filePath.includes("\\") &&
    !filePath.split("/").includes("..")
  );
}

function customFilesFromYouJson(youJson: unknown): { path: string; content: string }[] {
  const record = typeof youJson === "object" && youJson !== null
    ? youJson as { custom_files?: unknown }
    : {};
  const files = Array.isArray(record.custom_files) ? record.custom_files : [];
  const reserved = new Set(["README.md", "you.md", "you.json"]);
  const seen = new Set<string>();
  const result: { path: string; content: string }[] = [];

  for (const item of files) {
    if (!item || typeof item !== "object") continue;
    const file = item as { path?: unknown; content?: unknown };
    if (typeof file.path !== "string" || typeof file.content !== "string") continue;
    const filePath = file.path.trim().replace(/^\.\/+/, "");
    if (!isSafeRepoPath(filePath)) continue;
    if (reserved.has(filePath)) continue;
    if (!isMirrorablePath(filePath)) continue;
    if (seen.has(filePath)) continue;
    seen.add(filePath);
    result.push({ path: filePath, content: file.content });
  }

  return result;
}

function dedupeRepoFiles(files: { path: string; content: string }[]): { path: string; content: string }[] {
  const byPath = new Map<string, { path: string; content: string }>();
  for (const file of files) {
    byPath.set(file.path, file);
  }
  return Array.from(byPath.values());
}

/** List the authenticated user's repos so they can connect an existing one. */
export const listRepos = action({
  args: { clerkId: v.string() },
  handler: async (ctx, { clerkId }) => {
    await requireOwner(ctx, clerkId);
    const { token } = await loadConnectionToken(ctx, clerkId);

    const res = await fetch(
      `${GITHUB_API}/user/repos?per_page=100&sort=updated&affiliation=owner`,
      { headers: githubHeaders(token) }
    );
    if (!res.ok) {
      throw new Error(`Could not list your GitHub repos (${res.status}).`);
    }
    const repos = (await res.json()) as Array<{
      full_name: string;
      name: string;
      private: boolean;
      default_branch: string;
      updated_at: string;
      permissions?: { push?: boolean };
    }>;

    return repos
      .filter((r) => r.permissions?.push !== false)
      .map((r) => ({
        fullName: r.full_name,
        name: r.name,
        visibility: r.private ? "private" : "public",
        defaultBranch: r.default_branch,
        updatedAt: r.updated_at,
      }));
  },
});

/** Create a new You.md repo (public or private) and seed it. */
export const createRepo = action({
  args: {
    clerkId: v.string(),
    name: v.optional(v.string()),
    visibility: v.union(v.literal("public"), v.literal("private")),
  },
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.clerkId);
    const { context, token } = await loadConnectionToken(ctx, args.clerkId, {
      requireRepoScope: true,
    });

    // Task 1: default repo name is "{githubLogin}-you-md". A caller-supplied
    // name overrides this; sanitizeRepoName normalizes the override to a safe slug.
    const repoName = args.name
      ? sanitizeRepoName(args.name)
      : sanitizeRepoName(defaultRepoNameForLogin(context.githubLogin));

    // Create the repo (no auto_init — we seed our own files, which initializes
    // the default branch on first commit).
    const createRes = await fetch(`${GITHUB_API}/user/repos`, {
      method: "POST",
      headers: { ...githubHeaders(token), "Content-Type": "application/json" },
      body: JSON.stringify({
        name: repoName,
        private: args.visibility === "private",
        description: "My You.md — portable agent brain. https://you.md",
        auto_init: false,
        has_issues: false,
        has_wiki: false,
        has_projects: false,
      }),
    });

    if (createRes.status === 422) {
      throw new Error(
        `You already have a repo named "${repoName}". Connect it instead, or pick a different name.`
      );
    }
    if (!createRes.ok) {
      const text = await createRes.text();
      throw new Error(`GitHub repo creation failed (${createRes.status}): ${text}`);
    }

    const repo = (await createRes.json()) as {
      full_name: string;
      default_branch: string;
      html_url: string;
      owner: { login: string };
      private: boolean;
    };
    const fullName = repo.full_name;
    const defaultBranch = repo.default_branch || "main";

    // Seed the repo with the user's current identity content.
    const seed = (await ctx.runQuery(internal.github.internalGetSeedContent, {
      userId: context.userId,
    })) as {
      youMd: string | null;
      youJson: unknown;
      name: string | null;
      username: string | null;
      tagline: string | null;
    };

    const files = buildSeedFiles(seed);
    let lastSha: string | undefined;
    for (const file of files) {
      const putRes = await fetch(
        `${GITHUB_API}/repos/${fullName}/contents/${file.path}`,
        {
          method: "PUT",
          headers: {
            ...githubHeaders(token),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: `chore(you.md): seed ${file.path}`,
            content: base64Utf8(file.content),
            branch: defaultBranch,
          }),
        }
      );
      if (putRes.ok) {
        const body = (await putRes.json()) as { commit?: { sha?: string } };
        lastSha = body.commit?.sha ?? lastSha;
      }
      // Non-fatal: if one seed file fails the repo still exists and is linked.
    }

    await ctx.runMutation(internal.github.internalSetRepo, {
      connectionId: context.connectionId,
      userId: context.userId,
      repoFullName: fullName,
      repoVisibility: args.visibility,
      repoDefaultBranch: defaultBranch,
      lastSyncedSha: lastSha,
    });

    await ensureWebhook(ctx, context, token, fullName);
    await ctx.scheduler.runAfter(
      0,
      internal.githubRepo.internalMirrorForConnection,
      { clerkId: args.clerkId }
    );

    return {
      ok: true,
      created: true,
      repoFullName: fullName,
      visibility: args.visibility,
      defaultBranch,
      htmlUrl: repo.html_url,
    };
  },
});

/** Connect an existing repo the user already owns as their You.md repo. */
export const connectRepo = action({
  args: { clerkId: v.string(), repoFullName: v.string() },
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.clerkId);
    const { context, token } = await loadConnectionToken(ctx, args.clerkId, {
      requireRepoScope: true,
    });

    const res = await fetch(
      `${GITHUB_API}/repos/${args.repoFullName}`,
      { headers: githubHeaders(token) }
    );
    if (res.status === 404) {
      throw new Error("That repo doesn't exist or you don't have access to it.");
    }
    if (!res.ok) {
      throw new Error(`Could not read that repo (${res.status}).`);
    }
    const repo = (await res.json()) as {
      full_name: string;
      default_branch: string;
      html_url: string;
      private: boolean;
      permissions?: { push?: boolean };
    };
    if (repo.permissions?.push === false) {
      throw new Error("You need write access to connect a repo as your You.md.");
    }

    await ctx.runMutation(internal.github.internalSetRepo, {
      connectionId: context.connectionId,
      userId: context.userId,
      repoFullName: repo.full_name,
      repoVisibility: repo.private ? "private" : "public",
      repoDefaultBranch: repo.default_branch || "main",
    });

    await ensureWebhook(ctx, context, token, repo.full_name);
    await ctx.scheduler.runAfter(
      0,
      internal.githubRepo.internalMirrorForConnection,
      { clerkId: args.clerkId }
    );

    return {
      ok: true,
      created: false,
      repoFullName: repo.full_name,
      visibility: repo.private ? "private" : "public",
      defaultBranch: repo.default_branch || "main",
      htmlUrl: repo.html_url,
    };
  },
});

/**
 * Push the user's current compiled identity (you.md + you.json) to their linked
 * repo.
 *
 * Task 4 — routing:
 *  - When the connection has a GitHub App installation (installationId is set),
 *    the write is routed through agentPushViaPR with autoMerge: true. This
 *    creates a branch → PR → auto-merges it so every identity sync leaves a
 *    reviewable PR trail and the merge is atomic.
 *  - When no App installation exists, we fall back to the existing direct-push
 *    path (last-writer-wins PUT via the OAuth token). This keeps the existing
 *    behavior intact for users who haven't installed the GitHub App.
 */
export const pushToRepo = action({
  args: { clerkId: v.string(), _internalAuthToken: v.optional(v.string()) },
  handler: async (ctx, { clerkId, _internalAuthToken }) => {
    await requireOwner(ctx, clerkId, _internalAuthToken);
    const { context, token } = await loadConnectionToken(ctx, clerkId, {
      requireRepoScope: true,
    });
    if (!context.repoFullName) {
      throw new Error("No repo linked yet. Create or connect a repo first.");
    }
    const fullName = context.repoFullName;
    const branch = context.repoDefaultBranch || "main";

    const seed = (await ctx.runQuery(internal.github.internalGetSeedContent, {
      userId: context.userId,
    })) as {
      youMd: string | null;
      youJson: unknown;
      name: string | null;
      username: string | null;
      tagline: string | null;
    };

    if (!seed.youMd && seed.youJson == null) {
      throw new Error("Nothing to push yet — build your You.md first.");
    }

    const portfolioGraph = await ctx.runQuery(api.portfolio.listPortfolioGraph, {
      clerkId,
      _internalAuthToken,
      includeDoneTasks: false,
    }) as PortfolioRepoSnapshotGraph;

    const files: { path: string; content: string }[] = dedupeRepoFiles([
      { path: "you.md", content: seed.youMd ?? "" },
      { path: "you.json", content: JSON.stringify(seed.youJson ?? {}, null, 2) },
      ...customFilesFromYouJson(seed.youJson),
      ...buildPortfolioRepoSnapshotFiles(portfolioGraph),
    ]);

    // Autonomous management: route identity writes through agentPushViaPR
    // (branch → PR → auto-merge → conflict-resolve) for an auditable, conflict-
    // safe trail. Uses the GitHub App installation token when one exists, else
    // the OAuth `repo` token (which can create + merge PRs on the user's own
    // repo). This is the autonomous loop scoped to the {username}-you-md repo.
    // If the PR path fails for any reason, fall back to the direct-push path so
    // a sync is never lost.
    try {
      const prResult = await agentPushViaPR(ctx, {
        connectionId: context.connectionId,
        files,
        message: "chore(you.md): sync identity from you.md",
        autoMerge: true,
      });
      await ctx.runMutation(internal.github.internalMarkSynced, {
        connectionId: context.connectionId,
        repoSha: prResult.mergeCommitSha ?? undefined,
      });
      return {
        ok: true,
        pushed: files.map((f) => f.path),
        commitSha: prResult.mergeCommitSha ?? null,
        upToDate: false,
        via: "pr" as const,
        prNumber: prResult.prNumber,
        prUrl: prResult.prUrl,
        merged: prResult.merged,
        branchRecreated: prResult.branchRecreated,
        timeline: prResult.timeline,
      };
    } catch (prErr) {
      console.warn(
        "agentPushViaPR failed; falling back to direct push:",
        prErr instanceof Error ? prErr.message : String(prErr)
      );
    }

    // Direct push fallback (e.g. PR path unavailable).
    let commitSha: string | undefined;
    const pushed: string[] = [];
    const directTimeline: AgentPushTimelineEvent[] = [{
      key: "direct-push-fallback",
      label: "use direct push fallback",
      status: "success",
      detail: "PR route unavailable; writing changed files with GitHub contents API",
      metadata: { branch, fileCount: files.length },
    }];
    for (const file of files) {
      const existing = await getRepoFile(token, fullName, file.path, branch);
      // Skip writing if content is byte-identical (avoids empty commits).
      if (existing && existing.content === file.content) continue;
      commitSha =
        (await putRepoFile(
          token,
          fullName,
          file.path,
          file.content,
          branch,
          `chore(you.md): sync ${file.path} from you.md`,
          existing?.sha
        )) ?? commitSha;
      pushed.push(file.path);
    }
    directTimeline.push({
      key: "direct-push-files",
      label: "write changed files directly",
      status: "success",
      detail: pushed.length === 0 ? "repo already matched current identity files" : `wrote ${pushed.length} file${pushed.length === 1 ? "" : "s"}`,
      metadata: { branch, pushed, commitSha: commitSha ?? null },
    });

    await ctx.runMutation(internal.github.internalMarkSynced, {
      connectionId: context.connectionId,
      repoSha: commitSha,
    });

    return {
      ok: true,
      pushed,
      commitSha: commitSha ?? null,
      upToDate: pushed.length === 0,
      via: "direct" as const,
      timeline: directTimeline,
    };
  },
});

/**
 * Shared pull: read you.md + you.json out of the linked repo and save them as a
 * new bundle (repo is the source of truth on pull). Used by the owner-facing
 * `pullFromRepo` action and the webhook-driven `internalPullForConnection`.
 */
async function performPull(
  ctx: ActionCtx,
  clerkId: string
): Promise<{ ok: true; version: number; pulledFiles: string[] }> {
  const { context, token } = await loadConnectionToken(ctx, clerkId, {
    requireRepoScope: true,
  });
  if (!context.repoFullName) {
    throw new Error("No repo linked yet. Create or connect a repo first.");
  }
  const fullName = context.repoFullName;
  const branch = context.repoDefaultBranch || "main";

  const youMdFile = await getRepoFile(token, fullName, "you.md", branch);
  const youJsonFile = await getRepoFile(token, fullName, "you.json", branch);

  if (!youMdFile && !youJsonFile) {
    throw new Error(
      "No you.md or you.json found in the repo. Push first, or add them to the repo."
    );
  }

  let youJson: unknown = {};
  if (youJsonFile?.content) {
    try {
      youJson = JSON.parse(youJsonFile.content);
    } catch {
      throw new Error("you.json in the repo is not valid JSON.");
    }
  }

  const result = (await ctx.runMutation(
    internal.github.internalSaveBundleFromRepo,
    {
      userId: context.userId,
      connectionId: context.connectionId,
      youMd: youMdFile?.content ?? "",
      youJson,
      repoSha: youMdFile?.sha ?? youJsonFile?.sha,
    }
  )) as { version: number; contentHash: string };

  return {
    ok: true,
    version: result.version,
    pulledFiles: [
      youMdFile ? "you.md" : null,
      youJsonFile ? "you.json" : null,
    ].filter((x): x is string => x !== null),
  };
}

export const pullFromRepo = action({
  args: { clerkId: v.string() },
  handler: async (ctx, { clerkId }) => {
    await requireOwner(ctx, clerkId);
    return await performPull(ctx, clerkId);
  },
});

/**
 * Internal: webhook-driven pull. Called (via the scheduler) from the GitHub
 * webhook route when an external push lands on the linked repo's default
 * branch. No requireOwner — internal functions are server-only.
 */
export const internalPullForConnection = internalAction({
  args: { clerkId: v.string() },
  handler: async (ctx, { clerkId }) => {
    try {
      return await performPull(ctx, clerkId);
    } catch {
      // Best-effort: a webhook for a repo without you.md yet is not an error.
      return { ok: false as const };
    }
  },
});

/**
 * Best-effort: ensure a push webhook exists on the repo so external commits
 * auto-pull. Requires GITHUB_WEBHOOK_SECRET + a reachable Convex site URL.
 * Failures (e.g. missing hook scope) are swallowed — sync still works via the
 * manual pull button.
 */
async function ensureWebhook(
  ctx: ActionCtx,
  context: ConnectionContext,
  token: string,
  repoFullName: string
): Promise<void> {
  if (context.webhookId) return; // already registered
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  const siteUrl = process.env.CONVEX_SITE_URL;
  if (!secret || !siteUrl || !repoFullName) return;

  try {
    const res = await fetch(
      `${GITHUB_API}/repos/${repoFullName}/hooks`,
      {
        method: "POST",
        headers: { ...githubHeaders(token), "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "web",
          active: true,
          events: ["push"],
          config: {
            url: `${siteUrl}/api/github/webhook`,
            content_type: "json",
            secret,
            insecure_ssl: "0",
          },
        }),
      }
    );
    if (res.ok) {
      const hook = (await res.json()) as { id?: number };
      if (hook.id) {
        await ctx.runMutation(internal.github.internalSetWebhook, {
          connectionId: context.connectionId,
          webhookId: hook.id,
        });
      }
    }
  } catch {
    // swallow — webhook is an enhancement, not required
  }
}

/**
 * Shared mirror: snapshot the repo tree (identity files + stacks/**) into the
 * repoMirror table so API/MCP can read from our servers. Bounded by caps.
 */
async function performMirror(
  ctx: ActionCtx,
  clerkId: string
): Promise<{ ok: true; fileCount: number; truncated: boolean }> {
  const { context, token } = await loadConnectionToken(ctx, clerkId, {
    requireRepoScope: true,
  });
  if (!context.repoFullName) {
    throw new Error("No repo linked yet. Create or connect a repo first.");
  }
  const fullName = context.repoFullName;
  const branch = context.repoDefaultBranch || "main";

  // Resolve head commit + its tree.
  const commitRes = await fetch(
    `${GITHUB_API}/repos/${fullName}/commits/${encodeURIComponent(branch)}`,
    { headers: githubHeaders(token) }
  );
  if (!commitRes.ok) {
    throw new Error(`Could not read the repo head (${commitRes.status}).`);
  }
  const commit = (await commitRes.json()) as {
    sha: string;
    commit: { tree: { sha: string } };
  };
  const treeSha = commit.commit.tree.sha;

  const treeRes = await fetch(
    `${GITHUB_API}/repos/${fullName}/git/trees/${treeSha}?recursive=1`,
    { headers: githubHeaders(token) }
  );
  if (!treeRes.ok) {
    throw new Error(`Could not read the repo tree (${treeRes.status}).`);
  }
  const tree = (await treeRes.json()) as {
    tree: Array<{ path: string; type: string; sha: string; size?: number }>;
  };

  const candidates = tree.tree.filter(
    (e) =>
      e.type === "blob" &&
      isMirrorablePath(e.path) &&
      (e.size ?? 0) <= MIRROR_MAX_FILE_BYTES
  );

  const files: { path: string; content: string; size: number }[] = [];
  let totalBytes = 0;
  let truncated = candidates.length > MIRROR_MAX_FILES;
  for (const entry of candidates) {
    if (files.length >= MIRROR_MAX_FILES) {
      truncated = true;
      break;
    }
    const content = await getRepoBlob(token, fullName, entry.sha);
    if (content == null) continue;
    const size = entry.size ?? content.length;
    if (totalBytes + size > MIRROR_MAX_TOTAL_BYTES) {
      truncated = true;
      break;
    }
    files.push({ path: entry.path, content, size });
    totalBytes += size;
  }

  await ctx.runMutation(internal.github.internalUpsertMirror, {
    userId: context.userId,
    repoFullName: fullName,
    commitSha: commit.sha,
    files,
    truncated,
  });

  return { ok: true, fileCount: files.length, truncated };
}

/** Owner-facing: refresh the server-side mirror of the linked repo. */
export const syncMirror = action({
  args: { clerkId: v.string(), _internalAuthToken: v.optional(v.string()) },
  handler: async (ctx, { clerkId, _internalAuthToken }) => {
    await requireOwner(ctx, clerkId, _internalAuthToken);
    return await performMirror(ctx, clerkId);
  },
});

/** Internal: webhook/post-create mirror refresh (server-only, no requireOwner). */
export const internalMirrorForConnection = internalAction({
  args: { clerkId: v.string() },
  handler: async (ctx, { clerkId }) => {
    try {
      return await performMirror(ctx, clerkId);
    } catch {
      return { ok: false as const };
    }
  },
});
