"use client";

import { useState, useEffect, useCallback } from "react";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";

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
              <Link
                href="/dashboard"
                className="hidden md:flex items-center gap-2 group"
              >
                {user?.imageUrl ? (
                  <img
                    src={user.imageUrl}
                    alt=""
                    className="w-5 h-5 rounded-sm border border-[hsl(var(--border))] group-hover:border-accent transition-colors"
                  />
                ) : (
                  <span className="w-5 h-5 rounded-sm border border-[hsl(var(--border))] bg-accent/10 flex items-center justify-center font-mono text-[9px] text-accent group-hover:border-accent transition-colors">
                    {user?.username?.[0] ?? user?.firstName?.[0] ?? ">"}
                  </span>
                )}
                <span className="font-mono text-[10px] text-muted-foreground/60 group-hover:text-accent transition-colors">
                  @{user?.username ?? "you"}
                </span>
              </Link>
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
              {mobileOpen ? <X size={16} /> : <Menu size={16} />}
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
            <Link
              href="/dashboard"
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-2 mt-4"
            >
              {user?.imageUrl ? (
                <img
                  src={user.imageUrl}
                  alt=""
                  className="w-6 h-6 rounded-sm border border-[hsl(var(--border))]"
                />
              ) : (
                <span className="w-6 h-6 rounded-sm border border-[hsl(var(--border))] bg-accent/10 flex items-center justify-center font-mono text-[10px] text-accent">
                  {user?.username?.[0] ?? user?.firstName?.[0] ?? ">"}
                </span>
              )}
              <span className="font-mono text-[14px] text-accent">
                @{user?.username ?? "you"} &gt;
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
};

export default Navbar;
