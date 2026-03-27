/**
 * Seed script for sample profiles.
 *
 * Usage:
 *   npx convex run seed:seedSampleProfiles   — insert sample users + published bundles
 *   npx convex run seed:cleanupSampleProfiles — delete all sample data
 *
 * All sample users are flagged with isSample: true for easy cleanup.
 */
import { mutation } from "./_generated/server";
import {
  ProfileData,
  compileYouJson,
  compileYouMd,
  compileManifest,
} from "./lib/compile";

interface SeedProfile extends ProfileData {
  email: string;
}

const SAMPLE_PROFILES: SeedProfile[] = [
  {
    name: "Houston Golden",
    username: "houstong",
    email: "sample-houstong@you.md",
    tagline: "Founder, BAMF Media. Building You.md.",
    location: "Miami, FL",
    bio: {
      short:
        "Founder building the identity context protocol for the agent internet.",
      medium:
        "Founded BAMF Media (8-figure growth agency), LinkedIn growth pioneer. Now building You.md \u2014 the identity context protocol for the agent internet. I ship fast and build in public.",
    },
    now: [
      "Building You.md",
      "Scaling BAMF Media",
      "Refining identity context protocol",
    ],
    projects: [
      {
        name: "You.md",
        role: "Founder",
        status: "building",
        description: "Identity as code for the agent internet.",
        url: "https://you.md",
      },
      {
        name: "BAMF Media",
        role: "Founder/CEO",
        status: "active",
        description: "Growth marketing agency.",
      },
    ],
    values: ["Build in public", "Extreme ownership", "Ship fast"],
    links: {
      website: "https://houstongolden.com",
      linkedin: "https://linkedin.com/in/houstongolden",
      x: "https://x.com/houstongolden",
    },
    preferences: {
      agent: {
        tone: "direct, confident, no fluff",
        formality: "casual-professional",
        avoid: ["corporate jargon", "passive voice"],
      },
      writing: { format: "short paragraphs, punchy sentences" },
    },
    analysis: {
      topics: ["growth marketing", "AI agents", "identity protocols"],
      voice_summary: "Direct, high-energy, founder-coded.",
      credibility_signals: [
        "Founded BAMF Media (8-figure agency)",
        "LinkedIn growth pioneer",
        "Speaker at 20+ conferences",
      ],
    },
  },
  {
    name: "Priya Sharma",
    username: "priya",
    email: "sample-priya@you.md",
    tagline: "ML engineer @ Anthropic. Alignment researcher.",
    location: "London, UK",
    bio: {
      short: "Research engineer focused on RLHF and alignment.",
      medium:
        "ML engineer at Anthropic working on RLHF and alignment research. I think in probability distributions and communicate in analogies. Weekend ceramicist. Published 12 papers on reward modeling.",
    },
    now: [
      "Publishing alignment paper Q2",
      "Open-sourcing eval framework",
    ],
    projects: [
      {
        name: "Reward Landscapes",
        role: "Lead researcher",
        status: "publishing",
        description:
          "Novel approach to multi-objective reward modeling.",
      },
      {
        name: "EvalKit",
        role: "Creator",
        status: "building",
        description: "Open-source LLM evaluation framework.",
      },
    ],
    values: ["Rigorous thinking", "Open science", "Making AI safe"],
    links: {
      scholar: "#",
      github: "#",
    },
    preferences: {
      agent: {
        tone: "precise, curious, grounded",
        formality: "academic-casual",
        avoid: ["hype language", "unsubstantiated claims"],
      },
      writing: {
        format: "structured with headers, as long as needed for precision",
      },
    },
    analysis: {
      topics: [
        "RLHF",
        "alignment",
        "reward modeling",
        "open-source ML",
      ],
      voice_summary:
        "Technical but approachable, loves analogies.",
      credibility_signals: [
        "ML Engineer at Anthropic",
        "12 published papers on reward modeling",
        "Top 1% cited in ML safety",
      ],
    },
  },
  {
    name: "Jordan Marcus",
    username: "jmarcus",
    email: "sample-jmarcus@you.md",
    tagline: "Indie hacker. 3 exits. Building in public.",
    location: "Austin, TX",
    bio: {
      short: "Building micro-SaaS products in public.",
      medium:
        "3 exits, 12 failed projects, infinite lessons. Currently running ScreenshotAPI ($8k MRR) and TinyInvoice ($4k MRR). I document everything and believe the best marketing is building in public.",
    },
    now: [
      "Hit $20k MRR across products",
      "Launch AI writing tool",
    ],
    projects: [
      {
        name: "ScreenshotAPI",
        role: "Solo founder",
        status: "active",
        description: "Website screenshot API.",
      },
      {
        name: "TinyInvoice",
        role: "Solo founder",
        status: "active",
        description: "Invoice generator for freelancers.",
      },
    ],
    values: [
      "Ship daily",
      "Revenue over fundraising",
      "Transparency",
    ],
    links: {
      x: "#",
      blog: "#",
      products: "#",
    },
    preferences: {
      agent: {
        tone: "casual, encouraging, practical",
        formality: "very casual",
        avoid: ["corporate speak", "long intros"],
      },
      writing: {
        format:
          "short paragraphs, lots of examples, tweet-length when possible",
      },
    },
    analysis: {
      topics: [
        "indie hacking",
        "micro-SaaS",
        "building in public",
        "solopreneurship",
      ],
      voice_summary:
        "Casual, emoji-friendly, shipping energy.",
      credibility_signals: [
        "3 successful exits",
        "$12k+ combined MRR across products",
      ],
    },
  },
  {
    name: "Yuki Sato",
    username: "sato-yuki",
    email: "sample-sato-yuki@you.md",
    tagline: "Staff engineer @ Stripe. Distributed systems.",
    location: "Tokyo, Japan",
    bio: {
      short:
        "Distributed systems at scale. Correctness over cleverness.",
      medium:
        "Staff engineer at Stripe working on payment routing infrastructure. I care about correctness, observability, and well-written RFCs. Maintaining two popular open-source Rust crates with 5k+ combined stars.",
    },
    now: [
      "Migrating payment routing to new architecture",
      "Writing a technical book on distributed systems",
    ],
    projects: [
      {
        name: "tokio-retry",
        role: "Maintainer",
        status: "active",
        description: "Retry middleware for Tokio.",
      },
      {
        name: "serde-diff",
        role: "Creator",
        status: "active",
        description: "Structural diffing for Serde types.",
      },
    ],
    values: [
      "Correctness first",
      "Write it down",
      "Mentor generously",
    ],
    links: {
      github: "#",
      blog: "#",
    },
    preferences: {
      agent: {
        tone: "precise, thorough, occasionally wry",
        formality: "professional",
        avoid: [
          "hand-waving",
          "premature optimization claims",
        ],
      },
      writing: {
        format: "RFC-style with tradeoff analysis, thorough",
      },
    },
    analysis: {
      topics: [
        "distributed systems",
        "Rust",
        "observability",
        "payment infrastructure",
      ],
      voice_summary:
        "Precise, systems-thinking, dry humor.",
      credibility_signals: [
        "Staff Engineer at Stripe",
        "5k+ stars on open-source Rust crates",
        "Published in OSDI",
      ],
    },
  },
  {
    name: "Emma Wright",
    username: "emmawright",
    email: "sample-emmawright@you.md",
    tagline:
      "Creative director. Brand strategist. Strong feelings about kerning.",
    location: "Brooklyn, NY",
    bio: {
      short: "Making brands feel like they have a soul.",
      medium:
        "Creative director working with startups and cultural institutions. Previously at Pentagram. I believe every brand has a story worth telling \u2014 most just haven\u2019t found the right words yet. Strong feelings about kerning.",
    },
    now: [
      "Launching rebrand for a climate tech startup",
      "Teaching brand workshop series",
    ],
    projects: [
      {
        name: "Canopy Rebrand",
        role: "Creative Director",
        status: "building",
        description:
          "Full brand identity for climate tech startup.",
      },
      {
        name: "Brand Bones",
        role: "Instructor",
        status: "launching",
        description:
          "Workshop series on brand fundamentals.",
      },
    ],
    values: [
      "Story over aesthetics",
      "Bold over safe",
      "Details matter",
    ],
    links: {
      portfolio: "#",
      instagram: "#",
      "are.na": "#",
    },
    preferences: {
      agent: {
        tone: "warm, opinionated, visual",
        formality: "casual-creative",
        avoid: [
          "bland corporate language",
          "design-by-committee thinking",
        ],
      },
      writing: {
        format:
          "visual moodboards + concise briefs, enough to spark \u2014 not to lecture",
      },
    },
    analysis: {
      topics: [
        "brand strategy",
        "creative direction",
        "visual identity",
        "storytelling",
      ],
      voice_summary:
        "Visual thinker, storytelling-first, bold opinions.",
      credibility_signals: [
        "Previously at Pentagram",
        "Worked with 40+ startups on brand identity",
      ],
    },
  },
  {
    name: "Kai Andersen",
    username: "kai",
    email: "sample-kai@you.md",
    tagline: "DevRel lead @ Vercel. 50k YouTube subscribers.",
    location: "Copenhagen, Denmark",
    bio: {
      short: "Helping developers build faster.",
      medium:
        "DevRel lead at Vercel. Conference speaker, tutorial creator, and eternal optimist about the web platform. 50k+ YouTube subscribers. I believe the best docs are the ones people actually enjoy reading.",
    },
    now: [
      "Launching new docs platform",
      "Keynote prep for React Conf",
    ],
    projects: [
      {
        name: "Vercel Docs v3",
        role: "Lead",
        status: "building",
        description: "Next-gen documentation platform.",
      },
      {
        name: "Ship It",
        role: "Host",
        status: "active",
        description:
          "YouTube series on web dev. 50k subs.",
      },
    ],
    values: [
      "Teach by building",
      "Community first",
      "Make it fun",
    ],
    links: {
      youtube: "#",
      x: "#",
      github: "#",
    },
    preferences: {
      agent: {
        tone: "enthusiastic, clear, encouraging",
        formality: "casual",
        avoid: [
          "gatekeeping language",
          "unnecessary jargon",
        ],
      },
      writing: {
        format: "step-by-step with code examples",
      },
    },
    analysis: {
      topics: [
        "developer relations",
        "Next.js",
        "web platform",
        "content creation",
      ],
      voice_summary:
        "Enthusiastic, educational, community-driven.",
      credibility_signals: [
        "DevRel Lead at Vercel",
        "50k+ YouTube subscribers",
        "React Conf keynote speaker",
      ],
    },
  },
];

export const seedSampleProfiles = mutation({
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

      results.push(
        `${profile.username}: created user + published bundle`
      );
    }

    return results;
  },
});

export const cleanupSampleProfiles = mutation({
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
