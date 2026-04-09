import { internalMutation } from "./_generated/server";

/**
 * Cycle 45: APOCALYPTIC P0 fix. This was previously `mutation` which made it
 * a public endpoint — any anonymous caller could `curl /api/mutation` with
 * `path: "cleanup:clearAllData"` and **DELETE EVERY ROW IN EVERY TABLE** in
 * the production database.
 *
 * Now `internalMutation` — callable only from other Convex functions or via
 * Convex Dashboard / `npx convex run --component-function`. Public callers
 * cannot reach it. The function is destructive admin-only tooling and was
 * never meant to be publicly callable.
 */
export const clearAllData = internalMutation({
  handler: async (ctx) => {
    const counts: Record<string, number> = {};

    const users = await ctx.db.query("users").collect();
    for (const doc of users) await ctx.db.delete(doc._id);
    counts.users = users.length;

    const profiles = await ctx.db.query("profiles").collect();
    for (const doc of profiles) await ctx.db.delete(doc._id);
    counts.profiles = profiles.length;

    const bundles = await ctx.db.query("bundles").collect();
    for (const doc of bundles) await ctx.db.delete(doc._id);
    counts.bundles = bundles.length;

    const sources = await ctx.db.query("sources").collect();
    for (const doc of sources) await ctx.db.delete(doc._id);
    counts.sources = sources.length;

    const apiKeys = await ctx.db.query("apiKeys").collect();
    for (const doc of apiKeys) await ctx.db.delete(doc._id);
    counts.apiKeys = apiKeys.length;

    const contextLinks = await ctx.db.query("contextLinks").collect();
    for (const doc of contextLinks) await ctx.db.delete(doc._id);
    counts.contextLinks = contextLinks.length;

    const profileViews = await ctx.db.query("profileViews").collect();
    for (const doc of profileViews) await ctx.db.delete(doc._id);
    counts.profileViews = profileViews.length;

    const securityLogs = await ctx.db.query("securityLogs").collect();
    for (const doc of securityLogs) await ctx.db.delete(doc._id);
    counts.securityLogs = securityLogs.length;

    const privateContext = await ctx.db.query("privateContext").collect();
    for (const doc of privateContext) await ctx.db.delete(doc._id);
    counts.privateContext = privateContext.length;

    const accessTokens = await ctx.db.query("accessTokens").collect();
    for (const doc of accessTokens) await ctx.db.delete(doc._id);
    counts.accessTokens = accessTokens.length;

    const agentInteractions = await ctx.db.query("agentInteractions").collect();
    for (const doc of agentInteractions) await ctx.db.delete(doc._id);
    counts.agentInteractions = agentInteractions.length;

    const pipelineJobs = await ctx.db.query("pipelineJobs").collect();
    for (const doc of pipelineJobs) await ctx.db.delete(doc._id);
    counts.pipelineJobs = pipelineJobs.length;

    const analysisArtifacts = await ctx.db.query("analysisArtifacts").collect();
    for (const doc of analysisArtifacts) await ctx.db.delete(doc._id);
    counts.analysisArtifacts = analysisArtifacts.length;

    const profileReports = await ctx.db.query("profileReports").collect();
    for (const doc of profileReports) await ctx.db.delete(doc._id);
    counts.profileReports = profileReports.length;

    const profileVerifications = await ctx.db.query("profileVerifications").collect();
    for (const doc of profileVerifications) await ctx.db.delete(doc._id);
    counts.profileVerifications = profileVerifications.length;

    return { deleted: counts };
  },
});
