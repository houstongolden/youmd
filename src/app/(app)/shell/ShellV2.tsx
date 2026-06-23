"use client";

// New-IA shell (converged from the /desktop-demo architecture) mounted inside
// the authed app. Reuses the demo's chrome + real-data context. Gated behind
// ?ui=v2 so the existing shell stays the default until this is fully wired.
import "../../(desktop)/desktop-demo/desktop-demo.css";
import { DesktopShell } from "../../(desktop)/desktop-demo/_components/DesktopShell";
import { ToastProvider } from "../../(desktop)/desktop-demo/_components/Toast";
import { RealDataProvider } from "../../(desktop)/desktop-demo/_lib/RealDataContext";
import type { RealData } from "../../(desktop)/desktop-demo/_lib/realData";

export function ShellV2({ data }: { data: RealData | null }) {
  return (
    <RealDataProvider value={data}>
      <ToastProvider>
        <div className="youmd-desktop h-[100dvh] w-full overflow-hidden bg-[hsl(var(--bg))] text-[hsl(var(--text-primary))]">
          <DesktopShell />
        </div>
      </ToastProvider>
    </RealDataProvider>
  );
}
