/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {SourceDef} from '../../../model/malloy_types';
import {mkQuerySourceDef} from '../../../model/source_def_utils';
import {Source} from './source';
import type {QueryElement} from '../types/query-element';
import type {ParameterSpace} from '../field-space/parameter-space';
import type {HasParameter} from '../parameters/has-parameter';
import {v4 as uuidv4} from 'uuid';

export class QuerySource extends Source {
  elementType = 'querySource';
  constructor(readonly query: QueryElement) {
    super({query});
  }

  getSourceDef(parameterSpace: ParameterSpace | undefined): SourceDef {
    return this.withParameters(parameterSpace, undefined);
  }

  withParameters(
    parameterSpace: ParameterSpace | undefined,
    pList: HasParameter[] | undefined
  ): SourceDef {
    const comp = this.query.queryComp(false);
    const queryStruct = mkQuerySourceDef(
      comp.outputStruct,
      comp.query,
      `QuerySource-${uuidv4()}`
    );
    return {
      ...queryStruct,
      parameters: this.packParameters(pList),
    };
  }
}
