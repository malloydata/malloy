/*
 * Copyright 2023 Google LLC
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files
 * (the "Software"), to deal in the Software without restriction,
 * including without limitation the rights to use, copy, modify, merge,
 * publish, distribute, sublicense, and/or sell copies of the Software,
 * and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import {StructDef, StructSource} from '../../../model/malloy_types';
import {Source} from './source';
import {QueryElement} from '../types/query-element';
import {ParameterSpace} from '../field-space/parameter-space';
import { HasParameter } from '../parameters/has-parameter';

export class QuerySource extends Source {
  elementType = 'querySource';
  constructor(readonly query: QueryElement) {
    super({query});
  }

  structDef(parameterSpace: ParameterSpace | undefined): StructDef {
    return this.withParameters(parameterSpace, undefined);
  }

  withParameters(
    parameterSpace: ParameterSpace | undefined,
    pList: HasParameter[] | undefined
  ): StructDef {
    const paramSpace = pList ? new ParameterSpace(pList) : parameterSpace;
    const comp = this.query.queryComp(paramSpace, false);
    const queryStruct = {
      ...comp.outputStruct,
      structSource: {type: 'query', query: comp.query} as StructSource,
    };
    // TODO test this
    if (comp.query.sourceArguments !== undefined) {
      queryStruct.arguments = comp.query.sourceArguments;
    }
    this.document()?.rememberToAddModelAnnotations(queryStruct);
    return {
      ...queryStruct,
      parameters: this.packParameters(pList)
    };
  }
}
