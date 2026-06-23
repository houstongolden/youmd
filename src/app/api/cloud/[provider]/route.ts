import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Cloud-agent integration point. Each provider runs agents in its own cloud
// sandbox via its API; we surface them as sessions in the shell. This endpoint
// reports connection state (is a key configured?) and, once a provider's
// contract is confirmed, fetches its live agent sessions. It is fully gated:
// with no key it returns an empty, "not connected" result — it never throws,
// so it's safe to ship before the live fetches are wired.
type ProviderId = "cursor" | "codex" | "claude" | "hermes";

const PROVIDERS: Record<ProviderId, { label: string; envKey: string; api: string }> = {
  cursor: { label: "Cursor", envKey: "CURSOR_API_KEY", api: "Cursor Background Agents API" },
  codex: { label: "Codex", envKey: "OPENAI_API_KEY", api: "Codex cloud / OpenAI API" },
  claude: { label: "Claude", envKey: "ANTHROPIC_API_KEY", api: "Claude Agent SDK" },
  hermes: { label: "Hermes", envKey: "HERMES_API_KEY", api: "Hermes Agent API" },
};

type CloudSession = {
  id: string;
  title: string;
  agent: string;
  status: "active" | "idle";
  summary: string;
};

export async function GET(_req: Request, ctx: { params: Promise<{ provider: string }> }) {
  const { provider } = await ctx.params;
  const cfg = PROVIDERS[provider as ProviderId];
  if (!cfg) {
    return NextResponse.json({ error: "unknown provider", providers: Object.keys(PROVIDERS) }, { status: 404 });
  }

  const key = process.env[cfg.envKey];
  if (!key) {
    return NextResponse.json({ provider, label: cfg.label, api: cfg.api, connected: false, sessions: [] as CloudSession[] });
  }

  // Key present → attempt to fetch live cloud agent sessions. Wrapped so a wrong
  // endpoint / network error degrades to connected-but-empty rather than 500.
  try {
    const sessions = await fetchProviderSessions(provider as ProviderId, key);
    return NextResponse.json({ provider, label: cfg.label, api: cfg.api, connected: true, sessions });
  } catch {
    return NextResponse.json({ provider, label: cfg.label, api: cfg.api, connected: true, sessions: [] as CloudSession[] });
  }
}

// Per-provider live fetch. Implemented defensively; returns [] until each
// vendor's exact contract is confirmed (TODO: confirm endpoints + shapes).
async function fetchProviderSessions(provider: ProviderId, key: string): Promise<CloudSession[]> {
  void key;
  switch (provider) {
    case "cursor":
      // TODO: GET Cursor Background Agents → normalize to CloudSession[]
      return [];
    case "codex":
    case "claude":
    case "hermes":
    default:
      return [];
  }
}
