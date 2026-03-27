import type { Metadata } from "next";
import { DashboardContent } from "./dashboard-content";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Shell — you.md",
  description:
    "Your identity shell. Manage context, edit profile, configure agent preferences.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function DashboardPage() {
  return <DashboardContent />;
}
