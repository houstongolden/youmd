"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useUser, SignOutButton } from "@/lib/you-auth";
import { useQuery, useConvexAuth } from "convex/react";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import AsciiAvatar from "@/components/AsciiAvatar";
import { api } from "../../../convex/_generated/api";
import { ButtonLink } from "@/components/ui/Button";

const Navbar = () => {
  const { isSignedIn, user } = useUser();
  const { isAuthenticated } = useConvexAuth();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [avatarDropdown, setAvatarDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleScroll = useCallback(() => {
    setScrolled(window.scrollY > 40);
  }, []);

  useEffect(() => {
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

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

  const convexUser = useQuery(
    api.users.getByClerkId,
    isAuthenticated && user?.id ? { clerkId: user.id } : "skip"
  );
  const userProfile = useQuery(
    api.profiles.getByOwnerId,
    convexUser?._id ? { ownerId: convexUser._id } : "skip"
  );

  const username = convexUser?.username ?? user?.username;
  const avatarUrl = (userProfile as Record<string, unknown> | null | undefined)?.avatarUrl as string | undefined
    || user?.imageUrl;

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 px-4 pt-3 md:pt-4">
        <div
          className={`mx-auto flex max-w-[1120px] items-center justify-between gap-6 px-4 py-2 transition-all duration-300 ${
            scrolled ? "glass-nav" : "bg-transparent"
          }`}
        >
          <Link
            href="/"
            className="inline-flex min-h-11 items-center justify-center px-2 font-mono text-[13px] tracking-tight text-accent"
          >
            you.md
          </Link>

          <div className="hidden items-center gap-5 md:flex">
            <Link
              href="/profiles"
              className="font-mono text-[10px] text-muted-foreground/60 hover:text-accent transition-colors"
            >
              --profiles
            </Link>
            <Link
              href="/docs"
              className="font-mono text-[10px] text-muted-foreground/60 hover:text-accent transition-colors"
            >
              --docs
            </Link>
          </div>

          <div className="flex items-center gap-3">
            {isSignedIn ? (
              <div className="hidden md:block relative" ref={dropdownRef}>
                <button
                  onClick={() => setAvatarDropdown(!avatarDropdown)}
                  className="flex items-center gap-2 group"
                >
                  {avatarUrl ? (
                    <div className="w-6 h-6 border border-[hsl(var(--border))] group-hover:border-accent transition-colors overflow-hidden bg-[hsl(var(--bg))]" style={{ borderRadius: "var(--radius)" }}>
                      <AsciiAvatar
                        src={avatarUrl}
                        cols={160}
                        format="block"
                        canvasWidth={48}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <span className="w-6 h-6 border border-[hsl(var(--border))] bg-[hsl(var(--bg))] flex items-center justify-center font-mono text-[9px] text-accent" style={{ borderRadius: "var(--radius)" }}>
                      {username?.[0]?.toUpperCase() ?? ">"}
                    </span>
                  )}
                  <span className="font-mono text-[10px] text-muted-foreground/60 group-hover:text-accent transition-colors">
                    @{username ?? "you"}
                  </span>
                </button>
                {avatarDropdown && (
                  <div className="absolute right-0 top-full mt-2 w-44 border border-[hsl(var(--border))] bg-[hsl(var(--bg-raised))] py-1 z-50" style={{ borderRadius: "var(--radius)" }}>
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
            ) : (
              <ButtonLink
                href="/create"
                variant="primary"
                size="sm"
                className="hidden whitespace-nowrap md:inline-flex"
              >
                create your you.md
              </ButtonLink>
            )}
            <button
              type="button"
              onClick={() => setMobileOpen(!mobileOpen)}
              className="inline-flex min-h-11 min-w-11 items-center justify-center border border-transparent text-accent transition-colors hover:border-[hsl(var(--border))] hover:bg-[hsl(var(--bg-raised))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--accent))]/45 md:hidden"
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? (
                <X size={16} />
              ) : (
                <Menu size={16} />
              )}
            </button>
          </div>
        </div>
      </nav>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 flex flex-col items-center justify-center gap-6 bg-[hsl(var(--bg)/0.98)] backdrop-blur-xl">
          <Link
            href="/profiles"
            onClick={() => setMobileOpen(false)}
            className="font-mono text-[14px] text-muted-foreground/70 hover:text-accent transition-colors"
          >
            --profiles
          </Link>
          <Link
            href="/docs"
            onClick={() => setMobileOpen(false)}
            className="font-mono text-[14px] text-muted-foreground/70 hover:text-accent transition-colors"
          >
            --docs
          </Link>
          {isSignedIn ? (
            <>
              <Link
                href="/shell"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-2 mt-4"
              >
                {avatarUrl ? (
                  <div className="w-6 h-6 border border-[hsl(var(--border))] overflow-hidden bg-[hsl(var(--bg))]" style={{ borderRadius: "var(--radius)" }}>
                    <AsciiAvatar
                      src={avatarUrl}
                      cols={160}
                      format="block"
                      canvasWidth={48}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <span className="w-6 h-6 border border-[hsl(var(--border))] bg-accent/10 flex items-center justify-center font-mono text-[10px] text-accent" style={{ borderRadius: "var(--radius)" }}>
                    {username?.[0] ?? ">"}
                  </span>
                )}
                <span className="font-mono text-[14px] text-accent">
                  @{username ?? "you"} &gt;
                </span>
              </Link>
              <SignOutButton>
                <button
                  className="font-mono text-[12px] text-muted-foreground/60 hover:text-accent transition-colors"
                  onClick={() => setMobileOpen(false)}
                >
                  &gt; sign out
                </button>
              </SignOutButton>
            </>
          ) : (
            <ButtonLink
              href="/create"
              onClick={() => setMobileOpen(false)}
              variant="primary"
              size="lg"
              className="mt-4"
            >
              create your you.md
            </ButtonLink>
          )}
        </div>
      )}
    </>
  );
};

export default Navbar;
