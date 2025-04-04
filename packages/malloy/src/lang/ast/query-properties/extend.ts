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

import type {QueryBuilder} from '../types/query-builder';
import {ListOf} from '../types/malloy-element';
import type {QueryExtendProperty} from '../types/query-extend-property';
import type {QueryPropertyInterface} from '../types/query-property-interface';
import {LegalRefinementStage} from '../types/query-property-interface';

export class ExtendBlock
  extends ListOf<QueryExtendProperty>
  implements QueryPropertyInterface
{
  elementType = 'extendBlock';
  forceQueryClass = undefined;
  queryRefinementStage = LegalRefinementStage.Single;

  queryExecute(executeFor: QueryBuilder): void {
    for (const block of this.list) {
      for (const qel of block.list) {
        executeFor.inputFS.extendSource(qel);
      }
    }
  }
}
