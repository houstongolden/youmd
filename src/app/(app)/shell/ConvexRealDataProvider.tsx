"use client";

// Maps the authed user's REAL Convex data into the new-IA RealData shape and
// provides it to the converged shell. Mirrors the exact queries the existing
// shell already uses (so the calls are proven), and maps defensively — any
// missing/shape-shifted field just yields fewer items, never a crash. The
// production shell is truth-first: when real data is still loading or absent,
// it renders explicit empty/loading states instead of desktop-demo fixtures.
import { useMemo } from "react";
import { useUser } from "@/lib/you-auth";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { RealDataProvider } from "../../(desktop)/desktop-demo/_lib/RealDataContext";
import type { RealData, RealProject, RealSkill, RealSession } from "../../(desktop)/desktop-demo/_lib/realData";

type Row = Record<string, unknown>;
const arr = (v: unknown): Row[] => (Array.isArray(v) ? (v as Row[]) : []);
const str = (v: unknown): string | undefined => (typeof v === "string" && v ? v : undefined);
const num = (v: unknown): number | undefined => (typeof v === "number" ? v : undefined);
const rel = (ms?: number) => {
  if (!ms) return "";
  const s = Math.max(0, (Date.now() - ms) / 1000);
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
};

export function ConvexRealDataProvider({
  fallback,
  children,
}: {
  fallback: RealData | null;
  children: React.ReactNode;
}) {
  const { user } = useUser();
  const { isAuthenticated } = useConvexAuth();
  const clerkId = isAuthenticated ? user?.id : undefined;

  const convexUser = useQuery(api.users.getByClerkId, clerkId ? { clerkId } : "skip") as Row | null | undefined;
  const userId = (convexUser?._id as Id<"users"> | undefined) ?? undefined;

  const portfolio = useQuery(api.portfolio.listPortfolioGraph, clerkId ? { clerkId } : "skip") as Row | undefined;
  const installs = useQuery(api.skills.listInstalls, clerkId && userId ? { clerkId, userId } : "skip") as unknown;
  const profile = useQuery(api.profiles.getByOwnerId, userId ? { ownerId: userId } : "skip") as Row | null | undefined;
  const activity = useQuery(api.brainActivity.listRecent, clerkId ? { clerkId, limit: 30 } : "skip") as unknown;
  // NOTE: activity.agentSummary errored server-side ("Called by client") and
  // crashed the shell render — dropped. Remote agent sessions are derived from
  // brainActivity (already loaded above), keeping this adapter crash-proof.

  const data = useMemo<RealData | null>(() => {
    if (!clerkId) return fallback;
    const projRows = arr(portfolio?.projects);
    if (projRows.length === 0 && !profile) return fallback; // nothing real yet

    const projects: RealProject[] = projRows.map((p) => {
      const name = str(p.name) ?? str(p.slug) ?? "project";
      const slug = str(p.slug) ?? name;
      const brainRepo = /you-md$/.test(slug) || /you-md$/.test(name) || name.includes("-you-md");
      return {
        name,
        remote: str(p.repoUrl) ?? str(p.remote) ?? str(p.githubUrl),
        hasEnvLocal: Boolean(p.hasEnvLocal),
        hasAgentDocs: Boolean(p.hasAgentDocs),
        hasProjectContext: Boolean(p.hasProjectContext),
        blurb: str(p.summary) ?? str(p.description) ?? str(p.status),
        files: [],
        isBrainRepo: brainRepo,
        label: brainRepo ? "source of truth" : undefined,
      };
    });
    projects.sort((a, b) => Number(Boolean(b.isBrainRepo)) - Number(Boolean(a.isBrainRepo)));

    const skills: RealSkill[] = arr(installs)
      .map((i): RealSkill | null => {
        const name = str(i.skillName) ?? str(i.name) ?? str(i.slug);
        return name ? { name, source: "you.md" } : null;
      })
      .filter((x): x is RealSkill => Boolean(x));

    const brain = [] as RealData["brain"];
    if (profile) {
      const push = (id: string, content?: string) => {
        if (content) brain.push({ id, name: id.split("/").pop()!, group: "identity", content });
      };
      push("profile/about.md", str(profile.bio) ?? str(profile.about) ?? str(profile.tagline));
      push("profile/now.md", str(profile.now) ?? str((profile.nowText as unknown)));
      const vals = profile.values;
      if (Array.isArray(vals) && vals.length) push("profile/values.md", "- " + vals.map(String).join("\n- "));
    }

    const acts: RealData["activity"] = arr(activity)
      .slice(0, 24)
      .map((a, i) => ({
        id: str(a._id) ?? `a${i}`,
        actor: str(a.sourceAgent) ?? str(a.agent) ?? str(a.source) ?? "agent",
        kind: /machine|host|sync/i.test(str(a.source) ?? str(a.channel) ?? "") ? "machine" : "agent",
        text: str(a.body) ?? str(a.text) ?? str(a.summary) ?? "activity",
        at: rel(num(a.createdAt) ?? num(a.at)),
      }));

    // Sessions: a pinned local You session + recent agents from the bus summary.
    const sessions: RealSession[] = [
      {
        id: "you-local",
        title: "You",
        kind: "chat",
        agent: "you-agent",
        model: "you",
        project: projects[0]?.name ?? "you.md",
        machine: "this machine",
        local: true,
        status: "active",
        summary: "Your you.md agent — full brain context.",
        task: "Ask your brain anything",
      },
      ...Array.from(
        new Map(
          arr(activity).map((a) => {
            const agent = str(a.sourceAgent) ?? str(a.agent) ?? "agent";
            const host = (str(a.sourceHost) ?? "").replace(/\.lan$/, "");
            const meta = (a.metadata ?? {}) as Row;
            return [`${agent}|${host}`, { agent, host, project: str(meta.projectSlug) ?? str(a.channel), summary: str(a.body) ?? str(a.text) }] as const;
          }),
        ).values(),
      )
        .filter((g) => g.host)
        .slice(0, 10)
        .map((g, i): RealSession => ({
          id: `agent:${g.agent}:${i}`,
          title: g.agent,
          kind: "terminal",
          agent: g.agent,
          model: "claude-code",
          project: g.project ?? projects[0]?.name ?? "you.md",
          machine: g.host,
          local: false,
          status: "active",
          summary: g.summary ?? "agent activity",
        })),
    ];

    return {
      available: projects.length > 0 || brain.length > 0,
      root: "you.md",
      projects,
      skills,
      stacks: fallback?.stacks ?? [],
      brain,
      activity: acts,
      sessions,
      machine: { host: str(convexUser?.hostName), envLocal: projects.filter((p) => p.hasEnvLocal).length },
      counts: { projects: projects.length, skills: skills.length, brain: brain.length, sessions: sessions.length },
    };
  }, [clerkId, portfolio, installs, profile, activity, convexUser, fallback]);

  return <RealDataProvider value={data ?? fallback} allowMockFallback={false}>{children}</RealDataProvider>;
}
