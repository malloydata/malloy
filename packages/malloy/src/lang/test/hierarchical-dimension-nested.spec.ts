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

describe('hierarchical dimensions nested structure', () => {
  test('generate nested structure for two-level hierarchy', () => {
    const m = model`
      source: test_source is a extend {
        dimension: dim1 is astr
        dimension: dim2 is astr
        measure: total_count is count()
        hierarchical_dimension: test_hierarchy is dim1, dim2
      }

      query: by_hierarchy is test_source -> {
        group_by: test_hierarchy
        aggregate: total_count
      }
    `;
    
    const translated = m.translator.translate();
    expect(translated.problems).toHaveLength(0);
    
    if (translated.modelDef) {
      const query = translated.modelDef.contents['by_hierarchy'];
      expect(query).toBeDefined();
      
      if (query && 'pipeline' in query) {
        const segment = query.pipeline[0];
        console.log('Query segment:', JSON.stringify(segment, null, 2));
        
        if (segment && 'queryFields' in segment) {
          // Check that we have the first dimension field
          const fieldNames = segment.queryFields.map((f: any) => 
            f.type === 'fieldref' ? f.path[f.path.length - 1] : 
            f.type === 'turtle' ? `nest:${f.name}` : f.name
          );
          
          console.log('Top level fields:', fieldNames);
          
          expect(fieldNames).toContain('dim1');
          expect(fieldNames).toContain('total_count');
          expect(fieldNames.some((n: string) => n.startsWith('nest:'))).toBe(true);
          
          // Check for the nested structure
          const nestField = segment.queryFields.find((f: any) => f.type === 'turtle');
          expect(nestField).toBeDefined();
          if (nestField && nestField.type === 'turtle') {
            expect(nestField.name).toBe('data');
            expect(nestField.pipeline).toBeDefined();
            if ('queryFields' in nestField.pipeline[0]) {
              expect(nestField.pipeline[0].queryFields).toBeDefined();
            }
          }
        }
      }
    }
  });

  test('generate nested structure for three-level hierarchy', () => {
    const m = model`
      source: test_source is a extend {
        dimension: dim1 is astr
        dimension: dim2 is astr
        dimension: dim3 is astr
        measure: total_cost is ai.sum()
        hierarchical_dimension: test_hierarchy is dim1, dim2, dim3
      }

      query: by_hierarchy is test_source -> {
        group_by: test_hierarchy
        aggregate: total_cost
        order_by: total_cost desc
      }
    `;
    
    const translated = m.translator.translate();
    expect(translated.problems).toHaveLength(0);
    
    if (translated.modelDef) {
      const query = translated.modelDef.contents['by_hierarchy'];
      if (query && 'pipeline' in query) {
        const segment = query.pipeline[0];
        console.log('Three-level query segment:', JSON.stringify(segment, null, 2));
        
        if (segment && 'queryFields' in segment) {
          // Check for nested structure
          const nestField = segment.queryFields.find((f: any) => f.type === 'turtle');
          expect(nestField).toBeDefined();
          
          if (nestField && nestField.type === 'turtle' && nestField.pipeline && nestField.pipeline[0]) {
            const nestedSegment = nestField.pipeline[0];
            if ('queryFields' in nestedSegment) {
              expect(nestedSegment.queryFields).toBeDefined();
              
              // Check for deeper nesting
              const deeperNest = nestedSegment.queryFields.find((f: any) => f.type === 'turtle');
              expect(deeperNest).toBeDefined();
            }
          }
        }
      }
    }
  });
});