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

import {model} from './test-translator';
import './parse-expects';

describe('hierarchical dimensions final test', () => {
  test('complete hierarchical dimension example', () => {
    const m = model`
      source: products is a extend {
        dimension: department is astr
        dimension: category is astr  
        dimension: subcategory is astr
        measure: total_cost is ai.sum()
        measure: product_count is count()
        
        hierarchical_dimension: product_hierarchy is department, category, subcategory
      }

      query: by_hierarchy is products -> {
        group_by: product_hierarchy
        aggregate: 
          total_cost
          product_count
        order_by: total_cost desc
      }
    `;
    
    const translated = m.translator.translate();
    expect(translated.problems).toHaveLength(0);
    
    if (translated.modelDef) {
      const query = translated.modelDef.contents['by_hierarchy'];
      expect(query).toBeDefined();
      
      if (query && 'pipeline' in query) {
        const segment = query.pipeline[0];
        
        if (segment && 'queryFields' in segment) {
          // Top level should have department, measures, and a nest
          const topFields = segment.queryFields.map((f: any) => 
            f.type === 'fieldref' ? f.path[f.path.length - 1] : 
            f.type === 'turtle' ? `nest:${f.name}` : f.name
          );
          
          expect(topFields).toContain('department');
          expect(topFields).toContain('total_cost');
          expect(topFields).toContain('product_count');
          expect(topFields).toContain('nest:data');
          
          // Check nested structure
          const dataField = segment.queryFields.find((f: any) => f.type === 'turtle' && f.name === 'data');
          if (dataField && dataField.type === 'turtle' && 'queryFields' in dataField.pipeline[0]) {
            const level2Fields = dataField.pipeline[0].queryFields.map((f: any) =>
              f.type === 'fieldref' ? f.path[f.path.length - 1] : 
              f.type === 'turtle' ? `nest:${f.name}` : f.name
            );
            
            expect(level2Fields).toContain('category');
            expect(level2Fields).toContain('total_cost');
            expect(level2Fields).toContain('product_count');
            expect(level2Fields).toContain('nest:subcategory_data');
            
            // Check deepest level
            const subcategoryDataField = dataField.pipeline[0].queryFields.find(
              (f: any) => f.type === 'turtle' && f.name === 'subcategory_data'
            );
            if (subcategoryDataField && subcategoryDataField.type === 'turtle' && 'queryFields' in subcategoryDataField.pipeline[0]) {
              const level3Fields = subcategoryDataField.pipeline[0].queryFields.map((f: any) =>
                f.type === 'fieldref' ? f.path[f.path.length - 1] : f.name
              );
              
              expect(level3Fields).toContain('subcategory');
              expect(level3Fields).toContain('total_cost');
              expect(level3Fields).toContain('product_count');
            }
          }
        }
      }
    }
  });
});