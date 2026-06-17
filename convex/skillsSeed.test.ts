import { describe, expect, it } from "vitest";
import { convexTest } from "convex-test";

import { api, internal } from "./_generated/api";
import schema from "./schema";

describe("skills.seedBundledSkills", () => {
  it("publishes the full bundled skill registry used by local agents", async () => {
    const t = convexTest(schema);
    await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        clerkId: "clerk_seed_owner",
        username: "seed-owner",
        email: "seed-owner@example.com",
        plan: "pro",
        createdAt: Date.now(),
      });
    });

    const seeded = await t.mutation(internal.skills.seedBundledSkills, {});
    expect(seeded.total).toBe(10);
    expect(seeded.created).toBe(10);

    const published = await t.query(api.skills.listPublished, { limit: 50 });
    const names = published.map((skill) => skill.name).sort();
    expect(names).toEqual([
      "claude-md-generator",
      "machine-bootstrap",
      "meta-improve",
      "portfolio-graph-auditor",
      "proactive-context-fill",
      "project-context-init",
      "voice-sync",
      "you-logs",
      "youstack-maintainer",
      "youstack-start",
    ]);

    const machine = await t.query(api.skills.getByName, {
      name: "machine-bootstrap",
    });
    expect(machine?.content).toContain("youmd machine projects");
    expect(machine?.content).toContain("persisted portfolio graph");

    const auditor = await t.query(api.skills.getByName, {
      name: "portfolio-graph-auditor",
    });
    expect(auditor?.content).toContain("get_agent_brief");
    expect(auditor?.content).toContain("env-key-audit.py");
  });
});
