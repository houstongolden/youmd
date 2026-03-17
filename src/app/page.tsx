"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import BlurText from "@/components/reactbits/BlurText";
import GradientText from "@/components/reactbits/GradientText";

const Aurora = dynamic(() => import("@/components/reactbits/Aurora"), {
  ssr: false,
});

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-void text-foreground">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 sm:px-10 py-5 bg-void/80 backdrop-blur-md border-b border-white/5">
        <Link href="/" className="font-mono text-base tracking-tight text-foreground/90">
          you.md
        </Link>
        <div className="flex items-center gap-5">
          <Link
            href="/sign-in"
            className="text-sm text-foreground/50 hover:text-foreground transition-colors"
          >
            Sign in
          </Link>
          <Link
            href="/claim"
            className="text-sm px-5 py-2 bg-coral text-void rounded-lg font-medium hover:bg-coral/90 transition-colors"
          >
            Claim your username
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-6 overflow-hidden pt-20">
        {/* Aurora background */}
        <div className="absolute inset-0 opacity-30">
          <Aurora
            colorStops={["#E8857A", "#7ABED0", "#F4D78C"]}
            amplitude={1.2}
            blend={0.6}
            speed={0.4}
          />
        </div>

        {/* Vertical beam of light — the core motif */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div className="w-px h-full bg-gradient-to-b from-transparent via-gold/20 to-transparent" />
        </div>
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div className="w-40 h-full bg-gradient-to-b from-transparent via-gold/[0.03] to-transparent blur-3xl" />
        </div>

        <div className="relative z-10 max-w-3xl mx-auto text-center space-y-8">
          {/* Brand mark */}
          <div className="inline-block">
            <GradientText
              colors={["#E8857A", "#F0A898", "#7ABED0", "#F4D78C", "#E8857A"]}
              animationSpeed={6}
              className="font-mono text-6xl sm:text-8xl font-normal tracking-tight"
            >
              you.md
            </GradientText>
          </div>

          {/* Tagline with blur reveal */}
          <BlurText
            text="Your identity file for the agent internet."
            delay={80}
            className="text-xl sm:text-2xl font-light text-foreground/70 leading-relaxed justify-center"
            direction="bottom"
            stepDuration={0.4}
          />

          <BlurText
            text="Onboard any AI in seconds."
            delay={100}
            className="text-lg sm:text-xl font-medium text-foreground/90 leading-relaxed justify-center"
            direction="bottom"
            stepDuration={0.4}
          />

          {/* Sub-copy */}
          <p className="text-foreground/40 text-sm sm:text-base max-w-lg mx-auto leading-relaxed">
            A structured, portable identity bundle written in the native
            language of agents. Readable by any LLM on earth. Controlled by you.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link
              href="/claim"
              className="group px-7 py-3.5 bg-coral text-void rounded-lg font-medium text-sm hover:bg-coral/90 transition-all hover:shadow-lg hover:shadow-coral/20"
            >
              Claim your username
              <span className="inline-block ml-1 group-hover:translate-x-0.5 transition-transform">
                &rarr;
              </span>
            </Link>
            <div className="flex items-center gap-2 px-5 py-3.5 border border-white/10 rounded-lg bg-white/[0.02] backdrop-blur-sm hover:border-white/20 transition-colors">
              <span className="text-foreground/30 text-sm">$</span>
              <code className="text-foreground/60 text-sm font-mono">
                npm install -g youmd
              </code>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-30">
          <div className="w-px h-8 bg-gradient-to-b from-foreground/40 to-transparent animate-pulse" />
        </div>
      </section>

      {/* The Handshake — soul.md / agent.md / you.md */}
      <section className="relative px-6 py-32 border-t border-white/5">
        <div className="max-w-2xl mx-auto text-center space-y-12">
          <p className="text-xs font-mono text-foreground/30 uppercase tracking-[0.3em]">
            The missing piece
          </p>

          <div className="space-y-5 font-mono text-lg sm:text-xl">
            <div className="flex items-center justify-center gap-4 text-foreground/25">
              <span>agent.md</span>
              <span className="text-foreground/10">&mdash;</span>
              <span className="text-foreground/15 font-sans text-base">
                the agent&apos;s instructions
              </span>
            </div>
            <div className="flex items-center justify-center gap-4 text-foreground/25">
              <span>soul.md</span>
              <span className="text-foreground/10">&mdash;</span>
              <span className="text-foreground/15 font-sans text-base">
                the agent&apos;s identity
              </span>
            </div>
            <div className="flex items-center justify-center gap-4">
              <GradientText
                colors={["#E8857A", "#F4D78C", "#E8857A"]}
                animationSpeed={4}
                className="font-mono text-lg sm:text-xl"
              >
                you.md
              </GradientText>
              <span className="text-foreground/20">&mdash;</span>
              <span className="text-foreground/60 font-sans text-base">
                the human&apos;s identity
              </span>
            </div>
          </div>

          <p className="text-foreground/30 text-sm max-w-md mx-auto leading-relaxed">
            Agents know who they are. Agents know how to behave.
            <br />
            Now they know who they&apos;re working for.
          </p>
        </div>
      </section>

      {/* How It Works */}
      <section className="px-6 py-32 border-t border-white/5">
        <div className="max-w-4xl mx-auto">
          <p className="text-center text-xs font-mono text-coral/60 uppercase tracking-[0.3em] mb-16">
            Three steps
          </p>

          <div className="grid sm:grid-cols-3 gap-12 sm:gap-8">
            {[
              {
                step: "01",
                title: "Claim",
                desc: "Pick your username. Your canonical identity lives at you.md/yourname — permanent, portable, yours.",
              },
              {
                step: "02",
                title: "Build",
                desc: "Add your sources or write directly. The pipeline extracts your voice, maps your expertise, generates your bundle.",
              },
              {
                step: "03",
                title: "Share",
                desc: "Publish your bundle. Any agent, app, or human reads your you.json and instantly knows how to work with you.",
              },
            ].map((item) => (
              <div key={item.step} className="space-y-4">
                <span className="font-mono text-xs text-sky/40">
                  {item.step}
                </span>
                <h3 className="text-lg font-medium text-foreground/90">
                  {item.title}
                </h3>
                <p className="text-sm text-foreground/35 leading-relaxed">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Dual Value Prop */}
      <section className="px-6 py-32 border-t border-white/5 relative">
        {/* Subtle center glow */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-96 h-96 bg-gold/[0.02] rounded-full blur-[100px]" />
        </div>

        <div className="max-w-4xl mx-auto grid sm:grid-cols-2 gap-16 relative z-10">
          <div className="space-y-6">
            <div className="flex items-center gap-2">
              <div className="w-1 h-4 bg-sky/60 rounded-full" />
              <h2 className="text-xs font-mono text-sky/60 uppercase tracking-[0.2em]">
                For your agents
              </h2>
            </div>
            <p className="text-foreground/50 text-sm leading-relaxed">
              Stop re-explaining yourself every session. Your you.md gives
              every AI assistant persistent context — your tone, your
              preferences, your current projects. They onboard in seconds,
              not conversations.
            </p>
            <ul className="space-y-3 text-sm text-foreground/35">
              {[
                "Consistent voice across every AI tool you use",
                "No more copy-pasting bios into system prompts",
                "Agent preferences travel with you, not with the app",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="w-1 h-1 rounded-full bg-sky/40 mt-2 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-6">
            <div className="flex items-center gap-2">
              <div className="w-1 h-4 bg-gold/60 rounded-full" />
              <h2 className="text-xs font-mono text-gold/60 uppercase tracking-[0.2em]">
                For everyone else&apos;s agents
              </h2>
            </div>
            <p className="text-foreground/50 text-sm leading-relaxed">
              When someone else&apos;s agent needs to reference you — for
              outreach, scheduling, collaboration — your you.md is the
              canonical source. Structured, current, and under your control.
            </p>
            <ul className="space-y-3 text-sm text-foreground/35">
              {[
                "Control how other people's AI represents you",
                "Replace stale scraped data with live, structured identity",
                "One source of truth for the entire agent ecosystem",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="w-1 h-1 rounded-full bg-gold/40 mt-2 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* The Spec */}
      <section className="px-6 py-32 border-t border-white/5">
        <div className="max-w-2xl mx-auto text-center space-y-12">
          <div className="space-y-4">
            <p className="text-xs font-mono text-foreground/20 uppercase tracking-[0.3em]">
              Open spec
            </p>
            <h2 className="text-2xl sm:text-3xl font-light text-foreground/80">
              Identity as code
            </h2>
          </div>

          <div className="text-left bg-ink/50 border border-white/5 rounded-xl p-6 sm:p-8 font-mono text-sm text-foreground/40 leading-loose backdrop-blur-sm">
            <div className="text-foreground/20 mb-2">you/</div>
            <div className="pl-4 space-y-0.5">
              <div>
                <span className="text-coral/60">you.md</span>
                <span className="text-foreground/15 ml-4">
                  # human-readable entry
                </span>
              </div>
              <div>
                <span className="text-sky/60">you.json</span>
                <span className="text-foreground/15 ml-4">
                  # machine-readable output
                </span>
              </div>
              <div>
                <span className="text-foreground/30">manifest.json</span>
                <span className="text-foreground/15 ml-4">
                  # directory map
                </span>
              </div>
              <div className="text-foreground/15 mt-3">profile/</div>
              <div className="pl-4 text-foreground/20">
                about.md &middot; now.md &middot; projects.md &middot;
                values.md
              </div>
              <div className="text-foreground/15 mt-2">preferences/</div>
              <div className="pl-4 text-foreground/20">
                agent.md &middot; writing.md
              </div>
              <div className="text-foreground/15 mt-2">analysis/</div>
              <div className="pl-4 text-foreground/20">
                voice.md &middot; topics.json &middot; bios.md
              </div>
              <div className="text-gold/30 mt-2">private/</div>
              <div className="pl-4 text-foreground/15">
                encrypted context
              </div>
            </div>
          </div>

          <p className="text-foreground/25 text-xs max-w-md mx-auto">
            Directory-based. Markdown for humans, JSON for machines.
            Explicit public/private boundaries. Extensible within versioning
            rules.
          </p>
        </div>
      </section>

      {/* CLI Preview */}
      <section className="px-6 py-32 border-t border-white/5">
        <div className="max-w-2xl mx-auto space-y-12">
          <div className="text-center space-y-4">
            <p className="text-xs font-mono text-foreground/20 uppercase tracking-[0.3em]">
              Terminal-native
            </p>
            <h2 className="text-2xl sm:text-3xl font-light text-foreground/80">
              Manage identity the way you manage code
            </h2>
          </div>

          <div className="bg-ink/50 border border-white/5 rounded-xl p-6 sm:p-8 font-mono text-sm backdrop-blur-sm space-y-4">
            <div className="flex items-center gap-2 text-foreground/20 text-xs mb-6">
              <div className="w-3 h-3 rounded-full bg-coral/30" />
              <div className="w-3 h-3 rounded-full bg-gold/30" />
              <div className="w-3 h-3 rounded-full bg-sky/30" />
            </div>
            <div>
              <span className="text-foreground/30">$ </span>
              <span className="text-foreground/60">npx create-youmd</span>
            </div>
            <div className="text-foreground/20 pl-2 space-y-1">
              <div>
                <span className="text-foreground/30">you.md</span>
                <span className="text-foreground/15">
                  {" "}
                  &mdash; your identity file for the agent internet
                </span>
              </div>
            </div>
            <div className="mt-4">
              <span className="text-foreground/30">$ </span>
              <span className="text-foreground/60">youmd add website </span>
              <span className="text-sky/50">https://yoursite.com</span>
            </div>
            <div>
              <span className="text-foreground/30">$ </span>
              <span className="text-foreground/60">youmd build</span>
            </div>
            <div className="text-foreground/20 pl-2 space-y-0.5">
              <div className="text-foreground/25">
                <span className="text-foreground/15">&boxv;&boxh;&boxh;</span>{" "}
                Scraping website via native fetch
              </div>
              <div className="text-foreground/25">
                <span className="text-foreground/15">&boxv;&boxh;&boxh;</span>{" "}
                Extracting structured data
              </div>
              <div className="text-foreground/25">
                <span className="text-foreground/15">&boxv;&boxh;&boxh;</span>{" "}
                Analyzing voice + topics
              </div>
              <div className="text-foreground/25">
                <span className="text-foreground/15">&boxur;&boxh;&boxh;</span>{" "}
                Compiling bundle
              </div>
            </div>
            <div className="mt-2 text-green-500/60">
              done &mdash; bundle compiled (v1)
            </div>
            <div className="mt-4">
              <span className="text-foreground/30">$ </span>
              <span className="text-foreground/60">youmd publish</span>
            </div>
            <div className="text-green-500/60">
              live at{" "}
              <span className="text-sky/60">
                you.md/yourname
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-32 border-t border-white/5 relative">
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div className="w-64 h-64 bg-coral/[0.03] rounded-full blur-[80px]" />
        </div>
        <div className="max-w-xl mx-auto text-center space-y-8 relative z-10">
          <GradientText
            colors={["#E8857A", "#F4D78C", "#7ABED0", "#E8857A"]}
            animationSpeed={5}
            className="font-mono text-3xl sm:text-4xl"
          >
            you.md/yourname
          </GradientText>
          <p className="text-foreground/35 text-sm">
            The agent internet is being built right now. Claim your place in it.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/claim"
              className="group px-8 py-4 bg-coral text-void rounded-lg font-medium text-sm hover:bg-coral/90 transition-all hover:shadow-lg hover:shadow-coral/20"
            >
              Claim your username
              <span className="inline-block ml-1 group-hover:translate-x-0.5 transition-transform">
                &rarr;
              </span>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-10 border-t border-white/5">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-foreground/20">
          <span className="font-mono">you.md</span>
          <span>
            Identity as code. Open spec.{" "}
            <span className="font-mono text-foreground/15">you-md/v1</span>
          </span>
          <span>Built by Houston Golden</span>
        </div>
      </footer>
    </div>
  );
}
