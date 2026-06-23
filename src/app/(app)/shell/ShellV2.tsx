"use client";

// New-IA shell (converged from the /desktop-demo architecture) mounted inside
// the authed app. Reuses the demo's chrome + real-data context. Gated behind
// ?ui=v2 so the existing shell stays the default until this is fully wired.
import "../../(desktop)/desktop-demo/desktop-demo.css";
import { DesktopShell } from "../../(desktop)/desktop-demo/_components/DesktopShell";
import { ToastProvider } from "../../(desktop)/desktop-demo/_components/Toast";
import { ConvexRealDataProvider } from "./ConvexRealDataProvider";
import type { RealData } from "../../(desktop)/desktop-demo/_lib/realData";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { DashboardContent } from "../dashboard/dashboard-content";

export function ShellV2({ data }: { data: RealData | null }) {
  return (
    // If the new shell's data layer throws, degrade to the proven classic shell
    // rather than a blank "render failed".
    <ErrorBoundary fallback={<DashboardContent />}>
      <ConvexRealDataProvider fallback={data}>
        <ToastProvider>
          {/* App surface sized to fill the viewport BELOW the sticky SiteNav
              (h-9 = 2.25rem), so the site nav stays visible above it and there's
              no double-scroll / eaten height. */}
          <div className="youmd-desktop h-[calc(100dvh-2.25rem)] w-full overflow-hidden bg-[hsl(var(--bg))] text-[hsl(var(--text-primary))]">
            <DesktopShell />
          </div>
        </ToastProvider>
      </ConvexRealDataProvider>
    </ErrorBoundary>
  );
}
