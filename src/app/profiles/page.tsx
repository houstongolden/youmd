import type { Metadata } from "next";
import { ProfilesDirectoryContent } from "./profiles-content";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Profiles — you.md",
  description:
    "Browse identity profiles on the you.md network. Every profile readable by any AI agent.",
  openGraph: {
    title: "Profiles — you.md",
    description:
      "Browse identity profiles on the you.md network. Every profile readable by any AI agent.",
    url: "https://you.md/profiles",
    siteName: "you.md",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Profiles — you.md",
    description:
      "Browse identity profiles on the you.md network. Every profile readable by any AI agent.",
  },
  alternates: {
    canonical: "https://you.md/profiles",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  name: "you.md Profiles Directory",
  description:
    "Browse identity profiles on the you.md network. Every profile readable by any AI agent.",
  url: "https://you.md/profiles",
  isPartOf: {
    "@type": "WebSite",
    name: "you.md",
    url: "https://you.md",
  },
};

interface SsrProfile {
  username: string;
  name?: string;
  tagline?: string;
  location?: string;
  avatarUrl?: string;
  isClaimed?: boolean;
  updatedAt?: number;
}

async function fetchProfiles(): Promise<SsrProfile[]> {
  try {
    const convexUrl = (process.env.NEXT_PUBLIC_CONVEX_URL || "https://kindly-cassowary-600.convex.cloud").replace(".cloud", ".site");
    const res = await fetch(`${convexUrl}/api/v1/profiles`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export default async function ProfilesPage() {
  const ssrProfiles = await fetchProfiles();

  // Build JSON-LD with actual profile data
  const enrichedJsonLd = {
    ...jsonLd,
    numberOfItems: ssrProfiles.length,
    itemListElement: ssrProfiles.slice(0, 20).map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `https://you.md/${p.username}`,
      name: p.name || p.username,
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(enrichedJsonLd) }}
      />
      {/* SSR profile list for SEO — renders server-side so Google sees actual profiles */}
      <div className="sr-only" aria-hidden="true">
        <h2>Profiles on you.md</h2>
        <ul>
          {ssrProfiles.map((p) => (
            <li key={p.username}>
              <a href={`/${p.username}`}>{p.name || p.username}</a>
              {p.tagline && <span> — {p.tagline}</span>}
            </li>
          ))}
        </ul>
      </div>
      <ProfilesDirectoryContent />
    </>
  );
}
