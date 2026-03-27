"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

/* ── Navigation structure ────────────────────────────────── */

interface NavItem {
  id: string;
  label: string;
  children?: { id: string; label: string }[];
}

const navigation: NavItem[] = [
  {
    id: "getting-started",
    label: "Getting Started",
    children: [
      { id: "web-quickstart", label: "Web Quickstart" },
      { id: "cli-quickstart", label: "CLI Quickstart" },
    ],
  },
  {
    id: "claude-code",
    label: "Claude Code Integration",
    children: [
      { id: "cc-setup", label: "Setup" },
      { id: "cc-commands", label: "Commands" },
      { id: "cc-workflow", label: "Workflow" },
    ],
  },
  {
    id: "share",
    label: "Share Your Identity",
    children: [
      { id: "share-command", label: "/share Command" },
      { id: "context-links", label: "Context Links" },
    ],
  },
  {
    id: "sync",
    label: "Sync",
    children: [
      { id: "web-cli-sync", label: "Web + CLI" },
      { id: "file-structure", label: "File Structure" },
    ],
  },
  { id: "cli", label: "CLI Reference" },
  {
    id: "api",
    label: "API",
    children: [
      { id: "public-endpoints", label: "Public Endpoints" },
      { id: "authenticated-endpoints", label: "Authenticated" },
    ],
  },
  { id: "privacy", label: "Privacy" },
  { id: "commands", label: "Dashboard Commands" },
];

/* ── Primitives ──────────────────────────────────────────── */

function H1({ children }: { children: React.ReactNode }) {
  return (
    <h1 className="text-[28px] md:text-[32px] font-medium text-[hsl(var(--text-primary))] tracking-tight mb-2">
      {children}
    </h1>
  );
}

function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2
      id={id}
      className="text-[20px] md:text-[22px] font-medium text-[hsl(var(--text-primary))] tracking-tight mt-12 mb-4 scroll-mt-20 border-b border-[hsl(var(--border))] pb-3"
    >
      {children}
    </h2>
  );
}

function H3({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h3
      id={id}
      className="text-[16px] font-medium text-[hsl(var(--text-primary))] mt-8 mb-3 scroll-mt-20"
    >
      {children}
    </h3>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[15px] text-[hsl(var(--text-secondary))] leading-[1.7] mb-4">
      {children}
    </p>
  );
}

function InlineCode({ children }: { children: React.ReactNode }) {
  return (
    <code className="bg-[hsl(var(--bg))] border border-[hsl(var(--border))] px-1.5 py-0.5 rounded text-[13px] font-mono text-[hsl(var(--accent))]">
      {children}
    </code>
  );
}

function CodeBlock({ title, children }: { title?: string; children: string }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(children.trim());
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="my-4 rounded-lg border border-[hsl(var(--border))] overflow-hidden">
      {title && (
        <div className="bg-[hsl(var(--bg))] border-b border-[hsl(var(--border))] px-4 py-2 flex items-center justify-between">
          <span className="font-mono text-[11px] text-[hsl(var(--text-secondary))] opacity-60">
            {title}
          </span>
          <button
            onClick={copy}
            className="font-mono text-[10px] text-[hsl(var(--text-secondary))] opacity-40 hover:opacity-80 transition-opacity"
          >
            {copied ? "copied" : "copy"}
          </button>
        </div>
      )}
      <div className="relative">
        {!title && (
          <button
            onClick={copy}
            className="absolute top-2 right-3 font-mono text-[10px] text-[hsl(var(--text-secondary))] opacity-40 hover:opacity-80 transition-opacity"
          >
            {copied ? "copied" : "copy"}
          </button>
        )}
        <pre className="bg-[hsl(var(--bg))] p-4 font-mono text-[13px] text-[hsl(var(--text-secondary))] leading-relaxed overflow-x-auto">
          {children}
        </pre>
      </div>
    </div>
  );
}

function Callout({
  type = "info",
  children,
}: {
  type?: "info" | "tip" | "warning";
  children: React.ReactNode;
}) {
  const colors = {
    info: "border-l-[hsl(var(--accent))] bg-[hsl(var(--accent))/0.05]",
    tip: "border-l-[hsl(var(--success))] bg-[hsl(var(--success))/0.05]",
    warning: "border-l-amber-500 bg-amber-500/5",
  };

  return (
    <div
      className={`border-l-2 ${colors[type]} rounded-r-lg px-4 py-3 my-4 text-[14px] text-[hsl(var(--text-secondary))] leading-relaxed`}
    >
      {children}
    </div>
  );
}

function StepList({ children }: { children: React.ReactNode }) {
  return <ol className="space-y-2 my-4 list-none">{children}</ol>;
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3 text-[15px] text-[hsl(var(--text-secondary))] leading-relaxed">
      <span className="shrink-0 w-6 h-6 rounded-full bg-[hsl(var(--accent))/0.12] text-[hsl(var(--accent))] text-[12px] font-mono flex items-center justify-center mt-0.5">
        {n}
      </span>
      <span>{children}</span>
    </li>
  );
}

function CommandTable({
  commands,
}: {
  commands: { cmd: string; desc: string }[];
}) {
  return (
    <div className="my-4 border border-[hsl(var(--border))] rounded-lg overflow-hidden">
      <table className="w-full text-[14px]">
        <thead>
          <tr className="border-b border-[hsl(var(--border))] bg-[hsl(var(--bg))]">
            <th className="text-left px-4 py-2.5 font-mono text-[12px] text-[hsl(var(--text-secondary))] opacity-60 font-normal">
              Command
            </th>
            <th className="text-left px-4 py-2.5 font-mono text-[12px] text-[hsl(var(--text-secondary))] opacity-60 font-normal">
              Description
            </th>
          </tr>
        </thead>
        <tbody>
          {commands.map(({ cmd, desc }, i) => (
            <tr
              key={cmd}
              className={
                i < commands.length - 1
                  ? "border-b border-[hsl(var(--border))]"
                  : ""
              }
            >
              <td className="px-4 py-2.5 font-mono text-[13px] text-[hsl(var(--accent))] whitespace-nowrap">
                {cmd}
              </td>
              <td className="px-4 py-2.5 text-[14px] text-[hsl(var(--text-secondary))]">
                {desc}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── Sidebar ─────────────────────────────────────────────── */

function Sidebar({
  activeId,
  onNav,
}: {
  activeId: string;
  onNav: (id: string) => void;
}) {
  return (
    <nav className="space-y-1">
      {navigation.map((item) => (
        <div key={item.id}>
          <button
            onClick={() => onNav(item.id)}
            className={`block w-full text-left px-3 py-1.5 rounded text-[13px] transition-colors ${
              activeId === item.id
                ? "text-[hsl(var(--accent))] bg-[hsl(var(--accent))/0.08]"
                : "text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))] hover:bg-[hsl(var(--bg-raised))]"
            }`}
          >
            {item.label}
          </button>
          {item.children && (
            <div className="ml-3 mt-0.5 space-y-0.5">
              {item.children.map((child) => (
                <button
                  key={child.id}
                  onClick={() => onNav(child.id)}
                  className={`block w-full text-left px-3 py-1 rounded text-[12px] transition-colors ${
                    activeId === child.id
                      ? "text-[hsl(var(--accent))]"
                      : "text-[hsl(var(--text-secondary))] opacity-60 hover:opacity-100 hover:text-[hsl(var(--text-primary))]"
                  }`}
                >
                  {child.label}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </nav>
  );
}

/* ── Main ────────────────────────────────────────────────── */

export default function DocsContent() {
  const [activeId, setActiveId] = useState("getting-started");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const scrollTo = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      setActiveId(id);
      setMobileNavOpen(false);
    }
  }, []);

  // Track active section on scroll
  useEffect(() => {
    const allIds = navigation.flatMap((item) => [
      item.id,
      ...(item.children?.map((c) => c.id) ?? []),
    ]);

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        }
      },
      { rootMargin: "-80px 0px -60% 0px", threshold: 0 }
    );

    allIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-[hsl(var(--bg))]">
      {/* Top bar */}
      <header className="sticky top-0 z-50 border-b border-[hsl(var(--border))] bg-[hsl(var(--bg))/0.9] backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 md:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="text-[hsl(var(--accent))] font-mono text-[13px] tracking-tight hover:opacity-80 transition-opacity">
              you
            </Link>
            <span className="hidden sm:inline text-[13px] text-[hsl(var(--text-secondary))] opacity-50">
              /
            </span>
            <span className="hidden sm:inline text-[13px] text-[hsl(var(--text-primary))]">
              Documentation
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/create"
              className="text-[12px] font-mono text-[hsl(var(--accent))] hover:opacity-80 transition-opacity"
            >
              Get Started
            </Link>
            <button
              onClick={() => setMobileNavOpen(!mobileNavOpen)}
              className="md:hidden text-[hsl(var(--text-secondary))] text-[13px] font-mono"
            >
              {mobileNavOpen ? "close" : "menu"}
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto flex">
        {/* Sidebar — desktop */}
        <aside className="hidden md:block w-56 shrink-0 border-r border-[hsl(var(--border))]">
          <div className="sticky top-14 py-8 px-4 max-h-[calc(100vh-3.5rem)] overflow-y-auto">
            <Sidebar activeId={activeId} onNav={scrollTo} />
          </div>
        </aside>

        {/* Sidebar — mobile overlay */}
        {mobileNavOpen && (
          <div className="fixed inset-0 top-14 z-40 bg-[hsl(var(--bg))] md:hidden p-6 overflow-y-auto">
            <Sidebar activeId={activeId} onNav={scrollTo} />
          </div>
        )}

        {/* Content */}
        <main className="flex-1 min-w-0 px-6 md:px-12 py-10 md:py-12">
          <div className="max-w-2xl">
            {/* Page header */}
            <div className="mb-8">
              <p className="text-[12px] font-mono text-[hsl(var(--accent))] mb-2 uppercase tracking-wider">
                Documentation
              </p>
              <H1>you.md</H1>
              <P>
                The identity context protocol for the agent internet. An MCP where
                the context is you -- giving every AI agent full context about who
                you are.
              </P>
            </div>

            {/* ── Getting Started ──────────────────────────── */}
            <H2 id="getting-started">Getting Started</H2>
            <P>
              you.md is an identity context protocol that any AI agent can
              read. Think of it as a{" "}
              <InlineCode>.env</InlineCode> file for your identity -- your bio,
              projects, values, communication style, and preferences, all in one
              place.
            </P>

            <Callout type="tip">
              Create an account in seconds. Your data is encrypted and you
              control who sees what.
            </Callout>

            <H3 id="web-quickstart">Web Quickstart</H3>
            <StepList>
              <Step n={1}>
                Sign up at{" "}
                <Link
                  href="/sign-up"
                  className="text-[hsl(var(--accent))] hover:opacity-80"
                >
                  you.md/sign-up
                </Link>{" "}
                -- takes 30 seconds
              </Step>
              <Step n={2}>
                Pick a username and claim your profile
              </Step>
              <Step n={3}>
                The You Agent builds your identity through conversation
              </Step>
              <Step n={4}>
                Open the{" "}
                <Link
                  href="/dashboard"
                  className="text-[hsl(var(--accent))] hover:opacity-80"
                >
                  dashboard
                </Link>
                , type <InlineCode>/share</InlineCode> to get your shareable
                context link
              </Step>
            </StepList>

            <H3 id="cli-quickstart">CLI Quickstart</H3>
            <CodeBlock title="terminal">{`$ npx youmd register`}</CodeBlock>
            <StepList>
              <Step n={1}>
                Run <InlineCode>youmd register</InlineCode> to create your
                account (or <InlineCode>youmd login</InlineCode> if you already
                have one)
              </Step>
              <Step n={2}>
                Run <InlineCode>youmd init</InlineCode> -- the agent builds your
                identity through conversation
              </Step>
              <Step n={3}>
                Run <InlineCode>youmd push</InlineCode> to publish your profile
              </Step>
              <Step n={4}>
                Run <InlineCode>youmd chat</InlineCode> then type{" "}
                <InlineCode>/share</InlineCode> to get your context link
              </Step>
            </StepList>

            {/* ── Claude Code Integration ────────────────── */}
            <H2 id="claude-code">Claude Code Integration</H2>
            <P>
              Most you.md users work inside Claude Code, Cursor, or similar AI
              coding tools. Here's how to use you.md directly from your coding
              environment.
            </P>

            <Callout type="tip">
              The <InlineCode>youmd</InlineCode> CLI works in any terminal,
              including Claude Code's shell. Interactive commands (
              <InlineCode>init</InlineCode>, <InlineCode>chat</InlineCode>)
              need a regular terminal, but everything else works inside your
              coding agent.
            </Callout>

            <H3 id="cc-setup">Setup</H3>
            <StepList>
              <Step n={1}>
                Open a regular terminal (not inside Claude Code) and run{" "}
                <InlineCode>npx youmd init</InlineCode> to create your identity
              </Step>
              <Step n={2}>
                Run <InlineCode>youmd login</InlineCode> to authenticate
              </Step>
              <Step n={3}>
                Run <InlineCode>youmd push</InlineCode> to publish your profile
              </Step>
              <Step n={4}>
                Now switch to Claude Code — all non-interactive commands work
                from here
              </Step>
            </StepList>

            <H3 id="cc-commands">Commands That Work Inside Claude Code</H3>
            <P>
              These commands are non-interactive and work perfectly in Claude
              Code, Cursor, Copilot, and any AI coding tool:
            </P>
            <CommandTable
              commands={[
                { cmd: "youmd status", desc: "Check your bundle status and version" },
                { cmd: "youmd whoami", desc: "See who you're logged in as" },
                { cmd: "youmd pull", desc: "Download your profile from cloud" },
                { cmd: "youmd push", desc: "Upload local changes and publish" },
                { cmd: "youmd sync", desc: "Pull + push in one command" },
                { cmd: "youmd private", desc: "View your private context" },
                { cmd: "youmd private notes append \"text\"", desc: "Add to private notes" },
                { cmd: "youmd private projects add name desc", desc: "Add a private project" },
                { cmd: "youmd memories list", desc: "See saved memories" },
                { cmd: "youmd memories add fact \"content\"", desc: "Add a memory manually" },
                { cmd: "youmd link create", desc: "Create a shareable context link" },
                { cmd: "youmd keys list", desc: "List your API keys" },
                { cmd: "youmd build", desc: "Compile local bundle" },
                { cmd: "youmd publish", desc: "Publish to you.md" },
              ]}
            />
            <Callout type="info">
              <InlineCode>youmd init</InlineCode> and{" "}
              <InlineCode>youmd chat</InlineCode> are interactive and need a
              regular terminal (they use readline prompts). Run those first, then
              switch to Claude Code for everything else.
            </Callout>

            <H3 id="cc-workflow">Recommended Workflow</H3>
            <P>
              The most powerful workflow: let your coding agent update your
              identity context as you work together.
            </P>
            <StepList>
              <Step n={1}>
                Tell Claude Code: "add my preference for terminal-native UI to
                my you.md private context" — it can run{" "}
                <InlineCode>
                  youmd private notes append "prefers terminal-native UI"
                </InlineCode>
              </Step>
              <Step n={2}>
                After a coding session, tell your agent: "extract any
                preferences or facts about me from this conversation and save
                them to my you.md" — it can run{" "}
                <InlineCode>youmd memories add</InlineCode> commands
              </Step>
              <Step n={3}>
                Edit your <InlineCode>.youmd/</InlineCode> files directly (they're
                just markdown) and run{" "}
                <InlineCode>youmd push</InlineCode> to sync
              </Step>
              <Step n={4}>
                Use <InlineCode>youmd sync --watch</InlineCode> in a regular
                terminal to auto-push on every file save
              </Step>
              <Step n={5}>
                Share your context with any new agent:{" "}
                <InlineCode>youmd link create</InlineCode> generates a URL you
                can paste into any AI conversation
              </Step>
            </StepList>
            <P>
              Your identity stays up to date across every tool. Every agent
              knows who you are from the first message.
            </P>

            {/* ── Share ────────────────────────────────────── */}
            <H2 id="share">Share Your Identity</H2>
            <P>
              The core feature. Once your identity is built, share it with any AI
              agent in seconds. The <InlineCode>/share</InlineCode> command works
              in both the web dashboard and the CLI.
            </P>

            <H3 id="share-command">/share Command</H3>
            <P>
              Type <InlineCode>/share</InlineCode> in either the web dashboard
              terminal or inside <InlineCode>youmd chat</InlineCode> on the CLI.
              Both generate the same copyable block:
            </P>
            <CodeBlock title="output">{`> /share

--- BEGIN YOU.MD CONTEXT ---
name: Houston Golden
role: Founder & builder
projects: you.md, ...
values: ship fast, build in public
preferences: terminal-native, monochrome
--- END YOU.MD CONTEXT ---

[copied to clipboard]`}</CodeBlock>
            <P>
              Paste this into any AI conversation -- Claude, ChatGPT, Cursor,
              Copilot, or any agent. It instantly knows your bio, projects,
              values, and preferences.
            </P>
            <P>
              Use <InlineCode>/share --private</InlineCode> to include your
              private layer (contact info, internal notes, sensitive
              preferences). Only share this with agents you trust.
            </P>

            <H3 id="context-links">Context Links</H3>
            <P>
              Your public context is always available at{" "}
              <InlineCode>you.md/ctx/[username]</InlineCode>. Any agent can
              fetch this URL directly to load your context into their
              conversation.
            </P>

            {/* ── Sync ─────────────────────────────────────── */}
            <H2 id="sync">Sync</H2>
            <P>
              You.md works across web and CLI. Create your profile on either
              platform and keep them in sync.
            </P>

            <H3 id="web-cli-sync">Connecting Web + CLI</H3>
            <P>
              The CLI uses the same email and password as the web app -- no
              separate API token needed for your own account.
            </P>
            <StepList>
              <Step n={1}>Create your profile on either web or CLI</Step>
              <Step n={2}>
                <InlineCode>youmd login</InlineCode> -- enter the same email and
                password you use on the web
              </Step>
              <Step n={3}>
                <InlineCode>youmd pull</InlineCode> downloads your web profile to
                local files
              </Step>
              <Step n={4}>Edit files in any editor (Cursor, Obsidian, VS Code)</Step>
              <Step n={5}>
                <InlineCode>youmd push</InlineCode> compiles and publishes back
                to you.md
              </Step>
              <Step n={6}>
                <InlineCode>youmd sync --watch</InlineCode> auto-syncs on every
                file save
              </Step>
            </StepList>
            <Callout type="tip">
              API keys are for giving OTHER agents and apps access to your data,
              not for authenticating yourself. Your own CLI uses email/password auth.
            </Callout>

            <H3 id="file-structure">Local File Structure</H3>
            <CodeBlock title=".youmd/">{`.youmd/
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

            {/* ── CLI ──────────────────────────────────────── */}
            <H2 id="cli">CLI Reference</H2>
            <P>
              Install globally with <InlineCode>npm i -g youmd</InlineCode> or
              run commands directly with <InlineCode>npx youmd</InlineCode>.
              The CLI has 20 commands covering the full identity lifecycle.
            </P>

            <P>
              <strong className="text-[hsl(var(--text-primary))]">Identity</strong>
            </P>
            <CommandTable
              commands={[
                {
                  cmd: "youmd init",
                  desc: "Conversational AI onboarding -- builds your identity through dialogue",
                },
                { cmd: "youmd chat", desc: "Ongoing conversation with the You Agent to evolve your profile" },
                {
                  cmd: "youmd build",
                  desc: "Compile local markdown files into you.json + you.md",
                },
                {
                  cmd: "youmd publish",
                  desc: "Upload and publish compiled bundle to you.md",
                },
                {
                  cmd: "youmd status",
                  desc: "Show bundle version, publish status, and auth state",
                },
                {
                  cmd: "youmd diff",
                  desc: "Show changes between local files and published version",
                },
                {
                  cmd: "youmd export",
                  desc: "Export you.json and/or you.md to disk (--json, --md, -o path)",
                },
                {
                  cmd: "youmd add TYPE URL",
                  desc: "Add a source (website, linkedin, x, blog, github)",
                },
              ]}
            />

            <P>
              <strong className="text-[hsl(var(--text-primary))]">Auth & Sync</strong>
            </P>
            <CommandTable
              commands={[
                {
                  cmd: "youmd login",
                  desc: "Email/password login (or --key KEY, --web to open browser)",
                },
                {
                  cmd: "youmd register",
                  desc: "Create a new account from the CLI",
                },
                {
                  cmd: "youmd whoami",
                  desc: "Show current authenticated user",
                },
                {
                  cmd: "youmd pull",
                  desc: "Download profile from web to local .youmd/ files",
                },
                {
                  cmd: "youmd push",
                  desc: "Upload local files to web and publish",
                },
                {
                  cmd: "youmd sync",
                  desc: "Pull + push in one command (--watch for auto-sync on save)",
                },
              ]}
            />

            <P>
              <strong className="text-[hsl(var(--text-primary))]">Access & Sharing</strong>
            </P>
            <CommandTable
              commands={[
                {
                  cmd: "youmd link create",
                  desc: "Generate shareable context link (--scope, --ttl, --max-uses)",
                },
                { cmd: "youmd link list", desc: "List active context links" },
                { cmd: "youmd link preview TOKEN", desc: "Preview what an agent sees for a link" },
                { cmd: "youmd link revoke ID", desc: "Revoke a context link" },
                {
                  cmd: "youmd keys list",
                  desc: "List API keys",
                },
                { cmd: "youmd keys create", desc: "Create a new API key" },
              ]}
            />

            <P>
              <strong className="text-[hsl(var(--text-primary))]">Memory & Context</strong>
            </P>
            <CommandTable
              commands={[
                { cmd: "youmd memories list", desc: "List saved memories" },
                { cmd: "youmd memories add CATEGORY \"content\"", desc: "Add a memory (fact, preference, goal, etc.)" },
                { cmd: "youmd memories stats", desc: "Memory count by category" },
                { cmd: "youmd private", desc: "View all private context" },
                { cmd: "youmd private notes set", desc: "Set private notes (stdin or interactive)" },
                { cmd: "youmd private notes append \"text\"", desc: "Append to private notes" },
                { cmd: "youmd private projects add NAME", desc: "Add a private project" },
                { cmd: "youmd project init NAME", desc: "Initialize project-specific context" },
                { cmd: "youmd project list", desc: "List known projects" },
              ]}
            />

            <Callout type="info">
              The <InlineCode>init</InlineCode> and <InlineCode>chat</InlineCode>{" "}
              commands are interactive and use a conversational AI agent. They
              need a regular terminal (not inside Claude Code). All other
              commands are non-interactive.
            </Callout>

            {/* ── API ──────────────────────────────────────── */}
            <H2 id="api">API</H2>
            <P>
              You.md has 30+ HTTP endpoints for programmatic access. All
              authenticated endpoints use Bearer token auth with{" "}
              <InlineCode>ym_</InlineCode> prefixed API keys.
            </P>

            <H3 id="public-endpoints">Public Endpoints</H3>
            <CodeBlock title="HTTP">{`# Fetch a public profile (JSON)
GET /api/v1/profiles?username=houstongolden

# List all profiles
GET /api/v1/profiles

# Check username availability
GET /api/v1/check-username?username=newuser

# Resolve a context link (plain text for agents)
GET /ctx/{username}/{token}

# Register a new account
POST /api/v1/auth/register
{ "email": "...", "password": "...", "username": "...", "name": "..." }

# Login
POST /api/v1/auth/login
{ "email": "...", "password": "..." }`}</CodeBlock>
            <P>
              Context links at <InlineCode>/ctx/username/token</InlineCode>{" "}
              return identity context optimized for AI consumption. Use
              scope &quot;full&quot; to include private context.
            </P>

            <H3 id="authenticated-endpoints">Authenticated Endpoints</H3>
            <P>
              Include your API key as a Bearer token. Generate keys from the
              dashboard (<InlineCode>/settings</InlineCode>) or via CLI (
              <InlineCode>youmd keys create</InlineCode>).
            </P>
            <CodeBlock title="HTTP">{`Authorization: Bearer ym_your_api_key_here

# Your profile
GET  /api/v1/me

# Bundle management
POST /api/v1/me/bundle          # Save bundle
POST /api/v1/me/publish         # Publish latest

# Sources
GET  /api/v1/me/sources         # List connected sources
POST /api/v1/me/sources         # Add a source URL

# Memories
GET  /api/v1/me/memories        # List (optional: ?category=fact&limit=10)
POST /api/v1/me/memories        # Save from external agent

# Context links
POST /api/v1/me/context-links   # Create
GET  /api/v1/me/context-links   # List
DELETE /api/v1/me/context-links # Revoke

# Private context
GET  /api/v1/me/private         # Read private data
POST /api/v1/me/private         # Update private data

# LLM Chat
POST /api/v1/chat               # Non-streaming
POST /api/v1/chat/stream        # SSE streaming

# Enrichment
POST /api/v1/scrape             # Scrape a URL
POST /api/v1/research           # Web research via Perplexity
POST /api/v1/enrich-x           # X/Twitter enrichment
POST /api/v1/enrich-linkedin    # LinkedIn enrichment`}</CodeBlock>

            {/* ── Privacy ──────────────────────────────────── */}
            <H2 id="privacy">Privacy</H2>
            <P>You.md uses a two-layer privacy model:</P>
            <div className="my-4 space-y-3">
              <div className="flex gap-3 text-[15px] leading-relaxed">
                <span className="shrink-0 text-[hsl(var(--accent))] font-mono text-[13px] mt-0.5">
                  public
                </span>
                <span className="text-[hsl(var(--text-secondary))]">
                  Your bio, role, projects, values, and communication style.
                  Visible to anyone and any agent.
                </span>
              </div>
              <div className="flex gap-3 text-[15px] leading-relaxed">
                <span className="shrink-0 text-[hsl(var(--accent))] font-mono text-[13px] mt-0.5">
                  private
                </span>
                <span className="text-[hsl(var(--text-secondary))]">
                  Contact info, internal notes, sensitive preferences, API keys.
                  Only shared via{" "}
                  <InlineCode>/share --private</InlineCode> or access tokens.
                </span>
              </div>
            </div>
            <P>
              Access tokens can be generated from the dashboard via{" "}
              <InlineCode>/tokens</InlineCode>. Each token has configurable scope
              and can be revoked at any time.
            </P>
            <Callout type="tip">
              You control what goes into each layer. Nothing is shared without
              your explicit action.
            </Callout>

            {/* ── Dashboard Commands ────────────────────────── */}
            <H2 id="commands">Dashboard Commands</H2>
            <P>
              The web dashboard terminal supports the following slash commands:
            </P>
            <CommandTable
              commands={[
                {
                  cmd: "/share",
                  desc: "Generate shareable identity context block",
                },
                {
                  cmd: "/share --private",
                  desc: "Include private layer in context block",
                },
                { cmd: "/preview", desc: "Preview your public profile" },
                { cmd: "/json", desc: "Export identity as raw JSON" },
                { cmd: "/settings", desc: "Open account settings" },
                { cmd: "/tokens", desc: "Manage API access tokens" },
                { cmd: "/billing", desc: "View billing and subscription" },
                {
                  cmd: "/status",
                  desc: "Check profile completeness and status",
                },
                {
                  cmd: "/publish",
                  desc: "Publish latest changes to your public profile",
                },
                { cmd: "/help", desc: "Show all available commands" },
              ]}
            />

            {/* Footer */}
            <div className="border-t border-[hsl(var(--border))] mt-16 pt-8 flex items-center justify-between">
              <span className="text-[12px] text-[hsl(var(--text-secondary))] opacity-40">
                you.md -- identity context protocol for the agent internet
              </span>
              <Link
                href="/create"
                className="text-[13px] text-[hsl(var(--accent))] hover:opacity-80 transition-opacity"
              >
                Get Started
              </Link>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
