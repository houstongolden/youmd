import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { compileYouJson, compileYouMd, type ProfileData } from "./lib/compile";
import {
  canonicalUsername,
  normalizeProfileLinks,
  resolveProfileAvatar,
  sanitizePublicImageUrl,
} from "./lib/profileDirectory";

const DAY_MS = 24 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 10_000;
const MAX_FETCH_BYTES = 220_000;

type TargetLinks = Record<string, string>;

interface PublicProfileTarget {
  username: string;
  name: string;
  tagline: string;
  location?: string;
  segment: string;
  priority: number;
  tags: string[];
  links: TargetLinks;
}

interface ImportTargetResult {
  username: string;
  status: string;
  isClaimed?: boolean;
  sourceCount?: number;
  existingSourceCount?: number;
  avatarUrl?: string | null;
  profileId?: Id<"profiles"> | null;
  sources?: number;
  jobs?: number;
}

interface ImportTargetsResult {
  dryRun: boolean;
  batchKey: string;
  targetSegment: string;
  totalAvailable: number;
  selected: number;
  created: number;
  patched: number;
  skipped: number;
  results: ImportTargetResult[];
}

interface DueProfileSource {
  _id: Id<"profileSources">;
  username: string;
  url: string;
  platform: string;
  priority: number;
  status: string;
  contentHash?: string;
  nextRefreshAt?: number;
}

interface ExtractedHtmlMeta {
  title?: string;
  description?: string;
  imageUrl?: string;
}

interface ProfileSourceFetchResult {
  username: string;
  url: string;
  status: string;
  platform?: string;
  changed?: boolean;
  contentHash?: string;
  lastFetchedAt?: number;
  nextRefreshAt?: number;
  fetchCostCents?: number;
  qualityScore?: number;
  contentType?: string;
  statusCode?: number;
  title?: string;
  description?: string;
  imageUrl?: string;
  lastError?: string;
}

interface FetchDueProfileSourcesResult {
  dryRun: boolean;
  scanned: number;
  fetched: number;
  failed: number;
  results: ProfileSourceFetchResult[];
}

const INITIAL_PUBLIC_PROFILE_TARGETS: PublicProfileTarget[] = [
  { username: "patrickc", name: "Patrick Collison", tagline: "Co-founder and CEO of Stripe. Building internet-scale financial infrastructure.", location: "San Francisco, CA", segment: "saas-founder", priority: 98, tags: ["Stripe", "payments", "SaaS", "founder"], links: { x: "https://x.com/patrickc", github: "https://github.com/patrickc", website: "https://patrickcollison.com" } },
  { username: "johncollison", name: "John Collison", tagline: "Co-founder and President of Stripe. Infrastructure builder for internet businesses.", location: "San Francisco, CA", segment: "saas-founder", priority: 96, tags: ["Stripe", "payments", "SaaS", "founder"], links: { x: "https://x.com/collision", website: "https://stripe.com" } },
  { username: "paulg", name: "Paul Graham", tagline: "Y Combinator co-founder. Essayist and early-stage startup thinker.", segment: "startup-founder", priority: 96, tags: ["YC", "startups", "essays", "investing"], links: { x: "https://x.com/paulg", website: "https://paulgraham.com" } },
  { username: "garrytan", name: "Garry Tan", tagline: "President and CEO of Y Combinator. Investor and startup operator.", location: "San Francisco, CA", segment: "startup-founder", priority: 95, tags: ["YC", "startups", "investing", "founders"], links: { x: "https://x.com/garrytan", github: "https://github.com/garrytan", website: "https://ycombinator.com" } },
  { username: "naval", name: "Naval Ravikant", tagline: "AngelList co-founder. Investor, founder, and startup philosopher.", segment: "startup-founder", priority: 94, tags: ["AngelList", "startups", "investing", "philosophy"], links: { x: "https://x.com/naval", website: "https://nav.al" } },
  { username: "bchesky", name: "Brian Chesky", tagline: "Co-founder and CEO of Airbnb. Marketplace and design-led company builder.", location: "San Francisco, CA", segment: "saas-founder", priority: 94, tags: ["Airbnb", "marketplaces", "design", "founder"], links: { x: "https://x.com/bchesky", website: "https://airbnb.com" } },
  { username: "tobi", name: "Tobi Lutke", tagline: "Founder and CEO of Shopify. Commerce platform builder.", location: "Ottawa, Canada", segment: "saas-founder", priority: 94, tags: ["Shopify", "commerce", "SaaS", "founder"], links: { x: "https://x.com/tobi", github: "https://github.com/tobi", website: "https://shopify.com" } },
  { username: "dhh", name: "David Heinemeier Hansson", tagline: "Creator of Ruby on Rails. Co-founder of 37signals/Basecamp.", segment: "builder", priority: 93, tags: ["Rails", "Basecamp", "SaaS", "software"], links: { x: "https://x.com/dhh", github: "https://github.com/dhh", website: "https://dhh.dk" } },
  { username: "brianarmstrong", name: "Brian Armstrong", tagline: "Co-founder and CEO of Coinbase. Crypto infrastructure founder.", location: "San Francisco, CA", segment: "saas-founder", priority: 92, tags: ["Coinbase", "crypto", "fintech", "founder"], links: { x: "https://x.com/brian_armstrong", github: "https://github.com/barmstrong", website: "https://coinbase.com" } },
  { username: "dylanfield", name: "Dylan Field", tagline: "Co-founder and CEO of Figma. Collaborative design software founder.", location: "San Francisco, CA", segment: "saas-founder", priority: 92, tags: ["Figma", "design", "SaaS", "collaboration"], links: { x: "https://x.com/dylanfield", website: "https://figma.com" } },
  { username: "michaeltruell", name: "Michael Truell", tagline: "Co-founder and CEO of Anysphere. Building Cursor and AI-native software creation.", location: "San Francisco, CA", segment: "ai-founder", priority: 91, tags: ["Cursor", "AI coding", "developer tools", "agents"], links: { x: "https://x.com/michael_truell", website: "https://anysphere.co" } },
  { username: "aravsrinivas", name: "Aravind Srinivas", tagline: "Co-founder and CEO of Perplexity. Building AI-native search.", location: "San Francisco, CA", segment: "ai-founder", priority: 91, tags: ["Perplexity", "AI search", "LLMs", "founder"], links: { x: "https://x.com/aravsrinivas", website: "https://perplexity.ai" } },
  { username: "aidangomez", name: "Aidan Gomez", tagline: "Co-founder and CEO of Cohere. Transformer co-author and enterprise AI founder.", segment: "ai-founder", priority: 90, tags: ["Cohere", "Transformers", "enterprise AI", "LLMs"], links: { x: "https://x.com/aidangomez", website: "https://cohere.com" } },
  { username: "richardsocher", name: "Richard Socher", tagline: "Founder and CEO of You.com. AI search and NLP researcher.", segment: "ai-founder", priority: 90, tags: ["You.com", "AI search", "NLP", "founder"], links: { x: "https://x.com/RichardSocher", website: "https://you.com" } },
  { username: "mustafasuleyman", name: "Mustafa Suleyman", tagline: "AI founder and executive. Co-founder of DeepMind and Inflection.", segment: "ai-founder", priority: 90, tags: ["DeepMind", "Inflection", "AI", "founder"], links: { x: "https://x.com/mustafasuleyman", website: "https://mustafa-suleyman.ai" } },
  { username: "demishassabis", name: "Demis Hassabis", tagline: "Co-founder and CEO of Google DeepMind. AI research leader.", location: "London, UK", segment: "ai-founder", priority: 90, tags: ["DeepMind", "AI research", "Google", "founder"], links: { x: "https://x.com/demishassabis", website: "https://deepmind.google" } },
  { username: "jeffdean", name: "Jeff Dean", tagline: "Google DeepMind chief scientist. Large-scale systems and AI research builder.", segment: "ai-builder", priority: 89, tags: ["Google", "DeepMind", "AI systems", "research"], links: { x: "https://x.com/JeffDean", github: "https://github.com/JeffDean", website: "https://research.google/people/jeff" } },
  { username: "fchollet", name: "Francois Chollet", tagline: "Creator of Keras. AI researcher focused on abstraction and reasoning.", segment: "ai-builder", priority: 89, tags: ["Keras", "AI research", "reasoning", "deep learning"], links: { x: "https://x.com/fchollet", github: "https://github.com/fchollet", website: "https://fchollet.com" } },
  { username: "soumith", name: "Soumith Chintala", tagline: "PyTorch co-creator. AI infrastructure and open-source ML builder.", segment: "ai-builder", priority: 89, tags: ["PyTorch", "open source", "ML", "AI infrastructure"], links: { x: "https://x.com/soumithchintala", github: "https://github.com/soumith", website: "https://pytorch.org" } },
  { username: "thomaswolf", name: "Thomas Wolf", tagline: "Co-founder of Hugging Face. Open-source AI and ML community builder.", segment: "ai-founder", priority: 88, tags: ["Hugging Face", "open source", "LLMs", "ML"], links: { x: "https://x.com/Thom_Wolf", github: "https://github.com/thomwolf", website: "https://huggingface.co" } },
  { username: "miramurati", name: "Mira Murati", tagline: "AI product and research leader. Former CTO of OpenAI.", segment: "ai-builder", priority: 88, tags: ["OpenAI", "AI product", "research", "LLMs"], links: { x: "https://x.com/miramurati", website: "https://openai.com" } },
  { username: "noamshazeer", name: "Noam Shazeer", tagline: "Transformer co-author and AI systems founder.", segment: "ai-builder", priority: 88, tags: ["Transformers", "LLMs", "AI systems", "research"], links: { x: "https://x.com/NoamShazeer", website: "https://character.ai" } },
  { username: "emadmostaque", name: "Emad Mostaque", tagline: "AI founder and open model advocate.", segment: "ai-founder", priority: 86, tags: ["AI", "open models", "generative AI", "founder"], links: { x: "https://x.com/EMostaque", website: "https://stability.ai" } },
  { username: "davidholz", name: "David Holz", tagline: "Founder of Midjourney. Generative image systems builder.", segment: "ai-founder", priority: 86, tags: ["Midjourney", "generative AI", "images", "founder"], links: { website: "https://midjourney.com" } },
  { username: "cristobal", name: "Cristobal Valenzuela", tagline: "Co-founder and CEO of Runway. Building creative AI tools.", segment: "ai-founder", priority: 86, tags: ["Runway", "creative AI", "video", "founder"], links: { x: "https://x.com/c_valenzuelab", website: "https://runwayml.com" } },
  { username: "varunmohan", name: "Varun Mohan", tagline: "Co-founder of Codeium/Windsurf. AI coding tools builder.", segment: "ai-founder", priority: 85, tags: ["Codeium", "Windsurf", "AI coding", "developer tools"], links: { x: "https://x.com/_mohansolo", website: "https://windsurf.com" } },
  { username: "deedydas", name: "Deedy Das", tagline: "Investor and AI/startup operator. Sharp observer of tech hiring and AI.", segment: "ai-builder", priority: 84, tags: ["AI", "startups", "investing", "operator"], links: { x: "https://x.com/deedydas", website: "https://www.menlovc.com" } },
  { username: "t3dotgg", name: "Theo Browne", tagline: "Developer tooling founder and educator. Builds in public around modern web and AI.", segment: "builder", priority: 84, tags: ["developer tools", "web", "AI", "education"], links: { x: "https://x.com/t3dotgg", github: "https://github.com/t3dotgg", website: "https://t3.gg" } },
  { username: "jackclark", name: "Jack Clark", tagline: "Anthropic co-founder. AI policy, safety, and research communicator.", segment: "ai-builder", priority: 84, tags: ["Anthropic", "AI policy", "AI safety", "research"], links: { x: "https://x.com/jackclarkSF", website: "https://anthropic.com" } },
  { username: "lennysan", name: "Lenny Rachitsky", tagline: "Product and growth writer. Host of Lenny's Podcast and newsletter.", segment: "builder", priority: 83, tags: ["product", "growth", "SaaS", "newsletter"], links: { x: "https://x.com/lennysan", website: "https://www.lennysnewsletter.com" } },
  { username: "hnshah", name: "Hiten Shah", tagline: "SaaS founder and startup operator. Built Kissmetrics, Crazy Egg, and Nira.", segment: "saas-founder", priority: 83, tags: ["SaaS", "product", "analytics", "founder"], links: { x: "https://x.com/hnshah", website: "https://hiten.com" } },
  { username: "jasonfried", name: "Jason Fried", tagline: "Co-founder and CEO of 37signals. Bootstrapped SaaS and product thinker.", segment: "saas-founder", priority: 83, tags: ["37signals", "Basecamp", "SaaS", "bootstrapped"], links: { x: "https://x.com/jasonfried", website: "https://world.hey.com/jason" } },
  { username: "eladgil", name: "Elad Gil", tagline: "Startup investor and operator. Author of High Growth Handbook.", segment: "startup-founder", priority: 82, tags: ["startups", "investing", "growth", "AI"], links: { x: "https://x.com/eladgil", website: "https://eladgil.com" } },
  { username: "danielgross", name: "Daniel Gross", tagline: "AI investor and founder. Co-founder of Pioneer and NFDG.", segment: "ai-founder", priority: 82, tags: ["AI", "investing", "startups", "founder"], links: { x: "https://x.com/danielgross", website: "https://danielgross.org" } },
  { username: "lachygroom", name: "Lachy Groom", tagline: "Investor and former Stripe operator backing ambitious technology founders.", segment: "startup-founder", priority: 81, tags: ["investing", "Stripe", "startups", "fintech"], links: { x: "https://x.com/lachygroom", website: "https://lg.xyz" } },
  { username: "levie", name: "Aaron Levie", tagline: "Co-founder and CEO of Box. Enterprise SaaS founder and AI commentator.", segment: "saas-founder", priority: 81, tags: ["Box", "enterprise SaaS", "AI", "founder"], links: { x: "https://x.com/levie", website: "https://box.com" } },
  { username: "drewhouston", name: "Drew Houston", tagline: "Co-founder and CEO of Dropbox. Cloud collaboration founder.", segment: "saas-founder", priority: 81, tags: ["Dropbox", "SaaS", "cloud", "founder"], links: { x: "https://x.com/drewhouston", website: "https://dropbox.com" } },
  { username: "melaniecanva", name: "Melanie Perkins", tagline: "Co-founder and CEO of Canva. Design platform founder.", segment: "saas-founder", priority: 80, tags: ["Canva", "design", "SaaS", "founder"], links: { x: "https://x.com/MelanieCanva", website: "https://canva.com" } },
  { username: "mathildecollin", name: "Mathilde Collin", tagline: "Co-founder and CEO of Front. Customer operations SaaS founder.", segment: "saas-founder", priority: 80, tags: ["Front", "SaaS", "customer operations", "founder"], links: { x: "https://x.com/collinmathilde", website: "https://front.com" } },
  { username: "wadefoster", name: "Wade Foster", tagline: "Co-founder and CEO of Zapier. Automation platform founder.", segment: "saas-founder", priority: 80, tags: ["Zapier", "automation", "SaaS", "founder"], links: { x: "https://x.com/wadefoster", website: "https://zapier.com" } },
  { username: "iamcal", name: "Cal Henderson", tagline: "Slack co-founder and CTO. Large-scale software infrastructure builder.", segment: "builder", priority: 79, tags: ["Slack", "infrastructure", "SaaS", "engineering"], links: { x: "https://x.com/iamcal", github: "https://github.com/iamcal", website: "https://slack.com" } },
  { username: "stewart", name: "Stewart Butterfield", tagline: "Co-founder of Slack and Flickr. Product and community software founder.", segment: "saas-founder", priority: 79, tags: ["Slack", "Flickr", "SaaS", "founder"], links: { x: "https://x.com/stewart", website: "https://slack.com" } },
  { username: "parkerconrad", name: "Parker Conrad", tagline: "Founder and CEO of Rippling. Workforce platform founder.", segment: "saas-founder", priority: 79, tags: ["Rippling", "HR tech", "SaaS", "founder"], links: { x: "https://x.com/parkerconrad", website: "https://rippling.com" } },
  { username: "fidjisimo", name: "Fidji Simo", tagline: "CEO of Instacart. Consumer marketplace and product leader.", segment: "saas-founder", priority: 78, tags: ["Instacart", "marketplaces", "product", "operator"], links: { x: "https://x.com/fidjissimo", website: "https://instacart.com" } },
  { username: "pmarca", name: "Marc Andreessen", tagline: "Andreessen Horowitz co-founder. Software investor and Netscape co-founder.", segment: "startup-founder", priority: 78, tags: ["a16z", "startups", "software", "investing"], links: { x: "https://x.com/pmarca", website: "https://a16z.com" } },
  { username: "bhorowitz", name: "Ben Horowitz", tagline: "Andreessen Horowitz co-founder. Operator, investor, and startup author.", segment: "startup-founder", priority: 78, tags: ["a16z", "startups", "operations", "investing"], links: { x: "https://x.com/bhorowitz", website: "https://a16z.com" } },
  { username: "bgurley", name: "Bill Gurley", tagline: "Benchmark investor. Marketplace, SaaS, and startup strategy thinker.", segment: "startup-founder", priority: 77, tags: ["Benchmark", "marketplaces", "SaaS", "investing"], links: { x: "https://x.com/bgurley", website: "https://abovethecrowd.com" } },
  { username: "ericries", name: "Eric Ries", tagline: "Author of The Lean Startup. Founder and startup methodology builder.", segment: "startup-founder", priority: 77, tags: ["Lean Startup", "startups", "product", "founder"], links: { x: "https://x.com/ericries", website: "https://theleanstartup.com" } },
  { username: "kevinsystrom", name: "Kevin Systrom", tagline: "Instagram co-founder. Consumer product and social software builder.", segment: "builder", priority: 77, tags: ["Instagram", "consumer", "social", "founder"], links: { x: "https://x.com/kevin", website: "https://artifact.news" } },
  { username: "mikeyk", name: "Mike Krieger", tagline: "Instagram co-founder. Product engineering leader and builder.", segment: "builder", priority: 76, tags: ["Instagram", "product", "engineering", "founder"], links: { x: "https://x.com/mikeyk", website: "https://instagram.com" } },
];

function targetToProfileData(target: PublicProfileTarget): ProfileData {
  return {
    name: target.name,
    username: canonicalUsername(target.username),
    tagline: target.tagline,
    location: target.location,
    bio: {
      short: target.tagline,
      medium: `${target.name} is in You.md's initial ${target.segment.replace(/-/g, " ")} public-profile target set. This profile is source-backed and queued for periodic enrichment.`,
    },
    links: target.links,
    now: ["Queued for source-backed public profile enrichment"],
    projects: [],
    values: ["Source-backed profile context", "Agent-readable public identity"],
    preferences: {
      agent: {
        tone: "concise, source-aware, avoid unsupported claims",
        formality: "casual-professional",
        avoid: ["claims without provenance", "private or sensitive personal details"],
      },
      writing: { format: "brief source-backed summary" },
    },
    analysis: {
      topics: target.tags,
      voice_summary: "Pending source-backed voice analysis.",
      credibility_signals: [],
    },
  };
}

function sourceDraftsForTarget(target: PublicProfileTarget) {
  return Object.entries(target.links).map(([platform, url]) => ({
    url,
    platform,
    sourceType: platform === "website" ? "personal_site" : "social_profile",
    priority: target.priority,
  }));
}

function targetAvatarUrl(target: PublicProfileTarget): string | undefined {
  return resolveProfileAvatar({ username: target.username, links: target.links });
}

function statusFromCounts(created: number, patched: number, failed: number, dryRun: boolean): string {
  if (dryRun) return "dry_run";
  if (failed > 0) return "failed";
  return created > 0 || patched > 0 ? "imported" : "skipped";
}

function safeString(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.replace(/\s+/g, " ").trim();
  return trimmed ? trimmed.slice(0, maxLength) : undefined;
}

function platformFromUrl(url: string): string {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.includes("github.com")) return "github";
    if (host.includes("x.com") || host.includes("twitter.com")) return "x";
    if (host.includes("linkedin.com")) return "linkedin";
    if (host.includes("youtube.com") || host.includes("youtu.be")) return "youtube";
    return "website";
  } catch {
    return "website";
  }
}

function extractHtmlMeta(html: string): ExtractedHtmlMeta {
  const title = safeString(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1], 160);
  const description =
    safeString(html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["'][^>]*>/i)?.[1], 280) ??
    safeString(html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["'][^>]*>/i)?.[1], 280);
  const imageUrl = sanitizePublicImageUrl(
    html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["'][^>]*>/i)?.[1]
  );
  return { title, description, imageUrl };
}

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function fetchTextWithTimeout(url: string): Promise<{ text: string; contentType: string; status: number }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "You.md public-profile-indexer/0.1 (+https://you.md/profiles)",
      },
    });
    const contentType = response.headers.get("content-type") ?? "";
    const arrayBuffer = await response.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer).slice(0, MAX_FETCH_BYTES);
    return {
      text: new TextDecoder("utf-8", { fatal: false }).decode(bytes),
      contentType,
      status: response.status,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export const listInitialPublicProfileTargets = internalQuery({
  args: {},
  handler: async () => ({
    count: INITIAL_PUBLIC_PROFILE_TARGETS.length,
    targets: INITIAL_PUBLIC_PROFILE_TARGETS.map((target) => ({
      username: target.username,
      name: target.name,
      segment: target.segment,
      priority: target.priority,
      sourceCount: Object.keys(target.links).length,
    })),
  }),
});

export const _previewImportTarget = internalQuery({
  args: { target: v.any() },
  handler: async (ctx, { target }): Promise<ImportTargetResult> => {
    const publicTarget = target as PublicProfileTarget;
    const username = canonicalUsername(publicTarget.username);
    const profile = await ctx.db.query("profiles").withIndex("by_username", (q) => q.eq("username", username)).first();
    const user = await ctx.db.query("users").withIndex("by_username", (q) => q.eq("username", username)).first();
    const existingSources = await ctx.db.query("profileSources").withIndex("by_username", (q) => q.eq("username", username)).collect();
    return {
      username,
      status: user ? "user_exists_skip" : profile ? "would_patch" : "would_create",
      isClaimed: Boolean(profile?.isClaimed),
      sourceCount: sourceDraftsForTarget(publicTarget).length,
      existingSourceCount: existingSources.length,
      avatarUrl: targetAvatarUrl(publicTarget) ?? null,
    };
  },
});

export const _upsertImportTarget = internalMutation({
  args: {
    target: v.any(),
    batchKey: v.string(),
    forcePatch: v.optional(v.boolean()),
  },
  handler: async (ctx, { target, batchKey, forcePatch }): Promise<ImportTargetResult> => {
    const publicTarget = target as PublicProfileTarget;
    const username = canonicalUsername(publicTarget.username);
    const now = Date.now();
    const profileData = targetToProfileData({ ...publicTarget, username });
    const youJson = compileYouJson(profileData);
    const youMd = compileYouMd(profileData);
    const avatarUrl = targetAvatarUrl(publicTarget);

    const existingUser = await ctx.db.query("users").withIndex("by_username", (q) => q.eq("username", username)).first();
    if (existingUser) {
      return { username, status: "user_exists_skip", profileId: null, sources: 0, jobs: 0 };
    }

    const existingProfile = await ctx.db.query("profiles").withIndex("by_username", (q) => q.eq("username", username)).first();
    let profileId = existingProfile?._id;
    let status = "created";

    if (existingProfile) {
      if (existingProfile.isClaimed && !forcePatch) {
        return { username, status: "claimed_profile_skip", profileId: existingProfile._id, sources: 0, jobs: 0 };
      }

      const patch: Record<string, unknown> = { updatedAt: now };
      if (!existingProfile.name || forcePatch) patch.name = publicTarget.name;
      if (!existingProfile.tagline || forcePatch) patch.tagline = publicTarget.tagline;
      if ((!existingProfile.location && publicTarget.location) || forcePatch) patch.location = publicTarget.location;
      if (!existingProfile.avatarUrl && avatarUrl) patch.avatarUrl = avatarUrl;
      if (!existingProfile.links || forcePatch) patch.links = normalizeProfileLinks(existingProfile.links, publicTarget.links);
      if (!existingProfile.youJson || forcePatch) patch.youJson = youJson;
      if (!existingProfile.youMd || forcePatch) patch.youMd = youMd;
      await ctx.db.patch(existingProfile._id, patch);
      status = "patched";
    } else {
      profileId = await ctx.db.insert("profiles", {
        username,
        name: publicTarget.name,
        tagline: publicTarget.tagline,
        location: publicTarget.location,
        avatarUrl,
        links: publicTarget.links,
        youJson,
        youMd,
        isClaimed: false,
        createdAt: now,
        updatedAt: now,
      });
    }

    let sourceCount = 0;
    let jobCount = 0;
    for (const source of sourceDraftsForTarget(publicTarget)) {
      const existingSource = (await ctx.db.query("profileSources").withIndex("by_username", (q) => q.eq("username", username)).collect())
        .find((row) => row.url === source.url);
      const sourcePatch = {
        username,
        profileId,
        url: source.url,
        platform: platformFromUrl(source.url) || source.platform,
        sourceType: source.sourceType,
        priority: source.priority,
        status: "queued",
        nextRefreshAt: now,
        updatedAt: now,
        metadata: { batchKey, seedSegment: publicTarget.segment, tags: publicTarget.tags },
      };
      const sourceId = existingSource?._id ?? await ctx.db.insert("profileSources", {
        ...sourcePatch,
        fetchCostCents: 0,
        failureCount: 0,
        createdAt: now,
      });
      if (existingSource) await ctx.db.patch(existingSource._id, sourcePatch);
      sourceCount++;

      const existingJobs = await ctx.db.query("profileRefreshJobs").withIndex("by_username", (q) => q.eq("username", username)).collect();
      const hasQueuedFetch = existingJobs.some((job) => job.kind === "fetch" && job.status === "queued" && job.sourceId === sourceId);
      if (!hasQueuedFetch) {
        await ctx.db.insert("profileRefreshJobs", {
          username,
          profileId,
          sourceId,
          kind: "fetch",
          status: "queued",
          priority: publicTarget.priority,
          scheduledFor: now,
          attempts: 0,
          maxAttempts: 3,
          createdAt: now,
        });
        jobCount++;
      }
    }

    if (avatarUrl) {
      const jobs = await ctx.db.query("profileRefreshJobs").withIndex("by_username", (q) => q.eq("username", username)).collect();
      const hasPortraitJob = jobs.some((job) => job.kind === "portrait" && job.status === "queued");
      if (!hasPortraitJob) {
        await ctx.db.insert("profileRefreshJobs", {
          username,
          profileId,
          kind: "portrait",
          status: "queued",
          priority: publicTarget.priority,
          scheduledFor: now,
          attempts: 0,
          maxAttempts: 2,
          createdAt: now,
          result: { avatarUrl },
        });
        jobCount++;
      }
    }

    return { username, status, profileId, sources: sourceCount, jobs: jobCount };
  },
});

export const _recordImportBatch = internalMutation({
  args: {
    batchKey: v.string(),
    targetSegment: v.string(),
    dryRun: v.boolean(),
    results: v.any(),
  },
  handler: async (ctx, { batchKey, targetSegment, dryRun, results }) => {
    const rows = Array.isArray(results) ? results : [];
    const created = rows.filter((row) => row.status === "created").length;
    const patched = rows.filter((row) => row.status === "patched").length;
    const skipped = rows.filter((row) => String(row.status).includes("skip") || String(row.status).includes("exists")).length;
    const failed = rows.filter((row) => String(row.status).includes("failed") || String(row.status).includes("error")).length;
    const now = Date.now();
    await ctx.db.insert("profileImportBatches", {
      batchKey,
      targetSegment,
      status: statusFromCounts(created, patched, failed, dryRun),
      dryRun,
      total: rows.length,
      created,
      patched,
      skipped,
      failed,
      results: rows,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const importInitialPublicProfileTargets = internalAction({
  args: {
    dryRun: v.optional(v.boolean()),
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
    batchKey: v.optional(v.string()),
    forcePatch: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<ImportTargetsResult> => {
    const dryRun = args.dryRun ?? true;
    const offset = Math.max(0, args.offset ?? 0);
    const limit = Math.max(1, Math.min(args.limit ?? INITIAL_PUBLIC_PROFILE_TARGETS.length, INITIAL_PUBLIC_PROFILE_TARGETS.length));
    const selected = INITIAL_PUBLIC_PROFILE_TARGETS.slice(offset, offset + limit);
    const batchKey = args.batchKey ?? `initial-tech-ai-saas-${new Date().toISOString().slice(0, 10)}`;
    const results: ImportTargetResult[] = [];

    for (const target of selected) {
      if (dryRun) {
        results.push(await ctx.runQuery(internal.profileIndexing._previewImportTarget, { target }));
      } else {
        results.push(await ctx.runMutation(internal.profileIndexing._upsertImportTarget, {
          target,
          batchKey,
          forcePatch: args.forcePatch ?? false,
        }));
      }
    }

    await ctx.runMutation(internal.profileIndexing._recordImportBatch, {
      batchKey,
      targetSegment: "initial-tech-ai-saas-builders",
      dryRun,
      results,
    });

    return {
      dryRun,
      batchKey,
      targetSegment: "initial-tech-ai-saas-builders",
      totalAvailable: INITIAL_PUBLIC_PROFILE_TARGETS.length,
      selected: selected.length,
      created: results.filter((row) => row.status === "created").length,
      patched: results.filter((row) => row.status === "patched").length,
      skipped: results.filter((row) => String(row.status).includes("skip") || String(row.status).includes("exists")).length,
      results,
    };
  },
});

export const _listDueProfileSources = internalQuery({
  args: { now: v.number(), limit: v.number() },
  handler: async (ctx, { now, limit }) => {
    const rows = await ctx.db.query("profileSources").take(1000);
    return rows
      .filter((row) => row.status === "queued" || (typeof row.nextRefreshAt === "number" && row.nextRefreshAt <= now))
      .sort((a, b) => b.priority - a.priority)
      .slice(0, limit);
  },
});

export const _patchSourceFetchResult = internalMutation({
  args: {
    sourceId: v.id("profileSources"),
    result: v.any(),
  },
  handler: async (ctx, { sourceId, result }) => {
    const row = await ctx.db.get(sourceId);
    if (!row) return;
    await ctx.db.patch(sourceId, {
      status: result.status,
      contentHash: result.contentHash ?? row.contentHash,
      title: result.title,
      description: result.description,
      imageUrl: result.imageUrl,
      lastFetchedAt: result.lastFetchedAt,
      lastChangedAt: result.changed ? result.lastFetchedAt : row.lastChangedAt,
      nextRefreshAt: result.nextRefreshAt,
      fetchCostCents: (row.fetchCostCents ?? 0) + (result.fetchCostCents ?? 0),
      qualityScore: result.qualityScore,
      failureCount: result.status === "failed" ? (row.failureCount ?? 0) + 1 : row.failureCount ?? 0,
      lastError: result.lastError,
      metadata: {
        ...(typeof row.metadata === "object" && row.metadata ? row.metadata as Record<string, unknown> : {}),
        contentType: result.contentType,
        statusCode: result.statusCode,
        extractor: "native-html-meta",
      },
      updatedAt: result.lastFetchedAt,
    });
  },
});

export const fetchDueProfileSources = internalAction({
  args: {
    dryRun: v.optional(v.boolean()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<FetchDueProfileSourcesResult> => {
    const dryRun = args.dryRun ?? true;
    const now = Date.now();
    const limit = Math.max(1, Math.min(args.limit ?? 25, 100));
    const sources = await ctx.runQuery(internal.profileIndexing._listDueProfileSources, { now, limit }) as DueProfileSource[];
    const results: ProfileSourceFetchResult[] = [];

    for (const source of sources) {
      if (dryRun) {
        results.push({ username: source.username, url: source.url, status: "would_fetch", platform: source.platform });
        continue;
      }

      try {
        const fetched = await fetchTextWithTimeout(source.url);
        const hash = await sha256Hex(fetched.text);
        const changed = hash !== source.contentHash;
        const meta: ExtractedHtmlMeta = fetched.contentType.includes("html") ? extractHtmlMeta(fetched.text) : {};
        const qualityScore = (meta.title ? 20 : 0) + (meta.description ? 35 : 0) + (meta.imageUrl ? 15 : 0) + (changed ? 10 : 0);
        const status = fetched.status >= 200 && fetched.status < 400 ? (changed ? "changed" : "current") : "failed";

        const result = {
          status,
          changed,
          contentHash: hash,
          lastFetchedAt: now,
          nextRefreshAt: now + (changed ? 7 * DAY_MS : 30 * DAY_MS),
          fetchCostCents: 0,
          qualityScore,
          contentType: fetched.contentType,
          statusCode: fetched.status,
          title: meta.title,
          description: meta.description,
          imageUrl: meta.imageUrl,
          lastError: status === "failed" ? `HTTP ${fetched.status}` : undefined,
        };
        await ctx.runMutation(internal.profileIndexing._patchSourceFetchResult, {
          sourceId: source._id,
          result,
        });
        results.push({ username: source.username, url: source.url, ...result });
      } catch (error) {
        const result = {
          status: "failed",
          changed: false,
          lastFetchedAt: now,
          nextRefreshAt: now + 7 * DAY_MS,
          fetchCostCents: 0,
          qualityScore: 0,
          lastError: error instanceof Error ? error.message : String(error),
        };
        await ctx.runMutation(internal.profileIndexing._patchSourceFetchResult, {
          sourceId: source._id,
          result,
        });
        results.push({ username: source.username, url: source.url, ...result });
      }
    }

    return {
      dryRun,
      scanned: sources.length,
      fetched: results.filter((row) => row.status === "changed" || row.status === "current").length,
      failed: results.filter((row) => row.status === "failed").length,
      results,
    };
  },
});
