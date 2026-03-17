"use client";

import Link from "next/link";
import { useState } from "react";
import dynamic from "next/dynamic";
import GradientText from "@/components/reactbits/GradientText";
import BlurText from "@/components/reactbits/BlurText";

const Aurora = dynamic(() => import("@/components/reactbits/Aurora"), {
  ssr: false,
});

/* ─── Inline: Copy Command ─── */
function CopyCommand() {
  const [copied, setCopied] = useState(false);
  const command = "npx youmd init";
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(command);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="group flex items-center gap-3 px-6 py-3.5 rounded-lg border border-mist/20 bg-background-secondary/50 hover:bg-background-secondary hover:border-mist/30 transition-all cursor-pointer"
    >
      <span className="font-mono text-sm text-foreground-secondary">
        <span className="text-foreground-secondary/50">$</span> {command}
      </span>
      <span
        className={`text-xs font-medium transition-all ${
          copied
            ? "text-emerald-400"
            : "text-foreground-secondary/40 group-hover:text-foreground-secondary/60"
        }`}
      >
        {copied ? "copied" : "copy"}
      </span>
    </button>
  );
}

/* ─── Inline: FAQ Item ─── */
function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-border bg-background-secondary/40 overflow-hidden hover:border-mist/30 hover:shadow-sm transition-all">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-6 py-5 text-left cursor-pointer"
      >
        <span className="text-[15px] font-medium text-foreground pr-4">{q}</span>
        <span
          className={`text-foreground-secondary/50 text-xl leading-none shrink-0 transition-transform duration-300 ${
            open ? "rotate-45" : ""
          }`}
        >
          +
        </span>
      </button>
      <div
        className={`transition-all duration-300 ease-in-out ${
          open ? "max-h-40 opacity-100" : "max-h-0 opacity-0"
        } overflow-hidden`}
      >
        <p className="px-6 pb-5 text-sm text-foreground-secondary leading-relaxed">{a}</p>
      </div>
    </div>
  );
}

/* ─── Inline: Mobile Nav Toggle ─── */
function MobileNav() {
  const [open, setOpen] = useState(false);
  return (
    <div className="sm:hidden relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex flex-col justify-center items-center w-10 h-10 gap-[5px] group"
        aria-label="Toggle menu"
      >
        <span
          className={`block w-5 h-[2px] bg-foreground-secondary transition-all duration-300 ${
            open ? "translate-y-[7px] rotate-45" : ""
          }`}
        />
        <span
          className={`block w-5 h-[2px] bg-foreground-secondary transition-all duration-300 ${
            open ? "opacity-0 scale-x-0" : ""
          }`}
        />
        <span
          className={`block w-5 h-[2px] bg-foreground-secondary transition-all duration-300 ${
            open ? "-translate-y-[7px] -rotate-45" : ""
          }`}
        />
      </button>
      {open && (
        <div className="absolute right-0 top-12 w-48 rounded-xl border border-border bg-background-secondary shadow-xl py-2 z-50">
          <Link
            href="/sign-in"
            className="block px-5 py-3 text-[13px] text-foreground-secondary hover:text-foreground hover:bg-background/50 transition-colors"
            onClick={() => setOpen(false)}
          >
            Sign in
          </Link>
          <Link
            href="/claim"
            className="block px-5 py-3 text-[13px] text-coral font-semibold hover:bg-background/50 transition-colors"
            onClick={() => setOpen(false)}
          >
            Get started
          </Link>
        </div>
      )}
    </div>
  );
}

/* ─── Main Page ─── */
export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-coral/30">
      {/* ══════════════════════════════════════════
          NAV
         ══════════════════════════════════════════ */}
      <nav className="sticky top-0 z-50 backdrop-blur-xl bg-background/80 border-b border-border">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-4">
          <Link
            href="/"
            className="font-mono text-[17px] text-foreground font-medium tracking-tight hover:text-coral transition-colors"
          >
            you.md
          </Link>
          <div className="hidden sm:flex items-center gap-6">
            <Link
              href="/sign-in"
              className="text-[13px] text-foreground-secondary hover:text-foreground transition-colors"
            >
              Sign in
            </Link>
            <Link
              href="/claim"
              className="text-[13px] px-5 py-2 rounded-lg bg-coral text-void font-semibold hover:bg-blush transition-colors"
            >
              Get started
            </Link>
          </div>
          <MobileNav />
        </div>
      </nav>

      {/* ══════════════════════════════════════════
          HERO
         ══════════════════════════════════════════ */}
      <section className="relative overflow-hidden">
        {/* Aurora background — atmospheric, not overwhelming */}
        <div className="absolute inset-0 opacity-35 pointer-events-none" aria-hidden="true">
          <Aurora
            colorStops={["#E8857A", "#7ABED0", "#F4D78C"]}
            amplitude={1.4}
            blend={0.8}
            speed={0.35}
          />
        </div>

        {/* Beam of light — the recurring motif */}
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <div className="absolute left-1/2 -translate-x-1/2 top-0 w-[1px] h-full beam-glow opacity-60" />
          <div className="absolute left-1/2 -translate-x-1/2 top-0 w-[200px] h-full bg-gradient-to-b from-gold/[0.04] via-sky/[0.02] to-transparent opacity-50 blur-2xl" />
        </div>

        {/* Radial vignette */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,var(--background)_75%)] pointer-events-none" />

        <div className="relative z-10 max-w-4xl mx-auto px-6 pt-32 pb-28 sm:pt-44 sm:pb-36 text-center">
          {/* Spec badge */}
          <div className="mb-10">
            <span className="inline-block px-4 py-1.5 rounded-full text-[11px] font-mono font-medium tracking-wide uppercase bg-background-secondary/60 text-foreground-secondary border border-mist/15 hover:border-mist/30 transition-all">
              Open spec &middot; you-md/v1
            </span>
          </div>

          {/* Logo mark */}
          <div className="mb-6">
            <GradientText
              colors={["#E8857A", "#F0A898", "#F4D78C", "#7ABED0", "#E8857A"]}
              animationSpeed={6}
              className="font-mono text-2xl sm:text-3xl tracking-tight"
            >
              you.md
            </GradientText>
          </div>

          {/* Headline */}
          <h1 className="text-[clamp(2.5rem,7vw,5rem)] leading-[1.08] font-semibold tracking-[-0.03em] text-foreground mb-8">
            Your identity file
            <br />
            for the agent internet
          </h1>

          {/* Tagline — animated blur */}
          <div className="max-w-2xl mx-auto mb-14">
            <BlurText
              text="Onboard any AI in seconds. Give every agent full context — as if it's been working with you for years."
              delay={30}
              className="text-[clamp(1rem,2.2vw,1.2rem)] text-foreground-secondary leading-relaxed justify-center"
              animateBy="words"
              direction="bottom"
            />
          </div>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/claim"
              className="group px-8 py-3.5 rounded-lg bg-coral text-void font-semibold text-[15px] hover:bg-blush transition-all hover:scale-[1.02] shadow-[0_0_40px_rgba(232,133,122,0.15)]"
            >
              Claim your username
              <span className="inline-block ml-1.5 group-hover:translate-x-0.5 transition-transform">
                &rarr;
              </span>
            </Link>
            <CopyCommand />
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          SOCIAL PROOF BAR
         ══════════════════════════════════════════ */}
      <div className="border-y border-border py-5">
        <div className="max-w-4xl mx-auto px-6 flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-[12px] font-mono text-foreground-secondary/60">
          <span>
            Live on npm as <span className="text-foreground-secondary">youmd</span>
          </span>
          <span className="text-foreground-secondary/20">&bull;</span>
          <span>Open spec: you-md/v1</span>
          <span className="text-foreground-secondary/20">&bull;</span>
          <span>Works with Claude, ChatGPT, Cursor, and every LLM</span>
        </div>
      </div>

      {/* ══════════════════════════════════════════
          THE SYMMETRY — agent.md / soul.md / you.md
         ══════════════════════════════════════════ */}
      <section className="max-w-4xl mx-auto px-6 py-28 sm:py-36">
        <div className="text-center mb-16">
          <p className="text-coral text-[12px] font-mono font-semibold uppercase tracking-widest mb-4">
            The missing piece
          </p>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-foreground mb-5">
            The complete context handshake
          </h2>
          <p className="text-foreground-secondary text-lg max-w-lg mx-auto leading-relaxed">
            The agent internet has{" "}
            <span className="font-mono text-foreground-secondary/80">soul.md</span> and{" "}
            <span className="font-mono text-foreground-secondary/80">agent.md</span>. Now
            humans have{" "}
            <span className="font-mono text-coral">you.md</span>.
          </p>
        </div>

        <div className="grid sm:grid-cols-3 gap-4">
          {/* agent.md */}
          <div className="rounded-xl border border-border bg-background-secondary/40 p-7 text-center hover:border-mist/30 hover:shadow-sm transition-all">
            <code className="text-lg font-mono text-foreground-secondary/70 block mb-3">
              agent.md
            </code>
            <p className="text-sm text-foreground-secondary/50 leading-relaxed">
              How the agent behaves in a project
            </p>
          </div>

          {/* soul.md */}
          <div className="rounded-xl border border-border bg-background-secondary/40 p-7 text-center hover:border-mist/30 hover:shadow-sm transition-all">
            <code className="text-lg font-mono text-foreground-secondary/70 block mb-3">
              soul.md
            </code>
            <p className="text-sm text-foreground-secondary/50 leading-relaxed">
              Who the agent is — its personality and values
            </p>
          </div>

          {/* you.md — the warm one */}
          <div className="rounded-xl border border-coral/25 bg-coral/[0.05] p-7 text-center glow-coral">
            <code className="text-lg font-mono text-coral font-semibold block mb-3">
              you.md
            </code>
            <p className="text-sm text-foreground/70 leading-relaxed">
              Who the human is — structured, portable, yours
            </p>
          </div>
        </div>

        {/* Connecting line */}
        <div className="flex justify-center mt-8">
          <p className="text-foreground-secondary/40 text-sm font-mono">
            agent knows itself &middot; agent knows its rules &middot; agent
            knows <span className="text-coral/60">you</span>
          </p>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          HOW IT WORKS — Claim / Build / Share
         ══════════════════════════════════════════ */}
      <section className="max-w-5xl mx-auto px-6 pb-28 sm:pb-36">
        <div className="text-center mb-16">
          <p className="text-sky text-[12px] font-mono font-semibold uppercase tracking-widest mb-4">
            Three steps
          </p>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-foreground">
            How it works
          </h2>
        </div>

        <div className="grid sm:grid-cols-3 gap-5">
          {/* Claim */}
          <div className="rounded-xl border border-coral/15 bg-background-secondary/50 p-8 flex flex-col hover:border-coral/30 hover:shadow-sm transition-all">
            <div className="w-10 h-10 rounded-lg bg-coral/10 border border-coral/20 flex items-center justify-center mb-6">
              <span className="text-coral font-mono text-sm font-bold">01</span>
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-3">
              Claim your username
            </h3>
            <p className="text-sm text-foreground-secondary leading-relaxed flex-1">
              Reserve{" "}
              <span className="font-mono text-coral/80">
                you.md/yourname
              </span>{" "}
              &mdash; your permanent, portable identity on the agent internet.
            </p>
          </div>

          {/* Build */}
          <div className="rounded-xl border border-sky/15 bg-background-secondary/50 p-8 flex flex-col hover:border-sky/30 hover:shadow-sm transition-all">
            <div className="w-10 h-10 rounded-lg bg-sky/10 border border-sky/20 flex items-center justify-center mb-6">
              <span className="text-sky font-mono text-sm font-bold">02</span>
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-3">
              Build your bundle
            </h3>
            <p className="text-sm text-foreground-secondary leading-relaxed flex-1">
              Add your website, LinkedIn, or X. The pipeline scrapes, extracts,
              and analyzes your voice, expertise, and identity.
            </p>
          </div>

          {/* Share */}
          <div className="rounded-xl border border-gold/15 bg-background-secondary/50 p-8 flex flex-col hover:border-gold/30 hover:shadow-sm transition-all">
            <div className="w-10 h-10 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center mb-6">
              <span className="text-gold font-mono text-sm font-bold">03</span>
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-3">
              Share everywhere
            </h3>
            <p className="text-sm text-foreground-secondary leading-relaxed flex-1">
              Publish your bundle. Any agent reads your{" "}
              <span className="font-mono text-gold/80">you.json</span> and gets
              full context instantly.
            </p>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          DUAL VALUE PROP
         ══════════════════════════════════════════ */}
      <section className="max-w-5xl mx-auto px-6 pb-28 sm:pb-36">
        <div className="grid sm:grid-cols-2 gap-5">
          {/* For YOUR agents */}
          <div className="rounded-xl border border-sky/15 bg-gradient-to-br from-sky/[0.05] to-ink/30 p-8 sm:p-10 hover:border-sky/30 hover:shadow-sm transition-all">
            <h3 className="text-xl font-semibold text-foreground mb-4">
              For <span className="text-sky">your</span> agents
            </h3>
            <p className="text-[15px] text-foreground-secondary leading-relaxed mb-6">
              Stop re-explaining yourself every session. Share your you.md with
              Claude, ChatGPT, Cursor, or any AI tool and it has full context in
              seconds. Every new tool starts where the last one left off.
            </p>
            <div className="flex flex-wrap gap-2">
              {[
                "Consistent voice",
                "Persistent context",
                "Works with any LLM",
              ].map((t) => (
                <span
                  key={t}
                  className="text-[12px] px-3 py-1.5 rounded-full bg-sky/10 text-sky/80 border border-sky/15 font-medium"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>

          {/* For EVERYONE ELSE'S agents */}
          <div className="rounded-xl border border-gold/15 bg-gradient-to-br from-gold/[0.05] to-ink/30 p-8 sm:p-10 hover:border-gold/30 hover:shadow-sm transition-all">
            <h3 className="text-xl font-semibold text-foreground mb-4">
              For <span className="text-gold">everyone else&apos;s</span>{" "}
              agents
            </h3>
            <p className="text-[15px] text-foreground-secondary leading-relaxed mb-6">
              When someone asks an AI about you, your you.md is the canonical,
              structured answer. Your Knowledge Panel for the agent era &mdash;
              always current, always accurate, always yours.
            </p>
            <div className="flex flex-wrap gap-2">
              {["AEO/GEO ready", "Always current", "You control the source"].map(
                (t) => (
                  <span
                    key={t}
                    className="text-[12px] px-3 py-1.5 rounded-full bg-gold/10 text-gold/80 border border-gold/15 font-medium"
                  >
                    {t}
                  </span>
                )
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          OPEN SPEC PREVIEW
         ══════════════════════════════════════════ */}
      <section className="border-t border-border bg-background-secondary/20">
        <div className="max-w-4xl mx-auto px-6 py-28 sm:py-36">
          <div className="sm:flex items-start gap-16">
            <div className="sm:w-1/2 mb-12 sm:mb-0">
              <p className="text-coral text-[12px] font-mono font-semibold uppercase tracking-widest mb-4">
                Open spec
              </p>
              <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-foreground mb-5">
                Identity as code
              </h2>
              <p className="text-foreground-secondary text-[15px] leading-relaxed mb-6">
                Your identity is a directory of files. Markdown for humans, JSON
                for machines. Explicit public/private boundaries. Versioned,
                extensible, portable.
              </p>
              <p className="text-foreground-secondary/50 text-[13px] leading-relaxed">
                The spec is open. Anyone can implement it. Self-host it. Extend
                it. The hosted platform makes it immediately useful.
              </p>
            </div>

            <div className="sm:w-1/2">
              <div className="bg-void border border-mist/10 rounded-xl p-6 font-mono text-[13px] leading-[2] shadow-2xl">
                <div className="text-light/60 font-semibold mb-1">you/</div>
                <div className="pl-4 border-l border-mist/10 space-y-0">
                  <div className="pl-3">
                    <span className="text-coral">you.md</span>
                  </div>
                  <div className="pl-3">
                    <span className="text-sky">you.json</span>
                  </div>
                  <div className="pl-3">
                    <span className="text-mist">manifest.json</span>
                  </div>
                  <div className="pl-3 mt-1">
                    <span className="text-mist/60">profile/</span>{" "}
                    <span className="text-mist/40">
                      about &middot; now &middot; projects &middot; values
                    </span>
                  </div>
                  <div className="pl-3">
                    <span className="text-mist/60">preferences/</span>{" "}
                    <span className="text-mist/40">
                      agent &middot; writing &middot; formatting
                    </span>
                  </div>
                  <div className="pl-3">
                    <span className="text-mist/60">analysis/</span>{" "}
                    <span className="text-mist/40">
                      voice &middot; topics &middot; bios &middot; arcs
                    </span>
                  </div>
                  <div className="pl-3">
                    <span className="text-gold/50">private/</span>{" "}
                    <span className="text-mist/30">encrypted</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          CLI TERMINAL PREVIEW
         ══════════════════════════════════════════ */}
      <section className="border-t border-border">
        <div className="max-w-4xl mx-auto px-6 py-28 sm:py-36">
          <div className="text-center mb-14">
            <p className="text-gold text-[12px] font-mono font-semibold uppercase tracking-widest mb-4">
              Terminal-native
            </p>
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-foreground mb-4">
              Update your identity the way you push code
            </h2>
            <p className="text-foreground-secondary text-lg max-w-lg mx-auto">
              One command. Interactive onboarding. Your identity compiled in
              seconds.
            </p>
          </div>

          <div className="bg-ink border border-mist/10 rounded-xl overflow-hidden shadow-2xl">
            {/* Terminal chrome */}
            <div className="flex items-center gap-2 px-5 py-3 border-b border-mist/10 bg-ink/80">
              <div className="w-3 h-3 rounded-full bg-coral/60" />
              <div className="w-3 h-3 rounded-full bg-gold/60" />
              <div className="w-3 h-3 rounded-full bg-emerald-500/60" />
              <span className="ml-auto text-[11px] font-mono text-foreground-secondary/30">
                zsh
              </span>
            </div>

            {/* Terminal content — always light-on-dark */}
            <div className="p-6 sm:p-8 font-mono text-[12px] sm:text-[13px] md:text-[14px] leading-relaxed space-y-3 text-light overflow-x-auto">
              <div>
                <span className="text-mist/60">$</span>{" "}
                <span className="text-light">npx youmd init</span>
              </div>

              <div className="pl-2 mt-3">
                <div className="text-light/80 font-medium">you.md</div>
                <div className="text-mist/60">
                  your identity file for the agent internet
                </div>
              </div>

              <div className="pl-2 mt-5 space-y-2">
                <div>
                  <span className="text-emerald-400">?</span>{" "}
                  <span className="text-mist">pick a username:</span>{" "}
                  <span className="text-light">houston</span>
                </div>
                <div className="text-mist/50 pl-4">
                  checking...{" "}
                  <span className="text-emerald-400">
                    houston is available.
                  </span>
                </div>
                <div>
                  <span className="text-emerald-400">?</span>{" "}
                  <span className="text-mist">what&apos;s your name?</span>{" "}
                  <span className="text-light">Houston Golden</span>
                </div>
                <div>
                  <span className="text-emerald-400">?</span>{" "}
                  <span className="text-mist">website URL:</span>{" "}
                  <span className="text-coral">https://bamf.com</span>
                </div>
              </div>

              <div className="pl-2 mt-4 text-mist/50 italic">
                &quot;reading your about page like a respectful detective...&quot;
              </div>

              <div className="pl-2 mt-3 text-light/80">
                ok, so you run BAMF Media &mdash; growth marketing,
                linkedin ghostwriting, AI-native content systems.
                you&apos;ve been doing this a while. impressive operation.
              </div>

              <div className="pl-2 mt-5 space-y-1 text-mist/50">
                <div>{"\u251C\u2500\u2500"} Writing profile/about.md</div>
                <div>{"\u251C\u2500\u2500"} Writing profile/projects.md</div>
                <div>{"\u2514\u2500\u2500"} Compiling you.json</div>
              </div>

              <div className="text-emerald-400 mt-3">
                done &mdash; bundle compiled (v1)
              </div>

              <div className="mt-4 pl-2 text-light/90 font-medium">
                welcome to the agent internet, houston.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          PRICING
         ══════════════════════════════════════════ */}
      <section className="border-t border-border">
        <div className="max-w-4xl mx-auto px-6 py-28 sm:py-36">
          <div className="text-center mb-14">
            <p className="text-gold text-[12px] font-mono font-semibold uppercase tracking-widest mb-4">
              Plans
            </p>
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-foreground">
              Simple pricing
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 gap-5 max-w-3xl mx-auto">
            {/* Free */}
            <div className="rounded-xl border border-border bg-background-secondary p-8 flex flex-col hover:border-mist/30 hover:shadow-sm transition-all">
              <h3 className="text-xl font-semibold text-foreground mb-1">Free</h3>
              <p className="text-foreground-secondary text-sm mb-6">$0 / forever</p>
              <ul className="space-y-3 text-sm text-foreground-secondary flex-1 mb-8">
                <li className="flex items-start gap-2"><span className="text-emerald-400 mt-0.5">&#10003;</span> Published profile</li>
                <li className="flex items-start gap-2"><span className="text-emerald-400 mt-0.5">&#10003;</span> 3 pipeline runs</li>
                <li className="flex items-start gap-2"><span className="text-emerald-400 mt-0.5">&#10003;</span> 1 API key (read:public)</li>
              </ul>
              <Link
                href="/claim"
                className="block text-center px-6 py-3 rounded-lg bg-coral text-void font-semibold text-[14px] hover:opacity-90 transition-all"
              >
                Get started free
              </Link>
            </div>

            {/* Pro */}
            <div className="rounded-xl border border-gold/20 bg-gold/5 p-8 flex flex-col glow-gold hover:border-gold/35 hover:shadow-sm transition-all">
              <h3 className="text-xl font-semibold text-foreground mb-1">
                Pro <span className="text-gold text-lg">&#9733;</span>
              </h3>
              <p className="text-foreground-secondary text-sm mb-6">$12 / month</p>
              <ul className="space-y-3 text-sm text-foreground-secondary flex-1 mb-8">
                <li className="flex items-start gap-2"><span className="text-gold mt-0.5">&#10003;</span> Published profile</li>
                <li className="flex items-start gap-2"><span className="text-gold mt-0.5">&#10003;</span> 10 pipeline runs / month</li>
                <li className="flex items-start gap-2"><span className="text-gold mt-0.5">&#10003;</span> Unlimited API keys (all scopes)</li>
                <li className="flex items-start gap-2"><span className="text-gold mt-0.5">&#10003;</span> Private vault</li>
                <li className="flex items-start gap-2"><span className="text-gold mt-0.5">&#10003;</span> BYOK (bring your own keys)</li>
                <li className="flex items-start gap-2"><span className="text-gold mt-0.5">&#10003;</span> Custom domain</li>
                <li className="flex items-start gap-2"><span className="text-gold mt-0.5">&#10003;</span> Profile analytics</li>
              </ul>
              <span className="block text-center px-6 py-3 rounded-lg bg-gold/15 text-gold/80 border border-gold/20 font-semibold text-[14px] cursor-default">
                Coming soon
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          FAQ
         ══════════════════════════════════════════ */}
      <section className="border-t border-border">
        <div className="max-w-3xl mx-auto px-6 py-28 sm:py-36">
          <div className="text-center mb-14">
            <p className="text-sky text-[12px] font-mono font-semibold uppercase tracking-widest mb-4">
              FAQ
            </p>
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-foreground">
              Common questions
            </h2>
          </div>

          <div className="space-y-3">
            <FaqItem
              q="What is you.md?"
              a="It's a structured identity file that lets any AI agent understand who you are, what you do, and how you work — in seconds."
            />
            <FaqItem
              q="Is my data private?"
              a="You control what's public and what's private. Public sections power your published profile. Private vault data is encrypted and only accessible with your API keys and explicit scopes."
            />
            <FaqItem
              q="Do I need to know how to code?"
              a="No. The web dashboard lets you build and manage your entire identity bundle. The CLI is optional — there for developers who prefer the terminal."
            />
            <FaqItem
              q="How do agents read my you.md?"
              a="Via the public API, context links you share directly, or the JSON endpoint at you.md/yourname/you.json. Any LLM or agent can consume it."
            />
            <FaqItem
              q="Is the spec open source?"
              a="Yes. The you-md/v1 spec is fully open. Anyone can implement it, self-host it, or extend it."
            />
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          FINAL CTA
         ══════════════════════════════════════════ */}
      <section className="relative overflow-hidden border-t border-border">
        {/* Aurora */}
        <div className="absolute inset-0 opacity-25 pointer-events-none" aria-hidden="true">
          <Aurora
            colorStops={["#E8857A", "#F4D78C", "#7ABED0"]}
            amplitude={1.2}
            blend={0.9}
            speed={0.3}
          />
        </div>

        {/* Beam of light */}
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <div className="absolute left-1/2 -translate-x-1/2 top-0 w-[1px] h-full beam-glow opacity-40" />
          <div className="absolute left-1/2 -translate-x-1/2 top-0 w-[300px] h-full bg-gradient-to-b from-gold/[0.03] via-coral/[0.02] to-transparent opacity-40 blur-3xl" />
        </div>

        {/* Vignette */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,var(--background)_70%)] pointer-events-none" />

        <div className="relative z-10 max-w-2xl mx-auto px-6 py-32 sm:py-44 text-center">
          <h2 className="text-4xl sm:text-6xl font-semibold tracking-tight text-foreground mb-6">
            <GradientText
              colors={["#E8857A", "#F4D78C", "#7ABED0", "#E8857A"]}
              animationSpeed={5}
              className="font-mono tracking-tighter"
            >
              you.md/yourname
            </GradientText>
          </h2>

          <p className="text-foreground-secondary text-lg mb-6 max-w-md mx-auto leading-relaxed">
            The agent internet is being built right now.
            <br />
            Claim your place in it.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/claim"
              className="group inline-flex items-center px-8 py-4 rounded-lg bg-coral text-void font-semibold text-[15px] hover:bg-blush transition-all hover:scale-[1.02] shadow-[0_0_40px_rgba(232,133,122,0.2)]"
            >
              Get started free
              <span className="inline-block ml-2 group-hover:translate-x-0.5 transition-transform">
                &rarr;
              </span>
            </Link>
            <CopyCommand />
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          FOOTER
         ══════════════════════════════════════════ */}
      <footer className="border-t border-border bg-background-secondary/30">
        <div className="max-w-6xl mx-auto px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link href="/" className="font-mono text-[14px] text-foreground-secondary/50 hover:text-coral transition-colors">you.md</Link>
          <div className="flex items-center gap-6 text-[13px] text-foreground-secondary/40">
            <a href="https://github.com/houstongolden/youmd" target="_blank" rel="noopener noreferrer" className="hover:text-foreground-secondary transition-colors">
              Open spec
            </a>
            <a href="https://github.com/houstongolden/youmd" target="_blank" rel="noopener noreferrer" className="hover:text-foreground-secondary transition-colors">
              Docs
            </a>
            <a href="https://github.com/houstongolden/youmd" target="_blank" rel="noopener noreferrer" className="hover:text-foreground-secondary transition-colors">
              GitHub
            </a>
          </div>
          <span className="text-[13px] text-foreground-secondary/40">
            Built by{" "}
            <span className="text-foreground-secondary/60">Houston Golden</span>
          </span>
        </div>
      </footer>
    </div>
  );
}
