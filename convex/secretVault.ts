import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { requireOwner } from "./lib/auth";

async function loadOwner(
  ctx: QueryCtx | MutationCtx,
  clerkId: string,
  internalAuthToken?: string
): Promise<Doc<"users">> {
  await requireOwner(ctx, clerkId, internalAuthToken);
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerkId", (q) => q.eq("clerkId", clerkId))
    .first();
  if (!user) throw new Error("User not found");
  return user;
}

function cleanActivityText(value: string | undefined, fallback: string, maxChars: number): string {
  const cleaned = (value ?? fallback)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return (cleaned || fallback).slice(0, maxChars);
}

function vaultActivityStatus(value: string): "live" | "ok" | "warn" | "error" | "info" {
  if (value === "pulled" || value === "uploaded" || value === "registered" || value === "shared") return "ok";
  if (value === "missing" || value === "blocked") return "warn";
  return "info";
}

async function recordVaultActivity(
  ctx: MutationCtx,
  args: {
    userId: Id<"users">;
    activityId: string;
    kind: string;
    title: string;
    detail?: string;
    entityType?: string;
    entityId?: string;
    sourceHost?: string;
    metadata?: Record<string, unknown>;
    occurredAt?: number;
  },
) {
  const now = Date.now();
  const activityId = cleanActivityText(args.activityId, "secret-vault", 160);
  const existing = await ctx.db
    .query("brainActivities")
    .withIndex("by_userId_activityId", (q) => q.eq("userId", args.userId).eq("activityId", activityId))
    .first();
  const patch = {
    source: "vault",
    channel: "secret-vault",
    kind: cleanActivityText(args.kind, "event", 80),
    title: cleanActivityText(args.title, "Secret Vault event", 180),
    detail: args.detail ? cleanActivityText(args.detail, "", 800) : undefined,
    status: vaultActivityStatus(args.kind),
    entityType: args.entityType,
    entityId: args.entityId,
    sourceHost: args.sourceHost ? cleanActivityText(args.sourceHost, "", 120) : undefined,
    sourceAgent: "youmd-secret-vault",
    metadata: args.metadata,
    occurredAt: args.occurredAt ?? now,
    updatedAt: now,
    secretValuesExposed: false,
  };

  if (existing) {
    await ctx.db.patch(existing._id, patch);
    return;
  }

  await ctx.db.insert("brainActivities", {
    userId: args.userId,
    activityId,
    ...patch,
    createdAt: now,
  });
}

const snapshotArgs = {
  clerkId: v.string(),
  _internalAuthToken: v.optional(v.string()),
  kind: v.optional(v.string()),
  label: v.optional(v.string()),
  fileName: v.string(),
  storageId: v.id("_storage"),
  contentType: v.string(),
  encryptionTool: v.string(),
  extension: v.string(),
  formatVersion: v.number(),
  sizeBytes: v.number(),
  sha256: v.string(),
  manifestText: v.optional(v.string()),
  manifestSha256: v.optional(v.string()),
  projectCount: v.number(),
  variableCount: v.optional(v.number()),
  agentAuthIncluded: v.boolean(),
  sourceHost: v.optional(v.string()),
  sourceRoot: v.optional(v.string()),
};

function toMetadata(snapshot: Doc<"secretVaultSnapshots">) {
  return {
    id: snapshot._id,
    kind: snapshot.kind,
    label: snapshot.label,
    fileName: snapshot.fileName,
    contentType: snapshot.contentType,
    encryptionTool: snapshot.encryptionTool,
    extension: snapshot.extension,
    formatVersion: snapshot.formatVersion,
    sizeBytes: snapshot.sizeBytes,
    sha256: snapshot.sha256,
    manifestText: snapshot.manifestText,
    manifestSha256: snapshot.manifestSha256,
    projectCount: snapshot.projectCount,
    variableCount: snapshot.variableCount,
    agentAuthIncluded: snapshot.agentAuthIncluded,
    sourceHost: snapshot.sourceHost,
    sourceRoot: snapshot.sourceRoot,
    createdAt: snapshot.createdAt,
  };
}

export const createEnvVaultSnapshot = mutation({
  args: snapshotArgs,
  handler: async (ctx, args) => {
    const user = await loadOwner(ctx, args.clerkId, args._internalAuthToken);
    const now = Date.now();
    const snapshotId = await ctx.db.insert("secretVaultSnapshots", {
      userId: user._id,
      kind: args.kind ?? "env-local",
      label: args.label,
      fileName: args.fileName,
      storageId: args.storageId,
      contentType: args.contentType,
      encryptionTool: args.encryptionTool,
      extension: args.extension,
      formatVersion: args.formatVersion,
      sizeBytes: args.sizeBytes,
      sha256: args.sha256,
      manifestText: args.manifestText,
      manifestSha256: args.manifestSha256,
      projectCount: args.projectCount,
      variableCount: args.variableCount,
      agentAuthIncluded: args.agentAuthIncluded,
      sourceHost: args.sourceHost,
      sourceRoot: args.sourceRoot,
      createdAt: now,
    });

    const snapshot = await ctx.db.get(snapshotId);
    if (!snapshot) throw new Error("Secret vault snapshot failed to save");
    await recordVaultActivity(ctx, {
      userId: user._id,
      activityId: `secret-vault:snapshot:${snapshotId}`,
      kind: "uploaded",
      title: "Secret Vault snapshot uploaded",
      detail: `${snapshot.projectCount} projects / ${snapshot.variableCount ?? 0} vars · ${snapshot.fileName}`,
      entityType: "secretVaultSnapshot",
      entityId: String(snapshotId),
      sourceHost: snapshot.sourceHost,
      metadata: {
        snapshotId: String(snapshotId),
        fileName: snapshot.fileName,
        sizeBytes: snapshot.sizeBytes,
        projectCount: snapshot.projectCount,
        variableCount: snapshot.variableCount,
        encryptionTool: snapshot.encryptionTool,
        extension: snapshot.extension,
        formatVersion: snapshot.formatVersion,
        agentAuthIncluded: snapshot.agentAuthIncluded,
        sha256Short: snapshot.sha256.slice(0, 12),
        secretValuesExposed: false,
      },
      occurredAt: snapshot.createdAt,
    });
    return toMetadata(snapshot);
  },
});

export const listEnvVaultSnapshots = query({
  args: {
    clerkId: v.string(),
    _internalAuthToken: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await loadOwner(ctx, args.clerkId, args._internalAuthToken);
    const limit = Math.max(1, Math.min(24, Math.round(args.limit ?? 8)));
    const snapshots = await ctx.db
      .query("secretVaultSnapshots")
      .withIndex("by_userId_kind_createdAt", (q) =>
        q.eq("userId", user._id).eq("kind", "env-local")
      )
      .order("desc")
      .take(limit);
    return snapshots.map(toMetadata);
  },
});

export const getLatestEnvVaultSnapshot = query({
  args: {
    clerkId: v.string(),
    _internalAuthToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await loadOwner(ctx, args.clerkId, args._internalAuthToken);
    const snapshot = await ctx.db
      .query("secretVaultSnapshots")
      .withIndex("by_userId_kind_createdAt", (q) =>
        q.eq("userId", user._id).eq("kind", "env-local")
      )
      .order("desc")
      .first();
    if (!snapshot) return null;
    return {
      ...toMetadata(snapshot),
      storageId: snapshot.storageId as Id<"_storage">,
    };
  },
});

export const registerDevice = mutation({
  args: {
    clerkId: v.string(),
    _internalAuthToken: v.optional(v.string()),
    deviceId: v.string(),
    deviceName: v.string(),
    hostName: v.optional(v.string()),
    platform: v.optional(v.string()),
    publicKeyPem: v.string(),
    keyAlgorithm: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await loadOwner(ctx, args.clerkId, args._internalAuthToken);
    const now = Date.now();
    const existing = await ctx.db
      .query("secretVaultDevices")
      .withIndex("by_userId_deviceId", (q) =>
        q.eq("userId", user._id).eq("deviceId", args.deviceId)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        deviceName: args.deviceName,
        hostName: args.hostName,
        platform: args.platform,
        publicKeyPem: args.publicKeyPem,
        keyAlgorithm: args.keyAlgorithm,
        trusted: existing.revokedAt ? false : true,
        lastSeenAt: now,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("secretVaultDevices", {
        userId: user._id,
        deviceId: args.deviceId,
        deviceName: args.deviceName,
        hostName: args.hostName,
        platform: args.platform,
        publicKeyPem: args.publicKeyPem,
        keyAlgorithm: args.keyAlgorithm,
        trusted: true,
        lastSeenAt: now,
        createdAt: now,
        updatedAt: now,
      });
    }

    const device = await ctx.db
      .query("secretVaultDevices")
      .withIndex("by_userId_deviceId", (q) =>
        q.eq("userId", user._id).eq("deviceId", args.deviceId)
      )
      .first();
    if (!device) throw new Error("Secret Vault device failed to save");
    await recordVaultActivity(ctx, {
      userId: user._id,
      activityId: `secret-vault:device:${device.deviceId}`,
      kind: "registered",
      title: `Secret Vault trusted device registered: ${device.deviceName}`,
      detail: [device.hostName, device.platform].filter(Boolean).join(" · ") || "trusted device ready",
      entityType: "secretVaultDevice",
      entityId: device.deviceId,
      sourceHost: device.hostName,
      metadata: {
        deviceId: device.deviceId,
        deviceName: device.deviceName,
        hostName: device.hostName,
        platform: device.platform,
        keyAlgorithm: device.keyAlgorithm,
        trusted: device.trusted,
        revoked: Boolean(device.revokedAt),
        secretValuesExposed: false,
      },
      occurredAt: device.updatedAt,
    });
    return device;
  },
});

export const listDevices = query({
  args: {
    clerkId: v.string(),
    _internalAuthToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await loadOwner(ctx, args.clerkId, args._internalAuthToken);
    return await ctx.db
      .query("secretVaultDevices")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();
  },
});

export const upsertKeyEnvelope = mutation({
  args: {
    clerkId: v.string(),
    _internalAuthToken: v.optional(v.string()),
    snapshotId: v.id("secretVaultSnapshots"),
    deviceId: v.string(),
    wrappedPassphraseBase64: v.string(),
    wrapAlgorithm: v.string(),
    sourceHost: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await loadOwner(ctx, args.clerkId, args._internalAuthToken);
    const snapshot = await ctx.db.get(args.snapshotId);
    if (!snapshot || snapshot.userId !== user._id) {
      throw new Error("Secret Vault snapshot not found");
    }
    const device = await ctx.db
      .query("secretVaultDevices")
      .withIndex("by_userId_deviceId", (q) =>
        q.eq("userId", user._id).eq("deviceId", args.deviceId)
      )
      .first();
    if (!device || device.revokedAt || !device.trusted) {
      throw new Error("Secret Vault device is not trusted");
    }

    const now = Date.now();
    const existing = await ctx.db
      .query("secretVaultKeyEnvelopes")
      .withIndex("by_userId_snapshotId_deviceId", (q) =>
        q.eq("userId", user._id).eq("snapshotId", args.snapshotId).eq("deviceId", args.deviceId)
      )
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        wrappedPassphraseBase64: args.wrappedPassphraseBase64,
        wrapAlgorithm: args.wrapAlgorithm,
        sourceHost: args.sourceHost,
        updatedAt: now,
      });
      const envelope = await ctx.db.get(existing._id);
      await recordVaultActivity(ctx, {
        userId: user._id,
        activityId: `secret-vault:envelope:${args.snapshotId}:${args.deviceId}`,
        kind: "shared",
        title: "Secret Vault device envelope refreshed",
        detail: `trusted-device envelope ready for ${device.deviceName}`,
        entityType: "secretVaultKeyEnvelope",
        entityId: String(existing._id),
        sourceHost: args.sourceHost,
        metadata: {
          snapshotId: String(args.snapshotId),
          deviceId: args.deviceId,
          deviceName: device.deviceName,
          targetHost: device.hostName,
          wrapAlgorithm: args.wrapAlgorithm,
          refreshed: true,
          secretValuesExposed: false,
        },
        occurredAt: now,
      });
      return envelope;
    }
    const id = await ctx.db.insert("secretVaultKeyEnvelopes", {
      userId: user._id,
      snapshotId: args.snapshotId,
      deviceId: args.deviceId,
      wrappedPassphraseBase64: args.wrappedPassphraseBase64,
      wrapAlgorithm: args.wrapAlgorithm,
      sourceHost: args.sourceHost,
      createdAt: now,
      updatedAt: now,
    });
    const envelope = await ctx.db.get(id);
    await recordVaultActivity(ctx, {
      userId: user._id,
      activityId: `secret-vault:envelope:${args.snapshotId}:${args.deviceId}`,
      kind: "shared",
      title: "Secret Vault device envelope shared",
      detail: `trusted-device envelope ready for ${device.deviceName}`,
      entityType: "secretVaultKeyEnvelope",
      entityId: String(id),
      sourceHost: args.sourceHost,
      metadata: {
        snapshotId: String(args.snapshotId),
        deviceId: args.deviceId,
        deviceName: device.deviceName,
        targetHost: device.hostName,
        wrapAlgorithm: args.wrapAlgorithm,
        refreshed: false,
        secretValuesExposed: false,
      },
      occurredAt: now,
    });
    return envelope;
  },
});

export const getLatestKeyEnvelopeForDevice = query({
  args: {
    clerkId: v.string(),
    _internalAuthToken: v.optional(v.string()),
    deviceId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await loadOwner(ctx, args.clerkId, args._internalAuthToken);
    const latest = await ctx.db
      .query("secretVaultSnapshots")
      .withIndex("by_userId_kind_createdAt", (q) =>
        q.eq("userId", user._id).eq("kind", "env-local")
      )
      .order("desc")
      .first();
    if (!latest) return null;
    const envelope = await ctx.db
      .query("secretVaultKeyEnvelopes")
      .withIndex("by_userId_snapshotId_deviceId", (q) =>
        q.eq("userId", user._id).eq("snapshotId", latest._id).eq("deviceId", args.deviceId)
      )
      .first();
    if (!envelope) return null;
    return {
      snapshot: toMetadata(latest),
      envelope,
    };
  },
});
