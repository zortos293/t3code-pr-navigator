/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as analysisJobs from "../analysisJobs.js";
import type * as commentCaches from "../commentCaches.js";
import type * as duplicates from "../duplicates.js";
import type * as issues from "../issues.js";
import type * as migration from "../migration.js";
import type * as model from "../model.js";
import type * as pullRequests from "../pullRequests.js";
import type * as relationships from "../relationships.js";
import type * as repos from "../repos.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  analysisJobs: typeof analysisJobs;
  commentCaches: typeof commentCaches;
  duplicates: typeof duplicates;
  issues: typeof issues;
  migration: typeof migration;
  model: typeof model;
  pullRequests: typeof pullRequests;
  relationships: typeof relationships;
  repos: typeof repos;
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
