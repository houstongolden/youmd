/**
 * P21 — canonical HTTP error envelope tests (PRODUCT-AUDIT #23).
 *
 * Pins the contract every error return in convex/http.ts now follows:
 *
 *   { "error": { "code": "<machine_code>", "message": "<human text>" },
 *     "message": "<human text>" }
 *
 * plus legacy extra top-level keys (e.g. `success: false`) preserved
 * alongside the envelope.
 *
 * NOTE (same gap as memories.test.ts): convex-test does not execute
 * httpRouter routes, so the httpAction request->response path is not run
 * end-to-end here. Instead we test the exact helper calls the routes make —
 * errorResponse() builds the full Response (status + CORS headers + body) —
 * including the precise envelope the memories/auth routes return for an
 * unauthorized request (authenticateRequest's 401).
 */
import { describe, expect, it, vi } from "vitest";

import { errorEnvelope, sanitizedServerErrorEnvelope, ERROR_CODES } from "./lib/httpErrors";
import { codeForStatus, errorResponse } from "./http";

/**
 * Mirror of the published CLI's parser (cli/src/lib/api.ts apiErrorMessage).
 * The CLI cannot be edited in this lane, so the envelope must stay parseable
 * by this exact logic: it only returns `data.error` when it is a string, and
 * callers fall back to "server returned <status>" otherwise.
 */
function cliApiErrorMessage(data: unknown): string | undefined {
  if (data && typeof data === "object" && "error" in data) {
    const msg = (data as { error?: unknown }).error;
    if (typeof msg === "string" && msg) return msg;
  }
  return undefined;
}

describe("errorEnvelope", () => {
  it("produces the canonical { error: { code, message }, message } shape", () => {
    const body = errorEnvelope("not_found", "Profile not found");
    expect(body).toEqual({
      error: { code: "not_found", message: "Profile not found" },
      message: "Profile not found",
    });
  });

  it("mirrors error.message at the top level (CLI back-compat)", () => {
    const body = errorEnvelope(ERROR_CODES.rateLimited, "rate limit exceeded");
    expect(body.message).toBe(body.error.message);
  });

  it("keeps extra legacy top-level fields alongside the envelope", () => {
    const body = errorEnvelope("server_error", "Scrape failed", {
      success: false,
      retryAfterSeconds: 30,
    });
    expect(body.success).toBe(false);
    expect(body.retryAfterSeconds).toBe(30);
    expect(body.error).toEqual({ code: "server_error", message: "Scrape failed" });
    expect(body.message).toBe("Scrape failed");
  });

  it("never lets extra fields clobber the envelope keys", () => {
    const body = errorEnvelope("forbidden", "nope", {
      error: "legacy string",
      message: "legacy message",
    } as Record<string, unknown>);
    expect(body.error).toEqual({ code: "forbidden", message: "nope" });
    expect(body.message).toBe("nope");
  });

  it("uses the pre-existing scope_missing code verbatim", () => {
    expect(ERROR_CODES.scopeMissing).toBe("scope_missing");
    const body = errorEnvelope(
      ERROR_CODES.scopeMissing,
      "API key lacks required scope: write:bundle"
    );
    expect(body.error.code).toBe("scope_missing");
  });
});

describe("errorResponse (http.ts route helper)", () => {
  it("returns the requested status with the envelope body", async () => {
    const res = errorResponse("invalid_request", "Username parameter required", 400);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toEqual({
      error: { code: "invalid_request", message: "Username parameter required" },
      message: "Username parameter required",
    });
  });

  it("keeps CORS + content-type headers identical to json()", () => {
    const res = errorResponse("server_error", "boom", 500);
    expect(res.headers.get("Content-Type")).toBe("application/json");
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(res.headers.get("Access-Control-Allow-Methods")).toContain("GET");
  });

  it("merges extra body fields and extra headers", async () => {
    const res = errorResponse(
      "rate_limited",
      "rate limit exceeded",
      429,
      { success: false },
      { "Cache-Control": "private, no-store, max-age=0" }
    );
    expect(res.status).toBe(429);
    expect(res.headers.get("Cache-Control")).toBe("private, no-store, max-age=0");
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("rate_limited");
  });

  it("unauthorized memories/me route path produces the envelope (route-level error contract)", async () => {
    // Exact call made by authenticateRequest() for every authenticated route
    // (memories search, /api/v1/me, bundles, ...) when the Bearer header is
    // missing — the most common route-level error path.
    const res = errorResponse("unauthorized", "Missing or invalid Authorization header", 401);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toEqual({
      code: "unauthorized",
      message: "Missing or invalid Authorization header",
    });
    expect(body.message).toBe("Missing or invalid Authorization header");
  });

  it("stays parseable by the published CLI (apiErrorMessage falls back, message mirror available)", async () => {
    const res = errorResponse("not_found", "User not found", 404);
    const body = await res.json();
    // The shipped CLI returns undefined for the object form and falls back to
    // its own "server returned 404" message — degraded but never broken.
    expect(cliApiErrorMessage(body)).toBeUndefined();
    // The top-level mirror keeps a human string available for legacy readers.
    expect(typeof body.message).toBe("string");
    expect(body.message).toBe("User not found");
  });
});

describe("sanitizedServerErrorEnvelope (T13 — no internal leakage on 500s)", () => {
  it("never puts err.message, stack, or class detail in the client body", () => {
    const log = vi.fn();
    const internalErr = new Error(
      'Uncaught Error: db.query("apiKeys").withIndex("by_secret_hash") failed at convex/lib/auth.ts:42'
    );

    const body = sanitizedServerErrorEnvelope("me/keys", internalErr, "Failed to create API key", undefined, log);

    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain("db.query");
    expect(serialized).not.toContain("convex/lib/auth.ts");
    expect(serialized).not.toContain(internalErr.message);
    expect(body).toEqual({
      error: { code: "server_error", message: "Failed to create API key" },
      message: "Failed to create API key",
    });
  });

  it("keeps the machine-readable server_error code", () => {
    const body = sanitizedServerErrorEnvelope("chat", new Error("boom"), "Chat failed", undefined, vi.fn());
    expect(body.error.code).toBe(ERROR_CODES.serverError);
  });

  it("logs the real error server-side with the route context", () => {
    const log = vi.fn();
    const err = new Error("OPENROUTER_API_KEY invalid");

    sanitizedServerErrorEnvelope("chat/stream", err, "Stream failed", undefined, log);

    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0][0]).toContain("chat/stream");
    expect(log.mock.calls[0]).toContain(err);
  });

  it("preserves legacy extra top-level fields (success: false routes)", () => {
    const body = sanitizedServerErrorEnvelope("scrape", new Error("apify token leaked?"), "Scrape failed", { success: false }, vi.fn());
    expect(body.success).toBe(false);
    expect(body.message).toBe("Scrape failed");
    expect(JSON.stringify(body)).not.toContain("apify");
  });

  it("handles non-Error throwables without leaking them", () => {
    const log = vi.fn();
    const body = sanitizedServerErrorEnvelope("me/vault/init", "raw string with secret=abc123", "Failed to initialize vault", undefined, log);
    expect(JSON.stringify(body)).not.toContain("abc123");
    expect(log).toHaveBeenCalled();
  });
});

describe("codeForStatus", () => {
  it("maps well-known statuses to machine codes", () => {
    expect(codeForStatus(401)).toBe("unauthorized");
    expect(codeForStatus(403)).toBe("forbidden");
    expect(codeForStatus(404)).toBe("not_found");
    expect(codeForStatus(409)).toBe("conflict");
    expect(codeForStatus(410)).toBe("gone");
    expect(codeForStatus(413)).toBe("payload_too_large");
    expect(codeForStatus(429)).toBe("rate_limited");
    expect(codeForStatus(500)).toBe("server_error");
    expect(codeForStatus(503)).toBe("server_error");
    expect(codeForStatus(400)).toBe("invalid_request");
    expect(codeForStatus(422)).toBe("invalid_request");
  });
});
