import type { Metadata, Viewport } from "next";
import { DesktopShell } from "./_components/DesktopShell";
import { ToastProvider } from "./_components/Toast";
import { RealDataProvider } from "./_lib/RealDataContext";
import { loadRealData } from "./_lib/realData";

// Read real local you.md state on each request (dev tool) so the demo shows
// actual projects/skills/brain/activity. Recomputed live; cheap fs reads.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "you.md — desktop (private demo)",
  description:
    "Private design demo of the you.md native desktop app. Frontend only.",
  robots: { index: false, follow: false },
};

// `viewport-fit=cover` lets the env(safe-area-inset-*) values resolve on
// notched phones so the title bar / bottom tab bar dodge the notch and home
// indicator. Scoped to this route's page so it doesn't affect the rest of the site.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

// Private, non-functional design demo. All data is mocked locally; nothing
// here talks to Convex or the real API. The goal is to lock the UI/UX of the
// upcoming native desktop app (Tauri/RN target) before building it for real.
export default function DesktopDemoPage() {
  let real = null;
  try {
    real = loadRealData();
  } catch {
    real = null; // fall back to mock if local state isn't readable
  }
  return (
    <RealDataProvider value={real}>
      <ToastProvider>
        <DesktopShell />
      </ToastProvider>
    </RealDataProvider>
  );
}
