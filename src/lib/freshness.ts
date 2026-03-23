/**
 * Freshness scoring — calculates how up-to-date a profile is
 * based on source sync timestamps.
 */

/** Compute a 0-100 freshness score from an array of sync timestamps */
export function computeFreshnessScore(syncDates: (string | number | null)[]): number {
  const now = Date.now();
  const valid = syncDates
    .filter(Boolean)
    .map(d => typeof d === "number" ? d : new Date(d!).getTime());
  if (valid.length === 0) return 0;

  const scores = valid.map(ts => {
    const ageDays = (now - ts) / (1000 * 60 * 60 * 24);
    if (ageDays <= 1) return 100;
    if (ageDays >= 30) return 0;
    return Math.round(100 * (1 - (ageDays - 1) / 29));
  });

  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}

/** Get a freshness label from a score */
export function freshnessLabel(score: number): { text: string; color: string } {
  if (score >= 80) return { text: "current", color: "text-[hsl(var(--success))]" };
  if (score >= 50) return { text: "stale", color: "text-[hsl(var(--accent))]" };
  if (score >= 20) return { text: "outdated", color: "text-[hsl(var(--accent))]" };
  return { text: "unknown", color: "text-[hsl(var(--text-secondary))]" };
}

/** Per-dimension freshness */
export function computeDimensionFreshness(sources: { platform: string; lastSynced: string | number | null }[]) {
  const now = Date.now();
  const freshness = (ts: string | number | null): string => {
    if (!ts) return "unknown";
    const ms = typeof ts === "number" ? ts : new Date(ts).getTime();
    const days = (now - ms) / (1000 * 60 * 60 * 24);
    if (days <= 1) return "current";
    if (days <= 7) return "recent";
    if (days <= 30) return "stale";
    return "outdated";
  };

  const identitySource = sources.find(s => s.platform === "linkedin" || s.platform === "x");
  const projectsSource = sources.find(s => s.platform === "github");
  const allDates = sources.map(s => s.lastSynced).filter(Boolean);
  const mostRecent = allDates.length > 0
    ? allDates.sort((a, b) => {
        const ta = typeof a === "number" ? a : new Date(a!).getTime();
        const tb = typeof b === "number" ? b : new Date(b!).getTime();
        return tb - ta;
      })[0]
    : null;

  return {
    identity: freshness(identitySource?.lastSynced ?? mostRecent),
    projects: freshness(projectsSource?.lastSynced ?? null),
    voice: freshness(mostRecent),
    sources: freshness(mostRecent),
    score: computeFreshnessScore(sources.map(s => s.lastSynced)),
  };
}
