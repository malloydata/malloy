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

import {markSource} from './test-translator';
import './parse-expects';

describe('lenses', () => {
  test('long lens patterns', () => {
    expect(
      markSource`
        source: s1 is a extend {
          view: v1 is { group_by: d1 is 1 }
          view: v2 is { group_by: d2 is 2 }
          view: v3 is { group_by: d3 is 3 }
          view: v4 is v1 + v2 + v3
          view: v5 is {
            nest: n1 is v1 + v2 + v3
            nest: n2 is { group_by: d1 is 1 } + v2 + v3
            nest: n3 is v1 + v2 + { group_by: d3 is 3 }
          }
          view: v6 is { group_by: d1 is 1 } + v2 + v3
        }
        run: s1 -> v4
        source: s2 is s1 -> v1 + v2 + v3
        source: s3 is s1 -> { group_by: d1 is 1 } + v2 + v3
      `
    ).toTranslate();
  });
  test('cannot have overlapping names', () => {
    expect(
      markSource`
        source: x is a extend {
          dimension: n is 1
          view: d is { group_by: n }
        }
        run: x -> d + d
      `
    ).translationToFailWith('overlapping fields in refinement: n');
  });
  test('cannot override limit', () => {
    expect(
      markSource`
        source: x is a extend {
          view: d1 is { group_by: n1 is 1; limit: 10 }
          view: d2 is { group_by: n2 is 2; limit: 20 }
        }
        run: x -> d1 + d2
      `
    ).translationToFailWith('refinement cannot override existing limit');
  });
  test('cannot override ordering', () => {
    expect(
      markSource`
        source: x is a extend {
          view: d1 is { group_by: n1 is 1; order_by: n1 }
          view: d2 is { group_by: n2 is 2; order_by: n2 }
        }
        run: x -> d1 + d2
      `
    ).translationToFailWith('refinement cannot override existing ordering');
  });
  test('can add a limit late', () => {
    expect(
      markSource`
        source: x is a extend {
          view: d1 is { group_by: n1 is 1 }
          view: d2 is { group_by: n2 is 2 }
        }
        run: x -> d1 + d2 + { limit: 10 }
      `
    ).toTranslate();
  });
  test('cannot refine with incompatible view types', () => {
    expect(
      markSource`
        source: x is a extend {
          view: grp is { group_by: n1 is 1 }
          view: proj is { select: n2 is 2 }
          view: idx is { index: * }
        }
        run: x -> grp + proj
        run: x -> grp + idx
        run: x -> proj + idx
        run: x -> proj + grp
        run: x -> idx + grp
        run: x -> idx + proj
      `
    ).translationToFailWith(
      'cannot refine reduce view with project view',
      'cannot refine reduce view with index view',
      'cannot refine project view with index view',
      'cannot refine project view with reduce view',
      'cannot refine index view with reduce view',
      'cannot refine index view with project view'
    );
  });
  test('cannot reference dimension', () => {
    expect(
      markSource`
        source: x is a extend {
          dimension: n is 1
          view: d is { group_by: n }
        }
        run: x -> d + n
      `
    ).translationToFailWith(
      'named refinement `n` must be a view, found a number'
    );
  });
  test('cannot reference join', () => {
    expect(
      markSource`
        source: x is a extend {
          join_one: b is a on true
          dimension: n is 1
          view: d is { group_by: n }
        }
        run: x -> d + b
      `
    ).translationToFailWith(
      'named refinement `b` must be a view, found a struct'
    );
  });
  test('cannot named-refine multi-stage query', () => {
    expect(
      markSource`
        source: x is a extend {
          join_one: b is a on true
          dimension: n is 1
          view: multi is { group_by: n } -> { group_by: n }
          view: d is { group_by: n }
        }
        run: x -> multi + d
        run: x -> d + multi
      `
    ).translationToFailWith(
      'Named refinements of multi-stage views are not supported',
      'named refinement `multi` must have exactly one stage'
    );
  });
});
