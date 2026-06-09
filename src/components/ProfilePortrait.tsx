"use client";

import { useState } from "react";
import AsciiAvatar, { type PreRenderedPortrait } from "@/components/AsciiAvatar";
import { hasRenderableAsciiPortrait, profileInitials } from "@/lib/profilePortrait";

interface ProfilePortraitProps {
  username: string;
  name?: string | null;
  avatarUrl?: string | null;
  asciiPortrait?: PreRenderedPortrait | null;
  className?: string;
  cols?: number;
  canvasWidth?: number;
  showPhotoOnHover?: boolean;
}

function TerminalPortraitFallback({
  username,
  name,
}: {
  username: string;
  name?: string | null;
}) {
  const initials = profileInitials(name, username);

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden bg-[hsl(var(--accent))]/[0.035]">
      <div className="absolute inset-x-2 top-2 h-px bg-[hsl(var(--accent))]/15" />
      <div className="absolute inset-x-4 bottom-2 h-px bg-[hsl(var(--accent))]/10" />
      <div className="absolute left-2 top-4 h-1 w-1 border border-[hsl(var(--accent))]/20" />
      <div className="absolute bottom-4 right-2 h-1 w-1 border border-[hsl(var(--accent))]/20" />
      <span className="font-mono text-[13px] leading-none text-[hsl(var(--accent))]/75">
        {initials}
      </span>
      <span className="mt-1 max-w-full truncate px-1 font-mono text-[6px] uppercase tracking-[0.18em] text-[hsl(var(--text-secondary))]/35">
        ascii pending
      </span>
    </div>
  );
}

export default function ProfilePortrait({
  username,
  name,
  avatarUrl,
  asciiPortrait,
  className = "",
  cols = 34,
  canvasWidth = 56,
  showPhotoOnHover = false,
}: ProfilePortraitProps) {
  const [photoFailed, setPhotoFailed] = useState(false);
  const portrait = hasRenderableAsciiPortrait(asciiPortrait) ? asciiPortrait : null;
  const src = avatarUrl?.trim() || portrait?.sourceUrl?.trim() || "";
  const fallback = <TerminalPortraitFallback username={username} name={name} />;

  return (
    <div
      className={`${className} relative shrink-0 overflow-hidden border border-[hsl(var(--border))] bg-[hsl(var(--bg))] transition-colors group-hover:border-[hsl(var(--accent))]/30`}
      style={{ borderRadius: "2px" }}
      aria-label={`${name || username} profile portrait`}
      role="img"
    >
      {portrait ? (
        <AsciiAvatar
          src={portrait.sourceUrl || src || ""}
          cols={cols}
          canvasWidth={canvasWidth}
          className="flex h-full w-full items-center justify-center"
          showLoadingText={false}
          preRendered={portrait}
          fallback={fallback}
        />
      ) : src ? (
        <AsciiAvatar
          src={src}
          cols={cols}
          canvasWidth={canvasWidth}
          className="flex h-full w-full items-center justify-center"
          showLoadingText={false}
          fallback={fallback}
        />
      ) : (
        fallback
      )}

      {showPhotoOnHover && avatarUrl && !photoFailed && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-200 group-hover:opacity-100"
          loading="lazy"
          onError={() => setPhotoFailed(true)}
        />
      )}
    </div>
  );
}
