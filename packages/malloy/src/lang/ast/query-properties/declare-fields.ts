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

import {AtomicFieldDeclaration} from '../query-items/field-declaration';
import {DefinitionList} from '../types/definition-list';
import {QueryBuilder} from '../types/query-builder';
import {
  LegalRefinementStage,
  QueryPropertyInterface,
} from '../types/query-property-interface';

export class DeclareFields
  extends DefinitionList<AtomicFieldDeclaration>
  implements QueryPropertyInterface
{
  elementType = 'declareFields';
  queryRefinementStage = LegalRefinementStage.Single;
  forceQueryClass = undefined;

  constructor(fields: AtomicFieldDeclaration[]) {
    super(fields);
  }

  queryExecute(executeFor: QueryBuilder): void {
    for (const qel of this.list) {
      executeFor.inputFS.extendSource(qel);
    }
  }
}
