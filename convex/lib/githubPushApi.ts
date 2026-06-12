/**
 * P17 — thin GitHub REST wrapper used by the auto-push action
 * (convex/githubAutoPush.ts).
 *
 * Deliberately the ONLY place the auto-push path talks to api.github.com:
 * convex-test cannot make real GitHub calls, so tests vi.mock this module and
 * exercise the orchestration (debounce → push → mark synced / retry) against
 * the mock. Mirrors the equivalent private helpers in convex/githubRepo.ts
 * (which are owned by the manual push/pull actions and not exported).
 */

const GITHUB_API = "https://api.github.com";

function githubHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "you.md-app",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

function base64Utf8(input: string): string {
  // btoa needs a binary string; encode UTF-8 first so non-ASCII survives.
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

/**
 * Resolve the current head commit sha of a branch. Returns null when the
 * branch/repo is empty (409) or missing (404/422) — callers treat "no head"
 * as "nothing to diverge from".
 */
export async function fetchRepoHeadSha(
  token: string,
  fullName: string,
  branch: string
): Promise<string | null> {
  const res = await fetch(
    `${GITHUB_API}/repos/${fullName}/commits/${encodeURIComponent(branch)}`,
    { headers: githubHeaders(token) }
  );
  if (res.status === 404 || res.status === 409 || res.status === 422) {
    return null;
  }
  if (!res.ok) {
    throw new Error(`Could not read the repo head (${res.status}).`);
  }
  const body = (await res.json()) as { sha?: string };
  return body.sha ?? null;
}

/** Read a single file from a repo. Returns null on 404. */
export async function fetchRepoFile(
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

/** Create or update a single file. Returns the resulting commit sha. */
export async function putRepoFile(
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
