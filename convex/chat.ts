"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";

/**
 * Chat proxy — routes LLM calls through the backend.
 * Tries Anthropic API directly (best quality), falls back to OpenRouter.
 */
export const onboardingChat = action({
  args: {
    messages: v.array(
      v.object({
        role: v.union(v.literal("system"), v.literal("user"), v.literal("assistant")),
        content: v.string(),
      })
    ),
  },
  handler: async (_ctx, args) => {
    // Try Anthropic API directly first (best quality, lowest latency)
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (anthropicKey) {
      try {
        return await callAnthropic(anthropicKey, args.messages);
      } catch (err) {
        console.error("Anthropic API failed, falling back to OpenRouter:", err);
      }
    }

    // Fallback to OpenRouter
    const openrouterKey = process.env.OPENROUTER_API_KEY;
    if (openrouterKey) {
      try {
        return await callOpenRouter(openrouterKey, args.messages);
      } catch (err) {
        console.error("OpenRouter API also failed:", err);
        throw err;
      }
    }

    throw new Error("No LLM API key configured. Set ANTHROPIC_API_KEY or OPENROUTER_API_KEY.");
  },
});

/** Call Anthropic API directly */
async function callAnthropic(
  apiKey: string,
  messages: { role: string; content: string }[]
): Promise<string> {
  // Anthropic format: system message goes in separate field
  const systemMessage = messages.find((m) => m.role === "system");
  const conversationMessages = messages.filter((m) => m.role !== "system");

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      temperature: 0.7,
      system: systemMessage?.content || "",
      messages: conversationMessages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Anthropic ${response.status}: ${errorBody.slice(0, 300)}`);
  }

  const data = await response.json();
  const content = data.content?.[0]?.text;
  if (!content) throw new Error("Empty response from Anthropic");
  return content;
}

/** Call OpenRouter API (fallback) */
async function callOpenRouter(
  apiKey: string,
  messages: { role: string; content: string }[]
): Promise<string> {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://you.md",
      "X-Title": "You.md Agent",
    },
    body: JSON.stringify({
      model: "anthropic/claude-sonnet-4",
      messages,
      temperature: 0.7,
      max_tokens: 4096,
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`OpenRouter ${response.status}: ${errorBody.slice(0, 300)}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Empty response from OpenRouter");
  return content;
}
