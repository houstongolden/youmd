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
