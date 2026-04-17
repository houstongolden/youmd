"use client";

import { ReactNode, Component } from "react";
import { ConvexReactClient, ConvexProvider } from "convex/react";
import { ConvexProviderWithAuth } from "convex/react";
import { YouAuthProvider, useAuth } from "@/lib/you-auth";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

// Only create client if URL is available (won't be during static build)
const convex = convexUrl ? new ConvexReactClient(convexUrl) : null;

/**
 * Error boundary that catches auth bootstrap failures.
 * Falls back to unauthenticated Convex (public queries still work).
 */
class AuthErrorBoundary extends Component<
  { convex: ConvexReactClient; children: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { convex: ConvexReactClient; children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.warn(
      "you.md auth failed to load — falling back to unauthenticated mode. " +
        "Public pages will work; auth-gated pages will not.",
      error.message
    );
  }

  render() {
    if (this.state.hasError) {
      // Provide Convex without session auth — public queries work, auth-gated ones won't
      return (
        <ConvexProvider client={this.props.convex}>
          {this.props.children}
        </ConvexProvider>
      );
    }
    return this.props.children;
  }
}

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  if (!convex) {
    // During build / SSG, render children without providers
    return <>{children}</>;
  }

  return (
    <AuthErrorBoundary convex={convex}>
      <YouAuthProvider>
        <ConvexProviderWithAuth client={convex} useAuth={useAuth}>
          {children}
        </ConvexProviderWithAuth>
      </YouAuthProvider>
    </AuthErrorBoundary>
  );
}

/**
 * Convex provider WITHOUT authenticated session wiring — for pages that work without sign-in.
 * Used by /create and other public-facing interactive pages.
 */
export function ConvexPublicProvider({ children }: { children: ReactNode }) {
  if (!convex) {
    return <>{children}</>;
  }

  return (
    <ConvexProvider client={convex}>
      {children}
    </ConvexProvider>
  );
}
