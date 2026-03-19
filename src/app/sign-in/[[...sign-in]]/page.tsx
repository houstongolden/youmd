"use client";

import { useSignIn } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useState, FormEvent } from "react";
import Link from "next/link";
import PixelYOU from "@/components/PixelYOU";

/* ── CLI commands for left panel ─────────────────────────────── */
const commands = [
  ["you init", "create your identity bundle"],
  ["you sync", "pull from linkedin / github / x"],
  ["you publish", "go live at you.md/username"],
  ["you share", "give any agent your context"],
];

/* ── Terminal input component ────────────────────────────────── */
function TerminalInput({
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  autoComplete,
  showToggle,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  showToggle?: boolean;
}) {
  const [revealed, setRevealed] = useState(false);
  const inputType = showToggle ? (revealed ? "text" : "password") : type;

  return (
    <div className="space-y-1.5">
      <label className="font-mono text-[11px] text-[hsl(var(--text-secondary))] flex items-center gap-1.5">
        <span className="text-[hsl(var(--text-secondary))] opacity-50">$</span>
        {label}
      </label>
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-[11px] text-[hsl(var(--accent))] select-none">
          &gt;
        </div>
        <input
          type={inputType}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className="w-full bg-[hsl(var(--bg))] border border-[hsl(var(--border))] font-mono text-[13px] text-[hsl(var(--text-primary))] py-2.5 pl-7 pr-10 focus:border-[hsl(var(--accent))] focus:outline-none transition-colors placeholder:text-[hsl(var(--text-secondary))]/20"
          style={{ borderRadius: "2px" }}
        />
        {showToggle && (
          <button
            type="button"
            onClick={() => setRevealed(!revealed)}
            className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[9px] text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--accent))] transition-colors uppercase tracking-widest"
          >
            {revealed ? "hide" : "show"}
          </button>
        )}
      </div>
    </div>
  );
}

/* ── Social icons (inline SVG, all disabled) ────────────────── */
const GitHubIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
    <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" />
  </svg>
);

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
);

const LinkedInIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
  </svg>
);

const XIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

/* ── Social button (disabled) ────────────────────────────────── */
function SocialButton({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      disabled
      className="flex items-center justify-center gap-2 py-2 border border-[hsl(var(--border))] bg-[hsl(var(--bg))] font-mono text-[10px] text-[hsl(var(--text-secondary))] opacity-30 cursor-not-allowed"
      style={{ borderRadius: "2px" }}
      title="coming soon"
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

/* ── Clerk error extraction helper ───────────────────────────── */
function extractError(err: unknown): string {
  const clerkErr = err as {
    errors?: { message?: string; longMessage?: string }[];
    message?: string;
  };
  return (
    clerkErr.errors?.[0]?.longMessage ??
    clerkErr.errors?.[0]?.message ??
    clerkErr.message ??
    "authentication failed. try again."
  );
}

/* ── Main sign-in page ───────────────────────────────────────── */
export default function SignInPage() {
  const { signIn, errors: clerkErrors, fetchStatus } = useSignIn();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const isBusy = loading || fetchStatus === "fetching";

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!signIn) return;

    setError("");
    setLoading(true);

    try {
      // Clerk v7: use signIn.password() which takes identifier + password in one call
      const { error: pwError } = await signIn.password({
        identifier: email,
        password: password,
      });

      if (pwError) {
        setError(pwError.message ?? "authentication failed.");
        setLoading(false);
        return;
      }

      if (signIn.status === "complete") {
        const { error: finalizeError } = await signIn.finalize({
          navigate: () => router.push("/dashboard"),
        });
        if (finalizeError) {
          setError(finalizeError.message ?? "failed to finalize session.");
        }
      } else {
        setError("authentication incomplete. additional steps required.");
      }
    } catch (err: unknown) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  };

  // Surface Clerk-level field errors
  const fieldError =
    clerkErrors?.identifier?.[0]?.message ??
    clerkErrors?.password?.[0]?.message ??
    null;

  return (
    <div className="min-h-screen bg-[hsl(var(--bg))] relative overflow-hidden">
      {/* Beam glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120px] h-full beam-glow pointer-events-none" />

      <div className="relative z-10 min-h-screen flex flex-col md:flex-row">
        {/* ── LEFT PANEL: branding ─────────────────────────────── */}
        <div className="flex-1 flex flex-col justify-center px-8 md:px-16 py-12 md:py-0">
          <div className="max-w-sm mx-auto md:mx-0 w-full">
            {/* Logo */}
            <Link href="/" className="inline-block mb-8">
              <PixelYOU />
            </Link>

            {/* Tagline */}
            <div className="space-y-1 mb-8">
              <p className="font-mono text-[11px] text-[hsl(var(--accent))]">
                identity context protocol
              </p>
              <p className="font-mono text-[10px] text-[hsl(var(--text-secondary))] opacity-60">
                mcp for your identity
              </p>
            </div>

            {/* Value prop */}
            <p className="font-mono text-[11px] text-[hsl(var(--text-secondary))] opacity-50 leading-relaxed mb-8 max-w-xs">
              help agents find you, know you, work with you -- instantly.
              one file. public or private context. scoped, shareable, managed
              via cli.
            </p>

            {/* Divider */}
            <div className="section-divider mb-6" />

            {/* Commands */}
            <div className="space-y-1.5 mb-8">
              {commands.map(([cmd, desc]) => (
                <div
                  key={cmd}
                  className="font-mono text-[10px] leading-relaxed"
                >
                  <span className="text-[hsl(var(--text-secondary))] opacity-40">
                    ${" "}
                  </span>
                  <span className="text-[hsl(var(--accent))]">{cmd}</span>
                  <span className="text-[hsl(var(--text-secondary))] opacity-25 ml-3">
                    # {desc}
                  </span>
                </div>
              ))}
            </div>

            {/* Version badge */}
            <p className="font-mono text-[8px] text-[hsl(var(--text-secondary))] opacity-25 uppercase tracking-widest">
              YOU/V1 &middot; OPEN SPEC &middot; FREE
            </p>
          </div>
        </div>

        {/* ── RIGHT PANEL: auth form ───────────────────────────── */}
        <div className="flex-1 flex items-center justify-center px-6 md:px-16 py-12 md:py-0">
          <div className="w-full max-w-sm">
            {/* Terminal panel container */}
            <div className="terminal-panel">
              {/* 3-dot header */}
              <div className="terminal-panel-header">
                <div className="terminal-dot" />
                <div className="terminal-dot" />
                <div className="terminal-dot" />
                <span className="font-mono text-[10px] text-[hsl(var(--text-secondary))] opacity-50 ml-2">
                  auth.login
                </span>
              </div>

              {/* Form body */}
              <div className="p-6">
                {/* Section label */}
                <p className="font-mono text-[9px] text-[hsl(var(--text-secondary))] opacity-50 uppercase tracking-widest mb-6 text-center">
                  ── AUTHENTICATE ──
                </p>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <TerminalInput
                    label="email"
                    type="email"
                    value={email}
                    onChange={setEmail}
                    placeholder="_"
                    autoComplete="email"
                  />

                  <TerminalInput
                    label="password"
                    type="password"
                    value={password}
                    onChange={setPassword}
                    placeholder="_"
                    autoComplete="current-password"
                    showToggle
                  />

                  {/* Error */}
                  {(error || fieldError) && (
                    <p className="font-mono text-[11px] text-[hsl(var(--accent))]">
                      ERR: {error || fieldError}
                    </p>
                  )}

                  {/* Divider */}
                  <div className="section-divider my-2" />

                  {/* Social auth section */}
                  <div>
                    <p className="font-mono text-[9px] text-[hsl(var(--text-secondary))] opacity-50 uppercase tracking-widest mb-3 text-center">
                      ── SOCIAL ──
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <SocialButton icon={<GitHubIcon />} label="GitHub" />
                      <SocialButton icon={<GoogleIcon />} label="Google" />
                      <SocialButton icon={<LinkedInIcon />} label="LinkedIn" />
                      <SocialButton icon={<XIcon />} label="X" />
                    </div>
                    <p className="font-mono text-[8px] text-[hsl(var(--text-secondary))] opacity-25 text-center mt-2 uppercase tracking-widest">
                      coming soon
                    </p>
                  </div>

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={isBusy}
                    className="cta-primary w-full py-2.5 font-mono text-[13px] disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {isBusy ? "> authenticating..." : "> authenticate"}
                  </button>
                </form>

                {/* Sign-up link */}
                <div className="mt-6 text-center">
                  <p className="font-mono text-[11px] text-[hsl(var(--text-secondary))] opacity-50">
                    need to initialize?{" "}
                    <Link
                      href="/sign-up"
                      className="text-[hsl(var(--accent))] hover:text-[hsl(var(--accent-light))] transition-colors"
                    >
                      &gt; sign up
                    </Link>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
