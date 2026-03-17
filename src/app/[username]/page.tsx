import { ProfileContent } from "./profile-content";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

// ── Server-side metadata generation for SEO / OG tags ──
export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

  // Fallback metadata if Convex isn't reachable
  const fallback: Metadata = {
    title: `${username} — you.md`,
    description: `${username}'s profile on you.md`,
    openGraph: {
      title: `${username} — you.md`,
      description: `${username}'s profile on you.md`,
      url: `https://you.md/${username}`,
      siteName: "you.md",
      type: "profile",
    },
    twitter: {
      card: "summary",
      title: `${username} — you.md`,
      description: `${username}'s profile on you.md`,
    },
  };

  if (!convexUrl) return fallback;

  try {
    // Fetch from the Convex HTTP API (public endpoint, no auth needed)
    const apiBase = convexUrl.replace(".cloud", ".site");
    const res = await fetch(
      `${apiBase}/api/v1/profiles?username=${encodeURIComponent(username)}`,
      {
        headers: { Accept: "application/json" },
        next: { revalidate: 60 },
      }
    );

    if (!res.ok) return fallback;

    const data = await res.json();
    const name = data?.identity?.name || username;
    const tagline = data?.identity?.tagline || "";
    const bio =
      data?.identity?.bio?.long ||
      data?.identity?.bio?.medium ||
      data?.identity?.bio?.short ||
      "";

    const title = `${name} — you.md/${username}`;
    const description = tagline || bio || `${name}'s profile on you.md`;

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        url: `https://you.md/${username}`,
        siteName: "you.md",
        type: "profile",
      },
      twitter: {
        card: "summary",
        title,
        description,
      },
      alternates: {
        canonical: `https://you.md/${username}`,
      },
    };
  } catch {
    return fallback;
  }
}

export default function ProfilePage() {
  return <ProfileContent />;
}
