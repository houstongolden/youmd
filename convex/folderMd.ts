/**
 * folder.md media lane — server-to-server provisioning + at-rest credential
 * storage. You.md is text-first: large/binary assets live in folder.md and the
 * brain stores only a pointer. The scoped folder.md API key is minted for the
 * user via folder.md's POST /api/v1/provision (a shared FOLDERMD_SERVICE_SECRET)
 * so the user never pastes a key. We persist it encrypted (AES-GCM via
 * lib/secretCrypto) and only ever hand it back to the authenticated owner's own
 * client (CLI/MCP), which caches it locally for direct uploads/downloads.
 */

import { v } from "convex/values";
import {
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { encryptSecret, decryptSecret } from "./lib/secretCrypto";

const DEFAULT_BASE = "https://www.folder.md/api/v1";
const EXTERNAL_SYSTEM = "you.md";
// AES-GCM domain separation: folder.md key ciphertexts are bound to this AAD so they can never
// be cross-decrypted as another secret class (e.g. GitHub tokens) sharing the encryption secret.
const KEY_AAD = "foldermd-api-key:v1";

function folderMdBase(): string {
  return (process.env.FOLDERMD_BASE_URL || DEFAULT_BASE).replace(/\/$/, "");
}

/** The stored folder.md account row for a user (secrets included — internal only). */
export const getByUser = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("folderMdAccounts")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();
  },
});

/** Upsert encrypted folder.md credentials for a user. */
export const saveCreds = internalMutation({
  args: {
    userId: v.id("users"),
    folderId: v.string(),
    apiKeyCipher: v.string(),
    apiKeyIv: v.string(),
    keyPrefix: v.string(),
    isRotation: v.boolean(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("folderMdAccounts")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        folderId: args.folderId,
        apiKeyCipher: args.apiKeyCipher,
        apiKeyIv: args.apiKeyIv,
        keyPrefix: args.keyPrefix,
        rotatedAt: args.isRotation ? now : existing.rotatedAt,
      });
      return existing._id;
    }

    return await ctx.db.insert("folderMdAccounts", {
      userId: args.userId,
      folderId: args.folderId,
      apiKeyCipher: args.apiKeyCipher,
      apiKeyIv: args.apiKeyIv,
      keyPrefix: args.keyPrefix,
      provisionedAt: now,
      rotatedAt: args.isRotation ? now : undefined,
    });
  },
});

type ProvisionApiResponse = {
  folder_id?: string;
  api_key?: string | null;
  key_prefix?: string | null;
  created?: boolean;
  rotated?: boolean;
};

/** Result of provision(). Explicit so the action's type doesn't recurse through
 * its own `internal.folderMd.*` calls (Convex self-reference inference cycle). */
export interface ProvisionResult {
  folderId: string;
  apiKey: string;
  keyPrefix: string;
  created: boolean;
  rotated: boolean;
  configured: boolean;
}

async function callFolderMdProvision(args: {
  externalUserId: string;
  displayName?: string;
  forceNewKey: boolean;
}): Promise<ProvisionApiResponse> {
  const secret = process.env.FOLDERMD_SERVICE_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("folder.md provisioning is not configured (FOLDERMD_SERVICE_SECRET)");
  }
  const res = await fetch(`${folderMdBase()}/provision`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify({
      externalSystem: EXTERNAL_SYSTEM,
      externalUserId: args.externalUserId,
      displayName: args.displayName,
      forceNewKey: args.forceNewKey,
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`folder.md provision failed: ${res.status} ${detail.slice(0, 200)}`);
  }
  return (await res.json()) as ProvisionApiResponse;
}

/**
 * Ensure the user has a usable folder.md credential, minting one if needed, and
 * return it (folderId + plaintext key) for the authenticated owner's client.
 *
 * - Cached locally on you.md: decrypt and return — folder.md is never called.
 * - Not cached: call folder.md /provision. If folder.md already had the mapping
 *   but didn't re-show a key (created=false, api_key=null — e.g. our DB was
 *   reset), force a rotation so we always end up with a usable key.
 * - forceNewKey: always rotate the folder.md key and re-store it.
 */
export const provision = internalAction({
  args: {
    userId: v.id("users"),
    displayName: v.optional(v.string()),
    forceNewKey: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<ProvisionResult> => {
    const existing = await ctx.runQuery(internal.folderMd.getByUser, {
      userId: args.userId,
    });

    if (existing && args.forceNewKey !== true) {
      const apiKey = await decryptSecret(existing.apiKeyCipher, existing.apiKeyIv, KEY_AAD);
      return {
        folderId: existing.folderId,
        apiKey,
        keyPrefix: existing.keyPrefix,
        created: false,
        rotated: false,
        configured: true,
      };
    }

    let data = await callFolderMdProvision({
      externalUserId: args.userId,
      displayName: args.displayName,
      forceNewKey: args.forceNewKey === true,
    });

    let apiKey = data.api_key ? String(data.api_key) : null;
    let rotated = Boolean(data.rotated);

    // folder.md already had the account but didn't return a key — recover by
    // forcing a fresh mint so we don't end up with an unusable (keyless) record.
    if (!apiKey) {
      data = await callFolderMdProvision({
        externalUserId: args.userId,
        displayName: args.displayName,
        forceNewKey: true,
      });
      apiKey = data.api_key ? String(data.api_key) : null;
      rotated = true;
    }

    const folderId = String(data.folder_id || "");
    if (!folderId || !apiKey) {
      throw new Error("folder.md provision returned no usable credentials");
    }

    const enc = await encryptSecret(apiKey, KEY_AAD);
    await ctx.runMutation(internal.folderMd.saveCreds, {
      userId: args.userId,
      folderId,
      apiKeyCipher: enc.ciphertext,
      apiKeyIv: enc.iv,
      keyPrefix: apiKey.slice(0, 16),
      isRotation: Boolean(existing),
    });

    return {
      folderId,
      apiKey,
      keyPrefix: apiKey.slice(0, 16),
      created: !existing,
      rotated,
      configured: true,
    };
  },
});
