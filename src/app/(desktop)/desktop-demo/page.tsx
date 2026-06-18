import type { Metadata } from "next";
import { DesktopShell } from "./_components/DesktopShell";

export const metadata: Metadata = {
  title: "you.md — desktop (private demo)",
  description:
    "Private design demo of the you.md native desktop app. Frontend only.",
  robots: { index: false, follow: false },
};

// Private, non-functional design demo. All data is mocked locally; nothing
// here talks to Convex or the real API. The goal is to lock the UI/UX of the
// upcoming native desktop app (Tauri/RN target) before building it for real.
export default function DesktopDemoPage() {
  return <DesktopShell />;
}
