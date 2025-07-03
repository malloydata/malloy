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

describe('hierarchical dimensions summary', () => {
  test('hierarchical dimension expands to nested query structure', () => {
    const m = model`
      source: sales_data is a extend {
        dimension: region is astr
        dimension: country is astr
        dimension: city is astr
        measure: total_sales is ai.sum()
        measure: order_count is count()
        
        hierarchical_dimension: location_hierarchy is region, country, city
      }

      query: sales_by_location is sales_data -> {
        group_by: location_hierarchy
        aggregate: 
          total_sales
          order_count
      }
    `;
    
    expect(m).toTranslate();
    
    const translated = m.translator.translate();
    expect(translated.problems).toHaveLength(0);
    
    if (translated.modelDef) {
      const query = translated.modelDef.contents['sales_by_location'];
      
      if (query && 'pipeline' in query) {
        const segment = query.pipeline[0];
        
        if (segment && 'queryFields' in segment) {
          // Verify the top level has region, aggregates, and a nested query
          const topFields = segment.queryFields.map((f: any) => 
            f.type === 'fieldref' ? f.path[f.path.length - 1] : 
            f.type === 'turtle' ? `nest:${f.name}` : f.name
          );
          
          expect(topFields).toContain('region');
          expect(topFields).toContain('total_sales');
          expect(topFields).toContain('order_count');
          expect(topFields).toContain('nest:data');
          
          // Verify the nested structure
          const dataField = segment.queryFields.find((f: any) => f.type === 'turtle' && f.name === 'data');
          expect(dataField).toBeDefined();
          
          if (dataField && dataField.type === 'turtle' && 'queryFields' in dataField.pipeline[0]) {
            const level2Fields = dataField.pipeline[0].queryFields.map((f: any) =>
              f.type === 'fieldref' ? f.path[f.path.length - 1] : 
              f.type === 'turtle' ? `nest:${f.name}` : f.name
            );
            
            expect(level2Fields).toContain('country');
            expect(level2Fields).toContain('total_sales');
            expect(level2Fields).toContain('order_count');
            expect(level2Fields).toContain('nest:city_data');
            
            // Check the deepest level
            const cityDataField = dataField.pipeline[0].queryFields.find(
              (f: any) => f.type === 'turtle' && f.name === 'city_data'
            );
            
            if (cityDataField && cityDataField.type === 'turtle' && 'queryFields' in cityDataField.pipeline[0]) {
              const level3Fields = cityDataField.pipeline[0].queryFields.map((f: any) =>
                f.type === 'fieldref' ? f.path[f.path.length - 1] : f.name
              );
              
              expect(level3Fields).toContain('city');
              expect(level3Fields).toContain('total_sales');
              expect(level3Fields).toContain('order_count');
            }
          }
        }
      }
    }
  });
  
  test('hierarchical dimension with custom aggregates', () => {
    const m = model`
      source: product_data is a extend {
        dimension: category is astr
        dimension: subcategory is astr
        measure: revenue is ai.sum()
        measure: avg_price is ai.avg()
        
        hierarchical_dimension: product_hierarchy is category, subcategory
      }

      query: revenue_by_category is product_data -> {
        group_by: product_hierarchy
        aggregate: 
          revenue
          avg_price
          item_count is count()
      }
    `;
    
    expect(m).toTranslate();
  });
  
  test('hierarchical dimension validation', () => {
    // Test that referencing undefined fields fails
    const m = model`
      source: test_data is a extend {
        dimension: field1 is astr
        hierarchical_dimension: bad_hierarchy is field1, undefined_field
      }
    `;
    
    const translated = m.translator.translate();
    expect(translated.problems).toHaveLength(1);
    expect(translated.problems[0].message).toContain("'undefined_field' is not defined");
  });
});