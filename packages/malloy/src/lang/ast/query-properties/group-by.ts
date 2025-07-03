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
import {FieldReference, ExpressionFieldReference} from '../query-items/field-references';
import {HierarchicalDimensionField} from '../field-space/hierarchical-dimension-field';
import {FieldName} from '../types/field-space';
import {SpaceField} from '../types/space-field';

export class GroupBy
  extends DefinitionList<QueryItem>
  implements QueryPropertyInterface
{
  elementType = 'groupBy';
  queryRefinementStage = LegalRefinementStage.Single;
  forceQueryClass = QueryClass.Grouping;

  queryExecute(executeFor: QueryBuilder): void {
    // Process each item, expanding hierarchical dimensions
    const expandedItems: QueryItem[] = [];
    let hierarchicalInfo: {fields: string[], item: FieldReference} | undefined;
    
    for (const item of this.list) {
      if (item instanceof FieldReference) {
        // Check if this field reference points to a hierarchical dimension
        const entry = executeFor.inputFS.lookup(item.list);
        
        // Check if the field has hierarchical dimension annotation
        let isHierarchical = false;
        let hierarchicalFields: string[] = [];
        
        if (entry.found && entry.found instanceof SpaceField) {
          const fieldDef = entry.found.fieldDef?.();
          if (fieldDef?.annotation?.notes) {
            for (const note of fieldDef.annotation.notes) {
              if (note.text.startsWith('hierarchical_dimension:')) {
                isHierarchical = true;
                hierarchicalFields = note.text.substring('hierarchical_dimension:'.length).split(',');
                break;
              }
            }
          }
        }
        
        if (isHierarchical && hierarchicalFields.length > 0) {
          // Store hierarchical info for nested query generation
          hierarchicalInfo = {fields: hierarchicalFields, item};
          
          // Expand the hierarchical dimension to its constituent fields
          for (const fieldName of hierarchicalFields) {
            expandedItems.push(new ExpressionFieldReference([new FieldName(fieldName)]));
          }
        } else if (entry.found instanceof HierarchicalDimensionField) {
          // This case handles when we have the actual HierarchicalDimensionField instance
          const hierarchicalDim = entry.found.definition;
          hierarchicalInfo = {
            fields: hierarchicalDim.fields.map(f => f.outputName),
            item
          };
          expandedItems.push(...hierarchicalDim.fields);
        } else {
          // Regular field
          expandedItems.push(item);
        }
      } else {
        // Not a field reference
        expandedItems.push(item);
      }
    }
    
    // Add all expanded fields
    executeFor.resultFS.pushFields(...expandedItems);
    
    // If this is a reduce query with hierarchical dimensions, store info for nesting
    if (hierarchicalInfo && executeFor.type === 'grouping') {
      const reduceBuilder = executeFor as any;
      reduceBuilder.hierarchicalDimension = {
        fields: hierarchicalInfo.fields
      };
    }
  }
}
