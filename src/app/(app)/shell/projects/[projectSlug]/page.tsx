import type { Metadata } from "next";
import { DashboardContent } from "../../../dashboard/dashboard-content";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Project — you.md shell",
  description: "Dedicated You.md shell project detail view.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function ShellProjectDetailPage() {
  return <DashboardContent />;
}
