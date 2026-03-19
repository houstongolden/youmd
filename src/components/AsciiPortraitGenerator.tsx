"use client";

import { useState, useRef, useCallback, useEffect } from "react";

/* -- ASCII ramp & color mapping -- */
const RAMP = `$@B%8&#*oahkbdpqwmZO0QLCJUYXzcvunxrjft/|()1{}?-_+~<>i!lI;:,". `;

type AsciiCell = { ch: string; lum: number };

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

function renderPortrait(canvas: HTMLCanvasElement, data: AsciiCell[][]) {
  if (!data?.length) return;
  const rows = data.length;
  const cols = data[0].length;
  const W = canvas.width;
  const cellW = W / cols;
  const cellH = cellW * 2.1;
  canvas.height = Math.ceil(rows * cellH);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.fillStyle = "hsl(var(--bg))";
  ctx.fillRect(0, 0, W, canvas.height);
  const fs = Math.max(6, Math.floor(cellH * 1.05));
  ctx.font = `${fs}px "Courier New",monospace`;
  ctx.textBaseline = "top";
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < cols; x++) {
      const { ch, lum } = data[y][x];
      ctx.fillStyle = lumToColor(lum);
      ctx.fillText(ch, x * cellW, y * cellH);
    }
}

const LOAD_FRAMES = [
  "\u25B0\u25B1\u25B1\u25B1\u25B1\u25B1\u25B1\u25B1",
  "\u25B0\u25B0\u25B1\u25B1\u25B1\u25B1\u25B1\u25B1",
  "\u25B0\u25B0\u25B0\u25B1\u25B1\u25B1\u25B1\u25B1",
  "\u25B0\u25B0\u25B0\u25B0\u25B1\u25B1\u25B1\u25B1",
  "\u25B0\u25B0\u25B0\u25B0\u25B0\u25B1\u25B1\u25B1",
  "\u25B0\u25B0\u25B0\u25B0\u25B0\u25B0\u25B1\u25B1",
  "\u25B0\u25B0\u25B0\u25B0\u25B0\u25B0\u25B0\u25B1",
  "\u25B0\u25B0\u25B0\u25B0\u25B0\u25B0\u25B0\u25B0",
];

const AsciiPortraitGenerator = () => {
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [asciiData, setAsciiData] = useState<AsciiCell[][] | null>(null);
  const [cols, setCols] = useState(120);
  const [showPhoto, setShowPhoto] = useState(false);
  const [tab, setTab] = useState<"portrait" | "about">("portrait");
  const [urlInput, setUrlInput] = useState("");
  const [urlStatus, setUrlStatus] = useState("");
  const [generating, setGenerating] = useState(false);
  const [loadFrame, setLoadFrame] = useState(0);

  const fileRef = useRef<HTMLInputElement>(null);
  const portraitRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!generating) return;
    const t = setInterval(() => setLoadFrame((f) => (f + 1) % LOAD_FRAMES.length), 120);
    return () => clearInterval(t);
  }, [generating]);

  useEffect(() => {
    if (asciiData && portraitRef.current) renderPortrait(portraitRef.current, asciiData);
  }, [asciiData]);

  const handleGenerate = useCallback(() => {
    if (!imgUrl) return;
    setGenerating(true);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () =>
      setTimeout(() => {
        setAsciiData(imgToAscii(img, cols));
        setGenerating(false);
      }, 20);
    img.src = imgUrl;
  }, [cols, imgUrl]);

  const loadFile = useCallback((file: File | undefined) => {
    if (!file?.type.startsWith("image/")) return;
    setAsciiData(null);
    setImgLoaded(false);
    setUrlStatus("");
    const reader = new FileReader();
    reader.onload = (e) => {
      const url = e.target?.result as string;
      setImgUrl(url);
      const img = new Image();
      img.onload = () => setImgLoaded(true);
      img.src = url;
    };
    reader.readAsDataURL(file);
  }, []);

  const handleUrlFetch = useCallback(async () => {
    const url = urlInput.trim();
    if (!url) return;
    setUrlStatus("fetching...");
    try {
      const res = await fetch(
        `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`
      );
      const html = ((await res.json()) as { contents?: string }).contents || "";
      const og =
        html.match(/property=["']og:image["'][^>]*content=["']([^"']+)["']/i)?.[1] ||
        html.match(/content=["']([^"']+)["'][^>]*property=["']og:image["']/i)?.[1];
      const gh = html.match(
        /https:\/\/avatars\.githubusercontent\.com\/[^\s"'?]+/i
      )?.[0];
      const found = og || gh;
      if (found) {
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(found)}`;
        setImgUrl(proxyUrl);
        setAsciiData(null);
        setImgLoaded(false);
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => setImgLoaded(true);
        img.src = proxyUrl;
        setUrlStatus("ready \u2014 click generate");
      } else {
        setUrlStatus("no image found \u2014 upload directly");
      }
    } catch {
      setUrlStatus("fetch failed \u2014 upload directly");
    }
  }, [urlInput]);

  return (
    <div className="w-full">
      {/* Portrait display */}
      <div className="relative w-full aspect-square max-w-md mx-auto mb-6 overflow-hidden rounded border border-border bg-background flex items-center justify-center">
        {asciiData && !showPhoto && (
          <canvas ref={portraitRef} width={500} className="w-full" />
        )}
        {asciiData && showPhoto && imgUrl && (
          <img
            src={imgUrl}
            alt="Original"
            className="w-full h-full object-cover"
          />
        )}
        {!asciiData && (
          <div className="text-center p-8">
            {imgLoaded ? (
              <>
                <p className="text-accent font-mono text-xs mb-2">PHOTO READY</p>
                <div className="w-12 h-px bg-accent/30 mx-auto mb-2" />
                <p className="text-muted-foreground font-mono text-[10px]">
                  click generate below
                </p>
              </>
            ) : (
              <>
                <p className="text-muted-foreground/40 font-mono text-2xl mb-3">[ ]</p>
                <p className="text-muted-foreground/60 font-mono text-[10px] leading-relaxed">
                  UPLOAD PHOTO
                  <br />
                  TO GENERATE ASCII PORTRAIT
                </p>
              </>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-0 mb-0">
        {(["portrait", "about"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`font-mono text-[10px] px-4 py-1 border border-b-0 rounded-t transition-colors ${
              tab === t
                ? "bg-primary text-primary-foreground font-bold border-primary"
                : "bg-transparent text-muted-foreground/50 border-border hover:text-muted-foreground"
            }`}
          >
            {tab === t ? "\u25B6 " : ""}
            {t}.sh
          </button>
        ))}
      </div>

      {tab === "portrait" && (
        <div className="terminal-panel rounded-tl-none p-5 space-y-4">
          <p className="text-accent font-mono text-[10px]">
            $ you portrait --generate --cols={cols}
          </p>

          {/* Upload area */}
          <div
            onClick={() => fileRef.current?.click()}
            onDrop={(e) => {
              e.preventDefault();
              loadFile(e.dataTransfer.files[0]);
            }}
            onDragOver={(e) => e.preventDefault()}
            className={`border border-dashed px-4 py-3 cursor-pointer inline-flex items-center gap-2 font-mono text-[10px] transition-colors ${
              imgLoaded
                ? "border-success/30 text-success/70 bg-background"
                : "border-border text-muted-foreground/50 bg-background hover:border-accent/30"
            }`}
          >
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => loadFile(e.target.files?.[0])}
            />
            {imgLoaded
              ? "\u2713 photo loaded \u00B7 click to replace"
              : "drag & drop \u00B7 or click to upload"}
          </div>

          {/* URL input */}
          <div className="space-y-2">
            <p className="text-muted-foreground/50 font-mono text-[9px]">
              or paste github / linkedin / x profile url:
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <input
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleUrlFetch()}
                placeholder="https://github.com/username"
                className="font-mono text-[10px] bg-background border border-border text-foreground/60 px-2 py-1.5 w-64 outline-none focus:border-accent/40 transition-colors"
              />
              <button
                onClick={handleUrlFetch}
                className="font-mono text-[10px] text-accent hover:text-accent/80 transition-colors"
              >
                fetch &rarr;
              </button>
              {urlStatus && (
                <span className="text-muted-foreground/50 font-mono text-[9px]">
                  {urlStatus}
                </span>
              )}
            </div>
          </div>

          {/* Detail slider */}
          {imgLoaded && (
            <div className="flex items-center gap-3 font-mono text-[10px] text-muted-foreground/60">
              <span>detail</span>
              <input
                type="range"
                min={40}
                max={120}
                value={cols}
                onChange={(e) => setCols(+e.target.value)}
                className="w-24 accent-primary"
              />
              <span className="text-accent">{cols}</span>
            </div>
          )}

          {/* Generate button */}
          {imgLoaded && (
            <div className="flex gap-3 items-center flex-wrap">
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="cta-primary px-4 py-2.5 font-mono text-[10px] disabled:opacity-50"
              >
                {generating
                  ? `${LOAD_FRAMES[loadFrame]}  GENERATING`
                  : "\u25B6  GENERATE PORTRAIT"}
              </button>
              {asciiData && (
                <>
                  <button
                    onMouseEnter={() => setShowPhoto(true)}
                    onMouseLeave={() => setShowPhoto(false)}
                    className="cta-outline px-3 py-2.5 font-mono text-[10px]"
                  >
                    hold: reveal photo
                  </button>
                  <button
                    onClick={() => {
                      if (!portraitRef.current) return;
                      const link = document.createElement("a");
                      link.download = "you-portrait.png";
                      link.href = portraitRef.current.toDataURL("image/png");
                      link.click();
                    }}
                    className="cta-outline px-3 py-2.5 font-mono text-[10px]"
                  >
                    &darr; download .png
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {tab === "about" && (
        <div className="terminal-panel rounded-tl-none p-5 font-mono text-[10px] leading-[1.9] space-y-4">
          <p className="text-accent">// WHAT IS YOU?</p>
          <p className="text-muted-foreground">
            YOU is an identity context protocol &mdash; like MCP, but for your human
            identity.
            <br />
            Give any AI agent structured context about who you are, how you work,
            <br />
            and what you care about. One file. Every agent. Every session.
          </p>
          <p className="text-accent">// PORTRAIT PIPELINE</p>
          <p className="text-muted-foreground">
            1. share a profile url (github / linkedin / x)
            <br />
            2. scrape + download your avatar
            <br />
            3. pixel&rarr;ascii algorithm maps brightness to chars
            <br />
            4. chars colored via orange luminance palette
            <br />
            5. portrait stored in your identity manifest
            <br />
            6. loads every time you start a you session
          </p>
          <p className="text-muted-foreground/50">
            stack: convex &middot; openrouter &middot; perplexity &middot; apify &middot; firecrawl
            <br />
            byok: ~/.you/config.json &middot; never transits backend
          </p>
        </div>
      )}
    </div>
  );
};

export default AsciiPortraitGenerator;
