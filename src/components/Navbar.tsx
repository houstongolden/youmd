"use client";

import { useState, useEffect, useCallback } from "react";
import { Menu, X } from "lucide-react";
import Link from "next/link";

const sections = [
  { id: "how-it-works", label: "--how-it-works" },
  { id: "spec", label: "--spec" },
  { id: "pricing", label: "--pricing" },
];

const Navbar = () => {
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
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 px-4 pt-3 md:pt-4">
        <div
          className={`max-w-xl mx-auto flex items-center justify-between gap-6 px-4 py-2 transition-all duration-500 rounded ${
            scrolled ? "glass-nav" : "bg-transparent"
          }`}
        >
          <a href="/" className="text-accent font-mono text-[12px] tracking-tight whitespace-nowrap">
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
                    : "text-muted-foreground/60 hover:text-foreground"
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
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/sign-up"
              className="hidden md:inline-block cta-primary px-3 py-1 text-[10px]"
            >
              &gt; enter system
            </Link>
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
        <div className="fixed inset-0 z-40 bg-background/98 backdrop-blur-xl flex flex-col items-center justify-center gap-6">
          {sections.map(({ id, label }) => (
            <a
              key={id}
              href={`#${id}`}
              onClick={() => setMobileOpen(false)}
              className={`font-mono text-[14px] transition-colors ${
                activeSection === id ? "text-accent" : "text-muted-foreground/70 hover:text-foreground"
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
            href="/sign-up"
            onClick={() => setMobileOpen(false)}
            className="cta-primary px-6 py-2.5 text-[12px] mt-4"
          >
            &gt; enter system
          </Link>
        </div>
      )}
    </>
  );
};

export default Navbar;
