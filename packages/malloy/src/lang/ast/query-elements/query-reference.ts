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

import {ErrorFactory} from '../error-factory';
import {MalloyElement, ModelEntryReference} from '../types/malloy-element';
import {QueryComp} from '../types/query-comp';
import {QueryHeadStruct} from './query-head-struct';
import {Query} from '../../../model/malloy_types';

export class QueryReference extends MalloyElement {
  elementType = 'query-reference';

  constructor(readonly name: ModelEntryReference) {
    super();
  }

  // TODO not using isRefOk
  queryComp(isRefOk: boolean): QueryComp {
    const headEntry = this.modelEntry(this.name);
    const head = headEntry?.entry;
    const oops = function () {
      return {
        refineInputStruct: ErrorFactory.structDef,
        outputStruct: ErrorFactory.structDef,
        query: ErrorFactory.query,
      };
    };
    if (!head) {
      this.log(`Reference to undefined query '${this.name.refString}'`);
      return oops();
    }
    if (head.type === 'query') {
      const queryHead = new QueryHeadStruct(head.structRef);
      this.has({queryHead: queryHead});
      const exploreStruct = queryHead.structDef();
      // TODO one of these is definitely wrong...
      return {
        query: head,
        outputStruct: exploreStruct,
        refineInputStruct: exploreStruct,
      };
    }
    this.log(`Illegal reference to '${this.name}', query expected`);
    return oops();
  }

  query(): Query {
    return this.queryComp(true).query;
  }
}
