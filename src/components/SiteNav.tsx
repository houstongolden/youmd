"use client";

import { useState, useEffect } from "react";
import { useUser, SignOutButton } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { X } from "lucide-react";
import { api } from "../../convex/_generated/api";

/**
 * SiteNav — unified top navigation bar for all pages.
 * Hidden on: landing page ("/"), auth flows, create, initialize.
 * Mobile: >_ toggle opens fullscreen overlay menu.
 */
export function SiteNav() {
  const { isSignedIn, user } = useUser();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const convexUser = useQuery(
    api.users.getByClerkId,
    user?.id ? { clerkId: user.id } : "skip"
  );
  const userProfile = useQuery(
    api.profiles.getByOwnerId,
    convexUser?._id ? { ownerId: convexUser._id } : "skip"
  );

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Lock body scroll when menu is open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  // Hide on pages that have their own nav or don't need one
  const hiddenPaths = ["/", "/create", "/sign-in", "/sign-up", "/initialize", "/reset-password", "/docs", "/profiles"];
  if (hiddenPaths.some((p) => pathname === p || (p !== "/" && pathname.startsWith(p)))) {
    return null;
  }

  const username = convexUser?.username ?? user?.username;
  const avatarUrl = (userProfile as Record<string, unknown> | null | undefined)?.avatarUrl as string | undefined
    || user?.imageUrl;
  const isOnDashboard = pathname === "/dashboard";
  const isOnProfiles = pathname === "/profiles";
  const isOnDocs = pathname === "/docs";
  const isOnMyProfile = username ? pathname === `/${username}` : false;

  const navLinks = isSignedIn
    ? [
        { href: "/dashboard", label: "--dashboard", active: isOnDashboard },
        ...(username ? [{ href: `/${username}`, label: "--profile", active: isOnMyProfile }] : []),
        { href: "/profiles", label: "--profiles", active: isOnProfiles },
        { href: "/docs", label: "--docs", active: isOnDocs },
      ]
    : [
        { href: "/profiles", label: "--profiles", active: isOnProfiles },
        { href: "/docs", label: "--docs", active: isOnDocs },
      ];

  return (
    <>
      <nav className="sticky top-0 z-50 w-full border-b border-[hsl(var(--border))] bg-[hsl(var(--bg))]">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between px-3 md:px-4 h-9">
          {/* Left: brand + nav links (desktop) */}
          <div className="flex items-center gap-4 md:gap-5 min-w-0">
            <Link
              href="/"
              className="text-accent font-mono text-[12px] tracking-tight shrink-0"
            >
              you
            </Link>

            <div className="hidden md:flex items-center gap-4 md:gap-5">
              {navLinks.map(({ href, label, active }) => (
                <Link
                  key={href}
                  href={href}
                  className={`font-mono text-[10px] transition-colors ${
                    active
                      ? "text-accent"
                      : "text-muted-foreground/60 hover:text-[hsl(var(--text-primary))]"
                  }`}
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>

          {/* Right: user info (desktop) + mobile toggle */}
          <div className="flex items-center gap-3 shrink-0">
            {isSignedIn && (
              <>
                <Link
                  href="/dashboard"
                  className="hidden md:flex items-center gap-2 group"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt=""
                      className="w-5 h-5 rounded-sm border border-[hsl(var(--border))] group-hover:border-accent transition-colors object-cover"
                    />
                  ) : (
                    <span className="w-5 h-5 rounded-sm border border-[hsl(var(--border))] bg-accent/10 flex items-center justify-center font-mono text-[9px] text-accent">
                      {username?.[0]?.toUpperCase() ?? ">"}
                    </span>
                  )}
                  <span className="font-mono text-[10px] text-muted-foreground/60 group-hover:text-accent transition-colors">
                    @{username ?? "you"}
                  </span>
                </Link>
                <SignOutButton>
                  <button className="hidden md:inline font-mono text-[10px] text-[hsl(var(--text-secondary))] opacity-30 hover:opacity-70 hover:text-accent transition-all">
                    sign out
                  </button>
                </SignOutButton>
              </>
            )}
            {!isSignedIn && (
              <Link
                href="/create"
                className="hidden md:inline-block cta-primary px-3 py-1 text-[10px] whitespace-nowrap"
              >
                &gt; create you
              </Link>
            )}
            {/* Mobile menu toggle */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden p-1"
              aria-label="Toggle menu"
            >
              {mobileOpen ? (
                <X size={16} className="text-muted-foreground" />
              ) : (
                <span className="font-mono text-[11px] text-[hsl(var(--accent))] tracking-tight select-none">&gt;_</span>
              )}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile fullscreen overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-[hsl(var(--bg)/0.98)] backdrop-blur-xl flex flex-col items-center justify-center gap-6">
          {navLinks.map(({ href, label, active }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              className={`font-mono text-[14px] transition-colors ${
                active
                  ? "text-accent"
                  : "text-muted-foreground/70 hover:text-[hsl(var(--text-primary))]"
              }`}
            >
              {label}
            </Link>
          ))}
          {isSignedIn ? (
            <Link
              href="/dashboard"
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-2 mt-4"
            >
              {user?.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.imageUrl}
                  alt=""
                  className="w-6 h-6 rounded-sm border border-[hsl(var(--border))]"
                />
              ) : (
                <span className="w-6 h-6 rounded-sm border border-[hsl(var(--border))] bg-accent/10 flex items-center justify-center font-mono text-[10px] text-accent">
                  {username?.[0] ?? ">"}
                </span>
              )}
              <span className="font-mono text-[14px] text-accent">
                @{username ?? "you"} &gt;
              </span>
            </Link>
          ) : (
            <Link
              href="/create"
              onClick={() => setMobileOpen(false)}
              className="cta-primary px-6 py-2.5 text-[12px] mt-4"
            >
              &gt; create you
            </Link>
          )}
        </div>
      )}
    </>
  );
}
