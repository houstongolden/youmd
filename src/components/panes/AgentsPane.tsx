"use client";

// TODO: Wire up real agent access data from Convex (e.g., api.agents.listReads)
// Currently using mock/placeholder data

interface AgentsPaneProps {
  username: string;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[10px] font-mono text-[hsl(var(--accent))] uppercase tracking-widest mb-3">
      &gt; {children}
    </h3>
  );
}

function Divider() {
  return <div className="h-px bg-[hsl(var(--border))] my-6" />;
}

export function AgentsPane({ username }: AgentsPaneProps) {
  // TODO: Replace with useQuery(api.agents.listReads, { username })
  const agents = [
    { name: "Claude (Anthropic)", verified: true, reads: "4,201", lastAccess: "2m ago", level: "full" },
    { name: "GPT-4 (OpenAI)", verified: true, reads: "3,847", lastAccess: "14m ago", level: "full" },
    { name: "Gemini (Google)", verified: true, reads: "2,109", lastAccess: "2h ago", level: "public" },
    { name: "Perplexity", verified: true, reads: "1,892", lastAccess: "5h ago", level: "full" },
    { name: "Copilot (Microsoft)", verified: false, reads: "643", lastAccess: "1d ago", level: "public" },
    { name: "Llama (Meta)", verified: false, reads: "312", lastAccess: "2d ago", level: "public" },
    { name: "Mistral", verified: false, reads: "198", lastAccess: "3d ago", level: "public" },
  ];

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-6 py-3 border-b border-[hsl(var(--border))]">
        <span className="text-xs font-mono text-[hsl(var(--text-secondary))]">
          agents
        </span>
      </div>

      <div className="px-6 py-6 space-y-0 max-w-xl">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">
          {[
            { label: "total reads", value: "14,203" },
            { label: "agents", value: "7" },
            { label: "verified", value: "4" },
            { label: "24h reads", value: "+847" },
          ].map((s) => (
            <div
              key={s.label}
              className="border border-[hsl(var(--border))] p-3 bg-[hsl(var(--bg-raised))] text-center"
              style={{ borderRadius: "2px" }}
            >
              <p className="font-mono text-[8px] sm:text-[9px] text-[hsl(var(--text-secondary))] opacity-50 uppercase">
                {s.label}
              </p>
              <p className="font-mono text-xs sm:text-sm text-[hsl(var(--text-primary))] mt-1">
                {s.value}
              </p>
            </div>
          ))}
        </div>

        <SectionLabel>connected agents</SectionLabel>
        <div className="space-y-2">
          {agents.map((a) => (
            <div
              key={a.name}
              className="border border-[hsl(var(--border))] p-3 bg-[hsl(var(--bg-raised))]"
              style={{ borderRadius: "2px" }}
            >
              <div className="flex items-center justify-between mb-2 gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono text-[12px] text-[hsl(var(--text-primary))] opacity-80 truncate">
                    {a.name}
                  </span>
                  {a.verified && (
                    <span
                      className="font-mono text-[8px] text-[hsl(var(--success))] border border-[hsl(var(--success))]/20 px-1.5 py-0.5 shrink-0"
                      style={{ borderRadius: "2px", background: "hsl(var(--success) / 0.05)" }}
                    >
                      {"\u2713"}
                    </span>
                  )}
                </div>
                <span className={`font-mono text-[10px] uppercase shrink-0 ${
                  a.level === "full" ? "text-[hsl(var(--accent))]" : "text-[hsl(var(--text-secondary))] opacity-50"
                }`}>
                  {a.level}
                </span>
              </div>
              <div className="flex items-center gap-4 font-mono text-[9px] text-[hsl(var(--text-secondary))] opacity-40">
                <span>reads: {a.reads}</span>
                <span>last: {a.lastAccess}</span>
              </div>
            </div>
          ))}
        </div>

        <Divider />

        <SectionLabel>access policy</SectionLabel>
        <div
          className="border border-[hsl(var(--border))] p-3 bg-[hsl(var(--bg-raised))] space-y-2"
          style={{ borderRadius: "2px" }}
        >
          {[
            { label: "default access", value: "public context only" },
            { label: "verified agents", value: "full context" },
            { label: "unverified agents", value: "public context" },
            { label: "blocked agents", value: "0" },
          ].map((p) => (
            <div key={p.label} className="flex items-center justify-between font-mono text-[11px]">
              <span className="text-[hsl(var(--text-secondary))] opacity-60">{p.label}</span>
              <span className="text-[hsl(var(--text-primary))] opacity-70">{p.value}</span>
            </div>
          ))}
        </div>

        <Divider />

        <SectionLabel>top queries about @{username}</SectionLabel>
        <div className="space-y-0">
          {[
            { query: `What does ${username} do?`, count: "2,341" },
            { query: `Is ${username} available for consulting?`, count: "891" },
            { query: `What are ${username}'s current projects?`, count: "743" },
            { query: `${username} contact information`, count: "612" },
            { query: `${username} expertise and skills`, count: "508" },
          ].map((q, i) => (
            <div
              key={i}
              className="flex items-center justify-between py-2 border-b border-[hsl(var(--border))] opacity-30 last:border-0 gap-2"
            >
              <span className="font-mono text-[11px] text-[hsl(var(--text-primary))] opacity-60 flex-1 min-w-0 truncate">
                &quot;{q.query}&quot;
              </span>
              <span className="font-mono text-[10px] text-[hsl(var(--text-secondary))] opacity-40 shrink-0">
                {q.count}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
