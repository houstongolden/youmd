"use client";

import { useState, useEffect, useCallback } from "react";
import { useUser, SignOutButton } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import AsciiAvatar from "@/components/AsciiAvatar";
import { api } from "../../convex/_generated/api";

/**
 * AppNav — persistent navigation for logged-in users.
 * Shows a fixed toggle on the left edge that opens a terminal-styled
 * side panel with links to dashboard, profile, settings, etc.
 * Renders on all pages; hides when not signed in.
 */
export function AppNav() {
  const { isSignedIn, user } = useUser();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const convexUser = useQuery(
    api.users.getByClerkId,
    user?.id ? { clerkId: user.id } : "skip"
  );
  const userProfile = useQuery(
    api.profiles.getByOwnerId,
    convexUser?._id ? { ownerId: convexUser._id } : "skip"
  );

  // Close panel on route change
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Close on Escape
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") setOpen(false);
  }, []);

  useEffect(() => {
    if (open) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [open, handleKeyDown]);

  // Don't render when not signed in or on landing page (has its own nav)
  if (!isSignedIn) return null;

  // Don't show on pages that have their own full nav
  const hiddenPaths = ["/create", "/sign-in", "/sign-up", "/initialize", "/dashboard"];
  if (hiddenPaths.some((p) => pathname.startsWith(p))) return null;

  // Don't show on landing page — it has its own Navbar
  if (pathname === "/") return null;

  const username = convexUser?.username ?? user?.username ?? "you";
  const avatarUrl = userProfile?.avatarUrl as string | undefined;
  const isOnDashboard = pathname === "/dashboard";
  const isOnProfile = pathname === `/${username}`;

  const navItems = [
    { href: "/dashboard", label: "dashboard", active: isOnDashboard, key: "dash" },
    { href: `/${username}`, label: "my profile", active: isOnProfile, key: "profile" },
  ];

  return (
    <>
      {/* Fixed toggle button — top-left */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed top-3 left-3 z-[60] flex items-center justify-center w-8 h-8 bg-[hsl(var(--bg-raised))] border border-[hsl(var(--border))] hover:border-[hsl(var(--accent))]/40 transition-colors"
        style={{ borderRadius: "2px" }}
        aria-label="Toggle navigation"
      >
        {open ? (
          <span className="font-mono text-[11px] text-[hsl(var(--accent))] select-none">x</span>
        ) : (
          <span className="font-mono text-[11px] text-[hsl(var(--accent))] select-none">&gt;_</span>
        )}
      </button>

      {/* Overlay backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-[55] bg-black/40 backdrop-blur-[2px]"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Side panel */}
      <div
        className={`fixed top-0 left-0 z-[58] h-full w-[260px] bg-[hsl(var(--bg-raised))] border-r border-[hsl(var(--border))] flex flex-col transition-transform duration-200 ease-out ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Panel header */}
        <div className="px-4 pt-14 pb-4 border-b border-[hsl(var(--border))]">
          <div className="flex items-center gap-3">
            {/* ASCII portrait thumbnail */}
            {avatarUrl ? (
              <div
                className="shrink-0 w-10 h-10 border border-[hsl(var(--border))] bg-[hsl(var(--bg))] overflow-hidden"
                style={{ borderRadius: "2px" }}
              >
                <AsciiAvatar
                  src={avatarUrl}
                  cols={30}
                  canvasWidth={40}
                  className="block w-full h-full"
                />
              </div>
            ) : (
              <div
                className="shrink-0 w-10 h-10 border border-[hsl(var(--border))] bg-[hsl(var(--bg))] flex items-center justify-center"
                style={{ borderRadius: "2px" }}
              >
                <span className="font-mono text-[14px] text-[hsl(var(--accent))]">
                  {username[0]}
                </span>
              </div>
            )}
            <div className="min-w-0">
              <p className="font-mono text-[13px] text-[hsl(var(--text-primary))] truncate">
                @{username}
              </p>
              <p className="font-mono text-[10px] text-[hsl(var(--text-secondary))] opacity-40 truncate">
                you.md/{username}
              </p>
            </div>
          </div>
        </div>

        {/* Navigation links */}
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className={`flex items-center gap-2.5 px-3 py-2 font-mono text-[12px] transition-colors ${
                item.active
                  ? "text-[hsl(var(--accent))] bg-[hsl(var(--accent-wash))]"
                  : "text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))] hover:bg-[hsl(var(--bg))]/50"
              }`}
              style={{ borderRadius: "3px" }}
            >
              <span className="opacity-40 w-4 text-center shrink-0">
                {item.active ? ">" : " "}
              </span>
              {item.label}
            </Link>
          ))}

          <div className="h-px bg-[hsl(var(--border))] my-2 mx-3" />

          <Link
            href="/profiles"
            className="flex items-center gap-2.5 px-3 py-2 font-mono text-[12px] text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))] hover:bg-[hsl(var(--bg))]/50 transition-colors"
            style={{ borderRadius: "3px" }}
          >
            <span className="opacity-40 w-4 text-center shrink-0"> </span>
            profiles
          </Link>
          <Link
            href="/docs"
            className="flex items-center gap-2.5 px-3 py-2 font-mono text-[12px] text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))] hover:bg-[hsl(var(--bg))]/50 transition-colors"
            style={{ borderRadius: "3px" }}
          >
            <span className="opacity-40 w-4 text-center shrink-0"> </span>
            docs
          </Link>
        </nav>

        {/* Footer — sign out */}
        <div className="shrink-0 border-t border-[hsl(var(--border))] px-4 py-3">
          <SignOutButton>
            <button className="w-full text-left font-mono text-[11px] text-[hsl(var(--text-secondary))] opacity-40 hover:opacity-80 hover:text-[hsl(var(--accent))] transition-all px-1 py-1">
              sign out
            </button>
          </SignOutButton>
        </div>
      </div>
    </>
  );
}
