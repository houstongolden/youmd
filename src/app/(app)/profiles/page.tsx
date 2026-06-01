import type { Metadata } from "next";
import { CONVEX_SITE_URL } from "@/lib/constants";
import { ProfilesDirectoryContent } from "./profiles-content";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Profiles — you.md",
  description:
    "Browse public agent brains on the you.md network. Every public profile is readable by AI agents.",
  openGraph: {
    title: "Profiles — you.md",
    description:
      "Browse public agent brains and YouStacks on the you.md network.",
    url: "https://you.md/profiles",
    siteName: "you.md",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Profiles — you.md",
    description:
      "Browse public agent brains and YouStacks on the you.md network.",
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
    "Browse public agent brains and YouStacks on the you.md network.",
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

function isSuppressedDirectoryUsername(username: string) {
  return /^(qaprune|qarepro|qaclean|qastale|qalocal|qaweb|websignin|youmdqa|youmdreg)[a-z0-9-]*/i.test(username);
}

async function fetchProfiles(): Promise<SsrProfile[]> {
  try {
    const res = await fetch(`${CONVEX_SITE_URL}/api/v1/profiles`, {
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    const seen = new Set<string>();
    return data.filter((profile) => {
      const username = String(profile?.username ?? "").trim().toLowerCase();
      if (!username || isSuppressedDirectoryUsername(username) || seen.has(username)) return false;
      seen.add(username);
      profile.username = username;
      return true;
    });
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
          {ssrProfiles.map((p, i) => (
            <li key={`${p.username}-${i}`}>
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
