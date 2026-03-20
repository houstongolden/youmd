"use client";

import { useState, useEffect } from "react";

export function ThinkingIndicator({ phrase }: { phrase: string }) {
  const [dots, setDots] = useState("");

  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => (prev === "..." ? "" : prev + "."));
    }, 400);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="pl-3 border-l-2 border-[hsl(var(--accent))]/20">
      <p className="text-sm text-[hsl(var(--text-secondary))] opacity-50 font-mono">
        {phrase}
        <span className="inline-block w-6">{dots}</span>
      </p>
    </div>
  );
}
