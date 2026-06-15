import { describe, expect, it } from "vitest";
import { convexTest } from "convex-test";

import { api } from "./_generated/api";
import schema from "./schema";
import { hashKey } from "./apiKeys";

const CLERK = "clerk_connected_app_owner";

async function seedUser(t: ReturnType<typeof convexTest>) {
  return t.run((ctx) =>
    ctx.db.insert("users", {
      clerkId: CLERK,
      username: "grant-owner",
      email: "owner@example.com",
      plan: "pro",
      createdAt: Date.now(),
    })
  );
}

describe("connected app grants", () => {
  it("creates a yg_ grant token and resolves its hashed active grant", async () => {
    const t = convexTest(schema);
    await seedUser(t);
    const asOwner = t.withIdentity({ subject: CLERK });

    const created = await asOwner.mutation(api.connectedApps.createGrant, {
      clerkId: CLERK,
      appSlug: "Personal Browser",
      appName: "Personal Browser",
      appType: "local_agent",
      scopes: ["identity:read", "sources:read", "sources:write"],
      resourceScopes: ["identity", "sources"],
      writePolicy: "propose",
      trustLevel: "high",
      ttl: "7d",
    });

    expect(created.token).toMatch(/^yg_[A-Za-z0-9]{40}$/);
    expect(created.appSlug).toBe("personal-browser");

    const resolved = await t.query(api.connectedApps.getByTokenHash, {
      tokenHash: await hashKey(created.token),
    });

    expect(resolved).toMatchObject({
      appSlug: "personal-browser",
      appName: "Personal Browser",
      appType: "local_agent",
      scopes: ["identity:read", "sources:read", "sources:write"],
      resourceScopes: ["identity", "sources"],
      writePolicy: "propose",
      trustLevel: "high",
    });
  });

  it("revokes older active grants for the same app slug", async () => {
    const t = convexTest(schema);
    await seedUser(t);
    const asOwner = t.withIdentity({ subject: CLERK });

    const first = await asOwner.mutation(api.connectedApps.createGrant, {
      clerkId: CLERK,
      appSlug: "crawler",
      appName: "Crawler",
      scopes: ["sources:read"],
      resourceScopes: ["sources"],
    });
    const second = await asOwner.mutation(api.connectedApps.createGrant, {
      clerkId: CLERK,
      appSlug: "crawler",
      appName: "Crawler",
      scopes: ["sources:read", "sources:write"],
      resourceScopes: ["sources"],
    });

    expect(
      await t.query(api.connectedApps.getByTokenHash, {
        tokenHash: await hashKey(first.token),
      })
    ).toBeNull();
    expect(
      await t.query(api.connectedApps.getByTokenHash, {
        tokenHash: await hashKey(second.token),
      })
    ).not.toBeNull();
  });

  it("rejects unknown scopes", async () => {
    const t = convexTest(schema);
    await seedUser(t);
    const asOwner = t.withIdentity({ subject: CLERK });

    await expect(
      asOwner.mutation(api.connectedApps.createGrant, {
        clerkId: CLERK,
        appSlug: "bad",
        appName: "Bad",
        scopes: ["everything:write"],
        resourceScopes: ["sources"],
      })
    ).rejects.toThrow("Unknown grant scopes");
  });
});
