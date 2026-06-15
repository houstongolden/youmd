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

  authChallenges: defineTable({
    email: v.string(),
    type: v.union(v.literal("login"), v.literal("signup")),
    codeHash: v.string(),
    tokenHash: v.string(),
    username: v.optional(v.string()),
    displayName: v.optional(v.string()),
    expiresAt: v.number(),
    usedAt: v.optional(v.number()),
    attempts: v.number(),
    createdAt: v.number(),
  })
    .index("by_email", ["email"])
    .index("by_tokenHash", ["tokenHash"]),

  authSessions: defineTable({
    userId: v.id("users"),
    tokenHash: v.string(),
    expiresAt: v.number(),
    userAgent: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
    lastUsedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_tokenHash", ["tokenHash"])
    .index("by_userId", ["userId"]),

  // ── Device-flow auth requests (U7, RFC 8628-shaped) ─────────
  // One row per `youmd login` device-flow attempt. The CLI holds the secret
  // deviceCode (256-bit, never displayed); the user carries the short
  // userCode to https://you.md/device in an authenticated browser session.
  // Both codes are stored as SHA-256 hashes only (same approach as apiKeys).
  // State machine: pending → approved → consumed (key minted exactly once),
  // or pending → denied/expired. Expired and denied rows are detected and
  // deleted at read time (poll/lookup) — no cron.
  deviceAuthRequests: defineTable({
    deviceCodeHash: v.string(), // sha256 hex of the secret device code
    userCodeHash: v.string(),   // sha256 hex of the normalized user code
    status: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("denied"),
      v.literal("expired"),
      v.literal("consumed")
    ),
    // Bound on approval — the authenticated web user who approved the device.
    userId: v.optional(v.id("users")),
    clientName: v.optional(v.string()), // e.g. "youmd CLI on darwin"
    expiresAt: v.number(),
    approvedAt: v.optional(v.number()),
    consumedAt: v.optional(v.number()),
    // Poll pacing — polls faster than the advertised interval get slow_down.
    lastPolledAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_deviceCodeHash", ["deviceCodeHash"])
    .index("by_userCodeHash", ["userCodeHash"]),

  // ── GitHub OAuth connections ───────────────────────────────
  // Backs free GitHub sign-up and the "host your You.md in your own repo"
  // story. One row per user. Holds the GitHub identity (used to resolve the
  // account on every OAuth login), the encrypted OAuth access token (so we
  // can create/read/write the user's repo and clone it server-side for the
  // agentic/API/MCP surfaces), and the metadata for the linked You.md repo.
  githubConnections: defineTable({
    userId: v.id("users"),

    // GitHub identity (numeric id is the stable key; login can change)
    githubUserId: v.number(),
    githubLogin: v.string(),
    githubName: v.optional(v.string()),
    githubEmail: v.optional(v.string()),
    githubAvatarUrl: v.optional(v.string()),

    // OAuth token, encrypted at rest (AES-GCM, same secret as apiKeys).
    accessTokenEncrypted: v.optional(v.string()),
    accessTokenIv: v.optional(v.string()),
    scopes: v.array(v.string()),
    tokenType: v.optional(v.string()),

    // Linked You.md repo — set when the user connects or creates a repo.
    repoFullName: v.optional(v.string()),    // "owner/you-md"
    repoVisibility: v.optional(v.string()),  // "public" | "private"
    repoDefaultBranch: v.optional(v.string()),
    repoConnectedAt: v.optional(v.number()),

    // Server-side mirror/sync bookkeeping.
    lastSyncedSha: v.optional(v.string()),
    lastSyncedAt: v.optional(v.number()),

    // P17 (PRODUCT-AUDIT #19) — debounced auto-push + mirror ancestry.
    // pendingPushAt: when the currently scheduled auto-push will run; saves
    // inside that window do NOT schedule another push (debounce gate).
    pendingPushAt: v.optional(v.number()),
    // The commit sha we last wrote to the repo (push-time ancestry anchor).
    // Unlike lastSyncedSha (which the pull path overwrites with a file blob
    // sha), this is ALWAYS a commit sha recorded at push time.
    lastPushedCommitSha: v.optional(v.string()),
    // Set when the repo/mirror head moved past lastPushedCommitSha (manual
    // user pushes count). Reads prefer canonical Convex content while set;
    // the next successful auto-push force-updates the repo and clears it.
    mirrorStale: v.optional(v.boolean()),
    // Last auto-push failure (observability; cleared on success).
    lastPushError: v.optional(v.string()),
    lastPushErrorAt: v.optional(v.number()),

    // GitHub webhook id for the linked repo (auto-pull on external push).
    webhookId: v.optional(v.number()),

    // GitHub App installation id (Phase 5). When set + the App is configured,
    // repo ops use fine-grained, short-lived installation tokens instead of the
    // broad OAuth token.
    installationId: v.optional(v.number()),
    // Cached installation token (encrypted) + expiry, to avoid minting one per
    // op. Refreshed when within ~1 min of expiry.
    installationTokenEnc: v.optional(v.string()),
    installationTokenIv: v.optional(v.string()),
    installationTokenExp: v.optional(v.number()),

    connectedAt: v.number(),
    updatedAt: v.optional(v.number()),
  })
    .index("by_userId", ["userId"])
    .index("by_githubUserId", ["githubUserId"])
    .index("by_repoFullName", ["repoFullName"])
    .index("by_installationId", ["installationId"]),

  // ── Server-side repo mirror (Phase 4) ──────────────────────
  // A snapshot of the user's You.md repo tree (identity files + stacks/**),
  // refreshed on pull/webhook, so the agentic/API/MCP surfaces can read from
  // our servers without hitting GitHub per request. One row per user.
  repoMirror: defineTable({
    userId: v.id("users"),
    repoFullName: v.string(),
    commitSha: v.optional(v.string()),
    files: v.array(
      v.object({
        path: v.string(),
        content: v.string(),
        size: v.number(),
      })
    ),
    fileCount: v.number(),
    totalBytes: v.number(),
    truncated: v.boolean(), // some files skipped due to caps
    syncedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_repoFullName", ["repoFullName"]),

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

    // Pre-rendered ASCII portrait (generated client-side, stored server-side)
    asciiPortrait: v.optional(v.object({
      lines: v.array(v.string()),           // plain text ASCII lines
      coloredLines: v.optional(v.any()),     // array of [{char, color}] for rich rendering
      cols: v.number(),
      rows: v.number(),
      format: v.string(),                   // "classic" | "braille" | "block" | "minimal"
      sourceUrl: v.string(),
      generatedAt: v.number(),
    })),

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
    .index("by_isClaimed", ["isClaimed"])
    // Full-text search over display names for MCP search_profiles (audit
    // 2026-06-11 P1 #16). Username prefix matching uses by_username; this
    // index covers fuzzy/name discovery without loading the whole table.
    .searchIndex("search_name", { searchField: "name" }),

  // ── Public profile source ledger ───────────────────────────
  // Tracks crawler/enrichment provenance for unclaimed public profiles. The
  // profile record stays the renderable/public surface; this table explains
  // which URLs were consulted, whether they changed, and when they should be
  // refreshed without re-spending on unchanged sources.
  profileSources: defineTable({
    username: v.string(),
    profileId: v.optional(v.id("profiles")),
    url: v.string(),
    platform: v.string(), // "github" | "x" | "website" | "linkedin" | ...
    sourceType: v.string(), // "profile" | "personal_site" | "company" | "social" | ...
    priority: v.number(),
    status: v.string(), // "queued" | "current" | "changed" | "failed" | "skipped"
    contentHash: v.optional(v.string()),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    lastFetchedAt: v.optional(v.number()),
    lastChangedAt: v.optional(v.number()),
    nextRefreshAt: v.optional(v.number()),
    fetchCostCents: v.optional(v.number()),
    qualityScore: v.optional(v.number()),
    failureCount: v.optional(v.number()),
    lastError: v.optional(v.string()),
    metadata: v.optional(v.any()),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  })
    .index("by_username", ["username"])
    .index("by_profileId", ["profileId"])
    .index("by_status_nextRefreshAt", ["status", "nextRefreshAt"])
    .index("by_platform", ["platform"]),

  profileRefreshJobs: defineTable({
    username: v.string(),
    profileId: v.optional(v.id("profiles")),
    sourceId: v.optional(v.id("profileSources")),
    kind: v.string(), // "import" | "fetch" | "extract" | "enrich" | "portrait"
    status: v.string(), // "queued" | "running" | "succeeded" | "failed" | "skipped"
    priority: v.number(),
    scheduledFor: v.number(),
    attempts: v.number(),
    maxAttempts: v.number(),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    lastError: v.optional(v.string()),
    result: v.optional(v.any()),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  })
    .index("by_status_scheduledFor", ["status", "scheduledFor"])
    .index("by_username", ["username"])
    .index("by_kind_status", ["kind", "status"]),

  profileImportBatches: defineTable({
    batchKey: v.string(),
    targetSegment: v.string(),
    status: v.string(), // "dry_run" | "imported" | "failed"
    dryRun: v.boolean(),
    total: v.number(),
    created: v.number(),
    patched: v.number(),
    skipped: v.number(),
    failed: v.number(),
    results: v.any(),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  })
    .index("by_batchKey", ["batchKey"])
    .index("by_status", ["status"]),

  // ── Profile reports ────────────────────────────────────────
  profileReports: defineTable({
    profileId: v.id("profiles"),
    reporterId: v.optional(v.id("users")), // cycle 39: track who reported (rate-limit + abuse detection)
    reason: v.string(), // "impersonation" | "spam" | "offensive" | "private_info" | "duplicate" | "other"
    details: v.optional(v.string()),
    status: v.string(), // "pending" | "reviewed" | "resolved"
    createdAt: v.number(),
  })
    .index("by_profileId", ["profileId"])
    .index("by_status", ["status"])
    .index("by_reporterId", ["reporterId"]),

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
    // Content-addressed version control
    contentHash: v.optional(v.string()), // SHA-256 of canonical(youJson) + youMd
    parentHash: v.optional(v.string()),  // contentHash of the parent bundle
    // Change tracking
    source: v.optional(v.string()),      // "web-shell" | "cli" | "api" | "agent:<name>"
    changeNote: v.optional(v.string()),  // human-readable description of what changed
    changedSections: v.optional(v.array(v.string())), // which sections were modified
  })
    .index("by_userId", ["userId"])
    .index("by_userId_version", ["userId", "version"])
    .index("by_profileId", ["profileId"])
    .index("by_contentHash", ["contentHash"]),

  sources: defineTable({
    userId: v.id("users"),
    sourceType: v.string(),
    sourceUrl: v.string(),
    displayName: v.optional(v.string()),
    connectorKind: v.optional(v.string()), // "url" | "github" | "rss" | "okf" | "webhook" | "json" | ...
    crawlerProvider: v.optional(v.string()), // "native" | "firecrawl" | "agent-browser" | "manual"
    refreshPolicy: v.optional(v.string()), // "manual" | "hourly" | "daily" | "weekly" | "monthly"
    visibility: v.optional(v.string()), // "private" | "scoped" | "public"
    trustLevel: v.optional(v.string()), // "low" | "medium" | "high" | "verified"
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
    lastChangedAt: v.optional(v.number()),
    nextRefreshAt: v.optional(v.number()),
    failureCount: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
    metadata: v.optional(v.any()),
    // Immutable-source tracking (additive): content-address the latest fetch and
    // point at its append-only version row. Raw content is versioned, not
    // overwritten in place.
    lastRawContentHash: v.optional(v.string()),
    latestVersionId: v.optional(v.id("rawSourceVersions")),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_type", ["userId", "sourceType"])
    .index("by_nextRefreshAt", ["nextRefreshAt"]),

  // Append-only ledger of raw source fetches. A new row is written only when a
  // fetch produces content that differs from the latest stored hash, so prior
  // versions are never lost and every extraction can cite its exact origin.
  rawSourceVersions: defineTable({
    sourceId: v.id("sources"),
    userId: v.id("users"),
    sourceUrl: v.string(),
    rawStorageId: v.optional(v.id("_storage")),
    contentHash: v.string(),
    fetchedAt: v.number(),
  })
    .index("by_sourceId", ["sourceId"])
    .index("by_contentHash", ["contentHash"]),

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
    encryptedKey: v.optional(v.string()),
    keyIv: v.optional(v.string()),
    label: v.optional(v.string()),
    scopes: v.array(v.string()),
    lastUsedAt: v.optional(v.number()),
    revokedAt: v.optional(v.number()),
    // Cycle 56: optional expiry. New keys default to 365 days. Existing
    // keys without expiresAt continue working indefinitely (backward-compat).
    expiresAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_keyHash", ["keyHash"]),

  // ── Connected-app grants ───────────────────────────────────
  // Product/app-level grants are distinct from owner API keys. They let the
  // owner authorize a named app, host, or integration to read/write specific
  // personal API/MCP resources with expiry, revocation, and audit metadata.
  connectedAppGrants: defineTable({
    userId: v.id("users"),
    appSlug: v.string(),
    appName: v.string(),
    appType: v.string(), // "first_party" | "third_party" | "local_agent" | "mcp_client" | "custom"
    tokenHash: v.string(),
    scopes: v.array(v.string()), // "identity:read", "sources:write", ...
    resourceScopes: v.array(v.string()), // "identity", "now", "projects", "sources", ...
    writePolicy: v.string(), // "read_only" | "propose" | "approved_write"
    trustLevel: v.string(), // "low" | "medium" | "high" | "verified"
    expiresAt: v.optional(v.number()),
    revokedAt: v.optional(v.number()),
    lastUsedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
    metadata: v.optional(v.any()),
  })
    .index("by_userId", ["userId"])
    .index("by_tokenHash", ["tokenHash"])
    .index("by_userId_appSlug", ["userId", "appSlug"]),

  privateVault: defineTable({
    userId: v.id("users"),
    encryptedMd: v.optional(v.bytes()),
    encryptedJson: v.optional(v.bytes()),
    iv: v.optional(v.bytes()),
    // Vault key wrapped with user's passphrase (for web recovery)
    wrappedVaultKey: v.optional(v.bytes()),
    vaultSalt: v.optional(v.bytes()),
    vaultKeyIv: v.optional(v.bytes()),
    createdAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
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
    userId: v.optional(v.id("users")),
    profileId: v.optional(v.id("profiles")),
    viewedAt: v.number(),
    referrer: v.optional(v.string()),
    isAgentRead: v.boolean(),
    isContextLink: v.optional(v.boolean()),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_date", ["userId", "viewedAt"])
    .index("by_profileId", ["profileId"])
    .index("by_profileId_date", ["profileId", "viewedAt"]),

  contextLinks: defineTable({
    userId: v.id("users"),
    profileId: v.optional(v.id("profiles")),
    name: v.optional(v.string()), // optional memorable name (e.g. "hiring" or "for-acme")
    token: v.string(),
    scope: v.union(v.literal("public"), v.literal("full")),
    expiresAt: v.optional(v.number()),
    maxUses: v.optional(v.number()),
    useCount: v.number(),
    lastUsedAt: v.optional(v.number()),
    revokedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_token", ["token"])
    .index("by_userId", ["userId"])
    .index("by_profileId", ["profileId"]),

  // ── Memories (unified brain — auto-captured from conversations) ──
  memories: defineTable({
    userId: v.id("users"),
    // Canonical list + validation live in convex/lib/memoryCategories.ts
    // (P15): fact | insight | decision | preference | context | goal |
    // relationship | project | session_summary | correction. Writes are
    // validated; legacy stored variants are tolerated on read and cleaned by
    // migrations/normalizeMemoryCategories.ts.
    category: v.string(),
    content: v.string(), // the actual memory content
    // ── P14 durability (all optional/additive) ──
    pinned: v.optional(v.boolean()), // pinned memories never fall out of agent briefs
    importance: v.optional(v.number()), // 1-5; higher surfaces earlier
    supersededBy: v.optional(v.id("memories")), // newer memory that replaces this one
    source: v.string(), // "you-agent" | "cli" | "external-agent" | "manual"
    sourceAgent: v.optional(v.string()), // agent name if from external agent
    tags: v.optional(v.array(v.string())), // searchable tags
    sessionId: v.optional(v.string()), // which chat session produced this
    isArchived: v.boolean(),
    // P23 dedupe: sha256(normalized content + category) — see
    // convex/lib/hash.ts computeMemoryContentHash. Optional because rows
    // created before P23 have no hash (they simply never dedupe-match).
    contentHash: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_category", ["userId", "category"])
    .index("by_userId_archived", ["userId", "isArchived"])
    .index("by_userId_contentHash", ["userId", "contentHash"])
    .index("by_sessionId", ["sessionId"])
    .searchIndex("search_content", {
      searchField: "content",
      filterFields: ["userId", "isArchived"],
    }),

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
    // Context compaction tracking (Claude Code-style)
    compactedAt: v.optional(v.number()),
    originalMessageCount: v.optional(v.number()),
  })
    .index("by_userId", ["userId"])
    .index("by_sessionId", ["sessionId"]),

  // ── Skills Registry ────────────────────────────────────────
  skills: defineTable({
    authorId: v.id("users"),
    name: v.string(),
    description: v.string(),
    version: v.string(),
    scope: v.union(v.literal("shared"), v.literal("project"), v.literal("private")),
    identityFields: v.array(v.string()),
    content: v.string(),
    isPublished: v.boolean(),
    downloads: v.number(),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  })
    .index("by_name", ["name"])
    .index("by_authorId", ["authorId"])
    .index("by_isPublished", ["isPublished"])
    // P13 pagination: registry browse pages in downloads-desc order without
    // collecting the whole table (skills.listPublishedPage).
    .index("by_isPublished_downloads", ["isPublished", "downloads"]),

  skillInstalls: defineTable({
    userId: v.id("users"),
    skillName: v.string(),
    source: v.string(),
    scope: v.string(),
    identityFields: v.array(v.string()),
    installedAt: v.number(),
    lastUsedAt: v.optional(v.number()),
    useCount: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_skillName", ["userId", "skillName"])
    // P13 pagination: installed skills page in installedAt-desc order
    // (reinstalls bump installedAt, so _creationTime order is not enough).
    .index("by_userId_installedAt", ["userId", "installedAt"]),

  // ── Cross-agent activity log (unified agent action feed) ──────
  agentActivity: defineTable({
    userId: v.id("users"),
    profileId: v.optional(v.id("profiles")),
    // Who/what
    agentName: v.string(),
    agentSource: v.string(), // "mcp" | "context-link" | "api-key" | "connected-app" | "web-fetch" | "cli"
    agentVersion: v.optional(v.string()),
    // What action
    action: v.string(), // "read" | "read_section" | "write" | "memory_add" | "skill_use" | "compile" | "push" | "publish" | "vault_read" | "vault_write" | "scope_change"
    resource: v.optional(v.string()),
    // Scope + auth
    scope: v.optional(v.string()),
    tokenId: v.optional(v.id("contextLinks")),
    apiKeyId: v.optional(v.id("apiKeys")),
    connectedAppGrantId: v.optional(v.id("connectedAppGrants")),
    // Result
    status: v.string(), // "success" | "denied" | "error"
    details: v.optional(v.any()),
    // For diffs
    bundleVersionBefore: v.optional(v.number()),
    bundleVersionAfter: v.optional(v.number()),
    contentHashBefore: v.optional(v.string()),
    contentHashAfter: v.optional(v.string()),
    // Timing
    durationMs: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_date", ["userId", "createdAt"])
    .index("by_userId_agent", ["userId", "agentName"])
    .index("by_action", ["action"]),

  // ── Rate limits (cycle 46) ──────────────────────────────────
  // One row per call to a rate-limited endpoint. Counted within a sliding
  // time window to enforce per-bucket maximums (typically per-IP for
  // anonymous LLM endpoints, per-user for authenticated ones).
  rateLimits: defineTable({
    bucket: v.string(),     // e.g. "chat:1.2.3.4" or "research:anon"
    timestamp: v.number(),  // Date.now() at call time
  })
    .index("by_bucket_ts", ["bucket", "timestamp"])
    // Cleanup cron scans stale rows oldest-first in bounded batches
    // (audit 2026-06-11 P0 #8) instead of a full-table collect.
    .index("by_timestamp", ["timestamp"]),

  // ── Idempotency keys (P23, PRODUCT-AUDIT #25) ───────────────
  // Response snapshots for mutating endpoints that received an
  // `Idempotency-Key` header. One row per (subject = apiKeyId, route,
  // keyHash = sha256 of the raw header) triple. TTL ~24h enforced at read
  // time (convex/lib/idempotency.ts) — expired rows are ignored and
  // overwritten in place on the next save for the same triple; no cron.
  idempotencyKeys: defineTable({
    subject: v.string(),  // apiKeyId (userDbId fallback for session callers)
    route: v.string(),    // "POST /api/v1/me/bundle"
    keyHash: v.string(),  // sha256 hex of the raw Idempotency-Key header
    status: v.number(),   // stored response status
    body: v.string(),     // stored response body (capped, JSON text)
    createdAt: v.number(),
  })
    .index("by_subject_route_key", ["subject", "route", "keyHash"])
    .index("by_createdAt", ["createdAt"]),

  // ── Daily LLM spend cap (cycle 48) ──────────────────────────
  // Per-day, per-endpoint counters tracking total estimated cost across all
  // chat.* endpoints. Acts as a kill switch: when today's cost exceeds the
  // CHAT_DAILY_SPEND_LIMIT_USD env var, all further chat.* calls return 503
  // until midnight UTC.
  //
  // Defense-in-depth above the per-IP rate limits. Per-IP caps prevent
  // single-IP abuse (~$100/IP/day worst case) but a botnet could still
  // accumulate $10k+/day. The spend cap caps the total damage at the env
  // var value regardless of IP count.
  chatSpendLog: defineTable({
    bucketDay: v.string(),         // YYYY-MM-DD UTC, e.g. "2026-04-09"
    endpoint: v.string(),          // "chat" | "research" | "verify" | "enrich" | "compact"
    count: v.number(),             // total calls today for this endpoint
    estimatedCostUsd: v.number(),  // running estimated cost
    updatedAt: v.number(),
  })
    .index("by_bucketDay", ["bucketDay"])
    .index("by_bucketDay_endpoint", ["bucketDay", "endpoint"]),

  // ── Skill outcome telemetry (L9) ───────────────────────────
  // One row per agent-reported skill execution. Powers the L10 insights query
  // and the `youmd skill improve` CLI surface (success-rate table + low-performer
  // recommendations). Separate from skillInstalls/agentActivity so the
  // improvement loop can aggregate outcomes without joining large tables.
  skillOutcomes: defineTable({
    userId: v.id("users"),
    skillName: v.string(),
    agent: v.optional(v.string()),           // reporting agent name (optional)
    outcome: v.union(
      v.literal("success"),
      v.literal("failure"),
      v.literal("partial"),
    ),
    note: v.optional(v.string()),            // free-text note (max 500 chars)
    durationMs: v.optional(v.number()),      // wall-clock skill execution time
    createdAt: v.number(),
  })
    // Primary lookup: per-user outcomes ordered by creation time
    .index("by_userId", ["userId"])
    // Insights query: aggregate by (userId, skillName) without a full scan
    .index("by_userId_skillName", ["userId", "skillName"]),

  // ── Consolidation run ledger (L19 — nightly dreaming loop) ────────
  // One row per (userId, ranAt-date) written at the END of a successful
  // nightly consolidation. The by_userId_ranAt index is the idempotency key:
  // a second run for the same user on the same UTC date is a no-op.
  // Outcome fields let product/dashboards query consolidation health without
  // reading individual memory rows.
  consolidationRuns: defineTable({
    userId: v.id("users"),
    ranAt: v.string(),              // "YYYY-MM-DD" UTC date string
    duplicatesSuperseded: v.number(),
    archived: v.number(),
    reviewQueueSize: v.number(),
  })
    .index("by_userId_ranAt", ["userId", "ranAt"]),

  // ── Fleet aggregate reports (L20 — k-anon fleet learning) ─────────
  // One row per weekly Sunday 10:00 UTC fleet aggregation run.
  // metrics is an opaque JSON blob whose shape is defined by FleetMetrics in
  // convex/fleet.ts. Contains ONLY category names + counts — never content
  // strings, usernames, or any per-user identifier.
  fleetReports: defineTable({
    ranAt: v.string(),   // ISO-8601 timestamp string
    metrics: v.any(),    // FleetMetrics — see convex/fleet.ts
  }),

  // ── Per-user workflow schedules (L18 — YouStack workflows manifest) ─────────
  // One row per workflow declared in a YouStack manifest that the user has
  // registered for server-side tracking. Real cron registration is deferred
  // (see convex/workflows.ts); this table holds the intent + last-run
  // bookkeeping so the dashboard and CLI can show schedule state without
  // hitting a cron scheduler.
  userWorkflowSchedules: defineTable({
    userId: v.id("users"),
    workflowId: v.string(),   // matches YouStackWorkflow.id from the manifest
    schedule: v.string(),     // cron string, e.g. "0 9 * * 1"
    action: v.string(),       // "run_skill" | "report_skill_outcome"
    lastRunAt: v.optional(v.number()),
    createdAt: v.number(),
  }).index("by_userId", ["userId"]),

  // ── Maintainer agent proposals (L24 — stack journal mining) ─────────────
  // One row per detected pattern (failure_pattern) per (userId, stackSlug,
  // skillName). Written by mineStackJournals (convex/maintainer.ts) when a
  // skill-name token appears in 3+ failure-mentioning journal entries for the
  // same stack. When evidenceCount >= 5 the proposal is also flagged for the
  // cross-stack registry (L25).
  //
  // Status state machine: open → applied | rejected.
  // humanApprovalState: pending → approved | rejected.
  maintainerProposals: defineTable({
    userId: v.id("users"),
    stackSlug: v.string(),
    skillName: v.string(),
    patternType: v.literal("failure_pattern"),
    evidenceCount: v.number(),
    status: v.union(
      v.literal("open"),
      v.literal("applied"),
      v.literal("rejected")
    ),
    proposedForRegistry: v.boolean(),
    humanApprovalState: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("rejected")
    ),
    createdAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_status", ["status"]),

  // ── Outbound webhooks (P24) ────────────────────────────────────
  // Subscriptions for event-driven push notifications to external URLs.
  // The signing secret (HMAC-SHA256 key) is hashed before storage — like
  // apiKeys — and is returned to the caller exactly ONCE at creation time.
  //
  // Supported events: "bundle_published" (more documented in convex/webhooks.ts)
  //
  // Delivery state machine: each delivery sets lastDeliveryStatus.
  // After 10 consecutive failures the subscription is auto-disabled (skipped
  // on next event dispatch until the caller revokes and re-creates).
  webhookSubscriptions: defineTable({
    userId: v.id("users"),
    url: v.string(),
    secretHash: v.string(),   // sha256 hex of the raw signing secret
    secretEncrypted: v.optional(v.string()), // encrypted raw secret for delivery signing
    secretIv: v.optional(v.string()),
    events: v.array(v.string()),
    createdAt: v.number(),
    lastDeliveryAt: v.optional(v.number()),
    lastDeliveryStatus: v.optional(
      v.union(v.literal("success"), v.literal("failure"), v.literal("pending"))
    ),
    failureCount: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_events", ["events"]),

  // ── User brainScope consent rows (L26 — server-cron consent gating) ──────────
  // One row per (userId, scope) when a user has explicitly set consent.
  // Absence of a row = DEFAULT_CONSENT[scope] (all true — existing users unaffected).
  // A future revoke API writes granted=false; a grant API writes granted=true or
  // deletes the row to restore the default.
  userConsents: defineTable({
    userId: v.id("users"),
    scope: v.string(), // one of BRAIN_SCOPES
    granted: v.boolean(),
    updatedAt: v.number(),
  })
    .index("by_userId_scope", ["userId", "scope"]),

  // ── Tracked GitHub projects (active-project analysis) ─────────────────────
  // One row per (userId, githubRepoId). Populated by analyzeActiveProjects
  // (convex/githubProjects.ts) which scans the user's most-pushed repos over
  // the last 90 days, calls an LLM to produce a 1-2 sentence insight, and
  // upserts here. Visibility defaults to "private" until the user explicitly
  // promotes a project to "public" (setProjectVisibility).
  trackedProjects: defineTable({
    userId: v.id("users"),
    githubRepoId: v.number(),         // GitHub numeric repo id (stable across renames)
    fullName: v.string(),             // "owner/repo"
    name: v.string(),                 // repo short name
    description: v.optional(v.string()),
    primaryLanguage: v.optional(v.string()),
    pushedAt: v.number(),             // ms epoch of last push
    commitsLast90d: v.number(),       // count of commits in last 90 days
    stars: v.optional(v.number()),
    isPrivate: v.boolean(),
    insight: v.optional(v.string()),  // LLM-generated 1-2 sentence project summary
    visibility: v.union(v.literal("private"), v.literal("public")), // default "private"
    trackedAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_fullName", ["userId", "fullName"]),
});
