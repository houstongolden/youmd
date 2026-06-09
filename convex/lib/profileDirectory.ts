type AnyRecord = Record<string, unknown>;

const SENSITIVE_IMAGE_PARAMS = ["apiKey", "apikey", "api_key", "access_token", "token"];
const DIRECTORY_SUPPRESSED_USERNAME_RE =
  /^(qaprune|qarepro|qaclean|qastale|qalocal|qaweb|websignin|youmdqa|youmdreg)[a-z0-9-]*/i;

export function canonicalUsername(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) return trimmed;
    }
  }
  return undefined;
}

function asRecord(value: unknown): AnyRecord {
  return value && typeof value === "object" ? (value as AnyRecord) : {};
}

function timestamp(value: AnyRecord): number {
  for (const key of ["updatedAt", "createdAt", "_creationTime"]) {
    const candidate = value[key];
    if (typeof candidate === "number") return candidate;
  }
  return 0;
}

export function sanitizePublicImageUrl(value: unknown): string | undefined {
  const raw = firstString(value);
  if (!raw) return undefined;
  if (raw.startsWith("/")) return raw;

  try {
    const url = new URL(raw);
    for (const param of SENSITIVE_IMAGE_PARAMS) {
      url.searchParams.delete(param);
    }
    return url.toString();
  } catch {
    return raw;
  }
}

function canonicalLinkKey(key: string): string {
  const lower = key.trim().toLowerCase();
  if (lower === "x/twitter" || lower === "twitter") return "x";
  if (lower.includes("github")) return "github";
  if (lower.includes("linkedin")) return "linkedin";
  if (lower.includes("website") || lower === "site" || lower === "personal site") return "website";
  return lower;
}

export function normalizeProfileLinks(...sources: unknown[]): Record<string, string> {
  const links: Record<string, string> = {};

  for (const source of sources) {
    if (!source || typeof source !== "object") continue;
    for (const [key, value] of Object.entries(source as Record<string, unknown>)) {
      if (typeof value !== "string" || !value.trim()) continue;
      const originalKey = key.trim();
      const canonicalKey = canonicalLinkKey(originalKey);
      links[originalKey] = value.trim();
      if (!links[canonicalKey]) links[canonicalKey] = value.trim();
    }
  }

  return links;
}

export function sanitizeSocialImages(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object") return {};

  const result: Record<string, string> = {};
  for (const [key, url] of Object.entries(value as Record<string, unknown>)) {
    const cleaned = sanitizePublicImageUrl(url);
    if (cleaned) result[canonicalLinkKey(key)] = cleaned;
  }
  return result;
}

function handleFromUrl(url: string | undefined, host: string): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.toLowerCase().includes(host)) return null;
    const [handle] = parsed.pathname.split("/").filter(Boolean);
    return handle || null;
  } catch {
    const match = url.match(new RegExp(`${host.replace(".", "\\.")}/([^/?#]+)`, "i"));
    return match?.[1] ?? null;
  }
}

export function resolveProfileAvatar(profile: AnyRecord): string | undefined {
  const youJson = asRecord(profile.youJson);
  const identity = asRecord(youJson.identity);
  const profileMeta = asRecord(youJson._profile);
  const socialImages = {
    ...sanitizeSocialImages(youJson.social_images),
    ...sanitizeSocialImages(profile.socialImages),
  };
  const primaryImage = firstString(profile.primaryImage, profileMeta.primaryImage);

  if (primaryImage && socialImages[canonicalLinkKey(primaryImage)]) {
    return socialImages[canonicalLinkKey(primaryImage)];
  }

  const explicit = sanitizePublicImageUrl(
    profile.avatarUrl ??
      profileMeta.avatarUrl ??
      identity.avatarUrl ??
      identity.avatar_url ??
      identity.photoUrl ??
      identity.image
  );
  if (explicit) return explicit;

  const firstSocial = firstString(socialImages.github, socialImages.x, socialImages.linkedin, socialImages.custom);
  if (firstSocial) return firstSocial;

  const links = normalizeProfileLinks(profile.links, youJson.links);
  const githubHandle = handleFromUrl(links.github, "github.com");
  if (githubHandle) return `https://github.com/${githubHandle}.png`;

  const xHandle = handleFromUrl(links.x, "x.com") ?? handleFromUrl(links.x, "twitter.com");
  if (xHandle) return `https://unavatar.io/x/${xHandle}`;

  const linkedInHandle = handleFromUrl(links.linkedin, "linkedin.com");
  if (linkedInHandle) return `https://unavatar.io/linkedin/${linkedInHandle}`;

  return undefined;
}

export function hasRenderableAsciiPortrait(portrait: unknown): boolean {
  if (!portrait || typeof portrait !== "object") return false;
  const lines = (portrait as AnyRecord).lines;
  if (!Array.isArray(lines) || lines.length === 0) return false;
  return lines.some((line) => typeof line === "string" && line.trim().length > 0);
}

export function sanitizeAsciiPortrait(portrait: unknown): unknown {
  if (!hasRenderableAsciiPortrait(portrait)) return null;
  const sourceUrl = sanitizePublicImageUrl((portrait as AnyRecord).sourceUrl);
  return {
    ...(portrait as AnyRecord),
    sourceUrl: sourceUrl ?? firstString((portrait as AnyRecord).sourceUrl) ?? "",
  };
}

export function isDirectorySuppressedUsername(username: unknown): boolean {
  return DIRECTORY_SUPPRESSED_USERNAME_RE.test(canonicalUsername(username));
}

function hasPortrait(profile: AnyRecord): boolean {
  return hasRenderableAsciiPortrait(profile.asciiPortrait);
}

export function profileQualityScore(profile: AnyRecord): number {
  const youJson = (profile.youJson ?? {}) as AnyRecord;
  const identity = (youJson.identity ?? {}) as AnyRecord;
  const projects = Array.isArray(youJson.projects) ? youJson.projects : profile.projects;
  const links = normalizeProfileLinks(profile.links, youJson.links);

  return (
    (profile.isClaimed ? 40 : 0) +
    (profile.youJson ? 24 : 0) +
    (hasPortrait(profile) ? 16 : 0) +
    (resolveProfileAvatar(profile) ? 12 : 0) +
    (firstString(profile.tagline, identity.tagline) ? 6 : 0) +
    (firstString(profile.location, identity.location) ? 3 : 0) +
    (Array.isArray(projects) ? Math.min(projects.length, 5) : 0) +
    Math.min(Object.keys(links).length, 5)
  );
}

export function normalizeDirectoryProfile<T extends AnyRecord>(profile: T): T | null {
  const username = canonicalUsername(profile.username);
  if (!username || isDirectorySuppressedUsername(username)) return null;

  const youJson = asRecord(profile.youJson);
  const identity = asRecord(youJson.identity);
  const links = normalizeProfileLinks(profile.links, youJson.links);
  const avatarUrl = resolveProfileAvatar(profile);
  const socialImages = {
    ...sanitizeSocialImages(youJson.social_images),
    ...sanitizeSocialImages(profile.socialImages),
  };
  const asciiPortrait = sanitizeAsciiPortrait(profile.asciiPortrait);

  return {
    ...profile,
    username,
    name: firstString(profile.name, identity.name, username),
    tagline: firstString(profile.tagline, identity.tagline),
    location: firstString(profile.location, identity.location),
    links,
    avatarUrl,
    socialImages,
    asciiPortrait,
  };
}

export function selectBestProfile<T extends AnyRecord>(profiles: T[]): T | null {
  if (profiles.length === 0) return null;
  return [...profiles].sort((a, b) => {
    const qualityDelta = profileQualityScore(b) - profileQualityScore(a);
    if (qualityDelta !== 0) return qualityDelta;
    return timestamp(b) - timestamp(a);
  })[0] ?? null;
}
