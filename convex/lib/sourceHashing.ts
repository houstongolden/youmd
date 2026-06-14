/**
 * Immutable-source primitives for the ingestion pipeline.
 *
 * Enforces the anti-drift discipline that keeps an agent knowledge base honest:
 *   - raw fetched source content is content-addressed (SHA-256) and never
 *     overwritten in place — a re-fetch with changed content is a NEW version;
 *   - compiled output carries provenance back to the sources it derives from.
 *
 * These helpers are pure (no Convex context) so they can be unit-tested without
 * a deploy. The mutation/action wiring lives in convex/pipeline/.
 */

/** SHA-256 hex of raw fetched content (string or bytes). Content-addressing. */
export async function computeRawSourceHash(content: string | ArrayBuffer): Promise<string> {
  const bytes =
    typeof content === "string" ? new TextEncoder().encode(content) : new Uint8Array(content);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Whether a re-fetch produced different content than what we already have. */
export function isContentChanged(oldHash: string | undefined, newHash: string): boolean {
  return !!newHash && oldHash !== newHash;
}

/**
 * Decide whether a fetch should append a new immutable version. A version is
 * recorded on first fetch (no prior hash) or whenever the content changed —
 * never an in-place overwrite of identical content.
 */
export function shouldRecordVersion(oldHash: string | undefined, newHash: string): boolean {
  if (!newHash) return false;
  return !oldHash || oldHash !== newHash;
}

export interface ImmutableSourceLike {
  sourceType: string;
  sourceUrl: string;
  lastRawContentHash?: string;
  latestVersionId?: string;
  lastFetched?: number;
  status?: string;
}

export interface SourceProvenance {
  type: string;
  url: string;
  content_hash?: string;
  version_id?: string;
  last_fetched?: number;
}

/**
 * Build per-source provenance from source records — what each derived concept
 * traces back to. Only includes extracted sources with a real URL.
 */
export function buildProvenanceMap(
  sources: ImmutableSourceLike[],
): Record<string, SourceProvenance> {
  const out: Record<string, SourceProvenance> = {};
  for (const s of sources) {
    if (!s.sourceUrl) continue;
    if (s.status && s.status !== "extracted") continue;
    out[s.sourceType] = {
      type: s.sourceType,
      url: s.sourceUrl,
      content_hash: s.lastRawContentHash,
      version_id: s.latestVersionId,
      last_fetched: s.lastFetched,
    };
  }
  return out;
}

/** Flat list of provenance entries for `meta.sources_used` (OKF linked_sources). */
export function buildSourcesUsed(sources: ImmutableSourceLike[]): SourceProvenance[] {
  return Object.values(buildProvenanceMap(sources)).sort((a, b) => a.type.localeCompare(b.type));
}

/**
 * Immutability guard: throw if an in-place overwrite would silently discard a
 * different prior version. Callers must record a new version instead. This is
 * the enforcement point — wire it before any raw-content patch.
 */
export function assertNoInPlaceOverwrite(
  oldHash: string | undefined,
  newHash: string,
  context = "raw source content",
): void {
  if (oldHash && newHash && oldHash !== newHash) {
    throw new Error(
      `immutable-source violation: ${context} changed (${oldHash.slice(0, 12)}… -> ${newHash.slice(
        0,
        12,
      )}…) — record a new version, do not overwrite in place`,
    );
  }
}
