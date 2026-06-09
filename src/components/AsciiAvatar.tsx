"use client";

import { useRef, useEffect, useState, useCallback, type ReactNode } from "react";

// ---------------------------------------------------------------------------
// ASCII character ramps — different visual styles
// ---------------------------------------------------------------------------

export type AsciiFormat = "classic" | "braille" | "block" | "minimal";

const RAMPS: Record<AsciiFormat, string> = {
  classic: `$@B%8&#*oahkbdpqwmZO0QLCJUYXzcvunxrjft/|()1{}?-_+~<>i!lI;:,". `,
  braille: "\u28FF\u28F7\u28F6\u28E6\u28E4\u2884\u2880\u2840\u2800",
  block: "\u2588\u2593\u2592\u2591 ",
  minimal: "@%#*+=-:. ",
};

function lumToColor(l: number): string {
  if (l < 25) return "transparent";
  if (l < 55) return "hsl(20 50% 10%)";
  if (l < 85) return "hsl(20 55% 16%)";
  if (l < 115) return "hsl(20 58% 24%)";
  if (l < 145) return "hsl(20 60% 34%)";
  if (l < 175) return "hsl(20 60% 42%)";
  if (l < 205) return "hsl(20 60% 52%)";
  if (l < 230) return "hsl(22 55% 60%)";
  return "hsl(24 50% 72%)";
}

type AsciiCell = { ch: string; lum: number };

// ---------------------------------------------------------------------------
// Pre-rendered portrait data types (stored in DB)
// ---------------------------------------------------------------------------

export interface PreRenderedPortrait {
  lines: string[];
  coloredLines?: Array<Array<{ char: string; color: string }>>;
  cols: number;
  rows: number;
  format: string;
  sourceUrl: string;
  generatedAt?: number;
}

export interface RenderedResult {
  lines: string[];
  coloredLines: Array<Array<{ char: string; color: string }>>;
  cols: number;
  rows: number;
  format: string;
  sourceUrl: string;
}

// ---------------------------------------------------------------------------
// Client-side generation (canvas-based)
// ---------------------------------------------------------------------------

function imgToAscii(imgEl: HTMLImageElement, cols: number, format: AsciiFormat): AsciiCell[][] {
  const ramp = RAMPS[format];
  const c = document.createElement("canvas");
  // Braille characters are taller, adjust aspect ratio
  const aspectFactor = format === "braille" ? 0.55 : 0.46;
  const rows = Math.floor(cols * (imgEl.naturalHeight / imgEl.naturalWidth) * aspectFactor);
  c.width = cols;
  c.height = rows;
  const ctx = c.getContext("2d");
  if (!ctx) return [];
  ctx.filter = "contrast(1.35) brightness(1.05)";
  ctx.drawImage(imgEl, 0, 0, cols, rows);
  const px = ctx.getImageData(0, 0, cols, rows).data;
  return Array.from({ length: rows }, (_, y) =>
    Array.from({ length: cols }, (_, x) => {
      const i = (y * cols + x) * 4;
      const lum = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
      return { ch: ramp[Math.floor((lum / 255) * (ramp.length - 1))], lum };
    })
  );
}

function cellsToRenderedResult(
  data: AsciiCell[][],
  cols: number,
  format: string,
  sourceUrl: string
): RenderedResult {
  const lines: string[] = [];
  const coloredLines: Array<Array<{ char: string; color: string }>> = [];

  for (const row of data) {
    let line = "";
    const coloredLine: Array<{ char: string; color: string }> = [];
    for (const cell of row) {
      line += cell.ch;
      coloredLine.push({ char: cell.ch, color: lumToColor(cell.lum) });
    }
    lines.push(line);
    coloredLines.push(coloredLine);
  }

  return { lines, coloredLines, cols, rows: data.length, format, sourceUrl };
}

function renderToCanvas(canvas: HTMLCanvasElement, data: AsciiCell[][], width: number, format: AsciiFormat) {
  const rows = data.length;
  const cols = data[0].length;
  canvas.width = width;
  const cellW = width / cols;
  const cellH = cellW * (format === "braille" ? 1.8 : 2.1);
  canvas.height = Math.ceil(rows * cellH);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const fs = Math.max(4, Math.floor(cellH * 1.05));
  ctx.font = `${fs}px "Courier New",monospace`;
  ctx.textBaseline = "top";
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < cols; x++) {
      const { ch, lum } = data[y][x];
      ctx.fillStyle = lumToColor(lum);
      ctx.fillText(ch, x * cellW, y * cellH);
    }
}

// ---------------------------------------------------------------------------
// Pre-rendered text renderer (DOM-based, no canvas needed)
// ---------------------------------------------------------------------------

function PreRenderedAscii({
  portrait,
  targetCols,
  canvasWidth,
  className = "",
}: {
  portrait: PreRenderedPortrait;
  targetCols?: number;
  canvasWidth?: number;
  className?: string;
}) {
  const renderedPortrait = compactPreRenderedPortrait(portrait, targetCols);
  const coloredLines = renderedPortrait.coloredLines as Array<Array<{ char: string; color: string }>> | undefined;
  const fontSize = Math.max(
    3,
    Math.min(6, ((canvasWidth || renderedPortrait.cols * 4) / Math.max(renderedPortrait.cols, 1)) * 1.2)
  );
  const preStyle = { fontSize, lineHeight: 1.08 };

  if (coloredLines && coloredLines.length > 0) {
    // Rich colored rendering
    return (
      <pre
        className={`font-mono select-none whitespace-pre overflow-hidden ${className}`}
        style={preStyle}
        aria-hidden="true"
      >
        {coloredLines.map((row, y) => (
          <div key={y} style={{ height: "1.1em" }}>
            {row.map((cell, x) => (
              <span key={x} style={{ color: cell.color }}>
                {cell.char}
              </span>
            ))}
          </div>
        ))}
      </pre>
    );
  }

  // Plain text fallback (monochrome orange)
  return (
    <pre
      className={`font-mono select-none whitespace-pre overflow-hidden text-[hsl(20_60%_42%)] ${className}`}
      style={preStyle}
      aria-hidden="true"
    >
      {renderedPortrait.lines.join("\n")}
    </pre>
  );
}

function compactPreRenderedPortrait(
  portrait: PreRenderedPortrait,
  targetCols?: number
): PreRenderedPortrait {
  const lines = portrait.lines;
  const sourceCols = Math.max(
    portrait.cols || 0,
    ...lines.map((line) => line.length),
    1
  );
  const cols = Math.max(1, Math.min(targetCols || sourceCols, sourceCols));
  if (cols >= sourceCols) return portrait;

  const sourceRows = lines.length;
  const rows = Math.max(1, Math.min(sourceRows, Math.round(sourceRows * (cols / sourceCols))));
  const rowIndexes = sampleIndexes(sourceRows, rows);
  const colIndexes = sampleIndexes(sourceCols, cols);
  const coloredLines = portrait.coloredLines as Array<Array<{ char: string; color: string }>> | undefined;

  const sampledLines = rowIndexes.map((rowIndex) => {
    const line = lines[rowIndex] || "";
    return colIndexes.map((colIndex) => line[colIndex] || " ").join("");
  });

  const sampledColoredLines = coloredLines
    ? rowIndexes.map((rowIndex, y) => {
        const row = coloredLines[rowIndex] || [];
        return colIndexes.map((colIndex, x) => {
          const cell = row[Math.min(colIndex, Math.max(row.length - 1, 0))];
          return cell || {
            char: sampledLines[y]?.[x] || " ",
            color: "hsl(20 60% 42%)",
          };
        });
      })
    : undefined;

  return {
    ...portrait,
    lines: sampledLines,
    coloredLines: sampledColoredLines,
    cols,
    rows,
  };
}

function sampleIndexes(sourceLength: number, targetLength: number): number[] {
  if (sourceLength <= targetLength) {
    return Array.from({ length: sourceLength }, (_, index) => index);
  }
  const step = sourceLength / targetLength;
  return Array.from({ length: targetLength }, (_, index) =>
    Math.min(sourceLength - 1, Math.floor(index * step))
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface AsciiAvatarProps {
  src: string;
  cols?: number;
  canvasWidth?: number;
  format?: AsciiFormat;
  className?: string;
  showLoadingText?: boolean;
  fallback?: ReactNode;
  /** Pre-rendered portrait data from the database — skips canvas generation entirely */
  preRendered?: PreRenderedPortrait | null;
  /** Callback when canvas generation completes — use to save result to DB */
  onRendered?: (result: RenderedResult) => void;
}

const AsciiAvatar = ({
  src,
  cols = 160,
  canvasWidth = 200,
  format = "block",
  className = "",
  showLoadingText = true,
  fallback,
  preRendered,
  onRendered,
}: AsciiAvatarProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  // Track whether we've already called onRendered for this src+cols+format combo
  const renderedKeyRef = useRef<string>("");

  // If pre-rendered data is available, render it directly
  if (preRendered && preRendered.lines.length > 0) {
    return (
      <div className={`relative ${className}`}>
        <PreRenderedAscii portrait={preRendered} targetCols={cols} canvasWidth={canvasWidth} />
      </div>
    );
  }

  return (
    <AsciiAvatarCanvas
      src={src}
      cols={cols}
      canvasWidth={canvasWidth}
      format={format}
      className={className}
      onRendered={onRendered}
      showLoadingText={showLoadingText}
      fallback={fallback}
      canvasRef={canvasRef}
      status={status}
      setStatus={setStatus}
      renderedKeyRef={renderedKeyRef}
    />
  );
};

// Separate component for the canvas-based rendering to avoid hooks-after-early-return
function AsciiAvatarCanvas({
  src,
  cols,
  canvasWidth,
  format,
  className,
  onRendered,
  showLoadingText,
  fallback,
  canvasRef,
  status,
  setStatus,
  renderedKeyRef,
}: {
  src: string;
  cols: number;
  canvasWidth: number;
  format: AsciiFormat;
  className: string;
  onRendered?: (result: RenderedResult) => void;
  showLoadingText: boolean;
  fallback?: ReactNode;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  status: "loading" | "ready" | "error";
  setStatus: (s: "loading" | "ready" | "error") => void;
  renderedKeyRef: React.MutableRefObject<string>;
}) {
  const onRenderedRef = useRef(onRendered);
  const retriedNoCorsRef = useRef(false);
  const [failedFallbackSrc, setFailedFallbackSrc] = useState<string | null>(null);
  const fallbackImageFailed = failedFallbackSrc === src;

  useEffect(() => {
    onRenderedRef.current = onRendered;
  }, [onRendered]);

  const handleImageLoad = useCallback((img: HTMLImageElement) => {
    try {
      const data = imgToAscii(img, cols, format);
      if (data.length && canvasRef.current) {
        renderToCanvas(canvasRef.current, data, canvasWidth, format);
        setStatus("ready");

        // Notify parent with rendered result (for saving to DB)
        const key = `${src}:${cols}:${format}`;
        if (onRenderedRef.current && renderedKeyRef.current !== key) {
          renderedKeyRef.current = key;
          const result = cellsToRenderedResult(data, cols, format, src);
          onRenderedRef.current(result);
        }
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }, [src, cols, canvasWidth, format, canvasRef, setStatus, renderedKeyRef]);

  useEffect(() => {
    if (!src) { setStatus("error"); return; }
    setStatus("loading");
    retriedNoCorsRef.current = false;

    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => handleImageLoad(img);

    img.onerror = () => {
      // Try without CORS as last resort
      const img2 = new Image();
      img2.onload = () => handleImageLoad(img2);
      img2.onerror = () => setStatus("error");
      img2.src = src;
    };

    img.src = src;
  }, [src, cols, canvasWidth, format, handleImageLoad, setStatus]);

  return (
    <div className={`relative ${className}`}>
      <canvas
        ref={canvasRef}
        className={`${status === "ready" ? "opacity-100" : "opacity-0"} transition-opacity duration-300`}
        style={{ imageRendering: "auto", width: "100%", height: "auto" }}
      />
      {/* Fallback: show the actual photo with an orange tint overlay when canvas fails */}
      {status === "error" && src && !fallbackImageFailed && (
        <div className="absolute inset-0 overflow-hidden" style={{ borderRadius: "2px" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt=""
            crossOrigin="anonymous"
            className="h-full w-full object-cover opacity-60"
            style={{ filter: "grayscale(1) brightness(0.9) contrast(1.1)" }}
            onError={(e) => {
              const target = e.currentTarget;
              if (target.crossOrigin && !retriedNoCorsRef.current) {
                retriedNoCorsRef.current = true;
                target.removeAttribute("crossorigin");
                target.src = src;
                return;
              }
              setFailedFallbackSrc(src);
            }}
          />
          <div className="absolute inset-0 bg-[hsl(var(--accent))]/10 mix-blend-multiply" />
        </div>
      )}
      {status === "error" && (!src || fallbackImageFailed) && fallback && (
        <div className="absolute inset-0">{fallback}</div>
      )}
      {status === "loading" && !showLoadingText && fallback && (
        <div className="absolute inset-0">{fallback}</div>
      )}
      {status === "loading" && showLoadingText && (
        <div className="flex items-center justify-center py-8">
          <span className="font-mono text-[10px] text-[hsl(var(--text-secondary))] opacity-30 animate-pulse">
            rendering portrait...
          </span>
        </div>
      )}
    </div>
  );
}

export default AsciiAvatar;
