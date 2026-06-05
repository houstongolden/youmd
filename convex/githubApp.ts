/**
 * GitHub App support (Phase 5) — optional, additive hardening of the OAuth
 * flow. When a GitHub App is configured AND a connection has an installation
 * id, repo operations use short-lived, fine-grained installation tokens
 * (least-privilege, per-repo) instead of the broad OAuth `repo` token.
 *
 * Configure on the Convex deployment:
 *   - GITHUB_APP_ID                 (numeric app id)
 *   - GITHUB_APP_PRIVATE_KEY_PEM    (PKCS#8 PEM — see note below)
 *
 * NOTE: GitHub issues App private keys in PKCS#1 ("BEGIN RSA PRIVATE KEY").
 * Web Crypto only imports PKCS#8 ("BEGIN PRIVATE KEY"). Convert once:
 *   openssl pkcs8 -topk8 -inform PEM -outform PEM -nocrypt \
 *     -in app.private-key.pem -out app.pkcs8.pem
 * and set GITHUB_APP_PRIVATE_KEY_PEM to the PKCS#8 output.
 */

const GITHUB_API = "https://api.github.com";

export function isGithubAppConfigured(): boolean {
  return (
    !!process.env.GITHUB_APP_ID?.trim() &&
    !!process.env.GITHUB_APP_PRIVATE_KEY_PEM?.trim()
  );
}

function base64UrlFromString(input: string): string {
  return btoa(input).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlFromBytes(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const normalized = pem.replace(/\\n/g, "\n");
  if (/BEGIN RSA PRIVATE KEY/.test(normalized)) {
    throw new Error(
      "GITHUB_APP_PRIVATE_KEY_PEM is PKCS#1. Convert it to PKCS#8 with " +
        "`openssl pkcs8 -topk8 -nocrypt -in app.pem -out app.pkcs8.pem`."
    );
  }
  const b64 = normalized
    .replace(/-----BEGIN [^-]+-----/, "")
    .replace(/-----END [^-]+-----/, "")
    .replace(/\s+/g, "");
  const bin = atob(b64);
  const buf = new ArrayBuffer(bin.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < bin.length; i += 1) view[i] = bin.charCodeAt(i);
  return buf;
}

/** Sign a short-lived (≈9 min) RS256 app JWT for GitHub App authentication. */
async function signAppJwt(): Promise<string> {
  const appId = process.env.GITHUB_APP_ID?.trim();
  const pem = process.env.GITHUB_APP_PRIVATE_KEY_PEM;
  if (!appId || !pem) throw new Error("GitHub App is not configured.");

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(pem),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlFromString(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64UrlFromString(
    JSON.stringify({ iat: now - 30, exp: now + 540, iss: appId })
  );
  const signingInput = `${header}.${payload}`;
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(signingInput)
  );
  return `${signingInput}.${base64UrlFromBytes(new Uint8Array(signature))}`;
}

/**
 * Mint a short-lived installation access token for the given installation id.
 * Throws if the App is not configured or GitHub rejects the request.
 */
export async function mintInstallationToken(
  installationId: number
): Promise<string> {
  const jwt = await signAppJwt();
  const res = await fetch(
    `${GITHUB_API}/app/installations/${installationId}/access_tokens`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "you.md-app",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    }
  );
  if (!res.ok) {
    throw new Error(`Failed to mint GitHub App installation token (${res.status}).`);
  }
  const body = (await res.json()) as { token?: string };
  if (!body.token) throw new Error("GitHub App did not return an installation token.");
  return body.token;
}
