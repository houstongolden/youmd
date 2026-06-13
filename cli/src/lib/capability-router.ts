/**
 * Canonical capability router — CLI side.
 *
 * Pure function: no IO, no network, no Node-only APIs.
 * Input:  { manifest: { capabilities? }, request: { capability, args? } }
 * Output: { matched, capability, transports, reason? }
 *
 * A convex-side twin lives at convex/lib/capability-router.ts.
 * Both are pinned to the same JSON fixture: convex/__fixtures__/capability-router-cases.json.
 *
 * P18 (2026-06-12)
 */

export type CapabilityTransports = {
  /** Reachable via /api/v1/* HTTP endpoints. */
  http: boolean;
  /** Declared in tools/list on the MCP surface (/api/v1/mcp). */
  mcp: boolean;
};

/** Minimal capability shape — subset of YouStackCapability. */
export type CapabilityEntry = {
  id: string;
  intent?: string;
  localOnly?: boolean;
  mcpTool?: string;
  apiEndpoint?: string;
  requiredScopes?: string[];
  mutationPolicy?: string;
  transports?: CapabilityTransports;
};

/** Input manifest — only the capabilities array is needed for routing. */
export type RouterManifest = {
  capabilities?: CapabilityEntry[];
};

/** Request descriptor: exact capability ID lookup + optional opaque args. */
export type RouterRequest = {
  capability: string;
  args?: unknown;
};

/** Resolved routing decision. */
export type RouterResult = {
  /** True when a capability with the requested ID exists in the manifest. */
  matched: boolean;
  /** The capability ID that was matched, or null when unmatched. */
  capability: string | null;
  /** Transport availability from the matched capability, or both-false when unmatched. */
  transports: CapabilityTransports;
  /** Human-readable explanation of the routing decision. */
  reason?: string;
};

const UNMATCHED_TRANSPORTS: CapabilityTransports = { http: false, mcp: false };

/**
 * Resolve which capability a request maps to.
 *
 * Routing is exact-match on capability ID (case-sensitive). This is
 * intentional: agents should know the capability ID they want; fuzzy
 * text routing is a separate concern handled by routeYouStackRequest.
 */
export function resolveCapability(
  manifest: RouterManifest,
  request: RouterRequest,
): RouterResult {
  const id = typeof request.capability === "string" ? request.capability.trim() : "";

  if (!id) {
    return {
      matched: false,
      capability: null,
      transports: UNMATCHED_TRANSPORTS,
      reason: "Empty capability ID.",
    };
  }

  const capabilities = Array.isArray(manifest.capabilities) ? manifest.capabilities : [];
  const found = capabilities.find((cap) => cap.id === id);

  if (!found) {
    return {
      matched: false,
      capability: null,
      transports: UNMATCHED_TRANSPORTS,
      reason: `Capability "${id}" not found in manifest.`,
    };
  }

  const transports: CapabilityTransports = found.transports
    ? { http: Boolean(found.transports.http), mcp: Boolean(found.transports.mcp) }
    : UNMATCHED_TRANSPORTS;

  return {
    matched: true,
    capability: found.id,
    transports,
    reason: `Capability "${id}" matched.`,
  };
}
