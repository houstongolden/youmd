"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useConvexAuth } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { GithubRepoSection } from "./GithubRepoSection";
import { GithubOnboarding } from "./GithubOnboarding";
import { SourcesPane } from "./SourcesPane";
import { PaneDivider, PaneHeader, PaneSectionLabel } from "./shared";
import {
  Bot,
  CalendarDays,
  Check,
  ChevronRight,
  Code2,
  Database,
  FileJson,
  Flame,
  FolderGit2,
  KeyRound,
  Layers3,
  Link2,
  LockKeyhole,
  Mail,
  MessageSquare,
  Plug,
  Radar,
  RefreshCcw,
  Search,
  ServerCog,
  Share2,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import type { Id } from "../../../convex/_generated/dataModel";

interface GithubPaneProps {
  clerkId: string;
  username: string;
  userId: Id<"users">;
}

type ConnectorTab = "api" | "apps" | "crawlers" | "repo";
type ConnectorCategory =
  | "all"
  | "owned"
  | "custom"
  | "productivity"
  | "dev"
  | "marketing"
  | "sales"
  | "google"
  | "microsoft"
  | "media"
  | "data";

type ConnectorSpec = {
  slug: string;
  name: string;
  detail: string;
  category: Exclude<ConnectorCategory, "all">;
  type: "api" | "mcp" | "oauth" | "source" | "webhook";
  pinned?: boolean;
  enabled?: boolean;
  scopes: string[];
  resources: string[];
  writePolicy?: "read_only" | "propose" | "approved_write";
  trustLevel?: "low" | "medium" | "high" | "verified";
};

type GrantView = {
  id: Id<"connectedAppGrants">;
  appSlug: string;
  appName: string;
  appType: string;
  scopes: string[];
  resourceScopes: string[];
  writePolicy: string;
  trustLevel: string;
  expiresAt: string;
  revokedAt: string | null;
  lastUsedAt: string | null;
  isActive: boolean;
};

const TABS: Array<{ key: ConnectorTab; label: string }> = [
  { key: "api", label: "api/mcp" },
  { key: "apps", label: "apps" },
  { key: "crawlers", label: "crawlers/loops" },
  { key: "repo", label: "repo" },
];

const CATEGORIES: Array<{ key: ConnectorCategory; label: string }> = [
  { key: "all", label: "all" },
  { key: "owned", label: "you.md family" },
  { key: "custom", label: "custom" },
  { key: "productivity", label: "productivity" },
  { key: "dev", label: "dev" },
  { key: "marketing", label: "marketing" },
  { key: "sales", label: "sales" },
  { key: "google", label: "google" },
  { key: "microsoft", label: "microsoft" },
  { key: "media", label: "media" },
  { key: "data", label: "data" },
];

const CONNECTORS: ConnectorSpec[] = [
  {
    slug: "youmd-api",
    name: "You.md API",
    detail: "private brain, memories, projects, sources, activity, and bundle endpoints",
    category: "owned",
    type: "api",
    pinned: true,
    enabled: true,
    scopes: ["identity:read", "projects:read", "sources:read", "memories:read", "stacks:read", "activity:read"],
    resources: ["identity", "projects", "sources", "memories", "stacks", "activity"],
    writePolicy: "read_only",
    trustLevel: "verified",
  },
  {
    slug: "youmd-mcp",
    name: "You.md MCP",
    detail: "global and stack-scoped MCP endpoint for Claude Code, Codex, Cursor, ChatGPT, and local agents",
    category: "owned",
    type: "mcp",
    pinned: true,
    enabled: true,
    scopes: ["identity:read", "projects:read", "preferences:read", "stacks:read", "activity:read"],
    resources: ["identity", "projects", "preferences", "stacks", "activity"],
    writePolicy: "read_only",
    trustLevel: "verified",
  },
  {
    slug: "youstacks",
    name: "YouStacks",
    detail: "named packages of skills, workflows, prompts, tools, docs, tests, adapters, and update policy",
    category: "owned",
    type: "mcp",
    pinned: true,
    enabled: true,
    scopes: ["stacks:read", "activity:read"],
    resources: ["stacks", "activity"],
    writePolicy: "propose",
    trustLevel: "verified",
  },
  {
    slug: "custom-mcp",
    name: "Custom MCP",
    detail: "grant a local or hosted MCP client scoped access to your personal brain",
    category: "custom",
    type: "mcp",
    pinned: true,
    scopes: ["identity:read", "projects:read", "sources:read", "memories:read"],
    resources: ["identity", "projects", "sources", "memories"],
  },
  {
    slug: "custom-api",
    name: "Custom API",
    detail: "issue a named app grant for a private service, script, crawler, or owned product",
    category: "custom",
    type: "api",
    pinned: true,
    scopes: ["identity:read", "projects:read", "sources:read", "activity:read"],
    resources: ["identity", "projects", "sources", "activity"],
  },
  {
    slug: "custom-webhook",
    name: "Custom Webhook",
    detail: "push updates into sources, memories, projects, or activity with approval-aware writes",
    category: "custom",
    type: "webhook",
    pinned: true,
    scopes: ["sources:write", "activity:write"],
    resources: ["sources", "activity"],
    writePolicy: "propose",
  },
  {
    slug: "h-computer",
    name: "h.computer",
    detail: "Houston's personal site and reference implementation reading/writing You.md context",
    category: "owned",
    type: "api",
    pinned: true,
    scopes: ["identity:read", "projects:read", "sources:read", "memories:write", "activity:write"],
    resources: ["identity", "projects", "sources", "memories", "activity"],
    writePolicy: "propose",
    trustLevel: "verified",
  },
  {
    slug: "bamf-ai",
    name: "BAMF.ai",
    detail: "creator engine, content context, brand kits, approvals, scheduling, and BAMFStack",
    category: "owned",
    type: "api",
    pinned: true,
    scopes: ["identity:read", "projects:read", "preferences:read", "stacks:read"],
    resources: ["identity", "projects", "preferences", "stacks"],
    trustLevel: "verified",
  },
  {
    slug: "bad-app",
    name: "bad.app",
    detail: "health graph and badstack style prior art for source-fused personal APIs",
    category: "owned",
    type: "api",
    pinned: true,
    scopes: ["identity:read", "projects:read", "sources:read", "activity:write"],
    resources: ["identity", "projects", "sources", "activity"],
    writePolicy: "propose",
    trustLevel: "high",
  },
  {
    slug: "foldermd",
    name: "folder.md",
    detail: "folder-native docs, API, MCP, and stack context as a connected project brain",
    category: "owned",
    type: "mcp",
    pinned: true,
    scopes: ["projects:read", "stacks:read", "activity:read"],
    resources: ["projects", "stacks", "activity"],
    trustLevel: "high",
  },
  { slug: "github", name: "GitHub", detail: "repos, issues, pull requests, code context, and stack manifests", category: "dev", type: "oauth", enabled: true, scopes: ["projects:read", "projects:write", "stacks:read"], resources: ["projects", "stacks"], writePolicy: "propose", trustLevel: "verified" },
  { slug: "firecrawl", name: "Firecrawl", detail: "AI-powered scraper, search, retrieval, and rendered page extraction", category: "data", type: "source", enabled: true, scopes: ["sources:read", "sources:write"], resources: ["sources"], writePolicy: "propose", trustLevel: "high" },
  { slug: "gmail", name: "Gmail", detail: "read, send, and manage emails as scoped context", category: "google", type: "oauth", scopes: ["sources:read", "activity:write"], resources: ["sources", "activity"] },
  { slug: "google-calendar", name: "Google Calendar", detail: "calendar context, availability, and meeting prep", category: "google", type: "oauth", scopes: ["sources:read", "activity:write"], resources: ["sources", "activity"] },
  { slug: "notion", name: "Notion", detail: "pages, databases, notes, SOPs, and docs", category: "productivity", type: "oauth", scopes: ["sources:read", "sources:write"], resources: ["sources"], writePolicy: "propose" },
  { slug: "slack", name: "Slack", detail: "workspace messages, team context, and notifications", category: "productivity", type: "oauth", scopes: ["sources:read", "activity:write"], resources: ["sources", "activity"] },
  { slug: "linear", name: "Linear", detail: "issues, projects, roadmaps, and execution state", category: "productivity", type: "mcp", scopes: ["projects:read", "activity:write"], resources: ["projects", "activity"] },
  { slug: "stripe", name: "Stripe", detail: "customers, billing, subscriptions, and payments context", category: "sales", type: "oauth", scopes: ["sources:read", "activity:read"], resources: ["sources", "activity"] },
  { slug: "shopify", name: "Shopify", detail: "commerce store, orders, products, and customer context", category: "sales", type: "oauth", scopes: ["sources:read"], resources: ["sources"] },
  { slug: "supabase", name: "Supabase", detail: "connect app data and project tables into your context graph", category: "dev", type: "api", scopes: ["sources:read", "sources:write"], resources: ["sources"], writePolicy: "propose" },
  { slug: "vercel", name: "Vercel", detail: "deployments, projects, env state, and preview links", category: "dev", type: "api", scopes: ["projects:read", "activity:read"], resources: ["projects", "activity"] },
  { slug: "cloudflare", name: "Cloudflare", detail: "domains, workers, DNS, and edge runtime context", category: "dev", type: "api", scopes: ["projects:read", "activity:read"], resources: ["projects", "activity"] },
  { slug: "openai", name: "OpenAI", detail: "model, agent, and ChatGPT app context with BYOK-ready boundaries", category: "dev", type: "api", scopes: ["stacks:read", "activity:read"], resources: ["stacks", "activity"] },
  { slug: "perplexity", name: "Perplexity", detail: "research answers, citations, and web intelligence", category: "data", type: "api", scopes: ["sources:read", "activity:write"], resources: ["sources", "activity"] },
  { slug: "figma", name: "Figma", detail: "design files, local MCP, and product context", category: "productivity", type: "mcp", scopes: ["projects:read", "sources:read"], resources: ["projects", "sources"] },
  { slug: "airtable", name: "Airtable", detail: "bases, records, and spreadsheet-database context", category: "data", type: "oauth", scopes: ["sources:read", "sources:write"], resources: ["sources"], writePolicy: "propose" },
  { slug: "google-drive", name: "Google Drive", detail: "files, folders, PDFs, docs, and shared assets", category: "google", type: "oauth", scopes: ["sources:read"], resources: ["sources"] },
  { slug: "google-sheets", name: "Google Sheets", detail: "spreadsheets as structured source tables", category: "google", type: "oauth", scopes: ["sources:read", "sources:write"], resources: ["sources"], writePolicy: "propose" },
  { slug: "google-docs", name: "Google Docs", detail: "docs, SOPs, briefs, and writing references", category: "google", type: "oauth", scopes: ["sources:read", "sources:write"], resources: ["sources"], writePolicy: "propose" },
  { slug: "microsoft-outlook", name: "Microsoft Outlook", detail: "email and calendar context for Microsoft accounts", category: "microsoft", type: "oauth", scopes: ["sources:read", "activity:write"], resources: ["sources", "activity"] },
  { slug: "microsoft-onedrive", name: "Microsoft OneDrive", detail: "files and folders from Microsoft 365", category: "microsoft", type: "oauth", scopes: ["sources:read"], resources: ["sources"] },
  { slug: "hubspot", name: "HubSpot", detail: "CRM, deals, contacts, marketing, and sales context", category: "sales", type: "oauth", scopes: ["sources:read", "activity:write"], resources: ["sources", "activity"] },
  { slug: "salesforce", name: "Salesforce", detail: "CRM objects, accounts, opportunities, and notes", category: "sales", type: "oauth", scopes: ["sources:read"], resources: ["sources"] },
  { slug: "resend", name: "Resend", detail: "email API events, audiences, and delivery context", category: "marketing", type: "api", scopes: ["activity:read", "activity:write"], resources: ["activity"], writePolicy: "propose" },
  { slug: "twilio", name: "Twilio", detail: "SMS, voice, messaging, and notifications", category: "marketing", type: "api", scopes: ["activity:read", "activity:write"], resources: ["activity"], writePolicy: "propose" },
  { slug: "posthog", name: "PostHog", detail: "analytics, flags, experiments, and product usage", category: "data", type: "api", scopes: ["sources:read", "activity:read"], resources: ["sources", "activity"] },
  { slug: "sentry", name: "Sentry", detail: "issues, errors, releases, and debugging context", category: "dev", type: "api", scopes: ["projects:read", "activity:read"], resources: ["projects", "activity"] },
  { slug: "n8n", name: "n8n", detail: "workflows and automations as callable tools", category: "dev", type: "mcp", scopes: ["sources:read", "activity:write"], resources: ["sources", "activity"], writePolicy: "propose" },
  { slug: "linkedin", name: "LinkedIn", detail: "profile, posts, comments, and professional graph context", category: "marketing", type: "source", scopes: ["sources:read", "sources:write"], resources: ["sources"], writePolicy: "propose" },
  { slug: "x", name: "X / Twitter", detail: "posts, interests, social graph, and public context", category: "marketing", type: "source", scopes: ["sources:read", "sources:write"], resources: ["sources"], writePolicy: "propose" },
  { slug: "wordpress", name: "WordPress", detail: "posts, pages, media, and site content", category: "marketing", type: "oauth", scopes: ["sources:read", "sources:write"], resources: ["sources"], writePolicy: "propose" },
  { slug: "substack", name: "Substack", detail: "newsletter posts, audience content, and RSS", category: "marketing", type: "source", scopes: ["sources:read", "sources:write"], resources: ["sources"], writePolicy: "propose" },
  { slug: "rss", name: "RSS", detail: "any feed as monitored source context", category: "custom", type: "source", scopes: ["sources:read", "sources:write"], resources: ["sources"], writePolicy: "propose" },
  { slug: "elevenlabs", name: "ElevenLabs", detail: "voice generation, transcription, and speech workflows", category: "media", type: "api", scopes: ["sources:read", "activity:write"], resources: ["sources", "activity"] },
  { slug: "replicate", name: "Replicate", detail: "open model runs for image, video, and audio workflows", category: "media", type: "api", scopes: ["activity:read", "activity:write"], resources: ["activity"] },
  { slug: "telegram", name: "Telegram", detail: "bot messages, channels, and lightweight notifications", category: "marketing", type: "api", scopes: ["activity:read", "activity:write"], resources: ["activity"], writePolicy: "propose" },
  { slug: "strava", name: "Strava", detail: "fitness activity source for public or private life context", category: "data", type: "oauth", scopes: ["sources:read"], resources: ["sources"] },
  { slug: "spotify", name: "Spotify", detail: "music, listening state, and taste context", category: "media", type: "oauth", scopes: ["sources:read"], resources: ["sources"] },
];

const API_ENDPOINTS = [
  ["GET", "/api/v1/me", "owner profile, account, and current bundle pointer"],
  ["POST", "/api/v1/me/bundle", "write compiled identity context"],
  ["POST", "/api/v1/me/publish", "publish latest public profile bundle"],
  ["GET", "/api/v1/me/private", "private notes, projects, links, preferences, and custom data"],
  ["GET", "/api/v1/me/memories", "searchable durable memories"],
  ["POST", "/api/v1/me/memories", "append memories with source metadata"],
  ["GET", "/api/v1/me/sources", "connected sources, crawlers, trust, provenance, and refresh status"],
  ["POST", "/api/v1/me/sources", "add a source, webhook, feed, JSON endpoint, or crawler target"],
  ["GET", "/api/v1/me/activity", "agent, app, MCP, and token activity log"],
  ["GET", "/api/v1/me/repo/files", "mirrored repo files and stack folders"],
  ["GET", "/api/v1/me/repo/stacks", "derived repo-hosted YouStacks"],
  ["POST", "/api/v1/mcp", "global hosted MCP endpoint"],
  ["POST", "/api/v1/mcp/{user}/{stack}", "stack-scoped hosted MCP endpoint"],
  ["GET", "/.well-known/mcp.json", "MCP discovery"],
] as const;

const ACCESS_ROWS = [
  ["public", "published profile, public stacks, docs, llms.txt", "open"],
  ["auth", "owner shell, settings, files, sources, sessions", "cookie"],
  ["api key", "CLI and owner-controlled agents using ymd_* keys", "scoped"],
  ["app grant", "named apps and MCP clients using yg_* grants", "scoped"],
  ["context link", "expiring project/profile/private bundles", "limited"],
] as const;

const RESOURCE_ROWS = [
  ["identity", "public profile, bio, links, portrait, now, and bundle metadata"],
  ["projects", "private and public project folders, repo mirror, current work"],
  ["sources", "connectors, crawlers, versions, provenance, refresh policy"],
  ["memories", "durable facts, decisions, preferences, and session summaries"],
  ["preferences", "agent behavior, writing style, tool choices, trust rules"],
  ["stacks", "YouStacks, skills, workflows, prompts, adapters, tests"],
  ["activity", "agent/API/MCP reads, writes, denials, and grant usage"],
] as const;

function connectorIcon(spec: ConnectorSpec) {
  if (spec.slug.includes("gmail") || spec.slug.includes("outlook") || spec.slug === "resend") return Mail;
  if (spec.slug.includes("calendar")) return CalendarDays;
  if (spec.slug.includes("github") || spec.slug === "foldermd") return FolderGit2;
  if (spec.slug === "firecrawl") return Flame;
  if (spec.type === "mcp") return ServerCog;
  if (spec.type === "webhook") return Link2;
  if (spec.category === "data") return Database;
  if (spec.category === "marketing") return MessageSquare;
  if (spec.category === "owned") return Sparkles;
  return Plug;
}

function shortDate(value: string | null) {
  if (!value || value === "never") return value ?? "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function GithubPane({ clerkId, username, userId }: GithubPaneProps) {
  const { isAuthenticated } = useConvexAuth();
  const searchParams = useSearchParams();
  const wantsGithub = searchParams.get("integration") === "github";
  const [activeTab, setActiveTab] = useState<ConnectorTab>(wantsGithub ? "repo" : "api");
  const [category, setCategory] = useState<ConnectorCategory>("all");
  const [search, setSearch] = useState("");
  const [issuedToken, setIssuedToken] = useState<{ appName: string; token: string } | null>(null);
  const [grantError, setGrantError] = useState<string | null>(null);
  const [grantBusySlug, setGrantBusySlug] = useState<string | null>(null);

  const connection = useQuery(
    api.github.getConnection,
    isAuthenticated && clerkId ? { clerkId } : "skip"
  );
  const grants = useQuery(
    api.connectedApps.listGrants,
    isAuthenticated && clerkId ? { clerkId } : "skip"
  ) as GrantView[] | undefined;
  const createGrant = useMutation(api.connectedApps.createGrant);
  const revokeGrant = useMutation(api.connectedApps.revokeGrant);

  const isConnected = connection !== null && connection !== undefined;
  const hasRepo = isConnected && !!connection?.repoFullName;
  const showOnboarding = isConnected && (wantsGithub || !hasRepo);
  const activeGrants = (grants ?? []).filter((grant) => grant.isActive);

  const filteredConnectors = useMemo(() => {
    const q = search.trim().toLowerCase();
    return CONNECTORS.filter((connector) => {
      const matchesCategory = category === "all" || connector.category === category;
      const matchesSearch =
        !q ||
        connector.name.toLowerCase().includes(q) ||
        connector.detail.toLowerCase().includes(q) ||
        connector.slug.includes(q);
      return matchesCategory && matchesSearch;
    }).sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || a.name.localeCompare(b.name));
  }, [category, search]);

  const grantFor = (slug: string) => activeGrants.find((grant) => grant.appSlug === slug);

  async function issueGrant(spec: ConnectorSpec) {
    setGrantBusySlug(spec.slug);
    setGrantError(null);
    setIssuedToken(null);
    try {
      const result = await createGrant({
        clerkId,
        appSlug: spec.slug,
        appName: spec.name,
        appType: spec.category === "owned" ? "first_party" : spec.type === "mcp" ? "mcp_client" : spec.category === "custom" ? "custom" : "third_party",
        scopes: spec.scopes,
        resourceScopes: spec.resources,
        writePolicy: spec.writePolicy ?? "read_only",
        trustLevel: spec.trustLevel ?? (spec.category === "owned" ? "verified" : "medium"),
        ttl: spec.category === "owned" ? "never" : "30d",
        metadata: {
          connectorType: spec.type,
          category: spec.category,
          createdFrom: "dashboard-connectors-pane",
        },
      });
      setIssuedToken({ appName: spec.name, token: result.token });
    } catch (err) {
      setGrantError(err instanceof Error ? err.message : "Could not create grant");
    } finally {
      setGrantBusySlug(null);
    }
  }

  async function revoke(grantId: Id<"connectedAppGrants">) {
    setGrantError(null);
    try {
      await revokeGrant({ clerkId, grantId });
      setIssuedToken(null);
    } catch (err) {
      setGrantError(err instanceof Error ? err.message : "Could not revoke grant");
    }
  }

  return (
    <div className="flex h-full flex-col">
      <PaneHeader>connectors</PaneHeader>

      <div className="flex shrink-0 items-center gap-3 overflow-x-auto border-b border-[hsl(var(--border))]/60 px-4 scrollbar-none">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`relative h-10 cursor-pointer whitespace-nowrap px-1 font-mono text-[10px] transition-colors ${
              activeTab === tab.key
                ? "text-[hsl(var(--text-primary))]"
                : "text-[hsl(var(--text-secondary))] opacity-35 hover:opacity-70"
            }`}
          >
            {tab.label}
            {activeTab === tab.key && (
              <span className="absolute bottom-0 left-0 h-px w-full bg-[hsl(var(--accent))]" />
            )}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        {activeTab === "api" && (
          <div className="px-6 py-6">
            <div className="max-w-5xl space-y-7">
              <section>
                <PaneSectionLabel>private human api</PaneSectionLabel>
                <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
                  <div>
                    <h2 className="font-mono text-[18px] leading-tight text-[hsl(var(--text-primary))]">
                      @{username}&apos;s personal API/MCP is the structured boundary around the brain.
                    </h2>
                    <p className="mt-3 max-w-2xl font-mono text-[11px] leading-relaxed text-[hsl(var(--text-secondary))] opacity-65">
                      Agents should not scrape a profile page and guess. They get a named grant,
                      a documented route, scoped resources, and an auditable trail.
                    </p>
                    <div className="mt-5 grid gap-2 sm:grid-cols-2">
                      {ACCESS_ROWS.map(([label, detail, status]) => (
                        <div key={label} className="border-l border-[hsl(var(--border))]/80 bg-[hsl(var(--bg))]/45 px-3 py-2">
                          <div className="flex items-center gap-2 font-mono text-[10px] text-[hsl(var(--text-primary))]">
                            {label === "app grant" ? <ShieldCheck size={13} /> : label === "api key" ? <KeyRound size={13} /> : label === "context link" ? <Share2 size={13} /> : <LockKeyhole size={13} />}
                            <span>{label}</span>
                            <span className="ml-auto text-[8px] uppercase tracking-[0.16em] text-[hsl(var(--accent))] opacity-60">
                              {status}
                            </span>
                          </div>
                          <p className="mt-1 font-mono text-[9.5px] leading-4 text-[hsl(var(--text-secondary))] opacity-48">
                            {detail}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-[hsl(var(--bg))]/45 p-4">
                    <PaneSectionLabel>agent install contract</PaneSectionLabel>
                    <div className="space-y-3 font-mono text-[10px] leading-5 text-[hsl(var(--text-secondary))] opacity-65">
                      <p><span className="text-[hsl(var(--text-primary))]">rest</span> https://you.md/api/v1/me</p>
                      <p><span className="text-[hsl(var(--text-primary))]">mcp</span> https://you.md/api/v1/mcp</p>
                      <p><span className="text-[hsl(var(--text-primary))]">stack</span> https://you.md/api/v1/mcp/{username}/youstack</p>
                      <p><span className="text-[hsl(var(--text-primary))]">auth</span> Authorization: Bearer ymd_* or yg_*</p>
                    </div>
                    <div className="mt-4 border-t border-[hsl(var(--border))]/45 pt-3 font-mono text-[9.5px] leading-5 text-[hsl(var(--text-secondary))] opacity-45">
                      This is the owner-facing doc surface. Public docs describe You.md.
                      This panel describes this user&apos;s private callable boundary.
                    </div>
                  </div>
                </div>
              </section>

              <section>
                <PaneSectionLabel>resource map</PaneSectionLabel>
                <div className="grid gap-x-6 gap-y-3 md:grid-cols-2">
                  {RESOURCE_ROWS.map(([label, detail]) => (
                    <div key={label} className="flex items-start gap-3 border-t border-[hsl(var(--border))]/45 pt-3">
                      <div className="mt-0.5 text-[hsl(var(--accent))] opacity-75">
                        {label === "sources" ? <Radar size={14} /> : label === "stacks" ? <Layers3 size={14} /> : label === "memories" ? <Bot size={14} /> : <Code2 size={14} />}
                      </div>
                      <div>
                        <p className="font-mono text-[11px] text-[hsl(var(--text-primary))]">{label}</p>
                        <p className="mt-1 font-mono text-[9.5px] leading-4 text-[hsl(var(--text-secondary))] opacity-48">
                          {detail}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <PaneSectionLabel>private endpoint docs</PaneSectionLabel>
                <div className="overflow-hidden border border-[hsl(var(--border))]/70 bg-[hsl(var(--bg))]/35">
                  {API_ENDPOINTS.map(([method, path, detail]) => (
                    <div key={`${method}-${path}`} className="grid gap-2 border-b border-[hsl(var(--border))]/45 px-3 py-2 last:border-b-0 md:grid-cols-[58px_minmax(220px,0.8fr)_1fr]">
                      <span className="font-mono text-[9px] text-[hsl(var(--accent))]">{method}</span>
                      <code className="min-w-0 break-all font-mono text-[10px] text-[hsl(var(--text-primary))]">{path}</code>
                      <span className="font-mono text-[9.5px] leading-4 text-[hsl(var(--text-secondary))] opacity-50">{detail}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <div className="flex items-center justify-between gap-3">
                  <PaneSectionLabel>connected app grants</PaneSectionLabel>
                  <button
                    type="button"
                    onClick={() => setActiveTab("apps")}
                    className="font-mono text-[10px] text-[hsl(var(--accent))] opacity-75 hover:opacity-100"
                  >
                    add grant
                  </button>
                </div>
                {grants === undefined ? (
                  <p className="font-mono text-[10px] text-[hsl(var(--text-secondary))] opacity-40">loading grants...</p>
                ) : grants.length === 0 ? (
                  <div className="border border-[hsl(var(--border))]/60 bg-[hsl(var(--bg))]/35 p-4 font-mono text-[10px] text-[hsl(var(--text-secondary))] opacity-50">
                    no named app grants yet. create one from the apps tab.
                  </div>
                ) : (
                  <GrantList grants={grants} onRevoke={revoke} />
                )}
              </section>
            </div>
          </div>
        )}

        {activeTab === "apps" && (
          <div className="grid min-h-full md:grid-cols-[210px_minmax(0,1fr)]">
            <aside className="border-b border-[hsl(var(--border))]/60 p-4 md:border-b-0 md:border-r">
              <div className="flex h-9 items-center gap-2 border border-[hsl(var(--border))]/70 bg-[hsl(var(--bg))]/45 px-3">
                <Search size={14} className="shrink-0 text-[hsl(var(--text-secondary))] opacity-45" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search"
                  className="min-w-0 flex-1 bg-transparent font-mono text-[12px] text-[hsl(var(--text-primary))] outline-none placeholder:text-[hsl(var(--text-secondary))] placeholder:opacity-35"
                />
              </div>
              <nav className="mt-4 space-y-1" aria-label="Connector categories">
                {CATEGORIES.map((item) => {
                  const count = item.key === "all" ? CONNECTORS.length : CONNECTORS.filter((connector) => connector.category === item.key).length;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setCategory(item.key)}
                      className={`flex h-8 w-full items-center gap-2 px-2 text-left font-mono text-[11px] transition-colors ${
                        category === item.key
                          ? "bg-[hsl(var(--bg-raised))] text-[hsl(var(--text-primary))]"
                          : "text-[hsl(var(--text-secondary))] opacity-55 hover:bg-[hsl(var(--bg))] hover:opacity-85"
                      }`}
                    >
                      <span className="truncate">{item.label}</span>
                      <span className="ml-auto tabular-nums opacity-45">{count}</span>
                    </button>
                  );
                })}
              </nav>
              <div className="mt-5 border border-[hsl(var(--border))]/60 bg-[hsl(var(--bg))]/35 p-3">
                <Plug size={16} className="mb-2 text-[hsl(var(--accent))] opacity-75" />
                <p className="font-mono text-[11px] text-[hsl(var(--text-primary))]">missing a connector?</p>
                <p className="mt-1 font-mono text-[9.5px] leading-4 text-[hsl(var(--text-secondary))] opacity-45">
                  use Custom API, Custom MCP, Custom Webhook, RSS, or JSON now.
                </p>
              </div>
            </aside>

            <div className="p-5">
              <div className="mb-5 max-w-3xl">
                <PaneSectionLabel>app connectors</PaneSectionLabel>
                <h2 className="font-mono text-[18px] leading-tight text-[hsl(var(--text-primary))]">
                  build your personal API from what you already use.
                </h2>
                <p className="mt-2 font-mono text-[11px] leading-relaxed text-[hsl(var(--text-secondary))] opacity-60">
                  First-party You.md surfaces stay pinned. Third-party services can start as
                  scoped grants today, then graduate into full OAuth/source adapters.
                </p>
              </div>

              {issuedToken && (
                <div className="mb-4 border border-[hsl(var(--accent))]/70 bg-[hsl(var(--accent))]/[0.055] p-3">
                  <div className="flex items-start gap-3">
                    <Check size={15} className="mt-0.5 shrink-0 text-[hsl(var(--accent))]" />
                    <div className="min-w-0">
                      <p className="font-mono text-[11px] text-[hsl(var(--text-primary))]">
                        {issuedToken.appName} grant created. This token is shown once.
                      </p>
                      <code className="mt-2 block break-all bg-[hsl(var(--bg))]/60 px-2 py-2 font-mono text-[10px] text-[hsl(var(--text-primary))]">
                        {issuedToken.token}
                      </code>
                    </div>
                    <button type="button" onClick={() => setIssuedToken(null)} className="ml-auto text-[hsl(var(--text-secondary))] opacity-55 hover:opacity-90">
                      <X size={14} />
                    </button>
                  </div>
                </div>
              )}
              {grantError && (
                <div className="mb-4 border border-red-500/50 bg-red-500/5 p-3 font-mono text-[10px] text-red-400">
                  {grantError}
                </div>
              )}

              <div className="grid gap-2 xl:grid-cols-2">
                {filteredConnectors.map((connector) => {
                  const Icon = connectorIcon(connector);
                  const grant = grantFor(connector.slug);
                  const isBusy = grantBusySlug === connector.slug;
                  return (
                    <div
                      key={connector.slug}
                      className={`group border bg-[hsl(var(--bg))]/35 p-3 transition-colors ${
                        connector.pinned
                          ? "border-[hsl(var(--accent))]/35"
                          : "border-[hsl(var(--border))]/65 hover:border-[hsl(var(--border))]"
                      }`}
                    >
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center bg-[hsl(var(--bg-raised))] text-[hsl(var(--accent))]">
                          <Icon size={18} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex min-w-0 flex-wrap items-center gap-2">
                            <p className="truncate font-mono text-[13px] text-[hsl(var(--text-primary))]">{connector.name}</p>
                            <span className="border border-[hsl(var(--border))]/60 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-[0.12em] text-[hsl(var(--text-secondary))] opacity-60">
                              {connector.type}
                            </span>
                            {connector.pinned && (
                              <span className="border border-[hsl(var(--accent))]/40 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-[0.12em] text-[hsl(var(--accent))] opacity-70">
                                pinned
                              </span>
                            )}
                            {grant && (
                              <span className="ml-auto font-mono text-[9px] text-[hsl(var(--success))] opacity-75">
                                grant active
                              </span>
                            )}
                          </div>
                          <p className="mt-1 font-mono text-[10px] leading-4 text-[hsl(var(--text-secondary))] opacity-50">
                            {connector.detail}
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-2 font-mono text-[8.5px] text-[hsl(var(--text-secondary))] opacity-40">
                            <span>{connector.resources.join(", ")}</span>
                            <span>{connector.writePolicy ?? "read_only"}</span>
                            <span>{connector.trustLevel ?? "medium"}</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => grant ? revoke(grant.id) : issueGrant(connector)}
                          className={`mt-1 flex h-7 shrink-0 items-center gap-1 px-2 font-mono text-[9.5px] transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${
                            grant
                              ? "text-[hsl(var(--text-secondary))] opacity-55 hover:bg-[hsl(var(--bg-raised))] hover:opacity-90"
                              : "bg-[hsl(var(--bg-raised))] text-[hsl(var(--text-primary))] hover:text-[hsl(var(--accent))]"
                          }`}
                        >
                          {isBusy ? "..." : grant ? "revoke" : "grant"}
                          {!grant && <ChevronRight size={12} />}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {activeTab === "crawlers" && (
          <div className="min-h-full">
            <div className="border-b border-[hsl(var(--border))]/60 px-6 py-5">
              <PaneSectionLabel>crawlers and loops</PaneSectionLabel>
              <div className="grid gap-3 md:grid-cols-3">
                <LoopTile icon={Radar} label="crawlers" detail="native, Firecrawl, and agent-browser provider intent" />
                <LoopTile icon={RefreshCcw} label="crons" detail="hourly/daily/weekly/monthly refresh policy" />
                <LoopTile icon={FileJson} label="versions" detail="immutable raw versions, change summaries, approvals" />
              </div>
            </div>
            <SourcesPane userId={userId} username={username} embedded />
          </div>
        )}

        {activeTab === "repo" && (
          <div className="px-6 py-6">
            <div className="max-w-4xl space-y-8">
              <section>
                <PaneSectionLabel>repo connector</PaneSectionLabel>
                <h2 className="font-mono text-[18px] leading-tight text-[hsl(var(--text-primary))]">
                  GitHub is one connector, not the whole product surface.
                </h2>
                <p className="mt-2 max-w-2xl font-mono text-[11px] leading-relaxed text-[hsl(var(--text-secondary))] opacity-60">
                  It stores markdown, JSON, and YouStacks when you want repo-native context.
                  The private API/MCP and connector catalog stay above it.
                </p>
              </section>

              <PaneDivider />

              {connection === undefined && (
                <p className="font-mono text-[10px] text-[hsl(var(--text-secondary))] opacity-40 animate-pulse">
                  loading...
                </p>
              )}
              {connection === null && <GithubRepoSection clerkId={clerkId} />}
              {isConnected && (
                <>
                  {showOnboarding && <GithubOnboarding clerkId={clerkId} connection={connection} />}
                  {showOnboarding && hasRepo && <div className="h-px bg-[hsl(var(--border))]" />}
                  {hasRepo && <GithubRepoSection clerkId={clerkId} />}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function LoopTile({
  icon: Icon,
  label,
  detail,
}: {
  icon: typeof Radar;
  label: string;
  detail: string;
}) {
  return (
    <div className="border-l border-[hsl(var(--border))]/70 bg-[hsl(var(--bg))]/35 px-3 py-2">
      <div className="flex items-center gap-2 font-mono text-[11px] text-[hsl(var(--text-primary))]">
        <Icon size={14} className="text-[hsl(var(--accent))]" />
        <span>{label}</span>
      </div>
      <p className="mt-1 font-mono text-[9.5px] leading-4 text-[hsl(var(--text-secondary))] opacity-48">
        {detail}
      </p>
    </div>
  );
}

function GrantList({
  grants,
  onRevoke,
}: {
  grants: GrantView[];
  onRevoke: (grantId: Id<"connectedAppGrants">) => void;
}) {
  return (
    <div className="overflow-hidden border border-[hsl(var(--border))]/70 bg-[hsl(var(--bg))]/35">
      {grants.map((grant) => (
        <div key={grant.id} className="grid gap-2 border-b border-[hsl(var(--border))]/45 px-3 py-3 last:border-b-0 lg:grid-cols-[minmax(160px,0.8fr)_minmax(220px,1.2fr)_140px_70px]">
          <div className="min-w-0">
            <p className="truncate font-mono text-[11px] text-[hsl(var(--text-primary))]">{grant.appName}</p>
            <p className="mt-1 font-mono text-[9px] text-[hsl(var(--text-secondary))] opacity-40">{grant.appType}</p>
          </div>
          <div className="min-w-0">
            <p className="truncate font-mono text-[9.5px] text-[hsl(var(--text-secondary))] opacity-55">
              {grant.resourceScopes.join(", ")}
            </p>
            <p className="mt-1 truncate font-mono text-[9px] text-[hsl(var(--text-secondary))] opacity-35">
              {grant.writePolicy} / {grant.trustLevel}
            </p>
          </div>
          <div className="font-mono text-[9.5px] text-[hsl(var(--text-secondary))] opacity-45">
            <p>{grant.isActive ? "active" : "inactive"}</p>
            <p>expires {shortDate(grant.expiresAt)}</p>
            <p>used {shortDate(grant.lastUsedAt)}</p>
          </div>
          {grant.isActive ? (
            <button
              type="button"
              onClick={() => onRevoke(grant.id)}
              className="self-start justify-self-start font-mono text-[10px] text-[hsl(var(--accent))] opacity-75 hover:opacity-100 lg:justify-self-end"
            >
              revoke
            </button>
          ) : (
            <span className="font-mono text-[9px] text-[hsl(var(--text-secondary))] opacity-35 lg:justify-self-end">
              revoked
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
