// Server-side repo mirror policy.
//
// This mirror is intentionally safe and bounded: it includes agent-readable
// identity/stack/project metadata, while excluding private/* because that
// belongs in the encrypted Secret Vault path.

// Keep the snapshot inside Convex document limits.
export const MIRROR_MAX_FILES = 100;
export const MIRROR_MAX_FILE_BYTES = 128 * 1024;
export const MIRROR_MAX_TOTAL_BYTES = 700 * 1024;

/** Whether a repo path should be mirrored server-side. */
export function isMirrorablePath(path: string): boolean {
  if (path.startsWith("private/")) return false;
  if (path === "you.md" || path === "you.json" || path === "README.md") return true;
  if (path.startsWith("stacks/")) return true;
  if (path.startsWith("agent-stack/")) return true;
  if (path.startsWith("identity/")) return true;
  if (path.startsWith("projects/")) return true;
  if (path.startsWith("context/")) return true;
  if (/^[^/]+\.md$/.test(path)) return true;
  return false;
}
