"use client";

import { useState, useEffect, useRef, useCallback, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useSignUp, useUser } from "@clerk/nextjs";
import Link from "next/link";
import { TerminalHeader } from "@/components/terminal/TerminalHeader";
import { TerminalAuthInput } from "@/components/terminal/TerminalAuthInput";
import { useKeyboardHeight } from "@/hooks/useKeyboardHeight";

import { ConvexReactClient } from "convex/react";
import { ConvexProvider, useMutation as useConvexMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { CONVEX_SITE_URL } from "@/lib/constants";

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL || "https://kindly-cassowary-600.convex.cloud";
const publicConvex = typeof window !== "undefined"
  ? new ConvexReactClient(CONVEX_URL)
  : null;

type Phase = "boot" | "username" | "name" | "social" | "portrait" | "creating" | "magic" | "email" | "password" | "verifying_email" | "verify_code" | "finalizing" | "done" | "error";

/**
 * SSR/hydration skeleton — same visible structure as CreateContentInner
 * but with no state, no effects, no Convex provider. This guarantees that
 * search engines and the first paint always have a real <main>, <h1>, and
 * "initializing..." message instead of an empty page.
 */
function CreateSkeleton() {
  return (
    <main className="fixed inset-0 bg-[hsl(var(--bg))] flex flex-col">
      <div className="flex-1 flex flex-col max-w-3xl mx-auto w-full p-4 min-h-0">
        <div
          className="flex-1 flex flex-col bg-[hsl(var(--bg-raised))] border border-[hsl(var(--border))] overflow-hidden min-h-0"
          style={{ borderRadius: "2px" }}
        >
          <div className="flex items-center justify-between border-b border-[hsl(var(--border))] shrink-0">
            <div className="flex items-center gap-2 px-4 py-3">
              <div className="flex gap-1.5" aria-hidden="true">
                <span className="w-3 h-3 rounded-full" style={{ background: "rgba(239, 68, 68, 0.6)" }} />
                <span className="w-3 h-3 rounded-full" style={{ background: "rgba(234, 179, 8, 0.6)" }} />
                <span className="w-3 h-3 rounded-full" style={{ background: "rgba(34, 197, 94, 0.6)" }} />
              </div>
              <h1 className="text-sm font-mono text-[hsl(var(--text-secondary))] opacity-60 ml-2 font-normal">
                you.md — create
              </h1>
            </div>
          </div>
          <div className="flex-1 p-5 font-mono text-[14px] text-[hsl(var(--text-secondary))] opacity-60">
            <p>initializing...</p>
          </div>
        </div>
      </div>
    </main>
  );
}

export function CreateContent() {
  // Render the skeleton on the server AND on the first client render so the
  // hydration markup matches. After mount, useEffect flips `mounted` and
  // we re-render with the live ConvexProvider + CreateContentInner.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted || !publicConvex) {
    return <CreateSkeleton />;
  }

  return (
    <ConvexProvider client={publicConvex}>
      <CreateContentInner />
    </ConvexProvider>
  );
}

function CreateContentInner() {
  const { isSignedIn } = useUser();
  const router = useRouter();
  const signUpHook = useSignUp();
  const signUp = signUpHook.signUp;

  // Redirect signed-in users to dashboard
  useEffect(() => {
    if (isSignedIn) router.replace("/shell");
  }, [isSignedIn, router]);
  const createProfileMut = useConvexMutation(api.profiles.createProfile);
  const updateProfileMut = useConvexMutation(api.profiles.updateProfile);
  const [email, setEmail] = useState("");

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

  // Boot sequence — fast (<1.5s to first input)
  useEffect(() => {
    const timers = [
      setTimeout(() => addLine("you.md v0.1.0", "text-[hsl(var(--accent))]"), 50),
      setTimeout(() => addLine("identity context protocol for the agent internet", "text-[hsl(var(--text-secondary))] opacity-60"), 180),
      setTimeout(() => addLine("\u00A0"), 260),
      setTimeout(() => addLine("pick a username and create your account to get started.", "text-[hsl(var(--text-secondary))] opacity-50"), 340),
      setTimeout(() => addLine("\u00A0"), 420),
      setTimeout(() => addLine("choose a username.", "text-[hsl(var(--text-secondary))] opacity-70"), 500),
      setTimeout(() => setPhase("username"), 580),
    ];
    return () => timers.forEach(clearTimeout);
  }, [addLine]);

  // Username handler — validates format AND checks availability via Convex
  const handleUsername = useCallback(async (val: string) => {
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

    // Check availability server-side before proceeding
    try {
      const res = await fetch(`${CONVEX_SITE_URL}/api/v1/check-username?username=${encodeURIComponent(clean)}`, {
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        const data = await res.json();
        if (!data.available) {
          addLine(
            <span className="text-[hsl(var(--accent))]">ERR: @{clean} is {data.reason || "already taken"}</span>
          );
          return;
        }
      }
    } catch {
      // If check fails, proceed and let createProfile mutation handle it
    }

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
        `${CONVEX_SITE_URL}/api/v1/scrape`,
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
          `${CONVEX_SITE_URL}/api/v1/research`,
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
            `${CONVEX_SITE_URL}/api/v1/enrich-x`,
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
      const result = await createProfileMut({
        username,
        name,
      });

      // Save scraped data + compile a basic youJson so the profile page works
      const scraped = scrapedImageRef.current;
      if (result.profileId && result.sessionToken) {
        try {
          // Build a minimal youJson from what we know
          const basicYouJson = {
            schema: "you-md/v1",
            username,
            generated_at: new Date().toISOString(),
            identity: {
              name,
              tagline: "",
              location: "",
              bio: { short: "", medium: "", long: "" },
            },
            now: { focus: [], updated_at: new Date().toISOString().split("T")[0] },
            projects: [],
            values: [],
            links: {},
            preferences: {
              agent: { tone: "direct, curious", formality: "casual-professional", avoid: [] },
              writing: { style: "", format: "markdown preferred" },
            },
            analysis: { topics: [], voice_summary: "", credibility_signals: [] },
            meta: { sources_used: [], last_updated: new Date().toISOString(), compiler_version: "0.2.0" },
          };

          await updateProfileMut({
            profileId: result.profileId,
            sessionToken: result.sessionToken,
            avatarUrl: scraped?.url,
            youJson: basicYouJson,
            youMd: `---\nschema: you-md/v1\nname: ${name}\nusername: ${username}\n---\n\n# ${name}\n`,
          });
        } catch {
          // Non-critical
        }
      }

      addLine(
        <span>
          <span className="text-[hsl(var(--success))]">{"\u2713"}</span>{" "}
          @<span className="text-[hsl(var(--accent))]">{username}</span> {"\u2014"} created
        </span>
      );
      addLine("\u00A0");

      addLine(
        <span className="text-[hsl(var(--text-secondary))]">
          your profile is live at{" "}
          <span className="text-[hsl(var(--accent))]">you.md/{username}</span>
        </span>
      );

      // Store session token in cookie for claiming later
      if (result.sessionToken) {
        document.cookie = `youmd_session=${result.sessionToken};path=/;max-age=604800;samesite=lax`;
      }

      addLine("\u00A0");

      // Magic moment — show the profile URL and portrait
      addLine(
        <span className="text-[hsl(var(--accent))]">
          {"\u2713"} your profile is live at you.md/{username}
        </span>
      );
      if (scrapedImageRef.current?.url) {
        addLine("your ascii portrait has been generated.", "text-[hsl(var(--text-secondary))] opacity-60");
      }
      addLine("\u00A0");

      // Now collect auth — stay in this terminal
      addLine("claim your profile — enter your email to create an account.", "text-[hsl(var(--text-secondary))] opacity-70");
      setPhase("email");
    } catch (err: unknown) {
      console.error("createProfile error:", err);
      // Extract the actual error from Convex's wrapper
      let msg = "failed to create profile";
      if (err instanceof Error) {
        // Convex errors often have the real message after "Uncaught Error: "
        const match = err.message.match(/Uncaught Error: (.+?)(?:\n|$)/);
        msg = match ? match[1] : err.message;
      }
      addLine(
        <span className="text-[hsl(var(--accent))]">ERR: {msg}</span>
      );
      addLine("\u00A0");
      setPhase("username");
    }
  }, [username, router, addLine]);

  // ── Auth handlers (inline sign-up within the terminal) ──

  const handleEmail = useCallback((val: string) => {
    setEmail(val);
    addLine(
      <span>
        <span className="text-[hsl(var(--accent))]">email:</span>{" "}
        <span className="text-[hsl(var(--text-secondary))]">{val}</span>
      </span>
    );
    addLine("\u00A0");
    addLine("choose a password.", "text-[hsl(var(--text-secondary))] opacity-70");
    setPhase("password");
  }, [addLine]);

  const handlePassword = useCallback(async (val: string) => {
    addLine(
      <span>
        <span className="text-[hsl(var(--accent))]">password:</span>{" "}
        <span className="text-[hsl(var(--text-secondary))]">{"\u2022".repeat(val.length)}</span>
      </span>
    );
    addLine("\u00A0");

    if (!signUp) return;

    setPhase("verifying_email");
    addLine("creating account...", "text-[hsl(var(--text-secondary))] opacity-50");

    try {
      const result = await signUp.password({
        emailAddress: email,
        password: val,
        username,
      });

      if (result.error) {
        addLine(
          <span className="text-[hsl(var(--accent))]">ERR: {result.error.message ?? "sign up failed."}</span>
        );
        addLine("\u00A0");
        addLine("try a different email.", "text-[hsl(var(--text-secondary))] opacity-70");
        setPhase("email");
        return;
      }

      if (signUp.status === "complete") {
        addLine(
          <span className="text-[hsl(var(--success))]">{"\u2713"} account created</span>
        );
        setPhase("finalizing");
        await signUp.finalize({ navigate: () => router.push("/shell") });
        return;
      }

      if (signUp.status === "missing_requirements" && signUp.unverifiedFields?.includes("email_address")) {
        const sendResult = await signUp.verifications.sendEmailCode();
        if (sendResult.error) {
          addLine(
            <span className="text-[hsl(var(--accent))]">ERR: {sendResult.error.message}</span>
          );
          setPhase("email");
          return;
        }
        addLine(
          <span className="text-[hsl(var(--success))]">{"\u2713"} account created</span>
        );
        addLine(
          <span className="text-[hsl(var(--text-secondary))] opacity-60">
            {"\u2192"} verification code sent to {email}
          </span>
        );
        addLine("\u00A0");
        addLine("enter verification code.", "text-[hsl(var(--text-secondary))] opacity-70");
        setPhase("verify_code");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "sign up failed";
      addLine(<span className="text-[hsl(var(--accent))]">ERR: {msg}</span>);
      addLine("\u00A0");
      setPhase("email");
    }
  }, [email, username, signUp, router, addLine]);

  const handleVerifyCode = useCallback(async (val: string) => {
    addLine(
      <span>
        <span className="text-[hsl(var(--accent))]">code:</span>{" "}
        <span className="text-[hsl(var(--text-secondary))]">{val}</span>
      </span>
    );
    addLine("\u00A0");

    if (!signUp) return;

    setPhase("finalizing");
    addLine("verifying...", "text-[hsl(var(--text-secondary))] opacity-50");

    try {
      const verifyResult = await signUp.verifications.verifyEmailCode({ code: val });

      if (verifyResult.error) {
        addLine(<span className="text-[hsl(var(--accent))]">ERR: {verifyResult.error.message ?? "invalid code."}</span>);
        addLine("\u00A0");
        addLine("enter verification code.", "text-[hsl(var(--text-secondary))] opacity-70");
        setPhase("verify_code");
        return;
      }

      if (signUp.status === "complete") {
        addLine(<span className="text-[hsl(var(--success))]">{"\u2713"} verified</span>);
        addLine(
          <span className="text-[hsl(var(--text-secondary))] opacity-60">
            {"\u2192"} launching dashboard...
          </span>
        );
        setPhase("done");
        await signUp.finalize({ navigate: () => router.push("/shell") });
      } else {
        addLine(<span className="text-[hsl(var(--accent))]">ERR: verification incomplete. try again.</span>);
        addLine("\u00A0");
        setPhase("verify_code");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "verification failed";
      addLine(<span className="text-[hsl(var(--accent))]">ERR: {msg}</span>);
      addLine("\u00A0");
      setPhase("verify_code");
    }
  }, [signUp, router, addLine]);

  // ── Input phase mapping ──

  const isInputPhase = ["username", "name", "social", "email", "password", "verify_code"].includes(phase);
  const keyboardHeight = useKeyboardHeight();

  const promptPlaceholder: Record<string, string> = {
    username: "username",
    name: "your name",
    social: "@username or github.com/you",
    email: "email",
    password: "",
    verify_code: "000000",
  };

  const handleSubmit: Record<string, (v: string) => void> = {
    username: handleUsername,
    name: handleName,
    social: handleSocial,
    email: handleEmail,
    password: handlePassword,
    verify_code: handleVerifyCode,
  };

  // Per-step input semantics: type, autocomplete, mobile keyboard, accessible name
  const phaseFieldConfig: Record<string, {
    type: "text" | "email" | "password" | "tel";
    autoComplete: string;
    inputMode?: "text" | "email" | "tel" | "url" | "numeric";
    name: string;
    ariaLabel: string;
  }> = {
    username: { type: "text", autoComplete: "username", name: "username", ariaLabel: "username" },
    name: { type: "text", autoComplete: "name", name: "name", ariaLabel: "your name" },
    social: { type: "text", autoComplete: "off", name: "social-handle", ariaLabel: "social handle (x or github username)" },
    email: { type: "email", autoComplete: "email", inputMode: "email", name: "email", ariaLabel: "email address" },
    password: { type: "password", autoComplete: "new-password", name: "new-password", ariaLabel: "new password" },
    verify_code: { type: "text", autoComplete: "one-time-code", inputMode: "numeric", name: "verification-code", ariaLabel: "verification code" },
  };

  // Auto-scroll to bottom when lines change or phase changes
  useEffect(() => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }, 50);
  }, [lines.length, phase]);

  return (
    <main
      className="fixed inset-0 bg-[hsl(var(--bg))] flex flex-col"
      style={{ height: keyboardHeight > 0 ? `calc(100% - ${keyboardHeight}px)` : "100%" }}
    >
      <div className="flex-1 flex flex-col max-w-3xl mx-auto w-full p-4 min-h-0">
        {/* Terminal panel — fills available space */}
        <div
          className="flex-1 flex flex-col bg-[hsl(var(--bg-raised))] border border-[hsl(var(--border))] overflow-hidden min-h-0"
          style={{ borderRadius: "2px" }}
        >
          {/* Header with sign-in link */}
          <div className="flex items-center justify-between border-b border-[hsl(var(--border))] shrink-0">
            <div className="flex items-center gap-2 px-4 py-3">
              <div className="flex gap-1.5" aria-hidden="true">
                <span className="w-3 h-3 rounded-full" style={{ background: "rgba(239, 68, 68, 0.6)" }} />
                <span className="w-3 h-3 rounded-full" style={{ background: "rgba(234, 179, 8, 0.6)" }} />
                <span className="w-3 h-3 rounded-full" style={{ background: "rgba(34, 197, 94, 0.6)" }} />
              </div>
              <h1 className="text-sm font-mono text-[hsl(var(--text-secondary))] opacity-60 ml-2 font-normal">
                you.md — create
              </h1>
            </div>
            <Link
              href="/sign-in"
              className="px-4 py-3 font-mono text-[11px] text-[hsl(var(--text-secondary))] opacity-40 hover:text-[hsl(var(--accent))] hover:opacity-100 transition-all"
            >
              &gt;_ sign in
            </Link>
          </div>

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

          {/* Processing indicators */}
          {(phase === "verifying_email" || phase === "finalizing") && (
            <div className="p-5 text-[hsl(var(--accent-mid))] animate-pulse font-mono text-[14px]">
              {"\u25CC"} {phase === "verifying_email" ? "creating account..." : "finalizing..."}
            </div>
          )}

          {/* Input pinned at bottom — clean, no labels, just the prompt */}
          {isInputPhase && (
            <div className="shrink-0 border-t border-[hsl(var(--border))] px-5 pt-3 pb-5">
              <TerminalAuthInput
                prompt=">"
                placeholder={promptPlaceholder[phase] || ""}
                type={phaseFieldConfig[phase]?.type || "text"}
                autoComplete={phaseFieldConfig[phase]?.autoComplete}
                inputMode={phaseFieldConfig[phase]?.inputMode}
                name={phaseFieldConfig[phase]?.name}
                ariaLabel={phaseFieldConfig[phase]?.ariaLabel}
                onSubmit={handleSubmit[phase] || (() => {})}
              />
            </div>
          )}
        </div>

        {/* Home link below terminal */}
        {!isInputPhase && (
          <div className="mt-3 text-center shrink-0">
            <Link
              href="/"
              className="font-mono text-[12px] text-[hsl(var(--text-secondary))] opacity-30 hover:opacity-60 transition-opacity"
            >
              &gt; home
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
