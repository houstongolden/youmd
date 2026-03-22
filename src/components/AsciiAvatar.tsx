"use client";

import { useRef, useEffect, useState } from "react";

const RAMP = `$@B%8&#*oahkbdpqwmZO0QLCJUYXzcvunxrjft/|()1{}?-_+~<>i!lI;:,". `;

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

function imgToAscii(imgEl: HTMLImageElement, cols: number): AsciiCell[][] {
  const c = document.createElement("canvas");
  const rows = Math.floor(cols * (imgEl.naturalHeight / imgEl.naturalWidth) * 0.46);
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
      return { ch: RAMP[Math.floor((lum / 255) * (RAMP.length - 1))], lum };
    })
  );
}

function renderToCanvas(canvas: HTMLCanvasElement, data: AsciiCell[][], width: number) {
  const rows = data.length;
  const cols = data[0].length;
  canvas.width = width;
  const cellW = width / cols;
  const cellH = cellW * 2.1;
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

interface AsciiAvatarProps {
  src: string;
  cols?: number;
  canvasWidth?: number;
  className?: string;
}

const AsciiAvatar = ({ src, cols = 120, canvasWidth = 200, className = "" }: AsciiAvatarProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    if (!src) { setStatus("error"); return; }
    setStatus("loading");

    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      try {
        const data = imgToAscii(img, cols);
        if (data.length && canvasRef.current) {
          renderToCanvas(canvasRef.current, data, canvasWidth);
          setStatus("ready");
        } else {
          setStatus("error");
        }
      } catch {
        setStatus("error");
      }
    };

    img.onerror = () => {
      // Try without CORS as last resort (won't get pixel data but at least loads)
      const img2 = new Image();
      img2.onload = () => {
        try {
          const data = imgToAscii(img2, cols);
          if (data.length && canvasRef.current) {
            renderToCanvas(canvasRef.current, data, canvasWidth);
            setStatus("ready");
          } else {
            setStatus("error");
          }
        } catch {
          setStatus("error");
        }
      };
      img2.onerror = () => setStatus("error");
      img2.src = src;
    };

    img.src = src;
  }, [src, cols, canvasWidth]);

  return (
    <div className={`relative ${className}`}>
      <canvas
        ref={canvasRef}
        className={`${status === "ready" ? "opacity-100" : "opacity-0"} transition-opacity duration-300`}
        style={{ imageRendering: "auto", width: "100%", height: "auto" }}
      />
      {/* Fallback: show the actual photo with an orange tint overlay when canvas fails */}
      {status === "error" && src && (
        <div className="relative overflow-hidden" style={{ borderRadius: "2px" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt="profile"
            className="w-full opacity-60"
            style={{ filter: "sepia(1) saturate(2) hue-rotate(-10deg) brightness(0.7)" }}
          />
          <div className="absolute inset-0 bg-[hsl(var(--accent))]/10 mix-blend-multiply" />
        </div>
      )}
      {status === "loading" && (
        <div className="flex items-center justify-center py-8">
          <span className="font-mono text-[10px] text-[hsl(var(--text-secondary))] opacity-30 animate-pulse">
            generating portrait...
          </span>
        </div>
      )}
    </div>
  );
};

export default AsciiAvatar;
