/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as activity from "../activity.js";
import type * as agentBus from "../agentBus.js";
import type * as apiKeys from "../apiKeys.js";
import type * as auth from "../auth.js";
import type * as brainActivity from "../brainActivity.js";
import type * as bundles from "../bundles.js";
import type * as chat from "../chat.js";
import type * as cleanup from "../cleanup.js";
import type * as connectedApps from "../connectedApps.js";
import type * as consent from "../consent.js";
import type * as consolidation from "../consolidation.js";
import type * as contextLinks from "../contextLinks.js";
import type * as crons from "../crons.js";
import type * as dsi from "../dsi.js";
import type * as envHandoffs from "../envHandoffs.js";
import type * as fleet from "../fleet.js";
import type * as folderMd from "../folderMd.js";
import type * as github from "../github.js";
import type * as githubAgentSync from "../githubAgentSync.js";
import type * as githubApp from "../githubApp.js";
import type * as githubAutoPush from "../githubAutoPush.js";
import type * as githubProjects from "../githubProjects.js";
import type * as githubProjectsMutations from "../githubProjectsMutations.js";
import type * as githubProjectsPublic from "../githubProjectsPublic.js";
import type * as githubRepo from "../githubRepo.js";
import type * as health from "../health.js";
import type * as http from "../http.js";
import type * as lib_agentContext from "../lib/agentContext.js";
import type * as lib_agentDetect from "../lib/agentDetect.js";
import type * as lib_agentStackRepoSnapshot from "../lib/agentStackRepoSnapshot.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_brainScopes from "../lib/brainScopes.js";
import type * as lib_capabilityRouter from "../lib/capabilityRouter.js";
import type * as lib_compile from "../lib/compile.js";
import type * as lib_githubPushApi from "../lib/githubPushApi.js";
import type * as lib_githubSync from "../lib/githubSync.js";
import type * as lib_hash from "../lib/hash.js";
import type * as lib_httpErrors from "../lib/httpErrors.js";
import type * as lib_idempotency from "../lib/idempotency.js";
import type * as lib_mcpRegistry from "../lib/mcpRegistry.js";
import type * as lib_memoryCategories from "../lib/memoryCategories.js";
import type * as lib_openrouter from "../lib/openrouter.js";
import type * as lib_pagination from "../lib/pagination.js";
import type * as lib_portfolioRepoSnapshot from "../lib/portfolioRepoSnapshot.js";
import type * as lib_profileDirectory from "../lib/profileDirectory.js";
import type * as lib_rateLimit from "../lib/rateLimit.js";
import type * as lib_repoMirrorPolicy from "../lib/repoMirrorPolicy.js";
import type * as lib_scopes from "../lib/scopes.js";
import type * as lib_secretCrypto from "../lib/secretCrypto.js";
import type * as lib_secureToken from "../lib/secureToken.js";
import type * as lib_sentry from "../lib/sentry.js";
import type * as lib_sourceHashing from "../lib/sourceHashing.js";
import type * as lib_spendCap from "../lib/spendCap.js";
import type * as lib_writeLimits from "../lib/writeLimits.js";
import type * as loopReports from "../loopReports.js";
import type * as maintainer from "../maintainer.js";
import type * as me from "../me.js";
import type * as memories from "../memories.js";
import type * as migrations_backfillContentHash from "../migrations/backfillContentHash.js";
import type * as migrations_canonicalizeUsernames from "../migrations/canonicalizeUsernames.js";
import type * as migrations_normalizeMemoryCategories from "../migrations/normalizeMemoryCategories.js";
import type * as pipeline_analyze from "../pipeline/analyze.js";
import type * as pipeline_compile from "../pipeline/compile.js";
import type * as pipeline_extract from "../pipeline/extract.js";
import type * as pipeline_fetch from "../pipeline/fetch.js";
import type * as pipeline_index from "../pipeline/index.js";
import type * as pipeline_linkedin from "../pipeline/linkedin.js";
import type * as pipeline_mutations from "../pipeline/mutations.js";
import type * as pipeline_orchestrator from "../pipeline/orchestrator.js";
import type * as pipeline_portraitSource from "../pipeline/portraitSource.js";
import type * as pipeline_prompts from "../pipeline/prompts.js";
import type * as portfolio from "../portfolio.js";
import type * as portrait from "../portrait.js";
import type * as private_ from "../private.js";
import type * as profileIndexing from "../profileIndexing.js";
import type * as profiles from "../profiles.js";
import type * as realtimeSync from "../realtimeSync.js";
import type * as remoteCommands from "../remoteCommands.js";
import type * as scrape from "../scrape.js";
import type * as secretVault from "../secretVault.js";
import type * as seed from "../seed.js";
import type * as skills from "../skills.js";
import type * as sourceRefresh from "../sourceRefresh.js";
import type * as sourceRunPolicy from "../sourceRunPolicy.js";
import type * as stackSources from "../stackSources.js";
import type * as users from "../users.js";
import type * as vault from "../vault.js";
import type * as webhooks from "../webhooks.js";
import type * as workflows from "../workflows.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  activity: typeof activity;
  agentBus: typeof agentBus;
  apiKeys: typeof apiKeys;
  auth: typeof auth;
  brainActivity: typeof brainActivity;
  bundles: typeof bundles;
  chat: typeof chat;
  cleanup: typeof cleanup;
  connectedApps: typeof connectedApps;
  consent: typeof consent;
  consolidation: typeof consolidation;
  contextLinks: typeof contextLinks;
  crons: typeof crons;
  dsi: typeof dsi;
  envHandoffs: typeof envHandoffs;
  fleet: typeof fleet;
  folderMd: typeof folderMd;
  github: typeof github;
  githubAgentSync: typeof githubAgentSync;
  githubApp: typeof githubApp;
  githubAutoPush: typeof githubAutoPush;
  githubProjects: typeof githubProjects;
  githubProjectsMutations: typeof githubProjectsMutations;
  githubProjectsPublic: typeof githubProjectsPublic;
  githubRepo: typeof githubRepo;
  health: typeof health;
  http: typeof http;
  "lib/agentContext": typeof lib_agentContext;
  "lib/agentDetect": typeof lib_agentDetect;
  "lib/agentStackRepoSnapshot": typeof lib_agentStackRepoSnapshot;
  "lib/auth": typeof lib_auth;
  "lib/brainScopes": typeof lib_brainScopes;
  "lib/capabilityRouter": typeof lib_capabilityRouter;
  "lib/compile": typeof lib_compile;
  "lib/githubPushApi": typeof lib_githubPushApi;
  "lib/githubSync": typeof lib_githubSync;
  "lib/hash": typeof lib_hash;
  "lib/httpErrors": typeof lib_httpErrors;
  "lib/idempotency": typeof lib_idempotency;
  "lib/mcpRegistry": typeof lib_mcpRegistry;
  "lib/memoryCategories": typeof lib_memoryCategories;
  "lib/openrouter": typeof lib_openrouter;
  "lib/pagination": typeof lib_pagination;
  "lib/portfolioRepoSnapshot": typeof lib_portfolioRepoSnapshot;
  "lib/profileDirectory": typeof lib_profileDirectory;
  "lib/rateLimit": typeof lib_rateLimit;
  "lib/repoMirrorPolicy": typeof lib_repoMirrorPolicy;
  "lib/scopes": typeof lib_scopes;
  "lib/secretCrypto": typeof lib_secretCrypto;
  "lib/secureToken": typeof lib_secureToken;
  "lib/sentry": typeof lib_sentry;
  "lib/sourceHashing": typeof lib_sourceHashing;
  "lib/spendCap": typeof lib_spendCap;
  "lib/writeLimits": typeof lib_writeLimits;
  loopReports: typeof loopReports;
  maintainer: typeof maintainer;
  me: typeof me;
  memories: typeof memories;
  "migrations/backfillContentHash": typeof migrations_backfillContentHash;
  "migrations/canonicalizeUsernames": typeof migrations_canonicalizeUsernames;
  "migrations/normalizeMemoryCategories": typeof migrations_normalizeMemoryCategories;
  "pipeline/analyze": typeof pipeline_analyze;
  "pipeline/compile": typeof pipeline_compile;
  "pipeline/extract": typeof pipeline_extract;
  "pipeline/fetch": typeof pipeline_fetch;
  "pipeline/index": typeof pipeline_index;
  "pipeline/linkedin": typeof pipeline_linkedin;
  "pipeline/mutations": typeof pipeline_mutations;
  "pipeline/orchestrator": typeof pipeline_orchestrator;
  "pipeline/portraitSource": typeof pipeline_portraitSource;
  "pipeline/prompts": typeof pipeline_prompts;
  portfolio: typeof portfolio;
  portrait: typeof portrait;
  private: typeof private_;
  profileIndexing: typeof profileIndexing;
  profiles: typeof profiles;
  realtimeSync: typeof realtimeSync;
  remoteCommands: typeof remoteCommands;
  scrape: typeof scrape;
  secretVault: typeof secretVault;
  seed: typeof seed;
  skills: typeof skills;
  sourceRefresh: typeof sourceRefresh;
  sourceRunPolicy: typeof sourceRunPolicy;
  stackSources: typeof stackSources;
  users: typeof users;
  vault: typeof vault;
  webhooks: typeof webhooks;
  workflows: typeof workflows;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
