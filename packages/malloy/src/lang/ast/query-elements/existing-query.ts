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

import {Query} from '../../../model/malloy_types';

import {PipelineDesc} from '../elements/pipeline-desc';
import {ErrorFactory} from '../error-factory';
import {StaticSpace} from '../field-space/static-space';
import {getFinalStruct} from '../struct-utils';
import {ModelEntryReference} from '../types/malloy-element';
import {QueryComp} from '../types/query-comp';
import {QueryHeadStruct} from './query-head-struct';

export class ExistingQuery extends PipelineDesc {
  elementType = 'exisitingQuery';
  _head?: ModelEntryReference | string;

  set head(head: ModelEntryReference | string | undefined) {
    this._head = head;
    if (head && typeof head !== 'string') {
      this.has({head: head});
    }
  }

  get head(): ModelEntryReference | string | undefined {
    return this._head;
  }

  queryComp(isRefOk: boolean): QueryComp {
    throw new Error('This class is deprecated');
  }

  query(): Query {
    return this.queryComp(true).query;
  }
}
