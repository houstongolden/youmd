import Link from "next/link";
import { TerminalHeader } from "@/components/terminal/TerminalHeader";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[hsl(var(--bg))] flex items-center justify-center p-4">
      <div className="w-full max-w-xl">
        <div
          className="bg-[hsl(var(--bg-raised))] border border-[hsl(var(--border))] overflow-hidden"
          style={{ borderRadius: "8px" }}
        >
          <TerminalHeader title="you.md — error" />

          <div className="p-6 md:p-8 font-mono text-[14px] leading-relaxed space-y-1">
            <p className="text-[hsl(var(--text-secondary))] opacity-60">
              navigating...
            </p>
            <p className="text-[hsl(var(--accent))]">
              404: page not found
            </p>
            <p>&nbsp;</p>
            <p className="text-[hsl(var(--text-secondary))] opacity-40 text-[13px]">
              the page you are looking for does not exist. if you were looking
              for a profile, the username may not have been claimed yet.
            </p>
            <p>&nbsp;</p>
            <div className="border-t border-[hsl(var(--border))] pt-3 mt-3 space-y-1.5">
              <Link
                href="/"
                className="block text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--accent))] transition-colors"
              >
                &gt; cd /home
              </Link>
              <Link
                href="/sign-up"
                className="block text-[hsl(var(--accent))] hover:text-[hsl(var(--accent-light))] transition-colors"
              >
                &gt; initialize
              </Link>
              <Link
                href="/sign-in"
                className="block text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--accent))] transition-colors"
              >
                &gt; authenticate
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
