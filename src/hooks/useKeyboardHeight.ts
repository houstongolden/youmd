"use client";

import { useState, useEffect } from "react";

/**
 * Tracks mobile keyboard height using the Visual Viewport API.
 * Returns the keyboard height in pixels (0 when keyboard is closed).
 * This is the only reliable way to handle iOS Safari keyboard.
 */
export function useKeyboardHeight() {
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined" || !window.visualViewport) return;

    const vv = window.visualViewport;

    const handleResize = () => {
      // The difference between window.innerHeight and visualViewport.height
      // is the keyboard height on mobile
      const kbHeight = window.innerHeight - vv.height;
      setKeyboardHeight(Math.max(0, kbHeight));
    };

    vv.addEventListener("resize", handleResize);
    vv.addEventListener("scroll", handleResize);

    return () => {
      vv.removeEventListener("resize", handleResize);
      vv.removeEventListener("scroll", handleResize);
    };
  }, []);

  return keyboardHeight;
}
