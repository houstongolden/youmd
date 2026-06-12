/**
 * U17 — Portrait source chain (pure helpers, no Node APIs).
 *
 * Builds the ordered list of candidate source images for the server-side
 * ASCII portrait generator (convex/portrait.ts):
 *
 *   1. explicit avatarUrl on the profile (user-provided)
 *   2. explicit social images (primaryImage selection first)
 *   3. unavatar.io / direct provider avatars derived from known handles:
 *      x/twitter -> https://unavatar.io/x/<handle>?fallback=false
 *      github    -> https://github.com/<handle>.png   (direct, 404s cleanly)
 *      linkedin  -> https://unavatar.io/linkedin/<handle>?fallback=false
 *      (`fallback=false` makes unavatar return 404 instead of its generic
 *      placeholder, so validation in the action is meaningful)
 *   4. og:image scraped from the user's primary website link
 *   5. nothing — today's default is "no portrait"; the chain just ends.
 *
 * This module is intentionally free of "use node" so it can be imported by
 * both the Node-runtime portrait action and edge-runtime vitest tests.
 */

import {
  normalizeProfileLinks,
  sanitizePublicImageUrl,
} from "../lib/profileDirectory";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PortraitSourceCandidate =
  | {
      /** A direct image URL we can fetch + validate immediately. */
      type: "image";
      source:
        | "explicit"
        | "social-image"
        | "unavatar-x"
        | "github"
        | "unavatar-linkedin";
      url: string;
    }
  | {
      /** A website whose HTML must be fetched and parsed for og:image. */
      type: "og-scrape";
      source: "website-og-image";
      url: string;
    };

export interface PortraitProfileShape {
  avatarUrl?: unknown;
  socialImages?: unknown;
  primaryImage?: unknown;
  links?: unknown;
  /** links from the latest compiled bundle / embedded youJson */
  youJsonLinks?: unknown;
}

// ---------------------------------------------------------------------------
// Handle extraction from profile URLs
// ---------------------------------------------------------------------------

const X_HANDLE_RE = /^[A-Za-z0-9_]{1,15}$/;
const GITHUB_HANDLE_RE = /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/;
const LINKEDIN_SLUG_RE = /^[A-Za-z0-9%][A-Za-z0-9\-_%]{1,99}$/;

/** X path segments that are routes, not usernames. */
const X_RESERVED = new Set([
  "i", "home", "explore", "search", "intent", "share", "hashtag",
  "notifications", "messages", "settings", "compose", "login", "signup",
]);

/** GitHub path segments that are routes/orgs pages, not usernames. */
const GITHUB_RESERVED = new Set([
  "orgs", "features", "topics", "sponsors", "about", "pricing",
  "marketplace", "explore", "trending", "collections", "events",
  "settings", "login", "join", "apps", "site", "contact",
]);

function firstPathSegment(url: URL): string | null {
  const [segment] = url.pathname.split("/").filter(Boolean);
  return segment ? decodeURIComponentSafe(segment) : null;
}

function decodeURIComponentSafe(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function parseUrl(value: string): URL | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    return new URL(trimmed);
  } catch {
    // Tolerate scheme-less URLs like "x.com/houston"
    try {
      return new URL(`https://${trimmed}`);
    } catch {
      return null;
    }
  }
}

function hostMatches(url: URL, hosts: string[]): boolean {
  const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
  return hosts.some((h) => hostname === h || hostname.endsWith(`.${h}`));
}

/**
 * Extract an X/Twitter handle from a profile URL, "@handle", or bare handle.
 */
export function extractXHandle(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const raw = value.trim();

  // Bare "@handle" or "handle"
  if (!raw.includes("/") && !raw.includes(".")) {
    const bare = raw.replace(/^@/, "");
    return X_HANDLE_RE.test(bare) ? bare : null;
  }

  const url = parseUrl(raw);
  if (!url || !hostMatches(url, ["x.com", "twitter.com"])) return null;
  const segment = firstPathSegment(url);
  if (!segment) return null;
  const handle = segment.replace(/^@/, "");
  if (X_RESERVED.has(handle.toLowerCase())) return null;
  return X_HANDLE_RE.test(handle) ? handle : null;
}

/**
 * Extract a GitHub username from a profile URL or bare handle.
 */
export function extractGithubHandle(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const raw = value.trim();

  if (!raw.includes("/") && !raw.includes(".")) {
    const bare = raw.replace(/^@/, "");
    return GITHUB_HANDLE_RE.test(bare) ? bare : null;
  }

  const url = parseUrl(raw);
  if (!url || !hostMatches(url, ["github.com"])) return null;
  const segment = firstPathSegment(url);
  if (!segment || GITHUB_RESERVED.has(segment.toLowerCase())) return null;
  return GITHUB_HANDLE_RE.test(segment) ? segment : null;
}

/**
 * Extract a LinkedIn public slug from a profile URL.
 * Supports linkedin.com/in/<slug> and legacy linkedin.com/pub/<slug>.
 * Bare strings are NOT treated as LinkedIn slugs (too ambiguous).
 */
export function extractLinkedInHandle(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const url = parseUrl(value);
  if (!url || !hostMatches(url, ["linkedin.com"])) return null;
  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length < 2) return null;
  const prefix = segments[0].toLowerCase();
  if (prefix !== "in" && prefix !== "pub") return null;
  const slug = decodeURIComponentSafe(segments[1]);
  return LINKEDIN_SLUG_RE.test(slug) ? slug : null;
}

// ---------------------------------------------------------------------------
// Website link selection
// ---------------------------------------------------------------------------

const SOCIAL_LINK_KEYS = new Set(["x", "twitter", "github", "linkedin"]);
const SOCIAL_HOSTS = ["x.com", "twitter.com", "github.com", "linkedin.com"];

/**
 * Pick the user's primary website link: the canonical "website" key first,
 * otherwise the first http(s) link that is not a known social profile.
 */
export function pickWebsiteLink(links: Record<string, string>): string | null {
  const website = links.website;
  if (website && isHttpUrl(website)) return website.trim();

  for (const [key, value] of Object.entries(links)) {
    if (SOCIAL_LINK_KEYS.has(key.trim().toLowerCase())) continue;
    if (!isHttpUrl(value)) continue;
    const url = parseUrl(value);
    if (url && hostMatches(url, SOCIAL_HOSTS)) continue;
    return value.trim();
  }
  return null;
}

function isHttpUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  return trimmed.startsWith("http://") || trimmed.startsWith("https://");
}

// ---------------------------------------------------------------------------
// og:image parsing
// ---------------------------------------------------------------------------

const OG_IMAGE_PATTERNS = [
  /<meta[^>]+(?:property|name)=["']og:image(?::secure_url|:url)?["'][^>]+content=["']([^"']+)["'][^>]*>/i,
  /<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']og:image(?::secure_url|:url)?["'][^>]*>/i,
];

/**
 * Extract the og:image URL from raw HTML. Handles both attribute orders and
 * resolves relative URLs against the page URL. Returns an absolute http(s)
 * URL or null.
 */
export function extractOgImageUrl(html: string, pageUrl: string): string | null {
  if (typeof html !== "string" || !html) return null;

  let raw: string | undefined;
  for (const pattern of OG_IMAGE_PATTERNS) {
    raw = html.match(pattern)?.[1]?.trim();
    if (raw) break;
  }
  if (!raw) return null;

  // Decode the most common HTML entities found in attribute values.
  raw = raw.replace(/&amp;/g, "&").replace(/&#x2F;/gi, "/").replace(/&#47;/g, "/");

  try {
    const resolved = new URL(raw, pageUrl);
    if (resolved.protocol !== "http:" && resolved.protocol !== "https:") return null;
    return sanitizePublicImageUrl(resolved.toString()) ?? resolved.toString();
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// The ordered source chain
// ---------------------------------------------------------------------------

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

/**
 * Build the ordered portrait source chain for a profile. Pure: returns
 * candidates only — fetching/validation happens in the portrait action.
 * Duplicate URLs are removed, keeping the earliest (highest-priority) entry.
 */
export function resolvePortraitSourceChain(
  profile: PortraitProfileShape
): PortraitSourceCandidate[] {
  const candidates: PortraitSourceCandidate[] = [];
  const seen = new Set<string>();

  const pushImage = (
    source: Extract<PortraitSourceCandidate, { type: "image" }>["source"],
    rawUrl: unknown
  ) => {
    const cleaned = sanitizePublicImageUrl(rawUrl);
    if (!cleaned || !isHttpUrl(cleaned)) return;
    if (seen.has(cleaned)) return;
    seen.add(cleaned);
    candidates.push({ type: "image", source, url: cleaned });
  };

  // 1. Explicit avatarUrl — the user said "use this image".
  pushImage("explicit", profile.avatarUrl);

  // 2. Stored social images, primaryImage selection first.
  const socialImages = asRecord(profile.socialImages);
  const primaryKey =
    typeof profile.primaryImage === "string" ? profile.primaryImage.trim().toLowerCase() : "";
  if (primaryKey && typeof socialImages[primaryKey] === "string") {
    pushImage("social-image", socialImages[primaryKey]);
  }
  for (const key of ["x", "github", "linkedin", "custom"]) {
    if (typeof socialImages[key] === "string") pushImage("social-image", socialImages[key]);
  }

  // 3. Provider avatars derived from handles in profile links (richer after
  //    the research pipeline has populated links/youJson).
  const links = normalizeProfileLinks(profile.links, profile.youJsonLinks);

  const xHandle = extractXHandle(links.x) ?? extractXHandle(links.twitter);
  if (xHandle) {
    pushImage("unavatar-x", `https://unavatar.io/x/${encodeURIComponent(xHandle)}?fallback=false`);
  }

  const githubHandle = extractGithubHandle(links.github);
  if (githubHandle) {
    pushImage("github", `https://github.com/${encodeURIComponent(githubHandle)}.png`);
  }

  const linkedInHandle = extractLinkedInHandle(links.linkedin);
  if (linkedInHandle) {
    pushImage(
      "unavatar-linkedin",
      `https://unavatar.io/linkedin/${encodeURIComponent(linkedInHandle)}?fallback=false`
    );
  }

  // 4. og:image from the primary website link (scraped at action time).
  const website = pickWebsiteLink(links);
  if (website && !seen.has(website)) {
    seen.add(website);
    candidates.push({ type: "og-scrape", source: "website-og-image", url: website });
  }

  // 5. Fallback is today's default: no portrait. Chain simply ends.
  return candidates;
}
