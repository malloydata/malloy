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

import {DefinitionList} from '../types/definition-list';
import type {QueryItem} from '../types/query-item';
import type {QueryPropertyInterface} from '../types/query-property-interface';
import {
  LegalRefinementStage,
  QueryClass,
} from '../types/query-property-interface';
import type {QueryBuilder} from '../types/query-builder';
import {FieldReference} from '../query-items/field-references';
import {HierarchicalDimensionField} from '../field-space/hierarchical-dimension-field';

export class GroupBy
  extends DefinitionList<QueryItem>
  implements QueryPropertyInterface
{
  elementType = 'groupBy';
  queryRefinementStage = LegalRefinementStage.Single;
  forceQueryClass = QueryClass.Grouping;

  queryExecute(executeFor: QueryBuilder): void {
    // Normal processing - add all fields
    executeFor.resultFS.pushFields(...this.list);
    
    // After adding fields, check if any field is a hierarchical dimension
    for (let i = 0; i < this.list.length; i++) {
      const item = this.list[i];
      if (item instanceof FieldReference) {
        // Check if this field reference points to a hierarchical dimension
        const entry = executeFor.inputFS.lookup(item.list);
        if (entry.found && entry.found instanceof HierarchicalDimensionField) {
          // Mark this query for hierarchical expansion
          if ('hierarchicalExpansion' in executeFor) {
            (executeFor as any).hierarchicalExpansion = {
              field: item,
              fieldIndex: i,
              dimension: entry.found.definition
            };
          }
          break;
        }
      }
    }
  }
}
