/**
 * Content-addressed hashing for identity bundles.
 * Produces deterministic SHA-256 hashes from youJson + youMd content.
 * Used to track ancestry and detect divergence (like git commit hashes).
 */

// Deterministic JSON serialization — sorted keys, no whitespace ambiguity
function canonicalJsonString(obj: unknown): string {
  if (obj === null || obj === undefined) return "null";
  if (typeof obj === "string") return JSON.stringify(obj);
  if (typeof obj === "number" || typeof obj === "boolean") return String(obj);
  if (Array.isArray(obj)) {
    return "[" + obj.map(canonicalJsonString).join(",") + "]";
  }
  if (typeof obj === "object") {
    const keys = Object.keys(obj as Record<string, unknown>).sort();
    const pairs = keys.map(
      (k) =>
        JSON.stringify(k) +
        ":" +
        canonicalJsonString((obj as Record<string, unknown>)[k])
    );
    return "{" + pairs.join(",") + "}";
  }
  return String(obj);
}

export async function computeContentHash(
  youJson: unknown,
  youMd: string
): Promise<string> {
  const content = canonicalJsonString(youJson) + "\n---\n" + youMd;
  const encoded = new TextEncoder().encode(content);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function shortHash(hash: string): string {
  return hash.slice(0, 12);
}

// ── Memory content-hash dedupe (P23, PRODUCT-AUDIT #25) ─────────
//
// memories had no uniqueness check: the same agent re-stating the same fact
// (or a retried POST /api/v1/me/memories) inserted exact duplicates. Each
// memory now stores contentHash = sha256(normalize(content) + "\n" +
// normalize(category)); saveMemories / saveFromAgent skip inserting when an
// ACTIVE memory with the same hash already exists for the user (archived
// duplicates do NOT block — re-learning an archived fact is legitimate).

/**
 * Normalization for dedupe purposes: trim, collapse internal whitespace
 * (including newlines), lowercase. "Based in  Miami" === "based in miami".
 */
export function normalizeMemoryText(text: string): string {
  return text.trim().replace(/\s+/g, " ").toLowerCase();
}

/** Deterministic dedupe hash over normalized content + category. */
export async function computeMemoryContentHash(
  content: string,
  category: string
): Promise<string> {
  const canonical =
    normalizeMemoryText(content) + "\n" + normalizeMemoryText(category);
  const encoded = new TextEncoder().encode(canonical);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
