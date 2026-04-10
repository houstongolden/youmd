"use client";

import { useRef, useState, useEffect } from "react";

/**
 * FadeUp — progressive-enhancement scroll-reveal.
 *
 * SSR: renders at full opacity (no inline style="opacity:0").
 * Client JS: hides element, then fades in when scrolled into view.
 * No-JS / broken-JS: content stays visible — never invisible.
 * Reduced motion: skips animation entirely.
 */
const FadeUp = ({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const el = ref.current;
    if (!el) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "-60px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`${className} fadeup${mounted && !isVisible ? " fadeup-hidden" : ""}${isVisible ? " fadeup-in" : ""}`}
      style={isVisible && delay > 0 ? { transitionDelay: `${delay}s` } : undefined}
    >
      {children}
    </div>
  );
};

export default FadeUp;
