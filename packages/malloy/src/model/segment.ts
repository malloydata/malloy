/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {createQueryStruct, QueryModel, QueryQuery} from './malloy_query_index';
import type {
  SourceDef,
  PipeSegment,
  QueryResultDef,
  TurtleDef,
} from './malloy_types';
import {StageWriter} from './stage_writer';

/**
 * Used by the translator to get the output StructDef of a pipe segment
 *
 * half translated to the new world of types ..
 */
export class Segment {
  static nextStructDef(
    structDef: SourceDef,
    segment: PipeSegment
  ): QueryResultDef {
    const qs = createQueryStruct(
      structDef,
      undefined,
      {
        model: new QueryModel(undefined),
      },
      {}
    );
    const turtleDef: TurtleDef = {
      type: 'turtle',
      name: 'ignoreme',
      pipeline: [segment],
    };

    const queryQueryQuery = QueryQuery.makeQuery(
      turtleDef,
      qs,
      new StageWriter(true, undefined), // stage write indicates we want to get a result.
      false
    );
    return queryQueryQuery.getResultStructDef();
  }
}
