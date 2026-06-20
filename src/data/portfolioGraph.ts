export type ProjectStatus = "active" | "build" | "research" | "template" | "audit";
export type IntegrationTier = "dependent" | "feature" | "optional" | "dev-only" | "admin" | "workspace" | "user-level";
export type PatternStatus = "canonical" | "candidate" | "deprecated";
export type SurfaceKind = "api" | "mcp" | "skillstack" | "agent-harness" | "provider";

export interface PortfolioProject {
  slug: string;
  name: string;
  stack: string;
  status: ProjectStatus;
  summary: string;
  goal: string;
  focus: string;
  repo?: string;
  docs: string[];
  environments: string[];
}

export interface ApiSurface {
  slug: string;
  name: string;
  kind: SurfaceKind;
  ownerProject: string;
  ownerStack: string;
  trust: "private" | "public" | "protected" | "third-party";
  authMode: string;
  writePolicy: "read-only" | "propose" | "approved-write" | "owner-only";
  features: string[];
  risk: "low" | "medium" | "high";
  notes: string;
  docsUrls?: string[];
  integrationTypes?: Array<"admin" | "workspace" | "user-level" | "developer-agent" | "local-agent">;
  curlCommand?: string;
}

export interface DependencyEdge {
  fromProject: string;
  toSurface: string;
  tier: IntegrationTier;
  integrationType: "admin" | "workspace" | "user-level" | "developer-agent";
  features: string[];
  failureImpact: string;
}

export interface ReusablePattern {
  slug: string;
  name: string;
  status: PatternStatus;
  tags: string[];
  canonicalOwner: string;
  summary: string;
}

export interface EnvProviderUsage {
  provider: string;
  category: "llm" | "auth" | "sms" | "email" | "hosting" | "database" | "browser" | "marketing" | "other";
  projectCount: number;
  keyNameCount: number;
  normalizedNames: string[];
  projects: string[];
  policy: string;
}

export interface ServiceAccountRecord {
  provider: string;
  loginHint: string;
  billingOwner: string;
  separationPolicy: string;
  encryptedStorage: string;
}

export interface SkillPropagation {
  skill: string;
  owner: string;
  projects: Array<{ project: string; status: "synced" | "pending" | "cataloged"; note: string }>;
}

export const portfolioProjects: PortfolioProject[] = [
  {
    slug: "youmd",
    name: "You.md",
    stack: "YouStack",
    status: "active",
    summary: "Identity, memory, project-context, prompt-history, API/MCP, source catalog, and machine-sync layer for Houston and his agents.",
    goal: "Make every authorized agent start with the right human, project, machine, skill, and dependency context.",
    focus: "Portfolio graph, API/env intelligence, reusable pattern catalog, and dashboard surfaces.",
    repo: "houstongolden/youmd",
    docs: ["project-context/PRD.md", "project-context/ARCHITECTURE.md", "project-context/TODO.md"],
    environments: ["local", "Vercel", "Convex Cloud"],
  },
  {
    slug: "bamfaiapp",
    name: "BAMF.ai App",
    stack: "BAMFStack",
    status: "active",
    summary: "User-facing BAMF.ai product with protected in-app agent harnesses for strategy, copy, image generation, and client workflows.",
    goal: "Operate the BAMF app agent while exposing only safe API/MCP/skill-stack adapters externally.",
    focus: "Protect proprietary harness behavior while keeping public BAMFStack useful for external coding agents.",
    repo: "houstongolden/bamfaiapp",
    docs: ["project-context/PRD.md", "admin agent docs", "BAMFStack docs"],
    environments: ["local", "production", "admin"],
  },
  {
    slug: "bamfsite",
    name: "BAMF Site / BAMFOS",
    stack: "BAMFOSStack",
    status: "active",
    summary: "Proprietary BAMF agency brain, admin system, browser/session workflows, Lempod and social-media operations.",
    goal: "Keep agency/admin automation powerful without duplicating product APIs or leaking internal IP.",
    focus: "Lempod ownership audit, API dependencies, browser operator skills, and admin-only integrations.",
    repo: "houstongolden/bamfsite",
    docs: ["admin docs", "BAMFOSStack docs", "agent harness notes"],
    environments: ["local", "production", "admin"],
  },
  {
    slug: "hubify",
    name: "Hubify",
    stack: "HubStack",
    status: "research",
    summary: "Science platform, experiments, papers, agents, costs, datasets, and lab status.",
    goal: "Make research operations durable, queryable, and agent-operated.",
    focus: "Science stack discipline, lab status, and research publishing loops.",
    repo: "houstongolden/hubify",
    docs: ["SciStack", "HubStack", "research docs"],
    environments: ["local", "production", "compute"],
  },
];

export const apiSurfaces: ApiSurface[] = [
  {
    slug: "youmd-api",
    name: "You.md API",
    kind: "api",
    ownerProject: "youmd",
    ownerStack: "YouStack",
    trust: "private",
    authMode: "owner key or scoped yg_* app grant",
    writePolicy: "propose",
    features: ["identity", "projects", "memories", "sources", "activity", "stacks"],
    risk: "high",
    notes: "Primary source of truth for human/project context and local agent startup.",
    docsUrls: ["https://you.md/api/v1/docs/reference", "https://you.md/api/v1/docs/openapi.json"],
    integrationTypes: ["developer-agent", "local-agent"],
    curlCommand: 'curl -H "Authorization: Bearer $YOU_API_KEY" https://you.md/api/v1/me/portfolio/graph',
  },
  {
    slug: "youmd-mcp",
    name: "You.md MCP",
    kind: "mcp",
    ownerProject: "youmd",
    ownerStack: "YouStack",
    trust: "private",
    authMode: "scoped MCP grant",
    writePolicy: "read-only",
    features: ["agent brief", "project context", "stack capabilities", "activity trail"],
    risk: "medium",
    notes: "Default bridge for Claude Code, Codex, Cursor, ChatGPT, and other local agents.",
    docsUrls: ["https://you.md/.well-known/mcp.json", "https://you.md/api/v1/mcp"],
    integrationTypes: ["developer-agent", "local-agent"],
    curlCommand: "curl -fsSL https://you.md/.well-known/mcp.json",
  },
  {
    slug: "bamf-ai-api",
    name: "BAMF.ai API/MCP",
    kind: "mcp",
    ownerProject: "bamfaiapp",
    ownerStack: "BAMFStack",
    trust: "protected",
    authMode: "BAMF app grants and API keys",
    writePolicy: "approved-write",
    features: ["creator context", "copy workflows", "media context", "app agent support"],
    risk: "high",
    notes: "Public/installable BAMFStack should teach external agents to use the API, not expose the protected product harness.",
    docsUrls: [
      "https://bamf.ai/docs",
      "https://bamf.ai/docs/api/posts",
      "https://bamf.ai/docs/mcp/overview",
      "https://bamf.ai/docs/mcp/tools",
      "https://bamf.ai/openapi.json",
    ],
    integrationTypes: ["user-level", "workspace", "developer-agent", "local-agent"],
    curlCommand: 'curl -H "Authorization: Bearer $BAMF_API_KEY" https://api.bamf.ai/v1/agent/capabilities',
  },
  {
    slug: "bamfos-admin-api",
    name: "BAMFOS Admin API/MCP",
    kind: "mcp",
    ownerProject: "bamfsite",
    ownerStack: "BAMFOSStack",
    trust: "protected",
    authMode: "admin-only credentials and developer-agent grants",
    writePolicy: "owner-only",
    features: ["admin workflows", "browser/session operators", "Lempod context", "agency operations"],
    risk: "high",
    notes: "Internal agency/admin surface. Keep separate from product-facing BAMF.ai harnesses.",
    docsUrls: ["https://bamf.ai/docs", "https://bamf.ai/docs/agents/bamfstack"],
    integrationTypes: ["admin", "developer-agent"],
    curlCommand: "curl -fsSL https://bamf.ai/bamfstack/install.sh | bash",
  },
  {
    slug: "lempod-management",
    name: "Lempod Management",
    kind: "provider",
    ownerProject: "bamfsite",
    ownerStack: "BAMFOSStack",
    trust: "third-party",
    authMode: "business account credentials, redacted local env or vault",
    writePolicy: "approved-write",
    features: ["Lempod accounts", "business-expense tracking", "boost context"],
    risk: "high",
    notes: "Canonical owner is pending audit against bamfaiapp. Do not add duplicate APIs until ownership is decided.",
    docsUrls: ["https://bamf.ai/docs/api/engagement-boost"],
    integrationTypes: ["admin", "developer-agent"],
    curlCommand: 'curl -H "Authorization: Bearer $BAMF_API_KEY" https://api.bamf.ai/v1/boost/tiers',
  },
];

export const dependencyEdges: DependencyEdge[] = [
  {
    fromProject: "bamfaiapp",
    toSurface: "bamfos-admin-api",
    tier: "feature",
    integrationType: "admin",
    features: ["agency context", "protected admin actions", "operator handoffs"],
    failureImpact: "BAMF.ai can still run core product flows, but admin/agency enhanced context degrades.",
  },
  {
    fromProject: "bamfsite",
    toSurface: "bamf-ai-api",
    tier: "dependent",
    integrationType: "developer-agent",
    features: ["product context reuse", "shared creator account awareness", "cross-project API routing"],
    failureImpact: "Duplicate endpoints and inconsistent Lempod/project ownership become more likely.",
  },
  {
    fromProject: "bamfaiapp",
    toSurface: "lempod-management",
    tier: "feature",
    integrationType: "admin",
    features: ["Lempod boost awareness", "account context", "social workflow context"],
    failureImpact: "Lempod-aware workflows lose account state and may send inconsistent reminders/messages.",
  },
  {
    fromProject: "hubify",
    toSurface: "youmd-api",
    tier: "dev-only",
    integrationType: "developer-agent",
    features: ["agent startup context", "project memory", "research stack routing"],
    failureImpact: "Local agents can still work, but lose Houston-specific project and stack context.",
  },
];

export const reusablePatterns: ReusablePattern[] = [
  {
    slug: "api-mcp-skillstack-first",
    name: "API/MCP/SkillStack-first architecture",
    status: "canonical",
    tags: ["architecture", "agentic-stack", "reuse"],
    canonicalOwner: "youmd",
    summary: "Every serious project exposes durable API/MCP surfaces plus an installable stack of skills, docs, prompts, workflows, context, and tests.",
  },
  {
    slug: "role-hierarchy",
    name: "Reusable role hierarchy",
    status: "candidate",
    tags: ["auth", "workspace", "rbac"],
    canonicalOwner: "youmd",
    summary: "Solo user, workspace member/manager/admin/owner, and super-admin/developer-agent roles with explicit privilege boundaries.",
  },
  {
    slug: "passwordless-auth",
    name: "First-party passwordless auth",
    status: "canonical",
    tags: ["auth", "resend", "sendblue"],
    canonicalOwner: "youmd",
    summary: "Prefer simple email/SMS one-time code or verify-link auth. Use Convex Auth only when SSO breadth justifies it. Avoid Clerk by default.",
  },
  {
    slug: "agentic-shell-layout",
    name: "Agentic shell layout",
    status: "canonical",
    tags: ["ui", "dashboard", "agent"],
    canonicalOwner: "youmd",
    summary: "Full-height left sidebar, terminal chat column, and detail pane for session intelligence, artifacts, projects, skills, APIs, and context.",
  },
  {
    slug: "streaming-agent-response",
    name: "Agent streaming response pattern",
    status: "candidate",
    tags: ["agent", "ux", "streaming"],
    canonicalOwner: "youmd",
    summary: "Fast contextual acknowledgement, live task list, progress updates, then response and artifact. Avoid dead loading spinners.",
  },
];

export const envProviderUsages: EnvProviderUsage[] = [
  {
    provider: "OpenAI / OpenRouter",
    category: "llm",
    projectCount: 6,
    keyNameCount: 5,
    normalizedNames: ["OPENAI_API_KEY", "OPENROUTER_API_KEY", "NEXT_OPENAI_API_KEY"],
    projects: ["youmd", "bamfaiapp", "bamfsite", "hubify"],
    policy: "Shared light-use keys are acceptable; production products should separate keys for spend tracking, rate limits, and blast-radius control.",
  },
  {
    provider: "Resend",
    category: "email",
    projectCount: 4,
    keyNameCount: 3,
    normalizedNames: ["RESEND_API_KEY", "NEXT_RESEND_API_KEY"],
    projects: ["youmd", "bamfaiapp", "bamfsite"],
    policy: "Prefer per-product keys where sender identity, deliverability, or billing attribution matters.",
  },
  {
    provider: "Sendblue",
    category: "sms",
    projectCount: 3,
    keyNameCount: 4,
    normalizedNames: ["SENDBLUE_API_KEY", "SENDBLUE_API_SECRET", "NEXT_SENDBLUE_API_KEY"],
    projects: ["bamfaiapp", "bamfsite"],
    policy: "Do not reuse blindly across apps that send Houston or clients contextual SMS/iMessage notifications.",
  },
  {
    provider: "Convex",
    category: "database",
    projectCount: 5,
    keyNameCount: 4,
    normalizedNames: ["CONVEX_DEPLOY_KEY", "NEXT_PUBLIC_CONVEX_URL", "CONVEX_URL"],
    projects: ["youmd", "bamfaiapp", "hubify"],
    policy: "Keep dev/prod deployment keys separate. Surface app/environment mapping before fresh-machine restore.",
  },
  {
    provider: "Vercel",
    category: "hosting",
    projectCount: 7,
    keyNameCount: 3,
    normalizedNames: ["VERCEL_TOKEN", "VERCEL_ORG_ID", "VERCEL_PROJECT_ID"],
    projects: ["youmd", "bamfaiapp", "bamfsite", "hubify"],
    policy: "Prefer project-scoped tokens when automated deploy agents write to production projects.",
  },
];

export const serviceAccounts: ServiceAccountRecord[] = [
  {
    provider: "OpenAI / OpenRouter",
    loginHint: "owner-managed; exact email stored only in encrypted vault",
    billingOwner: "Houston",
    separationPolicy: "Separate by production product when usage, public exposure, or cost attribution grows.",
    encryptedStorage: "Vault record with redacted key fingerprint and login hint; never raw key in dashboard payload.",
  },
  {
    provider: "Resend",
    loginHint: "verify sender/domain account before creating another paid account",
    billingOwner: "Houston / project",
    separationPolicy: "Separate sender domains and transactional products.",
    encryptedStorage: "Key names and project mapping visible; values require local vault unlock.",
  },
  {
    provider: "Sendblue",
    loginHint: "confirm which app owns the messaging persona before reuse",
    billingOwner: "BAMF operations",
    separationPolicy: "Avoid shared keys across apps sending different-context messages.",
    encryptedStorage: "Show provider/account relationship, not raw credentials.",
  },
  {
    provider: "Lempod",
    loginHint: "multiple business accounts; canonical owner audit pending",
    billingOwner: "BAMF business expense",
    separationPolicy: "Keep business-account inventory centralized; product apps consume through canonical owner API.",
    encryptedStorage: "Account identity and expense metadata cataloged; credentials stay in protected vault/env.",
  },
];

export const skillPropagation: SkillPropagation[] = [
  {
    skill: "portfolio-graph-auditor",
    owner: "~/.agent-shared/claude-skills",
    projects: [
      { project: "youmd", status: "synced", note: "dashboard and docs consume the portfolio graph model" },
      { project: "bamfaiapp", status: "cataloged", note: "audit target for protected harness vs public BAMFStack boundary" },
      { project: "bamfsite", status: "cataloged", note: "audit target for BAMFOSStack/Lempod/API ownership" },
    ],
  },
  {
    skill: "machine-sync",
    owner: "~/.agent-shared/claude-skills",
    projects: [
      { project: "youmd", status: "synced", note: "env audit and encrypted restore path" },
      { project: "bamfaiapp", status: "cataloged", note: "fresh-machine env inventory target" },
      { project: "bamfsite", status: "cataloged", note: "fresh-machine env inventory target" },
    ],
  },
];
