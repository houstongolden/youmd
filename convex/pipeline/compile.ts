"use node";

import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import {
  compileYouJson,
  compileYouMd,
  compileManifest,
  type ProfileData,
} from "../lib/compile";

// ---------------------------------------------------------------------------
// compileBundleFromPipeline — Compile extracted + analyzed data into a bundle
// ---------------------------------------------------------------------------

export const compileBundleFromPipeline = internalAction({
  args: {
    userId: v.id("users"),
    username: v.string(),
  },
  handler: async (ctx, args): Promise<
    { success: true; bundleId: string; version: number } | { success: false; error: string }
  > => {
    try {
      // Fetch all extracted sources
      const sources: SourceDoc[] = await ctx.runMutation(
        internal.pipeline.mutations.getSourcesByUserId,
        { userId: args.userId }
      ) as SourceDoc[];

      // Fetch all analysis artifacts
      const artifacts: Array<{ artifactType: string; content: unknown }> = await ctx.runMutation(
        internal.pipeline.mutations.getAnalysisArtifacts,
        { userId: args.userId }
      ) as Array<{ artifactType: string; content: unknown }>;

      // Build artifact lookup
      const artifactMap: Record<string, unknown> = {};
      for (const a of artifacts) {
        artifactMap[a.artifactType] = a.content;
      }

      // Merge extracted data from all sources into a unified ProfileData
      const profileData = mergeToProfileData(
        args.username,
        sources,
        artifactMap
      );

      // Which source types were used
      const sourcesUsed = sources
        .filter((s: { status: string }) => s.status === "extracted")
        .map((s: { sourceType: string }) => s.sourceType);

      // Compile using existing utilities
      const youJson = compileYouJson(profileData);
      const youMd = compileYouMd(profileData);
      const manifest = compileManifest(profileData, sourcesUsed);

      // Enrich youJson with analysis data
      if (artifactMap["author_voice"]) {
        const voice = artifactMap["author_voice"] as Record<string, unknown>;
        (youJson as Record<string, unknown>).analysis = {
          ...(youJson as Record<string, Record<string, unknown>>).analysis,
          voice_summary:
            (voice.voice_summary as string) ??
            (youJson as Record<string, Record<string, unknown>>).analysis
              ?.voice_summary,
        };
      }

      if (artifactMap["topic_map"]) {
        const topics = artifactMap["topic_map"] as Record<string, unknown>;
        const primaryTopics = (
          topics.primary_topics as Array<{ topic: string }>
        )?.map((t) => t.topic);
        if (primaryTopics) {
          (youJson as Record<string, Record<string, unknown>>).analysis = {
            ...(youJson as Record<string, Record<string, unknown>>).analysis,
            topics: primaryTopics,
          };
        }
      }

      // Add analysis paths to manifest
      const manifestPaths = (manifest as Record<string, Record<string, string[]>>).paths;
      if (artifactMap["author_voice"])
        manifestPaths.public.push("analysis/author_voice.md");
      if (artifactMap["topic_map"])
        manifestPaths.public.push("analysis/topic_map.json");
      if (artifactMap["bio_variants"])
        manifestPaths.public.push("analysis/bio_variants.md");
      if (artifactMap["faq"]) manifestPaths.public.push("analysis/faq.md");

      // Create the bundle (not published, pending review)
      const result: { bundleId: string; version: number } = await ctx.runMutation(
        internal.pipeline.mutations.createBundle,
        {
          userId: args.userId,
          manifest,
          youJson,
          youMd,
        }
      ) as { bundleId: string; version: number };

      return {
        success: true,
        bundleId: result.bundleId,
        version: result.version,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown compile error";
      return { success: false, error: message };
    }
  },
});

// ---------------------------------------------------------------------------
// Merge all extracted source data + analysis into ProfileData
// ---------------------------------------------------------------------------

interface SourceDoc {
  sourceType: string;
  extracted: Record<string, unknown> | null;
  sourceUrl: string;
  status: string;
}

function mergeToProfileData(
  username: string,
  sources: SourceDoc[],
  artifacts: Record<string, unknown>
): ProfileData {
  const extracted = sources
    .filter((s) => s.status === "extracted" && s.extracted)
    .reduce(
      (acc, s) => {
        acc[s.sourceType] = s.extracted as Record<string, unknown>;
        return acc;
      },
      {} as Record<string, Record<string, unknown>>
    );

  // Find primary name (prefer website, then LinkedIn, then X)
  const name =
    findField(extracted, "name", ["website", "linkedin", "x"]) ?? username;

  // Tagline
  const tagline =
    findField(extracted, "tagline", ["website"]) ??
    findField(extracted, "headline", ["linkedin"]) ??
    "";

  // Location
  const location = findField(extracted, "location", [
    "website",
    "linkedin",
    "x",
  ]);

  // Bio variants from analysis artifacts
  const bioVariants = artifacts["bio_variants"] as
    | Record<string, string>
    | undefined;

  // Projects: merge from all sources
  const projects: ProfileData["projects"] = [];
  for (const sourceType of Object.keys(extracted)) {
    const sourceProjects = extracted[sourceType]?.projects as
      | Array<Record<string, string>>
      | undefined;
    if (sourceProjects) {
      for (const p of sourceProjects) {
        // Avoid duplicates by name
        if (!projects.find((existing) => existing.name === p.name)) {
          projects.push({
            name: p.name,
            role: p.role ?? undefined,
            status: p.status ?? "active",
            url: p.url ?? undefined,
            description: p.description ?? undefined,
          });
        }
      }
    }
  }

  // Values
  const values = (findField(extracted, "values", ["website"]) as string[]) ?? [];

  // Links: merge from sources + source URLs
  const links: Record<string, string> = {};
  for (const s of sources) {
    if (s.sourceUrl) {
      links[s.sourceType] = s.sourceUrl;
    }
  }
  // Overlay extracted links
  const extractedLinks = extracted["website"]?.links as
    | Record<string, string>
    | undefined;
  if (extractedLinks) {
    Object.assign(links, extractedLinks);
  }

  // Voice / preferences from analysis
  const voice = artifacts["author_voice"] as Record<string, unknown> | undefined;
  const preferences: ProfileData["preferences"] = {};
  if (voice) {
    preferences.agent = {
      tone: (voice.tone as Record<string, string>)?.primary ?? "",
      formality: (voice.formality as string) ?? "casual-professional",
      avoid: (voice.vocabulary as Record<string, string[]>)?.avoid ?? [],
    };
    preferences.writing = {
      style:
        (voice.writing_style as Record<string, string>)?.sentence_structure ??
        "",
      format: "markdown preferred",
    };
  }

  // Analysis topics
  const topicMap = artifacts["topic_map"] as Record<string, unknown> | undefined;
  const topics = (
    topicMap?.primary_topics as Array<{ topic: string }> | undefined
  )?.map((t) => t.topic);

  // Credibility signals: merge from all sources
  const credibilitySignals: string[] = [];
  for (const sourceType of Object.keys(extracted)) {
    const signals = extracted[sourceType]?.credibility_signals as
      | string[]
      | undefined;
    if (signals) credibilitySignals.push(...signals);
  }

  // Now focus: try to extract from current roles / about
  const now: string[] = [];
  for (const p of projects) {
    if (p.status === "building" || p.status === "active") {
      now.push(
        `${p.name}${p.description ? ` — ${p.description}` : ""}`
      );
    }
  }

  return {
    name: name as string,
    username,
    tagline: tagline as string,
    location: (location as string) ?? undefined,
    bio: bioVariants
      ? {
          short: bioVariants.short,
          medium: bioVariants.medium,
          long: bioVariants.long,
        }
      : {
          short: (tagline as string) ?? "",
          medium: "",
          long: (findField(extracted, "bio", ["website", "linkedin"]) as string) ?? "",
        },
    now: now.length > 0 ? now : undefined,
    projects: projects.length > 0 ? projects : undefined,
    values: values.length > 0 ? values : undefined,
    links: Object.keys(links).length > 0 ? links : undefined,
    preferences,
    analysis: {
      topics: topics ?? [],
      voice_summary: (voice?.voice_summary as string) ?? "",
      credibility_signals: credibilitySignals,
    },
  };
}

// ---------------------------------------------------------------------------
// Utility: find a field across multiple source types (first match wins)
// ---------------------------------------------------------------------------

function findField(
  extracted: Record<string, Record<string, unknown>>,
  field: string,
  priority: string[]
): unknown {
  for (const sourceType of priority) {
    const val = extracted[sourceType]?.[field];
    if (val !== undefined && val !== null && val !== "") return val;
  }
  // Fallback: check any source
  for (const sourceType of Object.keys(extracted)) {
    const val = extracted[sourceType]?.[field];
    if (val !== undefined && val !== null && val !== "") return val;
  }
  return null;
}
