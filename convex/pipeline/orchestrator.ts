"use node";

import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";

// ---------------------------------------------------------------------------
// Source types that require Apify vs native fetch
// ---------------------------------------------------------------------------

const APIFY_SOURCE_TYPES = new Set(["linkedin", "x"]);

// ---------------------------------------------------------------------------
// runPipeline — Main orchestrator. Runs the full pipeline for a user.
// ---------------------------------------------------------------------------

export const runPipeline = internalAction({
  args: {
    userId: v.id("users"),
    username: v.string(),
  },
  handler: async (ctx, args): Promise<
    { success: true; bundleId: string; version: number } | { success: false; error: string }
  > => {
    const { userId, username } = args;

    // -----------------------------------------------------------------------
    // Stage 1: FETCH — Fetch all pending sources
    // -----------------------------------------------------------------------
    const fetchJobId = await ctx.runMutation(
      internal.pipeline.mutations.createPipelineJob,
      { userId, stage: "fetch" }
    );

    await ctx.runMutation(internal.pipeline.mutations.updatePipelineJob, {
      jobId: fetchJobId,
      status: "running",
    });

    try {
      const sources = await ctx.runMutation(
        internal.pipeline.mutations.getSourcesByUserId,
        { userId }
      );

      const pendingSources = sources.filter(
        (s: { status: string }) =>
          s.status === "pending" || s.status === "failed"
      );

      // Fetch each source (sequentially to avoid rate limits)
      for (const source of pendingSources) {
        if (APIFY_SOURCE_TYPES.has(source.sourceType)) {
          await ctx.runAction(internal.pipeline.fetch.fetchWithApify, {
            sourceId: source._id,
            sourceType: source.sourceType,
            url: source.sourceUrl,
            userId,
          });
        } else {
          await ctx.runAction(internal.pipeline.fetch.fetchWebsite, {
            sourceId: source._id,
            url: source.sourceUrl,
            userId,
          });
        }
      }

      await ctx.runMutation(internal.pipeline.mutations.updatePipelineJob, {
        jobId: fetchJobId,
        status: "completed",
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Fetch stage failed";
      await ctx.runMutation(internal.pipeline.mutations.updatePipelineJob, {
        jobId: fetchJobId,
        status: "failed",
        errorMessage: message,
      });
      // Continue pipeline — some sources may have succeeded
    }

    // -----------------------------------------------------------------------
    // Stage 2: EXTRACT — Extract structured data from fetched sources
    // -----------------------------------------------------------------------
    const extractJobId = await ctx.runMutation(
      internal.pipeline.mutations.createPipelineJob,
      { userId, stage: "extract" }
    );

    await ctx.runMutation(internal.pipeline.mutations.updatePipelineJob, {
      jobId: extractJobId,
      status: "running",
    });

    try {
      // Re-fetch sources to get updated statuses
      const updatedSources = await ctx.runMutation(
        internal.pipeline.mutations.getSourcesByUserId,
        { userId }
      );

      const fetchedSources = updatedSources.filter(
        (s: { status: string }) => s.status === "fetched"
      );

      for (const source of fetchedSources) {
        // Get the raw text stored during fetch
        const rawText =
          (source.extracted as Record<string, string>)?._rawText ?? "";

        if (!rawText) continue;

        await ctx.runAction(internal.pipeline.extract.extractFromSource, {
          sourceId: source._id,
          sourceType: source.sourceType,
          rawText,
          userId,
        });
      }

      await ctx.runMutation(internal.pipeline.mutations.updatePipelineJob, {
        jobId: extractJobId,
        status: "completed",
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Extract stage failed";
      await ctx.runMutation(internal.pipeline.mutations.updatePipelineJob, {
        jobId: extractJobId,
        status: "failed",
        errorMessage: message,
      });
    }

    // -----------------------------------------------------------------------
    // Stage 3: ANALYZE — Run all analysis actions
    // -----------------------------------------------------------------------
    const analyzeJobId = await ctx.runMutation(
      internal.pipeline.mutations.createPipelineJob,
      { userId, stage: "analyze" }
    );

    await ctx.runMutation(internal.pipeline.mutations.updatePipelineJob, {
      jobId: analyzeJobId,
      status: "running",
    });

    try {
      // Re-fetch to get extracted data
      const extractedSources = await ctx.runMutation(
        internal.pipeline.mutations.getSourcesByUserId,
        { userId }
      );

      const successfulSources = extractedSources
        .filter((s: { status: string }) => s.status === "extracted")
        .map(
          (s) => ({
            sourceType: s.sourceType,
            extracted: s.extracted ?? null,
          })
        );

      if (successfulSources.length === 0) {
        throw new Error("No sources were successfully extracted");
      }

      // Run all analysis actions (these can run concurrently but we run
      // sequentially for simplicity and to avoid OpenRouter rate limits)
      await ctx.runAction(internal.pipeline.analyze.analyzeVoice, {
        userId,
        extractedSources: successfulSources,
      });

      await ctx.runAction(internal.pipeline.analyze.analyzeTopics, {
        userId,
        extractedSources: successfulSources,
      });

      await ctx.runAction(internal.pipeline.analyze.generateBioVariants, {
        userId,
        extractedSources: successfulSources,
      });

      await ctx.runAction(internal.pipeline.analyze.generateFaq, {
        userId,
        extractedSources: successfulSources,
      });

      await ctx.runMutation(internal.pipeline.mutations.updatePipelineJob, {
        jobId: analyzeJobId,
        status: "completed",
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Analyze stage failed";
      await ctx.runMutation(internal.pipeline.mutations.updatePipelineJob, {
        jobId: analyzeJobId,
        status: "failed",
        errorMessage: message,
      });
      // If analysis fails, we can still attempt compilation with what we have
    }

    // -----------------------------------------------------------------------
    // Stage 4: COMPILE — Compile everything into a bundle
    // -----------------------------------------------------------------------
    const compileJobId = await ctx.runMutation(
      internal.pipeline.mutations.createPipelineJob,
      { userId, stage: "compile" }
    );

    await ctx.runMutation(internal.pipeline.mutations.updatePipelineJob, {
      jobId: compileJobId,
      status: "running",
    });

    try {
      const result = await ctx.runAction(
        internal.pipeline.compile.compileBundleFromPipeline,
        { userId, username }
      ) as { success: boolean; bundleId?: string; version?: number; error?: string };

      if (!result.success) {
        throw new Error(result.error ?? "Compilation failed");
      }

      await ctx.runMutation(internal.pipeline.mutations.updatePipelineJob, {
        jobId: compileJobId,
        status: "completed",
      });

      // Create a review job to signal the pipeline is complete
      await ctx.runMutation(internal.pipeline.mutations.createPipelineJob, {
        userId,
        stage: "review",
      });

      return {
        success: true as const,
        bundleId: result.bundleId!,
        version: result.version!,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Compile stage failed";
      await ctx.runMutation(internal.pipeline.mutations.updatePipelineJob, {
        jobId: compileJobId,
        status: "failed",
        errorMessage: message,
      });
      return { success: false, error: message };
    }
  },
});
