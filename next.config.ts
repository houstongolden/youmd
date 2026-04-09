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
