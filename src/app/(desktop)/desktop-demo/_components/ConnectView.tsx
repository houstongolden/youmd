"use client";

import { PixelCharacter } from "@/components/ui/PixelCharacter";
import { MODELS, type AgentSession } from "../_data/mock";
import { Dot, Chip } from "./primitives";
import { Icon } from "./icons";

// The connect surface for a cloud-agent provider (Cursor / Codex / Claude
// cloud). Launching/running/watching agents in a vendor cloud sandbox runs
// through that provider's API + your key — connect here, then cloud sessions
// stream in the watch view just like your own machines.
const PROVIDER_DOCS: Record<string, { name: string; api: string; does: string }> = {
  cursor: { name: "Cursor", api: "Cursor Background Agents API", does: "launch + monitor background agents in Cursor's cloud" },
  codex: { name: "Codex", api: "Codex cloud / OpenAI API", does: "run + watch tasks in a Codex cloud sandbox" },
  "claude-code": { name: "Claude", api: "Claude Agent SDK", does: "run headless Claude agents in the cloud" },
  hermes: { name: "Hermes", api: "Hermes Agent API", does: "run always-on Hermes agents" },
};

export function ConnectView({ session, onConnect }: { session: AgentSession; onConnect?: (provider: string) => void }) {
  const model = MODELS.find((m) => m.id === session.model);
  const p = PROVIDER_DOCS[session.model] ?? { name: model?.label ?? session.agent, api: "provider API", does: "run + watch cloud agents" };

  return (
    <div className="flex h-full flex-col bg-[hsl(var(--bg))]">
      <div className="flex items-center gap-2.5 border-b border-[hsl(var(--border))] px-4 py-2.5">
        <PixelCharacter kind="machine" seed={session.agent} status="idle" size="sm" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-mono text-[12.5px] text-[hsl(var(--text-primary))]">{p.name} cloud</span>
            <Chip>
              <Icon name="cloud" size={9} /> not connected
            </Chip>
          </div>
          <div className="truncate font-mono text-[10px] uppercase tracking-wider text-[hsl(var(--text-secondary))]/55">{session.machine}</div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6">
        <div className="mx-auto max-w-md">
          <h3 className="mb-2 font-mono text-[15px] font-semibold text-[hsl(var(--text-primary))]">Connect {p.name} cloud</h3>
          <p className="mb-4 text-[13px] leading-relaxed text-[hsl(var(--text-secondary))]/80">
            Launch, run, and watch agents in {p.name}&apos;s cloud sandbox — alongside the agents on your own
            machines. Connecting authorizes the <span className="text-[hsl(var(--text-primary))]">{p.api}</span> with a
            key stored encrypted in your env vault; you never expose it.
          </p>
          <div className="mb-5 space-y-1.5">
            {[`Spawn agents that ${p.does}`, "Watch their live progress in this shell", "Collaborate / nudge / join from any machine"].map((f) => (
              <div key={f} className="flex items-center gap-2 text-[12.5px] text-[hsl(var(--text-secondary))]">
                <Dot tone="green" size={5} /> {f}
              </div>
            ))}
          </div>
          <button
            onClick={() => onConnect?.(p.name)}
            className="flex items-center gap-2 rounded-sm bg-[hsl(var(--accent))] px-3.5 py-2 font-mono text-[12px] text-white transition-opacity hover:opacity-90"
          >
            <Icon name="cloud" size={14} /> Connect {p.name}
          </button>
          <p className="mt-3 font-mono text-[10px] text-[hsl(var(--text-secondary))]/45">
            authorizes via OAuth or an API key · stored in your trusted-device env vault
          </p>
        </div>
      </div>
    </div>
  );
}
