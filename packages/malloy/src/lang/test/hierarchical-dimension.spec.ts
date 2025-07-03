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

describe('hierarchical dimensions', () => {
  test('parse hierarchical dimension declaration', () => {
    expect(`
      source: test_source is a extend {
        dimension: dim1 is astr
        dimension: dim2 is astr
        hierarchical_dimension: test_hierarchy is dim1, dim2
      }
    `).toTranslate();
  });

  test('parse hierarchical dimension with multiple fields', () => {
    expect(`
      source: test_source is a extend {
        dimension: dim1 is astr
        dimension: dim2 is astr
        dimension: dim3 is astr
        hierarchical_dimension: test_hierarchy is dim1, dim2, dim3
      }
    `).toTranslate();
  });

  test('use hierarchical dimension in group_by', () => {
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
    expect(m).toTranslate();
  });

  test('hierarchical dimension with tags', () => {
    expect(`
      source: test_source is a extend {
        dimension: dim1 is astr
        dimension: dim2 is astr
        # test-hierarchy
        hierarchical_dimension: test_hierarchy is dim1, dim2
      }
    `).toTranslate();
  });

  test('hierarchical dimension with access modifiers', () => {
    expect(`
      source: test_source is a extend {
        dimension: dim1 is astr
        dimension: dim2 is astr
        private hierarchical_dimension: test_hierarchy is dim1, dim2
      }
    `).toTranslate();
  });

  test('reference undefined field in hierarchical dimension', () => {
    expect(`
      source: test_source is a extend {
        dimension: dim1 is astr
        hierarchical_dimension: test_hierarchy is dim1, undefined_field
      }
    `).not.toTranslate();
  });
});