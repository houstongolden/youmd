"use client";

import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";

/**
 * Cycle 70: site-wide MotionConfig with reducedMotion="user".
 *
 * Why this exists:
 * - Every motion.div on the landing page uses `initial={{ opacity: 0 }}`
 *   and waits for an animation to fire before showing content.
 * - For users with the `prefers-reduced-motion: reduce` OS setting, those
 *   animations were running in full (durations 400-800ms each), and the
 *   delayed staggered ones (Hero has delays up to 2.5s) meant content
 *   was invisible for 2+ seconds on first paint.
 * - With `reducedMotion="user"`, Framer Motion respects the OS setting
 *   and replaces transforms / opacity changes with instant value updates.
 *   Elements jump straight to their target state, no fade.
 *
 * This is a defensive change connected to the cycle 65 "site is crashed"
 * report. While we never confirmed the root cause, "user has reduced
 * motion preference + Framer Motion ignored it" was a credible candidate
 * because Houston's screenshot showed the same blank-section pattern that
 * the contrast auditor in cycle 69 had to bypass via CSS injection.
 *
 * Users WITHOUT the OS setting see the existing animations unchanged.
 */
export function MotionConfigProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
