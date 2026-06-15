import { describe, expect, it } from "vitest";
import { convexTest } from "convex-test";

import { internal } from "./_generated/api";
import schema from "./schema";
import type { Id } from "./_generated/dataModel";

async function seedUser(t: ReturnType<typeof convexTest>): Promise<Id<"users">> {
  return t.run((ctx) =>
    ctx.db.insert("users", {
      clerkId: "clerk_refresh_owner",
      username: "refresh-owner",
      email: "refresh@example.com",
      plan: "pro",
      createdAt: Date.now(),
    })
  );
}

describe("sourceRefresh.markDueSourcesPending", () => {
  it("marks due non-running sources pending and advances nextRefreshAt", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t);
    const now = Date.UTC(2026, 5, 15);

    const dueId = await t.run((ctx) =>
      ctx.db.insert("sources", {
        userId,
        sourceType: "website",
        sourceUrl: "https://example.com",
        status: "extracted",
        refreshPolicy: "daily",
        nextRefreshAt: now - 1,
      })
    );
    const runningId = await t.run((ctx) =>
      ctx.db.insert("sources", {
        userId,
        sourceType: "website",
        sourceUrl: "https://running.example.com",
        status: "fetching",
        refreshPolicy: "daily",
        nextRefreshAt: now - 1,
      })
    );

    const result = await t.mutation(internal.sourceRefresh.markDueSourcesPending, {
      now,
      limit: 10,
    });

    expect(result.marked).toBe(1);
    expect(result.skipped).toBe(1);

    const due = await t.run((ctx) => ctx.db.get(dueId));
    const running = await t.run((ctx) => ctx.db.get(runningId));

    expect(due?.status).toBe("pending");
    expect(due?.nextRefreshAt).toBe(now + 24 * 60 * 60 * 1000);
    expect(running?.status).toBe("fetching");
  });
});
