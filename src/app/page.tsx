"use client";

import Link from "next/link";
import { useState } from "react";
import dynamic from "next/dynamic";
import GradientText from "@/components/reactbits/GradientText";

const Aurora = dynamic(() => import("@/components/reactbits/Aurora"), {
  ssr: false,
});

function CopyCommand() {
  const [copied, setCopied] = useState(false);
  const command = "npx create-youmd";

  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(command);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="group flex items-center gap-3 px-6 py-3.5 rounded-full border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/[0.15] transition-all cursor-pointer"
    >
      <span className="font-mono text-[14px] text-[#999]">
        <span className="text-[#555]">$</span> {command}
      </span>
      <span className={`text-[12px] font-medium transition-all ${copied ? "text-emerald-400" : "text-[#555] group-hover:text-[#888]"}`}>
        {copied ? "copied" : "copy"}
      </span>
    </button>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen bg-[#0c0c0e] text-[#e8e6e3] selection:bg-coral/30">
      {/* ── Nav ── */}
      <nav className="sticky top-0 z-50 backdrop-blur-xl bg-[#0c0c0e]/80 border-b border-white/[0.04]">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-4">
          <Link href="/" className="font-mono text-[17px] text-white font-medium tracking-tight">
            you.md
          </Link>
          <div className="flex items-center gap-6">
            <Link href="/sign-in" className="text-[13px] text-[#888] hover:text-white transition-colors">
              Log in
            </Link>
            <Link
              href="/claim"
              className="text-[13px] px-4 py-2 rounded-full bg-white text-[#0c0c0e] font-semibold hover:bg-white/90 transition-colors"
            >
              Get started
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden">
        {/* Aurora — contained, atmospheric */}
        <div className="absolute inset-0 opacity-40 pointer-events-none">
          <Aurora
            colorStops={["#E8857A", "#7ABED0", "#F4D78C"]}
            amplitude={1.5}
            blend={0.8}
            speed={0.4}
          />
        </div>
        {/* Radial fade overlay */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,#0c0c0e_75%)] pointer-events-none" />

        <div className="relative z-10 max-w-4xl mx-auto px-6 pt-32 pb-28 sm:pt-44 sm:pb-36 text-center">
          <div className="mb-8">
            <span className="inline-block px-3.5 py-1.5 rounded-full text-[11px] font-mono font-medium tracking-wide uppercase bg-white/[0.06] text-[#aaa] border border-white/[0.06]">
              Open spec &middot; you-md/v1
            </span>
          </div>

          <h1 className="text-[clamp(2.5rem,7vw,5.5rem)] leading-[1.05] font-bold tracking-[-0.03em] text-white mb-8">
            Your identity file
            <br />
            <span className="inline-block">
              for the{" "}
              <GradientText
                colors={["#E8857A", "#F0A898", "#F4D78C", "#7ABED0", "#E8857A"]}
                animationSpeed={6}
                className="inline"
              >
                agent internet
              </GradientText>
            </span>
          </h1>

          <p className="text-[clamp(1rem,2.2vw,1.25rem)] text-[#888] leading-relaxed max-w-2xl mx-auto mb-12">
            Give every AI agent full context about who you are &mdash; as if
            it&apos;s been working with you for years. One file. Every tool.
            Instant onboarding.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/claim"
              className="group px-8 py-3.5 rounded-full bg-white text-[#0c0c0e] font-semibold text-[15px] hover:bg-white/90 transition-all hover:scale-[1.02] shadow-[0_0_30px_rgba(255,255,255,0.08)]"
            >
              Claim your username
              <span className="inline-block ml-1.5 group-hover:translate-x-0.5 transition-transform">&rarr;</span>
            </Link>
            <CopyCommand />
          </div>
        </div>
      </section>

      {/* ── Social proof line ── */}
      <div className="border-y border-white/[0.04] py-5">
        <div className="max-w-4xl mx-auto px-6 flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-[12px] font-mono text-[#555]">
          <span>Live on npm as <span className="text-[#777]">youmd</span></span>
          <span className="text-white/10">&bull;</span>
          <span>Open spec: you-md/v1</span>
          <span className="text-white/10">&bull;</span>
          <span>Works with Claude, ChatGPT, Cursor, and every LLM</span>
        </div>
      </div>

      {/* ── The Handshake ── */}
      <section className="max-w-4xl mx-auto px-6 py-28 sm:py-36">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white mb-4">
            The missing piece
          </h2>
          <p className="text-[#777] text-lg max-w-lg mx-auto">
            The agent ecosystem converges on markdown config files. One was
            conspicuously absent &mdash; yours.
          </p>
        </div>

        <div className="grid sm:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 text-center">
            <code className="text-lg font-mono text-[#666] block mb-2">agent.md</code>
            <p className="text-[13px] text-[#555]">How the agent behaves</p>
          </div>
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 text-center">
            <code className="text-lg font-mono text-[#666] block mb-2">soul.md</code>
            <p className="text-[13px] text-[#555]">Who the agent is</p>
          </div>
          <div className="rounded-2xl border border-coral/30 bg-coral/[0.04] p-6 text-center shadow-[0_0_40px_rgba(232,133,122,0.06)]">
            <code className="text-lg font-mono text-coral font-semibold block mb-2">you.md</code>
            <p className="text-[13px] text-[#aaa]">Who the human is</p>
          </div>
        </div>
      </section>

      {/* ── Bento grid features ── */}
      <section className="max-w-6xl mx-auto px-6 pb-28 sm:pb-36">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white mb-4">
            How it works
          </h2>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Card 1 — Claim */}
          <div className="rounded-2xl border border-white/[0.06] bg-[#111113] p-8 flex flex-col">
            <div className="w-10 h-10 rounded-xl bg-coral/10 border border-coral/20 flex items-center justify-center mb-6">
              <span className="text-coral font-mono text-sm font-bold">01</span>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Claim your username</h3>
            <p className="text-[14px] text-[#777] leading-relaxed flex-1">
              Reserve <span className="font-mono text-[#999]">you.md/yourname</span> &mdash;
              your permanent, portable identity on the agent internet.
            </p>
          </div>

          {/* Card 2 — Build */}
          <div className="rounded-2xl border border-white/[0.06] bg-[#111113] p-8 flex flex-col">
            <div className="w-10 h-10 rounded-xl bg-sky/10 border border-sky/20 flex items-center justify-center mb-6">
              <span className="text-sky font-mono text-sm font-bold">02</span>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Build your bundle</h3>
            <p className="text-[14px] text-[#777] leading-relaxed flex-1">
              Add your website, LinkedIn, or X. The pipeline scrapes, extracts, analyzes
              your voice and expertise, and compiles your identity.
            </p>
          </div>

          {/* Card 3 — Share */}
          <div className="rounded-2xl border border-white/[0.06] bg-[#111113] p-8 flex flex-col">
            <div className="w-10 h-10 rounded-xl bg-gold/10 border border-gold/20 flex items-center justify-center mb-6">
              <span className="text-gold font-mono text-sm font-bold">03</span>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Share everywhere</h3>
            <p className="text-[14px] text-[#777] leading-relaxed flex-1">
              Publish your bundle. Create context links. Any agent reads your{" "}
              <span className="font-mono text-[#999]">you.json</span> and gets you instantly.
            </p>
          </div>

          {/* Card 4 — For your agents (wide) */}
          <div className="sm:col-span-2 rounded-2xl border border-sky/15 bg-gradient-to-br from-sky/[0.04] to-transparent p-8 sm:p-10">
            <h3 className="text-lg font-semibold text-white mb-3">
              For <span className="text-sky">your</span> agents
            </h3>
            <p className="text-[15px] text-[#888] leading-relaxed mb-6 max-w-xl">
              Stop re-explaining yourself every session. Share your you.md with Claude,
              ChatGPT, Cursor, or any AI tool and it has full context in seconds. No more
              rebuilding memory. Every new tool starts where the last one left off.
            </p>
            <div className="flex flex-wrap gap-2">
              {["Consistent voice", "Persistent context", "Works with any LLM"].map((t) => (
                <span key={t} className="text-[12px] px-3 py-1.5 rounded-full bg-sky/10 text-sky/80 border border-sky/15 font-medium">
                  {t}
                </span>
              ))}
            </div>
          </div>

          {/* Card 5 — For everyone else's agents */}
          <div className="rounded-2xl border border-gold/15 bg-gradient-to-br from-gold/[0.04] to-transparent p-8">
            <h3 className="text-lg font-semibold text-white mb-3">
              For <span className="text-gold">everyone else&apos;s</span>
            </h3>
            <p className="text-[14px] text-[#888] leading-relaxed mb-6">
              When someone asks an AI about you, your you.md is the canonical, structured answer.
              Your Knowledge Panel for the agent era.
            </p>
            <div className="flex flex-wrap gap-2">
              {["AEO/GEO ready", "Always current"].map((t) => (
                <span key={t} className="text-[12px] px-3 py-1.5 rounded-full bg-gold/10 text-gold/80 border border-gold/15 font-medium">
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Open Spec ── */}
      <section className="border-t border-white/[0.04] bg-[#09090b]">
        <div className="max-w-4xl mx-auto px-6 py-28 sm:py-36">
          <div className="sm:flex items-start gap-16">
            <div className="sm:w-1/2 mb-10 sm:mb-0">
              <p className="text-coral text-[12px] font-mono font-semibold uppercase tracking-widest mb-4">Open spec</p>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white mb-5">
                Identity as code
              </h2>
              <p className="text-[#777] text-[15px] leading-relaxed mb-6">
                Your identity is a directory of files. Markdown for humans, JSON for machines.
                Explicit public/private boundaries. Versioned, extensible, portable.
              </p>
              <p className="text-[#555] text-[13px] leading-relaxed">
                The spec is open. Anyone can implement it. Self-host it. Extend it.
                The hosted platform makes it immediately useful.
              </p>
            </div>

            <div className="sm:w-1/2">
              <div className="bg-[#0c0c0e] border border-white/[0.08] rounded-2xl p-6 font-mono text-[13px] leading-[2] shadow-2xl">
                <div className="text-white/60 font-semibold mb-1">you/</div>
                <div className="pl-4 border-l border-white/[0.06] space-y-0">
                  <div className="pl-3"><span className="text-coral">you.md</span></div>
                  <div className="pl-3"><span className="text-sky">you.json</span></div>
                  <div className="pl-3"><span className="text-white/50">manifest.json</span></div>
                  <div className="pl-3 mt-1"><span className="text-white/30">profile/</span> <span className="text-white/20">about &middot; now &middot; projects &middot; values</span></div>
                  <div className="pl-3"><span className="text-white/30">preferences/</span> <span className="text-white/20">agent &middot; writing</span></div>
                  <div className="pl-3"><span className="text-white/30">analysis/</span> <span className="text-white/20">voice &middot; topics &middot; bios</span></div>
                  <div className="pl-3"><span className="text-gold/50">private/</span> <span className="text-white/15">encrypted</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CLI ── */}
      <section className="border-t border-white/[0.04]">
        <div className="max-w-4xl mx-auto px-6 py-28 sm:py-36">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white mb-4">
              Terminal-native
            </h2>
            <p className="text-[#777] text-lg">
              Update your identity the same way you push code.
            </p>
          </div>

          <div className="bg-[#111113] border border-white/[0.08] rounded-2xl overflow-hidden shadow-2xl">
            <div className="flex items-center gap-2 px-5 py-3 border-b border-white/[0.06]">
              <div className="w-3 h-3 rounded-full bg-[#ff5f57]/80" />
              <div className="w-3 h-3 rounded-full bg-[#febc2e]/80" />
              <div className="w-3 h-3 rounded-full bg-[#28c840]/80" />
              <span className="ml-auto text-[11px] font-mono text-[#444]">zsh</span>
            </div>

            <div className="p-6 sm:p-8 font-mono text-[13px] sm:text-[14px] leading-relaxed space-y-3">
              <div><span className="text-[#555]">$</span> <span className="text-white">npx create-youmd</span></div>
              <div className="text-[#888] pl-2 mt-2">
                <div className="text-white/60 font-medium">you.md</div>
                <div className="text-[#666]">your identity file for the agent internet</div>
              </div>

              <div className="pl-2 mt-4 space-y-1.5">
                <div><span className="text-emerald-400">?</span> <span className="text-[#aaa]">Choose a username:</span> <span className="text-white">houston</span></div>
                <div className="text-[#666] pl-2">checking... <span className="text-emerald-400">houston is available.</span></div>
                <div><span className="text-emerald-400">?</span> <span className="text-[#aaa]">Your name:</span> <span className="text-white">Houston Golden</span></div>
                <div><span className="text-emerald-400">?</span> <span className="text-[#aaa]">Your website:</span> <span className="text-coral">https://houstongolden.com</span></div>
                <div><span className="text-emerald-400">?</span> <span className="text-[#aaa]">Tagline:</span> <span className="text-white">Founder, BAMF Media. Building You.md.</span></div>
              </div>

              <div className="pl-2 mt-4 space-y-0.5 text-[#666]">
                <div>{"\u251C\u2500\u2500"} Writing profile/about.md</div>
                <div>{"\u251C\u2500\u2500"} Compiling you.json</div>
                <div>{"\u2514\u2500\u2500"} Generating you.md</div>
              </div>
              <div className="text-emerald-400 mt-2">done &mdash; bundle compiled (v1)</div>

              <div className="mt-4 pl-2 py-3 border-l-2 border-white/[0.06]">
                <div className="text-white font-medium pl-3">Houston Golden</div>
                <div className="text-[#666] pl-3">Founder, BAMF Media. Building You.md.</div>
              </div>

              <div className="pl-2 mt-3 text-[#555]">
                next: <span className="text-[#888]">youmd build</span> <span className="text-[#444]">then</span> <span className="text-[#888]">youmd publish</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="relative overflow-hidden border-t border-white/[0.04]">
        <div className="absolute inset-0 opacity-30 pointer-events-none">
          <Aurora
            colorStops={["#E8857A", "#F4D78C", "#7ABED0"]}
            amplitude={1.2}
            blend={0.9}
            speed={0.3}
          />
        </div>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,#0c0c0e_70%)] pointer-events-none" />

        <div className="relative z-10 max-w-2xl mx-auto px-6 py-32 sm:py-40 text-center">
          <h2 className="text-4xl sm:text-6xl font-bold tracking-tight text-white mb-6">
            <GradientText
              colors={["#E8857A", "#F4D78C", "#7ABED0", "#E8857A"]}
              animationSpeed={5}
              className="font-mono tracking-tighter"
            >
              you.md/yourname
            </GradientText>
          </h2>
          <p className="text-[#888] text-lg mb-10 max-w-md mx-auto">
            The agent internet is being built right now. Claim your place in it.
          </p>
          <Link
            href="/claim"
            className="group inline-flex items-center px-8 py-4 rounded-full bg-white text-[#0c0c0e] font-semibold text-[15px] hover:bg-white/90 transition-all hover:scale-[1.02] shadow-[0_0_40px_rgba(255,255,255,0.1)]"
          >
            Get started free
            <span className="inline-block ml-2 group-hover:translate-x-0.5 transition-transform">&rarr;</span>
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/[0.04] bg-[#09090b]">
        <div className="max-w-6xl mx-auto px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="font-mono text-[14px] text-[#555]">you.md</span>
          <div className="flex items-center gap-6 text-[13px] text-[#444]">
            <span>Open spec</span>
            <span>Docs</span>
            <span>GitHub</span>
          </div>
          <span className="text-[13px] text-[#444]">Built by Houston Golden</span>
        </div>
      </footer>
    </div>
  );
}
