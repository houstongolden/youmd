/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as apiKeys from "../apiKeys.js";
import type * as bundles from "../bundles.js";
import type * as chat from "../chat.js";
import type * as cleanup from "../cleanup.js";
import type * as contextLinks from "../contextLinks.js";
import type * as debug_check from "../debug_check.js";
import type * as http from "../http.js";
import type * as lib_compile from "../lib/compile.js";
import type * as me from "../me.js";
import type * as memories from "../memories.js";
import type * as pipeline_analyze from "../pipeline/analyze.js";
import type * as pipeline_compile from "../pipeline/compile.js";
import type * as pipeline_extract from "../pipeline/extract.js";
import type * as pipeline_fetch from "../pipeline/fetch.js";
import type * as pipeline_index from "../pipeline/index.js";
import type * as pipeline_linkedin from "../pipeline/linkedin.js";
import type * as pipeline_mutations from "../pipeline/mutations.js";
import type * as pipeline_orchestrator from "../pipeline/orchestrator.js";
import type * as pipeline_prompts from "../pipeline/prompts.js";
import type * as private_ from "../private.js";
import type * as profiles from "../profiles.js";
import type * as scrape from "../scrape.js";
import type * as seed from "../seed.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  apiKeys: typeof apiKeys;
  bundles: typeof bundles;
  chat: typeof chat;
  cleanup: typeof cleanup;
  contextLinks: typeof contextLinks;
  debug_check: typeof debug_check;
  http: typeof http;
  "lib/compile": typeof lib_compile;
  me: typeof me;
  memories: typeof memories;
  "pipeline/analyze": typeof pipeline_analyze;
  "pipeline/compile": typeof pipeline_compile;
  "pipeline/extract": typeof pipeline_extract;
  "pipeline/fetch": typeof pipeline_fetch;
  "pipeline/index": typeof pipeline_index;
  "pipeline/linkedin": typeof pipeline_linkedin;
  "pipeline/mutations": typeof pipeline_mutations;
  "pipeline/orchestrator": typeof pipeline_orchestrator;
  "pipeline/prompts": typeof pipeline_prompts;
  private: typeof private_;
  profiles: typeof profiles;
  scrape: typeof scrape;
  seed: typeof seed;
  users: typeof users;
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
