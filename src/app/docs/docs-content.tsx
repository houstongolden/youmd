"use client";

import { useRef, useCallback } from "react";
import Link from "next/link";
import { TerminalHeader } from "@/components/terminal/TerminalHeader";

/* ── Section definitions ──────────────────────────────────── */

const navSections = [
  { id: "getting-started", label: "getting started" },
  { id: "share", label: "share your identity" },
  { id: "sync", label: "sync" },
  { id: "cli", label: "cli" },
  { id: "api", label: "api" },
  { id: "privacy", label: "privacy" },
  { id: "commands", label: "slash commands" },
];

/* ── Helpers ───────────────────────────────────────────────── */

function SectionHeader({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2
      id={id}
      className="text-[10px] uppercase tracking-widest text-[hsl(var(--accent))] pt-6 pb-2 scroll-mt-4"
    >
      {children}
    </h2>
  );
}

function Divider() {
  return <div className="h-px bg-[hsl(var(--border))] my-4" />;
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="bg-[hsl(var(--bg))] border border-[hsl(var(--border))] px-1.5 py-0.5 text-[12px] font-mono text-[hsl(var(--text-secondary))]">
      {children}
    </code>
  );
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="bg-[hsl(var(--bg))] border border-[hsl(var(--border))] p-3 font-mono text-[12px] text-[hsl(var(--text-secondary))] overflow-x-auto my-2">
      {children}
    </pre>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[13px] text-[hsl(var(--text-secondary))] leading-relaxed mb-2">
      {children}
    </p>
  );
}

function AccentLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-[hsl(var(--accent))] hover:opacity-80 transition-opacity">
      {children}
    </Link>
  );
}

/* ── Main component ───────────────────────────────────────── */

export default function DocsContent() {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollTo = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (el && scrollRef.current) {
      const container = scrollRef.current;
      const elTop = el.offsetTop - container.offsetTop;
      container.scrollTo({ top: elTop, behavior: "smooth" });
    }
  }, []);

  return (
    <div className="min-h-[100dvh] bg-[hsl(var(--bg))] flex items-center justify-center p-4">
      <div className="w-full max-w-3xl">
        {/* Terminal panel */}
        <div
          className="bg-[hsl(var(--bg-raised))] border border-[hsl(var(--border))] overflow-hidden"
          style={{ borderRadius: "8px" }}
        >
          <TerminalHeader title="you.md -- docs" />

          {/* Terminal body */}
          <div
            ref={scrollRef}
            className="p-6 md:p-8 max-h-[80dvh] overflow-y-auto font-mono text-[14px] leading-relaxed"
          >
            {/* Title */}
            <div className="text-[hsl(var(--accent))] mb-1">you.md documentation</div>
            <div className="text-[hsl(var(--text-secondary))] opacity-50 text-[12px] mb-4">
              identity context protocol for the agent internet
            </div>

            {/* Navigation */}
            <div className="flex flex-wrap gap-x-4 gap-y-1 mb-2">
              {navSections.map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => scrollTo(id)}
                  className="text-[11px] text-[hsl(var(--accent))] opacity-70 hover:opacity-100 transition-opacity"
                >
                  [{label}]
                </button>
              ))}
            </div>

            <Divider />

            {/* ── Getting Started ────────────────────────── */}
            <SectionHeader id="getting-started">getting started</SectionHeader>
            <P>
              you.md is the identity file for the agent internet. A structured,
              portable identity bundle that gives every AI agent context about who you
              are -- your bio, projects, values, communication style, and preferences.
              Think of it as a <Code>.env</Code> file for your identity.
            </P>

            <div className="text-[13px] text-[hsl(var(--text-secondary))] leading-relaxed mb-2">
              <div className="mb-3">
                <div className="text-[hsl(var(--accent))] mb-1 text-[11px] uppercase tracking-widest">path a: start on the web</div>
                <div className="pl-3 mb-1">1. Go to <AccentLink href="/create">you.md/create</AccentLink></div>
                <div className="pl-3 mb-1">2. Pick a username, enter your name, share a social handle</div>
                <div className="pl-3 mb-1">3. Your profile is created instantly -- no account needed</div>
                <div className="pl-3 mb-1">4. Sign up later at <AccentLink href="/sign-up">you.md/sign-up</AccentLink> to claim ownership</div>
                <div className="pl-3 mb-1">5. Open the <AccentLink href="/dashboard">dashboard terminal</AccentLink>, type <Code>/share</Code> to get your shareable context link</div>
              </div>
              <div className="mb-2">
                <div className="text-[hsl(var(--accent))] mb-1 text-[11px] uppercase tracking-widest">path b: start with the cli</div>
                <div className="pl-3 mb-1">1. Run <Code>npx youmd init</Code> in your terminal</div>
                <div className="pl-3 mb-1">2. The agent walks you through creating your identity</div>
                <div className="pl-3 mb-1">3. Run <Code>youmd login</Code> to connect to you.md</div>
                <div className="pl-3 mb-1">4. Run <Code>youmd push</Code> to publish your profile</div>
                <div className="pl-3 mb-1">5. Run <Code>youmd share</Code> in chat to get your context link</div>
              </div>
            </div>

            <Divider />

            {/* ── Share Your Identity ────────────────────── */}
            <SectionHeader id="share">share your identity</SectionHeader>
            <P>
              This is the core feature. Once your identity is built, you can share it
              with any AI agent in seconds. The <Code>/share</Code> command works in
              both the web dashboard terminal and the CLI.
            </P>
            <div className="text-[13px] text-[hsl(var(--text-secondary))] leading-relaxed mb-2">
              <div className="mb-2 opacity-80">How it works:</div>
              <div className="pl-3 mb-1">
                1. <span className="text-[hsl(var(--accent))]">Web:</span> open the{" "}
                <AccentLink href="/dashboard">dashboard terminal</AccentLink> and type{" "}
                <Code>/share</Code>
              </div>
              <div className="pl-3 mb-1">
                1. <span className="text-[hsl(var(--accent))]">CLI:</span> type{" "}
                <Code>/share</Code> inside <Code>youmd chat</Code>
              </div>
              <div className="pl-3 mb-1">
                2. Copy the generated identity context block
              </div>
              <div className="pl-3 mb-1">
                3. Paste it into any AI conversation -- Claude, ChatGPT, Cursor, Copilot, or any agent
              </div>
              <div className="pl-3 mb-2">
                4. The AI instantly knows your bio, projects, values, and preferences
              </div>
            </div>
            <P>Both generate the same copyable block:</P>
            <CodeBlock>{`> /share

--- BEGIN YOU.MD CONTEXT ---
name: Houston Golden
role: Founder & builder
projects: you.md, ...
values: ship fast, build in public
preferences: terminal-native, monochrome
--- END YOU.MD CONTEXT ---

[copied to clipboard]`}</CodeBlock>
            <P>
              Use <Code>/share --private</Code> to include your private layer
              (contact info, internal notes, sensitive preferences). Only share this
              with agents you trust.
            </P>
            <P>
              You can also share via URL. Your public context is always available at{" "}
              <Code>you.md/ctx/[username]</Code> -- any agent can fetch it directly.
            </P>

            <Divider />

            {/* ── Sync ───────────────────────────────────── */}
            <SectionHeader id="sync">sync</SectionHeader>
            <P>
              You.md works across web and CLI. Create your profile on either platform
              and keep them in sync.
            </P>
            <div className="text-[13px] text-[hsl(var(--text-secondary))] leading-relaxed mb-2">
              <div className="mb-2 opacity-80">Connecting web and CLI:</div>
              <div className="pl-3 mb-1">1. Create your profile on either web or CLI</div>
              <div className="pl-3 mb-1">
                2. Sign up and get an API key from the dashboard (<Code>/tokens</Code> tab)
              </div>
              <div className="pl-3 mb-1">
                3. <Code>youmd login -k YOUR_KEY</Code> or <Code>youmd login --web</Code> to open dashboard
              </div>
              <div className="pl-3 mb-1">
                4. <Code>youmd pull</Code> -- downloads your web profile to local .youmd/ files
              </div>
              <div className="pl-3 mb-1">
                5. Edit files in any editor (Cursor, Obsidian, VS Code)
              </div>
              <div className="pl-3 mb-1">
                6. <Code>youmd push</Code> -- compiles and publishes back to you.md
              </div>
              <div className="pl-3 mb-2">
                7. <Code>youmd sync --watch</Code> -- auto-syncs on every file save
              </div>
            </div>
            <P>Local file structure:</P>
            <CodeBlock>{`.youmd/
  profile/
    about.md
    now.md
    projects.md
    values.md
    links.md
  preferences/
    agent.md
    writing.md
  voice/
    voice.md
    voice.linkedin.md
  you.json
  you.md
  manifest.json`}</CodeBlock>

            <Divider />

            {/* ── CLI ────────────────────────────────────── */}
            <SectionHeader id="cli">cli</SectionHeader>
            <P>
              The you.md CLI lets you create and manage your identity from the
              terminal. Install globally with <Code>npm i -g youmd</Code> or run
              commands directly with <Code>npx youmd</Code>.
            </P>
            <div className="bg-[hsl(var(--bg))] border border-[hsl(var(--border))] p-3 font-mono text-[12px] text-[hsl(var(--text-secondary))] my-2">
              <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
                <span className="text-[hsl(var(--accent))]">youmd init</span>
                <span>create your identity bundle (interactive AI onboarding)</span>

                <span className="text-[hsl(var(--accent))]">youmd login</span>
                <span>authenticate (--web to open browser, -k KEY)</span>

                <span className="text-[hsl(var(--accent))]">youmd pull</span>
                <span>download profile from web to local .youmd/ files</span>

                <span className="text-[hsl(var(--accent))]">youmd push</span>
                <span>upload local files to web and publish</span>

                <span className="text-[hsl(var(--accent))]">youmd sync</span>
                <span>pull + push (--watch for auto-sync on file save)</span>

                <span className="text-[hsl(var(--accent))]">youmd chat</span>
                <span>talk to the you agent</span>

                <span className="text-[hsl(var(--accent))]">youmd build</span>
                <span>compile local bundle from profile files</span>

                <span className="text-[hsl(var(--accent))]">youmd publish</span>
                <span>publish compiled bundle to you.md</span>

                <span className="text-[hsl(var(--accent))]">youmd status</span>
                <span>show bundle and pipeline status</span>

                <span className="text-[hsl(var(--accent))]">youmd whoami</span>
                <span>show current authenticated user</span>

                <span className="text-[hsl(var(--accent))]">youmd add TYPE URL</span>
                <span>add a source (website, linkedin, x, blog, github)</span>

                <span className="text-[hsl(var(--accent))]">youmd link</span>
                <span>manage context links (create, list, revoke)</span>

                <span className="text-[hsl(var(--accent))]">youmd keys</span>
                <span>manage API keys (list, create, revoke)</span>
              </div>
            </div>
            <P>
              The <Code>init</Code> command runs a conversational AI onboarding -- it
              asks about your work, projects, values, and preferences, then builds
              your identity file automatically.
            </P>

            <Divider />

            {/* ── API ────────────────────────────────────── */}
            <SectionHeader id="api">api</SectionHeader>
            <P>
              You.md exposes HTTP endpoints for programmatic access to identity
              context.
            </P>
            <CodeBlock>{`# fetch a public profile
GET /api/v1/profiles?username=houston

# public context (agent-readable)
GET /ctx/[username]

# JSON context
GET /ctx/[username].json`}</CodeBlock>
            <P>
              Context links at <Code>/ctx/[username]</Code> return a plain-text
              identity block optimized for AI consumption. Agents can fetch this URL
              directly to load your context into their conversation.
            </P>
            <P>
              For private context, include an access token as a Bearer header:
            </P>
            <CodeBlock>{`GET /ctx/[username]?scope=private
Authorization: Bearer your_access_token`}</CodeBlock>

            <Divider />

            {/* ── Privacy ────────────────────────────────── */}
            <SectionHeader id="privacy">privacy</SectionHeader>
            <P>
              You.md uses a two-layer privacy model:
            </P>
            <div className="text-[13px] text-[hsl(var(--text-secondary))] leading-relaxed mb-2">
              <div className="pl-3 mb-1">
                <span className="text-[hsl(var(--accent))]">public layer</span> --
                your bio, role, projects, values, and communication style. Visible to
                anyone and any agent.
              </div>
              <div className="pl-3 mb-1">
                <span className="text-[hsl(var(--accent))]">private layer</span> --
                contact info, internal notes, sensitive preferences, API keys. Only
                shared when you explicitly use <Code>/share --private</Code> or
                provide an access token.
              </div>
            </div>
            <P>
              Access tokens can be generated from the dashboard via{" "}
              <Code>/tokens</Code>. Each token has configurable scope (public or
              private) and can be revoked at any time.
            </P>
            <P>
              You control what goes into each layer. Nothing is shared without your
              explicit action.
            </P>

            <Divider />

            {/* ── Slash Commands ──────────────────────────── */}
            <SectionHeader id="commands">slash commands</SectionHeader>
            <P>
              The dashboard terminal supports the following commands:
            </P>
            <div className="bg-[hsl(var(--bg))] border border-[hsl(var(--border))] p-3 font-mono text-[12px] text-[hsl(var(--text-secondary))] my-2">
              <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
                <span className="text-[hsl(var(--accent))]">/share</span>
                <span>generate shareable identity context block</span>

                <span className="text-[hsl(var(--accent))]">/share --private</span>
                <span>include private layer in context block</span>

                <span className="text-[hsl(var(--accent))]">/preview</span>
                <span>preview your public profile</span>

                <span className="text-[hsl(var(--accent))]">/json</span>
                <span>export identity as raw JSON</span>

                <span className="text-[hsl(var(--accent))]">/settings</span>
                <span>open account settings</span>

                <span className="text-[hsl(var(--accent))]">/tokens</span>
                <span>manage API access tokens</span>

                <span className="text-[hsl(var(--accent))]">/billing</span>
                <span>view billing and subscription</span>

                <span className="text-[hsl(var(--accent))]">/status</span>
                <span>check profile completeness and status</span>

                <span className="text-[hsl(var(--accent))]">/publish</span>
                <span>publish latest changes to your public profile</span>

                <span className="text-[hsl(var(--accent))]">/help</span>
                <span>show all available commands</span>
              </div>
            </div>

            <Divider />

            {/* Footer */}
            <div className="text-[11px] text-[hsl(var(--text-secondary))] opacity-40 mt-4">
              you.md -- the identity file for the agent internet
            </div>
          </div>
        </div>

        {/* Link below terminal */}
        <div className="mt-4 text-center">
          <span className="font-mono text-[12px] text-[hsl(var(--text-secondary))] opacity-40">
            ready to build your identity?{" "}
            <Link
              href="/create"
              className="text-[hsl(var(--accent))] opacity-70 hover:opacity-100 transition-opacity"
            >
              get started
            </Link>
          </span>
        </div>
      </div>
    </div>
  );
}
