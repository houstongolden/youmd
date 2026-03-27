export interface Project {
  name: string;
  role: string;
  status: "active" | "building" | "publishing" | "launching" | "shipped";
  description: string;
  url?: string;
  stars?: number;
  mrr?: string;
}

export interface ActivityItem {
  date: string;
  action: string;
  detail: string;
}

export interface AgentConnection {
  name: string;
  lastAccess: string;
  isVerified?: boolean;
}

export interface ConnectedSource {
  name: string;
  status: "verified" | "synced" | "pending";
  lastSync?: string;
}

export interface FreshnessState {
  identity: "current" | "stale" | "outdated";
  projects: "current" | "stale" | "outdated";
  voice: "current" | "stale" | "outdated";
  sources: "current" | "syncing" | "stale";
  score: number; // 0-100
}

export interface MaintenanceInfo {
  humanEdits: boolean;
  agentMaintenance: boolean;
  updateMode: "auto-publish" | "review before publish" | "manual only";
  activeMaintainers: string[];
}

export interface Profile {
  username: string;
  name: string;
  tagline: string;
  location: string;
  voice: string;
  avatarUrl: string;
  coverUrl: string;
  bio: {
    short: string;
    medium: string;
  };
  now: string[];
  projects: Project[];
  values: string[];
  preferences: {
    tone: string;
    formality: string;
    avoid: string[];
    format: string;
  };
  links: { label: string; url: string }[];
  topics: string[];
  credibility: string[];
  agentMetrics: {
    totalReads: number;
    activeIntegrations: number;
    recentReads24h: number;
    contextScore: number;
    contextSessions: number;
    connectedAgentsCount: number;
    verifiedAgents: number;
  };
  agentConnections: AgentConnection[];
  identityState: {
    memoryCoverage: "high" | "medium" | "low";
    voiceProfile: "trained" | "partial" | "untrained";
    contextFreshness: "current" | "stale" | "outdated";
    lastPipelineRun: string;
    sourcesSynced: number;
  };
  verification: {
    verified: boolean;
    methods: string[];
    verifiedAt?: string;
    level?: "person" | "builder" | "company";
  };
  connectedSources: ConnectedSource[];
  freshness: FreshnessState;
  maintenance: MaintenanceInfo;
  recentChanges: string[];
  topQueries: string[];
  publicSections: string[];
  privateSections: string[];
  activity: ActivityItem[];
  maintainedBy: string[];
  lastUpdated: string;
}

export const sampleProfiles: Profile[] = [
  {
    username: "houstong",
    name: "Houston Golden",
    tagline: "Founder, BAMF Media. Building You.md.",
    location: "Miami, FL",
    voice: "Direct, high-energy, founder-coded.",
    avatarUrl: "/assets/houston-portrait.jpeg",
    coverUrl: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&h=300&fit=crop",
    bio: {
      short: "Founder building identity infrastructure for the agent internet.",
      medium: "Founded BAMF Media (8-figure growth agency), LinkedIn growth pioneer. Now building You.md \u2014 the identity context protocol for the agent internet. I ship fast and build in public.",
    },
    now: ["Building You.md", "Scaling BAMF Media", "Refining identity protocol"],
    projects: [
      { name: "You.md", role: "Founder", status: "building", description: "Identity as code for the agent internet.", url: "https://you.md" },
      { name: "BAMF Media", role: "Founder/CEO", status: "active", description: "Growth marketing agency.", url: "#", mrr: "$800k+" },
    ],
    values: ["Build in public", "Extreme ownership", "Ship fast"],
    preferences: {
      tone: "direct, confident, no fluff",
      formality: "casual-professional",
      avoid: ["corporate jargon", "passive voice"],
      format: "short paragraphs, punchy sentences",
    },
    links: [
      { label: "Website", url: "https://houstongolden.com" },
      { label: "LinkedIn", url: "https://linkedin.com/in/houstongolden" },
      { label: "X", url: "https://x.com/houstongolden" },
    ],
    topics: ["growth marketing", "AI agents", "identity protocols"],
    credibility: ["Founded BAMF Media (8-figure agency)", "LinkedIn growth pioneer", "Speaker at 20+ conferences"],
    agentMetrics: {
      totalReads: 12842,
      activeIntegrations: 6,
      recentReads24h: 42,
      contextScore: 92,
      contextSessions: 318,
      connectedAgentsCount: 14,
      verifiedAgents: 4,
    },
    agentConnections: [
      { name: "claude-code", lastAccess: "2 min ago", isVerified: true },
      { name: "cursor", lastAccess: "11 min ago", isVerified: true },
      { name: "codex-cli", lastAccess: "1 hr ago", isVerified: true },
      { name: "perplexity", lastAccess: "3 hr ago", isVerified: true },
      { name: "goose", lastAccess: "8 hr ago" },
      { name: "aider", lastAccess: "1 day ago" },
    ],
    identityState: {
      memoryCoverage: "high",
      voiceProfile: "trained",
      contextFreshness: "current",
      lastPipelineRun: "2 hours ago",
      sourcesSynced: 8,
    },
    verification: { verified: true, methods: ["domain", "linkedin", "github"], verifiedAt: "2026-03-10", level: "builder" },
    connectedSources: [
      { name: "linkedin", status: "verified", lastSync: "2h ago" },
      { name: "github", status: "verified", lastSync: "4h ago" },
      { name: "website", status: "verified", lastSync: "1d ago" },
      { name: "x", status: "synced", lastSync: "6h ago" },
      { name: "youtube", status: "synced", lastSync: "1d ago" },
      { name: "notion", status: "synced", lastSync: "3h ago" },
      { name: "substack", status: "synced", lastSync: "12h ago" },
      { name: "google drive", status: "pending" },
    ],
    freshness: {
      identity: "current",
      projects: "current",
      voice: "current",
      sources: "syncing",
      score: 92,
    },
    maintenance: {
      humanEdits: true,
      agentMaintenance: true,
      updateMode: "review before publish",
      activeMaintainers: ["claude-code", "cursor", "codex-cli", "youmd sync engine"],
    },
    recentChanges: [
      "Refreshed voice profile",
      "Republished identity context v1.3",
      "Connected GitHub + LinkedIn OAuth",
      "Updated project metadata",
      "Synced latest YouTube activity",
    ],
    topQueries: ["who is houston golden", "what is bamf media", "what is you.md", "houston golden linkedin growth"],
    publicSections: ["identity", "projects", "values", "voice summary", "current focus"],
    privateSections: ["preferences", "internal context", "working notes", "private memory"],
    activity: [
      { date: "2026-03-18", action: "agent_read", detail: "claude-code accessed identity context" },
      { date: "2026-03-18", action: "updated", detail: "Synced LinkedIn activity via OAuth" },
      { date: "2026-03-17", action: "published", detail: "Updated identity context to v1.3" },
      { date: "2026-03-15", action: "connected", detail: "Connected GitHub OAuth source" },
      { date: "2026-03-12", action: "updated", detail: "Added new project: You.md" },
      { date: "2026-03-08", action: "initialized", detail: "Created you.md/houstong" },
    ],
    maintainedBy: ["youmd", "claude", "cursor"],
    lastUpdated: "2 hours ago",
  },
  {
    username: "priya",
    name: "Priya Sharma",
    tagline: "ML engineer @ Anthropic. Alignment researcher.",
    location: "London, UK",
    voice: "Technical but approachable, loves analogies.",
    avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop&crop=face",
    coverUrl: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=800&h=300&fit=crop",
    bio: {
      short: "Research engineer focused on RLHF and alignment.",
      medium: "ML engineer at Anthropic working on RLHF and alignment research. I think in probability distributions and communicate in analogies. Weekend ceramicist. Published 12 papers on reward modeling.",
    },
    now: ["Publishing alignment paper Q2", "Open-sourcing eval framework"],
    projects: [
      { name: "Reward Landscapes", role: "Lead researcher", status: "publishing", description: "Novel approach to multi-objective reward modeling." },
      { name: "EvalKit", role: "Creator", status: "building", description: "Open-source LLM evaluation framework.", url: "#", stars: 2400 },
    ],
    values: ["Rigorous thinking", "Open science", "Making AI safe"],
    preferences: {
      tone: "precise, curious, grounded",
      formality: "academic-casual",
      avoid: ["hype language", "unsubstantiated claims"],
      format: "structured with headers, as long as needed for precision",
    },
    links: [
      { label: "Scholar", url: "#" },
      { label: "GitHub", url: "#" },
    ],
    topics: ["RLHF", "alignment", "reward modeling", "open-source ML"],
    credibility: ["ML Engineer at Anthropic", "12 published papers on reward modeling", "Top 1% cited in ML safety"],
    agentMetrics: {
      totalReads: 8421,
      activeIntegrations: 4,
      recentReads24h: 18,
      contextScore: 88,
      contextSessions: 142,
      connectedAgentsCount: 8,
      verifiedAgents: 3,
    },
    agentConnections: [
      { name: "cursor", lastAccess: "5 min ago", isVerified: true },
      { name: "claude-code", lastAccess: "22 min ago", isVerified: true },
      { name: "codex-cli", lastAccess: "4 hr ago", isVerified: true },
      { name: "perplexity", lastAccess: "6 hr ago" },
    ],
    identityState: {
      memoryCoverage: "high",
      voiceProfile: "trained",
      contextFreshness: "current",
      lastPipelineRun: "4 hours ago",
      sourcesSynced: 5,
    },
    verification: { verified: true, methods: ["github", "scholar", "domain"], verifiedAt: "2026-02-20", level: "builder" },
    connectedSources: [
      { name: "github", status: "verified", lastSync: "1h ago" },
      { name: "scholar", status: "verified", lastSync: "1d ago" },
      { name: "website", status: "verified", lastSync: "2d ago" },
      { name: "arxiv", status: "synced", lastSync: "6h ago" },
      { name: "notion", status: "synced", lastSync: "12h ago" },
    ],
    freshness: {
      identity: "current",
      projects: "current",
      voice: "current",
      sources: "current",
      score: 88,
    },
    maintenance: {
      humanEdits: true,
      agentMaintenance: true,
      updateMode: "review before publish",
      activeMaintainers: ["cursor", "youmd sync engine"],
    },
    recentChanges: [
      "Updated research interests",
      "Synced latest arxiv preprints",
      "Added EvalKit v2 milestone",
      "Refreshed voice profile",
    ],
    topQueries: ["priya sharma anthropic", "RLHF reward modeling", "evalkit framework"],
    publicSections: ["identity", "projects", "values", "research"],
    privateSections: ["preferences", "unpublished research notes", "internal experiment logs"],
    activity: [
      { date: "2026-03-16", action: "published", detail: "Updated research interests" },
      { date: "2026-03-14", action: "connected", detail: "Connected arXiv source" },
      { date: "2026-03-14", action: "connected", detail: "Linked Cursor agent" },
      { date: "2026-03-10", action: "updated", detail: "Added EvalKit project" },
      { date: "2026-03-05", action: "initialized", detail: "Created you.md/priya" },
    ],
    maintainedBy: ["youmd", "cursor"],
    lastUpdated: "4 hours ago",
  },
  {
    username: "jmarcus",
    name: "Jordan Marcus",
    tagline: "Indie hacker. 3 exits. Building in public.",
    location: "Austin, TX",
    voice: "Casual, emoji-friendly, shipping energy.",
    avatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop&crop=face",
    coverUrl: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&h=300&fit=crop",
    bio: {
      short: "Building micro-SaaS products in public.",
      medium: "3 exits, 12 failed projects, infinite lessons. Currently running ScreenshotAPI ($8k MRR) and TinyInvoice ($4k MRR). I document everything and believe the best marketing is building in public.",
    },
    now: ["Hit $20k MRR across products", "Launch AI writing tool"],
    projects: [
      { name: "ScreenshotAPI", role: "Solo founder", status: "active", description: "Website screenshot API.", url: "#", mrr: "$8k" },
      { name: "TinyInvoice", role: "Solo founder", status: "active", description: "Invoice generator for freelancers.", url: "#", mrr: "$4k" },
    ],
    values: ["Ship daily", "Revenue over fundraising", "Transparency"],
    preferences: {
      tone: "casual, encouraging, practical",
      formality: "very casual",
      avoid: ["corporate speak", "long intros"],
      format: "short paragraphs, lots of examples, tweet-length when possible",
    },
    links: [
      { label: "X", url: "#" },
      { label: "Blog", url: "#" },
      { label: "Products", url: "#" },
    ],
    topics: ["indie hacking", "micro-SaaS", "building in public", "solopreneurship"],
    credibility: ["3 successful exits", "$12k+ combined MRR across products"],
    agentMetrics: {
      totalReads: 3219,
      activeIntegrations: 3,
      recentReads24h: 8,
      contextScore: 79,
      contextSessions: 54,
      connectedAgentsCount: 5,
      verifiedAgents: 1,
    },
    agentConnections: [
      { name: "goose", lastAccess: "18 min ago", isVerified: true },
      { name: "claude-code", lastAccess: "2 hr ago" },
      { name: "cursor", lastAccess: "5 hr ago" },
    ],
    identityState: {
      memoryCoverage: "medium",
      voiceProfile: "trained",
      contextFreshness: "current",
      lastPipelineRun: "6 hours ago",
      sourcesSynced: 4,
    },
    verification: { verified: false, methods: [] },
    connectedSources: [
      { name: "x", status: "synced", lastSync: "1h ago" },
      { name: "github", status: "synced", lastSync: "3h ago" },
      { name: "blog", status: "synced", lastSync: "1d ago" },
      { name: "stripe", status: "synced", lastSync: "6h ago" },
    ],
    freshness: {
      identity: "current",
      projects: "current",
      voice: "current",
      sources: "current",
      score: 79,
    },
    maintenance: {
      humanEdits: true,
      agentMaintenance: true,
      updateMode: "auto-publish",
      activeMaintainers: ["goose", "youmd sync engine"],
    },
    recentChanges: [
      "MRR milestone update",
      "Added AI writing tool to projects",
      "Synced Stripe revenue data",
      "Updated bio variants",
    ],
    topQueries: ["jordan marcus indie hacker", "screenshotapi founder", "building in public tips"],
    publicSections: ["identity", "projects", "values"],
    privateSections: ["revenue details", "internal roadmaps"],
    activity: [
      { date: "2026-03-18", action: "updated", detail: "MRR milestone update" },
      { date: "2026-03-15", action: "published", detail: "Added AI writing tool to projects" },
      { date: "2026-03-09", action: "connected", detail: "Linked Goose agent" },
      { date: "2026-03-01", action: "initialized", detail: "Created you.md/jmarcus" },
    ],
    maintainedBy: ["youmd", "goose"],
    lastUpdated: "6 hours ago",
  },
  {
    username: "sato-yuki",
    name: "Yuki Sato",
    tagline: "Staff engineer @ Stripe. Distributed systems.",
    location: "Tokyo, Japan",
    voice: "Precise, systems-thinking, dry humor.",
    avatarUrl: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop&crop=face",
    coverUrl: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800&h=300&fit=crop",
    bio: {
      short: "Distributed systems at scale. Correctness over cleverness.",
      medium: "Staff engineer at Stripe working on payment routing infrastructure. I care about correctness, observability, and well-written RFCs. Maintaining two popular open-source Rust crates with 5k+ combined stars.",
    },
    now: ["Migrating payment routing to new architecture", "Writing a technical book on distributed systems"],
    projects: [
      { name: "tokio-retry", role: "Maintainer", status: "active", description: "Retry middleware for Tokio.", url: "#", stars: 3200 },
      { name: "serde-diff", role: "Creator", status: "active", description: "Structural diffing for Serde types.", url: "#", stars: 1800 },
    ],
    values: ["Correctness first", "Write it down", "Mentor generously"],
    preferences: {
      tone: "precise, thorough, occasionally wry",
      formality: "professional",
      avoid: ["hand-waving", "premature optimization claims"],
      format: "RFC-style with tradeoff analysis, thorough",
    },
    links: [
      { label: "GitHub", url: "#" },
      { label: "Blog", url: "#" },
    ],
    topics: ["distributed systems", "Rust", "observability", "payment infrastructure"],
    credibility: ["Staff Engineer at Stripe", "5k+ stars on open-source Rust crates", "Published in OSDI"],
    agentMetrics: {
      totalReads: 6754,
      activeIntegrations: 5,
      recentReads24h: 31,
      contextScore: 95,
      contextSessions: 203,
      connectedAgentsCount: 11,
      verifiedAgents: 5,
    },
    agentConnections: [
      { name: "aider", lastAccess: "3 min ago", isVerified: true },
      { name: "claude-code", lastAccess: "14 min ago", isVerified: true },
      { name: "cursor", lastAccess: "1 hr ago", isVerified: true },
      { name: "codex-cli", lastAccess: "2 hr ago", isVerified: true },
      { name: "goose", lastAccess: "12 hr ago", isVerified: true },
    ],
    identityState: {
      memoryCoverage: "high",
      voiceProfile: "trained",
      contextFreshness: "current",
      lastPipelineRun: "1 hour ago",
      sourcesSynced: 6,
    },
    verification: { verified: true, methods: ["github", "domain", "linkedin"], verifiedAt: "2026-01-15", level: "builder" },
    connectedSources: [
      { name: "github", status: "verified", lastSync: "30m ago" },
      { name: "website", status: "verified", lastSync: "2h ago" },
      { name: "linkedin", status: "verified", lastSync: "1d ago" },
      { name: "crates.io", status: "synced", lastSync: "1h ago" },
      { name: "blog", status: "synced", lastSync: "3d ago" },
      { name: "notion", status: "synced", lastSync: "6h ago" },
    ],
    freshness: {
      identity: "current",
      projects: "current",
      voice: "current",
      sources: "current",
      score: 95,
    },
    maintenance: {
      humanEdits: true,
      agentMaintenance: true,
      updateMode: "review before publish",
      activeMaintainers: ["aider", "claude-code", "youmd sync engine"],
    },
    recentChanges: [
      "Added book project to profile",
      "Synced latest crates.io stats",
      "Updated agent preferences",
      "Refreshed GitHub activity",
    ],
    topQueries: ["yuki sato stripe", "tokio-retry rust", "distributed systems book"],
    publicSections: ["identity", "projects", "values", "technical writing"],
    privateSections: ["RFC drafts", "internal architecture notes", "book manuscript"],
    activity: [
      { date: "2026-03-17", action: "agent_read", detail: "aider accessed identity context" },
      { date: "2026-03-17", action: "updated", detail: "Added book project to profile" },
      { date: "2026-03-13", action: "published", detail: "Updated agent preferences" },
      { date: "2026-03-07", action: "connected", detail: "Linked Aider agent" },
      { date: "2026-03-02", action: "initialized", detail: "Created you.md/sato-yuki" },
    ],
    maintainedBy: ["youmd", "aider", "claude"],
    lastUpdated: "1 hour ago",
  },
  {
    username: "emmawright",
    name: "Emma Wright",
    tagline: "Creative director. Brand strategist. Strong feelings about kerning.",
    location: "Brooklyn, NY",
    voice: "Visual thinker, storytelling-first, bold opinions.",
    avatarUrl: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop&crop=face",
    coverUrl: "https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=800&h=300&fit=crop",
    bio: {
      short: "Making brands feel like they have a soul.",
      medium: "Creative director working with startups and cultural institutions. Previously at Pentagram. I believe every brand has a story worth telling \u2014 most just haven't found the right words yet. Strong feelings about kerning.",
    },
    now: ["Launching rebrand for a climate tech startup", "Teaching brand workshop series"],
    projects: [
      { name: "Canopy Rebrand", role: "Creative Director", status: "building", description: "Full brand identity for climate tech startup." },
      { name: "Brand Bones", role: "Instructor", status: "launching", description: "Workshop series on brand fundamentals.", url: "#" },
    ],
    values: ["Story over aesthetics", "Bold over safe", "Details matter"],
    preferences: {
      tone: "warm, opinionated, visual",
      formality: "casual-creative",
      avoid: ["bland corporate language", "design-by-committee thinking"],
      format: "visual moodboards + concise briefs, enough to spark \u2014 not to lecture",
    },
    links: [
      { label: "Portfolio", url: "#" },
      { label: "Instagram", url: "#" },
      { label: "Are.na", url: "#" },
    ],
    topics: ["brand strategy", "creative direction", "visual identity", "storytelling"],
    credibility: ["Previously at Pentagram", "Worked with 40+ startups on brand identity"],
    agentMetrics: {
      totalReads: 2187,
      activeIntegrations: 2,
      recentReads24h: 5,
      contextScore: 74,
      contextSessions: 28,
      connectedAgentsCount: 3,
      verifiedAgents: 1,
    },
    agentConnections: [
      { name: "claude-code", lastAccess: "45 min ago", isVerified: true },
      { name: "cursor", lastAccess: "6 hr ago" },
    ],
    identityState: {
      memoryCoverage: "medium",
      voiceProfile: "trained",
      contextFreshness: "current",
      lastPipelineRun: "8 hours ago",
      sourcesSynced: 3,
    },
    verification: { verified: true, methods: ["domain", "instagram"], verifiedAt: "2026-03-01", level: "person" },
    connectedSources: [
      { name: "website", status: "verified", lastSync: "1d ago" },
      { name: "instagram", status: "verified", lastSync: "3h ago" },
      { name: "are.na", status: "synced", lastSync: "2d ago" },
    ],
    freshness: {
      identity: "current",
      projects: "current",
      voice: "current",
      sources: "stale",
      score: 74,
    },
    maintenance: {
      humanEdits: true,
      agentMaintenance: false,
      updateMode: "manual only",
      activeMaintainers: ["youmd sync engine"],
    },
    recentChanges: [
      "Added Brand Bones workshop",
      "Updated portfolio link",
      "Synced Instagram activity",
    ],
    topQueries: ["emma wright designer", "pentagram creative director", "brand bones workshop"],
    publicSections: ["identity", "projects", "values", "portfolio"],
    privateSections: ["client briefs", "pricing", "mood boards"],
    activity: [
      { date: "2026-03-16", action: "published", detail: "Added Brand Bones workshop" },
      { date: "2026-03-11", action: "updated", detail: "Updated portfolio link" },
      { date: "2026-03-06", action: "connected", detail: "Linked Claude Code agent" },
      { date: "2026-03-03", action: "initialized", detail: "Created you.md/emmawright" },
    ],
    maintainedBy: ["youmd", "claude"],
    lastUpdated: "8 hours ago",
  },
  {
    username: "kai",
    name: "Kai Andersen",
    tagline: "DevRel lead @ Vercel. 50k YouTube subscribers.",
    location: "Copenhagen, Denmark",
    voice: "Enthusiastic, educational, community-driven.",
    avatarUrl: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200&h=200&fit=crop&crop=face",
    coverUrl: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=800&h=300&fit=crop",
    bio: {
      short: "Helping developers build faster.",
      medium: "DevRel lead at Vercel. Conference speaker, tutorial creator, and eternal optimist about the web platform. 50k+ YouTube subscribers. I believe the best docs are the ones people actually enjoy reading.",
    },
    now: ["Launching new docs platform", "Keynote prep for React Conf"],
    projects: [
      { name: "Vercel Docs v3", role: "Lead", status: "building", description: "Next-gen documentation platform.", url: "#" },
      { name: "Ship It", role: "Host", status: "active", description: "YouTube series on web dev. 50k subs.", url: "#" },
    ],
    values: ["Teach by building", "Community first", "Make it fun"],
    preferences: {
      tone: "enthusiastic, clear, encouraging",
      formality: "casual",
      avoid: ["gatekeeping language", "unnecessary jargon"],
      format: "step-by-step with code examples",
    },
    links: [
      { label: "YouTube", url: "#" },
      { label: "X", url: "#" },
      { label: "GitHub", url: "#" },
    ],
    topics: ["developer relations", "Next.js", "web platform", "content creation"],
    credibility: ["DevRel Lead at Vercel", "50k+ YouTube subscribers", "React Conf keynote speaker"],
    agentMetrics: {
      totalReads: 9312,
      activeIntegrations: 7,
      recentReads24h: 56,
      contextScore: 91,
      contextSessions: 274,
      connectedAgentsCount: 16,
      verifiedAgents: 6,
    },
    agentConnections: [
      { name: "cursor", lastAccess: "1 min ago", isVerified: true },
      { name: "claude-code", lastAccess: "8 min ago", isVerified: true },
      { name: "codex-cli", lastAccess: "30 min ago", isVerified: true },
      { name: "perplexity", lastAccess: "1 hr ago", isVerified: true },
      { name: "goose", lastAccess: "2 hr ago", isVerified: true },
      { name: "aider", lastAccess: "5 hr ago", isVerified: true },
      { name: "opendevin", lastAccess: "1 day ago" },
    ],
    identityState: {
      memoryCoverage: "high",
      voiceProfile: "trained",
      contextFreshness: "current",
      lastPipelineRun: "30 minutes ago",
      sourcesSynced: 8,
    },
    verification: { verified: true, methods: ["github", "youtube", "domain"], verifiedAt: "2026-02-01", level: "builder" },
    connectedSources: [
      { name: "github", status: "verified", lastSync: "15m ago" },
      { name: "youtube", status: "verified", lastSync: "1h ago" },
      { name: "website", status: "verified", lastSync: "6h ago" },
      { name: "x", status: "synced", lastSync: "30m ago" },
      { name: "notion", status: "synced", lastSync: "2h ago" },
      { name: "google drive", status: "synced", lastSync: "1d ago" },
      { name: "calendar", status: "synced", lastSync: "3h ago" },
      { name: "substack", status: "synced", lastSync: "2d ago" },
    ],
    freshness: {
      identity: "current",
      projects: "current",
      voice: "current",
      sources: "current",
      score: 91,
    },
    maintenance: {
      humanEdits: true,
      agentMaintenance: true,
      updateMode: "auto-publish",
      activeMaintainers: ["cursor", "claude-code", "codex-cli", "youmd sync engine"],
    },
    recentChanges: [
      "Added React Conf keynote to Now",
      "Synced latest YouTube analytics",
      "Updated agent preferences",
      "Connected calendar source",
      "Refreshed GitHub activity",
    ],
    topQueries: ["kai andersen vercel", "next.js devrel", "ship it youtube"],
    publicSections: ["identity", "projects", "values", "tutorials"],
    privateSections: ["talk proposals", "internal docs strategy", "sponsor rates"],
    activity: [
      { date: "2026-03-18", action: "agent_read", detail: "cursor accessed identity context" },
      { date: "2026-03-18", action: "updated", detail: "Added React Conf keynote to Now" },
      { date: "2026-03-14", action: "published", detail: "Updated agent preferences" },
      { date: "2026-03-10", action: "connected", detail: "Connected YouTube OAuth source" },
      { date: "2026-03-04", action: "initialized", detail: "Created you.md/kai" },
    ],
    maintainedBy: ["youmd", "cursor", "claude"],
    lastUpdated: "30 minutes ago",
  },
];
