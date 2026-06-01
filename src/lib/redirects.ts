export function sanitizeNextPath(nextPathRaw: string | null, fallback = "/shell"): string {
  if (!nextPathRaw) return fallback;

  // Only allow internal, absolute paths.
  if (!nextPathRaw.startsWith("/")) return fallback;

  // Disallow protocol-relative URLs ("//evil.com") and anything that smells like a scheme.
  if (nextPathRaw.startsWith("//")) return fallback;
  if (nextPathRaw.includes("://")) return fallback;

  // Normalize multiple leading slashes down to one (defensive).
  return `/${nextPathRaw.replace(/^\/+/, "")}`;
}

