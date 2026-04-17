"use client";

import { Authenticated, AuthLoading, Unauthenticated } from "convex/react";
import type { ReactNode } from "react";

/**
 * Cycle 71: gates all (app) route children behind Convex auth readiness.
 *
 * The problem: after first-party session auth succeeds, the app can know
 * about the signed-in user before Convex finishes validating the custom JWT.
 * Any useQuery/useMutation that calls requireOwner sees null identity
 * and throws "authentication required", crashing the page.
 *
 * Fix: Convex's <Authenticated> only renders children AFTER the JWT
 * is validated. <AuthLoading> shows a branded loading state during
 * the sync window (typically 200-500ms). <Unauthenticated> shows
 * nothing (the middleware handles redirect to /sign-in for unauth'd
 * users, so this branch rarely fires).
 */
export function AuthGate({ children }: { children: ReactNode }) {
  return (
    <>
      <AuthLoading>
        <div className="h-[calc(100dvh-2.25rem)] bg-[hsl(var(--bg))] flex items-center justify-center">
          <div className="font-mono text-[13px] text-[hsl(var(--text-secondary))] opacity-50 animate-pulse">
            loading identity...
          </div>
        </div>
      </AuthLoading>
      <Unauthenticated>
        {/* Middleware redirects to /sign-in; this is a fallback */}
        <div className="h-[calc(100dvh-2.25rem)] bg-[hsl(var(--bg))] flex items-center justify-center">
          <div className="font-mono text-[13px] text-[hsl(var(--text-secondary))] opacity-50">
            authenticating...
          </div>
        </div>
      </Unauthenticated>
      <Authenticated>
        {children}
      </Authenticated>
    </>
  );
}
