import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Create Your Agent Brain — you.md",
  description:
    "Pick a username, create your agent brain, and start building portable expertise stacks for the AI tools you already use.",
  openGraph: {
    title: "Create Your Agent Brain — you.md",
    description:
      "Create your durable agent brain and private-by-default YouStacks in seconds.",
    url: "https://you.md/create",
    siteName: "you.md",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Create Your Agent Brain — you.md",
    description:
      "Create your durable agent brain and portable expertise stacks in seconds.",
  },
  alternates: {
    canonical: "https://you.md/create",
  },
};

export default async function CreatePage({
  searchParams,
}: {
  searchParams: Promise<{ handle?: string }>;
}) {
  // U9 — the landing "magic moment" funnels here with ?handle=<github handle>
  // so the claimed username can be prefilled in the sign-up terminal.
  const { handle } = await searchParams;
  const clean = (handle || "").toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 39);
  redirect(clean ? `/sign-up?handle=${encodeURIComponent(clean)}` : "/sign-up");
}
