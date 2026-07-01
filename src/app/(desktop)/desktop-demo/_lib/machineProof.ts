import type { RealData, RealSession } from "./realData";

export type MachineProofRow = {
  name: string;
  detail: string;
  status: RealSession["status"] | "synced";
  lastSync: string;
  current: boolean;
  sessions: number;
};

function machineKey(machine?: string | null): string | null {
  const raw = machine?.trim();
  if (!raw) return null;
  const lowered = raw.toLowerCase();
  if (lowered === "unknown" || lowered === "this machine") return null;
  return lowered.replace(/\.local$/, "").replace(/\.lan$/, "");
}

function displayName(machine: string) {
  return machine.trim().replace(/\.local$/i, "").replace(/\.lan$/i, "");
}

function mergeStatus(current: MachineProofRow["status"], next: RealSession["status"]): MachineProofRow["status"] {
  if (current === "blocked" || next === "blocked") return "blocked";
  if (current === "waiting" || next === "waiting") return "waiting";
  if (current === "active" || next === "active") return "active";
  if (current === "synced") return next;
  return current;
}

export function realMachineRows(real: RealData | null | undefined): MachineProofRow[] {
  if (!real?.available) return [];

  const rows = new Map<string, MachineProofRow>();
  const hostKey = machineKey(real.machine?.host);

  if (hostKey && real.machine?.host) {
    rows.set(hostKey, {
      name: displayName(real.machine.host),
      detail: `${real.machine.ready ?? real.machine.envLocal ?? 0}/${real.machine.scanned ?? real.projects.length} projects ready`,
      status: "synced",
      lastSync: "real proof",
      current: true,
      sessions: 0,
    });
  }

  for (const session of real.sessions ?? []) {
    const key = machineKey(session.machine);
    if (!key) continue;
    const prev = rows.get(key);
    if (!prev) {
      rows.set(key, {
        name: displayName(session.machine),
        detail: "1 session",
        status: session.status,
        lastSync: "live session",
        current: hostKey === key || Boolean(session.local),
        sessions: 1,
      });
      continue;
    }
    prev.sessions += 1;
    prev.detail = `${prev.sessions} session${prev.sessions === 1 ? "" : "s"}`;
    prev.status = mergeStatus(prev.status, session.status);
    prev.current = prev.current || Boolean(session.local);
    if (prev.lastSync !== "live session") prev.lastSync = "live session";
  }

  return Array.from(rows.values()).sort((a, b) => Number(b.current) - Number(a.current) || a.name.localeCompare(b.name));
}

export function realMachineCount(real: RealData | null | undefined): number {
  return realMachineRows(real).length;
}
