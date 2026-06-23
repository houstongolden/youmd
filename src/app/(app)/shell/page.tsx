import type { Metadata } from "next";
import { DashboardContent } from "../dashboard/dashboard-content";
import { ShellV2 } from "./ShellV2";
import { loadRealData } from "../../(desktop)/desktop-demo/_lib/realData";

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

// The new 6-destination IA (ShellV2) is now the DEFAULT. The previous Convex
// shell remains available at /shell?ui=classic (or YOUMD_SHELL_LEGACY=1) as a
// one-flag rollback.
export default async function ShellPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const legacy = sp.ui === "classic" || sp.ui === "legacy" || process.env.YOUMD_SHELL_LEGACY === "1";
  if (legacy) {
    return <DashboardContent />;
  }
  let data = null;
  try {
    data = loadRealData();
  } catch {
    data = null;
  }
  return <ShellV2 data={data} />;
}
