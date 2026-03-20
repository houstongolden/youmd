"use client";

// TODO: Wire up real portrait data from Convex (e.g., api.portraits.getByUser)
// Currently using placeholder ASCII art and mock settings

interface PortraitPaneProps {
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

const PLACEHOLDER_PORTRAIT = `                    \u2591\u2591\u2591\u2591\u2591\u2591\u2592\u2592\u2592\u2592\u2592\u2592\u2593\u2593\u2593\u2593\u2593\u2593\u2593\u2593\u2592\u2592\u2592\u2592\u2592\u2592\u2591\u2591\u2591\u2591\u2591\u2591
                \u2591\u2591\u2592\u2592\u2592\u2593\u2593\u2593\u2593\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2593\u2593\u2593\u2593\u2592\u2592\u2592\u2591\u2591
            \u2591\u2591\u2592\u2593\u2593\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2593\u2593\u2592\u2591\u2591
          \u2591\u2592\u2593\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2593\u2592\u2591
        \u2591\u2592\u2593\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2592\u2591
      \u2591\u2592\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2592\u2591
      \u2592\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2592
    \u2591\u2593\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588      \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588      \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2593\u2591
    \u2592\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588  \u25CF\u25CF  \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588  \u25CF\u25CF  \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2592
    \u2593\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588      \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588      \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2593
    \u2593\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2593
    \u2592\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2592
    \u2591\u2593\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2593\u2591
      \u2592\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588    \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588    \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2592
      \u2591\u2592\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2592\u2591
        \u2591\u2592\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2592\u2591
          \u2591\u2592\u2593\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2593\u2592\u2591
            \u2591\u2591\u2592\u2593\u2593\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2593\u2593\u2592\u2591\u2591
                \u2591\u2591\u2592\u2592\u2592\u2593\u2593\u2593\u2593\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2593\u2593\u2593\u2593\u2592\u2592\u2592\u2591\u2591
                    \u2591\u2591\u2591\u2591\u2591\u2591\u2592\u2592\u2592\u2592\u2592\u2592\u2593\u2593\u2593\u2593\u2593\u2593\u2592\u2592\u2592\u2592\u2592\u2592\u2591\u2591\u2591\u2591\u2591\u2591`;

export function PortraitPane({ username }: PortraitPaneProps) {
  return (
    <div className="h-full overflow-y-auto">
      <div className="px-6 py-3 border-b border-[hsl(var(--border))]">
        <span className="text-xs font-mono text-[hsl(var(--text-secondary))]">
          portrait
        </span>
      </div>

      <div className="px-6 py-6 space-y-0 max-w-xl">
        <SectionLabel>current portrait -- @{username}</SectionLabel>
        <div
          className="border border-[hsl(var(--border))] p-4 bg-[hsl(var(--bg-raised))] mb-2 overflow-x-auto"
          style={{ borderRadius: "2px" }}
        >
          <pre className="font-mono text-[4px] sm:text-[6px] leading-[1.05] text-[hsl(var(--accent))] opacity-80 whitespace-pre select-all">
            {PLACEHOLDER_PORTRAIT}
          </pre>
        </div>

        <Divider />

        <SectionLabel>settings</SectionLabel>
        <div
          className="border border-[hsl(var(--border))] p-3 bg-[hsl(var(--bg-raised))] space-y-2"
          style={{ borderRadius: "2px" }}
        >
          {[
            { label: "style", value: "block \u00B7 120 col" },
            { label: "detail level", value: "high" },
            { label: "characters", value: "\u2591\u2592\u2593\u2588 \u25CF" },
            { label: "source image", value: "linkedin avatar" },
            { label: "last generated", value: "2025-03-19 14:22" },
          ].map((s) => (
            <div key={s.label} className="flex items-center justify-between font-mono text-[11px]">
              <span className="text-[hsl(var(--text-secondary))] opacity-60">{s.label}</span>
              <span className="text-[hsl(var(--text-primary))] opacity-70">{s.value}</span>
            </div>
          ))}
        </div>

        <Divider />

        <SectionLabel>regenerate</SectionLabel>
        <div
          className="border border-[hsl(var(--border))] p-3 bg-[hsl(var(--bg-raised))]"
          style={{ borderRadius: "2px" }}
        >
          <p className="font-mono text-[10px] text-[hsl(var(--text-secondary))] opacity-50">
            regenerate your portrait via terminal:
          </p>
          <div className="mt-2 space-y-1">
            <div
              className="font-mono text-[11px] text-[hsl(var(--accent))] bg-[hsl(var(--bg))] px-3 py-2 overflow-x-auto"
              style={{ borderRadius: "2px" }}
            >
              &gt; /portrait --regenerate
            </div>
            <div
              className="font-mono text-[11px] text-[hsl(var(--text-secondary))] opacity-40 bg-[hsl(var(--bg))] px-3 py-2 overflow-x-auto"
              style={{ borderRadius: "2px" }}
            >
              &gt; /portrait --style braille --cols 160
            </div>
          </div>
        </div>

        <Divider />

        <SectionLabel>available styles</SectionLabel>
        <div className="space-y-2">
          {[
            { name: "block", sample: "\u2591\u2592\u2593\u2588", desc: "default -- high density block characters" },
            { name: "braille", sample: "\u2801\u2803\u2807\u2847\u28C7\u28E7\u28F7\u28FF", desc: "unicode braille -- ultra fine detail" },
            { name: "ascii", sample: ".:-=+*#%@", desc: "classic ascii ramp -- retro terminal" },
            { name: "minimal", sample: "\u00B7\u2218\u25CB\u25CF", desc: "dot matrix -- clean and sparse" },
          ].map((style) => (
            <div
              key={style.name}
              className="border border-[hsl(var(--border))] p-3 bg-[hsl(var(--bg-raised))]"
              style={{ borderRadius: "2px" }}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-[12px] text-[hsl(var(--text-primary))] opacity-80">
                  {style.name}
                </span>
                <span className="font-mono text-[11px] text-[hsl(var(--accent))] opacity-60 tracking-widest">
                  {style.sample}
                </span>
              </div>
              <p className="font-mono text-[9px] text-[hsl(var(--text-secondary))] opacity-40">
                {style.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
