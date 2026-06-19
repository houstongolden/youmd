"use client";

import { useCallback, useState } from "react";

type Theme = "dark" | "light";

function getCurrentTheme(): Theme {
  if (typeof document === "undefined") return "dark";

  return document.documentElement.classList.contains("light") ? "light" : "dark";
}

// Reads/writes the same `.light` class + `localStorage.theme` the rest of the
// site uses (see the pre-hydration bootstrap in src/app/layout.tsx), so the
// demo's toggle stays consistent with the global theme handling.
export function useTheme(): { theme: Theme; toggle: () => void } {
  const [theme, setTheme] = useState<Theme>(getCurrentTheme);

  const toggle = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === "light" ? "dark" : "light";
      document.documentElement.classList.toggle("light", next === "light");
      try {
        localStorage.setItem("theme", next);
      } catch {
        // ignore storage failures (private mode, etc.)
      }
      return next;
    });
  }, []);

  return { theme, toggle };
}
