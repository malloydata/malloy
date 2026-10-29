/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {Dialect} from '../dialect/dialect';
import type {PipeSegment} from './malloy_types';
import {isProjectSegment} from './malloy_types';

/**
 * Why the compiler can't emit a segment for a dialect. The translator maps each
 * reason to a located, user-facing message (these values are also parse-log
 * codes); the compiler throws a `MalloyCompileError` with the reason.
 */
export type NestUnsupported =
  | 'nesting-unsupported'
  | 'nested-multi-stage-unsupported'
  | 'nested-projection-limit-unsupported';

/**
 * How the compiler should emit one stage of a nest's pipeline — or, if the
 * dialect can't, why not. This is THE single decision shared by the two callers
 * that hold a dialect: the compiler (`generateTurtleSQL`) dispatches on `kind`
 * and reads `limit`; the translator (`nest.ts`) turns `unsupported` into a
 * located error. "How do I emit this" and "can I emit this" are one answer, so
 * neither side can drift from the other.
 *
 * It is a *segment* question, not a pipeline one. The compiler compiles the
 * first stage of a pipeline and recurses on the rest, so every stage is asked
 * in turn as "the first stage" — pipeline length is irrelevant. `hasSuccessor`
 * (is a stage materialized after this one?) is the only positional input, and
 * it is what the multi-stage gate keys on.
 *
 * The dialect-free half of this — "is this stage an inline projection?" — is a
 * plain `segment.type === 'project'`, used directly by the structural callers
 * (group_set assignment, where-clause placement) that legitimately have no
 * dialect; group_set numbering is not dialect-dependent.
 */
export type NestStrategy =
  | {kind: 'reduce'}
  | {kind: 'project'; limit: number | undefined}
  | {kind: 'unsupported'; reason: NestUnsupported};

export function nestStrategy(
  segment: PipeSegment,
  dialect: Dialect,
  hasSuccessor: boolean
): NestStrategy {
  if (!dialect.supportsNesting) {
    return {kind: 'unsupported', reason: 'nesting-unsupported'};
  }
  // A stage with another stage after it must be materialized as a nested
  // pipeline stage, which not every dialect can do inside a view.
  if (hasSuccessor && !dialect.supportsPipelinesInViews) {
    return {kind: 'unsupported', reason: 'nested-multi-stage-unsupported'};
  }
  if (isProjectSegment(segment)) {
    // A projection applies `limit:` by slicing its aggregated array; some
    // dialects can't slice an aggregate (see sqlAggregateTurtle).
    if (segment.limit !== undefined && !dialect.supportsNestedProjectionLimit) {
      return {
        kind: 'unsupported',
        reason: 'nested-projection-limit-unsupported',
      };
    }
    return {kind: 'project', limit: segment.limit};
  }
  return {kind: 'reduce'};
}
