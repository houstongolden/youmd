import type { NextConfig } from "next";

/**
 * Security headers applied to every route.
 *
 * Notable: Referrer-Policy is critical here because /ctx/{username}/{token}
 * URLs contain secret tokens. Without a referrer policy, clicking any
 * outbound link from a context-link page would leak the entire token URL
 * via the Referer header. `strict-origin-when-cross-origin` (the modern
 * default) sends the full path only same-origin, just the origin cross-origin
 * over HTTPS, and nothing on downgrade.
 */

/**
 * Cycle 58: Content-Security-Policy.
 *
 * Built from a live network inventory of the prod site (landing, profile,
 * sign-in pages) plus knowledge of the Convex client behavior used by /shell.
 *
 * Shipped as **Content-Security-Policy-Report-Only** initially so violations
 * surface in browser dev tools without breaking anything. Houston should:
 *   1. Use the site for ~24h after deploy
 *   2. Watch the browser console (F12 → Console tab) for "Refused to load..."
 *      CSP violation messages
 *   3. If any legitimate sources are being blocked, add them to the policy
 *      below
 *   4. When confident, rename the header key from
 *      "Content-Security-Policy-Report-Only" → "Content-Security-Policy"
 *      to start enforcing
 *
 * Directive rationale (see audit/findings.md cycle 58 for the full inventory):
 *
 * - default-src 'self': fallback — anything not explicitly listed is same-origin
 * - script-src: own + Clerk JS bundles + 'unsafe-inline' (RSC payloads) + 'unsafe-eval' (Clerk requirement)
 * - style-src: own + Clerk + 'unsafe-inline' (Tailwind v4 + Clerk)
 * - img-src: own + data: (AsciiAvatar) + https: (external avatars, favicons) + blob:
 * - font-src: own woff2 in /_next/static/media/ + data: fallback
 * - connect-src: own + Clerk auth API + Convex (https for REST + wss for subscriptions + .site for httpActions)
 * - frame-src: own + Clerk (OAuth/captcha iframes)
 * - form-action: own + Clerk
 * - base-uri / object-src / frame-ancestors: hardened to 'self' / 'none' / 'self'
 *
 * Known intentional weaknesses (to revisit in a future cycle):
 *   - 'unsafe-inline' on script-src: a nonce-based CSP requires Next.js
 *     middleware to inject a per-request nonce. Doable but invasive.
 *   - 'unsafe-eval' on script-src: required by current Clerk SDK version.
 *     Can be removed if Clerk drops the requirement.
 *   - https: wildcard on img-src: reasonable for a profile site that shows
 *     user-provided external avatars + favicon service results.
 */
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://clerk.you.md",
  "style-src 'self' 'unsafe-inline' https://clerk.you.md",
  "img-src 'self' data: https: blob:",
  "font-src 'self' data:",
  "connect-src 'self' https://clerk.you.md https://kindly-cassowary-600.convex.cloud wss://kindly-cassowary-600.convex.cloud https://kindly-cassowary-600.convex.site",
  "frame-src 'self' https://clerk.you.md",
  "form-action 'self' https://clerk.you.md",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'self'",
].join("; ");

const securityHeaders = [
  // Defense against MIME sniffing — browsers must respect declared Content-Type
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Clickjacking protection — disallow embedding in iframes by other origins
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  // Critical: prevents context-link tokens from leaking via Referer header
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Restrict capabilities the app does not use
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=()",
  },
  // Cycle 58: CSP shipped in Report-Only mode first. After ~24h of monitoring
  // for unexpected violations in browser console, rename the key to
  // "Content-Security-Policy" to start enforcing.
  { key: "Content-Security-Policy-Report-Only", value: CONTENT_SECURITY_POLICY },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      // Long cache for static assets in /public/assets/. Files here are
      // intentionally static (logos, portraits, illustrations) and don't
      // change between deploys. Without this they get the Next.js default
      // `max-age=0, must-revalidate` and re-fetch on every page view.
      {
        source: "/assets/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },
};

export default nextConfig;
