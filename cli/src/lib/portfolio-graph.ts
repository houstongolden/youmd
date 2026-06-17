export interface PortfolioGraphBrief {
  generatedFrom: string;
  projects: Array<{
    slug: string;
    stack: string;
    goal: string;
    focus: string;
  }>;
  apiSurfaces: Array<{
    slug: string;
    ownerProject: string;
    ownerStack: string;
    risk: "low" | "medium" | "high";
    writePolicy: string;
    features: string[];
  }>;
  dependencyEdges: Array<{
    fromProject: string;
    toSurface: string;
    tier: "dependent" | "feature" | "optional" | "dev-only" | "admin" | "workspace" | "user-level";
    integrationType: "admin" | "workspace" | "user-level" | "developer-agent";
    features: string[];
    failureImpact: string;
  }>;
  reusablePatterns: Array<{
    slug: string;
    owner: string;
    status: "canonical" | "candidate" | "deprecated";
  }>;
  skillPropagation: Array<{
    skill: string;
    owner: string;
    projects: Array<{ project: string; status: "synced" | "cataloged" | "pending" }>;
  }>;
  agentCommands: string[];
  guardrails: string[];
}

type PersistedPortfolioGraphSnapshot = {
  schemaVersion?: string;
  projects?: Array<Record<string, unknown>>;
  apiSurfaces?: Array<Record<string, unknown>>;
  dependencyEdges?: Array<Record<string, unknown>>;
  reusablePatterns?: Array<Record<string, unknown>>;
};

const SURFACE_RISKS = new Set(["low", "medium", "high"]);
const EDGE_TIERS = new Set(["dependent", "feature", "optional", "dev-only", "admin", "workspace", "user-level"]);
const INTEGRATION_TYPES = new Set(["admin", "workspace", "user-level", "developer-agent"]);
const PATTERN_STATUSES = new Set(["canonical", "candidate", "deprecated"]);

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item !== "string") return [];
    const trimmed = item.trim();
    return trimmed ? [trimmed] : [];
  });
}

function oneOf<T extends string>(value: unknown, allowed: Set<string>, fallback: T): T {
  return typeof value === "string" && allowed.has(value) ? value as T : fallback;
}

export const PORTFOLIO_GRAPH_BRIEF: PortfolioGraphBrief = {
  generatedFrom: "project-context/PROJECT_PORTFOLIO_GRAPH_AND_REUSE_PRD_2026-06-17.md",
  projects: [
    {
      slug: "youmd",
      stack: "YouStack",
      goal: "Make every authorized agent start with the right human, project, machine, skill, and dependency context.",
      focus: "Portfolio graph, API/env intelligence, reusable pattern catalog, and dashboard surfaces.",
    },
    {
      slug: "bamfaiapp",
      stack: "BAMFStack",
      goal: "Operate the BAMF app agent while exposing only safe API/MCP/skill-stack adapters externally.",
      focus: "Protected harness versus public BAMFStack boundary.",
    },
    {
      slug: "bamfsite",
      stack: "BAMFOSStack",
      goal: "Keep agency/admin automation powerful without duplicating product APIs or leaking internal IP.",
      focus: "Admin-only integrations, browser/session operators, and API ownership hygiene.",
    },
    {
      slug: "hubify",
      stack: "HubStack",
      goal: "Make research operations durable, queryable, and agent-operated.",
      focus: "Science stack discipline, lab status, and research publishing loops.",
    },
  ],
  apiSurfaces: [
    {
      slug: "youmd-api",
      ownerProject: "youmd",
      ownerStack: "YouStack",
      risk: "high",
      writePolicy: "propose",
      features: ["identity", "projects", "memories", "sources", "activity", "stacks"],
    },
    {
      slug: "youmd-mcp",
      ownerProject: "youmd",
      ownerStack: "YouStack",
      risk: "medium",
      writePolicy: "read-only",
      features: ["agent brief", "project context", "stack capabilities", "activity trail"],
    },
    {
      slug: "bamf-ai-api",
      ownerProject: "bamfaiapp",
      ownerStack: "BAMFStack",
      risk: "high",
      writePolicy: "approved-write",
      features: ["creator context", "copy workflows", "media context", "app agent support"],
    },
    {
      slug: "bamfos-admin-api",
      ownerProject: "bamfsite",
      ownerStack: "BAMFOSStack",
      risk: "high",
      writePolicy: "owner-only",
      features: ["admin workflows", "browser/session operators", "agency operations"],
    },
  ],
  dependencyEdges: [
    {
      fromProject: "bamfaiapp",
      toSurface: "bamfos-admin-api",
      tier: "feature",
      integrationType: "admin",
      features: ["agency context", "protected admin actions", "operator handoffs"],
      failureImpact: "BAMF.ai can run core product flows, but admin/agency enhanced context degrades.",
    },
    {
      fromProject: "bamfsite",
      toSurface: "bamf-ai-api",
      tier: "dependent",
      integrationType: "developer-agent",
      features: ["product context reuse", "shared creator account awareness", "cross-project API routing"],
      failureImpact: "Duplicate endpoints and inconsistent ownership become more likely.",
    },
    {
      fromProject: "hubify",
      toSurface: "youmd-api",
      tier: "dev-only",
      integrationType: "developer-agent",
      features: ["agent startup context", "project memory", "research stack routing"],
      failureImpact: "Local agents lose Houston-specific project and stack context.",
    },
  ],
  reusablePatterns: [
    { slug: "api-mcp-skillstack-first", owner: "youmd", status: "canonical" },
    { slug: "passwordless-auth", owner: "youmd", status: "canonical" },
    { slug: "agentic-shell-layout", owner: "youmd", status: "canonical" },
    { slug: "streaming-agent-response", owner: "youmd", status: "candidate" },
  ],
  skillPropagation: [
    {
      skill: "portfolio-graph-auditor",
      owner: "~/.agent-shared/claude-skills",
      projects: [
        { project: "youmd", status: "synced" },
        { project: "bamfaiapp", status: "cataloged" },
        { project: "bamfsite", status: "cataloged" },
      ],
    },
    {
      skill: "machine-sync",
      owner: "~/.agent-shared/claude-skills",
      projects: [
        { project: "youmd", status: "synced" },
        { project: "bamfaiapp", status: "cataloged" },
        { project: "bamfsite", status: "cataloged" },
      ],
    },
  ],
  agentCommands: [
    "youmd skill improve",
    "youmd skill install portfolio-graph-auditor",
    "youmd skill sync",
    "youmd project portfolio-audit --root ~/Desktop/CODE_2025",
    "youmd project env-audit --root ~/Desktop/CODE_2025 --fingerprints",
  ],
  guardrails: [
    "Do not print .env.local values or decrypted secret contents.",
    "Before adding an API/MCP route, check the portfolio graph for an existing owner.",
    "Treat You.md as the additive source-catalog layer; keep canonical source in the owning repo or stack.",
    "Distinguish public/installable skill stacks from protected product-agent harnesses.",
  ],
};

export function portfolioGraphBriefFromSnapshot(
  snapshot: PersistedPortfolioGraphSnapshot | null | undefined,
  fallback: PortfolioGraphBrief = PORTFOLIO_GRAPH_BRIEF
): PortfolioGraphBrief {
  if (!snapshot || !Array.isArray(snapshot.projects) || snapshot.projects.length === 0) {
    return fallback;
  }

  return {
    generatedFrom: `authenticated /api/v1/me/portfolio/graph (${snapshot.projects.length} projects)`,
    projects: snapshot.projects.map((project) => ({
      slug: asString(project.slug, asString(project.name, "unknown-project")),
      stack: asString(project.stackName, asString(project.stackSlug, "Project Stack")),
      goal: asString(project.goal, asString(project.summary, "No goal captured yet.")),
      focus: asString(project.focus, asString(project.summary, "No focus captured yet.")),
    })),
    apiSurfaces: (snapshot.apiSurfaces ?? []).map((surface) => ({
      slug: asString(surface.slug, asString(surface.name, "unknown-surface")),
      ownerProject: asString(surface.ownerProjectSlug, asString(surface.ownerProject, "unknown-project")),
      ownerStack: asString(surface.ownerStack, "Project Stack"),
      risk: oneOf(surface.risk, SURFACE_RISKS, "medium"),
      writePolicy: asString(surface.writePolicy, "review-required"),
      features: asStringArray(surface.features),
    })),
    dependencyEdges: (snapshot.dependencyEdges ?? []).map((edge) => ({
      fromProject: asString(edge.fromProjectSlug, asString(edge.fromProject, "unknown-project")),
      toSurface: asString(edge.toSurfaceSlug, asString(edge.toSurface, asString(edge.toProjectSlug, "unknown-surface"))),
      tier: oneOf(edge.tier, EDGE_TIERS, "optional"),
      integrationType: oneOf(edge.integrationType, INTEGRATION_TYPES, "developer-agent"),
      features: asStringArray(edge.features),
      failureImpact: asString(edge.failureImpact, "Not documented yet."),
    })),
    reusablePatterns: (snapshot.reusablePatterns ?? []).map((pattern) => ({
      slug: asString(pattern.slug, asString(pattern.name, "unknown-pattern")),
      owner: asString(pattern.canonicalOwnerProject, asString(pattern.owner, "youmd")),
      status: oneOf(pattern.status, PATTERN_STATUSES, "candidate"),
    })),
    skillPropagation: fallback.skillPropagation,
    agentCommands: fallback.agentCommands,
    guardrails: fallback.guardrails,
  };
}

export function formatPortfolioGraphBriefMarkdown(graph: PortfolioGraphBrief = PORTFOLIO_GRAPH_BRIEF): string {
  const lines: string[] = [];

  lines.push("## Portfolio Graph");
  lines.push(`- source: ${graph.generatedFrom}`);
  lines.push("");
  lines.push("### Active Projects");
  for (const project of graph.projects) {
    lines.push(`- ${project.slug} (${project.stack}): ${project.focus}`);
  }
  lines.push("");
  lines.push("### API/MCP Surfaces");
  for (const surface of graph.apiSurfaces) {
    lines.push(
      `- ${surface.slug}: owner=${surface.ownerProject}/${surface.ownerStack}, risk=${surface.risk}, write=${surface.writePolicy}, features=${surface.features.join(", ")}`
    );
  }
  lines.push("");
  lines.push("### Dependency Edges");
  for (const edge of graph.dependencyEdges) {
    lines.push(
      `- ${edge.fromProject} -> ${edge.toSurface}: ${edge.tier}, ${edge.integrationType}, impact=${edge.failureImpact}`
    );
  }
  lines.push("");
  lines.push("### Reusable Patterns");
  for (const pattern of graph.reusablePatterns) {
    lines.push(`- ${pattern.slug}: ${pattern.status}, owner=${pattern.owner}`);
  }
  lines.push("");
  lines.push("### Skill Propagation");
  for (const entry of graph.skillPropagation) {
    const projects = entry.projects.map((project) => `${project.project}:${project.status}`).join(", ");
    lines.push(`- ${entry.skill} (${entry.owner}): ${projects}`);
  }
  lines.push("");
  lines.push("### Agent Commands");
  for (const command of graph.agentCommands) lines.push(`- \`${command}\``);
  lines.push("");
  lines.push("### Guardrails");
  for (const guardrail of graph.guardrails) lines.push(`- ${guardrail}`);

  return lines.join("\n");
}

function normalizeProjectKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function getPortfolioGraphProjectSlice(
  projectName: string | null | undefined,
  graph: PortfolioGraphBrief = PORTFOLIO_GRAPH_BRIEF
) {
  const normalized = projectName ? normalizeProjectKey(projectName) : "";
  const project = graph.projects.find((candidate) => {
    const slug = normalizeProjectKey(candidate.slug);
    const stack = normalizeProjectKey(candidate.stack);
    return slug === normalized || stack === normalized || normalized.includes(slug);
  }) ?? null;
  const projectSlug = project?.slug ?? (normalized || null);
  const ownedSurfaces = graph.apiSurfaces.filter((surface) => surface.ownerProject === projectSlug);
  const dependencyEdges = graph.dependencyEdges.filter((edge) => edge.fromProject === projectSlug);
  const dependencySurfaceSlugs = new Set(dependencyEdges.map((edge) => edge.toSurface));
  const dependentSurfaces = graph.apiSurfaces.filter((surface) => dependencySurfaceSlugs.has(surface.slug));
  const reusablePatterns = graph.reusablePatterns.filter((pattern) =>
    projectSlug ? pattern.owner === projectSlug || pattern.owner === "youmd" : pattern.status === "canonical"
  );
  const skillPropagation = graph.skillPropagation
    .map((entry) => ({
      ...entry,
      projects: projectSlug
        ? entry.projects.filter((item) => item.project === projectSlug)
        : entry.projects,
    }))
    .filter((entry) => entry.projects.length > 0);

  return {
    readiness: project || ownedSurfaces.length || dependencyEdges.length
      ? {
          ready: true,
          reason: `Portfolio graph slice available for ${project?.slug ?? projectName}.`,
        }
      : {
          ready: false,
          reason: `No local portfolio graph slice matched ${projectName ?? "the current project"}.`,
        },
    requestedProject: projectName ?? null,
    matchedProject: project,
    ownedSurfaces,
    dependencyEdges,
    dependentSurfaces,
    reusablePatterns,
    skillPropagation,
    guardrails: graph.guardrails,
    agentCommands: graph.agentCommands,
  };
}
