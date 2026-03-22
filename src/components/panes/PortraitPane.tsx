"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import AsciiAvatar from "@/components/AsciiAvatar";
import { PaneSectionLabel as SectionLabel, PaneDivider as Divider, PaneHeader } from "./shared";
import { CopyableCommand } from "./CopyableCommand";

interface PortraitPaneProps {
  username: string;
  ownerId?: Id<"users">;
}

export function PortraitPane({ username, ownerId }: PortraitPaneProps) {
  const userProfile = useQuery(
    api.profiles.getByOwnerId,
    ownerId ? { ownerId } : "skip"
  );

  const avatarUrl = userProfile?.avatarUrl;
  const socialImages = (userProfile?.socialImages as Record<string, string | undefined>) || {};
  const primaryImage = (userProfile?.primaryImage as string) || "";

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

  return (
    <div className="h-full overflow-y-auto">
      <PaneHeader>portrait</PaneHeader>

      <div className="px-6 py-6 space-y-0 max-w-xl">
        {/* Primary portrait */}
        <SectionLabel>current portrait -- @{username}</SectionLabel>
        {avatarUrl ? (
          <div
            className="border border-[hsl(var(--border))] bg-[hsl(var(--bg-raised))] p-2 mb-2 overflow-hidden"
            style={{ borderRadius: "2px" }}
          >
            <AsciiAvatar src={avatarUrl} cols={80} canvasWidth={400} className="w-full" />
          </div>
        ) : (
          <div
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

        <Divider />

        {/* All social portraits */}
        {sources.length > 1 && (
          <>
            <SectionLabel>all portraits</SectionLabel>
            <div className="grid grid-cols-2 gap-2 mb-2">
              {sources.map((src) => (
                <div
                  key={src.platform}
                  className={`border p-2 overflow-hidden ${
                    src.isPrimary
                      ? "border-[hsl(var(--accent))]/40 bg-[hsl(var(--accent-wash))]"
                      : "border-[hsl(var(--border))] bg-[hsl(var(--bg-raised))]"
                  }`}
                  style={{ borderRadius: "2px" }}
                >
                  <AsciiAvatar src={src.url} cols={40} canvasWidth={180} className="w-full" />
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-1.5">
                      <img
                        src={`https://www.google.com/s2/favicons?domain=${src.platform === "x" ? "x.com" : src.platform === "github" ? "github.com" : src.platform === "linkedin" ? "linkedin.com" : "you.md"}&sz=16`}
                        alt=""
                        width={12}
                        height={12}
                        className="shrink-0"
                      />
                      <span className="font-mono text-[10px] text-[hsl(var(--text-secondary))] opacity-60">
                        {src.platform}
                      </span>
                    </div>
                    {src.isPrimary && (
                      <span className="font-mono text-[8px] text-[hsl(var(--accent))] uppercase tracking-wider">
                        primary
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <Divider />
          </>
        )}

        {/* Settings */}
        <SectionLabel>settings</SectionLabel>
        <div
          className="border border-[hsl(var(--border))] p-3 bg-[hsl(var(--bg-raised))] space-y-2"
          style={{ borderRadius: "2px" }}
        >
          {[
            { label: "style", value: "block · 80 col" },
            { label: "detail level", value: "high" },
            { label: "characters", value: "$@B%8&#*oahkbd..." },
            { label: "source", value: avatarUrl ? (primaryImage || "profile image") : "none" },
            { label: "sources available", value: String(sources.length) },
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
            regenerate your portrait via terminal:
          </p>
          <div className="mt-2 space-y-1">
            <CopyableCommand command="/portrait --regenerate" />
            <CopyableCommand command="scrape my x profile photo and regenerate" dimmed />
            <CopyableCommand command="pull my github avatar and make it primary" dimmed />
          </div>
        </div>
      </div>
    </div>
  );
}
