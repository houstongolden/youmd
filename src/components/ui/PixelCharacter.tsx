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

const PATTERNS: Record<PixelCharacterKind, string[][]> = {
  machine: [
    [
      "........s.",
      "..aaaaaa..",
      ".abbbbbba.",
      ".ab0bb0ba.",
      ".abbbbbba.",
      ".abbccba.",
      ".abbbbbba.",
      "..aaaaaa..",
      "...dddd...",
      "..dddddd..",
    ],
    [
      ".......s..",
      ".aaaaaaaa.",
      ".abbbbbba.",
      ".abb0b0ba.",
      ".abbbbbba.",
      ".abccbbba.",
      ".abbbbbba.",
      ".aaaaaaaa.",
      "...dddd...",
      "..dddddd..",
    ],
  ],
  agent: [
    [
      "...aaaa...",
      "..abbbba..",
      ".ab0bb0ba.",
      ".abbbbbba.",
      ".abbccba.",
      "..aaaaaa..",
      "...a..a.s",
      "..aa..aa..",
      ".a......a.",
      "..........",
    ],
    [
      "..aaaaaa..",
      ".aabbbbaa.",
      ".ab0bb0ba.",
      ".abbbbbba.",
      ".abccbbba.",
      "..aaaaaa..",
      ".s.a..a..",
      "..aa..aa.",
      "...a..a..",
      "..........",
    ],
  ],
  shell: [
    [
      ".aaaaaaa..",
      "aabbbbba.",
      "ab0bbbba.",
      "abbbbbba.",
      "abbbccba.",
      "abbbbbba.",
      ".aaaaaaa.",
      "...dd..s.",
      "..dddd...",
      "..........",
    ],
    [
      "..aaaaaa..",
      ".aabbbbba.",
      ".ab0bbbba.",
      ".abbbbbba.",
      ".abbccba.",
      ".abbbbbba.",
      "..aaaaaa..",
      "...dd...s",
      "..dddd...",
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
      return "hsl(var(--accent-light) / 0.68)";
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
