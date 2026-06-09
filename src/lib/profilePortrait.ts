import type { PreRenderedPortrait } from "@/components/AsciiAvatar";

export function hasRenderableAsciiPortrait(value: unknown): value is PreRenderedPortrait {
  if (!value || typeof value !== "object") return false;
  const portrait = value as Partial<PreRenderedPortrait>;
  if (!Array.isArray(portrait.lines) || portrait.lines.length === 0) return false;
  return portrait.lines.some((line) => typeof line === "string" && line.trim().length > 0);
}

export function profileInitials(name: string | null | undefined, username: string): string {
  const base = (name || username || "you").trim();
  const words = base.split(/\s+/).filter(Boolean);
  if (words.length >= 2) return `${words[0][0]}${words[1][0]}`.toUpperCase();
  return base.slice(0, 2).toUpperCase();
}
