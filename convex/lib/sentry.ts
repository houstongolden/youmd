/**
 * Sentry error reporting stub — gated on SENTRY_DSN env var.
 *
 * Drop a DSN via `npx convex env set SENTRY_DSN <dsn>` and errors
 * automatically start flowing to Sentry. No SDK dependency — minimal
 * envelope hand-built against the Sentry Store API.
 *
 * Sentry Store endpoint: POST https://<host>/api/<project_id>/store/
 * Auth: X-Sentry-Auth header with public key extracted from the DSN.
 *
 * Failures are ALWAYS swallowed — Sentry being unreachable must never
 * break a user request.
 */

export interface SentryContext {
  route?: string;
  code?: string;
  status?: number;
  [key: string]: unknown;
}

interface ReportArgs {
  error: unknown;
  context?: SentryContext;
}

/** DSN shape: https://<public_key>@<host>/<project_id> */
function parseDsn(dsn: string): { storeUrl: string; authHeader: string } | null {
  try {
    const url = new URL(dsn);
    const publicKey = url.username;
    const projectId = url.pathname.replace(/^\//, "");
    if (!publicKey || !projectId) return null;
    const storeUrl = `${url.protocol}//${url.host}/api/${projectId}/store/`;
    const authHeader =
      `Sentry sentry_version=7, sentry_client=youmd/1.0, sentry_key=${publicKey}`;
    return { storeUrl, authHeader };
  } catch {
    return null;
  }
}

// Module-level parsed DSN — evaluated once at first call.
let _parsed: ReturnType<typeof parseDsn> | undefined;
let _disabledLogged = false;

function getConfig() {
  if (_parsed !== undefined) return _parsed;
  const dsn = process.env.SENTRY_DSN ?? "";
  if (!dsn) {
    _parsed = null;
    return null;
  }
  _parsed = parseDsn(dsn);
  return _parsed;
}

/**
 * Fire-and-forget Sentry report. Never throws. Returns the fetch promise
 * (resolved/rejected) only so tests can await it; callers must NOT await.
 */
export function reportToSentry({ error, context }: ReportArgs): Promise<void> {
  const config = getConfig();
  if (!config) {
    if (!_disabledLogged) {
      _disabledLogged = true;
      console.warn("[sentry] SENTRY_DSN not set — error reporting disabled");
    }
    return Promise.resolve();
  }

  const message =
    error instanceof Error ? error.message : String(error);

  const envelope = JSON.stringify({
    event_id: crypto.randomUUID().replace(/-/g, ""),
    timestamp: new Date().toISOString(),
    level: "error",
    message,
    extra: context ?? {},
    tags: { source: "convex-http" },
  });

  return fetch(config.storeUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Sentry-Auth": config.authHeader,
    },
    body: envelope,
    signal: AbortSignal.timeout(3000),
  })
    .then(() => undefined)
    .catch(() => undefined); // swallow — Sentry down must not break callers
}
