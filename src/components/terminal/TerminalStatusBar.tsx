"use client";

import { SignOutButton } from "@clerk/nextjs";
import Link from "next/link";
import PixelYOU from "@/components/PixelYOU";

interface TerminalStatusBarProps {
  username: string;
  plan: string;
  version: number | null;
  isPublished: boolean;
}

export function TerminalStatusBar({
  username,
  plan,
  version,
  isPublished,
}: TerminalStatusBarProps) {
  return (
    <nav className="flex items-center justify-between px-4 py-2.5 border-b border-[hsl(var(--border))] bg-[hsl(var(--bg))] shrink-0">
      <Link href="/" className="inline-block">
        <PixelYOU />
      </Link>
      <div className="flex items-center gap-3 text-xs font-mono text-[hsl(var(--text-secondary))]">
        <span className="text-[hsl(var(--text-primary))]">@{username}</span>
        <span className="text-[hsl(var(--border))]">|</span>
        <span className={plan === "pro" ? "text-[hsl(var(--accent))]" : ""}>
          {plan}
        </span>
        <span className="text-[hsl(var(--border))]">|</span>
        <span>{version !== null ? `v${version}` : "no bundle"}</span>
        <span className="text-[hsl(var(--border))]">|</span>
        <span
          className={
            isPublished
              ? "text-[hsl(var(--success))]"
              : "text-[hsl(var(--accent))]"
          }
        >
          {isPublished ? "published" : "draft"}
        </span>
        <span className="text-[hsl(var(--border))]">|</span>
        <SignOutButton>
          <button className="text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))] transition-colors">
            sign out
          </button>
        </SignOutButton>
      </div>
    </nav>
  );
}
