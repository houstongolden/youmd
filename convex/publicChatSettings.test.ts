import { describe, expect, it } from "vitest";
import { convexTest } from "convex-test";

import { api } from "./_generated/api";
import schema from "./schema";

const CLERK = "clerk_public_chat_settings";

describe("public profile chat settings", () => {
  it("lets the owner persist public chat controls into the public youJson", async () => {
    const t = convexTest(schema);
    const profileId = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        clerkId: CLERK,
        username: "chat-settings-owner",
        email: "chat-settings@example.com",
        plan: "pro",
        createdAt: Date.now(),
      });
      return await ctx.db.insert("profiles", {
        username: "chat-settings-owner",
        ownerId: userId,
        isClaimed: true,
        name: "Chat Settings Owner",
        youJson: {
          identity: { name: "Chat Settings Owner" },
          preferences: { agent: { tone: "direct" } },
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const asOwner = t.withIdentity({ subject: CLERK });
    await asOwner.mutation(api.profiles.updatePublicChatSettings, {
      clerkId: CLERK,
      profileId,
      enabled: false,
      style: "voice",
      allowedFields: ["projects", "links", "private.notes"],
      capabilities: ["voice", "api", "unknown"],
      customPrompt: "Answer like my public profile concierge.",
      showSources: false,
    });

    const profile = await t.query(api.profiles.getPublicProfile, {
      username: "chat-settings-owner",
    });
    const publicChat = profile?.youJson?.preferences?.public_chat;

    expect(publicChat).toMatchObject({
      enabled: false,
      style: "voice",
      allowedFields: ["projects", "links"],
      capabilities: ["voice", "api"],
      customPrompt: "Answer like my public profile concierge.",
      showSources: false,
    });
  });
});
