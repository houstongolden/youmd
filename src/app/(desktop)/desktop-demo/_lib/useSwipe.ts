"use client";

import { useRef } from "react";

type SwipeOpts = {
  onSwipeRight?: () => void;
  onSwipeLeft?: () => void;
  // When set, a right-swipe only fires if it began within this many px of the
  // left screen edge (so it doesn't fight with horizontal content scroll).
  edgeOnly?: number;
  threshold?: number;
};

// Lightweight horizontal swipe detector. Uses only touchstart/touchend (never
// preventDefault) so it can't break vertical scrolling — it just classifies the
// gesture after the finger lifts.
export function useSwipe({ onSwipeRight, onSwipeLeft, edgeOnly, threshold = 56 }: SwipeOpts) {
  const start = useRef<{ x: number; y: number } | null>(null);

  return {
    onTouchStart: (e: React.TouchEvent) => {
      const t = e.touches[0];
      start.current = { x: t.clientX, y: t.clientY };
    },
    onTouchEnd: (e: React.TouchEvent) => {
      if (!start.current) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - start.current.x;
      const dy = t.clientY - start.current.y;
      // Must be a clearly horizontal gesture past the threshold.
      if (Math.abs(dx) > threshold && Math.abs(dx) > Math.abs(dy) * 1.5) {
        if (dx > 0) {
          if (edgeOnly === undefined || start.current.x <= edgeOnly) onSwipeRight?.();
        } else {
          onSwipeLeft?.();
        }
      }
      start.current = null;
    },
  };
}
