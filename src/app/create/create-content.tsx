"use client";

import { useState, useEffect, useRef, useCallback, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import Link from "next/link";
import { TerminalHeader } from "@/components/terminal/TerminalHeader";
import { TerminalAuthInput } from "@/components/terminal/TerminalAuthInput";

type Phase = "boot" | "username" | "name" | "links" | "creating" | "done" | "error";

export function CreateContent() {
  const router = useRouter();
  const createProfile = useMutation(api.profiles.createProfile);

  const [phase, setPhase] = useState<Phase>("boot");
  const [lines, setLines] = useState<{ id: string; content: ReactNode; className?: string }[]>([]);
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const lineCounter = useRef(0);

  const addLine = useCallback((content: ReactNode, className?: string) => {
    const id = `l${lineCounter.current++}`;
    setLines((prev) => [...prev, { id, content, className }]);
  }, []);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [lines, phase]);

  // Boot sequence
  useEffect(() => {
    const timers = [
      setTimeout(() => addLine("you.md v0.1.0", "text-[hsl(var(--accent))]"), 200),
      setTimeout(() => addLine("identity context protocol for the agent internet", "text-[hsl(var(--text-secondary))] opacity-60"), 500),
      setTimeout(() => addLine("\u00A0"), 700),
      setTimeout(() => addLine("no account needed — just pick a username to start.", "text-[hsl(var(--text-secondary))] opacity-50"), 900),
      setTimeout(() => addLine("\u00A0"), 1100),
      setTimeout(() => setPhase("username"), 1300),
    ];
    return () => timers.forEach(clearTimeout);
  }, [addLine]);

  // Username handler
  const handleUsername = useCallback(async (val: string) => {
    // TODO: Add Cloudflare Turnstile before public launch to prevent username squatting
    const clean = val.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 30);
    if (!clean || clean.length < 3) {
      addLine(
        <span className="text-[hsl(var(--accent))]">
          ERR: username must be at least 3 characters
        </span>
      );
      return;
    }

    addLine(
      <span>
        <span className="text-[hsl(var(--accent))]">username:</span>{" "}
        <span className="text-[hsl(var(--text-secondary))]">{clean}</span>
      </span>
    );

    setUsername(clean);
    addLine("\u00A0");
    setTimeout(() => setPhase("name"), 300);
  }, [addLine]);

  // Name handler
  const handleName = useCallback(async (val: string) => {
    addLine(
      <span>
        <span className="text-[hsl(var(--accent))]">name:</span>{" "}
        <span className="text-[hsl(var(--text-secondary))]">{val}</span>
      </span>
    );

    setName(val);
    addLine("\u00A0");

    // Create the profile
    setPhase("creating");
    addLine("creating @" + username + "...", "text-[hsl(var(--text-secondary))] opacity-50");

    try {
      const result = await createProfile({
        username,
        name: val,
      });

      addLine(
        <span>
          <span className="text-[hsl(var(--success))]">{"\u2713"}</span>{" "}
          @<span className="text-[hsl(var(--accent))]">{username}</span> {"\u2014"} created
        </span>
      );
      addLine("\u00A0");

      // Show the magic moment
      addLine(
        <span className="text-[hsl(var(--text-secondary))]">
          your profile is live at{" "}
          <span className="text-[hsl(var(--accent))]">you.md/{username}</span>
        </span>
      );
      addLine("\u00A0");

      // Store session token in cookie for future editing
      if (result.sessionToken) {
        document.cookie = `youmd_session=${result.sessionToken};path=/;max-age=604800;samesite=lax`;
      }

      addLine(
        <span className="text-[hsl(var(--text-secondary))] opacity-60">
          {"\u2192"} sign up anytime to claim ownership and unlock private features
        </span>
      );
      addLine("\u00A0");

      setPhase("done");

      // Redirect to profile after a delay
      setTimeout(() => router.push(`/${username}`), 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "failed to create profile";
      addLine(
        <span className="text-[hsl(var(--accent))]">ERR: {msg}</span>
      );
      addLine("\u00A0");
      setPhase("username");
    }
  }, [username, createProfile, router, addLine]);

  return (
    <div className="min-h-[100dvh] bg-[hsl(var(--bg))] flex items-center justify-center p-4">
      <div className="w-full max-w-3xl">
        {/* Terminal panel */}
        <div
          className="bg-[hsl(var(--bg-raised))] border border-[hsl(var(--border))] overflow-hidden"
          style={{ borderRadius: "8px" }}
        >
          <TerminalHeader title="you.md — create" />

          {/* Terminal body */}
          <div
            ref={scrollRef}
            className="p-6 md:p-8 min-h-[400px] max-h-[60dvh] overflow-y-auto font-mono text-[14px] leading-relaxed"
          >
            {/* Rendered lines */}
            {lines.map((line) => (
              <div key={line.id} className={line.className || ""}>
                {line.content || "\u00A0"}
              </div>
            ))}

            {/* Active input */}
            {phase === "username" && (
              <div className="mt-2">
                <div className="text-[hsl(var(--text-secondary))] opacity-50 text-[13px] mb-1">
                  choose a username
                </div>
                <TerminalAuthInput
                  prompt=">"
                  placeholder="username"
                  onSubmit={handleUsername}
                />
              </div>
            )}

            {phase === "name" && (
              <div className="mt-2">
                <div className="text-[hsl(var(--text-secondary))] opacity-50 text-[13px] mb-1">
                  what should we call you?
                </div>
                <TerminalAuthInput
                  prompt=">"
                  placeholder="your name"
                  onSubmit={handleName}
                />
              </div>
            )}

            {phase === "creating" && (
              <div className="text-[hsl(var(--accent-mid))] animate-pulse mt-1">
                {"\u25CC"} creating...
              </div>
            )}

            {phase === "done" && (
              <div className="text-[hsl(var(--text-secondary))] opacity-50 animate-pulse mt-1">
                {"\u25CC"} redirecting to your profile...
              </div>
            )}
          </div>
        </div>

        {/* Links below terminal */}
        <div className="mt-4 flex items-center justify-center gap-4">
          <span className="font-mono text-[12px] text-[hsl(var(--text-secondary))] opacity-40">
            already have an account?{" "}
            <Link
              href="/sign-in"
              className="text-[hsl(var(--accent))] opacity-70 hover:opacity-100 transition-opacity"
            >
              sign in
            </Link>
          </span>
        </div>
      </div>
    </div>
  );
}
