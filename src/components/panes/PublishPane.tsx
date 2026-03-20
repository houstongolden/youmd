"use client";

// TODO: Wire up real deploy history from Convex (e.g., api.bundles.listVersions)
// Currently using mock/placeholder data

interface PublishPaneProps {
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

export function PublishPane({ username }: PublishPaneProps) {
  // TODO: Replace with real data from useQuery(api.bundles.getDeployHistory, ...)
  const deploys = [
    { version: "v47", time: "19 Mar 14:22", trigger: "auto -- linkedin sync", status: "live" },
    { version: "v46", time: "19 Mar 09:15", trigger: "manual -- bio update", status: "archived" },
    { version: "v45", time: "18 Mar 22:41", trigger: "auto -- github sync", status: "archived" },
    { version: "v44", time: "18 Mar 16:03", trigger: "auto -- x/twitter sync", status: "archived" },
    { version: "v43", time: "17 Mar 11:28", trigger: "manual -- portrait regen", status: "archived" },
  ];

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-6 py-3 border-b border-[hsl(var(--border))]">
        <span className="text-xs font-mono text-[hsl(var(--text-secondary))]">
          publish
        </span>
      </div>

      <div className="px-6 py-6 space-y-0 max-w-xl">
        <SectionLabel>live status</SectionLabel>
        <div
          className="border border-[hsl(var(--border))] p-4 bg-[hsl(var(--bg-raised))] mb-2"
          style={{ borderRadius: "2px" }}
        >
          <div className="flex items-center gap-2 mb-3">
            <span
              className="w-2 h-2 rounded-full status-dot-pulse"
              style={{ background: "hsl(var(--success))" }}
            />
            <span className="font-mono text-[12px] text-[hsl(var(--success))]">LIVE</span>
          </div>
          <div className="space-y-2">
            {[
              { label: "public url", value: `you.md/${username}`, accent: true },
              { label: "last published", value: "2025-03-19 14:22:08 UTC", accent: false },
              { label: "publish mode", value: "auto-publish on sync", accent: false },
              { label: "version", value: "v47", accent: false },
            ].map((r) => (
              <div key={r.label} className="flex items-center justify-between font-mono text-[11px]">
                <span className="text-[hsl(var(--text-secondary))] opacity-60">{r.label}</span>
                <span className={r.accent ? "text-[hsl(var(--accent))]" : "text-[hsl(var(--text-primary))] opacity-70"}>
                  {r.value}
                </span>
              </div>
            ))}
          </div>
        </div>

        <Divider />

        <SectionLabel>domain</SectionLabel>
        <div
          className="border border-[hsl(var(--border))] p-3 bg-[hsl(var(--bg-raised))] space-y-2"
          style={{ borderRadius: "2px" }}
        >
          {[
            { label: "primary", value: `you.md/${username}`, active: true },
            { label: "custom", value: "not configured", active: false },
            { label: "api endpoint", value: `api.you.md/v1/${username}`, active: true },
          ].map((d) => (
            <div key={d.label} className="flex items-center justify-between font-mono text-[11px]">
              <span className="text-[hsl(var(--text-secondary))] opacity-60 shrink-0">{d.label}</span>
              <span className={`truncate ml-2 ${d.active ? "text-[hsl(var(--text-primary))] opacity-70" : "text-[hsl(var(--text-secondary))] opacity-40"}`}>
                {d.value}
              </span>
            </div>
          ))}
        </div>

        <Divider />

        <SectionLabel>recent deploys</SectionLabel>
        <div className="space-y-0">
          {deploys.map((d) => (
            <div
              key={d.version}
              className="flex items-center justify-between py-2.5 border-b border-[hsl(var(--border))] opacity-30 last:border-0"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="font-mono text-[11px] text-[hsl(var(--accent))] opacity-60 w-8 shrink-0">
                  {d.version}
                </span>
                <span className="font-mono text-[11px] text-[hsl(var(--text-primary))] opacity-70 truncate">
                  {d.trigger}
                </span>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="font-mono text-[10px] text-[hsl(var(--text-secondary))] opacity-40 hidden sm:inline">
                  {d.time}
                </span>
                <span className={`font-mono text-[10px] ${d.status === "live" ? "text-[hsl(var(--success))]" : "text-[hsl(var(--text-secondary))] opacity-30"}`}>
                  {d.status}
                </span>
              </div>
            </div>
          ))}
        </div>

        <Divider />

        <SectionLabel>commands</SectionLabel>
        <div
          className="border border-[hsl(var(--border))] p-3 bg-[hsl(var(--bg-raised))]"
          style={{ borderRadius: "2px" }}
        >
          <div className="space-y-1">
            <div
              className="font-mono text-[11px] text-[hsl(var(--accent))] bg-[hsl(var(--bg))] px-3 py-2 overflow-x-auto"
              style={{ borderRadius: "2px" }}
            >
              &gt; /publish
            </div>
            <div
              className="font-mono text-[11px] text-[hsl(var(--text-secondary))] opacity-40 bg-[hsl(var(--bg))] px-3 py-2 overflow-x-auto"
              style={{ borderRadius: "2px" }}
            >
              &gt; /publish --rollback v46
            </div>
            <div
              className="font-mono text-[11px] text-[hsl(var(--text-secondary))] opacity-40 bg-[hsl(var(--bg))] px-3 py-2 overflow-x-auto"
              style={{ borderRadius: "2px" }}
            >
              &gt; set domain custom.example.com
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
