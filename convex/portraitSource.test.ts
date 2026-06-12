/**
 * U17 — Portrait source chain tests.
 *
 * Covers the pure resolvers in convex/pipeline/portraitSource.ts:
 *   - handle extraction from linkedin / x / github profile URLs
 *   - og:image URL parsing from sample HTML (both attribute orders,
 *     relative URL resolution)
 *   - source-chain ordering for various profile link shapes
 * Plus convex-test coverage of the write-side guard:
 *   - savePortraitIfMissing never overwrites a renderable portrait
 *   - getPortraitContext reports hasPortrait + link surfaces
 *
 * Known gap (noted in the U17 spec): the Node action
 * portrait.generatePortraitForProfile does real network fetches and image
 * decoding (zlib/jpeg-js), which can't run in the edge-runtime convex-test
 * environment — its fetch/validate/decode loop is exercised only via the
 * pure pieces tested here.
 */
import { describe, expect, it } from "vitest";
import { convexTest } from "convex-test";

import { internal } from "./_generated/api";
import schema from "./schema";
import {
  extractGithubHandle,
  extractLinkedInHandle,
  extractOgImageUrl,
  extractXHandle,
  pickWebsiteLink,
  resolvePortraitSourceChain,
} from "./pipeline/portraitSource";

// ---------------------------------------------------------------------------
// Handle extraction
// ---------------------------------------------------------------------------

describe("extractXHandle", () => {
  it("extracts from x.com and twitter.com profile URLs", () => {
    expect(extractXHandle("https://x.com/houstongolden")).toBe("houstongolden");
    expect(extractXHandle("https://twitter.com/houstongolden/")).toBe("houstongolden");
    expect(extractXHandle("https://www.x.com/houstongolden?ref=site")).toBe("houstongolden");
  });

  it("strips a leading @ and accepts bare handles", () => {
    expect(extractXHandle("https://x.com/@houstongolden")).toBe("houstongolden");
    expect(extractXHandle("@houstongolden")).toBe("houstongolden");
    expect(extractXHandle("houstongolden")).toBe("houstongolden");
  });

  it("rejects reserved paths, invalid handles, and non-x hosts", () => {
    expect(extractXHandle("https://x.com/intent/follow?screen_name=a")).toBeNull();
    expect(extractXHandle("https://x.com/search?q=foo")).toBeNull();
    expect(extractXHandle("https://example.com/houstongolden")).toBeNull();
    expect(extractXHandle("https://x.com/way-too-long-for-twitter-handles")).toBeNull();
    expect(extractXHandle("")).toBeNull();
    expect(extractXHandle(undefined)).toBeNull();
  });
});

describe("extractGithubHandle", () => {
  it("extracts from github.com profile URLs", () => {
    expect(extractGithubHandle("https://github.com/houstongolden")).toBe("houstongolden");
    expect(extractGithubHandle("https://www.github.com/houstongolden/")).toBe("houstongolden");
    expect(extractGithubHandle("github.com/houstongolden")).toBe("houstongolden");
  });

  it("ignores repo path beyond the username", () => {
    expect(extractGithubHandle("https://github.com/houstongolden/youmd")).toBe("houstongolden");
  });

  it("rejects reserved routes and invalid names", () => {
    expect(extractGithubHandle("https://github.com/orgs/anthropics")).toBeNull();
    expect(extractGithubHandle("https://github.com/features/copilot")).toBeNull();
    expect(extractGithubHandle("https://github.com/-bad-name")).toBeNull();
    expect(extractGithubHandle("https://gitlab.com/houstongolden")).toBeNull();
  });
});

describe("extractLinkedInHandle", () => {
  it("extracts from /in/ profile URLs", () => {
    expect(extractLinkedInHandle("https://www.linkedin.com/in/houstongolden")).toBe("houstongolden");
    expect(extractLinkedInHandle("https://linkedin.com/in/houston-golden-123/")).toBe("houston-golden-123");
    expect(extractLinkedInHandle("https://www.linkedin.com/in/houstongolden?utm=x")).toBe("houstongolden");
  });

  it("supports legacy /pub/ URLs", () => {
    expect(extractLinkedInHandle("https://www.linkedin.com/pub/houston-golden")).toBe("houston-golden");
  });

  it("rejects company pages, bare strings, and non-linkedin hosts", () => {
    expect(extractLinkedInHandle("https://www.linkedin.com/company/bamf")).toBeNull();
    expect(extractLinkedInHandle("https://www.linkedin.com/")).toBeNull();
    expect(extractLinkedInHandle("houstongolden")).toBeNull();
    expect(extractLinkedInHandle("https://example.com/in/houstongolden")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// og:image parsing
// ---------------------------------------------------------------------------

describe("extractOgImageUrl", () => {
  it("parses property-before-content order", () => {
    const html = `<html><head>
      <meta property="og:image" content="https://example.com/me.png" />
    </head></html>`;
    expect(extractOgImageUrl(html, "https://example.com")).toBe("https://example.com/me.png");
  });

  it("parses content-before-property order", () => {
    const html = `<meta content="https://example.com/headshot.jpg" property="og:image">`;
    expect(extractOgImageUrl(html, "https://example.com")).toBe("https://example.com/headshot.jpg");
  });

  it("accepts name= instead of property= and og:image:secure_url", () => {
    expect(
      extractOgImageUrl(`<meta name="og:image" content="https://a.com/x.png">`, "https://a.com")
    ).toBe("https://a.com/x.png");
    expect(
      extractOgImageUrl(
        `<meta property="og:image:secure_url" content="https://a.com/secure.png">`,
        "https://a.com"
      )
    ).toBe("https://a.com/secure.png");
  });

  it("resolves relative URLs against the page URL", () => {
    const html = `<meta property="og:image" content="/img/portrait.png">`;
    expect(extractOgImageUrl(html, "https://example.com/about")).toBe(
      "https://example.com/img/portrait.png"
    );
  });

  it("decodes &amp; in attribute values", () => {
    const html = `<meta property="og:image" content="https://cdn.example.com/img.png?w=200&amp;h=200">`;
    expect(extractOgImageUrl(html, "https://example.com")).toBe(
      "https://cdn.example.com/img.png?w=200&h=200"
    );
  });

  it("returns null when no og:image or a non-http scheme is present", () => {
    expect(extractOgImageUrl("<html><head></head></html>", "https://example.com")).toBeNull();
    expect(
      extractOgImageUrl(`<meta property="og:image" content="data:image/png;base64,AAAA">`, "https://example.com")
    ).toBeNull();
    expect(extractOgImageUrl("", "https://example.com")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Website link selection
// ---------------------------------------------------------------------------

describe("pickWebsiteLink", () => {
  it("prefers the canonical website key", () => {
    expect(
      pickWebsiteLink({ github: "https://github.com/h", website: "https://houston.dev" })
    ).toBe("https://houston.dev");
  });

  it("falls back to the first non-social http link", () => {
    expect(
      pickWebsiteLink({
        x: "https://x.com/h",
        blog: "https://blog.houston.dev",
      })
    ).toBe("https://blog.houston.dev");
  });

  it("skips social-host links even under non-social keys", () => {
    expect(pickWebsiteLink({ portfolio: "https://github.com/h" })).toBeNull();
    expect(pickWebsiteLink({})).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Source chain ordering
// ---------------------------------------------------------------------------

describe("resolvePortraitSourceChain", () => {
  it("orders explicit avatar → social images → unavatar x → github → unavatar linkedin → og:image", () => {
    const chain = resolvePortraitSourceChain({
      avatarUrl: "https://cdn.example.com/explicit.png",
      socialImages: { github: "https://avatars.example.com/gh.png" },
      links: {
        x: "https://x.com/houstongolden",
        github: "https://github.com/houstongolden",
        linkedin: "https://www.linkedin.com/in/houstongolden",
        website: "https://houston.dev",
      },
    });

    expect(chain.map((c) => c.source)).toEqual([
      "explicit",
      "social-image",
      "unavatar-x",
      "github",
      "unavatar-linkedin",
      "website-og-image",
    ]);
    expect(chain[0]).toEqual({
      type: "image",
      source: "explicit",
      url: "https://cdn.example.com/explicit.png",
    });
    expect(chain[2].url).toBe("https://unavatar.io/x/houstongolden?fallback=false");
    expect(chain[3].url).toBe("https://github.com/houstongolden.png");
    expect(chain[4].url).toBe("https://unavatar.io/linkedin/houstongolden?fallback=false");
    expect(chain[5]).toEqual({
      type: "og-scrape",
      source: "website-og-image",
      url: "https://houston.dev",
    });
  });

  it("puts the primaryImage social image before other social images", () => {
    const chain = resolvePortraitSourceChain({
      socialImages: {
        x: "https://imgs.example.com/x.png",
        linkedin: "https://imgs.example.com/li.png",
      },
      primaryImage: "linkedin",
    });
    expect(chain.map((c) => c.url)).toEqual([
      "https://imgs.example.com/li.png",
      "https://imgs.example.com/x.png",
    ]);
  });

  it("derives unavatar candidates from youJson links when profile links are empty", () => {
    const chain = resolvePortraitSourceChain({
      youJsonLinks: { linkedin: "https://linkedin.com/in/houston-golden" },
    });
    expect(chain).toEqual([
      {
        type: "image",
        source: "unavatar-linkedin",
        url: "https://unavatar.io/linkedin/houston-golden?fallback=false",
      },
    ]);
  });

  it("normalizes twitter/x link key variants", () => {
    const chain = resolvePortraitSourceChain({
      links: { "X/Twitter": "https://twitter.com/houstongolden" },
    });
    expect(chain[0].url).toBe("https://unavatar.io/x/houstongolden?fallback=false");
  });

  it("dedupes repeated URLs, keeping the highest-priority entry", () => {
    const chain = resolvePortraitSourceChain({
      avatarUrl: "https://github.com/houstongolden.png",
      links: { github: "https://github.com/houstongolden" },
    });
    expect(chain).toEqual([
      { type: "image", source: "explicit", url: "https://github.com/houstongolden.png" },
    ]);
  });

  it("ignores non-http avatar URLs and returns empty chain for empty profiles", () => {
    expect(resolvePortraitSourceChain({})).toEqual([]);
    expect(
      resolvePortraitSourceChain({ avatarUrl: "data:image/png;base64,AAAA" })
    ).toEqual([]);
    expect(resolvePortraitSourceChain({ links: { website: "not a url" } })).toEqual([]);
  });

  it("strips sensitive query params from explicit image URLs", () => {
    const chain = resolvePortraitSourceChain({
      avatarUrl: "https://cdn.example.com/me.png?apiKey=secret&w=100",
    });
    expect(chain[0].url).toBe("https://cdn.example.com/me.png?w=100");
  });
});

// ---------------------------------------------------------------------------
// Write-side guard + context (convex-test)
// ---------------------------------------------------------------------------

const SAMPLE_PORTRAIT = {
  lines: ["@@@@", "@##@"],
  cols: 4,
  rows: 2,
  format: "classic",
  sourceUrl: "https://unavatar.io/x/houstongolden?fallback=false",
};

function seedProfile(
  t: ReturnType<typeof convexTest>,
  overrides: Record<string, unknown> = {}
) {
  return t.run(async (ctx) =>
    ctx.db.insert("profiles", {
      username: "houstongolden",
      name: "Houston Golden",
      isClaimed: false,
      createdAt: Date.now(),
      ...overrides,
    })
  );
}

describe("pipeline.mutations.savePortraitIfMissing", () => {
  it("saves a portrait when the profile has none and backfills avatarUrl", async () => {
    const t = convexTest(schema);
    const profileId = await seedProfile(t);

    const result = await t.mutation(internal.pipeline.mutations.savePortraitIfMissing, {
      profileId,
      portrait: SAMPLE_PORTRAIT,
    });
    expect(result).toEqual({ saved: true, reason: "saved" });

    const profile = await t.run(async (ctx) => ctx.db.get(profileId));
    expect(profile?.asciiPortrait?.lines).toEqual(SAMPLE_PORTRAIT.lines);
    expect(profile?.asciiPortrait?.generatedAt).toBeTypeOf("number");
    expect(profile?.avatarUrl).toBe(SAMPLE_PORTRAIT.sourceUrl);
  });

  it("never overwrites an existing renderable portrait", async () => {
    const t = convexTest(schema);
    const existing = {
      lines: ["####"],
      cols: 4,
      rows: 1,
      format: "block",
      sourceUrl: "https://example.com/original.png",
      generatedAt: 123,
    };
    const profileId = await seedProfile(t, { asciiPortrait: existing });

    const result = await t.mutation(internal.pipeline.mutations.savePortraitIfMissing, {
      profileId,
      portrait: SAMPLE_PORTRAIT,
    });
    expect(result).toEqual({ saved: false, reason: "portrait_exists" });

    const profile = await t.run(async (ctx) => ctx.db.get(profileId));
    expect(profile?.asciiPortrait).toEqual(existing);
  });

  it("treats a blank placeholder portrait as missing", async () => {
    const t = convexTest(schema);
    const profileId = await seedProfile(t, {
      asciiPortrait: {
        lines: ["   ", ""],
        cols: 3,
        rows: 2,
        format: "classic",
        sourceUrl: "",
        generatedAt: 1,
      },
    });

    const result = await t.mutation(internal.pipeline.mutations.savePortraitIfMissing, {
      profileId,
      portrait: SAMPLE_PORTRAIT,
    });
    expect(result).toEqual({ saved: true, reason: "saved" });
  });

  it("overwrites only when force is set", async () => {
    const t = convexTest(schema);
    const profileId = await seedProfile(t, {
      asciiPortrait: {
        lines: ["####"],
        cols: 4,
        rows: 1,
        format: "block",
        sourceUrl: "https://example.com/original.png",
        generatedAt: 123,
      },
    });

    const result = await t.mutation(internal.pipeline.mutations.savePortraitIfMissing, {
      profileId,
      portrait: SAMPLE_PORTRAIT,
      force: true,
    });
    expect(result).toEqual({ saved: true, reason: "saved" });

    const profile = await t.run(async (ctx) => ctx.db.get(profileId));
    expect(profile?.asciiPortrait?.lines).toEqual(SAMPLE_PORTRAIT.lines);
  });
});

describe("pipeline.mutations.getPortraitContext", () => {
  it("returns hasPortrait=false and link surfaces for a portrait-less profile", async () => {
    const t = convexTest(schema);
    await seedProfile(t, {
      links: { github: "https://github.com/houstongolden" },
      youJson: { links: { linkedin: "https://linkedin.com/in/houstongolden" } },
    });

    const context = await t.mutation(internal.pipeline.mutations.getPortraitContext, {
      username: "HoustonGolden", // canonicalized lookup
    });
    expect(context?.hasPortrait).toBe(false);
    expect(context?.links).toEqual({ github: "https://github.com/houstongolden" });
    expect(context?.youJsonLinks).toEqual({
      linkedin: "https://linkedin.com/in/houstongolden",
    });
  });

  it("returns hasPortrait=true for a renderable portrait and null for missing profiles", async () => {
    const t = convexTest(schema);
    await seedProfile(t, {
      asciiPortrait: {
        lines: ["####"],
        cols: 4,
        rows: 1,
        format: "block",
        sourceUrl: "https://example.com/x.png",
        generatedAt: 1,
      },
    });

    const context = await t.mutation(internal.pipeline.mutations.getPortraitContext, {
      username: "houstongolden",
    });
    expect(context?.hasPortrait).toBe(true);

    const missing = await t.mutation(internal.pipeline.mutations.getPortraitContext, {
      username: "nobody-here",
    });
    expect(missing).toBeNull();
  });
});
