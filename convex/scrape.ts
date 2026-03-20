"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";

// ============================================================
// Profile Scraper — fetches public profile data from social platforms
// Ported from the Lovable Supabase edge function to Convex action
// ============================================================

interface ProfileResult {
  profileImageUrl: string | null;
  displayName: string | null;
  bio: string | null;
  platform: string;
  location: string | null;
  website: string | null;
  followers: number | null;
  following: number | null;
  posts: number | null;
  joinedDate: string | null;
  headline: string | null;
  company: string | null;
  links: string[];
  extras: Record<string, string | number | boolean | null>;
}

function emptyResult(platform: string): ProfileResult {
  return {
    profileImageUrl: null,
    displayName: null,
    bio: null,
    platform,
    location: null,
    website: null,
    followers: null,
    following: null,
    posts: null,
    joinedDate: null,
    headline: null,
    company: null,
    links: [],
    extras: {},
  };
}

// ============================================================
// X / Twitter
// ============================================================

async function fetchXProfile(username: string): Promise<ProfileResult> {
  const result = emptyResult("x");

  // Strategy: Twitter syndication API — rich HTML with embedded JSON
  try {
    const res = await fetch(
      `https://syndication.twitter.com/srv/timeline-profile/screen-name/${username}`,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
          Accept: "text/html",
        },
        redirect: "follow",
      }
    );
    if (res.ok) {
      const html = await res.text();

      // Profile image
      const imgMatch = html.match(
        /https:\/\/pbs\.twimg\.com\/profile_images\/[^"'\s]+/
      );
      if (imgMatch?.[0]) {
        result.profileImageUrl = imgMatch[0]
          .replace(/_normal\.(jpg|jpeg|png|gif|webp)/i, "_400x400.$1")
          .replace(/_bigger\.(jpg|jpeg|png|gif|webp)/i, "_400x400.$1")
          .replace(/_mini\.(jpg|jpeg|png|gif|webp)/i, "_400x400.$1");
      }

      // Display name
      const nameMatch = html.match(/"name"\s*:\s*"([^"]+)"/);
      if (nameMatch?.[1]) result.displayName = nameMatch[1];

      // Bio / description
      const bioMatch = html.match(/"description"\s*:\s*"([^"]*?)"/);
      if (bioMatch?.[1] && bioMatch[1].length > 0) {
        result.bio = bioMatch[1]
          .replace(/\\n/g, " ")
          .replace(/\\u[\dA-Fa-f]{4}/g, (m) => {
            try {
              return JSON.parse(`"${m}"`);
            } catch {
              return m;
            }
          });
      }

      // Location
      const locMatch = html.match(/"location"\s*:\s*"([^"]+)"/);
      if (locMatch?.[1]) result.location = locMatch[1];

      // Follower / following counts from embedded data
      const followersMatch = html.match(/"followers_count"\s*:\s*(\d+)/);
      if (followersMatch?.[1])
        result.followers = parseInt(followersMatch[1]);

      const followingMatch =
        html.match(/"friends_count"\s*:\s*(\d+)/) ||
        html.match(/"following_count"\s*:\s*(\d+)/);
      if (followingMatch?.[1])
        result.following = parseInt(followingMatch[1]);

      const tweetsMatch = html.match(/"statuses_count"\s*:\s*(\d+)/);
      if (tweetsMatch?.[1]) result.posts = parseInt(tweetsMatch[1]);

      // Website/URL from entities
      const urlMatch = html.match(
        /"expanded_url"\s*:\s*"(https?:\/\/[^"]+)"/
      );
      if (
        urlMatch?.[1] &&
        !urlMatch[1].includes("twitter.com") &&
        !urlMatch[1].includes("x.com")
      ) {
        result.website = urlMatch[1];
        result.links.push(urlMatch[1]);
      }

      // Additional expanded URLs
      const urlRegex = /"expanded_url"\s*:\s*"(https?:\/\/[^"]+)"/g;
      let urlExec: RegExpExecArray | null;
      while ((urlExec = urlRegex.exec(html)) !== null) {
        if (
          urlExec[1] &&
          !urlExec[1].includes("twitter.com") &&
          !urlExec[1].includes("x.com") &&
          !result.links.includes(urlExec[1])
        ) {
          result.links.push(urlExec[1]);
        }
      }

      // Created at / join date
      const createdMatch = html.match(/"created_at"\s*:\s*"([^"]+)"/);
      if (createdMatch?.[1]) result.joinedDate = createdMatch[1];

      // Verified status
      const verifiedMatch = html.match(/"verified"\s*:\s*(true|false)/);
      if (verifiedMatch?.[1]) result.extras.verified = verifiedMatch[1];

      // Banner image
      const bannerMatch = html.match(
        /https:\/\/pbs\.twimg\.com\/profile_banners\/[^"'\s]+/
      );
      if (bannerMatch?.[0]) result.extras.bannerUrl = bannerMatch[0];
    } else {
      await res.text(); // consume body
    }
  } catch (e) {
    console.log("X syndication failed:", e);
  }

  // Fallback image via unavatar
  if (!result.profileImageUrl) {
    result.profileImageUrl = `https://unavatar.io/x/${username}`;
  }

  return result;
}

// ============================================================
// GitHub
// ============================================================

async function fetchGitHubProfile(username: string): Promise<ProfileResult> {
  const result = emptyResult("github");

  try {
    const res = await fetch(`https://api.github.com/users/${username}`, {
      headers: {
        "User-Agent": "you-md-agent/1.0",
        Accept: "application/vnd.github.v3+json",
      },
    });
    if (res.ok) {
      const data = await res.json();
      result.profileImageUrl = data.avatar_url;
      result.displayName = data.name || null;
      result.bio = data.bio || null;
      result.location = data.location || null;
      result.website = data.blog || null;
      result.followers = data.followers ?? null;
      result.following = data.following ?? null;
      result.posts = data.public_repos ?? null;
      result.company = data.company || null;
      result.joinedDate = data.created_at || null;
      result.extras.publicRepos = data.public_repos ?? null;
      result.extras.publicGists = data.public_gists ?? null;
      result.extras.hireable = data.hireable;
      result.extras.twitterUsername = data.twitter_username || null;

      if (data.blog)
        result.links.push(
          data.blog.startsWith("http") ? data.blog : `https://${data.blog}`
        );
      if (data.twitter_username)
        result.links.push(`https://x.com/${data.twitter_username}`);
      if (data.html_url) result.links.push(data.html_url);
    } else {
      await res.text(); // consume body
    }
  } catch (e) {
    console.log("GitHub API failed:", e);
  }

  // Fetch top repos for extra context
  if (result.profileImageUrl) {
    try {
      const reposRes = await fetch(
        `https://api.github.com/users/${username}/repos?sort=stars&per_page=5`,
        {
          headers: {
            "User-Agent": "you-md-agent/1.0",
            Accept: "application/vnd.github.v3+json",
          },
        }
      );
      if (reposRes.ok) {
        const repos = await reposRes.json();
        const topRepos = repos
          .filter((r: any) => !r.fork)
          .slice(0, 5)
          .map((r: any) => ({
            name: r.name,
            description: r.description,
            stars: r.stargazers_count,
            language: r.language,
          }));
        if (topRepos.length > 0) {
          result.extras.topRepos = JSON.stringify(topRepos);
          const langSet: Record<string, boolean> = {};
          topRepos.forEach((r: any) => {
            if (r.language) langSet[r.language] = true;
          });
          const langs = Object.keys(langSet);
          if (langs.length > 0)
            result.extras.languages = langs.join(", ");
        }
      }
    } catch (e) {
      console.log("GitHub repos fetch failed:", e);
    }
  }

  // Fallback image
  if (!result.profileImageUrl) {
    result.profileImageUrl = `https://github.com/${username}.png?size=400`;
  }

  return result;
}

// ============================================================
// LinkedIn
// ============================================================

async function fetchLinkedInProfile(slug: string): Promise<ProfileResult> {
  const result = emptyResult("linkedin");

  try {
    const res = await fetch(`https://www.linkedin.com/in/${slug}/`, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      redirect: "follow",
    });

    if (res.ok) {
      const html = await res.text();

      // og:image for profile photo
      const ogMatch =
        html.match(
          /<meta\s+(?:property|name)="og:image"\s+content="([^"]+)"/i
        ) ||
        html.match(
          /content="([^"]+)"\s+(?:property|name)="og:image"/i
        );
      if (
        ogMatch?.[1] &&
        !ogMatch[1].includes("static.licdn.com/sc/h/") &&
        !ogMatch[1].includes("default")
      ) {
        result.profileImageUrl = ogMatch[1];
      }

      // og:title — "First Last - Title - Company | LinkedIn"
      const titleMatch =
        html.match(
          /<meta\s+(?:property|name)="og:title"\s+content="([^"]+)"/i
        ) ||
        html.match(
          /content="([^"]+)"\s+(?:property|name)="og:title"/i
        );
      if (titleMatch?.[1]) {
        const parts = titleMatch[1].split(/\s*[-\u2013|]\s*/);
        result.displayName = parts[0]?.trim() || null;
        if (parts.length > 1 && !parts[parts.length - 1].includes("LinkedIn")) {
          result.headline =
            parts
              .slice(1)
              .filter((p) => !p.includes("LinkedIn"))
              .join(" \u2014 ")
              .trim() || null;
        }
      }

      // og:description — headline/bio
      const descMatch =
        html.match(
          /<meta\s+(?:property|name)="og:description"\s+content="([^"]+)"/i
        ) ||
        html.match(
          /content="([^"]+)"\s+(?:property|name)="og:description"/i
        );
      if (descMatch?.[1]) {
        result.bio = descMatch[1];
      }

      // Location from page content
      const locationMatch = html.match(
        /<span[^>]*class="[^"]*top-card-layout__headline[^"]*"[^>]*>([^<]+)</i
      );
      if (locationMatch?.[1]) {
        result.headline = result.headline || locationMatch[1].trim();
      }

      const locMatch =
        html.match(
          /<span[^>]*class="[^"]*top-card--bullet[^"]*"[^>]*>([^<]+)</i
        ) ||
        html.match(
          /<span[^>]*class="[^"]*top-card-layout__first-subline[^"]*"[^>]*>([^<]+)</i
        );
      if (locMatch?.[1]) {
        result.location = locMatch[1].trim();
      }

      // Connections / followers from structured data
      const connectionsMatch = html.match(/(\d+)\+?\s*connections/i);
      if (connectionsMatch?.[1])
        result.followers = parseInt(connectionsMatch[1]);

      const followersLiMatch = html.match(/(\d+)\+?\s*followers/i);
      if (followersLiMatch?.[1])
        result.followers = parseInt(followersLiMatch[1]);
    } else {
      await res.text(); // consume body
      console.log(`LinkedIn returned ${res.status}`);
    }
  } catch (e) {
    console.log("LinkedIn fetch failed:", e);
  }

  // Fallback image
  if (!result.profileImageUrl) {
    result.profileImageUrl = `https://unavatar.io/linkedin/${slug}`;
  }

  return result;
}

// ============================================================
// Platform detection
// ============================================================

function detectPlatform(
  url: string
): { platform: string; identifier: string } | null {
  const lower = url.toLowerCase().trim();

  const xMatch = lower.match(/(?:x\.com|twitter\.com)\/([a-zA-Z0-9_]+)/i);
  if (xMatch) return { platform: "x", identifier: xMatch[1] };

  const ghMatch = lower.match(/github\.com\/([a-zA-Z0-9_-]+)/i);
  if (
    ghMatch &&
    !["orgs", "topics", "settings", "marketplace", "explore"].includes(
      ghMatch[1]
    )
  )
    return { platform: "github", identifier: ghMatch[1] };

  const liMatch = lower.match(/linkedin\.com\/in\/([a-zA-Z0-9_-]+)/i);
  if (liMatch) return { platform: "linkedin", identifier: liMatch[1] };

  return null;
}

// ============================================================
// Convex action — public, stateless profile scraper
// ============================================================

export const scrapeProfile = action({
  args: {
    url: v.optional(v.string()),
    username: v.optional(v.string()),
    platform: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    let detected: { platform: string; identifier: string } | null = null;

    if (args.url) {
      detected = detectPlatform(args.url);
    } else if (args.username && args.platform) {
      detected = {
        platform: args.platform,
        identifier: args.username.replace(/^@/, "").trim(),
      };
    } else if (args.username) {
      detected = {
        platform: "x",
        identifier: args.username.replace(/^@/, "").trim(),
      };
    }

    if (!detected) {
      return {
        success: false as const,
        error:
          "Could not detect platform from URL. Supported: x.com, github.com, linkedin.com/in/",
      };
    }

    console.log(
      `Scraping ${detected.platform} profile for: ${detected.identifier}`
    );

    let result: ProfileResult;
    switch (detected.platform) {
      case "x":
        result = await fetchXProfile(detected.identifier);
        break;
      case "github":
        result = await fetchGitHubProfile(detected.identifier);
        break;
      case "linkedin":
        result = await fetchLinkedInProfile(detected.identifier);
        break;
      default:
        return {
          success: false as const,
          error: `Unsupported platform: ${detected.platform}`,
        };
    }

    console.log(
      `Result -- platform: ${result.platform}, image: ${result.profileImageUrl ? "found" : "none"}, name: ${result.displayName || "unknown"}, bio: ${result.bio ? "yes" : "no"}, location: ${result.location || "none"}, followers: ${result.followers ?? "none"}`
    );

    return {
      success: true as const,
      data: {
        username: detected.identifier,
        ...result,
      },
    };
  },
});

// ============================================================
// scrapeLinkedInFull — Quick LinkedIn profile via Apify (for onboarding)
// ============================================================

export const scrapeLinkedInFull = action({
  args: {
    linkedinUrl: v.string(),
  },
  handler: async (_ctx, args) => {
    const apiKey = process.env.APIFY_API_KEY;
    if (!apiKey) {
      return {
        success: false as const,
        error: "APIFY_API_KEY not configured",
      };
    }

    // Validate URL
    if (!args.linkedinUrl.includes("linkedin.com/in/")) {
      return {
        success: false as const,
        error: "Invalid LinkedIn URL. Expected format: https://linkedin.com/in/username",
      };
    }

    const profileActorId = "VhxlqQXRwhW8H5hNV"; // apimaestro/linkedin-profile-detail

    try {
      const res = await fetch(
        `https://api.apify.com/v2/acts/${profileActorId}/run-sync-get-dataset-items?token=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            profileUrls: [args.linkedinUrl],
          }),
          signal: AbortSignal.timeout(120_000),
        }
      );

      if (!res.ok) {
        const errorBody = await res.text();
        return {
          success: false as const,
          error: `Apify error ${res.status}: ${errorBody.slice(0, 300)}`,
        };
      }

      const results = await res.json();
      const raw = Array.isArray(results) ? results[0] : results;

      if (!raw) {
        return {
          success: false as const,
          error: "No profile data returned from Apify",
        };
      }

      // Map to structured profile data
      const profile = {
        name: raw.fullName || raw.firstName && raw.lastName
          ? `${raw.firstName || ""} ${raw.lastName || ""}`.trim()
          : null,
        headline: raw.headline || raw.title || null,
        about: raw.about || raw.summary || null,
        experience: Array.isArray(raw.experience)
          ? raw.experience.map((exp: Record<string, unknown>) => ({
              title: exp.title || null,
              company: exp.companyName || exp.company || null,
              duration: exp.duration || exp.dateRange || null,
              description: exp.description || null,
              isCurrent: exp.isCurrent ?? false,
            }))
          : [],
        education: Array.isArray(raw.education)
          ? raw.education.map((edu: Record<string, unknown>) => ({
              institution: edu.schoolName || edu.school || null,
              degree: edu.degree || edu.degreeName || null,
              fieldOfStudy: edu.fieldOfStudy || null,
              dateRange: edu.dateRange || null,
            }))
          : [],
        skills: Array.isArray(raw.skills)
          ? raw.skills.map((s: unknown) =>
              typeof s === "string" ? s : (s as Record<string, unknown>)?.name || null
            ).filter(Boolean)
          : [],
        profileImageUrl: raw.profilePicture || raw.profileImageUrl || raw.imgUrl || null,
        location: raw.location || raw.geoLocation || null,
        connections: raw.connections || raw.connectionsCount || null,
        followers: raw.followersCount || raw.followers || null,
      };

      return {
        success: true as const,
        data: profile,
      };
    } catch (error) {
      return {
        success: false as const,
        error: error instanceof Error ? error.message : "LinkedIn scrape failed",
      };
    }
  },
});
