import { createHash } from "node:crypto";
import { canonicalJsonString } from "./canonical-json";

export function computeContentHash(youJson: unknown, youMd: string): string {
  const content = canonicalJsonString(youJson) + "\n---\n" + youMd;
  return createHash("sha256").update(content, "utf-8").digest("hex");
}

export function shortHash(hash: string): string {
  return hash.slice(0, 12);
}
