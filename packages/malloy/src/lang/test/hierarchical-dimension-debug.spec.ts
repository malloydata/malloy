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

import {model, markSource} from './test-translator';
import './parse-expects';

describe('hierarchical dimensions debug', () => {
  test('debug: check if hierarchical dimension is added to source', () => {
    const m = model`
      source: test_source is a extend {
        dimension: dim1 is astr
        dimension: dim2 is astr
        hierarchical_dimension: test_hierarchy is dim1, dim2
      }
    `;
    const translated = m.translate();
    console.log('Translation result:', translated);
    if (translated.modelDef) {
      const source = translated.modelDef.contents['test_source'];
      console.log('Source:', source);
      if (source && 'fields' in source) {
        console.log('Fields:', source.fields.map(f => f.name));
      }
    }
    expect(m).toTranslate();
  });

  test('debug: simple query with hierarchical dimension', () => {
    const m = model`
      source: test_source is a extend {
        dimension: dim1 is astr
        dimension: dim2 is astr
        hierarchical_dimension: test_hierarchy is dim1, dim2
      }

      query: test_query is test_source -> {
        group_by: dim1
      }
    `;
    expect(m).toTranslate();
  });
});