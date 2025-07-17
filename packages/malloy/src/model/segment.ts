/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {
  SourceDef,
  PipeSegment,
  QueryResultDef,
  TurtleDef,
} from './malloy_types';
import {makeQueryModel} from './query_model';
import {QueryStruct} from './query_node';
import {QueryQuery} from './query_query';
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
    const qs = new QueryStruct(
      structDef,
      undefined,
      {
        model: makeQueryModel(undefined),
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
