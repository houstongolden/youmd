"use client";

import { useCallback } from "react";

// A thin, draggable vertical divider. `side` says which edge it sits on:
//   "right" → handle on the panel's right edge, drag right = wider
//   "left"  → handle on the panel's left edge,  drag left  = wider
export function ResizeHandle({
  width,
  setWidth,
  min,
  max,
  side = "right",
}: {
  width: number;
  setWidth: (w: number) => void;
  min: number;
  max: number;
  side?: "left" | "right";
}) {
  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startW = width;
      const move = (ev: PointerEvent) => {
        const dx = ev.clientX - startX;
        const next = side === "right" ? startW + dx : startW - dx;
        setWidth(Math.max(min, Math.min(max, next)));
      };
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [width, setWidth, min, max, side],
  );

  return (
    <div
      onPointerDown={onPointerDown}
      className="group relative z-10 w-px shrink-0 cursor-col-resize bg-[hsl(var(--border))]"
      role="separator"
      aria-orientation="vertical"
    >
      {/* widened invisible hit area + hover highlight */}
      <span className="absolute inset-y-0 -left-1.5 -right-1.5 block" />
      <span className="absolute inset-y-0 left-0 w-px bg-[hsl(var(--accent))] opacity-0 transition-opacity group-hover:opacity-60" />
    </div>
  );
}
