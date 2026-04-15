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
            portrait: result.portrait,
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
