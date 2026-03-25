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
      card: "summary_large_image",
      title,
      description,
    },
    alternates: {
      canonical: `https://you.md/${username}`,
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

  return (
    <div
      id="you-md-profile-data"
      data-username={username}
      data-format="you-md/v1"
      style={{ position: "absolute", left: "-9999px", width: "1px", height: "1px", overflow: "hidden" }}
      aria-hidden="true"
    >
      <h1>{name}</h1>
      {tagline && <p>{tagline}</p>}
      {location && <p>Location: {location}</p>}
      {bio && <p>{bio}</p>}
      {now.length > 0 && (
        <section>
          <h2>Current Focus</h2>
          <ul>{now.map((item: string, i: number) => <li key={i}>{item}</li>)}</ul>
        </section>
      )}
      {projects.length > 0 && (
        <section>
          <h2>Projects</h2>
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
          <h2>Values</h2>
          <ul>{values.map((v: string, i: number) => <li key={i}>{v}</li>)}</ul>
        </section>
      )}
      {Object.keys(links).filter(k => links[k]).length > 0 && (
        <section>
          <h2>Links</h2>
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
          <h2>Agent Preferences</h2>
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

  return {
    "@context": "https://schema.org",
    "@type": "Person",
    name,
    url: `https://you.md/${username}`,
    ...(tagline ? { jobTitle: tagline } : {}),
    ...(location ? { address: { "@type": "PostalAddress", addressLocality: location } } : {}),
    ...(bio ? { description: bio } : {}),
    ...(sameAsLinks.length > 0 ? { sameAs: sameAsLinks } : {}),
  };
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
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      {/* SSR plain-text fallback — always in HTML for agents that parse DOM without JS */}
      {ssrData && <SsrProfileText username={username} data={ssrData} />}
      {/* Client-side interactive profile — ssrData used for instant first paint */}
      <ProfileContent ssrData={ssrData} />
    </>
  );
}
