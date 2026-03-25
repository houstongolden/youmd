import type { Metadata } from "next";
import { DashboardContent } from "./dashboard-content";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dashboard — you.md",
  description:
    "Manage your identity file, edit your profile, and configure your agent preferences.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function DashboardPage() {
  return <DashboardContent />;
}
