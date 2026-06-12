import { ImageResponse } from "next/og";
import { CONVEX_SITE_URL } from "@/lib/constants";

export const runtime = "edge";
export const alt = "you.md profile card — this is what agents see when they meet me";
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

// JetBrains Mono is required for the ASCII portrait to align — bundled
// locally so the edge function makes zero extra network calls per render.
const jetbrainsMono = fetch(
  new URL("../../../assets/fonts/JetBrainsMono-Regular.ttf", import.meta.url)
).then((res) => res.arrayBuffer());

interface AsciiPortrait {
  lines: string[];
  cols: number;
  rows: number;
}

// The public profile API returns the compiled youJson with profile-level
// fields merged under `_profile` (see convex/http.ts GET /api/v1/profiles).
interface ProfileData {
  identity?: {
    name?: string;
    tagline?: string;
  };
  _profile?: {
    displayName?: string | null;
    asciiPortrait?: AsciiPortrait | null;
  };
}

async function fetchProfile(username: string): Promise<ProfileData | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8_000);
    const res = await fetch(
      `${CONVEX_SITE_URL}/api/v1/profiles?username=${encodeURIComponent(username)}`,
      {
        headers: { Accept: "application/json" },
        next: { revalidate: 60 },
        signal: controller.signal,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any
    ).finally(() => clearTimeout(timeout));
    if (!res.ok) return null;
    return (await res.json()) as ProfileData;
  } catch {
    return null;
  }
}

function isRenderablePortrait(value: unknown): value is AsciiPortrait {
  if (!value || typeof value !== "object") return false;
  const p = value as Partial<AsciiPortrait>;
  return (
    Array.isArray(p.lines) &&
    p.lines.length > 0 &&
    p.lines.some((l) => typeof l === "string" && l.trim().length > 0)
  );
}

/**
 * Downsample a stored portrait (often 120x55) to fit the card by nearest
 * sampling — keeps the render to one text block, no per-char spans.
 */
function fitPortrait(
  portrait: AsciiPortrait,
  maxCols: number,
  maxRows: number
): { text: string; cols: number; rows: number } {
  const srcRows = portrait.lines.length;
  const srcCols = Math.max(...portrait.lines.map((l) => l.length), 1);
  const scale = Math.min(1, maxCols / srcCols, maxRows / srcRows);
  const cols = Math.max(1, Math.floor(srcCols * scale));
  const rows = Math.max(1, Math.floor(srcRows * scale));
  const lines: string[] = [];
  for (let y = 0; y < rows; y++) {
    const srcLine = portrait.lines[Math.floor((y / rows) * srcRows)] ?? "";
    let line = "";
    for (let x = 0; x < cols; x++) {
      line += srcLine[Math.floor((x / cols) * srcCols)] ?? " ";
    }
    lines.push(line);
  }
  return { text: lines.join("\n"), cols, rows };
}

export default async function OgImage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const [profile, fontData] = await Promise.all([
    fetchProfile(username),
    jetbrainsMono,
  ]);

  const displayName =
    profile?._profile?.displayName || profile?.identity?.name || username;

  const rawPortrait = profile?._profile?.asciiPortrait;
  const portrait = isRenderablePortrait(rawPortrait)
    ? fitPortrait(rawPortrait, 84, 46)
    : null;

  // Size the portrait text so the block fits its panel.
  // JetBrains Mono advance width is 0.6em; line-height set to 1.
  const PANEL_W = 520;
  const PANEL_H = 510;
  const portraitFontSize = portrait
    ? Math.min(PANEL_W / (portrait.cols * 0.6), PANEL_H / portrait.rows)
    : 0;

  const taglineLine = "this is what agents see when they meet me";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          background: COLORS.bg,
          fontFamily: '"JetBrains Mono"',
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Left panel — the ASCII portrait is the hero */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: portrait ? "580px" : "0px",
            height: "100%",
            borderRight: portrait ? `1px solid ${COLORS.border}` : "none",
            background: COLORS.bgRaised,
          }}
        >
          {portrait ? (
            <div
              style={{
                fontSize: `${portraitFontSize}px`,
                lineHeight: 1,
                whiteSpace: "pre",
                color: COLORS.accent,
                display: "flex",
              }}
            >
              {portrait.text}
            </div>
          ) : null}
        </div>

        {/* Right panel — identity */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            flex: 1,
            height: "100%",
            padding: portrait ? "0 56px" : "0 120px",
            position: "relative",
            alignItems: portrait ? "flex-start" : "center",
          }}
        >
          <div
            style={{
              fontSize: "26px",
              color: COLORS.accent,
              letterSpacing: "0.04em",
              marginBottom: "20px",
              display: "flex",
            }}
          >
            you.md/{username}
          </div>

          <div
            style={{
              fontSize: portrait ? "54px" : "68px",
              fontWeight: 400,
              color: COLORS.text,
              lineHeight: 1.12,
              maxWidth: portrait ? "500px" : "900px",
              marginBottom: "28px",
              display: "flex",
              textAlign: portrait ? "left" : "center",
            }}
          >
            {displayName}
          </div>

          <div
            style={{
              fontSize: "21px",
              color: COLORS.textSecondary,
              opacity: 0.75,
              lineHeight: 1.5,
              maxWidth: portrait ? "440px" : "700px",
              display: "flex",
              textAlign: portrait ? "left" : "center",
            }}
          >
            {taglineLine}
          </div>
        </div>

        {/* Brand mark — bottom right corner */}
        <div
          style={{
            position: "absolute",
            bottom: "30px",
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
              fontSize: "20px",
              color: COLORS.textSecondary,
              letterSpacing: "0.08em",
              display: "flex",
            }}
          >
            you.md
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        {
          name: "JetBrains Mono",
          data: fontData,
          style: "normal",
          weight: 400,
        },
      ],
      headers: {
        // OG images don't change unless the profile changes. Social media
        // crawlers (Facebook, Twitter, LinkedIn, Slack, etc.) hammer this
        // endpoint on every shared link, so caching is critical.
        // - Browser: 1 hour
        // - CDN/edge: 24 hours
        // - stale-while-revalidate: 7 days (serve stale while regenerating)
        "Cache-Control":
          "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
      },
    }
  );
}
