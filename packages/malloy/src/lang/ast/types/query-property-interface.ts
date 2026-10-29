/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {QueryBuilder} from './query-builder';

export enum QueryClass {
  Index = 'index',
  Project = 'project',
  Grouping = 'grouping',
}

/**
 * A QueryProperty can have these responses to appearing in a refinement
 *   Head -- Legal in all queries, apply it to the first segment
 *   Tail -- Legal in all queries,, apply it to the last segment
 *   Single -- Only legal in queries with exactly one segment
 *   undefined -- Not legal in a refinement
 */
export enum LegalRefinementStage {
  Single,
  Head,
  Tail,
}

export interface QueryPropertyInterface {
  queryRefinementStage: LegalRefinementStage | undefined;
  forceQueryClass: QueryClass | undefined;
  statement?: string;
  // Edge case for `calculate:`, which needs a grouping or
  // project to decide what kind of query it is
  needsExplicitQueryClass?: boolean;
  queryExecute?: (executeFor: QueryBuilder) => void;
}
