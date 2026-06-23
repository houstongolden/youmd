"use client";

// New-IA shell (converged from the /desktop-demo architecture) mounted inside
// the authed app. Reuses the demo's chrome + real-data context. Gated behind
// ?ui=v2 so the existing shell stays the default until this is fully wired.
import "../../(desktop)/desktop-demo/desktop-demo.css";
import { DesktopShell } from "../../(desktop)/desktop-demo/_components/DesktopShell";
import { ToastProvider } from "../../(desktop)/desktop-demo/_components/Toast";
import { ConvexRealDataProvider } from "./ConvexRealDataProvider";
import type { RealData } from "../../(desktop)/desktop-demo/_lib/realData";

export function ShellV2({ data }: { data: RealData | null }) {
  return (
    <ConvexRealDataProvider fallback={data}>
      <ToastProvider>
        {/* Full-viewport app surface: fixed overlay so the shell owns the whole
            screen (its TitleBar is the chrome) and the site's SiteNav can't
            cause a double-scroll or eat height. */}
        <div className="youmd-desktop fixed inset-0 z-50 overflow-hidden bg-[hsl(var(--bg))] text-[hsl(var(--text-primary))]">
          <DesktopShell />
        </div>
      </ToastProvider>
    </ConvexRealDataProvider>
  );
}
