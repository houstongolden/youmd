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
  it("creates a persisted default Home DSI view with live widgets", async () => {
    const t = convexTest(schema);
    await seedUser(t);
    const asOwner = t.withIdentity({ subject: CLERK });

    const ensured = await asOwner.mutation(api.dsi.ensureDefaultHomeView, {
      clerkId: CLERK,
    });
    expect(ensured.created).toBe(true);
    expect(ensured.widgetCount).toBeGreaterThanOrEqual(6);

    const home = await asOwner.query(api.dsi.getDefaultHomeView, {
      clerkId: CLERK,
    });
    expect(home?.view.slug).toBe("home");
    expect(home?.view.isDefault).toBe(true);
    expect(home?.summary.rawSecretsInBrowser).toBe(false);
    expect(home?.summary.liveCount).toBe(home?.summary.widgetCount);
    expect(home?.summary.sourceKinds).toEqual(
      expect.arrayContaining(["brainActivity", "portfolioGraph", "machineReadiness", "youAgent"])
    );
    expect(home?.widgets.map((widget) => widget.widgetKey)).toEqual([
      "you-agent-chat",
      "live-log",
      "tasks-needing-houston",
      "agent-queue",
      "project-focus",
      "machine-mesh",
    ]);

    const second = await asOwner.mutation(api.dsi.ensureDefaultHomeView, {
      clerkId: CLERK,
    });
    expect(second.created).toBe(false);
    expect(second.viewId).toBe(ensured.viewId);
  });

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

  it("persists school logistics as a private source-backed DSI component", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t);
    const asOwner = t.withIdentity({ subject: CLERK });

    await asOwner.mutation(internal.dsi.persistSchoolLogisticsComponent, {
      clerkId: CLERK,
      userId,
      school: {
        provider: "google-doc-mobilebasic",
        school: {
          name: "Mar Vista Elementary",
          sourceUrl: "https://docs.google.com/document/d/example/mobilebasic",
          timezone: "America/Los_Angeles",
        },
        capturedAt: "2026-06-16T12:00:00.000Z",
        activeGrades: ["1st", "all"],
        countdown: {
          today: "2026-06-16",
          lastDay: "2026-06-12",
          daysUntilLastDay: null,
          firstDay: "2026-08-13",
          daysUntilFirstDay: 58,
          outForSummer: true,
          kids: [
            { name: "West", currentGrade: "1st", nextGrade: "2nd" },
            { name: "Willa", currentGrade: "tk-prep", nextGrade: "TK" },
          ],
        },
        totals: {
          fetchedEvents: 2,
          upcomingEvents: 2,
          holidayOrClosureCount: 1,
        },
        nextEvent: {
          eventDate: "2026-08-13",
          eventTime: null,
          title: "First day of school",
          description: "August 13 First day of school",
          grade: "all",
          sourceLine: "August 13 First day of school",
        },
        events: [
          {
            eventDate: "2026-08-13",
            eventTime: null,
            title: "First day of school",
            description: "August 13 First day of school",
            grade: "all",
            sourceLine: "August 13 First day of school",
          },
          {
            eventDate: "2026-09-07",
            eventTime: null,
            title: "No school - Labor Day",
            description: "September 7 No school - Labor Day",
            grade: "all",
            sourceLine: "September 7 No school - Labor Day",
          },
        ],
        parser: {
          mode: "deterministic_google_doc",
          note: "test",
        },
      },
    });

    const components = await asOwner.query(api.dsi.listComponents, {
      clerkId: CLERK,
      userId,
    });
    const school = components.find((component) => component.slug === "school-logistics");
    expect(school?.visibility).toBe("private");
    expect(school?.componentType).toBe("school");
    expect(school?.summary).toContain("2 upcoming");
    expect(school?.summary).toContain("58d until fall");
    expect(school?.data.nextEvent.title).toBe("First day of school");

    const snapshots = await t.run(async (ctx) => {
      return await ctx.db
        .query("sourceSnapshots")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .collect();
    });
    expect(snapshots.map((snapshot) => snapshot.sourceKey)).toEqual(["school-logistics"]);
    expect(snapshots[0].connectorKind).toBe("school");
    expect(snapshots[0].visibility).toBe("private");
  });

  it("persists agenda as a private DSI component with manual calendar context", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t);
    const asOwner = t.withIdentity({ subject: CLERK });
    await t.run(async (ctx) => {
      const profileId = await ctx.db.insert("profiles", {
        username: "agenda-owner",
        name: "Agenda Owner",
        ownerId: userId,
        isClaimed: true,
        claimedAt: Date.now(),
        createdAt: Date.now(),
      });
      await ctx.db.insert("privateContext", {
        profileId,
        calendarContext: "Protect mornings for deep work. Family pickups win over calls.",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    await asOwner.mutation(internal.dsi.persistAgendaComponent, {
      clerkId: CLERK,
      userId,
      agenda: {
        provider: "google-calendar",
        capturedAt: "2026-06-16T12:00:00.000Z",
        windowStart: "2026-06-16T00:00:00.000Z",
        windowEnd: "2026-06-23T12:00:00.000Z",
        configured: true,
        connectionMode: "google_oauth_bearer",
        totals: {
          events: 2,
          totalSeen: 5,
          dropped: 3,
          today: 1,
          next7d: 2,
        },
        events: [
          {
            id: "evt_1",
            title: "Client strategy call",
            start: "2026-06-16T18:00:00.000Z",
            end: "2026-06-16T19:00:00.000Z",
            allDay: false,
            location: null,
            url: "https://calendar.google.com/calendar/event?eid=evt_1",
            attendeesCount: 2,
            category: "meeting",
            whyKept: "meeting w/ attendees",
            calendarId: "primary",
          },
          {
            id: "evt_2",
            title: "School pickup",
            start: "2026-06-17",
            end: "2026-06-18",
            allDay: true,
            location: "Mar Vista",
            url: null,
            attendeesCount: 0,
            category: "school",
            whyKept: "school",
            calendarId: "primary",
          },
        ],
        manualContext: null,
        parser: {
          mode: "hcomputer_importance_filter",
          note: "test",
        },
      },
    });

    const components = await asOwner.query(api.dsi.listComponents, {
      clerkId: CLERK,
      userId,
    });
    const agenda = components.find((component) => component.slug === "agenda-today");
    expect(agenda?.visibility).toBe("private");
    expect(agenda?.componentType).toBe("agenda");
    expect(agenda?.summary).toContain("2 kept");
    expect(agenda?.summary).toContain("1 today");
    expect(agenda?.data.manualContext).toContain("Family pickups win");
    expect(agenda?.data.events.map((event: { category: string }) => event.category)).toEqual(["meeting", "school"]);

    const snapshots = await t.run(async (ctx) => {
      return await ctx.db
        .query("sourceSnapshots")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .collect();
    });
    expect(snapshots.map((snapshot) => snapshot.sourceKey)).toEqual(["agenda-today"]);
    expect(snapshots[0].connectorKind).toBe("google-calendar");
    expect(snapshots[0].trustLevel).toBe("verified");
  });

  it("builds a private task queue component from customData tasks", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t);
    const asOwner = t.withIdentity({ subject: CLERK });
    await t.run(async (ctx) => {
      const profileId = await ctx.db.insert("profiles", {
        username: "task-owner",
        name: "Task Owner",
        ownerId: userId,
        isClaimed: true,
        claimedAt: Date.now(),
        createdAt: Date.now(),
      });
      await ctx.db.insert("privateContext", {
        profileId,
        customData: {
          tasks: [
            {
              id: "task_1",
              title: "Renew agent connector grants",
              details: "Audit connected app scopes and rotate stale tokens.",
              status: "open",
              priority: "urgent",
              due_at: "2020-01-01",
              source: "youmd",
              source_text: "Need proper connected-app grants.",
              tags: ["youmd", "security"],
              created_at: "2026-06-15T12:00:00.000Z",
            },
            {
              id: "task_2",
              title: "Review proposed daily report prompts",
              status: "proposed",
              priority: "high",
              due_at: "2999-01-01",
              proposed: true,
              tags: ["loops"],
            },
            {
              id: "task_3",
              title: "Ship weather DSI",
              status: "done",
              priority: "normal",
              completed_at: "2026-06-16T12:00:00.000Z",
            },
          ],
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const result = await asOwner.mutation(api.dsi.refreshTaskQueue, {
      clerkId: CLERK,
      userId,
    });
    expect(result.configured).toBe(true);
    expect(result.openCount).toBe(2);

    const components = await asOwner.query(api.dsi.listComponents, {
      clerkId: CLERK,
      userId,
    });
    const tasks = components.find((component) => component.slug === "task-queue");
    expect(tasks?.visibility).toBe("private");
    expect(tasks?.componentType).toBe("tasks");
    expect(tasks?.summary).toContain("2 open");
    expect(tasks?.summary).toContain("1 overdue");
    expect(tasks?.summary).toContain("1 proposed");
    expect(tasks?.summary).toContain("1 urgent");
    expect(tasks?.data.provider).toBe("youmd-custom-data");
    expect(tasks?.data.sourceKey).toBe("tasks");
    expect(tasks?.data.tasks[0]).toMatchObject({
      id: "task_1",
      title: "Renew agent connector grants",
      priority: "urgent",
      overdue: true,
    });
    expect(tasks?.data.suggestedPrompts[0]).toContain("overdue");

    const snapshots = await t.run(async (ctx) => {
      return await ctx.db
        .query("sourceSnapshots")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .collect();
    });
    expect(snapshots.map((snapshot) => snapshot.sourceKey)).toEqual(["task-queue"]);
    expect(snapshots[0].connectorKind).toBe("youmd-tasks");
    expect(snapshots[0].trustLevel).toBe("computed");
  });

  it("builds a private Bad.app fitness component from customData", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t);
    const asOwner = t.withIdentity({ subject: CLERK });
    await t.run(async (ctx) => {
      const profileId = await ctx.db.insert("profiles", {
        username: "bad-owner",
        name: "Bad Owner",
        ownerId: userId,
        isClaimed: true,
        claimedAt: Date.now(),
        createdAt: Date.now(),
      });
      await ctx.db.insert("privateContext", {
        profileId,
        customData: {
          badapp: {
            healthIntelligence: {
              headline: "Houston, recovery 82, training load optimal, fitness age ~31. Hold the line.",
              focus: ["Hold the line — recovery, load, and sleep are all in range."],
              recovery: { score: 82, band: "green", label: "Primed", summary: "Recovery is primed versus baseline." },
              readiness: { score: 78, band: "green", label: "Go hard", summary: "Today is a go hard day." },
              trainingLoad: { score: 85, band: "green", label: "Optimal", ratio: 1.08, acute: 240, chronic: 222 },
              sleep: { band: "green", lastNightHours: 7.8, avg7Hours: 7.3, debtHours: 0.5, summary: "7.8h last night." },
              bioAge: { available: true, fitnessAge: 31, vo2Max: 48.2, band: "green", summary: "VO2 reads young." },
              dataQuality: { score: 86, missing: ["Blood panel"] },
              sources: [
                { name: "Apple Health", metrics: ["HRV", "Sleep", "Workouts"] },
                { name: "Strava", metrics: ["Workouts"] },
              ],
            },
            healthSummaries: [
              {
                date: "2026-06-16",
                source: "apple_health",
                steps: 12880,
                activeEnergy: 840,
                exerciseMinutes: 72,
                sleepMinutes: 468,
                restingHeartRate: 49,
                hrv: 72,
                vo2Max: 48.2,
                bodyWeight: 181.4,
                bodyFatPercentage: 14.8,
                readiness: 78,
              },
            ],
            bodyScans: [
              {
                _id: "scan_1",
                date: "2026-06-15",
                status: "done",
                weightLbs: 181.4,
                bodyFatPct: 14.8,
                leanMassLbs: 154.6,
                fatMassLbs: 26.8,
                ffmi: 22.1,
                bmi: 24.6,
                method: "ai-scan",
              },
            ],
            fitnessTests: [
              {
                _id: "fit_1",
                date: "2026-06-14",
                test: "pushups",
                value: 62,
                unit: "reps",
                source: "manual",
                note: "strict form",
              },
            ],
          },
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const result = await asOwner.mutation(api.dsi.refreshBadFitnessFromContext, {
      clerkId: CLERK,
      userId,
    });
    expect(result.configured).toBe(true);
    expect(result.summary).toContain("82 recovery");

    const components = await asOwner.query(api.dsi.listComponents, {
      clerkId: CLERK,
      userId,
    });
    const fitness = components.find((component) => component.slug === "badapp-fitness");
    expect(fitness?.visibility).toBe("private");
    expect(fitness?.componentType).toBe("fitness");
    expect(fitness?.summary).toContain("78 readiness");
    expect(fitness?.summary).toContain("14.8% body fat");
    expect(fitness?.data.provider).toBe("youmd-custom-data");
    expect(fitness?.data.connectionMode).toBe("private_custom_data");
    expect(fitness?.data.headline).toContain("fitness age");
    expect(fitness?.data.scores.bioAge).toMatchObject({ available: true, fitnessAge: 31, vo2Max: 48.2 });
    expect(fitness?.data.latest.healthSummary).toMatchObject({
      date: "2026-06-16",
      steps: 12880,
      bodyWeight: 181.4,
    });
    expect(fitness?.data.latest.bodyScan).toMatchObject({
      id: "scan_1",
      bodyFatPct: 14.8,
    });
    expect(fitness?.data.latest.fitnessTest).toMatchObject({
      test: "pushups",
      value: 62,
    });

    const snapshots = await t.run(async (ctx) => {
      return await ctx.db
        .query("sourceSnapshots")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .collect();
    });
    expect(snapshots.map((snapshot) => snapshot.sourceKey)).toEqual(["badapp-fitness"]);
    expect(snapshots[0].connectorKind).toBe("badapp");
    expect(snapshots[0].trustLevel).toBe("computed");
  });

  it("builds a private BAMF pulse component from customData", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t);
    const asOwner = t.withIdentity({ subject: CLERK });
    await t.run(async (ctx) => {
      const profileId = await ctx.db.insert("profiles", {
        username: "bamf-owner",
        name: "BAMF Owner",
        ownerId: userId,
        isClaimed: true,
        claimedAt: Date.now(),
        createdAt: Date.now(),
      });
      await ctx.db.insert("privateContext", {
        profileId,
        customData: {
          bamf: {
            analyticsSnapshot: {
              generated_at: "2026-06-16T17:00:00.000Z",
              counts: [
                { table: "clients", count: 42 },
                { table: "linkedin_authors", count: 37 },
                { table: "linkedin_posts", count: 1280 },
                { table: "case_studies", count: 18 },
                { table: "newsletter_subscribers", count: 22000 },
                { table: "chat_leads", count: 84 },
              ],
              recent_stack_sync_runs: [
                {
                  id: "sync_1",
                  source_stack: "bamfstack",
                  target_stack: "bamfos",
                  status: "completed",
                  summary: "Synced creator skills and client portal contracts.",
                  created_at: "2026-06-16T15:00:00.000Z",
                  completed_at: "2026-06-16T15:01:00.000Z",
                },
              ],
            },
            creatorSpaces: [
              {
                creator_id: "houston",
                name: "Houston Golden",
                headline: "Founder, BAMF and You.md",
                linkedin_url: "https://www.linkedin.com/in/houstongolden/",
                follower_count: 123456,
                profile_views: 8900,
                status: "active",
              },
            ],
            linkedinPosts: [
              {
                id: "post_1",
                content: "The agent internet needs a personal API.",
                linkedin_url: "https://www.linkedin.com/feed/update/post_1",
                impressions: 250000,
                reactions: 4200,
                comments: 310,
                reposts: 90,
                data_source: "bamf_ai",
                posted_at_iso: "2026-06-15T18:00:00.000Z",
              },
            ],
            clients: [
              {
                id: "client_1",
                name: "Acme Founder",
                status: "active",
                health_status: "green",
                onboarding_status: "complete",
                plan_package: "founder brand",
                website: "https://example.com",
              },
            ],
            notes: ["LinkedIn pulse is strong; review new client wins before daily journal."],
          },
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const result = await asOwner.mutation(api.dsi.refreshBamfPulseFromContext, {
      clerkId: CLERK,
      userId,
    });
    expect(result.configured).toBe(true);
    expect(result.summary).toContain("42 clients");
    expect(result.summary).toContain("1 creator");
    expect(result.summary).toContain("1,280 posts");

    const components = await asOwner.query(api.dsi.listComponents, {
      clerkId: CLERK,
      userId,
    });
    const pulse = components.find((component) => component.slug === "bamf-pulse");
    expect(pulse?.visibility).toBe("private");
    expect(pulse?.componentType).toBe("bamf_analytics");
    expect(pulse?.summary).toContain("250,000 top-post impressions");
    expect(pulse?.data.provider).toBe("youmd-custom-data");
    expect(pulse?.data.connectionMode).toBe("private_custom_data");
    expect(pulse?.data.counts).toMatchObject({
      clients: 42,
      linkedinAuthors: 37,
      linkedinPosts: 1280,
      newsletterSubscribers: 22000,
      chatLeads: 84,
    });
    expect(pulse?.data.creators[0]).toMatchObject({
      id: "houston",
      name: "Houston Golden",
      followerCount: 123456,
    });
    expect(pulse?.data.topPosts[0]).toMatchObject({
      id: "post_1",
      impressions: 250000,
      reactions: 4200,
    });
    expect(pulse?.data.clients[0]).toMatchObject({
      id: "client_1",
      healthStatus: "green",
    });
    expect(pulse?.data.recentStackRuns[0]).toMatchObject({
      id: "sync_1",
      status: "completed",
    });

    const snapshots = await t.run(async (ctx) => {
      return await ctx.db
        .query("sourceSnapshots")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .collect();
    });
    expect(snapshots.map((snapshot) => snapshot.sourceKey)).toEqual(["bamf-pulse"]);
    expect(snapshots[0].connectorKind).toBe("bamf");
    expect(snapshots[0].trustLevel).toBe("computed");
  });

  it("builds a GitHub project catalog component from tracked projects and repo mirror stats", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t);
    const asOwner = t.withIdentity({ subject: CLERK });
    await t.run(async (ctx) => {
      await ctx.db.insert("bundles", {
        userId,
        version: 1,
        schemaVersion: "you-md/v1",
        manifest: {},
        youJson: {
          projects: [
            {
              name: "youmd",
              url: "https://you.md",
              githubUrl: "https://github.com/houstongolden/youmd",
            },
          ],
        },
        youMd: "# dsi owner",
        isPublished: false,
        createdAt: Date.now(),
      });
      await ctx.db.insert("repoMirror", {
        userId,
        repoFullName: "houstongolden/youmd",
        commitSha: "abc123",
        files: [
          { path: "src/app.ts", content: "one\ntwo\nthree", size: 13 },
          { path: "README.md", content: "# Readme\n\nnotes", size: 14 },
          { path: "docs/plan.mdx", content: "a\nb", size: 3 },
        ],
        fileCount: 3,
        totalBytes: 30,
        truncated: false,
        syncedAt: Date.parse("2026-06-16T12:00:00.000Z"),
      });
      await ctx.db.insert("trackedProjects", {
        userId,
        githubRepoId: 1,
        fullName: "houstongolden/youmd",
        name: "youmd",
        description: "Identity context protocol.",
        primaryLanguage: "TypeScript",
        pushedAt: Date.parse("2026-06-16T13:00:00.000Z"),
        commitsLast90d: 42,
        stars: 7,
        isPrivate: false,
        insight: "Portable context for agents.",
        visibility: "public",
        trackedAt: Date.now(),
        updatedAt: Date.now(),
      });
      await ctx.db.insert("trackedProjects", {
        userId,
        githubRepoId: 2,
        fullName: "houstongolden/bamfai",
        name: "bamfai",
        description: "Creator engine.",
        primaryLanguage: "TypeScript",
        pushedAt: Date.parse("2026-06-15T13:00:00.000Z"),
        commitsLast90d: 10,
        stars: 3,
        isPrivate: true,
        insight: "BAMF creator workflows.",
        visibility: "private",
        trackedAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const result = await asOwner.mutation(api.dsi.refreshProjectCatalog, {
      clerkId: CLERK,
      userId,
    });
    expect(result.snapshotId).toBeTruthy();

    const components = await asOwner.query(api.dsi.listComponents, {
      clerkId: CLERK,
      userId,
    });
    const catalog = components.find((component) => component.slug === "github-project-catalog");
    expect(catalog?.visibility).toBe("private");
    expect(catalog?.summary).toContain("2 projects");
    expect(catalog?.summary).toContain("52 commits/90d");
    expect(catalog?.summary).toContain("8 LOC");
    expect(catalog?.summary).toContain("5 LOMB");
    expect(catalog?.data.totals).toMatchObject({
      projectCount: 2,
      publicCount: 1,
      privateCount: 1,
      commitsLast90d: 52,
      stars: 10,
      loc: 8,
      lomb: 5,
      exactMirrorProjectCount: 1,
      languageMetricProjectCount: 0,
      pendingMetricProjectCount: 1,
    });
    expect(catalog?.data.projects[0]).toMatchObject({
      fullName: "houstongolden/youmd",
      githubUrl: "https://github.com/houstongolden/youmd",
      projectUrl: "https://you.md",
      metricStatus: "exact_repo_mirror",
      loc: 8,
      lomb: 5,
    });
    expect(catalog?.data.projects[1]).toMatchObject({
      fullName: "houstongolden/bamfai",
      metricStatus: "pending_github_languages_adapter",
      loc: null,
      lomb: null,
    });

    await asOwner.mutation(internal.dsi.persistProjectCatalogWithLanguageMetrics, {
      clerkId: CLERK,
      userId,
      languageMetrics: [
        {
          fullName: "houstongolden/youmd",
          languages: { TypeScript: 3200, Markdown: 600, MDX: 120 },
          loc: 112,
          lomb: 12,
          lombToCodeRatio: 0.12,
        },
        {
          fullName: "houstongolden/bamfai",
          languages: { TypeScript: 6400, Markdown: 1200 },
          loc: 220,
          lomb: 20,
          lombToCodeRatio: 0.1,
        },
      ],
    });

    const enriched = await asOwner.query(api.dsi.listComponents, {
      clerkId: CLERK,
      userId,
    });
    const enrichedCatalog = enriched.find((component) => component.slug === "github-project-catalog");
    expect(enrichedCatalog?.summary).toContain("332 LOC");
    expect(enrichedCatalog?.summary).toContain("32 LOMB");
    expect(enrichedCatalog?.data.totals).toMatchObject({
      loc: 332,
      lomb: 32,
      languageMetricProjectCount: 2,
      exactMirrorProjectCount: 0,
      pendingMetricProjectCount: 0,
    });
    expect(enrichedCatalog?.data.projects.map((project: { metricStatus: string }) => project.metricStatus)).toEqual([
      "estimated_github_languages",
      "estimated_github_languages",
    ]);

    const snapshots = await t.run(async (ctx) => {
      return await ctx.db
        .query("sourceSnapshots")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .collect();
    });
    expect(snapshots.filter((snapshot) => snapshot.sourceKey === "github-project-catalog")).toHaveLength(2);
  });
});
