import { describe, expect, it } from "vitest";
import { convexTest } from "convex-test";

import { api, internal } from "./_generated/api";
import schema from "./schema";

const CLERK = "clerk_dsi_owner";

async function seedUser(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      clerkId: CLERK,
      username: "dsi-owner",
      email: "dsi@example.com",
      plan: "pro",
      createdAt: Date.now(),
    });
  });
}

const weather = {
  provider: "open-meteo",
  location: {
    name: "Mar Vista, CA",
    lat: 34,
    lon: -118.43,
    timezone: "America/Los_Angeles",
    reason: "test",
  },
  observedAt: "2026-06-16T12:00",
  tempF: 72,
  windMph: 5,
  code: 1,
  label: "mostly clear",
  sourceUrl: "https://api.open-meteo.com/test-weather",
};

const surf = {
  provider: "open-meteo-marine",
  breakName: "Venice Breakwater",
  location: {
    name: "Venice Breakwater, CA",
    lat: 33.985,
    lon: -118.473,
    timezone: "America/Los_Angeles",
    reason: "test",
  },
  observedAt: "2026-06-16T12:00",
  ftRange: "2-3+",
  faceFt: 2.5,
  waveHeightFt: 1.8,
  swellHeightFt: 1.7,
  periodSeconds: 14,
  swellDirectionDegrees: 270,
  windMph: 3,
  windDirectionDegrees: 80,
  windQuality: "glassy",
  label: "small but fun / clean",
  tide: {
    station: "9410840",
    currentFt: 2.1,
    observedAt: "2026-06-16 12:00",
    sourceUrl: "https://api.tidesandcurrents.noaa.gov/test",
  },
  sourceUrls: [
    "https://marine-api.open-meteo.com/test",
    "https://api.open-meteo.com/test-surf-weather",
    "https://api.tidesandcurrents.noaa.gov/test",
  ],
};

describe("dsi components", () => {
  it("persists weather and surf components with source snapshots", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t);
    const asOwner = t.withIdentity({ subject: CLERK });

    const result = await asOwner.mutation(internal.dsi.persistWeatherSurfComponents, {
      clerkId: CLERK,
      userId,
      weather,
      surf,
    });

    expect(result.snapshotIds).toHaveLength(2);

    const components = await asOwner.query(api.dsi.listComponents, {
      clerkId: CLERK,
      userId,
    });
    expect(components.map((component) => component.slug).sort()).toEqual([
      "surf-venice-breakwater",
      "weather-home",
    ]);
    expect(components.every((component) => component.visibility === "private")).toBe(true);
    expect(components.find((component) => component.slug === "weather-home")?.summary).toContain("72F");
    expect(components.find((component) => component.slug === "surf-venice-breakwater")?.summary).toContain("2-3+ ft");

    const snapshots = await t.run(async (ctx) => {
      return await ctx.db
        .query("sourceSnapshots")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .collect();
    });
    expect(snapshots.map((snapshot) => snapshot.sourceKey).sort()).toEqual([
      "home-weather",
      "venice-breakwater-surf",
    ]);
  });
});
