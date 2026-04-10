import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// Redirect /dashboard → /shell (shell is the new canonical route)
export default function DashboardRedirect() {
  redirect("/shell");
}
