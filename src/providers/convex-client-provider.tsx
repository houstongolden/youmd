"use client";

import { ReactNode, Component } from "react";
import { ConvexReactClient, ConvexProvider } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ClerkProvider, useAuth } from "@clerk/nextjs";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

// Only create client if URL is available (won't be during static build)
const convex = convexUrl ? new ConvexReactClient(convexUrl) : null;

/**
 * Error boundary that catches Clerk load failures.
 * Falls back to unauthenticated Convex (public queries still work).
 */
class ClerkErrorBoundary extends Component<
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
      "Clerk failed to load — falling back to unauthenticated mode. " +
        "Public pages will work; auth-gated pages will not.",
      error.message
    );
  }

  render() {
    if (this.state.hasError) {
      // Provide Convex without Clerk auth — public queries work, auth-gated ones won't
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
    <ClerkErrorBoundary convex={convex}>
      <ClerkProvider
        publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY as string}
        appearance={{
          variables: {
            colorPrimary: "#E8857A",
            borderRadius: "0.5rem",
          },
        }}
      >
        <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
          {children}
        </ConvexProviderWithClerk>
      </ClerkProvider>
    </ClerkErrorBoundary>
  );
}
