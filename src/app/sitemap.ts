import type { MetadataRoute } from "next";
import { CONVEX_SITE_URL } from "@/lib/constants";

const BASE_URL = "https://you.md";

interface ProfileEntry {
  username: string;
  updatedAt: number | null;
}

async function fetchProfiles(): Promise<ProfileEntry[]> {
  try {
    const res = await fetch(`${CONVEX_SITE_URL}/api/v1/profiles`, {
      next: { revalidate: 3600 }, // revalidate every hour
    });
    if (!res.ok) return [];
    const data: ProfileEntry[] = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const profiles = await fetchProfiles();

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${BASE_URL}/profiles`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/create`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/docs`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/sign-in`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/sign-up`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.3,
    },
  ];

  // Dynamic profile pages
  const profilePages: MetadataRoute.Sitemap = profiles.flatMap((profile) => {
    const lastModified = profile.updatedAt
      ? new Date(profile.updatedAt)
      : new Date();

    return [
      {
        url: `${BASE_URL}/${profile.username}`,
        lastModified,
        changeFrequency: "weekly" as const,
        priority: 0.8,
      },
      {
        url: `${BASE_URL}/${profile.username}/you.json`,
        lastModified,
        changeFrequency: "weekly" as const,
        priority: 0.5,
      },
      {
        url: `${BASE_URL}/${profile.username}/you.txt`,
        lastModified,
        changeFrequency: "weekly" as const,
        priority: 0.5,
      },
    ];
  });

  return [...staticPages, ...profilePages];
}
