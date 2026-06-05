/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {PipeSegment} from '../../../model/malloy_types';
import type {QueryOperationSpace} from '../field-space/query-spaces';
import type {FieldSpace, SourceFieldSpace} from '../types/field-space';
import {MalloyElement} from '../types/malloy-element';
import type {PipelineComp} from '../types/pipeline-comp';

/**
 * A `View` represents a sequence of operations to be performed on a
 * source to generate a query. A `View` can generate a pipeline from
 * a given `FieldSpace`, or it can refine an exisitng pipeline.
 *
 * In Malloy code, a `View` represents any view or nest definition/reference,
 * or the part of a query after the first `->` or `+`.
 *
 * e.g. the part after the `is` in:
 *   `view: x is { group_by: carrier }`
 *   `view: x is by_carrier + { where: state = 'CA' }`
 * e.g. after the colon in `nest: by_carrier`
 * e.g. after the plus in `run: flights_by_carrier + { limit: 10 }`
 * e.g. after the arrow in `run: flights -> by_carrier`
 */
export abstract class View extends MalloyElement {
  abstract pipelineComp(
    fs: FieldSpace,
    isNestIn?: QueryOperationSpace
  ): PipelineComp;

  pipeline(fs: FieldSpace, isNestIn?: QueryOperationSpace): PipeSegment[] {
    return this.pipelineComp(fs, isNestIn).pipeline;
  }

  abstract refine(
    inputFS: SourceFieldSpace,
    pipeline: PipeSegment[],
    isNestIn: QueryOperationSpace | undefined
  ): PipeSegment[];

  abstract getImplicitName(): string | undefined;
}
