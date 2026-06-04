/**
 * GitHub OAuth helpers for the web app.
 *
 * Free GitHub sign-up uses a GitHub OAuth App. Register one at
 * https://github.com/settings/developers (or an org's developer settings) with
 * the Authorization callback URL set to `<app>/api/auth/github/callback`, then
 * configure:
 *   - GITHUB_OAUTH_CLIENT_ID
 *   - GITHUB_OAUTH_CLIENT_SECRET
 *   - GITHUB_OAUTH_SCOPES (optional; defaults to "read:user user:email repo")
 *
 * The `repo` scope lets us create/read/write the user's You.md repo (public or
 * private) and clone it server-side for the agentic/API/MCP surfaces. To offer
 * login without repo access, set GITHUB_OAUTH_SCOPES="read:user user:email".
 */

export const GITHUB_OAUTH_STATE_COOKIE = "youmd_gh_oauth_state";

export const DEFAULT_GITHUB_SCOPES = "read:user user:email repo";

export function getGithubOAuthConfig() {
  const clientId = process.env.GITHUB_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.GITHUB_OAUTH_CLIENT_SECRET?.trim();
  const scopes = process.env.GITHUB_OAUTH_SCOPES?.trim() || DEFAULT_GITHUB_SCOPES;
  return { clientId, clientSecret, scopes };
}

export function isGithubOAuthConfigured(): boolean {
  const { clientId, clientSecret } = getGithubOAuthConfig();
  return !!clientId && !!clientSecret;
}

export function getAppUrl(): string {
  return (
    process.env.AUTH_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.AUTH_ISSUER_URL?.trim() ||
    (process.env.NODE_ENV === "development"
      ? "http://localhost:3100"
      : "https://you.md")
  );
}

export function getRedirectUri(): string {
  return `${getAppUrl()}/api/auth/github/callback`;
}

export function buildAuthorizeUrl(state: string): string {
  const { clientId, scopes } = getGithubOAuthConfig();
  const params = new URLSearchParams({
    client_id: clientId || "",
    redirect_uri: getRedirectUri(),
    scope: scopes,
    state,
    allow_signup: "true",
  });
  return `https://github.com/login/oauth/authorize?${params.toString()}`;
}

export type GithubTokenResult = {
  accessToken: string;
  tokenType: string;
  scopes: string[];
};

export async function exchangeCodeForToken(
  code: string
): Promise<GithubTokenResult> {
  const { clientId, clientSecret } = getGithubOAuthConfig();
  const res = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: getRedirectUri(),
    }),
  });

  if (!res.ok) {
    throw new Error(`GitHub token exchange failed (${res.status}).`);
  }

  const data = (await res.json()) as {
    access_token?: string;
    token_type?: string;
    scope?: string;
    error?: string;
    error_description?: string;
  };

  if (data.error || !data.access_token) {
    throw new Error(
      data.error_description || data.error || "GitHub did not return a token."
    );
  }

  return {
    accessToken: data.access_token,
    tokenType: data.token_type || "bearer",
    scopes: (data.scope || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  };
}

export type GithubIdentity = {
  githubUserId: number;
  githubLogin: string;
  githubName?: string;
  githubEmail?: string;
  githubAvatarUrl?: string;
};

export async function fetchGithubIdentity(
  accessToken: string
): Promise<GithubIdentity> {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "you.md-oauth",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  const userRes = await fetch("https://api.github.com/user", { headers });
  if (!userRes.ok) {
    throw new Error(`Failed to read GitHub profile (${userRes.status}).`);
  }
  const user = (await userRes.json()) as {
    id: number;
    login: string;
    name?: string | null;
    email?: string | null;
    avatar_url?: string | null;
  };

  let email = user.email || undefined;
  if (!email) {
    // The /user endpoint omits email when it's private; the emails endpoint
    // (requires user:email scope) returns the verified primary instead.
    try {
      const emailRes = await fetch("https://api.github.com/user/emails", {
        headers,
      });
      if (emailRes.ok) {
        const emails = (await emailRes.json()) as Array<{
          email: string;
          primary: boolean;
          verified: boolean;
        }>;
        const primary =
          emails.find((e) => e.primary && e.verified) ||
          emails.find((e) => e.verified);
        if (primary) email = primary.email;
      }
    } catch {
      // Best-effort; signup can proceed with a noreply fallback.
    }
  }

  return {
    githubUserId: user.id,
    githubLogin: user.login,
    githubName: user.name || undefined,
    githubEmail: email,
    githubAvatarUrl: user.avatar_url || undefined,
  };
}
