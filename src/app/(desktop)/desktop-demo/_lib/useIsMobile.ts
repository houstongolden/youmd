"use client";

import { useEffect, useState } from "react";

// Reports whether the viewport is below the desktop-split breakpoint (< 1024px,
// matching Tailwind's `lg`). Below this we use the single-column layout (drawer
// + bottom tabs + stacked master-detail); at/above it the sidebar + 1/3 chat +
// main split has enough room. SSR-safe: starts `false` (desktop) and corrects
// on mount, so the first client render matches the server (no hydration
// mismatch) — the layout just snaps after hydration.
export function useIsMobile(query = "(max-width: 1023px)"): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(query);
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [query]);

  return isMobile;
}
