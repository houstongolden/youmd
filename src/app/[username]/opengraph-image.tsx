import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "you.md profile card";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Brand colors from PRD v2.3 — monochrome + burnt orange
const COLORS = {
  accent: "#C46A3A",
  accentDim: "#A8552E",
  bg: "#0D0D0D",
  bgRaised: "#171717",
  text: "#EAE6E1",
  textSecondary: "#A89E91",
  border: "#2E2E2E",
};

/**
 * Derive the Convex HTTP Actions (site) URL from the cloud URL.
 * NEXT_PUBLIC_CONVEX_URL = https://<slug>.convex.cloud
 * Site URL              = https://<slug>.convex.site
 */
function getConvexSiteUrl(): string {
  const cloudUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (cloudUrl) {
    return cloudUrl.replace(/\.convex\.cloud$/, ".convex.site");
  }
  // Fallback for the known deployment
  return "https://kindly-cassowary-600.convex.site";
}

interface ProfileResponse {
  username: string;
  displayName: string;
  youJson: {
    identity: {
      name: string;
      tagline: string;
      bio: {
        short: string;
        medium: string;
        long: string;
      };
    };
    [key: string]: unknown;
  };
}

async function fetchProfile(
  username: string
): Promise<ProfileResponse | null> {
  try {
    const siteUrl = getConvexSiteUrl();
    const res = await fetch(
      `${siteUrl}/api/v1/profiles?username=${encodeURIComponent(username)}`,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { next: { revalidate: 60 } } as any
    );
    if (!res.ok) return null;
    return (await res.json()) as ProfileResponse;
  } catch {
    return null;
  }
}

export default async function OgImage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const profile = await fetchProfile(username);

  const displayName =
    profile?.displayName ||
    profile?.youJson?.identity?.name ||
    username;
  const tagline =
    profile?.youJson?.identity?.tagline || "";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          background: `linear-gradient(to top, ${COLORS.bgRaised} 0%, ${COLORS.bg} 100%)`,
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Subtle accent glow at center */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: "600px",
            height: "600px",
            borderRadius: "50%",
            background: `radial-gradient(circle, ${COLORS.accent}15 0%, ${COLORS.accent}06 40%, transparent 70%)`,
            display: "flex",
          }}
        />

        {/* Content container — the "terminal card" */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "48px 64px",
            position: "relative",
            zIndex: 1,
          }}
        >
          {/* Username in monospace at the top */}
          <div
            style={{
              fontFamily: "monospace",
              fontSize: "28px",
              color: COLORS.accent,
              letterSpacing: "0.05em",
              marginBottom: "24px",
              display: "flex",
            }}
          >
            you.md/{username}
          </div>

          {/* Display name — large */}
          <div
            style={{
              fontSize: "72px",
              fontWeight: 700,
              color: "#EDEDED",
              lineHeight: 1.1,
              textAlign: "center",
              maxWidth: "900px",
              marginBottom: "20px",
              display: "flex",
            }}
          >
            {displayName}
          </div>

          {/* Tagline */}
          {tagline ? (
            <div
              style={{
                fontSize: "28px",
                color: COLORS.textSecondary,
                textAlign: "center",
                maxWidth: "800px",
                lineHeight: 1.4,
                display: "flex",
              }}
            >
              {tagline}
            </div>
          ) : null}
        </div>

        {/* Brand mark — bottom right corner */}
        <div
          style={{
            position: "absolute",
            bottom: "32px",
            right: "40px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <div
            style={{
              width: "10px",
              height: "10px",
              borderRadius: "50%",
              background: COLORS.accent,
              display: "flex",
            }}
          />
          <div
            style={{
              fontFamily: "monospace",
              fontSize: "20px",
              color: COLORS.textSecondary,
              letterSpacing: "0.08em",
              display: "flex",
            }}
          >
            you.md
          </div>
        </div>

        {/* Decorative: faint horizontal line to reinforce "terminal" feel */}
        <div
          style={{
            position: "absolute",
            top: "48px",
            left: "40px",
            right: "40px",
            height: "1px",
            background: `linear-gradient(to right, transparent, ${COLORS.textSecondary}30, transparent)`,
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "80px",
            left: "40px",
            right: "40px",
            height: "1px",
            background: `linear-gradient(to right, transparent, ${COLORS.textSecondary}30, transparent)`,
            display: "flex",
          }}
        />
      </div>
    ),
    {
      ...size,
    }
  );
}
