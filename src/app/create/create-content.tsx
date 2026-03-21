"use client";

import { useState, useEffect, useRef, useCallback, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { TerminalHeader } from "@/components/terminal/TerminalHeader";
import { TerminalAuthInput } from "@/components/terminal/TerminalAuthInput";
import { useKeyboardHeight } from "@/hooks/useKeyboardHeight";

// Direct Convex HTTP client — bypasses Clerk auth for unauthenticated profile creation
const CONVEX_URL = "https://kindly-cassowary-600.convex.cloud";

async function callConvexMutation(name: string, args: Record<string, unknown>) {
  const res = await fetch(`${CONVEX_URL}/api/mutation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: name, args }),
  });
  const data = await res.json();
  if (data.status === "error") {
    throw new Error(data.errorMessage || "mutation failed");
  }
  return data.value;
}

type Phase = "boot" | "username" | "name" | "social" | "portrait" | "creating" | "done" | "error";

export function CreateContent() {
  const router = useRouter();

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
      setTimeout(() => addLine("choose a username.", "text-[hsl(var(--text-secondary))] opacity-70"), 1200),
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
    addLine("what should we call you?", "text-[hsl(var(--text-secondary))] opacity-70");
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

    // Agent asks for social handle
    addLine("drop your x or github username so i can generate your ascii portrait.", "text-[hsl(var(--text-secondary))] opacity-70");
    addLine("type skip if you don't have one.", "text-[hsl(var(--text-secondary))] opacity-40");
    setTimeout(() => setPhase("social"), 300);
  }, [addLine]);

  // --- Social parsing helpers ---

  // Extract username-like tokens from natural language input
  function parseSocialInput(raw: string): { platforms: string[]; handle: string } {
    const trimmed = raw.trim().toLowerCase();

    // Direct URL patterns — highest priority
    const githubUrlMatch = trimmed.match(/github\.com\/([a-zA-Z0-9_-]{1,39})/);
    if (githubUrlMatch) return { platforms: ["github"], handle: githubUrlMatch[1] };

    const xUrlMatch = trimmed.match(/(?:x|twitter)\.com\/([a-zA-Z0-9_]{1,15})/);
    if (xUrlMatch) return { platforms: ["x"], handle: xUrlMatch[1] };

    // Detect platform mentions
    const mentionsX = /\b(x|twitter)\b/.test(trimmed);
    const mentionsGH = /\b(github|gh)\b/.test(trimmed);

    // Strip filler words to find the username
    const filler = /\b(my|both|and|are|is|on|username|usernames|handle|handles|it's|its|the|same|for|profile|account)\b/g;
    const cleaned = trimmed
      .replace(filler, " ")
      .replace(/[^\w@\s-]/g, " ")
      .trim();

    // Find @-prefixed handle or bare username-looking word
    const atMatch = cleaned.match(/@([a-zA-Z0-9_]{3,30})/);
    const bareMatch = cleaned.match(/\b([a-zA-Z][a-zA-Z0-9_]{2,29})\b/);
    const handle = atMatch ? atMatch[1] : bareMatch ? bareMatch[1] : "";

    // Filter out platform names from being treated as handles
    const platformWords = new Set(["x", "twitter", "github", "gh"]);
    const finalHandle = platformWords.has(handle) ? (bareMatch ? cleaned.split(/\s+/).filter(w => !platformWords.has(w) && /^[a-zA-Z0-9_]{3,30}$/.test(w))[0] || "" : "") : handle;

    // Determine platforms
    let platforms: string[] = [];
    if (mentionsX && mentionsGH) platforms = ["x", "github"];
    else if (mentionsX) platforms = ["x"];
    else if (mentionsGH) platforms = ["github"];
    else if (atMatch) platforms = ["x"]; // @handle defaults to X
    else platforms = ["github"]; // bare username defaults to GitHub

    return { platforms, handle: finalHandle };
  }

  // Generate a conversational reaction to scraped profile data
  function getScrapedReaction(data: Record<string, unknown>, platform: string): string {
    const parts: string[] = [];
    const displayName = data.displayName as string | undefined;
    const bio = data.bio as string | undefined;
    const location = data.location as string | undefined;
    const followers = data.followers as number | undefined;
    const profileImageUrl = data.profileImageUrl as string | undefined;

    if (displayName) parts.push(`found you -- ${displayName}.`);

    if (bio) {
      const short = bio.slice(0, 80) + (bio.length > 80 ? "..." : "");
      parts.push(`"${short}"`);
    }

    if (location) parts.push(`${location.toLowerCase()}.`);

    if (followers && followers > 1000) {
      parts.push(`${(followers / 1000).toFixed(1)}k followers -- not bad.`);
    } else if (followers) {
      parts.push(`${followers} followers.`);
    }

    if (profileImageUrl) parts.push("grabbed your portrait source.");

    return parts.join(" ") || "found your profile.";
  }

  // Scrape a single platform and return the data
  async function scrapePlatform(
    handle: string,
    platform: string,
    addLineRef: typeof addLine,
  ): Promise<Record<string, unknown> | null> {
    const url = platform === "x" ? `https://x.com/${handle}` : `https://github.com/${handle}`;

    try {
      const res = await fetch(
        "https://kindly-cassowary-600.convex.site/api/v1/scrape",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        }
      );

      if (res.ok) {
        const raw = await res.json();
        const data = raw.data || raw;
        return data as Record<string, unknown>;
      }
    } catch {
      // Scrape failed silently
    }
    return null;
  }

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

    // Smart parsing of natural language input
    const { platforms, handle } = parseSocialInput(val);

    if (!handle) {
      addLine(
        <span className="text-[hsl(var(--accent))]">
          couldn&apos;t find a username in that -- try just your handle (e.g. houstongolden)
        </span>
      );
      return;
    }

    addLine(
      <span>
        <span className="text-[hsl(var(--accent))]">{platforms.join(" + ")}:</span>{" "}
        <span className="text-[hsl(var(--text-secondary))]">@{handle}</span>
      </span>
    );
    addLine("\u00A0");
    setPhase("portrait");

    addLine("fetching profile...", "text-[hsl(var(--text-secondary))] opacity-50");

    let bestData: Record<string, unknown> | null = null;
    let bestPlatform = platforms[0];

    // Scrape each mentioned platform sequentially
    for (const platform of platforms) {
      const data = await scrapePlatform(handle, platform, addLine);
      if (data) {
        // Show conversational reaction
        const reaction = getScrapedReaction(data, platform);
        addLine(
          <span className="text-[hsl(var(--success))]">
            {platform}: {reaction}
          </span>
        );

        // Use the first platform with a profile image, or the first successful scrape
        if (!bestData || (data.profileImageUrl && !bestData.profileImageUrl)) {
          bestData = data;
          bestPlatform = platform;
        }
      } else {
        addLine(
          <span className="text-[hsl(var(--text-secondary))] opacity-40">
            {platform}: no luck -- moving on
          </span>
        );
      }
    }

    if (bestData) {
      // Save profile image if found
      if (bestData.profileImageUrl) {
        scrapedImageRef.current = { platform: bestPlatform, url: bestData.profileImageUrl as string };
      }

      addLine("\u00A0");

      // Auto-research via Perplexity (non-blocking)
      addLine("researching your public presence...", "text-[hsl(var(--text-secondary))] opacity-50");
      try {
        const links = platforms.map(p =>
          p === "x" ? `https://x.com/${handle}` : `https://github.com/${handle}`
        );
        const researchRes = await fetch(
          "https://kindly-cassowary-600.convex.site/api/v1/research",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: name || (bestData.displayName as string) || handle,
              username: handle,
              links,
            }),
          }
        );
        if (researchRes.ok) {
          const researchData = await researchRes.json();
          if (researchData.success && researchData.research) {
            addLine(
              <span className="text-[hsl(var(--success))]">context enriched via web research.</span>
            );
            const excerpt = researchData.research.slice(0, 120);
            addLine(
              <span className="text-[hsl(var(--text-secondary))] opacity-40 text-[12px]">
                &quot;{excerpt}{researchData.research.length > 120 ? "..." : ""}&quot;
              </span>
            );
          }
        }
      } catch {
        // Research is optional
      }

      // Auto-enrich X profile via XAI (if X was scraped)
      if (platforms.includes("x")) {
        addLine("analyzing x profile...", "text-[hsl(var(--text-secondary))] opacity-50");
        try {
          const enrichRes = await fetch(
            "https://kindly-cassowary-600.convex.site/api/v1/enrich-x",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                xUsername: handle,
                profileData: bestData,
              }),
            }
          );
          if (enrichRes.ok) {
            const enrichData = await enrichRes.json();
            if (enrichData.success && enrichData.analysis) {
              addLine(
                <span className="text-[hsl(var(--success))]">x profile analyzed.</span>
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
          couldn&apos;t fetch profile details -- no worries, you can add this later
        </span>
      );
    }

    addLine("\u00A0");
    proceedToCreate();
  }, [addLine, username, name, router]);

  // Create the profile via direct HTTP (no Clerk auth needed)
  const proceedToCreate = useCallback(async () => {
    setPhase("creating");
    addLine("creating @" + username + "...", "text-[hsl(var(--text-secondary))] opacity-50");

    try {
      const result = await callConvexMutation("profiles:createProfile", {
        username,
        name,
      });

      // Save scraped social image to the profile
      const scraped = scrapedImageRef.current;
      if (scraped && result.profileId && result.sessionToken) {
        try {
          await callConvexMutation("profiles:updateProfile", {
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

  const isInputPhase = phase === "username" || phase === "name" || phase === "social";
  const keyboardHeight = useKeyboardHeight();

  const promptLabel = {
    username: "choose a username",
    name: "what should we call you?",
    social: "drop your x or github username (or skip)",
  }[phase as string] || "";

  const promptPlaceholder = {
    username: "username",
    name: "your name",
    social: "@username or github.com/you",
  }[phase as string] || "";

  const handleSubmit = phase === "username" ? handleUsername
    : phase === "name" ? handleName
    : phase === "social" ? handleSocial
    : () => {};

  // Auto-scroll to bottom when lines change or phase changes
  useEffect(() => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }, 50);
  }, [lines.length, phase]);

  return (
    <div
      className="fixed inset-0 bg-[hsl(var(--bg))] flex flex-col"
      style={{ height: keyboardHeight > 0 ? `calc(100% - ${keyboardHeight}px)` : "100%" }}
    >
      <div className="flex-1 flex flex-col max-w-3xl mx-auto w-full p-4 min-h-0">
        {/* Terminal panel — fills available space */}
        <div
          className="flex-1 flex flex-col bg-[hsl(var(--bg-raised))] border border-[hsl(var(--border))] overflow-hidden min-h-0"
          style={{ borderRadius: "8px" }}
        >
          <TerminalHeader title="you.md — create" />

          {/* Scrollable terminal output */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-5 font-mono text-[14px] leading-relaxed"
          >
            {lines.map((line) => (
              <div key={line.id} className={line.className || ""}>
                {line.content || "\u00A0"}
              </div>
            ))}

            {/* Processing indicators (non-input phases) */}
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

          {/* Input pinned at bottom — clean, no labels, just the prompt */}
          {isInputPhase && (
            <div className="shrink-0 border-t border-[hsl(var(--border))] px-5 pt-3 pb-5">
              <TerminalAuthInput
                prompt=">"
                placeholder={promptPlaceholder}
                onSubmit={handleSubmit}
              />
            </div>
          )}
        </div>

        {/* Links below terminal */}
        {!isInputPhase && (
          <div className="mt-3 text-center shrink-0">
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
        )}
      </div>
    </div>
  );
}
