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
