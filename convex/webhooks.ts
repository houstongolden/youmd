/**
 * P24 — Outbound webhooks.
 *
 * Lifecycle:
 *   POST /api/v1/me/webhooks  → createSubscription (returns signingSecret once)
 *   GET  /api/v1/me/webhooks  → listSubscriptions
 *   DELETE /api/v1/me/webhooks → revokeSubscription
 *
 * Delivery:
 *   scheduleWebhookDeliveries (called by the bundle_published path in http.ts)
 *   → per-subscription deliverWebhook action → HTTPS POST to url
 *     with X-YouMD-Event and X-YouMD-Signature (HMAC-SHA256) headers.
 *
 * Supported events today: "bundle_published"
 * Extension point: add new event names to KNOWN_WEBHOOK_EVENTS and call
 * scheduleWebhookDeliveries after the relevant mutation.
 */

import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { encryptSecret, decryptSecret } from "./lib/secretCrypto";

export const KNOWN_WEBHOOK_EVENTS = ["bundle_published"] as const;
export type WebhookEvent = (typeof KNOWN_WEBHOOK_EVENTS)[number];

// ── Helpers ──────────────────────────────────────────────────────────────────

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function generateSecret(): string {
  // 32 bytes of CSPRNG → hex (64 chars), prefixed for identification
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return "whsec_" + Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmacSha256Hex(secret: string, payload: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ── Mutations ─────────────────────────────────────────────────────────────────

/**
 * Create a webhook subscription. Returns { id, signingSecret } — the
 * signingSecret is returned exactly once and never stored in plaintext.
 */
export const createSubscription = internalMutation({
  args: {
    userId: v.id("users"),
    url: v.string(),
    events: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const secret = generateSecret();
    const secretHash = await sha256Hex(secret);
    const encrypted = await encryptSecret(secret);

    const id = await ctx.db.insert("webhookSubscriptions", {
      userId: args.userId,
      url: args.url,
      secretHash,
      secretEncrypted: encrypted.ciphertext,
      secretIv: encrypted.iv,
      events: args.events,
      createdAt: Date.now(),
      failureCount: 0,
    });

    return { id, signingSecret: secret };
  },
});

/** Revoke a webhook subscription by id (must belong to userId). */
export const revokeSubscription = internalMutation({
  args: {
    userId: v.id("users"),
    subscriptionId: v.id("webhookSubscriptions"),
  },
  handler: async (ctx, args) => {
    const sub = await ctx.db.get(args.subscriptionId);
    if (!sub || sub.userId !== args.userId) {
      throw new Error("Subscription not found or not owned by user");
    }
    await ctx.db.delete(args.subscriptionId);
    return { deleted: true };
  },
});

/** List all subscriptions for a user (without secret). */
export const listSubscriptions = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const subs = await ctx.db
      .query("webhookSubscriptions")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();

    return subs.map((s) => ({
      id: s._id,
      url: s.url,
      events: s.events,
      createdAt: s.createdAt,
      lastDeliveryAt: s.lastDeliveryAt ?? null,
      lastDeliveryStatus: s.lastDeliveryStatus ?? null,
      failureCount: s.failureCount,
    }));
  },
});

// ── Delivery action ───────────────────────────────────────────────────────────

const MAX_FAILURES_BEFORE_DISABLE = 10;
const DELIVERY_TIMEOUT_MS = 5000;

/**
 * Deliver one webhook event to one subscription URL.
 * Signs the JSON payload with HMAC-SHA256 using the raw signing secret returned
 * at subscription creation. The raw secret is stored encrypted at rest; the hash
 * remains only for non-revealable auditing/contract checks.
 *
 * Headers sent:
 *   X-YouMD-Event: <event>
 *   X-YouMD-Signature: sha256=<hex>
 *   X-YouMD-Delivery: <subscriptionId>
 */
export const deliverWebhook = internalAction({
  args: {
    subscriptionId: v.id("webhookSubscriptions"),
    event: v.string(),
    payload: v.any(),
  },
  handler: async (ctx, args) => {
    const sub = await ctx.runQuery(internal.webhooks.getSubscription, {
      subscriptionId: args.subscriptionId,
    });

    // Skip if subscription was deleted or auto-disabled
    if (!sub) return;
    if (sub.failureCount >= MAX_FAILURES_BEFORE_DISABLE) return;

    const payloadStr = JSON.stringify(args.payload);
    const signingSecret =
      sub.secretEncrypted && sub.secretIv
        ? await decryptSecret(sub.secretEncrypted, sub.secretIv)
        : sub.secretHash;
    const signature = await hmacSha256Hex(signingSecret, payloadStr);

    let success = false;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);
      try {
        const res = await fetch(sub.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-YouMD-Event": args.event,
            "X-YouMD-Signature": `sha256=${signature}`,
            "X-YouMD-Delivery": String(args.subscriptionId),
          },
          body: payloadStr,
          signal: controller.signal,
        });
        success = res.ok;
      } finally {
        clearTimeout(timer);
      }
    } catch {
      success = false;
    }

    await ctx.runMutation(internal.webhooks.recordDelivery, {
      subscriptionId: args.subscriptionId,
      success,
    });
  },
});

/** Internal query: fetch a subscription row for delivery. */
export const getSubscription = internalQuery({
  args: { subscriptionId: v.id("webhookSubscriptions") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.subscriptionId);
  },
});

/** Internal mutation: update delivery status + failure count. */
export const recordDelivery = internalMutation({
  args: {
    subscriptionId: v.id("webhookSubscriptions"),
    success: v.boolean(),
  },
  handler: async (ctx, args) => {
    const sub = await ctx.db.get(args.subscriptionId);
    if (!sub) return;

    const prevFailureCount = args.success ? 0 : sub.failureCount + 1;
    await ctx.db.patch(args.subscriptionId, {
      lastDeliveryAt: Date.now(),
      lastDeliveryStatus: args.success ? "success" : "failure",
      failureCount: prevFailureCount,
    });
  },
});

/**
 * Schedule webhook deliveries for all subscriptions that include `event`.
 * Called after the triggering mutation succeeds.
 *
 * Auto-skips subscriptions that have hit the failure ceiling.
 */
export const scheduleWebhookDeliveries = internalMutation({
  args: {
    userId: v.id("users"),
    event: v.string(),
    payload: v.any(),
  },
  handler: async (ctx, args) => {
    const subs = await ctx.db
      .query("webhookSubscriptions")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();

    let scheduled = 0;
    for (const sub of subs) {
      if (!sub.events.includes(args.event)) continue;
      if (sub.failureCount >= MAX_FAILURES_BEFORE_DISABLE) continue;

      await ctx.scheduler.runAfter(0, internal.webhooks.deliverWebhook, {
        subscriptionId: sub._id,
        event: args.event,
        payload: args.payload,
      });
      scheduled++;
    }
    return { scheduled };
  },
});
