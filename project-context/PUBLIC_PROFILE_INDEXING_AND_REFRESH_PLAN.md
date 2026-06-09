# Public Profile Indexing + Refresh Plan

Last Updated: 2026-06-09

## Goal

Turn public You.md profiles into the agent-readable people index: stable profile
pages, structured `/you.json` + `/you.txt` endpoints, reliable portraits, fresh
source context, and clear claim paths without making Firecrawl or Apify spend the
default cost center.

## Non-Negotiable Profile Contract

Every public profile render path must have:

- `name` and canonical `username`
- at least one durable source link when available
- `avatarUrl` when a real public photo can be resolved
- valid stored `asciiPortrait` when generation succeeds
- visible terminal fallback when a profile is incomplete, so the UI never shows a
  blank portrait box
- a freshness state that can drive retry/backfill jobs

The current local guard is `npm run profiles:portrait-contract`. It verifies the
directory and individual profile page both use the shared `ProfilePortrait`
renderer, `/profiles` defaults to grid, malformed ASCII portraits are rejected by
Convex normalization, the same-origin profile API exists, and the monthly Convex
portrait QA cron is registered.

## Cheap Crawler Stack

Default stack:

- **Scrapy** for high-throughput HTTP crawling, dedupe, retries, throttling,
  caching, queues, and bulk jobs.
- **Crawl4AI** for LLM-ready markdown/JSON extraction when a page is worth
  semantic processing.
- **Trafilatura** for cheap article/about-page text and metadata extraction.
- **Playwright or Crawlee PlaywrightCrawler** only for pages that need JS
  rendering, login-free dynamic content, or interaction.

Paid / expensive fallback:

- Apify LinkedIn stays Tier-1-only or claim-time-only.
- Firecrawl stays optional, not the default crawler.
- Perplexity/Grok/OpenRouter enrichment runs only after content-hash changes or
  high-value profile priority requires it.

## Pipeline

1. Discover targets from seed lists, public profiles, source catalogs, backlinks,
   GitHub/X/personal-site links, and user submissions.
2. Canonicalize person identity: username, display name, source links, aliases,
   role/company, and disambiguation notes.
3. Resolve avatar candidates from GitHub API, X/Unavatar, site OG image,
   LinkedIn OG image when cheap, and user-provided image.
4. Validate image candidates with content type, size, redirect limits, and
   sensitive-query stripping.
5. Generate/store ASCII portrait server-side when PNG/JPEG works; otherwise keep
   the real avatar URL and queue client/server retry.
6. Extract profile context from source pages with content hashes and source
   provenance.
7. Enrich only changed or high-value records with a cheap LLM extraction model.
8. Compile `youJson`, `youMd`, JSON-LD, OG image inputs, and search metadata.
9. Publish profile only after quality checks pass or mark it as incomplete with a
   visible fallback and retry state.
10. Revisit weekly for Tier 1 / claimed profiles and monthly for broader
   unclaimed profiles.

## Freshness + Cost Controls

- Store per-source `contentHash`, `lastFetchedAt`, `lastChangedAt`, `nextRefreshAt`,
  `fetchCost`, and `qualityScore`.
- Skip LLM enrichment when source content hashes did not change.
- Use priority queues: claimed profiles, Tier 1 public figures, profiles with
  search traffic, profiles with stale portraits, then broad directory refresh.
- Cap monthly crawl/enrichment spend per tier and fail closed into stale-but-valid
  profiles rather than deleting content.
- Keep LinkedIn/JS-browser fetches behind explicit high-value flags.
- Record crawl failures separately from profile validity so broken sources do not
  blank out working public pages.

## Convex / Cron Shape

Current first slice:

- Monthly `refresh unclaimed profile portraits` cron calls
  `internal.seed.enrichAndQaAllProfiles` to resolve avatars and generate missing
  portraits without reprocessing good rows.
- `convex/lib/profileDirectory.ts` rejects malformed stored ASCII portraits so
  the directory does not count an empty object as a real portrait.

Next backend slices:

- Add a `profileSources` table for URL, platform, hash, freshness, cost, and
  extraction status.
- Add a `profileRefreshJobs` table for queued discovery/fetch/extract/enrich
  work with retry/backoff.
- Add a `profileQuality` field or table with missing fields, portrait status,
  source confidence, and SEO readiness.
- Add admin/API endpoints for enqueueing a refresh, inspecting stale profiles,
  and replaying failed portrait generation.

## SEO + Claim Strategy

- Keep SSR profile pages, JSON-LD Person schema, canonical URLs, sitemaps, and
  `you.json` / `you.txt` alternate links.
- Make profile pages answer "who is [person]" cleanly in the first screen.
- Expose provenance and last-updated state so agents trust freshness.
- Add a visible but quiet claim banner for unclaimed profiles.
- Use claim flow to upgrade public crawl data into verified owner-controlled
  You.md brain context, private memory, repo-native files, and YouStacks.
