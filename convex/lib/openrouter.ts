/**
 * Shared OpenRouter LLM call helpers for pipeline actions.
 *
 * Note: Convex bundles each "use node" action file independently, so this code
 * may be duplicated at bundle time. The benefit is source-level DRY — changes
 * here propagate to both extract.ts and analyze.ts.
 */

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "anthropic/claude-sonnet-4";

export interface OpenRouterOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
}

export async function callOpenRouter(
  apiKey: string,
  systemPrompt: string,
  userContent: string,
  options: OpenRouterOptions = {}
): Promise<string> {
  const {
    model = DEFAULT_MODEL,
    temperature = 0.2,
    maxTokens = 4096,
    timeout = 60_000,
  } = options;

  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://you.md",
      "X-Title": "You.md Pipeline",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      temperature,
      max_tokens: maxTokens,
      response_format: { type: "json_object" },
    }),
    signal: AbortSignal.timeout(timeout),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `OpenRouter API error ${response.status}: ${errorBody.slice(0, 500)}`
    );
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("No content in OpenRouter response");
  }

  return content;
}

export function parseJsonResponse(raw: string): Record<string, unknown> {
  let cleaned = raw.trim();

  // Strip markdown code fences if present
  if (cleaned.startsWith("```")) {
    cleaned = cleaned
      .replace(/^```(?:json)?\s*\n?/, "")
      .replace(/\n?```\s*$/, "");
  }

  try {
    return JSON.parse(cleaned);
  } catch {
    throw new Error(
      `Failed to parse LLM JSON response: ${cleaned.slice(0, 200)}...`
    );
  }
}
