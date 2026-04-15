/**
 * Seed script for sample profiles.
 *
 * Usage:
 *   npx convex run seed:seedSampleProfiles   — insert sample users + published bundles
 *   npx convex run seed:cleanupSampleProfiles — delete all sample data
 *
 * All sample users are flagged with isSample: true for easy cleanup.
 *
 * Cycle 45: All exports are now `internalMutation` — public callers cannot
 * invoke them via /api/mutation. Previously they were `mutation`, which let
 * any anonymous caller pollute prod with sample profiles or trigger cleanup
 * sweeps. They were always meant for `npx convex run --component-function`
 * admin tooling.
 */
import { v } from "convex/values";
import { internalMutation, internalAction, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import {
  ProfileData,
  compileYouJson,
  compileYouMd,
  compileManifest,
} from "./lib/compile";

interface SeedProfile extends ProfileData {
  email: string;
  avatarUrl?: string;
  isClaimed?: boolean;
}

// Real AI/tech founders — unclaimed profiles showing what you.md looks like at scale.
// avatarUrl uses GitHub avatar CDN which supports CORS (required for AsciiAvatar canvas).
const SAMPLE_PROFILES: SeedProfile[] = [
  {
    name: "Andrej Karpathy",
    username: "karpathy",
    email: "sample-karpathy@you.md",
    avatarUrl: "https://avatars.githubusercontent.com/u/241138?v=4",
    isClaimed: false,
    tagline: "AI researcher, educator, builder. Ex-Tesla, ex-OpenAI.",
    location: "San Francisco, CA",
    bio: {
      short: "Making AI legible. Teaching the world how neural networks actually work.",
      medium:
        "Founding team at OpenAI, former Director of AI at Tesla. I teach machine learning through writing, videos, and code. Author of Andrej's blog and the micrograd/nanoGPT series. Building in public.",
    },
    now: [
      "Building Eureka Labs — AI-native education",
      "Writing deep-dives on LLM internals",
    ],
    projects: [
      {
        name: "Eureka Labs",
        role: "Founder",
        status: "building",
        description: "AI-native education company.",
        url: "https://eurekalabs.ai",
      },
      {
        name: "nanoGPT",
        role: "Creator",
        status: "active",
        description: "Fastest repo for training/finetuning GPT-class models.",
        url: "https://github.com/karpathy/nanoGPT",
      },
    ],
    values: ["Teach deeply", "Open source", "First principles"],
    links: {
      github: "https://github.com/karpathy",
      x: "https://x.com/karpathy",
      website: "https://karpathy.ai",
    },
    preferences: {
      agent: {
        tone: "precise, educational, honest about uncertainty",
        formality: "academic-casual",
        avoid: ["hype", "vague claims", "jargon without definition"],
      },
      writing: { format: "long-form with intuition first, then math" },
    },
    analysis: {
      topics: ["LLMs", "neural networks", "AI education", "deep learning"],
      voice_summary: "Precise, educational, first-principles thinker.",
      credibility_signals: [
        "Founding team OpenAI",
        "Director of AI @ Tesla (Autopilot)",
        "nanoGPT has 40k+ GitHub stars",
        "Top AI educator on YouTube",
      ],
    },
  },
  {
    name: "Guillermo Rauch",
    username: "rauchg",
    email: "sample-rauchg@you.md",
    avatarUrl: "https://avatars.githubusercontent.com/u/13041?v=4",
    isClaimed: false,
    tagline: "CEO @ Vercel. Building the platform for the web.",
    location: "San Francisco, CA",
    bio: {
      short: "Making the web faster. Ship more, think less about infra.",
      medium:
        "CEO of Vercel and creator of Next.js. Previously built socket.io and Mongoose. I believe the web should be instant and developers should spend zero time on infrastructure.",
    },
    now: [
      "v0 — AI-native UI generation",
      "Vercel AI SDK expansion",
    ],
    projects: [
      {
        name: "Vercel",
        role: "CEO",
        status: "active",
        description: "Platform for frontend developers.",
        url: "https://vercel.com",
      },
      {
        name: "v0",
        role: "Creator",
        status: "active",
        description: "AI that generates UI from prompts.",
        url: "https://v0.dev",
      },
    ],
    values: ["Zero infra friction", "Ship constantly", "DX is UX"],
    links: {
      github: "https://github.com/rauchg",
      x: "https://x.com/rauchg",
      website: "https://rauchg.com",
    },
    preferences: {
      agent: {
        tone: "direct, visionary, aphoristic",
        formality: "casual",
        avoid: ["slow explanations", "over-engineering"],
      },
      writing: { format: "punchy, tweet-first, then depth" },
    },
    analysis: {
      topics: ["web platform", "Next.js", "AI tooling", "developer experience"],
      voice_summary: "Direct, visionary, ships fast.",
      credibility_signals: [
        "CEO of Vercel ($2.5B+ valuation)",
        "Creator of Next.js",
        "Creator of socket.io (200M downloads)",
      ],
    },
  },
  {
    name: "Amjad Masad",
    username: "amasad",
    email: "sample-amasad@you.md",
    avatarUrl: "https://avatars.githubusercontent.com/u/587518?v=4",
    isClaimed: false,
    tagline: "CEO @ Replit. Making programming accessible to a billion people.",
    location: "San Francisco, CA",
    bio: {
      short: "Democratizing software creation. Everyone should be able to build.",
      medium:
        "CEO of Replit. Former Facebook engineer. Born in Jordan, obsessed with making coding available to everyone everywhere. Building the IDE of the future — AI-first, runs in the browser.",
    },
    now: [
      "Replit Agent — code from natural language",
      "Expanding to 100M developers",
    ],
    projects: [
      {
        name: "Replit",
        role: "CEO",
        status: "active",
        description: "Collaborative browser-based IDE for 30M developers.",
        url: "https://replit.com",
      },
      {
        name: "Replit Agent",
        role: "Creator",
        status: "building",
        description: "Build full apps from a single prompt.",
      },
    ],
    values: ["Democratize software", "AI-native tools", "Build for everyone"],
    links: {
      github: "https://github.com/amasad",
      x: "https://x.com/amasad",
      website: "https://amasad.me",
    },
    preferences: {
      agent: {
        tone: "energetic, mission-driven, builder",
        formality: "casual",
        avoid: ["exclusionary tech language", "gatekeeping"],
      },
      writing: { format: "story-first, then vision" },
    },
    analysis: {
      topics: ["coding education", "AI agents", "browser-native IDE", "developer tools"],
      voice_summary: "Energetic, mission-driven, builder at heart.",
      credibility_signals: [
        "CEO of Replit (30M+ users)",
        "Ex-Facebook engineer",
        "Forbes 30 Under 30",
      ],
    },
  },
  {
    name: "Pieter Levels",
    username: "levelsio",
    email: "sample-levelsio@you.md",
    avatarUrl: "https://avatars.githubusercontent.com/u/7150848?v=4",
    isClaimed: false,
    tagline: "Indie hacker. Solo-built $3M ARR. 12 startups in 12 months.",
    location: "Amsterdam / Nomad",
    bio: {
      short: "Proof that one person can build a business that matters.",
      medium:
        "Built NomadList, RemoteOK, PhotoAI, InteriorAI, and more — all solo. $3M+ ARR, no team, no VC. I document everything in public. I believe most startups are over-staffed and under-shipped.",
    },
    now: [
      "PhotoAI — AI headshots at scale",
      "Building interior design AI",
    ],
    projects: [
      {
        name: "NomadList",
        role: "Founder",
        status: "active",
        description: "Best cities for remote workers.",
        url: "https://nomadlist.com",
      },
      {
        name: "PhotoAI",
        role: "Founder",
        status: "active",
        description: "AI photo generator for realistic headshots.",
        url: "https://photoai.com",
      },
    ],
    values: ["Solo builds", "Revenue > funding", "Ship in public"],
    links: {
      github: "https://github.com/levelsio",
      x: "https://x.com/levelsio",
      website: "https://levels.io",
    },
    preferences: {
      agent: {
        tone: "blunt, pragmatic, anti-corporate",
        formality: "very casual",
        avoid: ["VC speak", "team-building platitudes", "startup theater"],
      },
      writing: { format: "short, tweet-length, raw numbers" },
    },
    analysis: {
      topics: ["indie hacking", "AI SaaS", "solopreneurship", "remote work"],
      voice_summary: "Blunt, builds in public, revenue-obsessed.",
      credibility_signals: [
        "$3M+ ARR across solo products",
        "NomadList: 1M+ members",
        "Most followed indie hacker on X",
      ],
    },
  },
  {
    name: "Simon Willison",
    username: "simonw",
    email: "sample-simonw@you.md",
    avatarUrl: "https://avatars.githubusercontent.com/u/9599?v=4",
    isClaimed: false,
    tagline: "Creator of Datasette. LLM CLI builder. Writing about AI daily.",
    location: "Palo Alto, CA",
    bio: {
      short: "Making data explorable and LLMs useful. Building open tools in public.",
      medium:
        "Co-creator of Django. Creator of Datasette and the LLM CLI. I write daily at simonwillison.net about building real things with AI — what works, what doesn't, no hype.",
    },
    now: [
      "LLM CLI — run any model from terminal",
      "Writing the definitive LLM application dev guide",
    ],
    projects: [
      {
        name: "Datasette",
        role: "Creator",
        status: "active",
        description: "Open source tool for exploring and publishing SQLite data.",
        url: "https://datasette.io",
      },
      {
        name: "LLM CLI",
        role: "Creator",
        status: "active",
        description: "CLI tool to run prompts against any LLM.",
        url: "https://llm.datasette.io",
      },
    ],
    values: ["Open source", "Write to think", "No hype"],
    links: {
      github: "https://github.com/simonw",
      website: "https://simonwillison.net",
      x: "https://x.com/simonw",
    },
    preferences: {
      agent: {
        tone: "methodical, honest, practical",
        formality: "professional-casual",
        avoid: ["AI hype", "vague promises", "undisclosed limitations"],
      },
      writing: { format: "structured writeups with code examples and caveats" },
    },
    analysis: {
      topics: ["LLMs", "open source tools", "data exploration", "Python"],
      voice_summary: "Methodical, honest, anti-hype builder.",
      credibility_signals: [
        "Co-creator of Django",
        "Creator of Datasette (10k+ GitHub stars)",
        "Daily AI writer at simonwillison.net",
      ],
    },
  },
  {
    name: "Logan Kilpatrick",
    username: "logankilpatrick",
    email: "sample-logankilpatrick@you.md",
    avatarUrl: "https://avatars.githubusercontent.com/u/35577566?v=4",
    isClaimed: false,
    tagline: "AI @ Google. Ex-OpenAI DevRel. Making AI more accessible.",
    location: "San Francisco, CA",
    bio: {
      short: "Connecting developers to the AI ecosystem. Open source contributor.",
      medium:
        "Working on AI product at Google. Previously led developer relations at OpenAI. Julia Language core contributor. I care about making AI tools accessible to every developer regardless of background.",
    },
    now: [
      "AI Studio developer experience @ Google",
      "Growing the Gemini developer community",
    ],
    projects: [
      {
        name: "OpenAI DevRel Program",
        role: "Founder",
        status: "shipped",
        description: "Built OpenAI's developer relations from 0 to global scale.",
      },
      {
        name: "Julia for AI",
        role: "Core Contributor",
        status: "active",
        description: "Open source AI tooling in Julia Language.",
        url: "https://github.com/JuliaAI",
      },
    ],
    values: ["Accessible AI", "Open source", "Developer community"],
    links: {
      github: "https://github.com/logankilpatrick",
      x: "https://x.com/OfficialLoganK",
      website: "https://logankilpatrick.com",
    },
    preferences: {
      agent: {
        tone: "welcoming, educational, community-first",
        formality: "casual",
        avoid: ["exclusionary tech gatekeeping"],
      },
      writing: { format: "accessible explanations, beginner-friendly without being condescending" },
    },
    analysis: {
      topics: ["AI developer relations", "LLM APIs", "open source", "community building"],
      voice_summary: "Welcoming, community-driven, makes AI accessible.",
      credibility_signals: [
        "AI Product @ Google",
        "Ex-OpenAI Developer Relations Lead",
        "Julia Language core contributor",
      ],
    },
  },
];

export const seedSampleProfiles = internalMutation({
  args: {},
  handler: async (ctx) => {
    const results: string[] = [];

    for (const profile of SAMPLE_PROFILES) {
      // Check if user already exists
      const existing = await ctx.db
        .query("users")
        .withIndex("by_username", (q) =>
          q.eq("username", profile.username)
        )
        .first();

      if (existing) {
        results.push(
          `${profile.username}: skipped (already exists)`
        );
        continue;
      }

      // Create sample user with fake clerkId
      const userId = await ctx.db.insert("users", {
        clerkId: `sample_${profile.username}`,
        username: profile.username,
        email: profile.email,
        displayName: profile.name,
        plan: "free" as const,
        isSample: true,
        createdAt: Date.now(),
      });

      // Compile bundle from profile data
      const profileData: ProfileData = {
        name: profile.name,
        username: profile.username,
        tagline: profile.tagline,
        location: profile.location,
        bio: profile.bio,
        now: profile.now,
        projects: profile.projects,
        values: profile.values,
        links: profile.links,
        preferences: profile.preferences,
        analysis: profile.analysis,
      };

      const youJson = compileYouJson(profileData);
      const youMd = compileYouMd(profileData);
      const manifest = compileManifest(profileData);

      // Create published bundle
      await ctx.db.insert("bundles", {
        userId,
        version: 1,
        schemaVersion: "you-md/v1",
        manifest,
        youJson,
        youMd,
        isPublished: true,
        createdAt: Date.now(),
        publishedAt: Date.now(),
      });

      const isClaimed = profile.isClaimed !== false; // default true unless explicitly false

      // Create profile record (so profiles directory + public page work)
      await ctx.db.insert("profiles", {
        username: profile.username,
        name: profile.name,
        tagline: profile.tagline,
        location: profile.location,
        bio: profile.bio,
        links: profile.links,
        avatarUrl: profile.avatarUrl,
        ownerId: userId,
        isClaimed,
        claimedAt: isClaimed ? Date.now() : undefined,
        youJson,
        youMd,
        createdAt: Date.now(),
      });

      results.push(
        `${profile.username}: created user + profile + published bundle`
      );
    }

    return results;
  },
});

/** Backfill profile records for existing sample users that only have bundles */
export const backfillSampleProfiles = internalMutation({
  args: {},
  handler: async (ctx) => {
    const results: string[] = [];
    const allUsers = await ctx.db.query("users").collect();
    const sampleUsers = allUsers.filter((u) => u.isSample === true);

    for (const user of sampleUsers) {
      // Check if profile already exists
      const existingProfile = await ctx.db
        .query("profiles")
        .withIndex("by_username", (q) => q.eq("username", user.username))
        .first();

      if (existingProfile) {
        results.push(`${user.username}: profile already exists`);
        continue;
      }

      // Get published bundle
      const bundle = await ctx.db
        .query("bundles")
        .withIndex("by_userId", (q) => q.eq("userId", user._id))
        .first();

      if (!bundle || !bundle.youJson) {
        results.push(`${user.username}: no bundle found`);
        continue;
      }

      const youJson = bundle.youJson as Record<string, unknown>;
      const identity = (youJson.identity || {}) as Record<string, unknown>;
      const bio = identity.bio as Record<string, string> | undefined;

      await ctx.db.insert("profiles", {
        username: user.username,
        name: user.displayName || (identity.name as string) || user.username,
        tagline: (identity.tagline as string) || undefined,
        location: (identity.location as string) || undefined,
        bio: bio ? { short: bio.short, medium: bio.medium } : undefined,
        links: youJson.links as Record<string, string> | undefined,
        ownerId: user._id,
        isClaimed: true,
        claimedAt: Date.now(),
        youJson: bundle.youJson,
        youMd: bundle.youMd,
        createdAt: Date.now(),
      });

      results.push(`${user.username}: profile created from bundle`);
    }

    return results;
  },
});

export const cleanupSampleProfiles = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Find all sample users
    const allUsers = await ctx.db.query("users").collect();
    const sampleUsers = allUsers.filter((u) => u.isSample === true);

    let deletedUsers = 0;
    let deletedBundles = 0;
    let deletedViews = 0;

    for (const user of sampleUsers) {
      // Delete bundles
      const bundles = await ctx.db
        .query("bundles")
        .withIndex("by_userId", (q) =>
          q.eq("userId", user._id)
        )
        .collect();
      for (const b of bundles) {
        await ctx.db.delete(b._id);
        deletedBundles++;
      }

      // Delete profile views
      const views = await ctx.db
        .query("profileViews")
        .withIndex("by_userId", (q) =>
          q.eq("userId", user._id)
        )
        .collect();
      for (const v of views) {
        await ctx.db.delete(v._id);
        deletedViews++;
      }

      // Delete sources
      const sources = await ctx.db
        .query("sources")
        .withIndex("by_userId", (q) =>
          q.eq("userId", user._id)
        )
        .collect();
      for (const s of sources) {
        await ctx.db.delete(s._id);
      }

      // Delete context links
      const ctxLinks = await ctx.db
        .query("contextLinks")
        .withIndex("by_userId", (q) =>
          q.eq("userId", user._id)
        )
        .collect();
      for (const cl of ctxLinks) {
        await ctx.db.delete(cl._id);
      }

      // Delete API keys
      const apiKeys = await ctx.db
        .query("apiKeys")
        .withIndex("by_userId", (q) =>
          q.eq("userId", user._id)
        )
        .collect();
      for (const ak of apiKeys) {
        await ctx.db.delete(ak._id);
      }

      // Delete analysis artifacts
      const artifacts = await ctx.db
        .query("analysisArtifacts")
        .withIndex("by_userId", (q) =>
          q.eq("userId", user._id)
        )
        .collect();
      for (const a of artifacts) {
        await ctx.db.delete(a._id);
      }

      // Delete pipeline jobs
      const jobs = await ctx.db
        .query("pipelineJobs")
        .withIndex("by_userId", (q) =>
          q.eq("userId", user._id)
        )
        .collect();
      for (const j of jobs) {
        await ctx.db.delete(j._id);
      }

      // Delete the user
      await ctx.db.delete(user._id);
      deletedUsers++;
    }

    return {
      deletedUsers,
      deletedBundles,
      deletedViews,
      message:
        deletedUsers > 0
          ? `Cleaned up ${deletedUsers} sample users, ${deletedBundles} bundles, ${deletedViews} views`
          : "No sample profiles found",
    };
  },
});

/**
 * One-shot data hygiene pass for existing bundles.
 *
 * Scans every bundle in the database and strips out bad string values
 * that slipped in before bundle validation existed — specifically:
 *   - preferences.agent.tone starting with '#' (markdown leaking into
 *     a plain-text field)
 *   - project names starting with '#'
 *
 * Usage:
 *   npx convex run seed:cleanupBadProfileData
 */
export const cleanupBadProfileData = internalMutation({
  args: {},
  handler: async (ctx) => {
    const bundles = await ctx.db.query("bundles").collect();

    let fixedBundles = 0;
    let fixedTones = 0;
    let fixedProjectNames = 0;

    for (const bundle of bundles) {
      const youJson = bundle.youJson as Record<string, unknown> | undefined;
      if (!youJson) continue;

      let dirty = false;
      const patched: Record<string, unknown> = { ...youJson };

      // Fix preferences.agent.tone
      const prefs = patched.preferences as Record<string, unknown> | undefined;
      if (prefs && typeof prefs === "object") {
        const agent = prefs.agent as Record<string, unknown> | undefined;
        if (agent && typeof agent === "object") {
          const tone = agent.tone;
          if (typeof tone === "string" && tone.trim().startsWith("#")) {
            const newAgent = { ...agent, tone: "" };
            const newPrefs = { ...prefs, agent: newAgent };
            patched.preferences = newPrefs;
            dirty = true;
            fixedTones++;
          }
        }
      }

      // Fix project names
      const projects = patched.projects;
      if (Array.isArray(projects)) {
        let projectsDirty = false;
        const newProjects = projects.map((p) => {
          if (p && typeof p === "object") {
            const proj = p as Record<string, unknown>;
            const name = proj.name;
            if (typeof name === "string" && name.trim().startsWith("#")) {
              projectsDirty = true;
              fixedProjectNames++;
              return { ...proj, name: "" };
            }
          }
          return p;
        });
        if (projectsDirty) {
          patched.projects = newProjects;
          dirty = true;
        }
      }

      if (dirty) {
        await ctx.db.patch(bundle._id, { youJson: patched });
        fixedBundles++;
      }
    }

    return {
      scanned: bundles.length,
      fixedBundles,
      fixedTones,
      fixedProjectNames,
      message:
        fixedBundles > 0
          ? `Fixed ${fixedBundles} bundles (${fixedTones} tones, ${fixedProjectNames} project names)`
          : "No bad data found",
    };
  },
});

/**
 * Delete specific profiles by username — for removing old test/fake profiles
 * that were seeded without isSample:true and thus survive cleanupSampleProfiles.
 *
 * Usage: npx convex run seed:deleteProfilesByUsername
 */
export const deleteProfilesByUsername = internalMutation({
  args: { usernames: v.array(v.string()) },
  handler: async (ctx, { usernames }) => {
    const results: string[] = [];

    for (const username of usernames) {
      // Find the user
      const user = await ctx.db
        .query("users")
        .withIndex("by_username", (q) => q.eq("username", username))
        .first();

      if (!user) {
        results.push(`${username}: user not found`);
        // Still try to delete orphaned profile record
      }

      if (user) {
        // Delete bundles
        const bundles = await ctx.db.query("bundles").withIndex("by_userId", (q) => q.eq("userId", user._id)).collect();
        for (const b of bundles) await ctx.db.delete(b._id);

        // Delete profile views
        const views = await ctx.db.query("profileViews").withIndex("by_userId", (q) => q.eq("userId", user._id)).collect();
        for (const v of views) await ctx.db.delete(v._id);

        // Delete sources
        const sources = await ctx.db.query("sources").withIndex("by_userId", (q) => q.eq("userId", user._id)).collect();
        for (const s of sources) await ctx.db.delete(s._id);

        // Delete context links
        const ctxLinks = await ctx.db.query("contextLinks").withIndex("by_userId", (q) => q.eq("userId", user._id)).collect();
        for (const cl of ctxLinks) await ctx.db.delete(cl._id);

        // Delete API keys
        const apiKeys = await ctx.db.query("apiKeys").withIndex("by_userId", (q) => q.eq("userId", user._id)).collect();
        for (const ak of apiKeys) await ctx.db.delete(ak._id);

        // Delete analysis artifacts
        const artifacts = await ctx.db.query("analysisArtifacts").withIndex("by_userId", (q) => q.eq("userId", user._id)).collect();
        for (const a of artifacts) await ctx.db.delete(a._id);

        // Delete pipeline jobs
        const jobs = await ctx.db.query("pipelineJobs").withIndex("by_userId", (q) => q.eq("userId", user._id)).collect();
        for (const j of jobs) await ctx.db.delete(j._id);

        await ctx.db.delete(user._id);
      }

      // Delete profile record by username (covers cases where user was already deleted)
      const profile = await ctx.db.query("profiles").withIndex("by_username", (q) => q.eq("username", username)).first();
      if (profile) {
        await ctx.db.delete(profile._id);
        results.push(`${username}: deleted`);
      } else {
        results.push(`${username}: profile not found (user ${user ? "deleted" : "not found"})`);
      }
    }

    return results;
  },
});

/**
 * Generate and store server-side ASCII portraits for all sample profiles.
 * Fetches each avatarUrl, runs portrait generation, and patches the profile record.
 *
 * Usage: npx convex run seed:generatePortraitsForSamples
 */
export const generatePortraitsForSamples = internalAction({
  args: {},
  handler: async (ctx) => {
    const results: string[] = [];
    const profiles = await ctx.runQuery(internal.seed._listSampleProfiles, {});

    for (const profile of profiles) {
      if (!profile.avatarUrl) {
        results.push(`${profile.username}: no avatarUrl, skipping`);
        continue;
      }
      try {
        const result = await ctx.runAction(internal.portrait.generatePortrait, {
          imageUrl: profile.avatarUrl,
          cols: 120,
          format: "classic",
        });
        if (result.success && result.portrait) {
          await ctx.runMutation(internal.seed._patchProfilePortrait, {
            profileId: profile._id,
            portrait: { ...result.portrait, generatedAt: Date.now() },
          });
          results.push(`${profile.username}: portrait generated (${result.portrait.cols}x${result.portrait.rows})`);
        } else {
          results.push(`${profile.username}: failed — ${result.error}`);
        }
      } catch (err) {
        results.push(`${profile.username}: error — ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    return results;
  },
});

export const _listSampleProfiles = internalQuery({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    const sampleUsers = users.filter((u) => u.isSample === true);
    const profiles = [];
    for (const u of sampleUsers) {
      const p = await ctx.db.query("profiles").withIndex("by_username", (q) => q.eq("username", u.username)).first();
      if (p) profiles.push(p);
    }
    return profiles;
  },
});

export const _patchProfilePortrait = internalMutation({
  args: { profileId: v.id("profiles"), portrait: v.any() },
  handler: async (ctx, { profileId, portrait }) => {
    await ctx.db.patch(profileId, { asciiPortrait: portrait });
  },
});

// ── AI Leaders Seeding ────────────────────────────────────────
//
// Unclaimed public profiles for top AI/tech founders and influencers.
// These use the profiles table directly (no user record needed).
// Run: npx convex run seed:seedAiLeaders
// Dry run: npx convex run seed:seedAiLeaders '{"dryRun":true}'

const AI_LEADERS = [
  {
    username: "sama",
    name: "Sam Altman",
    tagline: "Building AGI that benefits all of humanity. CEO of OpenAI.",
    location: "San Francisco, CA",
    avatarUrl: "https://github.com/sama.png",
    links: { x: "https://x.com/sama", github: "https://github.com/sama", website: "https://blog.samaltman.com" },
    youJson: {
      identity: {
        bio: {
          short: "CEO of OpenAI. Former president of Y Combinator. Building artificial general intelligence — one of the most consequential technology bets in history.",
          medium: "Sam Altman co-founded OpenAI in 2015 and returned as CEO in 2023. Before that he ran Y Combinator from 2014–2019, funding thousands of startups including Airbnb, Dropbox, Stripe, and Coinbase.",
        },
        tagline: "Building AGI that benefits all of humanity. CEO of OpenAI.",
        location: "San Francisco, CA",
      },
      links: { x: "https://x.com/sama", github: "https://github.com/sama", website: "https://blog.samaltman.com" },
      projects: [
        { name: "OpenAI", description: "Leading AI safety and research company. Created GPT-4, ChatGPT, DALL-E, Sora, o1, and o3." },
        { name: "ChatGPT", description: "Fastest consumer product to 100M users in history. 500M+ weekly active users." },
        { name: "Worldcoin", description: "Global identity and financial network using iris biometrics." },
      ],
      now: { focus: ["GPT-5 development", "AGI safety research", "OpenAI enterprise expansion"] },
      tags: ["AI", "AGI", "OpenAI", "startups", "YC", "technology"],
    },
  },
  {
    username: "gdb",
    name: "Greg Brockman",
    tagline: "OpenAI President. Hacker at heart. Believes in building transformative AI.",
    location: "San Francisco, CA",
    avatarUrl: "https://github.com/gdb.png",
    links: { x: "https://x.com/gdb", github: "https://github.com/gdb", website: "https://gregbrockman.com" },
    youJson: {
      identity: {
        bio: {
          short: "President and co-founder of OpenAI. Led technical systems from GPT-1 through GPT-4. Former Stripe CTO at 22. MIT dropout turned AI infrastructure builder.",
          medium: "Greg Brockman built the technical substrate that made OpenAI's research possible — from GPT-1 through GPT-4. He joined OpenAI from Stripe where he'd been CTO since age 22, having left MIT before finishing his degree.",
        },
        tagline: "OpenAI President. Hacker at heart. Believes in building transformative AI.",
        location: "San Francisco, CA",
      },
      links: { x: "https://x.com/gdb", github: "https://github.com/gdb", website: "https://gregbrockman.com" },
      projects: [
        { name: "OpenAI", description: "Co-founded and led technical architecture for all major model releases." },
        { name: "Stripe", description: "Early engineering leader. CTO at 22. Helped scale from seed to unicorn." },
      ],
      now: { focus: ["OpenAI research direction", "AGI infrastructure", "technical leadership"] },
      tags: ["AI", "OpenAI", "engineering", "startups", "infrastructure"],
    },
  },
  {
    username: "hwchase17",
    name: "Harrison Chase",
    tagline: "Co-founder of LangChain. Building the tooling layer for LLM applications.",
    location: "San Francisco, CA",
    avatarUrl: "https://github.com/hwchase17.png",
    links: { x: "https://x.com/hwchase17", github: "https://github.com/hwchase17", website: "https://www.langchain.com" },
    youJson: {
      identity: {
        bio: {
          short: "Co-founder and CEO of LangChain — the most widely-used open-source framework for LLM applications. Built as a side project in late 2022; now one of the fastest-growing GitHub repos in history.",
          medium: "Harrison Chase created LangChain while working at Robust Intelligence. Within months it became the default way to build LLM applications. LangChain now powers thousands of production AI systems.",
        },
        tagline: "Co-founder of LangChain. Building the tooling layer for LLM applications.",
        location: "San Francisco, CA",
      },
      links: { x: "https://x.com/hwchase17", github: "https://github.com/hwchase17", website: "https://www.langchain.com" },
      projects: [
        { name: "LangChain", description: "Most popular framework for building LLM apps. 90k+ GitHub stars, Python and JS." },
        { name: "LangSmith", description: "Production observability platform for LLM applications." },
        { name: "LangGraph", description: "Framework for building stateful, multi-actor agentic applications." },
      ],
      now: { focus: ["LangSmith production monitoring", "LangGraph agent framework", "LLM application infrastructure"] },
      tags: ["LLMs", "AI infrastructure", "Python", "agents", "open source"],
    },
  },
  {
    username: "ylecun",
    name: "Yann LeCun",
    tagline: "Meta AI Chief Scientist. Invented CNNs. Turing Award 2018. Open AI advocate.",
    location: "New York, NY",
    avatarUrl: "https://unavatar.io/x/ylecun",
    links: { x: "https://x.com/ylecun", website: "https://yann.lecun.com" },
    youJson: {
      identity: {
        bio: {
          short: "VP and Chief AI Scientist at Meta. NYU Professor. Turing Award winner (2018). Invented convolutional neural networks in the 1980s. One of the founding fathers of modern deep learning.",
          medium: "Yann LeCun invented CNNs and demonstrated them for digit recognition at Bell Labs in the late 1980s. He won the Turing Award alongside Bengio and Hinton in 2018. He leads FAIR, Meta's AI research lab, and is one of AI's most prominent open-source advocates.",
        },
        tagline: "Meta AI Chief Scientist. Invented CNNs. Turing Award 2018. Open AI advocate.",
        location: "New York, NY",
      },
      links: { x: "https://x.com/ylecun", website: "https://yann.lecun.com" },
      projects: [
        { name: "Meta AI Research (FAIR)", description: "Leading fundamental AI research including LLaMA, Segment Anything, ImageBind." },
        { name: "LLaMA", description: "Meta's open-source large language model series — democratizing frontier AI access." },
      ],
      now: { focus: ["World model research", "JEPA (Joint Embedding Predictive Architecture)", "open-source AI advocacy"] },
      tags: ["AI", "deep learning", "research", "Meta AI", "CNNs", "Turing Award", "open source"],
    },
  },
  {
    username: "jeremyphoward",
    name: "Jeremy Howard",
    tagline: "Making deep learning accessible. fast.ai founder. World's top Kaggle competitor.",
    location: "San Francisco, CA",
    avatarUrl: "https://github.com/jph00.png",
    links: { x: "https://x.com/jeremyphoward", github: "https://github.com/jph00", website: "https://www.fast.ai" },
    youJson: {
      identity: {
        bio: {
          short: "Co-founder of fast.ai. Creator of fastai and nbdev. Kaggle's #1 ranked competitor (2014). Former Kaggle president. Building deep learning education for everyone.",
          medium: "Jeremy Howard co-founded fast.ai to make deep learning accessible without sacrificing rigor. The free fast.ai courses have taught hundreds of thousands worldwide. He created nbdev to make Jupyter notebooks first-class dev environments.",
        },
        tagline: "Making deep learning accessible. fast.ai founder. World's top Kaggle competitor.",
        location: "San Francisco, CA",
      },
      links: { x: "https://x.com/jeremyphoward", github: "https://github.com/jph00", website: "https://www.fast.ai" },
      projects: [
        { name: "fast.ai", description: "Free top-down deep learning courses. Taught hundreds of thousands worldwide." },
        { name: "fastai", description: "High-level deep learning library on top of PyTorch." },
        { name: "nbdev", description: "Literate programming system in Jupyter notebooks — exports to production-quality libraries." },
      ],
      now: { focus: ["AI education accessibility", "practical AI research", "open-source AI tools"] },
      tags: ["deep learning", "education", "open source", "Python", "PyTorch", "Kaggle"],
    },
  },
  {
    username: "emollick",
    name: "Ethan Mollick",
    tagline: "Wharton professor. Co-Intelligence author. One Useful Thing blogger.",
    location: "Philadelphia, PA",
    avatarUrl: "https://unavatar.io/x/emollick",
    links: { x: "https://x.com/emollick", website: "https://www.oneusefulthing.org" },
    youJson: {
      identity: {
        bio: {
          short: "Associate Professor at Wharton. Studies AI, entrepreneurship, and innovation. Author of Co-Intelligence: Living and Working with AI. Writes One Useful Thing — one of the most-read AI newsletters.",
          medium: "Ethan Mollick researches how AI changes work and education. His practical experiments with AI tools have reached millions of readers. He argues most people drastically underestimate how capable current AI systems are.",
        },
        tagline: "Wharton professor. Co-Intelligence author. One Useful Thing blogger.",
        location: "Philadelphia, PA",
      },
      links: { x: "https://x.com/emollick", website: "https://www.oneusefulthing.org" },
      projects: [
        { name: "One Useful Thing", description: "Newsletter on AI, innovation, and the future of work. Millions of readers." },
        { name: "Co-Intelligence", description: "Book on living and working with AI as a collaborator, not just a tool." },
      ],
      now: { focus: ["AI in education research", "human-AI collaboration experiments", "Wharton AI curriculum"] },
      tags: ["AI", "education", "research", "Wharton", "future of work", "LLMs"],
    },
  },
  {
    username: "swyx",
    name: "Shawn Wang",
    tagline: "Learning in public. AI engineer, writer, and co-host of Latent Space.",
    location: "San Francisco, CA",
    avatarUrl: "https://github.com/sw-yx.png",
    links: { x: "https://x.com/swyx", github: "https://github.com/sw-yx", website: "https://www.swyx.io" },
    youJson: {
      identity: {
        bio: {
          short: "AI engineer, writer, and co-host of the Latent Space podcast. Founded smol.ai. Coined 'Learn in Public.' Former Stripe and AWS engineer. Wrote The Coding Career Handbook.",
          medium: "Shawn Wang coined 'Learn in Public' — a philosophy of learning-by-sharing that spread across engineering. He hosts Latent Space (top AI podcast) and builds AI tools. Formerly engineering at Stripe and AWS.",
        },
        tagline: "Learning in public. AI engineer, writer, and co-host of Latent Space.",
        location: "San Francisco, CA",
      },
      links: { x: "https://x.com/swyx", github: "https://github.com/sw-yx", website: "https://www.swyx.io" },
      projects: [
        { name: "Latent Space", description: "Top AI engineer podcast. Deep technical interviews with AI researchers and builders." },
        { name: "smol.ai", description: "AI developer tools. smol-developer was one of the first viral agent demos." },
        { name: "AI Engineer Summit", description: "Conference for AI engineers — bridging research and production." },
      ],
      now: { focus: ["Latent Space podcast", "AI engineering community", "smol.ai tooling"] },
      tags: ["AI engineering", "community", "developer tools", "podcasting", "open source"],
    },
  },
  {
    username: "svpino",
    name: "Santiago Valdarrama",
    tagline: "Simplifying machine learning for 1M+ developers. ML educator and builder.",
    location: "Miami, FL",
    avatarUrl: "https://github.com/svpino.png",
    links: { x: "https://x.com/svpino", github: "https://github.com/svpino", website: "https://tidepool.so" },
    youJson: {
      identity: {
        bio: {
          short: "ML educator with 1M+ followers across X and LinkedIn. Co-founder of Tidepool. Former Principal Engineer at Apple. Known for visual ML explanations that make complex concepts instantly understandable.",
          medium: "Santiago built one of the largest ML education audiences on X by explaining complex concepts through clear, visual diagrams. He co-founded Tidepool to bring AI capabilities to enterprise teams.",
        },
        tagline: "Simplifying machine learning for 1M+ developers. ML educator and builder.",
        location: "Miami, FL",
      },
      links: { x: "https://x.com/svpino", github: "https://github.com/svpino", website: "https://tidepool.so" },
      projects: [
        { name: "Tidepool", description: "Making AI accessible for enterprise teams without ML expertise." },
        { name: "ML visual education", description: "1M+ followers learning ML through visual diagrams and explanations." },
      ],
      now: { focus: ["ML education at scale", "Tidepool enterprise AI platform", "making AI approachable for everyone"] },
      tags: ["machine learning", "education", "AI", "Python", "enterprise", "data science"],
    },
  },
  {
    username: "rileytomasek",
    name: "Riley Tomasek",
    tagline: "Building AI-native products and sharing what works in production.",
    location: "San Francisco, CA",
    avatarUrl: "https://github.com/rileytomasek.png",
    links: { x: "https://x.com/rileytomasek", github: "https://github.com/rileytomasek" },
    youJson: {
      identity: {
        bio: {
          short: "Early AI application developer. Known for building and openly sharing insights about working with LLMs in production systems.",
          medium: "Riley Tomasek has been building AI applications since the early days of the LLM wave. He shares practical engineering insights about what works and what doesn't when shipping AI products.",
        },
        tagline: "Building AI-native products and sharing what works in production.",
        location: "San Francisco, CA",
      },
      links: { x: "https://x.com/rileytomasek", github: "https://github.com/rileytomasek" },
      projects: [],
      now: { focus: ["AI-native product development", "LLM engineering", "building in public"] },
      tags: ["AI", "LLMs", "product engineering", "TypeScript"],
    },
  },
  {
    username: "danshipper",
    name: "Dan Shipper",
    tagline: "Co-founder of Every. Building AI tools for how knowledge workers think.",
    location: "New York, NY",
    avatarUrl: "https://unavatar.io/x/danshipper",
    links: { x: "https://x.com/danshipper", website: "https://every.to" },
    youJson: {
      identity: {
        bio: {
          short: "Co-founder and CEO of Every — a bundle of AI-powered newsletters and tools for knowledge workers. Built Lex (AI writing editor) and Spiral. Writes about AI, cognition, and how thinking works.",
          medium: "Dan Shipper built Every into a profitable media and tools business by combining smart writers with AI experiments. He was early on every major AI wave and writes some of the clearest thinking about what AI means for knowledge work.",
        },
        tagline: "Co-founder of Every. Building AI tools for how knowledge workers think.",
        location: "New York, NY",
      },
      links: { x: "https://x.com/danshipper", website: "https://every.to" },
      projects: [
        { name: "Every", description: "Bundle of AI-powered newsletters and tools for curious, ambitious people. $1M+ ARR." },
        { name: "Lex", description: "AI writing editor. One of the first AI writing tools to ship." },
        { name: "Spiral", description: "AI tool for structured thinking and sense-making." },
      ],
      now: { focus: ["Every AI product suite", "AI cognition research", "extending human intelligence"] },
      tags: ["AI", "writing", "productivity", "media", "knowledge work", "tools"],
    },
  },
  {
    username: "gregisenberg",
    name: "Greg Isenberg",
    tagline: "Building and investing in internet communities. Late Checkout founder.",
    location: "Miami, FL",
    avatarUrl: "https://unavatar.io/x/gregisenberg",
    links: { x: "https://x.com/gregisenberg", website: "https://www.gregisenberg.com" },
    youJson: {
      identity: {
        bio: {
          short: "Founder of Late Checkout, a product studio. Angel investor. Built and sold communities to Reddit, WeHeartIt, and others. Known for generating startup ideas live in public and teaching community-led growth.",
          medium: "Greg Isenberg built and sold multiple internet communities to Reddit, Apple, and TikTok before founding Late Checkout. He teaches community-first growth and generates AI startup ideas publicly.",
        },
        tagline: "Building and investing in internet communities. Late Checkout founder.",
        location: "Miami, FL",
      },
      links: { x: "https://x.com/gregisenberg", website: "https://www.gregisenberg.com" },
      projects: [
        { name: "Late Checkout", description: "Product studio and community for internet entrepreneurs." },
        { name: "Community-led growth playbook", description: "Framework for building internet communities as defensible business moats." },
      ],
      now: { focus: ["AI startup ideas in public", "Late Checkout studio", "community-first growth investing"] },
      tags: ["community", "startups", "AI", "internet businesses", "growth", "angel investing"],
    },
  },
  {
    username: "linusekenstam",
    name: "Linus Ekenstam",
    tagline: "Designing the future of human-AI interfaces. Visual AI explorer.",
    location: "Stockholm, Sweden",
    avatarUrl: "https://unavatar.io/x/LinusEkenstam",
    links: { x: "https://x.com/LinusEkenstam" },
    youJson: {
      identity: {
        bio: {
          short: "Designer and builder focused on AI interfaces. Shares visual explorations of AI tools and thoughtful commentary on where AI meets design. Influential voice on X in the AI design space.",
          medium: "Linus Ekenstam explores the design frontier of AI products through visual essays and experiments. He's built a large following for his thoughtful, visual perspective on human-AI interaction design.",
        },
        tagline: "Designing the future of human-AI interfaces. Visual AI explorer.",
        location: "Stockholm, Sweden",
      },
      links: { x: "https://x.com/LinusEkenstam" },
      projects: [],
      now: { focus: ["AI interface design exploration", "human-AI interaction research", "visual AI product critique"] },
      tags: ["design", "AI", "UX", "interfaces", "product", "visual design"],
    },
  },
  {
    username: "alexandrwang",
    name: "Alexandr Wang",
    tagline: "CEO and founder of Scale AI. Built the data infrastructure powering frontier AI.",
    location: "San Francisco, CA",
    avatarUrl: "https://unavatar.io/x/alexandr_wang",
    links: { x: "https://x.com/alexandr_wang", website: "https://scale.com" },
    youJson: {
      identity: {
        bio: {
          short: "Founder and CEO of Scale AI — the data platform powering OpenAI, Microsoft, Meta, and the US government. Founded Scale at 19 after dropping out of MIT. Youngest self-made billionaire in US history.",
          medium: "Alexandr Wang founded Scale AI in 2016, starting with data labeling and expanding into the full AI development lifecycle. Scale is now one of the most critical AI infrastructure companies, with government and frontier model contracts.",
        },
        tagline: "CEO and founder of Scale AI. Built the data infrastructure powering frontier AI.",
        location: "San Francisco, CA",
      },
      links: { x: "https://x.com/alexandr_wang", website: "https://scale.com" },
      projects: [
        { name: "Scale AI", description: "AI data platform — labeling, evals, RLHF data, and model development infrastructure." },
      ],
      now: { focus: ["Scale AI enterprise", "government AI contracts", "frontier model evaluation infrastructure"] },
      tags: ["AI", "data infrastructure", "Scale AI", "startups", "national security"],
    },
  },
  {
    username: "saranormous",
    name: "Sarah Guo",
    tagline: "Conviction Capital founder. AI-native investor. No Priors podcast host.",
    location: "San Francisco, CA",
    avatarUrl: "https://unavatar.io/x/saranormous",
    links: { x: "https://x.com/saranormous", website: "https://conviction.com" },
    youJson: {
      identity: {
        bio: {
          short: "Founder of Conviction Capital, an AI-native venture fund. Former Greylock partner. Co-host of No Priors podcast. Backed some of the most important AI-native companies from day zero.",
          medium: "Sarah Guo left Greylock to start Conviction Capital, focused entirely on AI-native companies. She co-hosts No Priors, one of the leading AI research and entrepreneurship podcasts.",
        },
        tagline: "Conviction Capital founder. AI-native investor. No Priors podcast host.",
        location: "San Francisco, CA",
      },
      links: { x: "https://x.com/saranormous", website: "https://conviction.com" },
      projects: [
        { name: "Conviction Capital", description: "AI-native venture fund. Backs the best AI founders from day zero." },
        { name: "No Priors", description: "Top AI podcast on research, products, and entrepreneurship." },
      ],
      now: { focus: ["AI startup investing", "No Priors podcast", "Conviction portfolio companies"] },
      tags: ["AI", "venture capital", "investing", "startups", "podcasting"],
    },
  },
  {
    username: "clemdelangue",
    name: "Clement Delangue",
    tagline: "Co-founder and CEO of Hugging Face. The GitHub of machine learning.",
    location: "New York, NY",
    avatarUrl: "https://github.com/ClementDelangue.png",
    links: { x: "https://x.com/ClementDelangue", github: "https://github.com/ClementDelangue", website: "https://huggingface.co" },
    youJson: {
      identity: {
        bio: {
          short: "Co-founder and CEO of Hugging Face — the platform where the AI community collaborates on models, datasets, and applications. 500K+ models hosted. $4.5B valuation.",
          medium: "Clement Delangue co-founded Hugging Face in 2016 as a chatbot app and pivoted it into the dominant AI model hub. Today it's the default place to find, share, and run open-source AI models.",
        },
        tagline: "Co-founder and CEO of Hugging Face. The GitHub of machine learning.",
        location: "New York, NY",
      },
      links: { x: "https://x.com/ClementDelangue", website: "https://huggingface.co" },
      projects: [
        { name: "Hugging Face", description: "GitHub of ML — 500K+ models, 150K datasets, collaborative AI development platform." },
        { name: "Transformers", description: "State-of-the-art ML library. 130K+ GitHub stars." },
      ],
      now: { focus: ["open AI ecosystem", "Hugging Face Hub growth", "enterprise AI platform"] },
      tags: ["AI", "open source", "Hugging Face", "machine learning", "transformers"],
    },
  },
  {
    username: "reidhoffman",
    name: "Reid Hoffman",
    tagline: "LinkedIn co-founder. Greylock. OpenAI board. Author of Blitzscaling.",
    location: "Palo Alto, CA",
    avatarUrl: "https://unavatar.io/x/reidhoffman",
    links: { x: "https://x.com/reidhoffman", website: "https://www.reidhoffman.org" },
    youJson: {
      identity: {
        bio: {
          short: "Co-founder of LinkedIn (acquired by Microsoft for $26B). Partner at Greylock. Former OpenAI board member. Author of Blitzscaling and The Startup of You. Philosopher of the professional internet.",
          medium: "Reid Hoffman co-founded LinkedIn and grew it into the world's largest professional network. He coined 'blitzscaling' — the strategy of scaling startups faster than feels comfortable when market conditions allow.",
        },
        tagline: "LinkedIn co-founder. Greylock. OpenAI board. Author of Blitzscaling.",
        location: "Palo Alto, CA",
      },
      links: { x: "https://x.com/reidhoffman", website: "https://www.reidhoffman.org" },
      projects: [
        { name: "LinkedIn", description: "Co-founded and built the world's professional network. $26B Microsoft acquisition." },
        { name: "Inflection AI", description: "Co-founded AI company. Built Pi personal AI assistant." },
        { name: "Blitzscaling", description: "Book and framework for scaling startups at extreme pace." },
      ],
      now: { focus: ["AI governance and policy", "Greylock AI portfolio", "AI and society research"] },
      tags: ["AI", "venture capital", "LinkedIn", "startups", "technology", "governance"],
    },
  },
  {
    username: "natfriedman",
    name: "Nat Friedman",
    tagline: "Former GitHub CEO. NFDG. Betting on ambitious founders and hard science.",
    location: "San Francisco, CA",
    avatarUrl: "https://github.com/nat.png",
    links: { x: "https://x.com/natfriedman", github: "https://github.com/nat", website: "https://nat.org" },
    youJson: {
      identity: {
        bio: {
          short: "Former CEO of GitHub (2018–2021). Co-founder of NFDG with Daniel Gross. Built Xamarin (acquired by Microsoft). Launched GitHub Copilot. Now backing ambitious AI and scientific projects.",
          medium: "Nat Friedman led GitHub through its Microsoft integration and launched GitHub Copilot — the first widely-used AI coding assistant. He now runs NFDG backing ambitious technical founders. Most recently organized the Vesuvius Challenge which decoded ancient scrolls.",
        },
        tagline: "Former GitHub CEO. NFDG. Betting on ambitious founders and hard science.",
        location: "San Francisco, CA",
      },
      links: { x: "https://x.com/natfriedman", github: "https://github.com/nat", website: "https://nat.org" },
      projects: [
        { name: "GitHub Copilot", description: "Launched as GitHub CEO — the first AI coding assistant at scale." },
        { name: "NFDG", description: "Investment and advisory firm with Daniel Gross. AI and scientific computing." },
        { name: "Vesuvius Challenge", description: "Prize competition to decode volcanic scrolls from Herculaneum. Succeeded." },
      ],
      now: { focus: ["NFDG investments", "scientific computing", "moonshot technology bets"] },
      tags: ["AI", "GitHub", "investing", "science", "open source", "technology"],
    },
  },
  {
    username: "andrewng",
    name: "Andrew Ng",
    tagline: "AI Fund. deeplearning.ai. Coursera co-founder. Making AI accessible globally.",
    location: "Palo Alto, CA",
    avatarUrl: "https://unavatar.io/x/AndrewYNg",
    links: { x: "https://x.com/AndrewYNg", website: "https://www.deeplearning.ai" },
    youJson: {
      identity: {
        bio: {
          short: "Co-founder of Google Brain. Former Chief Scientist at Baidu. Co-founder of Coursera. Founder of AI Fund and deeplearning.ai. Reached 7M+ learners through AI courses. One of the most important AI educators of the 21st century.",
          medium: "Andrew Ng co-founded Google Brain and led AI at Baidu before starting deeplearning.ai and AI Fund. His ML course on Coursera was taken by 4M+ students and sparked a generation of AI practitioners. He's a relentless democratizer of AI education.",
        },
        tagline: "AI Fund. deeplearning.ai. Coursera co-founder. Making AI accessible globally.",
        location: "Palo Alto, CA",
      },
      links: { x: "https://x.com/AndrewYNg", website: "https://www.deeplearning.ai" },
      projects: [
        { name: "deeplearning.ai", description: "World's leading AI education platform. 7M+ learners across 190+ countries." },
        { name: "AI Fund", description: "Venture studio building AI-powered companies from scratch." },
        { name: "Coursera", description: "Co-founded the MOOC platform that brought university education to everyone." },
        { name: "Google Brain", description: "Co-founded Google's deep learning research division." },
      ],
      now: { focus: ["AI education at scale", "AI Fund portfolio companies", "agentic AI research"] },
      tags: ["AI", "machine learning", "education", "Coursera", "deeplearning", "startups"],
    },
  },
  {
    username: "darioamodei",
    name: "Dario Amodei",
    tagline: "Co-founder and CEO of Anthropic. AI safety researcher. Building Claude.",
    location: "San Francisco, CA",
    avatarUrl: "https://unavatar.io/x/DarioAmodei",
    links: { x: "https://x.com/DarioAmodei", website: "https://www.anthropic.com" },
    youJson: {
      identity: {
        bio: {
          short: "Co-founder and CEO of Anthropic — the AI safety company behind Claude. Former VP of Research at OpenAI. PhD in computational neuroscience from Princeton. Believes safety and capability are complementary, not opposed.",
          medium: "Dario Amodei led research at OpenAI before co-founding Anthropic in 2021 with his sister Daniela and other OpenAI researchers. Anthropic created Claude, one of the most capable and safest AI assistants.",
        },
        tagline: "Co-founder and CEO of Anthropic. AI safety researcher. Building Claude.",
        location: "San Francisco, CA",
      },
      links: { x: "https://x.com/DarioAmodei", website: "https://www.anthropic.com" },
      projects: [
        { name: "Anthropic", description: "AI safety company. Creator of Claude — advanced, helpful, harmless, and honest AI." },
        { name: "Claude", description: "Anthropic's AI assistant. Leading in safety, reasoning, and code generation." },
      ],
      now: { focus: ["Claude development", "AI safety research", "constitutional AI"] },
      tags: ["AI", "AI safety", "Anthropic", "Claude", "research", "alignment"],
    },
  },
  {
    username: "ilyasut",
    name: "Ilya Sutskever",
    tagline: "Co-founder of Safe Superintelligence Inc. Ex-OpenAI Chief Scientist.",
    location: "San Francisco, CA",
    avatarUrl: "https://unavatar.io/x/ilyasut",
    links: { x: "https://x.com/ilyasut" },
    youJson: {
      identity: {
        bio: {
          short: "Co-founder of Safe Superintelligence Inc (SSI). Former Chief Scientist and co-founder of OpenAI. Student of Geoffrey Hinton. Co-created AlexNet (2012) which sparked the deep learning revolution.",
          medium: "Ilya Sutskever is one of the most respected AI researchers alive. He co-created AlexNet with Hinton and Krizhevsky, sparking the modern deep learning era. He was Chief Scientist at OpenAI for nearly a decade before founding SSI to focus entirely on safe superintelligence.",
        },
        tagline: "Co-founder of Safe Superintelligence Inc. Ex-OpenAI Chief Scientist.",
        location: "San Francisco, CA",
      },
      links: { x: "https://x.com/ilyasut" },
      projects: [
        { name: "Safe Superintelligence Inc (SSI)", description: "New AI safety company with singular focus: building safe superintelligence." },
        { name: "OpenAI", description: "Co-founded OpenAI. Chief Scientist from 2016–2024. Drove GPT-4 and RLHF research." },
        { name: "AlexNet", description: "Won ImageNet 2012 by a massive margin. Triggered the deep learning revolution." },
      ],
      now: { focus: ["Safe superintelligence research", "SSI team building", "AI alignment at scale"] },
      tags: ["AI", "AI safety", "deep learning", "alignment", "SSI", "research"],
    },
  },
];

/**
 * Seed unclaimed public profiles for top AI leaders.
 * Creates profile records in the profiles table (no user account needed).
 *
 * Usage:
 *   npx convex run seed:seedAiLeaders
 *   npx convex run seed:seedAiLeaders '{"dryRun":true}'
 */
export const seedAiLeaders = internalMutation({
  args: {
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const dryRun = args.dryRun ?? false;
    const results: Array<{ username: string; status: string; id?: string }> = [];

    for (const leader of AI_LEADERS) {
      const uname = leader.username.toLowerCase();

      // Check if already exists in profiles table
      const existing = await ctx.db
        .query("profiles")
        .withIndex("by_username", (q) => q.eq("username", uname))
        .first();

      if (existing) {
        results.push({ username: uname, status: "exists" });
        continue;
      }

      // Check if exists in users table (claimed account) — skip those
      const existingUser = await ctx.db
        .query("users")
        .withIndex("by_username", (q) => q.eq("username", uname))
        .first();

      if (existingUser) {
        results.push({ username: uname, status: "user_exists_skip" });
        continue;
      }

      if (dryRun) {
        results.push({ username: uname, status: "would_create" });
        continue;
      }

      const id = await ctx.db.insert("profiles", {
        username: uname,
        name: leader.name,
        tagline: leader.tagline,
        location: leader.location,
        avatarUrl: leader.avatarUrl,
        links: leader.links,
        youJson: leader.youJson,
        isClaimed: false,
        createdAt: Date.now(),
      });

      results.push({ username: uname, status: "created", id: id.toString() });
    }

    return {
      total: AI_LEADERS.length,
      created: results.filter((r) => r.status === "created").length,
      existed: results.filter((r) => r.status === "exists").length,
      skipped: results.filter((r) => r.status === "user_exists_skip").length,
      wouldCreate: results.filter((r) => r.status === "would_create").length,
      results,
    };
  },
});

/**
 * Remove duplicate profiles — keep the richest record per username.
 * Dry-run by default (safe).
 *
 * Usage:
 *   npx convex run seed:cleanDuplicates '{"dryRun":false}'
 */
export const cleanDuplicates = internalMutation({
  args: {
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const dryRun = args.dryRun ?? true;
    const profiles = await ctx.db.query("profiles").order("desc").take(500);

    type Profile = (typeof profiles)[0];
    const byUsername: Record<string, Profile[]> = {};
    for (const p of profiles) {
      const key = p.username.toLowerCase();
      if (!byUsername[key]) byUsername[key] = [];
      byUsername[key].push(p);
    }

    const report: Array<{ username: string; count: number; kept: string; deleted: string[] }> = [];

    for (const username of Object.keys(byUsername)) {
      const dupes = byUsername[username];
      if (dupes.length <= 1) continue;

      type Scored = { p: Profile; score: number };
      const scored: Scored[] = dupes.map((p: Profile) => ({
        p,
        score:
          (p.youJson ? 10 : 0) +
          (p.isClaimed ? 5 : 0) +
          (p.avatarUrl ? 2 : 0) +
          (p.tagline ? 1 : 0),
      })).sort((a: Scored, b: Scored) => b.score - a.score);

      const keep = scored[0].p;
      const toDelete = scored.slice(1).map((s: Scored) => s.p);

      const deletedIds: string[] = [];
      for (const dup of toDelete) {
        if (!dryRun) await ctx.db.delete(dup._id);
        deletedIds.push(dup._id.toString());
      }

      report.push({ username, count: dupes.length, kept: keep._id.toString(), deleted: deletedIds });
    }

    return { dryRun, duplicatesFound: report.length, report };
  },
});

// ── Profile QA + Enrichment ───────────────────────────────────
//
// Resolves real avatar photos from GitHub/X and generates ASCII portraits
// for all unclaimed profiles.
//
// Avatar resolution (real photos only — no letter/generated avatars):
//   1. GitHub handle present → https://github.com/{handle}.png (forces PNG, never WebP)
//   2. X/Twitter handle present (no GitHub) → unavatar.io/x/{handle} with API key
//      (redirects to pbs.twimg.com JPEG — handles JPEG format correctly)
//   3. Neither → unavatar.io/{username} generic lookup
//
// Run (all profiles, skip existing portraits):
//   npx convex run seed:enrichAndQaAllProfiles
//
// Force regenerate portraits for everyone (e.g. after avatar URL fixes):
//   npx convex run seed:enrichAndQaAllProfiles '{"forceRegenerate":true}'
//
// Dry run (just show what would change):
//   npx convex run seed:enrichAndQaAllProfiles '{"dryRun":true}'

function githubHandleFromLinks(links: Record<string, string> | undefined): string | null {
  if (!links?.github) return null;
  const match = links.github.match(/github\.com\/([^/?#]+)/);
  return match ? match[1] : null;
}

function xHandleFromLinks(links: Record<string, string> | undefined): string | null {
  if (!links?.x) return null;
  const match = links.x.match(/(?:x|twitter)\.com\/([^/?#]+)/);
  return match ? match[1] : null;
}

function resolveAvatarUrl(
  profile: { username: string; name?: string; avatarUrl?: string; links?: Record<string, string>; youJson?: unknown },
  unavatarApiKey: string
): { url: string; source: string } {
  const links = (profile.links ?? {}) as Record<string, string>;
  const youJsonLinks = ((profile.youJson as Record<string, unknown>)?.links ?? {}) as Record<string, string>;

  // GitHub handle → force PNG (GitHub CDN serves WebP by default, but .png extension forces PNG)
  const ghHandle = githubHandleFromLinks(links) ?? githubHandleFromLinks(youJsonLinks);
  if (ghHandle) {
    return { url: `https://github.com/${ghHandle}.png`, source: "github_png" };
  }

  // X/Twitter handle → unavatar.io/x (redirects to pbs.twimg.com JPEG)
  const xHandle = xHandleFromLinks(links) ?? xHandleFromLinks(youJsonLinks);
  if (xHandle) {
    const apiParam = unavatarApiKey ? `?apiKey=${unavatarApiKey}` : "";
    return { url: `https://unavatar.io/x/${xHandle}${apiParam}`, source: "unavatar_x" };
  }

  // Existing avatarUrl if it's not a letter/generated avatar
  if (profile.avatarUrl &&
      !profile.avatarUrl.includes("ui-avatars.com") &&
      !profile.avatarUrl.includes("unavatar.io/twitter/")) {
    return { url: profile.avatarUrl, source: "existing" };
  }

  // Generic unavatar lookup by username as last real-photo attempt
  const apiParam = unavatarApiKey ? `?apiKey=${unavatarApiKey}` : "";
  return { url: `https://unavatar.io/${profile.username}${apiParam}`, source: "unavatar_generic" };
}

export const _listAllUnclaimedProfiles = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("profiles")
      .filter((q) => q.eq(q.field("isClaimed"), false))
      .order("asc")
      .take(500);
  },
});

export const _patchProfileAvatar = internalMutation({
  args: { profileId: v.id("profiles"), avatarUrl: v.string() },
  handler: async (ctx, { profileId, avatarUrl }) => {
    await ctx.db.patch(profileId, { avatarUrl });
  },
});

// One-time: fix danshipper's links to remove the non-existent GitHub handle
export const _fixDanShipperLinks = internalMutation({
  args: {},
  handler: async (ctx) => {
    const p = await ctx.db.query("profiles").withIndex("by_username", (q) => q.eq("username", "danshipper")).first();
    if (!p) return "not found";
    const youJson = p.youJson as Record<string, unknown> | undefined;
    const updatedLinks = { x: "https://x.com/danshipper", website: "https://every.to" };
    await ctx.db.patch(p._id, {
      links: updatedLinks,
      youJson: youJson ? { ...youJson, links: updatedLinks } : undefined,
    });
    return "patched";
  },
});

interface QaResult {
  username: string;
  name: string;
  avatarResolved: string;
  avatarSource: string;
  portraitStatus: string;
}

export const enrichAndQaAllProfiles = internalAction({
  args: {
    dryRun: v.optional(v.boolean()),
    forceRegenerate: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<{
    total: number;
    generated: number;
    skipped: number;
    failed: number;
    avatarUpdated: number;
    results: QaResult[];
  }> => {
    const dryRun = args.dryRun ?? false;
    const forceRegenerate = args.forceRegenerate ?? false;
    const unavatarApiKey = process.env.UNAVATAR_API_KEY ?? "";
    const results: QaResult[] = [];

    const profiles = await ctx.runQuery(internal.seed._listAllUnclaimedProfiles, {});

    for (const profile of profiles) {
      // ── Step 1: resolve real avatar URL (no letter/generated avatars) ──
      const { url: resolvedAvatarUrl, source: avatarSource } = resolveAvatarUrl(profile, unavatarApiKey);

      const avatarChanged = resolvedAvatarUrl !== profile.avatarUrl;
      const hasPortrait = !!profile.asciiPortrait;

      // ── Step 2: skip if portrait exists and nothing changed ──────────
      if (hasPortrait && !forceRegenerate && !avatarChanged) {
        results.push({
          username: profile.username,
          name: profile.name ?? profile.username,
          avatarResolved: resolvedAvatarUrl,
          avatarSource,
          portraitStatus: "skipped_exists",
        });
        continue;
      }

      if (dryRun) {
        results.push({
          username: profile.username,
          name: profile.name ?? profile.username,
          avatarResolved: resolvedAvatarUrl,
          avatarSource,
          portraitStatus: hasPortrait ? "would_regenerate" : "would_generate",
        });
        continue;
      }

      // ── Step 3: update avatarUrl in DB if we resolved a better one ───
      if (avatarChanged) {
        await ctx.runMutation(internal.seed._patchProfileAvatar, {
          profileId: profile._id,
          avatarUrl: resolvedAvatarUrl,
        });
      }

      // ── Step 4: generate portrait ─────────────────────────────────────
      // avatarSource order: github_png → JPEG/PNG ✓
      //                     unavatar_x → redirects to pbs.twimg.com JPEG ✓
      //                     existing / unavatar_generic → try as-is
      // If the format is WebP (needsClientSide), the browser's AsciiAvatar
      // component handles it client-side when the user visits the profile page.
      // We do NOT fall back to fake generated images.
      try {
        const result = await ctx.runAction(internal.portrait.generatePortrait, {
          imageUrl: resolvedAvatarUrl,
          cols: 120,
          format: "classic",
        });

        if (result.success && result.portrait) {
          await ctx.runMutation(internal.seed._patchProfilePortrait, {
            profileId: profile._id,
            portrait: { ...result.portrait, generatedAt: Date.now() },
          });
          results.push({
            username: profile.username,
            name: profile.name ?? profile.username,
            avatarResolved: resolvedAvatarUrl,
            avatarSource,
            portraitStatus: `generated (${result.portrait.cols}x${result.portrait.rows})`,
          });
        } else if (result.needsClientSide) {
          // Real photo is set — portrait will be generated client-side when profile is visited
          results.push({
            username: profile.username,
            name: profile.name ?? profile.username,
            avatarResolved: resolvedAvatarUrl,
            avatarSource,
            portraitStatus: `needs_client_side (avatar set, portrait via browser)`,
          });
        } else {
          results.push({
            username: profile.username,
            name: profile.name ?? profile.username,
            avatarResolved: resolvedAvatarUrl,
            avatarSource,
            portraitStatus: `failed: ${result.error}`,
          });
        }
      } catch (err) {
        results.push({
          username: profile.username,
          name: profile.name ?? profile.username,
          avatarResolved: resolvedAvatarUrl,
          avatarSource,
          portraitStatus: `error: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    }

    return {
      total: profiles.length,
      generated: results.filter((r) => r.portraitStatus.startsWith("generated")).length,
      skipped: results.filter((r) => r.portraitStatus.startsWith("skipped")).length,
      failed: results.filter((r) =>
        r.portraitStatus.startsWith("failed") ||
        r.portraitStatus.startsWith("error") ||
        r.portraitStatus.startsWith("needs_client_side")
      ).length,
      avatarUpdated: results.filter((r) => r.avatarSource !== "existing").length,
      results,
    };
  },
});
