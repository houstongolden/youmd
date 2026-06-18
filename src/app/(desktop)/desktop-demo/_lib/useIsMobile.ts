"use client";

import { useEffect, useState } from "react";

// Reports whether the viewport is phone-sized (< 768px, matching Tailwind's
// `md` breakpoint). SSR-safe: starts `false` (desktop) and corrects on mount,
// so the first client render matches the server and there's no hydration
// mismatch — the layout just snaps to mobile after hydration.
export function useIsMobile(query = "(max-width: 767px)"): boolean {
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
