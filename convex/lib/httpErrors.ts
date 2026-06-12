/**
 * P21 — canonical HTTP API error envelope (PRODUCT-AUDIT #23, FEATURE-ROADMAP 3.1).
 *
 * Every error response from convex/http.ts uses one machine-readable shape:
 *
 *   {
 *     "error": { "code": "<machine_code>", "message": "<human text>" },
 *     "message": "<human text>"   // top-level mirror — CLI back-compat
 *   }
 *
 * The `error.code` / `error.message` object matches the precedent set by
 * requireScope's `scope_missing` envelope. The top-level `message` mirror
 * exists because the published CLI (cli/src/lib/api.ts apiErrorMessage)
 * only reads `data.error` when it is a STRING — with the object form it
 * falls back to its generic "server returned <status>" message. The mirror
 * keeps a human string available at the top level for that and any other
 * legacy consumer; new consumers should read `error.code` + `error.message`.
 *
 * Routes that historically carried extra top-level keys (e.g. `success:
 * false`, `available`, `retryAfterSeconds`) keep them via `extra` so
 * existing callers don't break.
 */

/** Well-known machine codes. Use these instead of ad-hoc strings. */
export const ERROR_CODES = {
  unauthorized: "unauthorized",
  forbidden: "forbidden",
  /** Pre-existing code emitted by requireScope — do not rename. */
  scopeMissing: "scope_missing",
  notFound: "not_found",
  invalidRequest: "invalid_request",
  gone: "gone",
  payloadTooLarge: "payload_too_large",
  rateLimited: "rate_limited",
  conflict: "conflict",
  upstreamUnavailable: "upstream_unavailable",
  notConfigured: "not_configured",
  serverError: "server_error",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES] | (string & {});

export type ErrorEnvelope = {
  error: { code: string; message: string };
  /** Top-level human-readable mirror of error.message (CLI back-compat). */
  message: string;
  [key: string]: unknown;
};

/**
 * Build the canonical error envelope body. Extra top-level fields (legacy
 * keys like `success: false` or `retryAfterSeconds`) are spread alongside
 * the envelope — they can never clobber `error` or `message`.
 */
export function errorEnvelope(
  code: ErrorCode,
  message: string,
  extra?: Record<string, unknown>
): ErrorEnvelope {
  return {
    ...extra,
    error: { code, message },
    message,
  };
}

/**
 * T13 — sanitized 500s (TECH-STACK-AUDIT).
 *
 * Internal errors must never reach clients: err.message can carry stack
 * fragments, table names, env hints, or upstream provider detail. This
 * builds the canonical `server_error` envelope with a generic, route-scoped
 * public message and logs the REAL error server-side (Convex log stream)
 * tagged with the route context so it stays debuggable.
 *
 * `log` is injectable for tests; production callers use the default
 * console.error.
 */
export function sanitizedServerErrorEnvelope(
  context: string,
  err: unknown,
  publicMessage: string,
  extra?: Record<string, unknown>,
  log: (...args: unknown[]) => void = console.error
): ErrorEnvelope {
  log(`[http:${context}] internal error:`, err);
  return errorEnvelope(ERROR_CODES.serverError, publicMessage, extra);
}
