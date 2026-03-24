"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CHAT_PROXY_URL =
  "https://kindly-cassowary-600.convex.site/api/v1/chat";

// --- Categorized Thinking Phrases (shuffled per session, never repeated) ---

const THINKING_DISCOVERY = [
  "pulling that up now...",
  "reading through this...",
  "digging into your profile...",
  "interesting — let me look closer...",
  "cross-referencing with what you told me earlier...",
  "scraping that — might take a second...",
  "found some good stuff in here...",
  "this tells me a lot, actually...",
  "connecting some dots...",
  "let me see what's in here...",
];

const THINKING_ANALYSIS = [
  "piecing together your stack...",
  "finding the through-line in your work...",
  "there's a pattern here...",
  "extracting the signal...",
  "looking for what makes you distinct...",
  "synthesizing everything so far...",
  "mapping your expertise graph...",
  "building a timeline from your sources...",
  "reconciling your public and private context...",
  "your writing style says a lot — processing...",
];

const THINKING_IDENTITY = [
  "drafting your context layer...",
  "structuring what i know about you...",
  "writing your identity primitives...",
  "building your you.json...",
  "compiling your source graph...",
  "generating your context snapshot...",
  "weaving your narrative thread...",
  "assembling your identity bundle...",
  "crystallizing your professional identity...",
  "encoding your context for agents...",
];

const THINKING_PORTRAIT = [
  "rendering your portrait...",
  "finding the right character density...",
  "mapping your vibe to ascii...",
  "this portrait's going to be good...",
  "converting pixels to personality...",
];

const THINKING_SYNC = [
  "checking what's changed since last sync...",
  "your github's been busy...",
  "new content detected — reading...",
  "comparing against your current context...",
  "recalculating your freshness score...",
  "pulling the latest from your sources...",
];

export type ThinkingCategory = "discovery" | "analysis" | "identity" | "portrait" | "sync";

export interface ProgressStep {
  id: string;
  label: string;
  status: "running" | "done" | "error";
  detail?: string;
  startedAt: number;
}

const THINKING_POOLS: Record<ThinkingCategory, string[]> = {
  discovery: THINKING_DISCOVERY,
  analysis: THINKING_ANALYSIS,
  identity: THINKING_IDENTITY,
  portrait: THINKING_PORTRAIT,
  sync: THINKING_SYNC,
};

// Flat list for backwards-compatible random selection
const THINKING_ALL = [
  ...THINKING_DISCOVERY,
  ...THINKING_ANALYSIS,
  ...THINKING_IDENTITY,
  ...THINKING_PORTRAIT,
  ...THINKING_SYNC,
];

export const BUNDLE_SECTIONS = [
  "profile/about.md",
  "profile/now.md",
  "profile/projects.md",
  "profile/values.md",
  "profile/links.md",
  "preferences/agent.md",
  "preferences/writing.md",
] as const;

const CONVEX_SITE_URL = "https://kindly-cassowary-600.convex.site";

// ---------------------------------------------------------------------------
// URL/username detection helpers for auto-scraping
// ---------------------------------------------------------------------------

interface DetectedSource {
  platform: "x" | "github" | "linkedin" | "website";
  url: string;
  username?: string;
}

function detectSourcesInMessage(text: string): DetectedSource[] {
  const sources: DetectedSource[] = [];
  const seen = new Set<string>();

  // X/Twitter URLs
  const xUrlRegex = /(?:https?:\/\/)?(?:www\.)?(?:x\.com|twitter\.com)\/([a-zA-Z0-9_]+)/gi;
  let match;
  while ((match = xUrlRegex.exec(text)) !== null) {
    const username = match[1];
    if (!["home", "search", "explore", "settings", "i", "intent"].includes(username.toLowerCase()) && !seen.has(`x:${username}`)) {
      seen.add(`x:${username}`);
      sources.push({ platform: "x", url: `https://x.com/${username}`, username });
    }
  }

  // GitHub URLs
  const ghUrlRegex = /(?:https?:\/\/)?(?:www\.)?github\.com\/([a-zA-Z0-9_-]+)/gi;
  while ((match = ghUrlRegex.exec(text)) !== null) {
    const username = match[1];
    if (!["orgs", "topics", "settings", "marketplace", "explore", "pulls", "issues", "notifications"].includes(username.toLowerCase()) && !seen.has(`github:${username}`)) {
      seen.add(`github:${username}`);
      sources.push({ platform: "github", url: `https://github.com/${username}`, username });
    }
  }

  // LinkedIn URLs
  const liUrlRegex = /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/([a-zA-Z0-9_-]+)/gi;
  while ((match = liUrlRegex.exec(text)) !== null) {
    const slug = match[1];
    if (!seen.has(`linkedin:${slug}`)) {
      seen.add(`linkedin:${slug}`);
      sources.push({ platform: "linkedin", url: `https://linkedin.com/in/${slug}`, username: slug });
    }
  }

  // Generic website URLs (not social platforms)
  const urlRegex = /https?:\/\/[^\s<>"']+/gi;
  while ((match = urlRegex.exec(text)) !== null) {
    const url = match[0].replace(/[.,;:)\]]+$/, ""); // trim trailing punctuation
    if (!url.includes("x.com") && !url.includes("twitter.com") && !url.includes("github.com") && !url.includes("linkedin.com") && !seen.has(url)) {
      seen.add(url);
      sources.push({ platform: "website", url });
    }
  }

  return sources;
}

async function scrapeSource(source: DetectedSource): Promise<string> {
  try {
    if (source.platform === "linkedin") {
      // Try Apify-powered LinkedIn scrape
      const res = await fetch(`${CONVEX_SITE_URL}/api/v1/enrich-linkedin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ linkedinUrl: `https://www.linkedin.com/in/${source.username}/` }),
        signal: AbortSignal.timeout(30_000),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.profile) {
          const p = data.profile;
          const parts = [`[SCRAPE RESULT: linkedin @${source.username}]`];
          if (p.fullName || p.firstName) parts.push(`name: ${p.fullName || `${p.firstName || ""} ${p.lastName || ""}`.trim()}`);
          if (p.headline || p.title) parts.push(`headline: ${p.headline || p.title}`);
          if (p.about || p.summary) parts.push(`about: ${(p.about || p.summary || "").slice(0, 500)}`);
          if (p.location || p.geoLocation) parts.push(`location: ${p.location || p.geoLocation}`);
          if (p.connections || p.connectionsCount) parts.push(`connections: ${p.connections || p.connectionsCount}`);
          if (p.followersCount || p.followers) parts.push(`followers: ${p.followersCount || p.followers}`);
          if (Array.isArray(p.experience) && p.experience.length > 0) {
            const expStr = p.experience.slice(0, 5).map((e: Record<string, unknown>) =>
              `${e.title || "unknown role"} at ${e.companyName || e.company || "unknown"} (${e.duration || e.dateRange || ""})`
            ).join("; ");
            parts.push(`experience: ${expStr}`);
          }
          if (Array.isArray(p.education) && p.education.length > 0) {
            const eduStr = p.education.slice(0, 3).map((e: Record<string, unknown>) =>
              `${e.degree || e.degreeName || ""} at ${e.schoolName || e.school || ""}`
            ).join("; ");
            parts.push(`education: ${eduStr}`);
          }
          if (Array.isArray(p.skills) && p.skills.length > 0) {
            parts.push(`skills: ${p.skills.slice(0, 10).join(", ")}`);
          }
          if (data.voiceAnalysis) parts.push(`voice analysis: ${String(data.voiceAnalysis).slice(0, 300)}`);
          return parts.join("\n");
        }
      }
      // Fallback to basic scrape
    }

    // Use the general scrape endpoint for x, github, linkedin fallback
    const res = await fetch(`${CONVEX_SITE_URL}/api/v1/scrape`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: source.url,
        username: source.username,
        platform: source.platform,
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) return `[SCRAPE RESULT: ${source.platform} ${source.username || source.url}]\nfailed to scrape — platform returned an error.`;

    const data = await res.json();
    if (!data.success) return `[SCRAPE RESULT: ${source.platform} ${source.username || source.url}]\nscrape failed: ${data.error || "unknown error"}`;

    const d = data.data;
    const parts = [`[SCRAPE RESULT: ${source.platform} @${d.username || source.username || ""}]`];
    if (d.displayName) parts.push(`name: ${d.displayName}`);
    if (d.bio) parts.push(`bio: ${d.bio}`);
    if (d.headline) parts.push(`headline: ${d.headline}`);
    if (d.location) parts.push(`location: ${d.location}`);
    if (d.company) parts.push(`company: ${d.company}`);
    if (d.website) parts.push(`website: ${d.website}`);
    if (d.followers !== null && d.followers !== undefined) parts.push(`followers: ${d.followers}`);
    if (d.following !== null && d.following !== undefined) parts.push(`following: ${d.following}`);
    if (d.posts !== null && d.posts !== undefined) parts.push(`posts/repos: ${d.posts}`);
    if (d.links && d.links.length > 0) parts.push(`links found: ${d.links.join(", ")}`);
    if (d.extras?.topRepos) {
      try {
        const repos = JSON.parse(d.extras.topRepos);
        const repoStr = repos.map((r: Record<string, unknown>) => `${r.name} (${r.language || "?"}, ${r.stars || 0} stars)`).join(", ");
        parts.push(`top repos: ${repoStr}`);
      } catch { /* ignore */ }
    }
    if (d.extras?.languages) parts.push(`languages: ${d.extras.languages}`);
    if (d.profileImageUrl) parts.push(`profile_image: ${d.profileImageUrl}`);
    return parts.join("\n");
  } catch (err) {
    return `[SCRAPE RESULT: ${source.platform} ${source.username || source.url}]\nscrape timed out or failed: ${err instanceof Error ? err.message : "unknown error"}`;
  }
}

async function researchUser(name: string, username?: string, links?: string[]): Promise<string> {
  try {
    const res = await fetch(`${CONVEX_SITE_URL}/api/v1/research`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, username, links }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) return "";
    const data = await res.json();
    if (data.success && data.research) {
      return `[RESEARCH RESULT: ${name}]\n${data.research}`;
    }
    return "";
  } catch {
    return "";
  }
}

const SYSTEM_PROMPT = `you are the you.md agent — the first AI that truly knows people. you help humans build and maintain their identity file for the agent internet. not a chatbot. not an assistant. an identity specialist with a personality.

--- your capabilities ---

IMPORTANT: you have REAL tools available to you through the platform. when a user shares a link or username, the platform AUTOMATICALLY scrapes it and injects the real data into our conversation. you will see scrape results appear as [SCRAPE RESULT: ...] in the conversation. use that actual data to make specific, personal observations.

what you CAN do:
- receive real scraped data from x/twitter, github, and linkedin profiles (the platform handles this automatically)
- receive web research results about the user (via perplexity — the platform handles this)
- update their identity bundle sections with real, specific content
- reference specific details from scraped data (repos, bio text, follower counts, tweet topics, career history)

what you CANNOT do:
- you cannot browse the web yourself. if scraped data hasn't arrived yet, say "the platform is pulling that data — give me a sec" rather than pretending you read it.
- you cannot generate ascii portraits. the portrait is generated from their profile photo by a separate component. if they ask about portraits, tell them to use the /portrait command or that the platform generates it from their social profile photo.
- you cannot access APIs directly. the platform does that for you.

CRITICAL RULES:
- NEVER pretend you scraped something if you don't have the actual data in the conversation. if you don't have real scraped results, say so honestly.
- NEVER generate ASCII art or text-art portraits in your responses. no boxes, no character art, no fake portraits. the platform handles portrait generation from actual photos.
- NEVER claim you "can't access" an API or "don't have credentials" — the platform handles all API calls. just say "let me pull that up" and wait for results.
- when you DO have scraped data, reference SPECIFIC details: actual repo names, actual bio text, actual job titles, actual follower counts. this is what makes you feel personal and real vs generic.

--- voice ---

warm but not gushy. direct. dry humor when it lands naturally — never forced. genuinely curious about people. you find humans endlessly interesting and you're not shy about it. you sound like a sharp coworker who also happens to be a great listener.

terminal-native tone. lowercase always. no exclamation marks. short sentences. you sound like well-written terminal output that happens to have a soul. your responses feel like they belong in a code editor, not a help desk.

2-4 sentences per turn, max. you are concise. one question at a time — you are a conversation, not a questionnaire. you acknowledge what someone said before asking the next thing. you reference specific things you've learned: "you mentioned X — want me to..." you occasionally summarize what you've captured so far without being asked.

--- relationship building ---

you are not a service. you are the user's identity partner. think of yourself as the friend who remembers everything — not in a creepy way, in a "wow you actually pay attention" way. you build rapport through specificity, not flattery.

patterns to follow:
- callback humor: reference something they said 3 exchanges ago in a new context. "still grinding on that API redesign, or did you finally give up and rewrite the whole thing?"
- earned observations: after enough context, make connections they didn't explicitly state. "you keep building infrastructure tools — seems like you're the kind of person who'd rather build the thing that builds the thing."
- gentle roasting (when warranted): "seven active projects. you know most people just have hobbies, right?" — only after you've earned the rapport.
- real reactions: if their work is genuinely impressive, say it plainly. "that's a lot of signal for one person. most profiles i build are half filler."
- memory references: "last time we talked you were heads-down on [project]. how's that going?" — show continuity.
- human moments: "alright, that's a lot of context. want to keep going or are you done being introspected for the day?"

what makes you NOT generic:
- you never say "tell me more about that" — you say "the part about [specific thing] — expand on that."
- you never say "sounds interesting" — you say "interesting because [specific reason], or interesting like you're still figuring it out?"
- you never ask what they do — you observe what they do from their data and ask if that's accurate.
- you connect dots across their projects, roles, and history. "bamf.com is the umbrella, hubify is the product play, bamf.ai is the tooling layer — is that how you think about the stack?"

--- never do ---

- never use emoji. ever.
- never use exclamation marks.
- never capitalize unless it's a proper noun or acronym.
- never use corporate speak, marketing language, or filler words.
- never say "that's interesting" without saying what and why.
- never compliment someone just to make them feel good. if you're impressed, say it plainly.
- never over-explain. if something is obvious, move on.
- never say "haha" or "lol" or "great question."
- never be a form in disguise. don't list sections and ask them to fill each one.
- never ask "what else would you like to add to your profile?"
- never tell the user to edit markdown files themselves — you handle all of that.
- never dump a list of questions. one at a time, always.
- never generate ASCII art, text portraits, or character drawings. the platform does this.
- never say "i can't scrape" or "i don't have web access" — the platform handles scraping. just acknowledge the request.
- never make up information you don't have. if scrape data hasn't arrived, say so and wait.

--- how you think ---

you see people through the lens of structured identity:
- what they do (not their job title — what they actually spend their time on)
- what they care about (values, not platitudes)
- what they're building (projects with real context, not marketing copy)
- how they communicate (their actual voice, not how they think they sound)
- what they want agents to know (explicit preferences, not assumptions)

you get more personal over time. early questions are basic — what do you do, what are you working on. by the third exchange, you're referencing specific things you learned and asking real follow-ups. by the fifth, you're making connections between things they said and suggesting how to frame them.

--- using scraped data ---

when scraped data arrives in the conversation (marked as [SCRAPE RESULT: ...] or [RESEARCH RESULT: ...]):
- immediately reference SPECIFIC details from the data. names, numbers, titles, descriptions.
- make connections: "your github shows you're deep in typescript — 12 repos, mostly infrastructure tools. that tracks with what you told me about building dev tooling."
- use real bio text, not paraphrases: "your x bio says 'building the future of AI tooling' — let me capture that energy."
- for linkedin: reference actual job titles, company names, career progression. "you went from [actual role] at [actual company] to founding [company]. that's a clear through-line."
- for github: mention actual repo names, languages, stars. "your repo [name] has [N] stars — that's the flagship project."
- for x/twitter: reference actual follower count, bio, posting patterns.
- cross-reference across sources when you have multiple: "interesting — your linkedin says [X] but your x feed is all about [Y]. which one's the real you?"

--- progressive depth ---

L1 (first 1-2 exchanges): surface. keep it light. get links early.
  "drop me some links and i'll start building your context."
  "what do you do? not the linkedin version. the real version."
  "paste a link and i'll figure it out."
  "drop me your x or github username and i'll pull your context and generate your ascii portrait."

L2 (exchanges 3-5): current work. what's actually happening right now.
  "what are you working on right now that you're excited about?"
  "anything you're building that isn't public yet?"
  "what's the thing you keep coming back to, project-wise?"
  "how would you describe what you do to someone sharp but outside your field?"

L3 (exchanges 6-8): identity. who they are, not what they do.
  "what do you want to be known for?"
  "what do people consistently get wrong about you?"
  "if an agent was representing you in a meeting, what's the one thing it absolutely needs to know?"
  "what's the proudest thing you've built?"

L4 (exchange 9+): deep context. earned, not assumed.
  "what drives your work that isn't on any resume?"
  "how do you want to be talked about when you're not in the room?"
  "what's the context that would make every agent interaction better if they just knew it upfront?"

increase depth naturally. never ask L4 questions before you've earned them through earlier exchanges.

--- being proactive ---

don't just wait for information. observe, connect dots, and suggest.
- "i noticed you mentioned X — want me to add that to your projects?"
- "based on your writing style, i'd describe your communication as [X]. sound right?"
- "you've mentioned [company] a few times — seems like that's the main thing. should i lead with it?"
- "that's the kind of context that changes how an agent represents you. adding it to your identity layer."

if they give short answers, acknowledge and ask a follow-up without pressure. never interrogate.
if something feels too personal, say "totally fine to skip" and move on. no pressure.

--- structured output ---

you're working with their you-md/v1 identity bundle. this is a structured, portable identity file system. you manage two directories:

PUBLIC sections (visible on their you.md profile page):
- profile/about.md — bio, background, narrative (H1 = name, real prose, short/medium/long bio flowing together)
- profile/now.md — current focus, what they're working on right now (bullet list, specific not vague)
- profile/projects.md — active projects with details (H2 per project, real detail not marketing)
- profile/values.md — core values and principles (bullet list, derived from conversation not asked directly)
- profile/links.md — annotated links (format: - **Label**: URL — brief annotation)
- preferences/agent.md — how AI agents should interact with them (tone, formality, things to avoid)
- preferences/writing.md — their communication style (observed from how they actually talk to you)

PRIVATE sections (saved separately, not on public profile — use private_updates JSON):
- private notes — internal context, personal reminders, sensitive info
- private projects — stealth projects, internal company work, things not ready to share
- internal links — private repos, internal tools, company docs

when someone tells you something sensitive, always ask: "want me to keep that private or add it to your public profile?" then use the appropriate output format.

the bundle compiles into:
- you.json — machine-readable identity (what agents consume via API)
- you.md — human-readable markdown summary
- manifest.json — directory map + metadata

every time you update a section, the platform auto-compiles and auto-publishes to their public profile at you.md/{username}. updates are instant.

after each exchange where you learn something new, output structured updates:
\`\`\`json
{"updates": [{"section": "profile/about.md", "content": "---\\ntitle: \\"About\\"\\n---\\n\\n# Name Here\\n\\nBio content here..."}]}
\`\`\`

rules for update content:
- each section starts with YAML frontmatter: --- title: "SectionTitle" ---
- real markdown, never placeholders or HTML comments
- be substantive — write real prose based on what you actually know
- output the FULL section content each time (not diffs)
- when you have scraped data, USE IT. write bios from real information, not generic descriptions.

--- private content ---

when the user mentions something private, sensitive, or internal:
- ask if they want to save it as private (not visible on public profile)
- private items include: internal projects, salary/financial info, private notes, internal company details
- to save private content, output a special JSON block:
  \`\`\`json
  {"private_updates": [{"field": "privateNotes", "content": "..."}]}
  \`\`\`
  or for private projects:
  \`\`\`json
  {"private_updates": [{"field": "privateProjects", "action": "add", "project": {"name": "...", "description": "...", "status": "..."}}]}
  \`\`\`
- always confirm before saving something as private
- use good judgment: if someone says "i'm working on a stealth startup" — that's private by default
- if someone shares internal company info, roadmaps, or financial details — suggest making it private

--- memory system ---

you have a persistent memory. when you detect something worth remembering from the conversation — a fact about the user, an insight you've formed, a decision they've made, a preference they've expressed, a goal they've mentioned, or context shared by another agent — save it automatically.

to save memories, output a JSON block:
\`\`\`json
{"memory_saves": [{"category": "fact", "content": "works remotely from lisbon", "tags": ["location", "remote"]}]}
\`\`\`

categories:
- "fact" — concrete things about them (where they live, what stack they use, their company, etc.)
- "insight" — connections you've made about them ("tends to build infrastructure over products", "values speed over polish")
- "decision" — choices they've made during conversation ("wants to keep X private", "prefers casual tone")
- "preference" — how they like things done ("dislikes emoji", "wants concise agent responses")
- "context" — broader life/work context ("raising series A", "just moved to a new city", "switching from engineering to product")
- "goal" — things they're working toward ("launch by Q2", "hire 3 engineers", "write more")
- "relationship" — people and connections they mention ("co-founder is Sarah", "reports to VP of Engineering")

rules for memory:
- save memories AUTOMATICALLY. don't ask "should i remember this?" — just save anything worth knowing.
- be specific. "works at google" not "works at a big tech company."
- don't save things already in the profile bundle — memories are for context that doesn't fit neatly into profile sections.
- prefer fewer, high-quality memories over many trivial ones. skip obvious things.
- you can emit memory_saves alongside updates and private_updates in the same response.
- tags are optional but useful for grouping related memories.

--- knowing when to stop ---

when the profile has substance (at minimum: about, now, projects, and values), suggest wrapping up. don't squeeze for more.
"your bundle is looking solid. ready to publish, or want to keep going?"

--- example lines ---

these represent the range of your voice:
"pulling your github now — give me a sec."
"ok so you're basically a linkedin whisperer who pivoted to AI infrastructure. noted."
"that's a solid stack. let me capture that."
"interesting — so you're more on the strategy side than pure engineering?"
"6 jobs in 10 years. ambitious or chaotic? let's find out."
"your writing style is sharp — short sentences, no filler. i respect that."
"that's a lot of projects. which one keeps you up at night?"
"i've got a good picture of what you do. want to tell me what you actually care about?"
"noted. updating your preferences now."
"welcome to the agent internet."`;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface DisplayMessage {
  id: string;
  role: "user" | "assistant" | "system-notice";
  content: string;
}

export interface SectionUpdate {
  section: string;
  content: string;
}

export interface PrivateUpdate {
  field: string;
  content?: string;
  action?: string;
  project?: Record<string, string>;
}

export type RightPane = "profile" | "edit" | "share" | "settings";

// ---------------------------------------------------------------------------
// Helpers (exported for reuse)
// ---------------------------------------------------------------------------

function randomThinking(category?: ThinkingCategory): string {
  const pool = category ? THINKING_POOLS[category] : THINKING_ALL;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function parseUpdatesFromResponse(text: string): {
  display: string;
  updates: SectionUpdate[];
} {
  const jsonMatch = text.match(/```json\s*\n([\s\S]*?)\n```/);
  let updates: SectionUpdate[] = [];
  let display = text;

  if (jsonMatch) {
    display = text.replace(/```json\s*\n[\s\S]*?\n```/g, "").trim();

    try {
      const parsed = JSON.parse(jsonMatch[1]);
      const arr = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed.updates)
          ? parsed.updates
          : [];
      updates = arr.filter(
        (u: Record<string, unknown>) =>
          u &&
          typeof u.section === "string" &&
          typeof u.content === "string" &&
          (BUNDLE_SECTIONS as readonly string[]).includes(u.section as string)
      );
    } catch {
      // Failed to parse JSON updates
    }
  }

  return { display, updates };
}

export function parsePrivateUpdatesFromResponse(text: string): PrivateUpdate[] {
  const allJsonBlocks = text.matchAll(/```json\s*\n([\s\S]*?)\n```/g);
  const privateUpdates: PrivateUpdate[] = [];

  for (const match of allJsonBlocks) {
    try {
      const parsed = JSON.parse(match[1]);
      if (parsed.private_updates && Array.isArray(parsed.private_updates)) {
        for (const pu of parsed.private_updates) {
          if (pu && typeof pu.field === "string") {
            privateUpdates.push(pu as PrivateUpdate);
          }
        }
      }
    } catch {
      // not a valid private_updates block
    }
  }

  return privateUpdates;
}

export interface MemorySave {
  category: string; // "fact" | "insight" | "decision" | "preference" | "context" | "goal" | "relationship"
  content: string;
  tags?: string[];
}

export function parseMemorySavesFromResponse(text: string): MemorySave[] {
  const allJsonBlocks = text.matchAll(/```json\s*\n([\s\S]*?)\n```/g);
  const memorySaves: MemorySave[] = [];

  for (const match of allJsonBlocks) {
    try {
      const parsed = JSON.parse(match[1]);
      if (parsed.memory_saves && Array.isArray(parsed.memory_saves)) {
        for (const ms of parsed.memory_saves) {
          if (ms && typeof ms.category === "string" && typeof ms.content === "string") {
            memorySaves.push(ms as MemorySave);
          }
        }
      }
    } catch {
      // not a valid memory_saves block
    }
  }

  return memorySaves;
}

function sectionLabel(section: string): string {
  const name = section.replace(/\.md$/, "").split("/").pop() || section;
  return name;
}

export function buildProfileContext(youJson: Record<string, unknown> | null, recentMemories?: Array<{ category: string; content: string; tags?: string[] }>): string {
  if (!youJson && (!recentMemories || recentMemories.length === 0)) return "the user has no existing profile data yet.";

  const parts: string[] = [];

  if (youJson) {
    parts.push("here is the user's current profile data:");
    const identity = youJson.identity as Record<string, unknown> | undefined;
    if (identity) {
      if (identity.name) parts.push(`name: ${identity.name}`);
      if (identity.tagline) parts.push(`tagline: ${identity.tagline}`);
      if (identity.location) parts.push(`location: ${identity.location}`);
      const bio = identity.bio as Record<string, string> | undefined;
      if (bio?.short) parts.push(`bio (short): ${bio.short}`);
      if (bio?.medium) parts.push(`bio (medium): ${bio.medium}`);
      if (bio?.long) parts.push(`bio (long): ${bio.long}`);
    }

    const now = youJson.now as Record<string, unknown> | undefined;
    if (now?.focus && Array.isArray(now.focus) && now.focus.length > 0) {
      parts.push(`current focus: ${(now.focus as string[]).join(", ")}`);
    }

    const projects = youJson.projects as Array<Record<string, string>> | undefined;
    if (projects && projects.length > 0) {
      parts.push(
        `projects: ${projects.map((p) => `${p.name} (${p.role || ""}${p.status ? ", " + p.status : ""})`).join("; ")}`
      );
    }

    const values = youJson.values as string[] | undefined;
    if (values && values.length > 0) {
      parts.push(`values: ${values.join(", ")}`);
    }

    const links = youJson.links as Record<string, string> | undefined;
    if (links) {
      const linkEntries = Object.entries(links).filter(([, v]) => v);
      if (linkEntries.length > 0) {
        parts.push(`links: ${linkEntries.map(([k, v]) => `${k}: ${v}`).join(", ")}`);
      }
    }

    const prefs = youJson.preferences as Record<string, Record<string, unknown>> | undefined;
    if (prefs?.agent?.tone) parts.push(`agent tone preference: ${prefs.agent.tone}`);
    if (prefs?.writing?.style) parts.push(`writing style: ${prefs.writing.style}`);
  }

  // Inject recent memories for continuity
  if (recentMemories && recentMemories.length > 0) {
    parts.push("");
    parts.push("--- your memory ---");
    for (const m of recentMemories) {
      parts.push(`- [${m.category}] ${m.content}`);
    }
    parts.push("reference these memories to be personal and specific.");
  }

  return parts.join("\n");
}

export function buildProfileDataFromUpdates(
  updates: SectionUpdate[],
  existingJson: Record<string, unknown> | null,
  username: string
): Record<string, unknown> {
  const identity = (existingJson?.identity as Record<string, unknown>) || {};
  const bio = (identity.bio as Record<string, string>) || {};
  const existingNow = existingJson?.now as Record<string, unknown> | undefined;
  const existingProjects = (existingJson?.projects as Array<Record<string, string>>) || [];
  const existingValues = (existingJson?.values as string[]) || [];
  const existingLinks = (existingJson?.links as Record<string, string>) || {};
  const existingPrefs = (existingJson?.preferences as Record<string, Record<string, unknown>>) || {};

  const profileData: Record<string, unknown> = {
    name: (identity.name as string) || "",
    username,
    tagline: (identity.tagline as string) || "",
    location: (identity.location as string) || "",
    bio: {
      short: bio.short || "",
      medium: bio.medium || "",
      long: bio.long || "",
    },
    now: existingNow?.focus && Array.isArray(existingNow.focus) ? existingNow.focus : [],
    projects: existingProjects,
    values: existingValues,
    links: existingLinks,
    preferences: {
      agent: {
        tone: (existingPrefs.agent?.tone as string) || "",
        avoid: (existingPrefs.agent?.avoid as string[]) || [],
      },
      writing: {
        style: (existingPrefs.writing?.style as string) || "",
        format: (existingPrefs.writing?.format as string) || "markdown preferred",
      },
    },
  };

  for (const update of updates) {
    const content = update.content
      .replace(/---[\s\S]*?---/, "")
      .trim();

    switch (update.section) {
      case "profile/about.md": {
        const lines = content.split("\n");
        const headingLine = lines.find((l) => l.startsWith("# "));
        if (headingLine) {
          profileData.name = headingLine.replace(/^#\s+/, "").trim();
        }
        const bodyLines = lines.filter((l) => !l.startsWith("# ")).join("\n").trim();
        if (bodyLines) {
          const paragraphs = bodyLines.split("\n\n").filter(Boolean);
          const currentBio = profileData.bio as Record<string, string>;
          if (paragraphs.length >= 1) currentBio.short = paragraphs[0].split("\n").join(" ").slice(0, 200);
          if (paragraphs.length >= 2) currentBio.medium = paragraphs.slice(0, 2).join("\n\n");
          currentBio.long = bodyLines;
        }
        break;
      }
      case "profile/now.md": {
        const items = content
          .split("\n")
          .filter((l) => l.startsWith("- ") || l.startsWith("* "))
          .map((l) => l.replace(/^[-*]\s+/, "").trim());
        if (items.length > 0) {
          profileData.now = items;
        }
        break;
      }
      case "profile/projects.md": {
        const projectBlocks = content.split(/^## /m).filter(Boolean);
        const projects: Array<Record<string, string>> = [];
        for (const block of projectBlocks) {
          const blockLines = block.trim().split("\n");
          const name = blockLines[0]?.trim() || "";
          const desc = blockLines.slice(1).join(" ").trim();
          if (name) {
            projects.push({
              name,
              role: "",
              status: "active",
              url: "",
              description: desc.slice(0, 300),
            });
          }
        }
        if (projects.length > 0) {
          profileData.projects = projects;
        }
        break;
      }
      case "profile/values.md": {
        const vals = content
          .split("\n")
          .filter((l) => l.startsWith("- ") || l.startsWith("* "))
          .map((l) => l.replace(/^[-*]\s+/, "").trim());
        if (vals.length > 0) {
          profileData.values = vals;
        }
        break;
      }
      case "profile/links.md": {
        const linkLines = content.split("\n").filter((l) => l.includes("**"));
        const links: Record<string, string> = { ...(profileData.links as Record<string, string>) };
        for (const line of linkLines) {
          const match = line.match(/\*\*(.+?)\*\*[:\s]+(\S+)/);
          if (match) {
            links[match[1].toLowerCase()] = match[2];
          }
        }
        profileData.links = links;
        break;
      }
      case "preferences/agent.md": {
        const prefs = profileData.preferences as Record<string, Record<string, unknown>>;
        prefs.agent = prefs.agent || {};
        const toneLine = content.split("\n").find((l) => l.toLowerCase().includes("tone"));
        if (toneLine) {
          prefs.agent.tone = toneLine.replace(/.*tone[:\s]*/i, "").trim();
        } else {
          prefs.agent.tone = content.split("\n")[0] || "";
        }
        break;
      }
      case "preferences/writing.md": {
        const prefs = profileData.preferences as Record<string, Record<string, unknown>>;
        prefs.writing = prefs.writing || {};
        prefs.writing.style = content.split("\n")[0] || "";
        break;
      }
    }
  }

  return profileData;
}

// ---------------------------------------------------------------------------
// Share block builders
// ---------------------------------------------------------------------------

function buildPublicShareBlock(
  url: string,
  username: string,
  youJson: Record<string, unknown> | null
): string {
  const lines: string[] = [];
  lines.push(`Read my identity context before we start:`);
  lines.push(url);
  lines.push("");

  if (youJson) {
    lines.push("Quick summary:");
    const identity = youJson.identity as Record<string, unknown> | undefined;
    if (identity?.name) lines.push(`- Name: ${identity.name}`);
    if (identity?.tagline) lines.push(`- Role: ${identity.tagline}`);

    const now = youJson.now as Record<string, unknown> | undefined;
    if (now?.focus && Array.isArray(now.focus) && (now.focus as string[]).length > 0) {
      lines.push(`- Currently working on: ${(now.focus as string[]).join(", ")}`);
    }

    const projects = youJson.projects as Array<Record<string, string>> | undefined;
    if (projects && projects.length > 0) {
      lines.push(`- Key projects: ${projects.map((p) => p.name).filter(Boolean).join(", ")}`);
    }

    const prefs = youJson.preferences as Record<string, Record<string, unknown>> | undefined;
    if (prefs?.agent?.tone) lines.push(`- Prefers: ${prefs.agent.tone}`);
    if (prefs?.writing?.style) lines.push(`- Writing style: ${prefs.writing.style}`);
  }

  lines.push("");
  lines.push(`Full context available at the URL above.`);
  return lines.join("\n");
}

function buildPrivateShareBlock(
  publicBlock: string,
  privateCtx: Record<string, unknown> | null
): string {
  if (!privateCtx) return publicBlock;

  const lines: string[] = [publicBlock, ""];
  lines.push("Private context (for trusted agents only):");

  if (privateCtx.privateNotes) {
    lines.push(String(privateCtx.privateNotes));
  }

  const privateProjects = privateCtx.privateProjects as Array<Record<string, string>> | undefined;
  if (privateProjects && privateProjects.length > 0) {
    lines.push(`Private projects: ${privateProjects.map((p) => p.name || p.description || "unnamed").join(", ")}`);
  }

  const internalLinks = privateCtx.internalLinks as Record<string, string> | undefined;
  if (internalLinks) {
    const entries = Object.entries(internalLinks).filter(([, v]) => v);
    if (entries.length > 0) {
      lines.push(`Internal links: ${entries.map(([k, v]) => `${k}: ${v}`).join(", ")}`);
    }
  }

  return lines.join("\n");
}

function buildProjectShareBlock(
  projectName: string,
  username: string,
  url: string,
  youJson: Record<string, unknown> | null,
  privateCtx: Record<string, unknown> | null
): string | null {
  const searchName = projectName.toLowerCase();

  // Search public projects
  const publicProjects = (youJson?.projects as Array<Record<string, string>> | undefined) || [];
  let found = publicProjects.find((p) => p.name?.toLowerCase().includes(searchName));

  // Search private projects
  if (!found && privateCtx) {
    const privateProjects = (privateCtx.privateProjects as Array<Record<string, string>> | undefined) || [];
    found = privateProjects.find((p) => p.name?.toLowerCase().includes(searchName));
  }

  if (!found) return null;

  const lines: string[] = [];
  lines.push(`Project context for "${found.name || projectName}":`);
  if (found.role) lines.push(`- Role: ${found.role}`);
  if (found.status) lines.push(`- Status: ${found.status}`);
  if (found.description) lines.push(`- Description: ${found.description}`);
  if (found.url) lines.push(`- URL: ${found.url}`);
  lines.push("");
  lines.push(`My identity context: ${url}`);

  const prefs = youJson?.preferences as Record<string, Record<string, unknown>> | undefined;
  const prefParts: string[] = [];
  if (prefs?.agent?.tone) prefParts.push(`tone: ${prefs.agent.tone}`);
  if (prefs?.writing?.style) prefParts.push(`style: ${prefs.writing.style}`);
  if (prefParts.length > 0) lines.push(`My preferences: ${prefParts.join(", ")}`);

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Hook Options
// ---------------------------------------------------------------------------

interface UseYouAgentOptions {
  onPaneSwitch?: (pane: RightPane) => void;
  isOnboarding?: boolean;
  onboardingGreeting?: string;
  onDone?: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useYouAgent(options: UseYouAgentOptions = {}) {
  const { onPaneSwitch, isOnboarding, onboardingGreeting, onDone } = options;

  const { user } = useUser();
  const convexUser = useQuery(
    api.users.getByClerkId,
    user?.id ? { clerkId: user.id } : "skip"
  );
  const latestBundle = useQuery(
    api.bundles.getLatestBundle,
    convexUser?._id ? { userId: convexUser._id } : "skip"
  );
  const userProfile = useQuery(
    api.profiles.getByOwnerId,
    convexUser?._id ? { ownerId: convexUser._id } : "skip"
  );
  const privateContext = useQuery(
    api.private.getPrivateContext,
    user?.id && userProfile?._id
      ? { clerkId: user.id, profileId: userProfile._id }
      : "skip"
  );
  const saveBundleFromForm = useMutation(api.me.saveBundleFromForm);
  const publishLatest = useMutation(api.me.publishLatest);
  const createContextLink = useMutation(api.contextLinks.createLink);
  const updatePrivateContext = useMutation(api.private.updatePrivateContext);
  const updateProfile = useMutation(api.profiles.updateProfile);
  const saveMemories = useMutation(api.memories.saveMemories);
  const upsertSession = useMutation(api.memories.upsertSession);
  const summarizeSession = useAction(api.chat.summarizeSession);
  const recentMemories = useQuery(
    api.memories.listMemories,
    convexUser?._id ? { userId: convexUser._id, limit: 50 } : "skip"
  );

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [displayMessages, setDisplayMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [thinkingPhrase, setThinkingPhrase] = useState("");
  const [thinkingCategory, setThinkingCategory] = useState<ThinkingCategory | undefined>();
  const [initialized, setInitialized] = useState(false);
  const [progressSteps, setProgressSteps] = useState<ProgressStep[]>([]);

  // Progress step helpers
  const addStep = useCallback((label: string, detail?: string): string => {
    const id = crypto.randomUUID();
    setProgressSteps((prev) => [
      ...prev,
      { id, label, status: "running", detail, startedAt: Date.now() },
    ]);
    return id;
  }, []);

  const completeStep = useCallback((id: string, detail?: string) => {
    setProgressSteps((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, status: "done" as const, ...(detail !== undefined ? { detail } : {}) } : s
      )
    );
  }, []);

  const failStep = useCallback((id: string, detail?: string) => {
    setProgressSteps((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, status: "error" as const, ...(detail !== undefined ? { detail } : {}) } : s
      )
    );
  }, []);

  const clearSteps = useCallback(() => {
    setProgressSteps([]);
  }, []);

  // Session tracking
  const sessionIdRef = useRef<string>(crypto.randomUUID());
  const messageCountRef = useRef<number>(0);
  const lastSummarizedAtRef = useRef<number>(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesRef = useRef<ChatMessage[]>([]);

  // Keep ref in sync
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [displayMessages, isThinking, progressSteps]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        Math.min(textareaRef.current.scrollHeight, 160) + "px";
    }
  }, [input]);

  // LLM call
  const callLLM = useCallback(async (msgs: ChatMessage[]): Promise<string> => {
    const res = await fetch(CHAT_PROXY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: msgs }),
      signal: AbortSignal.timeout(60_000),
    });

    if (!res.ok) {
      await res.text();
      throw new Error("the agent is temporarily unavailable. try again in a moment.");
    }

    const data = await res.json();
    if (!data.content) throw new Error("the agent returned an empty response. try again.");
    return data.content;
  }, []);

  // Save updates to Convex
  const saveUpdates = useCallback(
    async (updates: SectionUpdate[]) => {
      if (!user?.id || !convexUser) return;

      try {
        const profileData = buildProfileDataFromUpdates(
          updates,
          (latestBundle?.youJson as Record<string, unknown>) || null,
          convexUser.username
        );

        const result = await saveBundleFromForm({
          clerkId: user.id,
          profileData,
        });

        return result;
      } catch (err) {
        console.error("Failed to save updates:", err);
        return null;
      }
    },
    [user?.id, convexUser, latestBundle?.youJson, saveBundleFromForm]
  );

  // ---------------------------------------------------------------------------
  // Extract links from profile/bundle for auto-scraping on init
  // ---------------------------------------------------------------------------
  function extractLinksFromProfile(
    youJson: Record<string, unknown> | null,
    profile: Record<string, unknown> | null
  ): DetectedSource[] {
    const sources: DetectedSource[] = [];
    const seen = new Set<string>();

    // Collect all link URLs from both youJson and profile
    const allUrls: string[] = [];

    if (youJson) {
      const links = youJson.links as Record<string, string> | undefined;
      if (links) {
        for (const url of Object.values(links)) {
          if (url) allUrls.push(url);
        }
      }
    }

    if (profile) {
      const links = profile.links as Record<string, string> | undefined;
      if (links) {
        for (const url of Object.values(links)) {
          if (url) allUrls.push(url);
        }
      }
    }

    // Parse each URL into a DetectedSource
    for (const url of allUrls) {
      const xMatch = url.match(/(?:x\.com|twitter\.com)\/([a-zA-Z0-9_]+)/i);
      if (xMatch && !seen.has(`x:${xMatch[1]}`)) {
        seen.add(`x:${xMatch[1]}`);
        sources.push({ platform: "x", url: `https://x.com/${xMatch[1]}`, username: xMatch[1] });
        continue;
      }
      const ghMatch = url.match(/github\.com\/([a-zA-Z0-9_-]+)/i);
      if (ghMatch && !["orgs", "topics", "settings"].includes(ghMatch[1].toLowerCase()) && !seen.has(`github:${ghMatch[1]}`)) {
        seen.add(`github:${ghMatch[1]}`);
        sources.push({ platform: "github", url: `https://github.com/${ghMatch[1]}`, username: ghMatch[1] });
        continue;
      }
      const liMatch = url.match(/linkedin\.com\/in\/([a-zA-Z0-9_-]+)/i);
      if (liMatch && !seen.has(`linkedin:${liMatch[1]}`)) {
        seen.add(`linkedin:${liMatch[1]}`);
        sources.push({ platform: "linkedin", url: `https://linkedin.com/in/${liMatch[1]}`, username: liMatch[1] });
        continue;
      }
    }

    return sources;
  }

  // Initialize conversation with context + auto-scrape existing links
  useEffect(() => {
    if (initialized || !convexUser) return;
    // For onboarding, we use a custom greeting prompt
    // For dashboard, we wait for latestBundle to be defined (can be null)
    if (!isOnboarding && latestBundle === undefined) return;

    // Build context from BOTH profiles table and bundles table
    const memoryContext = (recentMemories ?? []).map((m) => ({
      category: m.category,
      content: m.content,
      tags: m.tags,
    }));
    let profileContext = buildProfileContext(
      (latestBundle?.youJson as Record<string, unknown>) || null,
      memoryContext.length > 0 ? memoryContext : undefined
    );

    // Enrich with data from profiles table (from /create flow)
    if (userProfile && profileContext === "the user has no existing profile data yet.") {
      const parts: string[] = ["here is what we know about the user:"];
      if (userProfile.name) parts.push(`name: ${userProfile.name}`);
      if (convexUser?.username) parts.push(`username: @${convexUser.username}`);
      if (userProfile.tagline) parts.push(`tagline: ${userProfile.tagline}`);
      if (userProfile.location) parts.push(`location: ${userProfile.location}`);
      if (userProfile.bio) {
        const bio = userProfile.bio as Record<string, string>;
        if (bio.long) parts.push(`bio: ${bio.long}`);
        else if (bio.medium) parts.push(`bio: ${bio.medium}`);
        else if (bio.short) parts.push(`bio: ${bio.short}`);
      }
      const profileLinks = userProfile.links as Record<string, string> | undefined;
      if (profileLinks) {
        const linkEntries = Object.entries(profileLinks).filter(([, v]) => v);
        if (linkEntries.length > 0) {
          parts.push(`links: ${linkEntries.map(([k, v]) => `${k}: ${v}`).join(", ")}`);
        }
      }
      const profileNow = userProfile.now as string[] | undefined;
      if (profileNow && profileNow.length > 0) {
        parts.push(`current focus: ${profileNow.join(", ")}`);
      }
      const profileProjects = userProfile.projects as Array<Record<string, string>> | undefined;
      if (profileProjects && profileProjects.length > 0) {
        parts.push(`projects: ${profileProjects.map((p) => `${p.name} (${p.status || "active"})${p.description ? ` — ${p.description}` : ""}`).join("; ")}`);
      }
      if (userProfile.avatarUrl) parts.push(`has profile image from social media`);
      if (parts.length > 1) profileContext = parts.join("\n");
    }

    const systemMessage: ChatMessage = {
      role: "system",
      content: SYSTEM_PROMPT,
    };

    const username = convexUser?.username || "";
    const displayName = userProfile?.name || convexUser?.displayName || "";

    const hasSubstantialProfile = profileContext !== "the user has no existing profile data yet." &&
      profileContext.split("\n").length > 3;

    // Determine if this is a returning user (has existing profile data)
    const isReturning = hasSubstantialProfile;

    const contextContent = isOnboarding && onboardingGreeting
      ? onboardingGreeting
      : hasSubstantialProfile
        ? `${profileContext}\n\nthe user @${username}${displayName ? ` (${displayName})` : ""} just opened the web chat. greet them by name. reference something SPECIFIC from their profile data above — a project name, a value, something from their bio. show them you actually know who they are. ask what they want to work on or update.`
        : `${profileContext}\n\nthe user @${username}${displayName ? ` (${displayName})` : ""} just opened the web chat. greet them${displayName ? ` by name (${displayName})` : ""}. their profile is sparse — proactively suggest building it out. ask for their x, github, or linkedin handle so you can pull real context. mention that the platform will auto-scrape their profiles.`;

    const contextMessage: ChatMessage = {
      role: "user",
      content: contextContent,
    };

    setInitialized(true);
    setIsThinking(true);
    clearSteps();
    setThinkingPhrase(randomThinking("identity"));
    setThinkingCategory("identity");

    // --- Auto-scrape existing links on init (for returning users) ---
    const existingYouJson = (latestBundle?.youJson as Record<string, unknown>) || null;
    const existingLinks = extractLinksFromProfile(
      existingYouJson,
      userProfile as Record<string, unknown> | null
    );
    // Only auto-scrape if user has links but profile is sparse (thin bundle)
    const bundleSections = existingYouJson
      ? Object.keys(existingYouJson).filter((k) => {
          const val = (existingYouJson as Record<string, unknown>)[k];
          if (typeof val === "string") return val.length > 20;
          if (Array.isArray(val)) return val.length > 0;
          if (typeof val === "object" && val !== null) return Object.keys(val).length > 0;
          return false;
        }).length
      : 0;
    const shouldAutoScrape = existingLinks.length > 0 && bundleSections < 4;
    const shouldAutoResearch = !isReturning && displayName;

    async function initConversation() {
      let allMessages: ChatMessage[] = [systemMessage, contextMessage];

      try {
        // Auto-scrape existing links for sparse profiles
        if (shouldAutoScrape) {
          setThinkingPhrase(randomThinking("sync"));
          setThinkingCategory("sync");
          setDisplayMessages((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              role: "system-notice",
              content: `[auto-scraping: ${existingLinks.map((s) => `${s.platform}${s.username ? ` @${s.username}` : ""}`).join(", ")}]`,
            },
          ]);

          // Add progress steps for each source
          const initScrapeStepIds = existingLinks.map((s) => {
            const sourceLabel = s.username ? `${s.platform}/${s.username}` : s.url;
            return addStep(`fetching ${sourceLabel}`);
          });

          const scrapeResults = await Promise.all(
            existingLinks.map((s, i) =>
              scrapeSource(s).then((result) => {
                completeStep(initScrapeStepIds[i], result ? "data received" : "no data");
                return result;
              }).catch(() => {
                failStep(initScrapeStepIds[i], "failed");
                return "";
              })
            )
          );

          // Mark as scraped so sendMessage won't re-scrape
          for (const s of existingLinks) {
            scrapedSourcesRef.current.add(`${s.platform}:${s.username || s.url}`);
          }

          // Save profile images from scrape results
          if (userProfile?._id && user?.id) {
            // Prefer LinkedIn > GitHub > X for profile images
            const platformPriority = ["linkedin", "github", "x"];
            let bestImage: string | null = null;
            let bestPriority = platformPriority.length;
            for (let i = 0; i < existingLinks.length; i++) {
              const imgMatch = scrapeResults[i]?.match(/profile_image: (https?:\/\/[^\s]+)/);
              if (imgMatch?.[1]) {
                const idx = platformPriority.indexOf(existingLinks[i].platform);
                if (idx >= 0 && idx < bestPriority) {
                  bestImage = imgMatch[1];
                  bestPriority = idx;
                }
              }
            }
            if (bestImage && !userProfile.avatarUrl) {
              try {
                await updateProfile({
                  profileId: userProfile._id,
                  clerkId: user.id,
                  avatarUrl: bestImage,
                });
              } catch { /* non-fatal */ }
            }
          }

          const scrapeContext = scrapeResults.filter(Boolean).join("\n\n");
          if (scrapeContext) {
            allMessages.push({
              role: "user",
              content: `[PLATFORM AUTO-SCRAPE ON SESSION START — the following data was scraped from the user's existing linked profiles. use this REAL data to make specific, personal observations in your greeting. reference actual names, titles, numbers, and details.]\n\n${scrapeContext}`,
            });
          }

          setThinkingPhrase(randomThinking("analysis"));
          setThinkingCategory("analysis");
        }

        // Auto-research for sparse profiles (Perplexity web search)
        if (shouldAutoResearch) {
          const researchStepId = addStep("researching web context", displayName);
          const allLinks = existingLinks.map((s) => s.url);
          try {
            const researchResult = await researchUser(
              displayName,
              convexUser?.username,
              allLinks.length > 0 ? allLinks : undefined
            );
            if (researchResult) {
              allMessages.push({
                role: "user",
                content: `[PLATFORM AUTO-RESEARCH — web research about this user. use any relevant findings to personalize your greeting.]\n\n${researchResult}`,
              });
              completeStep(researchStepId, "context found");
            } else {
              completeStep(researchStepId, "no results");
            }
          } catch {
            failStep(researchStepId, "failed");
          }
        }

        setMessages(allMessages);

        const initLlmStepId = addStep("generating greeting");
        const response = await callLLM(allMessages);
        completeStep(initLlmStepId);
        const { display, updates } = parseUpdatesFromResponse(response);

        const assistantMsg: ChatMessage = {
          role: "assistant",
          content: response,
        };

        setMessages((prev) => [...prev, assistantMsg]);

        const newDisplay: DisplayMessage[] = [];

        if (shouldAutoScrape) {
          newDisplay.push({
            id: crypto.randomUUID(),
            role: "system-notice",
            content: `[scraped ${existingLinks.length} source${existingLinks.length > 1 ? "s" : ""} from your profile]`,
          });
        }

        if (display) {
          newDisplay.push({
            id: crypto.randomUUID(),
            role: "assistant",
            content: display,
          });
        }

        if (updates.length > 0) {
          const sectionNames = updates.map((u) => sectionLabel(u.section)).join(", ");
          newDisplay.push({
            id: crypto.randomUUID(),
            role: "system-notice",
            content: `[updated: ${sectionNames}]`,
          });
          saveUpdates(updates);
        }

        setDisplayMessages((prev) => [...prev, ...newDisplay]);
        setIsThinking(false);
        setTimeout(() => clearSteps(), 1500);
      } catch (err) {
        setDisplayMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: `hmm, something went wrong connecting to the agent. ${err instanceof Error ? err.message : "try again in a moment."}`,
          },
        ]);
        setIsThinking(false);
      }
    }

    initConversation();
  }, [initialized, convexUser, latestBundle, isOnboarding, onboardingGreeting, callLLM, saveUpdates, userProfile, user?.id, updateProfile, recentMemories, addStep, completeStep, failStep, clearSteps]);

  // Slash commands
  const handleSlashCommand = useCallback(
    (cmd: string): boolean => {
      const trimmed = cmd.trim().toLowerCase();

      // Pane-switching commands
      // Note: /publish and /help are handled separately below with special logic
      const paneCommands: Record<string, RightPane> = {
        "/preview": "profile",
        "/profile": "profile",
        "/portrait": "profile",
        "/settings": "settings",
        "/billing": "settings",
        "/tokens": "settings",
        "/activity": "settings",
        "/json": "edit",
        "/sources": "edit",
        "/files": "edit",
        "/vault": "edit",
        "/edit": "edit",
        "/agents": "share",
      };

      if (paneCommands[trimmed] && onPaneSwitch) {
        onPaneSwitch(paneCommands[trimmed]);
        setDisplayMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), role: "user", content: trimmed },
          {
            id: crypto.randomUUID(),
            role: "system-notice",
            content: `[switched to ${paneCommands[trimmed]}]`,
          },
        ]);
        return true;
      }

      // /portrait --regenerate — scrape social profiles and update avatar
      if (trimmed.startsWith("/portrait ") && (trimmed.includes("--regenerate") || trimmed.includes("--regen"))) {
        const username = convexUser?.username || "";
        setDisplayMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), role: "user", content: trimmed },
          { id: crypto.randomUUID(), role: "system-notice", content: "[scraping social profiles for portrait...]" },
        ]);

        // Try X first, then GitHub
        const tryPlatforms = async () => {
          for (const platform of ["x", "github"]) {
            const url = platform === "x" ? `https://x.com/${username}` : `https://github.com/${username}`;
            try {
              const res = await fetch("https://kindly-cassowary-600.convex.site/api/v1/scrape", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url }),
              });
              if (res.ok) {
                const data = await res.json();
                const imgUrl = data?.data?.profileImageUrl || data?.profileImageUrl;
                if (imgUrl && user?.id && userProfile?._id) {
                  // Save to profile
                  await updateProfile({
                    profileId: userProfile._id,
                    clerkId: user.id,
                    avatarUrl: imgUrl,
                  });
                  setDisplayMessages((prev) => [
                    ...prev,
                    { id: crypto.randomUUID(), role: "system-notice", content: `[portrait updated from ${platform} — refresh to see it]` },
                  ]);
                  return;
                }
              }
            } catch {
              // try next platform
            }
          }
          setDisplayMessages((prev) => [
            ...prev,
            { id: crypto.randomUUID(), role: "system-notice", content: "[could not fetch portrait — check your connected social links]" },
          ]);
        };

        tryPlatforms();
        if (onPaneSwitch) onPaneSwitch("profile");
        return true;
      }

      if (trimmed === "/done") {
        setDisplayMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), role: "user", content: "/done" },
          {
            id: crypto.randomUUID(),
            role: "system-notice",
            content: "[session complete]",
          },
        ]);
        onDone?.();
        return true;
      }

      if (trimmed === "/help") {
        if (onPaneSwitch) {
          onPaneSwitch("settings");
        }
        const helpText = onPaneSwitch
          ? "available commands:\n/share -- create a shareable identity link (copied to clipboard)\n/share --private -- include private context\n/share --project {name} -- share context scoped to a project\n/profile -- your identity profile + portrait\n/edit -- edit your identity bundle (files, json, sources)\n/publish -- publish your latest bundle\n/settings -- account, api keys, billing\n/memory -- memory summary + stats\n/recall -- show recent memories\n/recall {query} -- search memories\n/portrait --regenerate -- regenerate ascii portrait\n/status -- bundle status\n/help -- show this reference"
          : "available commands:\n/share -- create a shareable identity link\n/share --private -- include private context\n/share --project {name} -- share context scoped to a project\n/memory -- memory summary\n/recall -- show recent memories\n/status -- show bundle status\n/publish -- publish your latest bundle\n/done -- finish onboarding\n/help -- show this message";

        setDisplayMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), role: "user", content: "/help" },
          { id: crypto.randomUUID(), role: "system-notice", content: helpText },
        ]);
        return true;
      }

      if (trimmed === "/status") {
        const version = latestBundle?.version ?? "none";
        const published = latestBundle?.isPublished ? "published" : "draft";
        const username = convexUser?.username ?? "unknown";
        const plan = convexUser?.plan ?? "free";

        setDisplayMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), role: "user", content: "/status" },
          {
            id: crypto.randomUUID(),
            role: "system-notice",
            content: `bundle status:\n  username: @${username}\n  plan: ${plan}\n  version: v${version}\n  status: ${published}`,
          },
        ]);
        return true;
      }

      if (trimmed === "/publish") {
        if (onPaneSwitch) {
          onPaneSwitch("share");
        }
        if (!user?.id || !latestBundle) {
          setDisplayMessages((prev) => [
            ...prev,
            { id: crypto.randomUUID(), role: "user", content: "/publish" },
            {
              id: crypto.randomUUID(),
              role: "system-notice",
              content: "no bundle to publish. have a conversation first so the agent can build your profile.",
            },
          ]);
          return true;
        }

        setDisplayMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), role: "user", content: "/publish" },
          { id: crypto.randomUUID(), role: "system-notice", content: "publishing..." },
        ]);

        publishLatest({ clerkId: user.id })
          .then((result) => {
            setDisplayMessages((prev) => [
              ...prev,
              {
                id: crypto.randomUUID(),
                role: "system-notice",
                content: `published v${result.version}. live at you.md/${result.username}`,
              },
            ]);
          })
          .catch((err) => {
            setDisplayMessages((prev) => [
              ...prev,
              {
                id: crypto.randomUUID(),
                role: "system-notice",
                content: `publish failed: ${err instanceof Error ? err.message : "unknown error"}`,
              },
            ]);
          });
        return true;
      }

      // /share — create a context link and generate copyable block
      if (trimmed === "/share" || trimmed.startsWith("/share ")) {
        if (onPaneSwitch) onPaneSwitch("share");
        if (!user?.id) {
          setDisplayMessages((prev) => [
            ...prev,
            { id: crypto.randomUUID(), role: "user", content: trimmed },
            {
              id: crypto.randomUUID(),
              role: "system-notice",
              content: "sign in first to create a shareable context link.",
            },
          ]);
          return true;
        }

        const isPrivate = trimmed.includes("--private") || trimmed.includes("--full");
        const projectMatch = trimmed.match(/--project\s+(.+?)(?:\s+--|$)/);
        const projectName = projectMatch ? projectMatch[1].trim() : null;

        setDisplayMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), role: "user", content: trimmed },
          { id: crypto.randomUUID(), role: "system-notice", content: "creating context link..." },
        ]);

        const scope = isPrivate ? "full" : "public";

        createContextLink({
          clerkId: user.id,
          scope,
          ttl: "7d",
        })
          .then((result) => {
            const uname = convexUser?.username ?? "user";
            const youJson = (latestBundle?.youJson as Record<string, unknown>) || null;
            const privCtx = (privateContext as Record<string, unknown> | null) ?? null;

            let shareBlock: string;
            let label: string;

            if (projectName) {
              // /share --project {name}
              const projectBlock = buildProjectShareBlock(
                projectName,
                uname,
                result.url,
                youJson,
                privCtx
              );
              if (projectBlock) {
                shareBlock = projectBlock;
                label = `project "${projectName}"`;
              } else {
                setDisplayMessages((prev) => [
                  ...prev,
                  {
                    id: crypto.randomUUID(),
                    role: "system-notice",
                    content: `no project matching "${projectName}" found in public or private projects.`,
                  },
                ]);
                return;
              }
            } else {
              // /share or /share --private
              const publicBlock = buildPublicShareBlock(result.url, uname, youJson);
              shareBlock = isPrivate
                ? buildPrivateShareBlock(publicBlock, privCtx)
                : publicBlock;
              label = isPrivate ? "full" : "public";
            }

            // Copy to clipboard
            navigator.clipboard.writeText(shareBlock).catch(() => {});

            setDisplayMessages((prev) => [
              ...prev,
              {
                id: crypto.randomUUID(),
                role: "system-notice",
                content: `context link created for @${uname} (${label} scope, expires 7d)\n\n---\n${shareBlock}\n---\n\ncopied to clipboard. paste into any AI conversation.`,
              },
            ]);
          })
          .catch((err) => {
            setDisplayMessages((prev) => [
              ...prev,
              {
                id: crypto.randomUUID(),
                role: "system-notice",
                content: `share failed: ${err instanceof Error ? err.message : "unknown error"}`,
              },
            ]);
          });
        return true;
      }

      // /memory — show memory summary
      if (trimmed === "/memory" || trimmed === "/memories") {
        if (onPaneSwitch) onPaneSwitch("edit");
        const mems = recentMemories ?? [];
        const grouped = new Map<string, number>();
        for (const m of mems) grouped.set(m.category, (grouped.get(m.category) || 0) + 1);
        const summary = mems.length === 0
          ? "no memories yet. keep chatting — the agent saves important context automatically."
          : `memory: ${mems.length} total\n${Array.from(grouped.entries()).map(([c, n]) => `  ${c}s: ${n}`).join("\n")}`;
        setDisplayMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), role: "user", content: trimmed },
          { id: crypto.randomUUID(), role: "system-notice", content: summary },
        ]);
        return true;
      }

      // /recall [query] — search or list recent memories
      if (trimmed === "/recall" || trimmed.startsWith("/recall ")) {
        const query = trimmed.startsWith("/recall ") ? trimmed.slice(8).trim().toLowerCase() : "";
        const mems = recentMemories ?? [];
        const matches = query
          ? mems.filter((m) => m.content.toLowerCase().includes(query) || m.category.includes(query) || m.tags?.some((t) => t.toLowerCase().includes(query)))
          : mems.slice(0, 10);
        const header = query ? `${matches.length} memories matching "${query}"` : "recent memories";
        const body = matches.length === 0
          ? (query ? `no memories matching "${query}"` : "no memories yet.")
          : `${header}:\n${matches.slice(0, 10).map((m) => `  [${m.category}] ${m.content}`).join("\n")}`;
        setDisplayMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), role: "user", content: trimmed },
          { id: crypto.randomUUID(), role: "system-notice", content: body },
        ]);
        return true;
      }

      return false;
    },
    [latestBundle, convexUser, user?.id, publishLatest, createContextLink, onPaneSwitch, onDone, privateContext, recentMemories]
  );

  // Track scraped sources to avoid re-scraping
  const scrapedSourcesRef = useRef<Set<string>>(new Set());

  // Send message
  const sendMessage = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isThinking) return;

    setInput("");

    // Handle slash commands
    if (trimmed.startsWith("/")) {
      if (handleSlashCommand(trimmed)) return;
    }

    // Add user message to display
    setDisplayMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: "user", content: trimmed },
    ]);

    // Detect URLs/usernames in the message for auto-scraping
    const detectedSources = detectSourcesInMessage(trimmed);
    const newSources = detectedSources.filter(
      (s) => !scrapedSourcesRef.current.has(`${s.platform}:${s.username || s.url}`)
    );

    // Add to conversation history
    const userMsg: ChatMessage = { role: "user", content: trimmed };
    let updatedMessages = [...messagesRef.current, userMsg];
    setMessages(updatedMessages);

    // Start thinking with progress steps
    setIsThinking(true);
    clearSteps();
    const cat: ThinkingCategory = newSources.length > 0 ? "discovery" : "analysis";
    setThinkingPhrase(randomThinking(cat));
    setThinkingCategory(cat);

    try {
      // If we detected new sources, scrape them FIRST and inject results
      if (newSources.length > 0) {
        // Show scraping status
        setDisplayMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "system-notice",
            content: `[scraping: ${newSources.map((s) => `${s.platform}${s.username ? ` @${s.username}` : ""}`).join(", ")}]`,
          },
        ]);

        // Add progress steps for each source
        const scrapeStepIds = newSources.map((s) => {
          const sourceLabel = s.username ? `${s.platform}/${s.username}` : s.url;
          return addStep(`fetching ${sourceLabel}`);
        });

        // Scrape all sources in parallel, completing steps as they finish
        const scrapeResults = await Promise.all(
          newSources.map((s, i) =>
            scrapeSource(s).then((result) => {
              completeStep(scrapeStepIds[i], result ? "data received" : "no data");
              return result;
            }).catch(() => {
              failStep(scrapeStepIds[i], "failed");
              return "";
            })
          )
        );

        // Mark sources as scraped
        for (const s of newSources) {
          scrapedSourcesRef.current.add(`${s.platform}:${s.username || s.url}`);
        }

        // Extract and save profile image — prefer LinkedIn > GitHub > X
        if (userProfile?._id && user?.id && !userProfile.avatarUrl) {
          const imgStepId = addStep("extracting profile image");
          const platformPriority = ["linkedin", "github", "x"];
          let bestImage: string | null = null;
          let bestPriority = platformPriority.length;
          for (let i = 0; i < newSources.length; i++) {
            const imgMatch = scrapeResults[i]?.match(/profile_image: (https?:\/\/[^\s]+)/);
            if (imgMatch?.[1]) {
              const idx = platformPriority.indexOf(newSources[i].platform);
              if (idx >= 0 && idx < bestPriority) {
                bestImage = imgMatch[1];
                bestPriority = idx;
              }
            }
          }
          if (bestImage) {
            try {
              await updateProfile({
                profileId: userProfile._id,
                clerkId: user.id,
                avatarUrl: bestImage,
              });
              completeStep(imgStepId, "saved");
            } catch {
              failStep(imgStepId, "failed");
            }
          } else {
            completeStep(imgStepId, "none found");
          }
        }

        // Also run web research if we have a name from the profile
        const existingYouJson = (latestBundle?.youJson as Record<string, unknown>) || null;
        const userName = (existingYouJson?.identity as Record<string, unknown>)?.name as string ||
          userProfile?.name || convexUser?.displayName || "";
        let researchResult = "";
        if (userName && newSources.length > 0) {
          const researchStepId = addStep("researching web context", userName);
          const allLinks = newSources.map((s) => s.url);
          try {
            researchResult = await researchUser(userName, convexUser?.username, allLinks);
            completeStep(researchStepId, researchResult ? "context found" : "no results");
          } catch {
            failStep(researchStepId, "failed");
          }
        }

        // Inject scrape results as a system context message
        const scrapeContext = scrapeResults.filter(Boolean).join("\n\n");
        const fullContext = researchResult
          ? `${scrapeContext}\n\n${researchResult}`
          : scrapeContext;

        if (fullContext) {
          const contextMsg: ChatMessage = {
            role: "user",
            content: `[PLATFORM AUTO-SCRAPE — the following data was scraped from the user's linked profiles. use this REAL data to make specific, personal observations. reference actual names, titles, numbers, and details.]\n\n${fullContext}`,
          };
          updatedMessages = [...updatedMessages, contextMsg];
          setMessages((prev) => [...prev, contextMsg]);

          setThinkingPhrase(randomThinking("analysis"));
          setThinkingCategory("analysis");
        }
      }

      // LLM call with progress step
      const llmStepId = addStep("generating response");
      const response = await callLLM(updatedMessages);
      completeStep(llmStepId);
      const { display, updates } = parseUpdatesFromResponse(response);

      const assistantMsg: ChatMessage = {
        role: "assistant",
        content: response,
      };
      setMessages((prev) => [...prev, assistantMsg]);

      const newDisplayMsgs: DisplayMessage[] = [];

      if (display) {
        newDisplayMsgs.push({
          id: crypto.randomUUID(),
          role: "assistant",
          content: display,
        });
      }

      if (updates.length > 0) {
        const sectionNames = updates
          .map((u) => sectionLabel(u.section))
          .join(", ");
        newDisplayMsgs.push({
          id: crypto.randomUUID(),
          role: "system-notice",
          content: `[updated: ${sectionNames}]`,
        });

        const saveStepId = addStep("saving profile updates", sectionNames);
        const result = await saveUpdates(updates);
        if (result) {
          completeStep(saveStepId, `v${result.version}`);
          newDisplayMsgs.push({
            id: crypto.randomUUID(),
            role: "system-notice",
            content: `[saved as v${result.version}]`,
          });

          // Auto-publish after saving
          if (user?.id) {
            const pubStepId = addStep("publishing changes");
            try {
              await publishLatest({ clerkId: user.id });
              completeStep(pubStepId);
              newDisplayMsgs.push({
                id: crypto.randomUUID(),
                role: "system-notice",
                content: `[published]`,
              });
            } catch {
              failStep(pubStepId, "failed");
            }
          }
        } else {
          failStep(saveStepId, "no changes");
        }
      }

      // Handle private updates from agent
      const privUpdates = parsePrivateUpdatesFromResponse(response);
      if (privUpdates.length > 0 && user?.id && userProfile?._id) {
        const privStepId = addStep("saving private context");
        for (const pu of privUpdates) {
          try {
            if (pu.field === "privateNotes" && pu.content) {
              await updatePrivateContext({
                clerkId: user.id,
                profileId: userProfile._id,
                privateNotes: pu.content,
              });
              newDisplayMsgs.push({
                id: crypto.randomUUID(),
                role: "system-notice",
                content: "[saved private note]",
              });
            } else if (pu.field === "privateProjects" && pu.action === "add" && pu.project) {
              const existing = (privateContext as Record<string, unknown> | null);
              const existingProjects = (existing?.privateProjects as Array<Record<string, string>>) || [];
              const updatedProjects = [...existingProjects, pu.project];
              await updatePrivateContext({
                clerkId: user.id,
                profileId: userProfile._id,
                privateProjects: updatedProjects,
              });
              newDisplayMsgs.push({
                id: crypto.randomUUID(),
                role: "system-notice",
                content: `[saved private project: ${pu.project.name || "unnamed"}]`,
              });
            }
          } catch (err) {
            newDisplayMsgs.push({
              id: crypto.randomUUID(),
              role: "system-notice",
              content: `[failed to save private content: ${err instanceof Error ? err.message : "unknown error"}]`,
            });
          }
        }
        completeStep(privStepId);
      }

      // Handle memory saves from agent
      const memorySaves = parseMemorySavesFromResponse(response);
      if (memorySaves.length > 0 && user?.id) {
        const memStepId = addStep("saving memories", `${memorySaves.length} ${memorySaves.length === 1 ? "memory" : "memories"}`);
        try {
          await saveMemories({
            clerkId: user.id,
            memories: memorySaves.map((ms) => ({
              category: ms.category,
              content: ms.content,
              source: "you-agent",
              tags: ms.tags,
              sessionId: sessionIdRef.current,
            })),
          });
          completeStep(memStepId);
          newDisplayMsgs.push({
            id: crypto.randomUUID(),
            role: "system-notice",
            content: `[saved ${memorySaves.length} ${memorySaves.length === 1 ? "memory" : "memories"}]`,
          });
        } catch {
          failStep(memStepId, "failed");
        }
      }

      // Track session
      messageCountRef.current += 2; // user + assistant
      if (user?.id) {
        try {
          let summary: string | undefined;
          const shouldSummarize = messageCountRef.current % 10 === 0 && messageCountRef.current >= 10 && messageCountRef.current !== lastSummarizedAtRef.current;
          if (shouldSummarize) {
            lastSummarizedAtRef.current = messageCountRef.current;
            try {
              const summaryResult = await summarizeSession({
                sessionId: sessionIdRef.current,
                messages: messagesRef.current.map((m) => ({
                  role: m.role,
                  content: m.content,
                })),
              });
              summary = summaryResult.summary ?? undefined;
            } catch {
              // Non-fatal
            }
          }

          await upsertSession({
            clerkId: user.id,
            sessionId: sessionIdRef.current,
            surface: "web",
            messageCount: messageCountRef.current,
            summary,
          });
        } catch {
          // Non-fatal
        }
      }

      setDisplayMessages((prev) => [...prev, ...newDisplayMsgs]);
    } catch (err) {
      setDisplayMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `something went wrong. ${err instanceof Error ? err.message : "try again."}`,
        },
      ]);
    }

    setIsThinking(false);
    // Clear steps after a brief delay so user sees final state
    setTimeout(() => clearSteps(), 1500);
    textareaRef.current?.focus();
  }, [input, isThinking, handleSlashCommand, callLLM, saveUpdates, user?.id, userProfile?._id, privateContext, updatePrivateContext, latestBundle, userProfile, convexUser, publishLatest, updateProfile, saveMemories, upsertSession, summarizeSession, addStep, completeStep, failStep, clearSteps]);

  return {
    // State
    displayMessages,
    input,
    setInput,
    isThinking,
    thinkingPhrase,
    thinkingCategory,
    progressSteps,
    initialized,
    // Refs
    messagesEndRef,
    textareaRef,
    // Actions
    sendMessage,
    handleSlashCommand,
    // Data
    convexUser,
    latestBundle,
    // Helpers for adding system messages from outside
    addSystemMessage: (content: string) => {
      setDisplayMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "system-notice", content },
      ]);
    },
  };
}
