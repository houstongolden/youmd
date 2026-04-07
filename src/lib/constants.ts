/**
 * Shared constants for the You.md web app.
 * Centralizes environment-derived values so nothing is hardcoded in components.
 */

/** Convex HTTP Actions site URL (derived from the cloud URL env var) */
export const CONVEX_SITE_URL =
  process.env.NEXT_PUBLIC_CONVEX_URL?.replace(".cloud", ".site") ||
  "https://kindly-cassowary-600.convex.site";
