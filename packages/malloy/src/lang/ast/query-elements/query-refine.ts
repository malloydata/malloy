/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {StaticSourceSpace} from '../field-space/static-space';
import type {QueryComp} from '../types/query-comp';
import type {QueryElement} from '../types/query-element';
import type {View} from '../view-elements/view';
import {QueryBase} from './query-base';
import {computeQueryGivenUsage} from '../../composite-source-utils';

/**
 * A query operation that consists of an exisitng query with refinements.
 *
 * e.g. after `run:` in `run: flights_by_carrier + { limit: 10 }`
 */
export class QueryRefine extends QueryBase implements QueryElement {
  elementType = 'query-refine';

  constructor(
    readonly base: QueryElement,
    readonly refinement: View
  ) {
    super({base, refinement});
  }

  queryComp(isRefOk: boolean): QueryComp {
    const q = this.base.queryComp(isRefOk);
    const inputFS = new StaticSourceSpace(q.inputStruct, 'public');
    const pipeline = this.refinement.refine(
      inputFS,
      q.query.pipeline,
      undefined
    );
    const query = {
      ...q.query,
      pipeline,
    };

    const compositeResolvedSourceDef = this.resolveCompositeSource(
      q.inputStruct,
      pipeline
    );

    const pipelineWithExpandedFieldUsage = this.expandRefUsage(
      compositeResolvedSourceDef ?? q.inputStruct,
      pipeline
    );

    return {
      query: {
        ...query,
        compositeResolvedSourceDef,
        pipeline: pipelineWithExpandedFieldUsage,
        givenUsage: computeQueryGivenUsage(pipelineWithExpandedFieldUsage),
      },
      // TODO bleh
      outputStruct: pipeline[pipeline.length - 1].outputStruct,
      inputStruct: q.inputStruct,
    };
  }
}
