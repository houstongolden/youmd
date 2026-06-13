/**
 * Sentry stub tests — pins the no-op / fire-and-forget behaviour.
 *
 * We test the module's exported `reportToSentry` helper directly by
 * controlling `process.env.SENTRY_DSN` and mocking `global.fetch`.
 * convex-test is not needed; no DB operations are involved.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Reset module state between tests so the lazy DSN parse re-runs.
// We import via a dynamic re-import inside each test to get a fresh module.

async function freshModule(dsn?: string) {
  vi.resetModules();
  if (dsn !== undefined) {
    process.env.SENTRY_DSN = dsn;
  } else {
    delete process.env.SENTRY_DSN;
  }
  const mod = await import("./lib/sentry");
  return mod;
}

describe("reportToSentry — SENTRY_DSN absent", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.SENTRY_DSN;
  });

  it("returns immediately without calling fetch", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response());
    const { reportToSentry } = await freshModule();

    await reportToSentry({ error: new Error("boom") });

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("does not throw when SENTRY_DSN is empty string", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response());
    const { reportToSentry } = await freshModule("");

    await expect(reportToSentry({ error: "raw string" })).resolves.toBeUndefined();
  });
});

describe("reportToSentry — SENTRY_DSN present", () => {
  const TEST_DSN = "https://abcdef1234567890@o123456.ingest.sentry.io/9999999";

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    delete process.env.SENTRY_DSN;
    vi.restoreAllMocks();
  });

  it("POSTs to the correct Sentry store URL", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("ok"));
    const { reportToSentry } = await freshModule(TEST_DSN);

    await reportToSentry({ error: new Error("test error"), context: { route: "me/keys" } });

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url] = fetchSpy.mock.calls[0] as [string, ...unknown[]];
    expect(url).toBe("https://o123456.ingest.sentry.io/api/9999999/store/");
  });

  it("sends a valid Sentry envelope with expected fields", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("ok"));
    const { reportToSentry } = await freshModule(TEST_DSN);

    await reportToSentry({
      error: new Error("envelope check"),
      context: { route: "chat", code: "server_error", status: 500 },
    });

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);

    expect(typeof body.event_id).toBe("string");
    expect(body.event_id).toHaveLength(32); // UUID without hyphens
    expect(body.level).toBe("error");
    expect(body.message).toBe("envelope check");
    expect(body.tags).toEqual({ source: "convex-http" });
    expect(body.extra.route).toBe("chat");
    expect(body.extra.code).toBe("server_error");
    expect(body.extra.status).toBe(500);
  });

  it("swallows network failures — never throws to the caller", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"));
    const { reportToSentry } = await freshModule(TEST_DSN);

    await expect(
      reportToSentry({ error: new Error("something bad") })
    ).resolves.toBeUndefined();
  });

  it("passes an AbortSignal so callers are not blocked beyond 3 s", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("ok"));
    const { reportToSentry } = await freshModule(TEST_DSN);

    await reportToSentry({ error: new Error("timeout check") });

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(init.signal).toBeDefined();
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });
});
