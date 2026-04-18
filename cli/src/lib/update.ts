import { readGlobalConfig, writeGlobalConfig } from "./config";

const UPDATE_CACHE_TTL_MS = 1000 * 60 * 60 * 12;

function parseVersion(version: string): number[] {
  return version.split(".").map((part) => Number.parseInt(part, 10) || 0);
}

export function isVersionNewer(current: string, candidate: string): boolean {
  const a = parseVersion(current);
  const b = parseVersion(candidate);
  const length = Math.max(a.length, b.length);

  for (let i = 0; i < length; i++) {
    const currentPart = a[i] ?? 0;
    const candidatePart = b[i] ?? 0;
    if (candidatePart > currentPart) return true;
    if (candidatePart < currentPart) return false;
  }

  return false;
}

export async function checkForCliUpdate(currentVersion: string): Promise<string | null> {
  const config = readGlobalConfig();
  const cachedLatest = config.lastCliLatestVersion;
  const cachedAt = config.lastCliUpdateCheckAt ? Date.parse(config.lastCliUpdateCheckAt) : 0;
  const now = Date.now();

  if (
    cachedLatest &&
    cachedAt > 0 &&
    Number.isFinite(cachedAt) &&
    now - cachedAt < UPDATE_CACHE_TTL_MS
  ) {
    return isVersionNewer(currentVersion, cachedLatest) ? cachedLatest : null;
  }

  try {
    const res = await fetch("https://registry.npmjs.org/youmd/latest", {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(1500),
    });
    if (!res.ok) return null;

    const data = await res.json() as { version?: string };
    const latest = data.version?.trim();
    if (!latest) return null;

    config.lastCliLatestVersion = latest;
    config.lastCliUpdateCheckAt = new Date(now).toISOString();
    writeGlobalConfig(config);

    return isVersionNewer(currentVersion, latest) ? latest : null;
  } catch {
    return null;
  }
}
