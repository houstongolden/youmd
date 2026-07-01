"use client";

type PixelCharacterKind = "machine" | "agent" | "shell";
export type PixelCharacterStatus = "ready" | "active" | "warn" | "blocked" | "idle" | "unknown";

type PixelCharacterProps = {
  kind: PixelCharacterKind;
  seed?: string;
  status?: PixelCharacterStatus;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
};

// Warm-pixel pass: friendlier creatures (big eyes, a status antenna, warm blush cheeks `p`, a
// little smile `c`) while staying pixel-native and monochrome + one-orange-accent. Motion stays
// quiet and reduced-motion-safe (see globals.css) and only the alive-bob runs for live agents, so
// movement still signals real state per BRANDING.md — not decoration.
const PATTERNS: Record<PixelCharacterKind, string[][]> = {
  machine: [
    [
      "........s.",
      "..aaaaaa..",
      ".abbbbbba.",
      ".ab0bb0ba.",
      ".abpbbpba.",
      ".abbccbba.",
      ".abbbbbba.",
      "..aaaaaa..",
      "..dddddd..",
      "..d....d..",
    ],
    [
      ".......s..",
      "..aaaaaa..",
      ".abbbbbba.",
      ".ab0bb0ba.",
      ".abbbbbba.",
      ".abpccpba.",
      ".abbbbbba.",
      "..aaaaaa..",
      "..dddddd..",
      "..d....d..",
    ],
    [
      "........s.",
      "..aaaaaa..",
      ".abbbbbba.",
      ".abcbbcba.",
      ".abpbbpba.",
      ".abbccbba.",
      ".abbbbbba.",
      "..aaaaaa..",
      "..dddddd..",
      "..d....d..",
    ],
  ],
  agent: [
    [
      "....s.....",
      "....a.....",
      "..aaaaaa..",
      ".abbbbbba.",
      ".ab0bb0ba.",
      ".abpbbpba.",
      ".abbccbba.",
      "..aaaaaa..",
      "..d....d..",
      "..........",
    ],
    [
      ".s........",
      ".a........",
      "..aaaaaa..",
      ".abbbbbba.",
      ".ab0bb0ba.",
      ".abbbbbba.",
      ".abpccpba.",
      "..aaaaaa..",
      "..d....d..",
      "..........",
    ],
    [
      "....s.....",
      "....a.....",
      "..aaaaaa..",
      ".abbbbbba.",
      ".abcbbcba.",
      ".abpbbpba.",
      ".abbccbba.",
      "..aaaaaa..",
      ".d......d.",
      "..........",
    ],
  ],
  shell: [
    [
      ".aaaaaaaa.",
      ".abbbbbba.",
      ".ab0bb0ba.",
      ".abbppbba.",
      ".abbccbba.",
      ".abbbbbba.",
      ".aaaaaaaa.",
      "...dd...s.",
      "..dddd....",
      "..........",
    ],
    [
      ".aaaaaaaa.",
      ".abbbbbba.",
      ".ab0bb0ba.",
      ".abbbbbba.",
      ".abbppbba.",
      ".abbccbba.",
      ".aaaaaaaa.",
      "...dd..s..",
      "..dddd....",
      "..........",
    ],
    [
      ".aaaaaaaa.",
      ".abbbbbba.",
      ".abcbbcba.",
      ".abbppbba.",
      ".abbccbba.",
      ".abbbbbba.",
      ".aaaaaaaa.",
      "...dd...s.",
      "..dddd....",
      "..........",
    ],
  ],
};

const SIZE_PX = {
  xs: 18,
  sm: 28,
  md: 36,
  lg: 48,
};

function hashSeed(seed: string) {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

function statusColor(status: PixelCharacterStatus) {
  if (status === "ready" || status === "active") return "hsl(var(--success))";
  if (status === "blocked") return "hsl(var(--destructive))";
  if (status === "warn") return "hsl(var(--accent))";
  return "hsl(var(--text-secondary) / 0.46)";
}

function cellColor(cell: string, status: PixelCharacterStatus) {
  switch (cell) {
    case "a":
      return "hsl(var(--accent) / 0.78)";
    case "b":
      return "hsl(var(--shell-active))";
    case "c":
      return "hsl(var(--accent-mid) / 0.7)";
    case "p":
      // Warm blush cheek — the "alive/human" warmth, kept inside the single orange accent family
      // so it reads as charm, not a second color.
      return "hsl(var(--accent-light) / 0.5)";
    case "d":
      return "hsl(var(--text-secondary) / 0.36)";
    case "0":
      return "hsl(var(--text-primary) / 0.72)";
    case "s":
      return statusColor(status);
    default:
      return "transparent";
  }
}

export function PixelCharacter({
  kind,
  seed = kind,
  status = "unknown",
  size = "md",
  className = "",
}: PixelCharacterProps) {
  const variants = PATTERNS[kind];
  const pattern = variants[hashSeed(seed) % variants.length];
  const pixels = pattern.flatMap((row, rowIndex) =>
    row.split("").map((cell, columnIndex) => ({
      cell,
      key: `${rowIndex}-${columnIndex}`,
    }))
  );

  return (
    <div
      aria-hidden="true"
      className={`pixel-character relative grid shrink-0 gap-px ${className}`}
      data-live={status === "ready" || status === "active" ? "true" : "false"}
      style={{
        width: SIZE_PX[size],
        height: SIZE_PX[size],
        gridTemplateColumns: `repeat(${pattern[0]?.length ?? 10}, minmax(0, 1fr))`,
        imageRendering: "pixelated",
      }}
    >
      {pixels.map(({ cell, key }) => (
        <span
          key={key}
          className={[
            cell === "0" ? "pixel-character-eye" : "",
            cell === "s" ? "pixel-character-status" : "",
            cell === "p" ? "pixel-character-blush" : "",
          ].join(" ")}
          style={{
            backgroundColor: cellColor(cell, status),
            boxShadow: cell === "s" ? `0 0 8px ${statusColor(status)}` : undefined,
            opacity: cell === "." ? 0 : 1,
          }}
        />
      ))}
    </div>
  );
}
