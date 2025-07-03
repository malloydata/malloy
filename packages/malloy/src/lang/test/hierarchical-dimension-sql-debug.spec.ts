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

describe('hierarchical dimensions SQL generation debug', () => {
  test('compare manual nested query vs hierarchical dimension', () => {
    // First, let's see how a manually written nested query works
    const manualNested = model`
      source: test_source is a extend {
        dimension: one is astr
        dimension: two is astr
        measure: total is count()
      }

      query: manual_nested is test_source -> {
        group_by: one
        aggregate: total
        nest: data is {
          group_by: two
          aggregate: total
        }
      }
    `;
    
    const manualTranslated = manualNested.translator.translate();
    console.log('Manual nested problems:', manualTranslated.problems);
    
    if (manualTranslated.modelDef) {
      const query = manualTranslated.modelDef.contents['manual_nested'];
      console.log('Manual nested query structure:', JSON.stringify(query, null, 2));
    }
    
    // Now let's see how our hierarchical dimension generates the query
    const hierarchical = model`
      source: test_source is a extend {
        dimension: one is astr
        dimension: two is astr
        measure: total is count()
        hierarchical_dimension: hier is one, two
      }

      query: hierarchical_nested is test_source -> {
        group_by: hier
        aggregate: total
      }
    `;
    
    const hierarchicalTranslated = hierarchical.translator.translate();
    console.log('Hierarchical problems:', hierarchicalTranslated.problems);
    
    if (hierarchicalTranslated.modelDef) {
      const query = hierarchicalTranslated.modelDef.contents['hierarchical_nested'];
      console.log('Hierarchical query structure:', JSON.stringify(query, null, 2));
    }
    
    expect(manualTranslated.problems).toHaveLength(0);
    expect(hierarchicalTranslated.problems).toHaveLength(0);
  });
});