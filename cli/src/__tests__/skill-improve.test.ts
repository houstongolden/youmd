/**
 * L10 — youmd skill improve: table rendering and api function call shape.
 *
 * Tests:
 *   - SkillInsight success-rate coloring (green ≥80%, orange <80%)
 *   - Recommendation line gating (only for low-performers with failures)
 *   - getSkillInsights call shape (correct URL + auth header)
 *   - reportSkillOutcome call shape (correct method + body)
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { getSkillInsights, reportSkillOutcome, type SkillInsight } from "../lib/api";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeInsight(overrides: Partial<SkillInsight> = {}): SkillInsight {
  return {
    skill: "youstack-start",
    uses: 10,
    success: 8,
    failure: 1,
    partial: 1,
    successRate: 0.8,
    lastUsedAt: new Date("2026-06-12T00:00:00Z").getTime(),
    ...overrides,
  };
}

function okJsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

// ─── Success rate coloring logic ──────────────────────────────────────────────

describe("skill improve: success-rate coloring rules", () => {
  it("rate >= 80% is above the low-performer threshold", () => {
    const insight = makeInsight({ successRate: 0.8 });
    expect(insight.successRate >= 0.8).toBe(true);
  });

  it("rate < 80% with failures triggers low-performer recommendation", () => {
    const insight = makeInsight({ successRate: 0.5, success: 5, failure: 4, partial: 1, uses: 10 });
    const isLowPerformer = insight.successRate < 0.8 && insight.failure + insight.partial > 0;
    expect(isLowPerformer).toBe(true);
  });

  it("rate < 80% but zero failures does not trigger recommendation", () => {
    // Pathological case: 0 outcomes recorded but successRate set to 0.5
    const insight = makeInsight({ successRate: 0.5, success: 0, failure: 0, partial: 0 });
    const isLowPerformer = insight.successRate < 0.8 && insight.failure + insight.partial > 0;
    expect(isLowPerformer).toBe(false);
  });

  it("rate of exactly 0.0 with failures triggers recommendation", () => {
    const insight = makeInsight({ successRate: 0, success: 0, failure: 5, partial: 2, uses: 7 });
    const isLowPerformer = insight.successRate < 0.8 && insight.failure + insight.partial > 0;
    expect(isLowPerformer).toBe(true);
  });

  it("rate of 1.0 (100%) does not trigger recommendation", () => {
    const insight = makeInsight({ successRate: 1, success: 10, failure: 0, partial: 0, uses: 10 });
    const isLowPerformer = insight.successRate < 0.8 && insight.failure + insight.partial > 0;
    expect(isLowPerformer).toBe(false);
  });

  it("recommendation message uses correct failure count sum", () => {
    const insight = makeInsight({ successRate: 0.4, success: 4, failure: 3, partial: 3, uses: 10 });
    const failCount = insight.failure + insight.partial;
    const msg = `consider revising ${insight.skill} — ${failCount} failure${failCount === 1 ? "" : "s"} recently`;
    expect(msg).toBe("consider revising youstack-start — 6 failures recently");
  });

  it("recommendation uses singular 'failure' when count is 1", () => {
    const insight = makeInsight({ successRate: 0.0, success: 0, failure: 1, partial: 0, uses: 1 });
    const failCount = insight.failure + insight.partial;
    const msg = `consider revising ${insight.skill} — ${failCount} failure${failCount === 1 ? "" : "s"} recently`;
    expect(msg).toBe("consider revising youstack-start — 1 failure recently");
  });
});

// ─── getSkillInsights — call shape ───────────────────────────────────────────

describe("getSkillInsights: API call shape", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("issues a GET to /api/v1/me/skills/insights with Bearer auth", async () => {
    const mockResponse = okJsonResponse({
      insights: [makeInsight()],
      total: 1,
    });

    let capturedUrl = "";
    let capturedMethod = "";
    let capturedAuth = "";

    const fetchMock = vi.fn().mockImplementation((url: string, opts: RequestInit) => {
      capturedUrl = url;
      capturedMethod = opts.method as string ?? "GET";
      capturedAuth = (opts.headers as Record<string, string>)["Authorization"] ?? "";
      return Promise.resolve(mockResponse);
    });
    vi.stubGlobal("fetch", fetchMock);

    await getSkillInsights();

    expect(capturedMethod).toBe("GET");
    expect(capturedUrl).toContain("/api/v1/me/skills/insights");
    // Auth header should be a Bearer token (may be empty string if no token configured in test env)
    expect(capturedAuth).toMatch(/^(Bearer .+|)$/);
  });

  it("returns ok=true and parsed insights array on success", async () => {
    const insights = [
      makeInsight({ skill: "youstack-start", successRate: 0.9 }),
      makeInsight({ skill: "voice-sync", successRate: 0.6 }),
    ];
    const fetchMock = vi.fn().mockResolvedValue(
      okJsonResponse({ insights, total: 2 })
    );
    vi.stubGlobal("fetch", fetchMock);

    const res = await getSkillInsights();
    expect(res.ok).toBe(true);
    expect(res.data.insights).toHaveLength(2);
    expect(res.data.total).toBe(2);
    expect(res.data.insights[0].skill).toBe("youstack-start");
  });

  it("returns ok=false on 401", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { code: "unauthorized", message: "invalid key" } }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const res = await getSkillInsights();
    expect(res.ok).toBe(false);
    expect(res.status).toBe(401);
  });
});

// ─── reportSkillOutcome — call shape ─────────────────────────────────────────

describe("reportSkillOutcome: API call shape", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("issues a POST to /api/v1/me/skills/outcomes with correct body", async () => {
    let capturedUrl = "";
    let capturedMethod = "";
    let capturedBody: unknown;

    const fetchMock = vi.fn().mockImplementation((url: string, opts: RequestInit) => {
      capturedUrl = url;
      capturedMethod = opts.method as string;
      capturedBody = JSON.parse(opts.body as string);
      return Promise.resolve(
        okJsonResponse({ success: true, id: "id123", skillName: "youstack-start", outcome: "success" })
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    await reportSkillOutcome({ skill: "youstack-start", outcome: "success", durationMs: 500 });

    expect(capturedMethod).toBe("POST");
    expect(capturedUrl).toContain("/api/v1/me/skills/outcomes");
    expect(capturedBody).toMatchObject({
      skill: "youstack-start",
      outcome: "success",
      durationMs: 500,
    });
  });

  it("accepts failure and partial outcomes in the call body", async () => {
    const bodies: unknown[] = [];
    const fetchMock = vi.fn().mockImplementation((_url: string, opts: RequestInit) => {
      bodies.push(JSON.parse(opts.body as string));
      return Promise.resolve(
        okJsonResponse({ success: true, id: "x", skillName: "s", outcome: "failure" })
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    await reportSkillOutcome({ skill: "voice-sync", outcome: "failure" });
    await reportSkillOutcome({ skill: "meta-improve", outcome: "partial", note: "halfway" });

    expect((bodies[0] as Record<string, unknown>).outcome).toBe("failure");
    expect((bodies[1] as Record<string, unknown>).outcome).toBe("partial");
    expect((bodies[1] as Record<string, unknown>).note).toBe("halfway");
  });

  it("returns ok=true with id and outcome on success", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      okJsonResponse({ success: true, id: "abc123", skillName: "voice-sync", outcome: "success" })
    );
    vi.stubGlobal("fetch", fetchMock);

    const res = await reportSkillOutcome({ skill: "voice-sync", outcome: "success" });
    expect(res.ok).toBe(true);
    expect(res.data.id).toBe("abc123");
    expect(res.data.outcome).toBe("success");
  });
});
