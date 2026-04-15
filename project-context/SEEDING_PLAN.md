# You.md Seeding Plan — AI Leaders Directory

**Purpose:** Populate the you.md directory with high-signal public figures in AI, tech, and startups to drive AEO/GEO (Answer Engine Optimization / Generative Engine Optimization). When someone asks an AI assistant "who is [person]?", we want you.md to be the canonical identity surface that gets cited.

**Last updated:** 2026-04-15

---

## Why This Matters

1. **AEO/GEO flywheel:** Search engines and LLMs increasingly cite structured identity pages. A well-structured you.md profile (JSON-LD, OG, sitemap, SSR) can become the top result for "[person] AI" queries.
2. **Network effect:** More high-profile profiles → more inbound links → more domain authority → more profiles get cited.
3. **Trust signal:** Public figures in AI validate the platform. If Sam Altman has a you.md, others will want one.

---

## Target Segments (Priority Order)

### Tier 1 — Must Have (100 profiles)
AI founders, CEOs, and researchers with massive X/LinkedIn followings. These drive the most SEO value.

**AI Labs & Models**
- Sam Altman (OpenAI) — @sama
- Dario Anthropic (Anthropic) — @DarioAmodei
- Daniela Amodei (Anthropic) — @danielaamodei
- Demis Hassabis (Google DeepMind) — @demishassabis
- Yann LeCun (Meta AI) — @ylecun
- Ilya Sutskever (SSI) — @ilyasut
- Andrej Karpathy (independent) — @karpathy
- Greg Brockman (OpenAI) — @gdb
- Mustafa Suleyman (Microsoft AI) — @mustafasuleyman
- Yoshua Bengio (Mila) — @yoshuabengio

**AI Tools & Infrastructure**
- Emad Mostaque (Stability AI) — @emostaque
- Alexandr Wang (Scale AI) — @alexandr_wang
- Aidan Gomez (Cohere) — @aidangomez
- Arvind Narayanan (Princeton, AI ethics) — @random_walker
- Percy Liang (Stanford CRFM) — @percyliang
- Harrison Chase (LangChain) — @hwchase17
- Zain Kahn (Superhuman AI newsletter) — @heykahn
- Ben Tossell (Makerpad/Make) — @bentossell
- Pete Hunt (Dagster) — @floydophone
- Clement Delangue (HuggingFace) — @ClementDelangue

**Investors & Analysts**
- Reid Hoffman (LinkedIn/Greylock) — @reidhoffman
- Marc Andreessen (a16z) — @pmarca
- Sarah Guo (Conviction) — @saranormous
- Elad Gil (angel) — @eladgil
- Nat Friedman (NFDG) — @natfriedman
- Daniel Gross (NFDG) — @danielgross

**AI Thought Leaders / Influencers**
- Ethan Mollick (Wharton) — @emollick
- Andrew Ng (AI Fund) — @AndrewYNg
- Lex Fridman — @lexfridman
- Gary Marcus — @GaryMarcus
- Allie K. Miller — @alliekmiller
- Linus Ekenstam — @LinusEkenstam
- Santiago (ML papers) — @svpino
- Sinan Ozdemir — @SinanOzdmr
- Jeremy Howard (fast.ai) — @jeremyphoward

### Tier 2 — High Value (200 more profiles)
Builders, indie hackers, AI engineers with strong communities.

- Pieter Levels — @levelsio
- Marc Lou — @marc_louvion
- Theo Browne — @t3dotgg
- Tony Dinh — @tdinh_me
- Hiten Shah — @hnshah
- Greg Isenberg — @gregisenberg
- Daniel Vassallo — @dvassallo
- Paul Copplestone (Supabase) — @kiwicopple
- Guillermo Rauch (Vercel) — @rauchg
- Tibo Louis-Lucas — @tibo_maker
- Ben Lang (Notion) — @benln
- Julian Shapiro — @julian
- Dan Shipper (Every) — @danshipper
- Paras Chopra (Wingify) — @paraschopra
- Shreya Shankar (data/ML) — @sh_reya
- Simon Willison — @simonw
- Swyx — @swyx
- Riley Tomasek — @rileytomasek
- Evan Armstrong (Nathan) — @itsEvanArmstrong
- Amanda Askell (Anthropic) — @AmandaAskell

### Tier 3 — Broader Coverage (500+ profiles)
AI researchers, ML engineers, startup founders with GitHub presence.

---

## Data Sources Per Platform

| Platform | Tool | Notes |
|---|---|---|
| X/Twitter | Grok-3-mini analysis | Training data only, no live scrape. Gets bio, pinned tweet, topics. Use unavatar.io for avatar. |
| GitHub | Public REST API | Profile, repos, README, languages. 60 req/hr unauthenticated. |
| LinkedIn | Apify actor `VhxlqQXRwhW8H5hNV` | Profile scrape. Expensive — use only for Tier 1. |
| Personal website | `fetch_website` via Convex | Scrape bio, projects, speaking, publications. |
| Perplexity Sonar | OpenRouter | Identity verification + bio enrichment. Use for every profile. |

---

## Pipeline Per Profile

Each profile goes through these stages in order:

### Stage 0 — Target Selection
```
Input: username (X handle or GitHub username)
- Verify person exists and is public figure in AI/tech
- Check if profile already exists in you.md db → skip if so
- Add to seeding queue
```

### Stage 1 — Identity Discovery (Perplexity)
```
Query: "Who is [name]? What is their role, company, background in AI/tech?"
Extract:
  - Full name
  - Current role + company
  - Bio (short + long)
  - Location
  - Known for (topics, projects, papers)
  - Social links (X, GitHub, LinkedIn, personal site)
```

### Stage 2 — X/Twitter Enrichment (Grok-3-mini)
```
Query: "What does @[handle] tweet about? What are their main themes, projects, opinions on AI?"
Extract:
  - Primary topics
  - Signature takes/opinions
  - Community they engage with
  - Notable threads or ideas
Avatar: unavatar.io/twitter/[handle]
```

### Stage 3 — GitHub Enrichment (Public API)
```
GET /users/{username}
GET /users/{username}/repos?sort=stars&per_page=10
Extract:
  - Bio from profile
  - Top repos (name, description, stars, language)
  - Primary languages
  - Company from profile
```

### Stage 4 — Website Scrape (if personal site known)
```
fetch_website → extract:
  - About/bio text
  - Projects / portfolio
  - Publications / papers
  - Speaking / conferences
  - Newsletter info
```

### Stage 5 — LinkedIn (Tier 1 only, Apify)
```
actor: VhxlqQXRwhW8H5hNV
Extract:
  - Work history
  - Education
  - Skills
  - Endorsements
```

### Stage 6 — Profile Compilation
```
Merge all sources into you.json structure:
  identity:
    name, tagline, bio.short, bio.medium, bio.long
    location, timezone
    role, company
  links: { x, github, linkedin, website }
  projects: [ from GitHub + website ]
  now: { focus: [...] }
  beliefs: [ key opinions from X enrichment ]
  tags: [ AI, ML, founder, researcher, etc ]
```

### Stage 7 — ASCII Portrait Generation
```
1. Fetch avatar image (unavatar.io or direct URL)
2. Save to Convex storage
3. Generate ASCII portrait server-side (convex/portrait.ts)
4. Store portrait text in profile
```

### Stage 8 — Quality Review
```
Check:
  - name populated
  - bio.short >= 50 chars
  - at least 1 link present
  - portrait generated (for Tier 1)
  - no obviously wrong data (e.g. wrong person)
Flag for manual review if quality score < 70%
```

### Stage 9 — Publish
```
- Set isClaimed: false (unclaimed public profile)
- Set isPublished: true
- Sitemap auto-updates
- JSON-LD + OG tags auto-serve via SSR
```

---

## Quality Standards

| Field | Tier 1 | Tier 2 | Tier 3 |
|---|---|---|---|
| Full name | Required | Required | Required |
| Bio (short) | Required | Required | Preferred |
| Bio (medium) | Required | Preferred | Optional |
| Tagline | Required | Required | Preferred |
| Location | Required | Preferred | Optional |
| Avatar URL | Required | Required | Preferred |
| ASCII portrait | Required | Preferred | Optional |
| GitHub link | Preferred | Preferred | Optional |
| X handle | Required | Required | Preferred |
| Projects | ≥2 | ≥1 | Optional |
| Beliefs/opinions | ≥3 | Optional | No |
| LinkedIn | ≥1 job | Optional | No |

---

## Deduplication Rules

Before creating any profile:
1. Check `profiles` table by username (`by_username` index)
2. Check `users` table by username
3. Check `profiles` table by normalized display name (fuzzy match)
4. If duplicate found: merge data if new source has richer info, otherwise skip

For existing duplicates in the DB:
- Keep the record with more complete `youJson`
- Transfer any portrait/avatar to the surviving record
- Delete the lesser record

---

## Batch Sizes & Pacing

| Batch | Size | Notes |
|---|---|---|
| Test run | 5-10 | Manual review of output quality |
| Alpha batch | 25-50 | Tier 1 only, spot-check 20% |
| Scale batch | 100+ | After pipeline validated |

**Rate limits to respect:**
- GitHub API: 60 req/hr unauthenticated → max 60 profiles/hr (1 req each for profile + repos)
- Perplexity: depends on plan tier
- Apify: per-actor pricing, budget accordingly
- OpenRouter/Grok: token budget — Grok-3-mini is cheap

---

## SEO/AEO Optimization Per Profile

Each generated profile automatically gets:

1. **JSON-LD structured data** (`Person` schema):
   - `@type: Person`
   - `name`, `jobTitle`, `description`
   - `sameAs` links (X, GitHub, LinkedIn)
   - `image` (portrait URL)

2. **Open Graph meta** — name, bio, portrait for social sharing

3. **Canonical URL** — `https://you.md/[username]`

4. **Sitemap entry** — auto-included via sitemap generation

5. **SSR** — full server-side render for crawler indexability

To maximize AEO specifically:
- Lead profile bio with identity statement ("X is a Y who Z")
- Include entity disambiguation (company, role, years active)
- Link canonical you.md URL from their X bio when possible (ask claimed users)
- Target long-tail "who is [name]" and "[name] AI" query patterns

---

## Tracking

Use `project-context/SEEDING_LOG.md` (create when seeding starts) to track:
- Date seeded
- Username
- Tier
- Sources used
- Quality score
- Any issues

---

## Next Actions

1. [ ] Run 5-profile test batch manually (pick 5 Tier 1 names)
2. [ ] Verify pipeline end-to-end: portrait generated, JSON-LD correct, sitemap updated
3. [ ] Fix any duplicate profiles currently in DB (run cleanup query)
4. [ ] Build simple seeding script in `cli/src/commands/seed.ts` or as admin Convex action
5. [ ] After test batch validated, run 25-profile alpha batch
6. [ ] Monitor: check Google Search Console for indexing within 2 weeks
