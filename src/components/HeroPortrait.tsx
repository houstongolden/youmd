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

const HeroPortrait = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      const cols = 120;
      const data = imgToAscii(img, cols);
      if (!data.length || !canvasRef.current) return;

      const canvas = canvasRef.current;
      const W = 500;
      canvas.width = W;
      const cellW = W / cols;
      const cellH = cellW * 2.1;
      canvas.height = Math.ceil(data.length * cellH);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.clearRect(0, 0, W, canvas.height);
      const fs = Math.max(4, Math.floor(cellH * 1.05));
      ctx.font = `${fs}px "Courier New",monospace`;
      ctx.textBaseline = "top";

      for (let y = 0; y < data.length; y++)
        for (let x = 0; x < cols; x++) {
          const { ch, lum } = data[y][x];
          ctx.fillStyle = lumToColor(lum);
          ctx.fillText(ch, x * cellW, y * cellH);
        }

      setReady(true);
    };
    img.src = "/assets/houston-portrait.jpeg";
  }, []);

  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden rounded border border-border bg-background">
      <canvas
        ref={canvasRef}
        className={`w-full transition-opacity duration-500 ${ready ? "opacity-100" : "opacity-0"}`}
      />
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-muted-foreground/40 font-mono text-[10px]">generating portrait...</p>
        </div>
      )}
    </div>
  );
};

export default HeroPortrait;
