"use client";

import { useState, useEffect, useRef } from "react";
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
  const [avatarDropdown, setAvatarDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const convexUser = useQuery(
    api.users.getByClerkId,
    user?.id ? { clerkId: user.id } : "skip"
  );
  const userProfile = useQuery(
    api.profiles.getByOwnerId,
    convexUser?._id ? { ownerId: convexUser._id } : "skip"
  );

  // Close menus on route change
  useEffect(() => {
    setMobileOpen(false);
    setAvatarDropdown(false);
  }, [pathname]);

  // Close dropdown on click outside
  useEffect(() => {
    if (!avatarDropdown) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setAvatarDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [avatarDropdown]);

  // Lock body scroll when menu is open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  // Hide on pages that have their own nav or don't need one
  const hiddenPaths = ["/", "/create", "/sign-in", "/sign-up", "/initialize", "/reset-password", "/docs"];
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
              <div className="hidden md:block relative" ref={dropdownRef}>
                <button
                  onClick={() => setAvatarDropdown(!avatarDropdown)}
                  className="flex items-center gap-2 group"
                >
                  {avatarUrl ? (
                    <div className="w-6 h-6 rounded-sm border border-[hsl(var(--border))] group-hover:border-accent transition-colors overflow-hidden bg-[hsl(var(--bg))] relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={avatarUrl}
                        alt=""
                        className="w-full h-full object-cover"
                        style={{ filter: "grayscale(1) brightness(0.9) contrast(1.1)" }}
                      />
                      <div className="absolute inset-0 bg-[hsl(var(--accent))]/15 mix-blend-overlay" />
                    </div>
                  ) : (
                    <span className="w-6 h-6 rounded-sm border border-[hsl(var(--border))] bg-[hsl(var(--bg))] flex items-center justify-center font-mono text-[9px] text-accent">
                      {username?.[0]?.toUpperCase() ?? ">"}
                    </span>
                  )}
                  <span className="font-mono text-[10px] text-muted-foreground/60 group-hover:text-accent transition-colors">
                    @{username ?? "you"}
                  </span>
                </button>
                {avatarDropdown && (
                  <div className="absolute right-0 top-full mt-2 w-44 border border-[hsl(var(--border))] bg-[hsl(var(--bg-raised))] py-1 z-50" style={{ borderRadius: "2px" }}>
                    <Link href="/shell" className="block px-3 py-1.5 font-mono text-[11px] text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))] hover:bg-[hsl(var(--accent))]/5 transition-colors">
                      &gt; shell
                    </Link>
                    {username && (
                      <Link href={`/${username}`} className="block px-3 py-1.5 font-mono text-[11px] text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))] hover:bg-[hsl(var(--accent))]/5 transition-colors">
                        &gt; my profile
                      </Link>
                    )}
                    <div className="h-px bg-[hsl(var(--border))] my-1" />
                    <SignOutButton>
                      <button className="w-full text-left px-3 py-1.5 font-mono text-[11px] text-[hsl(var(--text-secondary))] opacity-60 hover:opacity-100 hover:text-[hsl(var(--accent))] transition-all">
                        &gt; sign out
                      </button>
                    </SignOutButton>
                  </div>
                )}
              </div>
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
              href="/shell"
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-2 mt-4"
            >
              {avatarUrl ? (
                <div className="w-6 h-6 rounded-sm border border-[hsl(var(--border))] overflow-hidden relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={avatarUrl}
                    alt=""
                    className="w-full h-full object-cover"
                    style={{ filter: "grayscale(1) brightness(0.9) contrast(1.1)" }}
                  />
                  <div className="absolute inset-0 bg-[hsl(var(--accent))]/15 mix-blend-overlay" />
                </div>
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
