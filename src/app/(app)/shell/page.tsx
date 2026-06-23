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

// The new 6-destination IA is available behind ?ui=v2 (and YOUMD_SHELL_V2=1)
// while it's wired to real Convex data; the existing shell stays the default so
// production is never disrupted.
export default async function ShellPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const v2 = sp.ui === "v2" || process.env.YOUMD_SHELL_V2 === "1";
  if (v2) {
    let data = null;
    try {
      data = loadRealData();
    } catch {
      data = null;
    }
    return <ShellV2 data={data} />;
  }
  return <DashboardContent />;
}
