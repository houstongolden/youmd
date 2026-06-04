import { action, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { ActionCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireOwner } from "./lib/auth";
import { decryptSecret } from "./lib/secretCrypto";

/**
 * GitHub repo actions (Phase 2): create or connect the user's own You.md repo
 * — public or private — from the web shell. These are Convex actions so the
 * decrypted OAuth token never leaves the Convex trust boundary; the browser
 * only ever calls them with the authenticated user's identity (requireOwner).
 *
 * The repo becomes the source of truth for the user's identity `.md` + stacks;
 * later phases pull/compile it and mirror it server-side for API/MCP.
 */

const DEFAULT_REPO_NAME = "you-md";
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
};

function githubHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "you.md-app",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

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
  if (path === "you.md" || path === "you.json" || path === "README.md") return true;
  if (path.startsWith("stacks/")) return true;
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

/** Build the starter files for a freshly created repo. */
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

This repository is **${handle}**'s [You.md](https://you.md) — a portable agent
brain. The Markdown here is the source of truth for ${handle}'s identity context
and expertise stacks. AI agents read it so they don't start from scratch.

- Public profile: https://you.md/${handle}
- Edit on the web: https://you.md/shell
- Learn more: https://you.md

## Layout

| Path | What it is |
|---|---|
| \`you.md\` | The compiled identity context (human + agent readable) |
| \`you.json\` | The structured identity bundle |
| \`stacks/\` | Named YouStacks (one folder per stack) |

> Managed by You.md. Edits here sync back to your You.md account.
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

  return [
    { path: "README.md", content: readme },
    { path: "you.md", content: youMd },
    { path: "you.json", content: youJson },
    {
      path: "stacks/.gitkeep",
      content: "# YouStacks live here. One folder per named stack.\n",
    },
  ];
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

    const repoName = sanitizeRepoName(args.name);

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
 * repo. Last-writer-wins: we read each file's current sha and update it.
 */
export const pushToRepo = action({
  args: { clerkId: v.string() },
  handler: async (ctx, { clerkId }) => {
    await requireOwner(ctx, clerkId);
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

    const files: { path: string; content: string }[] = [
      { path: "you.md", content: seed.youMd ?? "" },
      { path: "you.json", content: JSON.stringify(seed.youJson ?? {}, null, 2) },
    ];

    let commitSha: string | undefined;
    const pushed: string[] = [];
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

    await ctx.runMutation(internal.github.internalMarkSynced, {
      connectionId: context.connectionId,
      repoSha: commitSha,
    });

    return { ok: true, pushed, commitSha: commitSha ?? null, upToDate: pushed.length === 0 };
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
  args: { clerkId: v.string() },
  handler: async (ctx, { clerkId }) => {
    await requireOwner(ctx, clerkId);
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
