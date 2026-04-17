"use client";

import Link from "next/link";
import { TerminalHeader } from "@/components/terminal/TerminalHeader";

export default function ResetPasswordContent() {
  return (
    <main className="h-[100dvh] bg-[hsl(var(--bg))] flex flex-col">
      <div className="flex-1 flex flex-col max-w-3xl mx-auto w-full p-4 min-h-0">
        <div
          className="flex-1 flex flex-col bg-[hsl(var(--bg-raised))] border border-[hsl(var(--border))] overflow-hidden min-h-0"
          style={{ borderRadius: "2px" }}
        >
          <TerminalHeader title="you.md — auth" asHeading />
          <div className="flex-1 overflow-y-auto p-5 font-mono text-[14px] leading-relaxed text-[hsl(var(--text-secondary))]">
            <div className="text-[hsl(var(--accent))]">password reset retired</div>
            <div className="mt-3 opacity-70">
              you.md is moving to passwordless auth. use an email code instead.
            </div>
            <div className="mt-6">
              <Link
                href="/sign-in"
                className="text-[hsl(var(--accent))] hover:opacity-100 opacity-80 transition-opacity"
              >
                &gt; go to sign in
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
