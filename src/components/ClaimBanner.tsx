"use client";

import Link from "next/link";

interface ClaimBannerProps {
  username: string;
}

export function ClaimBanner({ username }: ClaimBannerProps) {
  return (
    <div className="border-b border-[hsl(var(--accent))]/20 bg-[hsl(var(--accent-wash))] px-6 py-3">
      <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
        <p className="font-mono text-[12px] text-[hsl(var(--accent-mid))]">
          &gt; this identity is unclaimed. if this is you, sign up to own it.
        </p>
        <Link
          href="/sign-up"
          className="font-mono text-[11px] text-[hsl(var(--accent))] hover:text-[hsl(var(--accent-light))] transition-colors shrink-0"
        >
          claim @{username} {"\u2192"}
        </Link>
      </div>
    </div>
  );
}
