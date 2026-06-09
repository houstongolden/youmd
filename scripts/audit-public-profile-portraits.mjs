#!/usr/bin/env node

const args = process.argv.slice(2);

function argValue(name, fallback) {
  const prefix = `--${name}=`;
  const found = args.find((arg) => arg.startsWith(prefix));
  if (found) return found.slice(prefix.length);
  const index = args.indexOf(`--${name}`);
  if (index >= 0 && args[index + 1] && !args[index + 1].startsWith("--")) return args[index + 1];
  return fallback;
}

const baseUrl = (argValue("base-url", process.env.YOU_PROFILE_AUDIT_BASE_URL || "http://localhost:3100") || "").replace(/\/$/, "");
const checkPages = args.includes("--check-pages");
const rawPageLimit = argValue("page-limit", checkPages ? "50" : "0");
const pageLimit = rawPageLimit === "all" ? Number.POSITIVE_INFINITY : Number(rawPageLimit);

function hasRenderableAsciiPortrait(value) {
  return Boolean(
    value &&
      typeof value === "object" &&
      Array.isArray(value.lines) &&
      value.lines.some((line) => typeof line === "string" && line.trim().length > 0)
  );
}

function profileArray(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.profiles)) return payload.profiles;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

async function getJson(path) {
  const response = await fetch(`${baseUrl}${path}`);
  if (!response.ok) {
    throw new Error(`${path} returned ${response.status}`);
  }
  return response.json();
}

async function getStatus(path) {
  const response = await fetch(`${baseUrl}${path}`, { method: "GET" });
  return response.status;
}

async function main() {
  const payload = await getJson("/api/v1/profiles");
  const profiles = profileArray(payload);

  if (profiles.length === 0) {
    throw new Error(`/api/v1/profiles returned no profiles from ${baseUrl}`);
  }

  const missingPortraits = [];
  const missingUsernames = [];

  for (const profile of profiles) {
    const username = typeof profile?.username === "string" ? profile.username.trim() : "";
    if (!username) {
      missingUsernames.push(profile);
      continue;
    }

    const asciiPortrait = profile.asciiPortrait ?? profile._profile?.asciiPortrait;
    const avatarUrl = profile.avatarUrl ?? profile._profile?.avatarUrl ?? "";
    const hasPortrait =
      profile.hasPortrait === true ||
      (typeof avatarUrl === "string" && avatarUrl.trim().length > 0) ||
      hasRenderableAsciiPortrait(asciiPortrait);

    if (!hasPortrait) missingPortraits.push(username);
  }

  const pageFailures = [];
  if (checkPages) {
    const sample = profiles
      .map((profile) => (typeof profile?.username === "string" ? profile.username.trim() : ""))
      .filter(Boolean)
      .slice(0, pageLimit);

    for (const username of sample) {
      const status = await getStatus(`/${encodeURIComponent(username)}`);
      if (status !== 200) pageFailures.push(`${username} (${status})`);
    }
  }

  if (missingUsernames.length || missingPortraits.length || pageFailures.length) {
    console.error("public profile portrait audit failed:");
    if (missingUsernames.length) console.error(`- ${missingUsernames.length} profile(s) missing username`);
    if (missingPortraits.length) console.error(`- missing portrait source: ${missingPortraits.join(", ")}`);
    if (pageFailures.length) console.error(`- profile pages not 200: ${pageFailures.join(", ")}`);
    process.exit(1);
  }

  const pageSuffix = checkPages
    ? `; ${Math.min(profiles.length, pageLimit)} profile page(s) returned 200`
    : "";

  console.log(`public profile portrait audit ok: ${profiles.length} profile(s) have an image or ASCII portrait${pageSuffix}`);
}

main().catch((error) => {
  console.error("public profile portrait audit failed:");
  console.error(`- ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
