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
import type * as bundles from "../bundles.js";
import type * as chat from "../chat.js";
import type * as cleanup from "../cleanup.js";
import type * as contextLinks from "../contextLinks.js";
import type * as http from "../http.js";
import type * as lib_agentDetect from "../lib/agentDetect.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_compile from "../lib/compile.js";
import type * as lib_hash from "../lib/hash.js";
import type * as lib_openrouter from "../lib/openrouter.js";
import type * as lib_rateLimit from "../lib/rateLimit.js";
import type * as lib_spendCap from "../lib/spendCap.js";
import type * as me from "../me.js";
import type * as memories from "../memories.js";
import type * as migrations_backfillContentHash from "../migrations/backfillContentHash.js";
import type * as pipeline_analyze from "../pipeline/analyze.js";
import type * as pipeline_compile from "../pipeline/compile.js";
import type * as pipeline_extract from "../pipeline/extract.js";
import type * as pipeline_fetch from "../pipeline/fetch.js";
import type * as pipeline_index from "../pipeline/index.js";
import type * as pipeline_linkedin from "../pipeline/linkedin.js";
import type * as pipeline_mutations from "../pipeline/mutations.js";
import type * as pipeline_orchestrator from "../pipeline/orchestrator.js";
import type * as pipeline_prompts from "../pipeline/prompts.js";
import type * as portrait from "../portrait.js";
import type * as private_ from "../private.js";
import type * as profiles from "../profiles.js";
import type * as scrape from "../scrape.js";
import type * as seed from "../seed.js";
import type * as skills from "../skills.js";
import type * as users from "../users.js";
import type * as vault from "../vault.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  activity: typeof activity;
  apiKeys: typeof apiKeys;
  bundles: typeof bundles;
  chat: typeof chat;
  cleanup: typeof cleanup;
  contextLinks: typeof contextLinks;
  http: typeof http;
  "lib/agentDetect": typeof lib_agentDetect;
  "lib/auth": typeof lib_auth;
  "lib/compile": typeof lib_compile;
  "lib/hash": typeof lib_hash;
  "lib/openrouter": typeof lib_openrouter;
  "lib/rateLimit": typeof lib_rateLimit;
  "lib/spendCap": typeof lib_spendCap;
  me: typeof me;
  memories: typeof memories;
  "migrations/backfillContentHash": typeof migrations_backfillContentHash;
  "pipeline/analyze": typeof pipeline_analyze;
  "pipeline/compile": typeof pipeline_compile;
  "pipeline/extract": typeof pipeline_extract;
  "pipeline/fetch": typeof pipeline_fetch;
  "pipeline/index": typeof pipeline_index;
  "pipeline/linkedin": typeof pipeline_linkedin;
  "pipeline/mutations": typeof pipeline_mutations;
  "pipeline/orchestrator": typeof pipeline_orchestrator;
  "pipeline/prompts": typeof pipeline_prompts;
  portrait: typeof portrait;
  private: typeof private_;
  profiles: typeof profiles;
  scrape: typeof scrape;
  seed: typeof seed;
  skills: typeof skills;
  users: typeof users;
  vault: typeof vault;
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
