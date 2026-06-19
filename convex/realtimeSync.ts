import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireOwner } from "./lib/auth";
import { secureRandomString } from "./lib/secureToken";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";

const REALTIME_SYNC_TOKEN_PREFIX = "ys_";
const DEFAULT_SESSION_TTL_MS = 60 * 60 * 1000;
const MAX_SESSION_TTL_MS = 6 * 60 * 60 * 1000;

async function sha256Hex(input: string): Promise<string> {
  const encoded = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function newest(values: Array<number | null | undefined>): number | null {
  const found = values.filter((value): value is number => typeof value === "number");
  return found.length ? Math.max(...found) : null;
}

function newestFromRows<T extends { createdAt?: number; updatedAt?: number; installedAt?: number; syncedAt?: number; generatedAt?: number }>(
  rows: T[],
): number | null {
  return newest(
    rows.flatMap((row) => [
      row.updatedAt,
      row.createdAt,
      row.installedAt,
      row.syncedAt,
      row.generatedAt,
    ]),
  );
}

export const issueSession = mutation({
  args: {
    clerkId: v.string(),
    _internalAuthToken: v.optional(v.string()),
    clientName: v.optional(v.string()),
    credentialType: v.optional(v.string()),
    canReadVaultMetadata: v.optional(v.boolean()),
    ttlSeconds: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.clerkId, args._internalAuthToken);

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();
    if (!user) throw new Error("User not found");

    const now = Date.now();
    const requestedTtlMs = Number.isFinite(args.ttlSeconds)
      ? Math.max(60_000, Math.min(MAX_SESSION_TTL_MS, Math.floor(args.ttlSeconds as number) * 1000))
      : DEFAULT_SESSION_TTL_MS;
    const token = `${REALTIME_SYNC_TOKEN_PREFIX}${secureRandomString(48)}`;
    const tokenHash = await sha256Hex(token);
    const expiresAt = now + requestedTtlMs;

    await ctx.db.insert("realtimeSyncSessions", {
      userId: user._id,
      tokenHash,
      clientName: args.clientName?.trim().slice(0, 120),
      credentialType: args.credentialType ?? "api-key",
      canReadVaultMetadata: args.canReadVaultMetadata === true,
      expiresAt,
      createdAt: now,
    });

    return {
      token,
      expiresAt,
      ttlSeconds: Math.round(requestedTtlMs / 1000),
    };
  },
});

async function readSession(ctx: QueryCtx, token: string): Promise<Doc<"realtimeSyncSessions">> {
  const tokenHash = await sha256Hex(token);
  const session = await ctx.db
    .query("realtimeSyncSessions")
    .withIndex("by_tokenHash", (q) => q.eq("tokenHash", tokenHash))
    .first();

  if (!session || session.revokedAt || session.expiresAt <= Date.now()) {
    throw new Error("realtime sync session expired; reconnect with your You.md API key");
  }
  return session;
}

export const getHead = query({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await readSession(ctx, args.token);
    const user = await ctx.db.get(session.userId);
    if (!user) throw new Error("realtime sync user not found");

    const bundles = await ctx.db
      .query("bundles")
      .withIndex("by_userId", (q) => q.eq("userId", session.userId))
      .collect();
    const latestBundle = bundles.sort((a, b) => b.version - a.version)[0] ?? null;
    const publishedBundle =
      bundles
        .filter((bundle) => bundle.isPublished)
        .sort((a, b) => (b.publishedAt ?? b.createdAt) - (a.publishedAt ?? a.createdAt))[0] ?? null;

    const skills = await ctx.db
      .query("skillInstalls")
      .withIndex("by_userId", (q) => q.eq("userId", session.userId))
      .collect();

    const [
      projects,
      apiSurfaces,
      dependencyEdges,
      patterns,
      activities,
      providerAccounts,
      tasks,
      brainDumps,
      machineProofs,
      agentMessages,
      repoMirror,
      githubConnection,
      vaultSnapshots,
      vaultDevices,
      vaultKeyEnvelopes,
    ] = await Promise.all([
      ctx.db.query("portfolioProjects").withIndex("by_userId", (q) => q.eq("userId", session.userId)).collect(),
      ctx.db.query("portfolioApiSurfaces").withIndex("by_userId", (q) => q.eq("userId", session.userId)).collect(),
      ctx.db.query("portfolioDependencyEdges").withIndex("by_userId", (q) => q.eq("userId", session.userId)).collect(),
      ctx.db.query("portfolioReusablePatterns").withIndex("by_userId", (q) => q.eq("userId", session.userId)).collect(),
      ctx.db.query("portfolioProjectActivities").withIndex("by_userId", (q) => q.eq("userId", session.userId)).collect(),
      ctx.db.query("portfolioProviderAccounts").withIndex("by_userId", (q) => q.eq("userId", session.userId)).collect(),
      ctx.db.query("portfolioTasks").withIndex("by_userId", (q) => q.eq("userId", session.userId)).collect(),
      ctx.db.query("brainDumpCaptures").withIndex("by_userId", (q) => q.eq("userId", session.userId)).collect(),
      ctx.db.query("machineProofReports").withIndex("by_userId", (q) => q.eq("userId", session.userId)).collect(),
      ctx.db
        .query("realtimeAgentMessages")
        .withIndex("by_userId_createdAt", (q) => q.eq("userId", session.userId))
        .order("desc")
        .take(12),
      ctx.db.query("repoMirror").withIndex("by_userId", (q) => q.eq("userId", session.userId)).first(),
      ctx.db.query("githubConnections").withIndex("by_userId", (q) => q.eq("userId", session.userId)).first(),
      session.canReadVaultMetadata
        ? ctx.db
            .query("secretVaultSnapshots")
            .withIndex("by_userId_kind_createdAt", (q) => q.eq("userId", session.userId).eq("kind", "env-local"))
            .collect()
        : Promise.resolve([] as Doc<"secretVaultSnapshots">[]),
      session.canReadVaultMetadata
        ? ctx.db.query("secretVaultDevices").withIndex("by_userId", (q) => q.eq("userId", session.userId)).collect()
        : Promise.resolve([] as Doc<"secretVaultDevices">[]),
      session.canReadVaultMetadata
        ? ctx.db.query("secretVaultKeyEnvelopes").withIndex("by_userId", (q) => q.eq("userId", session.userId)).collect()
        : Promise.resolve([] as Doc<"secretVaultKeyEnvelopes">[]),
    ]);

    const latestVault = vaultSnapshots.sort((a, b) => b.createdAt - a.createdAt)[0] ?? null;
    const trustedVaultDevices = vaultDevices.filter((device) => device.trusted && !device.revokedAt);
    const latestVaultEnvelopeCount = latestVault
      ? vaultKeyEnvelopes.filter((envelope) => String(envelope.snapshotId) === String(latestVault._id)).length
      : 0;
    const portfolioUpdatedAt = newest([
      newestFromRows(projects),
      newestFromRows(apiSurfaces),
      newestFromRows(dependencyEdges),
      newestFromRows(patterns),
      newestFromRows(activities),
      newestFromRows(providerAccounts),
      newestFromRows(tasks),
      newestFromRows(brainDumps),
      newestFromRows(machineProofs),
    ]);
    const agentBusLatestAt = newestFromRows(agentMessages);

    const activeFocusedProjects = projects.filter(
      (project) =>
        project.status === "active" &&
        (project.focusStatus === "top-priority" || project.focusStatus === "focusing"),
    );

    return {
      schemaVersion: "you-md/realtime-sync-head/v1",
      serverNow: Date.now(),
      sessionExpiresAt: session.expiresAt,
      user: {
        id: String(user._id as Id<"users">),
        username: user.username,
        plan: user.plan,
      },
      identity: {
        bundleCount: bundles.length,
        latestVersion: latestBundle?.version ?? null,
        latestHash: latestBundle?.contentHash ?? null,
        latestCreatedAt: latestBundle?.createdAt ?? null,
        latestPublishedAt: publishedBundle?.publishedAt ?? null,
        publishedVersion: publishedBundle?.version ?? null,
        publishedHash: publishedBundle?.contentHash ?? null,
      },
      skills: {
        installedCount: skills.length,
        latestInstalledAt: newestFromRows(skills),
        names: skills.map((skill) => skill.skillName).sort().slice(0, 200),
      },
      portfolio: {
        updatedAt: portfolioUpdatedAt,
        projects: projects.length,
        activeFocusedProjects: activeFocusedProjects.length,
        apiSurfaces: apiSurfaces.length,
        dependencyEdges: dependencyEdges.length,
        reusablePatterns: patterns.length,
        activities: activities.length,
        providerAccounts: providerAccounts.length,
        tasks: tasks.length,
        brainDumps: brainDumps.length,
        machineProofs: machineProofs.length,
      },
      agentBus: {
        status: agentMessages.length ? "active" : "idle",
        channelCount: new Set(agentMessages.map((message) => message.channel)).size,
        recentCount: agentMessages.length,
        latestMessageAt: agentBusLatestAt,
        messages: agentMessages
          .slice()
          .sort((a, b) => a.createdAt - b.createdAt)
          .map((message) => ({
            id: String(message._id),
            messageId: message.messageId,
            channel: message.channel,
            kind: message.kind,
            body: message.body,
            sourceHost: message.sourceHost ?? null,
            sourceAgent: message.sourceAgent,
            sourceRuntime: message.sourceRuntime ?? null,
            targetHost: message.targetHost ?? null,
            targetAgent: message.targetAgent ?? null,
            metadata: message.metadata ?? null,
            createdAt: message.createdAt,
            secretValuesExposed: false,
          })),
        secretValuesExposed: false,
      },
      repoMirror: repoMirror
        ? {
            repoFullName: repoMirror.repoFullName,
            commitSha: repoMirror.commitSha ?? null,
            fileCount: repoMirror.fileCount,
            totalBytes: repoMirror.totalBytes,
            truncated: repoMirror.truncated,
            syncedAt: repoMirror.syncedAt,
          }
        : null,
      github: githubConnection
        ? {
            repoFullName: githubConnection.repoFullName ?? null,
            lastSyncedAt: githubConnection.lastSyncedAt ?? null,
            lastPushedCommitSha: githubConnection.lastPushedCommitSha ?? null,
            mirrorStale: githubConnection.mirrorStale === true,
            lastPushErrorAt: githubConnection.lastPushErrorAt ?? null,
          }
        : null,
      encryptedEnvVault: session.canReadVaultMetadata
        ? {
            status: latestVault ? "ready" : "missing",
            flow: "account-backed-encrypted-snapshot+trusted-device-envelopes",
            available: !!latestVault,
            snapshotCount: vaultSnapshots.length,
            trustedDeviceCount: trustedVaultDevices.length,
            keyEnvelopeCount: vaultKeyEnvelopes.length,
            latestSnapshotEnvelopeCount: latestVaultEnvelopeCount,
            id: latestVault ? String(latestVault._id) : null,
            label: latestVault?.label ?? null,
            createdAt: latestVault?.createdAt ?? null,
            fileName: latestVault?.fileName ?? null,
            contentType: latestVault?.contentType ?? null,
            encryptionTool: latestVault?.encryptionTool ?? null,
            extension: latestVault?.extension ?? null,
            formatVersion: latestVault?.formatVersion ?? null,
            sizeBytes: latestVault?.sizeBytes ?? null,
            projectCount: latestVault?.projectCount ?? null,
            variableCount: latestVault?.variableCount ?? null,
            sha256: latestVault?.sha256 ?? null,
            manifestSha256: latestVault?.manifestSha256 ?? null,
            agentAuthIncluded: latestVault?.agentAuthIncluded ?? false,
            sourceHost: latestVault?.sourceHost ?? null,
            sourceRoot: latestVault?.sourceRoot ?? null,
            restoreMode: "trusted-device-envelope-pull-restore",
            secretValuesExposed: false,
          }
        : {
            status: "scope-missing",
            flow: "account-backed-encrypted-snapshot+trusted-device-envelopes",
            available: false,
            scope: "vault-not-granted",
            restoreMode: "requires-vault-scoped-key",
            secretValuesExposed: false,
          },
    };
  },
});
