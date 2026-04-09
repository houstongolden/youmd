import { ProfileContent } from "./profile-content";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

// ── Fetch profile data server-side (shared by metadata + page) ──
async function fetchProfileData(username: string) {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) return null;

  try {
    const apiBase = convexUrl.replace(".cloud", ".site");
    const res = await fetch(
      `${apiBase}/api/v1/profiles?username=${encodeURIComponent(username)}`,
      {
        headers: { Accept: "application/json" },
        next: { revalidate: 60 },
      }
    );
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ── Server-side metadata generation for SEO / OG tags ──
export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;

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
      card: "summary_large_image",
      title: `${username} — you.md`,
      description: `${username}'s profile on you.md`,
    },
    alternates: {
      canonical: `https://you.md/${username}`,
    },
  };

  const data = await fetchProfileData(username);
  if (!data) return fallback;

  const name = data?.identity?.name || username;
  const tagline = data?.identity?.tagline || "";
  const bio =
    data?.identity?.bio?.long ||
    data?.identity?.bio?.medium ||
    data?.identity?.bio?.short ||
    "";

  const title = `${name} — you.md/${username}`;
  const description = tagline
    ? `${tagline}${bio ? ` — ${bio.slice(0, 120)}` : ""}`
    : bio
      ? bio.slice(0, 200)
      : `${name}'s identity context on you.md`;
  const avatarUrl = data?._profile?.avatarUrl || data?.social_images?.github || data?.social_images?.x || "";
  const location = data?.identity?.location || "";
  const firstName = name.split(" ")[0];
  const lastName = name.split(" ").slice(1).join(" ");
  const projects = (data?.projects as Array<{ name: string }>) || [];

  return {
    title,
    description,
    keywords: [
      name,
      username,
      "identity",
      "agent",
      "AI",
      "you.md",
      ...(projects.slice(0, 5).map(p => p.name)),
    ].filter(Boolean),
    authors: [{ name, url: `https://you.md/${username}` }],
    openGraph: {
      title,
      description,
      url: `https://you.md/${username}`,
      siteName: "you.md",
      type: "profile",
      ...(avatarUrl ? { images: [{ url: avatarUrl, width: 400, height: 400, alt: `${name} profile photo` }] } : {}),
      ...(firstName ? { firstName } : {}),
      ...(lastName ? { lastName } : {}),
      username,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      ...(avatarUrl ? { images: [avatarUrl] } : {}),
    },
    alternates: {
      canonical: `https://you.md/${username}`,
      types: {
        "application/json": `https://you.md/${username}/you.json`,
        "text/plain": `https://you.md/${username}/you.txt`,
      },
    },
    other: {
      // Profile-specific OG tags
      "profile:username": username,
      ...(firstName ? { "profile:first_name": firstName } : {}),
      ...(lastName ? { "profile:last_name": lastName } : {}),
      ...(location ? { "geo.placename": location } : {}),
    },
  };
}

// ── Generate plain-text SSR fallback for agents that render HTML without JS ──
function SsrProfileText({ username, data }: { username: string; data: Record<string, any> }) {
  const name = data.identity?.name || username;
  const tagline = data.identity?.tagline || "";
  const bio = data.identity?.bio?.long || data.identity?.bio?.medium || data.identity?.bio?.short || "";
  const location = data.identity?.location || "";
  const now = data.now?.focus || [];
  const projects = data.projects || [];
  const values = data.values || [];
  const links = data.links || {};
  const preferences = data.preferences || {};
  const voice = data.analysis?.voice_summary || "";

  // Get avatar URL from the data — check _profile first (from Convex profile table), then social_images
  const avatarUrl = data._profile?.avatarUrl || data.social_images?.github || data.social_images?.x || data.social_images?.linkedin || data.social_images?.custom || "";

  // Note: this is a screen-reader-only structured-content block for SEO/agents.
  // Headings here are h2/h3 (not h1) because the visible profile content
  // already has the canonical h1 — having two h1s on one page is bad SEO.
  return (
    <div
      id="you-md-profile-data"
      data-username={username}
      data-format="you-md/v1"
      className="sr-only"
    >
      <h2>{name}</h2>
      {avatarUrl && (
        <img
          src={avatarUrl}
          alt={`${name} — profile photo on you.md`}
          width={200}
          height={200}
        />
      )}
      {tagline && <p>{tagline}</p>}
      {location && <p>Location: {location}</p>}
      {bio && <p>{bio}</p>}
      {now.length > 0 && (
        <section>
          <h3>Current Focus</h3>
          <ul>{now.map((item: string, i: number) => <li key={i}>{item}</li>)}</ul>
        </section>
      )}
      {projects.length > 0 && (
        <section>
          <h3>Projects</h3>
          <ul>
            {projects.map((p: any, i: number) => (
              <li key={i}>
                {p.name}{p.role ? ` (${p.role})` : ""}{p.status ? ` [${p.status}]` : ""}
                {p.description ? ` - ${p.description}` : ""}
              </li>
            ))}
          </ul>
        </section>
      )}
      {values.length > 0 && (
        <section>
          <h3>Values</h3>
          <ul>{values.map((v: string, i: number) => <li key={i}>{v}</li>)}</ul>
        </section>
      )}
      {Object.keys(links).filter(k => links[k]).length > 0 && (
        <section>
          <h3>Links</h3>
          <ul>
            {Object.entries(links)
              .filter(([, url]) => url)
              .map(([platform, url]) => (
                <li key={platform}>{platform}: {url as string}</li>
              ))}
          </ul>
        </section>
      )}
      {(voice || preferences?.agent) && (
        <section>
          <h3>Agent Preferences</h3>
          {voice && <p>Voice: {voice}</p>}
          {preferences?.agent?.tone && <p>Tone: {preferences.agent.tone}</p>}
          {preferences?.agent?.avoid?.length > 0 && <p>Avoid: {preferences.agent.avoid.join(", ")}</p>}
        </section>
      )}
      <p>
        Machine-readable endpoints:
        JSON: https://you.md/{username}/you.json
        Text: https://you.md/{username}/you.txt
      </p>
    </div>
  );
}

// ── Build JSON-LD structured data for SEO ──
function buildJsonLd(username: string, data: Record<string, any>) {
  const name = data.identity?.name || username;
  const tagline = data.identity?.tagline || "";
  const location = data.identity?.location || "";
  const bio = data.identity?.bio?.long || data.identity?.bio?.medium || data.identity?.bio?.short || "";

  const sameAsLinks: string[] = [];
  if (data.links?.website) sameAsLinks.push(data.links.website);
  if (data.links?.linkedin) sameAsLinks.push(data.links.linkedin);
  if (data.links?.x) sameAsLinks.push(data.links.x);
  if (data.links?.github) sameAsLinks.push(data.links.github);

  const avatarUrl = data._profile?.avatarUrl || data.social_images?.github || data.social_images?.x || data.social_images?.linkedin || data.social_images?.custom || "";

  // Build worksFor from projects
  const projects = (data.projects || []) as Array<{ name: string; description?: string; url?: string; role?: string }>;
  const worksFor = projects.length > 0 ? projects[0] : null;

  const personSchema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Person",
    name,
    url: `https://you.md/${username}`,
    ...(avatarUrl ? { image: avatarUrl } : {}),
    ...(tagline ? { jobTitle: tagline } : {}),
    ...(location ? { address: { "@type": "PostalAddress", addressLocality: location } } : {}),
    ...(bio ? { description: bio } : {}),
    ...(sameAsLinks.length > 0 ? { sameAs: sameAsLinks } : {}),
    ...(projects.length > 0 ? {
      knowsAbout: projects.map(p => p.name),
    } : {}),
    ...(data.values?.length > 0 ? {
      seeks: data.values,
    } : {}),
    ...(worksFor ? {
      worksFor: {
        "@type": "Organization",
        name: worksFor.name,
        ...(worksFor.url ? { url: worksFor.url } : {}),
        ...(worksFor.description ? { description: worksFor.description } : {}),
      },
    } : {}),
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `https://you.md/${username}`,
    },
  };

  // BreadcrumbList for navigation
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "you.md", item: "https://you.md" },
      { "@type": "ListItem", position: 2, name: "Profiles", item: "https://you.md/profiles" },
      { "@type": "ListItem", position: 3, name, item: `https://you.md/${username}` },
    ],
  };

  return [personSchema, breadcrumbSchema];
}

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const ssrData = await fetchProfileData(username);

  // Build JSON-LD server-side so it's in the initial HTML for crawlers
  const jsonLd = ssrData ? buildJsonLd(username, ssrData) : null;

  return (
    <>
      {/* Alternate format links — help agents discover machine-readable versions */}
      <link
        rel="alternate"
        type="application/json"
        href={`https://you.md/${username}/you.json`}
        title={`${username}'s identity (JSON)`}
      />
      <link
        rel="alternate"
        type="text/plain"
        href={`https://you.md/${username}/you.txt`}
        title={`${username}'s identity (plain text)`}
      />
      {/* JSON-LD structured data — rendered server-side for SEO */}
      {jsonLd && Array.isArray(jsonLd) && jsonLd.map((schema, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}
      {jsonLd && !Array.isArray(jsonLd) && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      {/* rel=me links for IndieWeb verification — associates profile with social accounts */}
      {ssrData?.links && Object.entries(ssrData.links as Record<string, string>).filter(([, url]) => url).map(([platform, url]) => (
        <link key={platform} rel="me" href={url} />
      ))}
      {/* SSR plain-text fallback — always in HTML for agents that parse DOM without JS */}
      {ssrData && <SsrProfileText username={username} data={ssrData} />}
      {/* Client-side interactive profile — ssrData used for instant first paint */}
      <ProfileContent ssrData={ssrData} />
    </>
  );
}
