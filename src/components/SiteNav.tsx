"use client";

import { useUser, SignOutButton } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { api } from "../../convex/_generated/api";

/**
 * SiteNav — unified top navigation bar for all pages.
 *
 * Renders a compact, terminal-styled top bar:
 * - Signed out: brand + sign-in CTA
 * - Signed in: brand + nav links + user info
 *
 * Hidden on: landing page ("/"), auth flows, create, initialize.
 */
export function SiteNav() {
  const { isSignedIn, user } = useUser();
  const pathname = usePathname();

  const convexUser = useQuery(
    api.users.getByClerkId,
    user?.id ? { clerkId: user.id } : "skip"
  );

  // Hide on pages that have their own nav or don't need one
  const hiddenPaths = ["/", "/create", "/sign-in", "/sign-up", "/initialize"];
  if (hiddenPaths.some((p) => pathname === p || (p !== "/" && pathname.startsWith(p)))) {
    return null;
  }

  const username = convexUser?.username ?? user?.username;
  const isOnDashboard = pathname === "/dashboard";
  const isOnProfiles = pathname === "/profiles";
  const isOnDocs = pathname === "/docs";
  const isOnMyProfile = username ? pathname === `/${username}` : false;

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-[hsl(var(--border))] bg-[hsl(var(--bg))]">
      <div className="max-w-[1400px] mx-auto flex items-center justify-between px-3 md:px-4 h-9">
        {/* Left: brand + nav links */}
        <div className="flex items-center gap-4 md:gap-5 min-w-0">
          <Link
            href="/"
            className="text-[hsl(var(--accent))] font-mono text-[12px] tracking-tight shrink-0"
          >
            you
          </Link>

          {isSignedIn && (
            <>
              <span className="text-[hsl(var(--border))] opacity-60 select-none">/</span>

              <div className="flex items-center gap-3 md:gap-4">
                <NavItem href="/dashboard" active={isOnDashboard}>
                  dashboard
                </NavItem>
                {username && (
                  <NavItem href={`/${username}`} active={isOnMyProfile}>
                    profile
                  </NavItem>
                )}
                <NavItem href="/profiles" active={isOnProfiles}>
                  profiles
                </NavItem>
                <NavItem href="/docs" active={isOnDocs}>
                  docs
                </NavItem>
              </div>
            </>
          )}

          {!isSignedIn && (
            <>
              <span className="text-[hsl(var(--border))] opacity-60 select-none">/</span>
              <div className="flex items-center gap-3 md:gap-4">
                <NavItem href="/profiles" active={isOnProfiles}>
                  profiles
                </NavItem>
                <NavItem href="/docs" active={isOnDocs}>
                  docs
                </NavItem>
              </div>
            </>
          )}
        </div>

        {/* Right: user info or sign-in */}
        <div className="flex items-center gap-3 shrink-0">
          {isSignedIn ? (
            <>
              <span className="font-mono text-[10px] text-[hsl(var(--text-secondary))] opacity-50 hidden sm:inline">
                @{username ?? "you"}
              </span>
              <SignOutButton>
                <button className="font-mono text-[10px] text-[hsl(var(--text-secondary))] opacity-30 hover:opacity-70 hover:text-[hsl(var(--accent))] transition-all">
                  sign out
                </button>
              </SignOutButton>
            </>
          ) : (
            <Link
              href="/create"
              className="cta-primary px-3 py-1 text-[10px] whitespace-nowrap"
            >
              &gt; create you
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}

function NavItem({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`font-mono text-[11px] transition-colors ${
        active
          ? "text-[hsl(var(--accent))]"
          : "text-[hsl(var(--text-secondary))] opacity-50 hover:opacity-80 hover:text-[hsl(var(--text-primary))]"
      }`}
    >
      {active ? "> " : ""}
      {children}
    </Link>
  );
}
