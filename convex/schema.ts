import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    username: v.string(),
    email: v.string(),
    displayName: v.optional(v.string()),
    plan: v.union(v.literal("free"), v.literal("pro")),
    isSample: v.optional(v.boolean()),
    createdAt: v.number(),
  })
    .index("by_username", ["username"])
    .index("by_clerkId", ["clerkId"])
    .index("by_email", ["email"]),

  // ── Profiles (can exist without auth) ──────────────────────
  profiles: defineTable({
    username: v.string(),
    name: v.string(),
    tagline: v.optional(v.string()),
    location: v.optional(v.string()),
    bio: v.optional(v.object({
      short: v.optional(v.string()),
      medium: v.optional(v.string()),
      long: v.optional(v.string()),
    })),
    links: v.optional(v.any()), // Record<string, string>
    avatarUrl: v.optional(v.string()),
    socialImages: v.optional(v.object({
      x: v.optional(v.string()),
      github: v.optional(v.string()),
      linkedin: v.optional(v.string()),
      custom: v.optional(v.string()),
    })),
    primaryImage: v.optional(v.string()), // "x" | "github" | "linkedin" | "custom"

    // Ownership — null until claimed
    ownerId: v.optional(v.id("users")),
    isClaimed: v.boolean(),
    claimedAt: v.optional(v.number()),

    // Session token for pre-auth editing
    sessionToken: v.optional(v.string()),

    // Embedded identity bundle (moved to bundles table after claim)
    youJson: v.optional(v.any()),
    youMd: v.optional(v.string()),

    // Profile data from agent conversation
    now: v.optional(v.array(v.string())),
    projects: v.optional(v.array(v.any())),
    values: v.optional(v.array(v.string())),
    preferences: v.optional(v.any()),

    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  })
    .index("by_username", ["username"])
    .index("by_ownerId", ["ownerId"])
    .index("by_sessionToken", ["sessionToken"])
    .index("by_isClaimed", ["isClaimed"]),

  // ── Profile reports ────────────────────────────────────────
  profileReports: defineTable({
    profileId: v.id("profiles"),
    reason: v.string(), // "impersonation" | "spam" | "offensive" | "private_info" | "duplicate" | "other"
    details: v.optional(v.string()),
    status: v.string(), // "pending" | "reviewed" | "resolved"
    createdAt: v.number(),
  })
    .index("by_profileId", ["profileId"])
    .index("by_status", ["status"]),

  // ── Security logs ──────────────────────────────────────────
  securityLogs: defineTable({
    eventType: v.string(), // "profile_created" | "profile_claimed" | "profile_reported" | "token_created" | "token_revoked" | "profile_updated"
    profileId: v.optional(v.id("profiles")),
    userId: v.optional(v.id("users")),
    details: v.optional(v.any()),
    createdAt: v.number(),
  })
    .index("by_profileId", ["profileId"])
    .index("by_eventType", ["eventType"]),

  // ── Profile verifications ──────────────────────────────────
  profileVerifications: defineTable({
    profileId: v.id("profiles"),
    method: v.string(), // "domain" | "social" | "email" | "manual"
    platform: v.optional(v.string()),
    verifiedAt: v.number(),
    isActive: v.boolean(),
    metadata: v.optional(v.any()),
  })
    .index("by_profileId", ["profileId"]),

  // ── Agent interactions (track which agents connect) ──────────
  agentInteractions: defineTable({
    profileId: v.id("profiles"),
    agentName: v.string(), // "Claude Code", "Cursor", "ChatGPT", "Codex", "Perplexity", "Custom Agent"
    agentType: v.string(), // "read" | "write" | "chat"
    interactionCount: v.number(),
    lastInteractionAt: v.number(),
    metadata: v.optional(v.any()), // extra context about the agent
    createdAt: v.number(),
  })
    .index("by_profileId", ["profileId"])
    .index("by_agentName", ["agentName"]),

  // ── Private context (owner-only, token-accessible) ──────────
  privateContext: defineTable({
    profileId: v.id("profiles"),
    // Private identity data — never exposed via public routes
    privateNotes: v.optional(v.string()),
    privateProjects: v.optional(v.array(v.any())),
    internalLinks: v.optional(v.any()), // Record<string, string>
    calendarContext: v.optional(v.string()),
    communicationPrefs: v.optional(v.any()),
    investmentThesis: v.optional(v.string()),
    customData: v.optional(v.any()), // freeform JSON for anything else
    updatedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_profileId", ["profileId"]),

  // ── Access tokens (for agent/app access to private data) ───
  accessTokens: defineTable({
    profileId: v.id("profiles"),
    name: v.string(),
    tokenHash: v.string(), // SHA-256 hash of the raw token
    scopes: v.array(v.string()), // ["read", "write"] or ["read"]
    expiresAt: v.optional(v.number()),
    isRevoked: v.boolean(),
    lastUsedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_profileId", ["profileId"])
    .index("by_tokenHash", ["tokenHash"]),

  // ── Existing tables (unchanged) ────────────────────────────

  bundles: defineTable({
    userId: v.id("users"),
    profileId: v.optional(v.id("profiles")),
    version: v.number(),
    schemaVersion: v.string(),
    manifest: v.any(),
    youJson: v.any(),
    youMd: v.string(),
    pageTemplate: v.optional(v.string()),
    isPublished: v.boolean(),
    createdAt: v.number(),
    publishedAt: v.optional(v.number()),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_version", ["userId", "version"])
    .index("by_profileId", ["profileId"]),

  sources: defineTable({
    userId: v.id("users"),
    sourceType: v.string(),
    sourceUrl: v.string(),
    rawStorageId: v.optional(v.id("_storage")),
    extracted: v.optional(v.any()),
    status: v.union(
      v.literal("pending"),
      v.literal("fetching"),
      v.literal("fetched"),
      v.literal("extracting"),
      v.literal("extracted"),
      v.literal("failed")
    ),
    lastFetched: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_type", ["userId", "sourceType"]),

  // artifactType: "author_voice" | "topic_map" | "bio_variants" | "faq"
  //             | "voice_linkedin" | "voice_linkedin_doc"
  //             | "voice_x" | "voice_blog"
  analysisArtifacts: defineTable({
    userId: v.id("users"),
    artifactType: v.string(), // see types above
    content: v.any(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_type", ["userId", "artifactType"]),

  apiKeys: defineTable({
    userId: v.id("users"),
    keyHash: v.string(),
    label: v.optional(v.string()),
    scopes: v.array(v.string()),
    lastUsedAt: v.optional(v.number()),
    revokedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_keyHash", ["keyHash"]),

  privateVault: defineTable({
    userId: v.id("users"),
    encryptedMd: v.bytes(),
    encryptedJson: v.bytes(),
    iv: v.bytes(),
  }).index("by_userId", ["userId"]),

  pipelineJobs: defineTable({
    userId: v.id("users"),
    sourceId: v.optional(v.id("sources")),
    stage: v.union(
      v.literal("discover"),
      v.literal("fetch"),
      v.literal("extract"),
      v.literal("analyze"),
      v.literal("compile"),
      v.literal("review")
    ),
    status: v.union(
      v.literal("queued"),
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed")
    ),
    errorMessage: v.optional(v.string()),
    retryCount: v.number(),
    createdAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_status", ["status"]),

  profileViews: defineTable({
    userId: v.id("users"),
    profileId: v.optional(v.id("profiles")),
    viewedAt: v.number(),
    referrer: v.optional(v.string()),
    isAgentRead: v.boolean(),
    isContextLink: v.optional(v.boolean()),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_date", ["userId", "viewedAt"])
    .index("by_profileId", ["profileId"]),

  contextLinks: defineTable({
    userId: v.id("users"),
    profileId: v.optional(v.id("profiles")),
    token: v.string(),
    scope: v.union(v.literal("public"), v.literal("full")),
    expiresAt: v.optional(v.number()),
    maxUses: v.optional(v.number()),
    useCount: v.number(),
    revokedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_token", ["token"])
    .index("by_userId", ["userId"])
    .index("by_profileId", ["profileId"]),

  // ── Memories (unified brain — auto-captured from conversations) ──
  memories: defineTable({
    userId: v.id("users"),
    category: v.string(), // "fact" | "insight" | "decision" | "preference" | "context" | "goal" | "relationship"
    content: v.string(), // the actual memory content
    source: v.string(), // "you-agent" | "cli" | "external-agent" | "manual"
    sourceAgent: v.optional(v.string()), // agent name if from external agent
    tags: v.optional(v.array(v.string())), // searchable tags
    sessionId: v.optional(v.string()), // which chat session produced this
    isArchived: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_category", ["userId", "category"])
    .index("by_userId_archived", ["userId", "isArchived"])
    .index("by_sessionId", ["sessionId"]),

  // ── Chat sessions (conversation history) ──────────────────────
  chatSessions: defineTable({
    userId: v.id("users"),
    sessionId: v.string(), // unique session identifier
    surface: v.string(), // "web" | "cli" | "api"
    summary: v.optional(v.string()), // auto-generated session summary
    messageCount: v.number(),
    lastMessageAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_sessionId", ["sessionId"]),

  // ── Chat messages (persisted conversation for session restore) ───
  chatMessages: defineTable({
    userId: v.id("users"),
    sessionId: v.string(),
    // Store the full display messages array as JSON — simpler than individual rows
    // and supports the exact shape the frontend needs (DisplayMessage[])
    displayMessages: v.array(v.object({
      id: v.string(),
      role: v.string(), // "user" | "assistant" | "system-notice"
      content: v.string(),
    })),
    // Also store the LLM conversation messages for context restoration
    llmMessages: v.array(v.object({
      role: v.string(), // "system" | "user" | "assistant"
      content: v.string(),
    })),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_sessionId", ["sessionId"]),
});
