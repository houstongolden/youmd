/**
 * Canonical JSON serialization — keys sorted, no extra whitespace.
 * Used by hash computation so input key order doesn't affect the digest.
 * Must remain stable across Node versions; do not use JSON.stringify with
 * a replacer that depends on insertion order.
 */

export function canonicalJsonString(obj: unknown): string {
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
        canonicalJsonString((obj as Record<string, unknown>)[k]),
    );
    return "{" + pairs.join(",") + "}";
  }
  return String(obj);
}
