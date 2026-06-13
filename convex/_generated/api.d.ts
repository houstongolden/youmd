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
import type * as apiKeys from "../apiKeys.js";
import type * as auth from "../auth.js";
import type * as bundles from "../bundles.js";
import type * as chat from "../chat.js";
import type * as cleanup from "../cleanup.js";
import type * as consolidation from "../consolidation.js";
import type * as contextLinks from "../contextLinks.js";
import type * as crons from "../crons.js";
import type * as fleet from "../fleet.js";
import type * as github from "../github.js";
import type * as githubApp from "../githubApp.js";
import type * as githubAutoPush from "../githubAutoPush.js";
import type * as githubRepo from "../githubRepo.js";
import type * as health from "../health.js";
import type * as http from "../http.js";
import type * as lib_agentContext from "../lib/agentContext.js";
import type * as lib_agentDetect from "../lib/agentDetect.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_compile from "../lib/compile.js";
import type * as lib_githubPushApi from "../lib/githubPushApi.js";
import type * as lib_githubSync from "../lib/githubSync.js";
import type * as lib_hash from "../lib/hash.js";
import type * as lib_httpErrors from "../lib/httpErrors.js";
import type * as lib_idempotency from "../lib/idempotency.js";
import type * as lib_memoryCategories from "../lib/memoryCategories.js";
import type * as lib_openrouter from "../lib/openrouter.js";
import type * as lib_pagination from "../lib/pagination.js";
import type * as lib_profileDirectory from "../lib/profileDirectory.js";
import type * as lib_rateLimit from "../lib/rateLimit.js";
import type * as lib_scopes from "../lib/scopes.js";
import type * as lib_secretCrypto from "../lib/secretCrypto.js";
import type * as lib_secureToken from "../lib/secureToken.js";
import type * as lib_spendCap from "../lib/spendCap.js";
import type * as lib_writeLimits from "../lib/writeLimits.js";
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
import type * as portrait from "../portrait.js";
import type * as private_ from "../private.js";
import type * as profileIndexing from "../profileIndexing.js";
import type * as profiles from "../profiles.js";
import type * as scrape from "../scrape.js";
import type * as seed from "../seed.js";
import type * as skills from "../skills.js";
import type * as users from "../users.js";
import type * as vault from "../vault.js";
import type * as workflows from "../workflows.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  activity: typeof activity;
  apiKeys: typeof apiKeys;
  auth: typeof auth;
  bundles: typeof bundles;
  chat: typeof chat;
  cleanup: typeof cleanup;
  consolidation: typeof consolidation;
  contextLinks: typeof contextLinks;
  crons: typeof crons;
  fleet: typeof fleet;
  github: typeof github;
  githubApp: typeof githubApp;
  githubAutoPush: typeof githubAutoPush;
  githubRepo: typeof githubRepo;
  health: typeof health;
  http: typeof http;
  "lib/agentContext": typeof lib_agentContext;
  "lib/agentDetect": typeof lib_agentDetect;
  "lib/auth": typeof lib_auth;
  "lib/compile": typeof lib_compile;
  "lib/githubPushApi": typeof lib_githubPushApi;
  "lib/githubSync": typeof lib_githubSync;
  "lib/hash": typeof lib_hash;
  "lib/httpErrors": typeof lib_httpErrors;
  "lib/idempotency": typeof lib_idempotency;
  "lib/memoryCategories": typeof lib_memoryCategories;
  "lib/openrouter": typeof lib_openrouter;
  "lib/pagination": typeof lib_pagination;
  "lib/profileDirectory": typeof lib_profileDirectory;
  "lib/rateLimit": typeof lib_rateLimit;
  "lib/scopes": typeof lib_scopes;
  "lib/secretCrypto": typeof lib_secretCrypto;
  "lib/secureToken": typeof lib_secureToken;
  "lib/spendCap": typeof lib_spendCap;
  "lib/writeLimits": typeof lib_writeLimits;
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
  portrait: typeof portrait;
  private: typeof private_;
  profileIndexing: typeof profileIndexing;
  profiles: typeof profiles;
  scrape: typeof scrape;
  seed: typeof seed;
  skills: typeof skills;
  users: typeof users;
  vault: typeof vault;
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
