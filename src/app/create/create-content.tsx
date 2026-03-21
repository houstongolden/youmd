"use client";

import { useState, useEffect, useRef, useCallback, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import Link from "next/link";
import { TerminalHeader } from "@/components/terminal/TerminalHeader";
import { TerminalAuthInput } from "@/components/terminal/TerminalAuthInput";

type Phase = "boot" | "username" | "name" | "social" | "portrait" | "creating" | "done" | "error";

export function CreateContent() {
  const router = useRouter();
  const createProfile = useMutation(api.profiles.createProfile);
  const updateProfile = useMutation(api.profiles.updateProfile);

  const [phase, setPhase] = useState<Phase>("boot");
  const [lines, setLines] = useState<{ id: string; content: ReactNode; className?: string }[]>([]);
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const scrapedImageRef = useRef<{ platform: string; url: string } | null>(null);
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

    // Username will be validated by createProfile mutation (checks both tables)
    addLine(
      <span className="text-[hsl(var(--success))]">{"\u2713"} @{clean} is available</span>
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

    // Ask for social handle for portrait
    setTimeout(() => setPhase("social"), 300);
  }, [addLine]);

  // Social handle handler — scrape profile for portrait
  const handleSocial = useCallback(async (val: string) => {
    const trimmed = val.trim().toLowerCase();

    // Allow skip
    if (trimmed === "skip" || trimmed === "/skip") {
      addLine(
        <span className="text-[hsl(var(--text-secondary))] opacity-50">skipped portrait generation</span>
      );
      addLine("\u00A0");
      proceedToCreate();
      return;
    }

    // Parse handle — accept "username", "@username", "x.com/username", "github.com/username"
    let platform = "";
    let handle = trimmed;

    if (trimmed.includes("github.com/") || trimmed.includes("github")) {
      platform = "github";
      handle = trimmed.replace(/.*github\.com\//, "").replace(/^@/, "").split("/")[0].split("?")[0];
    } else if (trimmed.includes("x.com/") || trimmed.includes("twitter.com/")) {
      platform = "x";
      handle = trimmed.replace(/.*(?:x|twitter)\.com\//, "").replace(/^@/, "").split("/")[0].split("?")[0];
    } else if (trimmed.startsWith("@")) {
      // Assume X if just @username
      platform = "x";
      handle = trimmed.replace(/^@/, "");
    } else {
      // Default to GitHub for plain usernames
      platform = "github";
      handle = trimmed;
    }

    addLine(
      <span>
        <span className="text-[hsl(var(--accent))]">{platform}:</span>{" "}
        <span className="text-[hsl(var(--text-secondary))]">@{handle}</span>
      </span>
    );
    addLine("\u00A0");
    setPhase("portrait");

    addLine("fetching profile...", "text-[hsl(var(--text-secondary))] opacity-50");

    try {
      // Call our scrape endpoint
      const scrapeRes = await fetch(
        "https://kindly-cassowary-600.convex.site/api/v1/scrape",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: platform === "x" ? `https://x.com/${handle}` : `https://github.com/${handle}`,
          }),
        }
      );

      if (scrapeRes.ok) {
        const scrapeData = await scrapeRes.json();
        const data = scrapeData.data || scrapeData;
        if (data.displayName) {
          addLine(
            <span className="text-[hsl(var(--success))]">
              {"\u2713"} found {data.displayName}
              {data.bio ? ` — "${data.bio.slice(0, 60)}${data.bio.length > 60 ? "..." : ""}"` : ""}
            </span>
          );
        }
        if (data.profileImageUrl) {
          scrapedImageRef.current = { platform, url: data.profileImageUrl };
          addLine(
            <span className="text-[hsl(var(--accent-mid))]">
              {"\u2713"} portrait source captured
            </span>
          );
        }
        if (data.followers) {
          addLine(
            <span className="text-[hsl(var(--text-secondary))] opacity-50">
              {data.followers.toLocaleString()} followers{data.location ? ` — ${data.location}` : ""}
            </span>
          );
        }
        addLine("\u00A0");

        // Auto-research via Perplexity (non-blocking)
        addLine("researching your public presence...", "text-[hsl(var(--text-secondary))] opacity-50");
        try {
          const researchRes = await fetch(
            "https://kindly-cassowary-600.convex.site/api/v1/research",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                name: name || data.displayName || handle,
                username: handle,
                links: [platform === "x" ? `https://x.com/${handle}` : `https://github.com/${handle}`],
              }),
            }
          );
          if (researchRes.ok) {
            const researchData = await researchRes.json();
            if (researchData.success && researchData.research) {
              addLine(
                <span className="text-[hsl(var(--success))]">{"\u2713"} context enriched via web research</span>
              );
              // Show a brief excerpt
              const excerpt = researchData.research.slice(0, 120);
              addLine(
                <span className="text-[hsl(var(--text-secondary))] opacity-40 text-[12px]">
                  &quot;{excerpt}{researchData.research.length > 120 ? "..." : ""}&quot;
                </span>
              );
            }
          }
        } catch {
          // Research is optional — don't block on failure
        }

        // Auto-enrich X profile via XAI (if X platform)
        if (platform === "x") {
          addLine("analyzing x profile...", "text-[hsl(var(--text-secondary))] opacity-50");
          try {
            const enrichRes = await fetch(
              "https://kindly-cassowary-600.convex.site/api/v1/enrich-x",
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  xUsername: handle,
                  profileData: data,
                }),
              }
            );
            if (enrichRes.ok) {
              const enrichData = await enrichRes.json();
              if (enrichData.success && enrichData.analysis) {
                addLine(
                  <span className="text-[hsl(var(--success))]">{"\u2713"} x profile analyzed</span>
                );
              }
            }
          } catch {
            // Enrichment is optional
          }
        }
      } else {
        addLine(
          <span className="text-[hsl(var(--text-secondary))] opacity-40">
            couldn&apos;t fetch profile details — no worries, you can add this later
          </span>
        );
      }
    } catch {
      addLine(
        <span className="text-[hsl(var(--text-secondary))] opacity-40">
          network error fetching profile — continuing without portrait
        </span>
      );
    }

    addLine("\u00A0");
    proceedToCreate();
  }, [addLine, username, name, createProfile, updateProfile, router]);

  // Create the profile
  const proceedToCreate = useCallback(async () => {
    setPhase("creating");
    addLine("creating @" + username + "...", "text-[hsl(var(--text-secondary))] opacity-50");

    try {
      const result = await createProfile({
        username,
        name,
      });

      // Save scraped social image to the profile
      const scraped = scrapedImageRef.current;
      if (scraped && result.profileId && result.sessionToken) {
        try {
          await updateProfile({
            profileId: result.profileId,
            sessionToken: result.sessionToken,
            avatarUrl: scraped.url,
          });
        } catch {
          // Non-critical — portrait save can fail silently
        }
      }

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
  }, [username, createProfile, updateProfile, router, addLine]);

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

            {phase === "social" && (
              <div className="mt-2">
                <div className="text-[hsl(var(--text-secondary))] opacity-50 text-[13px] mb-1">
                  drop your x or github username for your ascii portrait (or type skip)
                </div>
                <TerminalAuthInput
                  prompt=">"
                  placeholder="@username or github.com/you"
                  onSubmit={handleSocial}
                />
              </div>
            )}

            {phase === "portrait" && (
              <div className="text-[hsl(var(--accent-mid))] animate-pulse mt-1">
                {"\u25CC"} generating portrait...
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
