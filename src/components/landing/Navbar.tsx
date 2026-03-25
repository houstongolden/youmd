"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { X } from "lucide-react";
import Link from "next/link";
import { useUser, SignOutButton } from "@clerk/nextjs";


const sections = [
  { id: "how-it-works", label: "--how-it-works" },
  { id: "spec", label: "--spec" },
  { id: "pricing", label: "--pricing" },
];

const Navbar = () => {
  const { isSignedIn, user } = useUser();
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [avatarDropdown, setAvatarDropdown] = useState(false);
  const [mobileAvatarDropdown, setMobileAvatarDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const mobileDropdownRef = useRef<HTMLDivElement>(null);

  const handleScroll = useCallback(() => {
    setScrolled(window.scrollY > 40);
    const offsets = sections.map(({ id }) => {
      const el = document.getElementById(id);
      if (!el) return { id, top: Infinity };
      return { id, top: el.getBoundingClientRect().top };
    });
    const active = offsets.find((o) => o.top > -200 && o.top < 400);
    setActiveSection(active?.id ?? "");
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

  // Close mobile dropdown on click outside
  useEffect(() => {
    if (!mobileAvatarDropdown) return;
    const handler = (e: MouseEvent) => {
      if (mobileDropdownRef.current && !mobileDropdownRef.current.contains(e.target as Node)) {
        setMobileAvatarDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [mobileAvatarDropdown]);

  const username = user?.username;

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 px-4 pt-3 md:pt-4">
        <div
          className={`max-w-xl mx-auto flex items-center justify-between gap-6 px-4 py-2 transition-all duration-500 rounded ${
            scrolled ? "glass-nav" : "bg-transparent"
          }`}
        >
          <a
            href="/"
            className="text-accent font-mono text-[12px] tracking-tight whitespace-nowrap"
          >
            you
          </a>

          <div className="hidden md:flex items-center gap-5">
            {sections.map(({ id, label }) => (
              <a
                key={id}
                href={`#${id}`}
                className={`font-mono text-[10px] transition-colors duration-200 ${
                  activeSection === id
                    ? "text-accent"
                    : "text-muted-foreground/60 hover:text-[hsl(var(--text-primary))]"
                }`}
              >
                {label}
              </a>
            ))}
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
                  {user?.imageUrl ? (
                    <div className="w-5 h-5 rounded-sm border border-[hsl(var(--border))] group-hover:border-accent transition-colors overflow-hidden bg-[hsl(var(--bg))] relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={user.imageUrl}
                        alt=""
                        className="w-full h-full object-cover"
                        style={{ filter: "sepia(1) saturate(3) hue-rotate(-10deg) brightness(0.85) contrast(1.3)" }}
                      />
                      <div className="absolute inset-0 bg-[hsl(var(--accent))]/15 mix-blend-overlay" />
                    </div>
                  ) : (
                    <span className="w-5 h-5 rounded-sm border border-[hsl(var(--border))] bg-[hsl(var(--bg))] flex items-center justify-center font-mono text-[9px] text-accent group-hover:border-accent transition-colors">
                      {username?.[0]?.toUpperCase() ?? user?.firstName?.[0] ?? ">"}
                    </span>
                  )}
                  <span className="font-mono text-[10px] text-muted-foreground/60 group-hover:text-accent transition-colors">
                    @{username ?? "you"}
                  </span>
                </button>
                {avatarDropdown && (
                  <div className="absolute right-0 top-full mt-2 w-44 border border-[hsl(var(--border))] bg-[hsl(var(--bg-raised))] py-1 z-50" style={{ borderRadius: "2px" }}>
                    <Link href="/dashboard" onClick={() => setAvatarDropdown(false)} className="block px-3 py-1.5 font-mono text-[11px] text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))] hover:bg-[hsl(var(--accent))]/5 transition-colors">
                      &gt; dashboard
                    </Link>
                    {username && (
                      <Link href={`/${username}`} onClick={() => setAvatarDropdown(false)} className="block px-3 py-1.5 font-mono text-[11px] text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))] hover:bg-[hsl(var(--accent))]/5 transition-colors">
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
              <Link
                href="/create"
                className="hidden md:inline-block cta-primary px-3 py-1 text-[10px] whitespace-nowrap"
              >
                &gt; create you
              </Link>
            )}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden text-muted-foreground p-1"
              aria-label="Toggle menu"
            >
              {mobileOpen ? (
                <X size={16} />
              ) : (
                <span className="font-mono text-[11px] text-[hsl(var(--accent))] tracking-tight select-none">&gt;_</span>
              )}
            </button>
          </div>
        </div>
      </nav>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-[hsl(var(--bg)/0.98)] backdrop-blur-xl flex flex-col items-center justify-center gap-6">
          {sections.map(({ id, label }) => (
            <a
              key={id}
              href={`#${id}`}
              onClick={() => setMobileOpen(false)}
              className={`font-mono text-[14px] transition-colors ${
                activeSection === id
                  ? "text-accent"
                  : "text-muted-foreground/70 hover:text-[hsl(var(--text-primary))]"
              }`}
            >
              {label}
            </a>
          ))}
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
            <div className="relative mt-4" ref={mobileDropdownRef}>
              <button
                onClick={() => setMobileAvatarDropdown(!mobileAvatarDropdown)}
                className="flex items-center gap-2 group"
              >
                {user?.imageUrl ? (
                  <div className="w-6 h-6 rounded-sm border border-[hsl(var(--border))] overflow-hidden bg-[hsl(var(--bg))] relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={user.imageUrl}
                      alt=""
                      className="w-full h-full object-cover"
                      style={{ filter: "sepia(1) saturate(3) hue-rotate(-10deg) brightness(0.85) contrast(1.3)" }}
                    />
                    <div className="absolute inset-0 bg-[hsl(var(--accent))]/15 mix-blend-overlay" />
                  </div>
                ) : (
                  <span className="w-6 h-6 rounded-sm border border-[hsl(var(--border))] bg-[hsl(var(--bg))] flex items-center justify-center font-mono text-[10px] text-accent">
                    {username?.[0]?.toUpperCase() ?? user?.firstName?.[0] ?? ">"}
                  </span>
                )}
                <span className="font-mono text-[14px] text-accent">
                  @{username ?? "you"} &gt;
                </span>
              </button>
              {mobileAvatarDropdown && (
                <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-48 border border-[hsl(var(--border))] bg-[hsl(var(--bg-raised))] py-1 z-50" style={{ borderRadius: "2px" }}>
                  <Link href="/dashboard" onClick={() => { setMobileAvatarDropdown(false); setMobileOpen(false); }} className="block px-3 py-2 font-mono text-[12px] text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))] hover:bg-[hsl(var(--accent))]/5 transition-colors">
                    &gt; dashboard
                  </Link>
                  {username && (
                    <Link href={`/${username}`} onClick={() => { setMobileAvatarDropdown(false); setMobileOpen(false); }} className="block px-3 py-2 font-mono text-[12px] text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))] hover:bg-[hsl(var(--accent))]/5 transition-colors">
                      &gt; my profile
                    </Link>
                  )}
                  <div className="h-px bg-[hsl(var(--border))] my-1" />
                  <SignOutButton>
                    <button onClick={() => { setMobileAvatarDropdown(false); setMobileOpen(false); }} className="w-full text-left px-3 py-2 font-mono text-[12px] text-[hsl(var(--text-secondary))] opacity-60 hover:opacity-100 hover:text-[hsl(var(--accent))] transition-all">
                      &gt; sign out
                    </button>
                  </SignOutButton>
                </div>
              )}
            </div>
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
};

export default Navbar;
