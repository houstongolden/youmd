export type YouStackCapability = {
  id: string;
  intent: string;
  localOnly?: boolean;
  workflow?: string;
  skill?: string;
  mcpTool?: string;
  apiEndpoint?: string;
  requiredScopes?: string[];
  mutationPolicy?: "read_only" | "write_local" | "write_remote" | "server_action";
};

export type YouStackRouteResult = {
  request: string;
  capability: YouStackCapability;
  score: number;
  reasons: string[];
  alternatives: Array<{ capability: YouStackCapability; score: number }>;
};

export const DEFAULT_YOUSTACK_CAPABILITIES: YouStackCapability[] = [
  {
    id: "local-static",
    intent: "Use local stack files, skills, workflows, prompts, docs, examples, and host adapters without contacting You.md.",
    localOnly: true,
    mutationPolicy: "read_only",
  },
  {
    id: "protected-memory-search",
    intent: "Search protected You.md memories when local stack context is not enough.",
    mcpTool: "search_memories",
    apiEndpoint: "POST /api/v1/stacks/{stack_id}/brain/search",
    requiredScopes: ["memories.search"],
    mutationPolicy: "read_only",
  },
  {
    id: "protected-private-context-read",
    intent: "Read scoped private context through authenticated You.md API/MCP grants.",
    mcpTool: "get_private_context",
    apiEndpoint: "GET /api/v1/stacks/{stack_id}/private-context",
    requiredScopes: ["private_context.read"],
    mutationPolicy: "read_only",
  },
  {
    id: "project-context-read",
    intent: "Load durable project context, TODOs, active requests, architecture notes, and source-of-truth docs.",
    mcpTool: "get_project_context",
    apiEndpoint: "GET /api/v1/stacks/{stack_id}/project-context",
    requiredScopes: ["project_context.read"],
    mutationPolicy: "read_only",
  },
  {
    id: "repo-sync",
    intent: "Sync You.md brain files, YouStacks, manifests, skills, and project context with a user-owned GitHub repo.",
    apiEndpoint: "POST /api/v1/stacks/{stack_id}/sync",
    requiredScopes: ["repo.sync"],
    mutationPolicy: "server_action",
  },
  {
    id: "connected-tool-action",
    intent: "Run connected-tool or server-side actions that should not be exposed as local stack files.",
    apiEndpoint: "POST /api/v1/stacks/{stack_id}/actions/{action_id}",
    requiredScopes: ["connected_tools.run"],
    mutationPolicy: "server_action",
  },
];

export function getYouStackCapabilityContract() {
  return {
    schemaVersion: "youstack-capabilities/v1",
    productBoundary: {
      brain: "You.md is the brain, identity context protocol, and durable personal/project context layer.",
      stack: "YouStacks are portable execution packages that can work as local/static files first.",
    },
    apiMcpThreshold: {
      localFilesOnly: [
        "skills",
        "workflows",
        "prompts",
        "docs",
        "examples",
        "host adapter files",
        "read-only route tables",
      ],
      sharedYouMdApiMcp: [
        "protected brain retrieval",
        "private context",
        "project context from hosted sync",
        "stack grants",
        "repo sync",
        "tokens",
        "connected tools",
        "audit logs",
        "server-side actions",
      ],
      optionalCustomApiMcp: [
        "proprietary per-stack tools",
        "custom remote actions",
        "specialized retrieval surfaces",
      ],
      later: [
        "user-owned remote MCP/API deploys",
        "paid/sellable stack marketplace flows",
      ],
    },
    defaultCapabilities: DEFAULT_YOUSTACK_CAPABILITIES,
  };
}

export function normalizeYouStackCapabilities(input: unknown): YouStackCapability[] {
  if (!Array.isArray(input)) return DEFAULT_YOUSTACK_CAPABILITIES;

  const capabilities = input.flatMap((item): YouStackCapability[] => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    if (typeof record.id !== "string" || typeof record.intent !== "string") return [];

    return [{
      id: record.id.slice(0, 120),
      intent: record.intent.slice(0, 1000),
      localOnly: typeof record.localOnly === "boolean" ? record.localOnly : undefined,
      workflow: typeof record.workflow === "string" ? record.workflow.slice(0, 300) : undefined,
      skill: typeof record.skill === "string" ? record.skill.slice(0, 120) : undefined,
      mcpTool: typeof record.mcpTool === "string" ? record.mcpTool.slice(0, 160) : undefined,
      apiEndpoint: typeof record.apiEndpoint === "string" ? record.apiEndpoint.slice(0, 300) : undefined,
      requiredScopes: Array.isArray(record.requiredScopes)
        ? record.requiredScopes.filter((scope): scope is string => typeof scope === "string").slice(0, 20)
        : undefined,
      mutationPolicy: isMutationPolicy(record.mutationPolicy) ? record.mutationPolicy : undefined,
    }];
  });

  return capabilities.length > 0 ? capabilities.slice(0, 50) : DEFAULT_YOUSTACK_CAPABILITIES;
}

export function routeYouStackCapability(
  request: string,
  capabilities: YouStackCapability[] = DEFAULT_YOUSTACK_CAPABILITIES,
): YouStackRouteResult {
  const normalizedRequest = request.trim().slice(0, 2000);
  const ranked = capabilities
    .map((capability) => ({
      capability,
      score: scoreCapability(normalizedRequest, capability),
    }))
    .sort((a, b) => b.score - a.score || a.capability.id.localeCompare(b.capability.id));

  const best = ranked[0] || {
    capability: DEFAULT_YOUSTACK_CAPABILITIES[0],
    score: 0,
  };

  const reasons = best.score > 0
    ? [`Matched request terms against capability ${best.capability.id}.`]
    : ["No strong capability match; defaulted to the safest local/static capability."];

  return {
    request: normalizedRequest,
    capability: best.capability,
    score: best.score,
    reasons,
    alternatives: ranked.slice(1, 4),
  };
}

function isMutationPolicy(value: unknown): value is YouStackCapability["mutationPolicy"] {
  return value === "read_only" || value === "write_local" || value === "write_remote" || value === "server_action";
}

function scoreCapability(request: string, capability: YouStackCapability): number {
  const haystack = [
    capability.id,
    capability.intent,
    capability.workflow,
    capability.skill,
    capability.mcpTool,
    capability.apiEndpoint,
    ...(capability.requiredScopes || []),
  ].filter(Boolean).join(" ").toLowerCase();

  const words = tokenize(request);
  let score = 0;
  for (const word of words) {
    if (haystack.includes(word)) score += word.length > 4 ? 2 : 1;
  }

  const normalized = request.toLowerCase();
  if (capability.localOnly && /\b(local|file|install|adapter|claude|codex|cursor|skill|workflow|prompt|docs?)\b/.test(normalized)) {
    score += 3;
  }
  if (/\b(memory|memories|remember|recall|brain)\b/.test(normalized) && /memor|brain/.test(haystack)) {
    score += 5;
  }
  if (/\b(private|secret|protected|sensitive)\b/.test(normalized) && /private|protected|scope/.test(haystack)) {
    score += 5;
  }
  if (/\b(project|todo|architecture|context|active request)\b/.test(normalized) && /project/.test(haystack)) {
    score += 4;
  }
  if (/\b(sync|github|repo|repository|push|pull)\b/.test(normalized) && /sync|github|repo/.test(haystack)) {
    score += 5;
  }
  if (/\b(tool|action|server|api|mcp|token)\b/.test(normalized) && /tool|action|api|mcp|token/.test(haystack)) {
    score += 3;
  }

  if (capability.mutationPolicy === "read_only") score += 1;
  return score;
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9._-]+/)
    .map((word) => word.trim())
    .filter((word) => word.length > 2);
}
