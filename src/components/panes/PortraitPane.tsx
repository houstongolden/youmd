"use client";

import { useState, useCallback, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import AsciiAvatar from "@/components/AsciiAvatar";
import type { AsciiFormat, RenderedResult, PreRenderedPortrait } from "@/components/AsciiAvatar";
import { PaneSectionLabel as SectionLabel, PaneDivider as Divider, PaneHeader } from "./shared";

interface PortraitPaneProps {
  username: string;
  ownerId?: Id<"users">;
}

const FORMAT_OPTIONS: { value: AsciiFormat; label: string; desc: string }[] = [
  { value: "classic", label: "classic", desc: "$@B%8&#*oahkbd..." },
  { value: "braille", label: "braille", desc: "\u28FF\u28F7\u28F6\u28E6\u28E4\u2884\u2880\u2840\u2800" },
  { value: "block", label: "block", desc: "\u2588\u2593\u2592\u2591" },
  { value: "minimal", label: "minimal", desc: "@%#*+=-:." },
];

const DETAIL_PRESETS = [
  { value: 60, label: "60" },
  { value: 80, label: "80" },
  { value: 100, label: "100" },
  { value: 120, label: "120" },
  { value: 160, label: "160" },
];

export function PortraitPane({ username, ownerId }: PortraitPaneProps) {
  const { user } = useUser();
  const userProfile = useQuery(
    api.profiles.getByOwnerId,
    ownerId ? { ownerId } : "skip"
  );
  const setProfileImages = useMutation(api.profiles.setProfileImages);
  const savePortrait = useMutation(api.profiles.savePortrait);

  const [format, setFormat] = useState<AsciiFormat>("classic");
  const [cols, setCols] = useState(120);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const portraitContainerRef = useRef<HTMLDivElement>(null);

  const avatarUrl = userProfile?.avatarUrl;
  const socialImages = (userProfile?.socialImages as Record<string, string | undefined>) || {};
  const primaryImage = (userProfile?.primaryImage as string) || "";

  // Pre-rendered portrait from DB
  const storedPortrait = userProfile?.asciiPortrait as PreRenderedPortrait | undefined;

  // Check if stored portrait matches current settings
  const portraitMatchesSettings = storedPortrait &&
    storedPortrait.format === format &&
    storedPortrait.cols === cols &&
    storedPortrait.sourceUrl === avatarUrl;

  // Collect all available portrait sources
  const sources: { platform: string; url: string; isPrimary: boolean }[] = [];
  if (socialImages.github) sources.push({ platform: "github", url: socialImages.github, isPrimary: primaryImage === "github" });
  if (socialImages.x) sources.push({ platform: "x", url: socialImages.x, isPrimary: primaryImage === "x" });
  if (socialImages.linkedin) sources.push({ platform: "linkedin", url: socialImages.linkedin, isPrimary: primaryImage === "linkedin" });
  if (socialImages.custom) sources.push({ platform: "custom", url: socialImages.custom, isPrimary: primaryImage === "custom" });

  // If no social images but we have an avatarUrl, use that
  if (sources.length === 0 && avatarUrl) {
    sources.push({ platform: "profile", url: avatarUrl, isPrimary: true });
  }

  // Fallback: auto-generate URLs from username
  if (sources.length === 0 && username) {
    sources.push({ platform: "github", url: `https://avatars.githubusercontent.com/${username}?s=400`, isPrimary: true });
  }

  const primaryUrl = avatarUrl || sources.find(s => s.isPrimary)?.url || sources[0]?.url;

  // Save portrait to DB when first rendered client-side
  const handlePortraitRendered = useCallback(async (result: RenderedResult) => {
    if (!userProfile?._id || !user?.id) return;
    try {
      await savePortrait({
        profileId: userProfile._id,
        clerkId: user.id,
        portrait: {
          lines: result.lines,
          coloredLines: result.coloredLines,
          cols: result.cols,
          rows: result.rows,
          format: result.format,
          sourceUrl: result.sourceUrl,
        },
      });
    } catch {
      // Fail silently — portrait will regenerate next time
    }
  }, [userProfile?._id, user?.id, savePortrait]);

  // Handle selecting a different primary image
  const handleSelectPrimary = useCallback(async (platform: string) => {
    if (!userProfile?._id || !user?.id) return;
    setSaving(true);
    try {
      await setProfileImages({
        profileId: userProfile._id,
        clerkId: user.id,
        socialImages: {
          x: socialImages.x,
          github: socialImages.github,
          linkedin: socialImages.linkedin,
          custom: socialImages.custom,
        },
        primaryImage: platform,
      });
    } catch {
      // fail silently
    }
    setSaving(false);
  }, [userProfile?._id, user?.id, socialImages, setProfileImages]);

  // Handle custom image upload
  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userProfile?._id || !user?.id) return;

    setUploading(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("failed to read file"));
        reader.readAsDataURL(file);
      });

      // Show preview immediately
      setUploadPreview(dataUrl);

      // Save to profile
      await setProfileImages({
        profileId: userProfile._id,
        clerkId: user.id,
        socialImages: {
          x: socialImages.x,
          github: socialImages.github,
          linkedin: socialImages.linkedin,
          custom: dataUrl,
        },
        primaryImage: "custom",
      });
    } catch {
      // fail silently, clear preview
      setUploadPreview(null);
    }
    setUploading(false);

    // Reset file input so the same file can be re-selected
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [userProfile?._id, user?.id, socialImages, setProfileImages]);

  // Handle PNG export
  const handleDownloadPng = useCallback(() => {
    if (!portraitContainerRef.current) return;

    const canvas = portraitContainerRef.current.querySelector("canvas") as HTMLCanvasElement | null;
    if (!canvas) return;

    try {
      const dataUrl = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `${username}-portrait.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {
      // Canvas may be tainted by cross-origin images
    }
  }, [username]);

  return (
    <div className="h-full overflow-y-auto">
      <PaneHeader>portrait</PaneHeader>

      <div className="px-6 py-6 space-y-0 max-w-xl">
        {/* Primary portrait -- large ASCII */}
        <SectionLabel>current portrait -- @{username}</SectionLabel>
        {primaryUrl ? (
          <div
            ref={portraitContainerRef}
            className="border border-[hsl(var(--border))] bg-[hsl(var(--bg-raised))] p-2 mb-2 overflow-hidden"
            style={{ borderRadius: "2px" }}
          >
            <AsciiAvatar
              src={primaryUrl}
              cols={cols}
              canvasWidth={Math.min(500, cols * 4)}
              format={format}
              className="w-full"
              preRendered={portraitMatchesSettings ? storedPortrait : undefined}
              onRendered={handlePortraitRendered}
            />
          </div>
        ) : (
          <div
            ref={portraitContainerRef}
            className="border border-[hsl(var(--border))] bg-[hsl(var(--bg-raised))] p-6 mb-2 text-center"
            style={{ borderRadius: "2px" }}
          >
            <p className="font-mono text-[12px] text-[hsl(var(--text-secondary))] opacity-40">
              no portrait source yet.
            </p>
            <p className="font-mono text-[10px] text-[hsl(var(--text-secondary))] opacity-25 mt-1">
              add your x or github username to generate one.
            </p>
          </div>
        )}

        {/* Download as PNG */}
        {primaryUrl && (
          <button
            onClick={handleDownloadPng}
            className="w-full border border-[hsl(var(--border))] bg-[hsl(var(--bg-raised))] py-2 px-3 font-mono text-[11px] text-[hsl(var(--text-secondary))] opacity-60 hover:opacity-90 hover:border-[hsl(var(--accent))]/40 transition-all mb-2"
            style={{ borderRadius: "2px" }}
          >
            &gt; download as .png
          </button>
        )}

        <Divider />

        {/* Format picker */}
        <SectionLabel>format</SectionLabel>
        <div className="grid grid-cols-4 gap-1.5 mb-3">
          {FORMAT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFormat(opt.value)}
              className={`border p-2 font-mono text-[10px] text-center transition-colors ${
                format === opt.value
                  ? "border-[hsl(var(--accent))]/60 bg-[hsl(var(--accent-wash))] text-[hsl(var(--accent))]"
                  : "border-[hsl(var(--border))] bg-[hsl(var(--bg-raised))] text-[hsl(var(--text-secondary))] opacity-60 hover:opacity-80"
              }`}
              style={{ borderRadius: "2px" }}
            >
              <span className="block text-[14px] mb-0.5">{opt.desc.slice(0, 4)}</span>
              {opt.label}
            </button>
          ))}
        </div>

        {/* Detail level picker */}
        <SectionLabel>detail (columns)</SectionLabel>
        <div className="flex gap-1.5 mb-3">
          {DETAIL_PRESETS.map((p) => (
            <button
              key={p.value}
              onClick={() => setCols(p.value)}
              className={`flex-1 border py-1.5 font-mono text-[11px] text-center transition-colors ${
                cols === p.value
                  ? "border-[hsl(var(--accent))]/60 bg-[hsl(var(--accent-wash))] text-[hsl(var(--accent))]"
                  : "border-[hsl(var(--border))] bg-[hsl(var(--bg-raised))] text-[hsl(var(--text-secondary))] opacity-60 hover:opacity-80"
              }`}
              style={{ borderRadius: "2px" }}
            >
              {p.label}
            </button>
          ))}
        </div>

        <Divider />

        {/* All source images -- tap to select */}
        <SectionLabel>
          source images{sources.length > 1 ? ` (${sources.length})` : ""} -- tap to select
        </SectionLabel>
        <div className="grid grid-cols-2 gap-2.5 mb-2">
          {sources.map((src) => (
            <button
              key={src.platform}
              onClick={() => handleSelectPrimary(src.platform)}
              disabled={saving}
              className={`border overflow-hidden text-left transition-all ${
                src.isPrimary
                  ? "border-[hsl(var(--accent))]/50 bg-[hsl(var(--accent-wash))] ring-1 ring-[hsl(var(--accent))]/20"
                  : "border-[hsl(var(--border))] bg-[hsl(var(--bg-raised))] hover:border-[hsl(var(--text-secondary))]/30"
              }`}
              style={{ borderRadius: "2px" }}
            >
              {/* Real photo preview */}
              <div className="relative overflow-hidden bg-black/20" style={{ aspectRatio: "1" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src.url}
                  alt=""
                  className="w-full h-full object-cover"
                  style={{ filter: src.isPrimary ? "none" : "grayscale(0.5) brightness(0.8)" }}
                  onError={(e) => {
                    const img = e.target as HTMLImageElement;
                    if (img.crossOrigin) { img.crossOrigin = ""; img.src = src.url; }
                  }}
                />
                {src.isPrimary && (
                  <div className="absolute top-1.5 right-1.5">
                    <span className="font-mono text-[8px] bg-[hsl(var(--accent))] text-white px-1.5 py-0.5 uppercase tracking-wider">
                      primary
                    </span>
                  </div>
                )}
              </div>

              {/* ASCII preview below photo */}
              <div className="p-1.5 border-t border-[hsl(var(--border))]/50">
                <AsciiAvatar
                  src={src.url}
                  cols={40}
                  canvasWidth={160}
                  format={format}
                  className="w-full"
                />
              </div>

              {/* Platform label */}
              <div className="flex items-center gap-1.5 px-2 py-1.5 border-t border-[hsl(var(--border))]/30">
                <span className="font-mono text-[10px] text-[hsl(var(--text-secondary))] opacity-60">
                  {src.platform}
                </span>
              </div>
            </button>
          ))}
        </div>

        <Divider />

        {/* Upload custom image */}
        <SectionLabel>upload custom</SectionLabel>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || !userProfile?._id || !user?.id}
          className="w-full border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--bg-raised))] py-4 px-3 font-mono text-[11px] text-[hsl(var(--text-secondary))] opacity-50 hover:opacity-80 hover:border-[hsl(var(--accent))]/40 transition-all disabled:opacity-20 disabled:cursor-not-allowed"
          style={{ borderRadius: "2px" }}
        >
          {uploading ? "uploading..." : "> select image file"}
        </button>

        {/* Upload preview */}
        {(uploadPreview || socialImages.custom) && (
          <div
            className="mt-2 border border-[hsl(var(--border))] bg-[hsl(var(--bg-raised))] p-2 overflow-hidden"
            style={{ borderRadius: "2px" }}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="font-mono text-[9px] text-[hsl(var(--text-secondary))] opacity-40 uppercase tracking-wider">
                custom upload preview
              </span>
              {primaryImage === "custom" && (
                <span className="font-mono text-[8px] bg-[hsl(var(--accent))] text-white px-1.5 py-0.5 uppercase tracking-wider">
                  active
                </span>
              )}
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={uploadPreview || socialImages.custom}
              alt=""
              className="w-full max-h-48 object-contain opacity-70"
              style={{ borderRadius: "2px" }}
            />
          </div>
        )}

        <Divider />

        {/* Settings summary */}
        <SectionLabel>settings</SectionLabel>
        <div
          className="border border-[hsl(var(--border))] p-3 bg-[hsl(var(--bg-raised))] space-y-2"
          style={{ borderRadius: "2px" }}
        >
          {[
            { label: "format", value: format },
            { label: "detail", value: `${cols} columns` },
            { label: "characters", value: RAMPS_SHORT[format] },
            { label: "source", value: primaryUrl ? (primaryImage || "auto-detected") : "none" },
            { label: "sources available", value: String(sources.length) },
            { label: "cached", value: storedPortrait ? "yes" : "no" },
          ].map((s) => (
            <div key={s.label} className="flex items-center justify-between font-mono text-[11px]">
              <span className="text-[hsl(var(--text-secondary))] opacity-60">{s.label}</span>
              <span className="text-[hsl(var(--text-primary))] opacity-70">{s.value}</span>
            </div>
          ))}
        </div>

        <Divider />

        {/* Regenerate instructions */}
        <SectionLabel>regenerate</SectionLabel>
        <div
          className="border border-[hsl(var(--border))] p-3 bg-[hsl(var(--bg-raised))]"
          style={{ borderRadius: "2px" }}
        >
          <p className="font-mono text-[10px] text-[hsl(var(--text-secondary))] opacity-50">
            regenerate via terminal or add more source images:
          </p>
          <div className="mt-2 space-y-1.5">
            {[
              "/portrait --regenerate",
              "scrape my x profile photo",
              "pull my github avatar",
              "pull my linkedin photo",
            ].map((cmd) => (
              <button
                key={cmd}
                onClick={() => navigator.clipboard.writeText(cmd)}
                className="block w-full text-left font-mono text-[11px] text-[hsl(var(--accent))] opacity-60 hover:opacity-90 transition-opacity"
              >
                &gt; {cmd}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Short ramp labels for settings display
const RAMPS_SHORT: Record<AsciiFormat, string> = {
  classic: "$@B%8&#*oahkbd...",
  braille: "\u28FF\u28F7\u28F6\u28E6\u28E4\u2884\u2880\u2840\u2800",
  block: "\u2588\u2593\u2592\u2591 ",
  minimal: "@%#*+=-:.",
};
