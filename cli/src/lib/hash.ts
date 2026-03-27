import { createHash } from "node:crypto";

// Deterministic JSON serialization — MUST match server-side canonicalJsonString exactly
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
      (k) => JSON.stringify(k) + ":" + canonicalJsonString((obj as Record<string, unknown>)[k])
    );
    return "{" + pairs.join(",") + "}";
  }
  return String(obj);
}

export function computeContentHash(youJson: unknown, youMd: string): string {
  const content = canonicalJsonString(youJson) + "\n---\n" + youMd;
  return createHash("sha256").update(content, "utf-8").digest("hex");
}

export function shortHash(hash: string): string {
  return hash.slice(0, 12);
}
