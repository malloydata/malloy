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
  test('cannot reference dimension at head of query ', () => {
    expect(
      markSource`
        source: x is a extend {
          dimension: n is 1
          view: d is { group_by: n1 is 1 }
        }
        run: x -> n + d
      `
    ).translationToFailWith("'n' is not a query");
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
  test('can reference dimension at head of query when experiment is enabled', () => {
    expect(
      markSource`
        ##! experimental { scalar_lenses }
        source: x is a extend {
          dimension: n is 1
        }
        run: x -> n
      `
    ).toTranslate();
  });
  test('can reference dimension in refinement when experiment is enabled', () => {
    expect(
      markSource`
        ##! experimental { scalar_lenses }
        source: x is a extend {
          dimension: n is 1
          view: d is { group_by: n1 is 1 }
        }
        run: x -> d + n
      `
    ).toTranslate();
  });
  test('can reference join field when experiment is enabled', () => {
    expect(
      markSource`
        ##! experimental { scalar_lenses }
        source: x is a extend {
          join_cross: y is a extend { dimension: n is 1 } on true
        }
        run: x -> y.n
      `
    ).toTranslate();
  });
  test('can reference join field in refinement when experiment is enabled', () => {
    expect(
      markSource`
        ##! experimental { scalar_lenses }
        source: x is a extend {
          join_cross: y is a extend { dimension: n is 1 } on true
        }
        run: x -> ai + y.n
      `
    ).toTranslate();
  });
  test('can reference join field in nest refinement when experiment is enabled', () => {
    expect(
      markSource`
        ##! experimental { scalar_lenses }
        source: x is a extend {
          join_cross: y is a extend { dimension: n is 1 } on true
        }
        run: x -> { nest: ai + y.n }
      `
    ).toTranslate();
  });
  test('can nest dimension when experiment is enabled', () => {
    expect(
      markSource`
        ##! experimental { scalar_lenses }
        source: x is a extend {
          dimension: n is 1
          view: d is { nest: n }
        }
        run: x -> d
      `
    ).toTranslate();
  });
  test('cannot use join_name in refinement shortcut', () => {
    expect(
      markSource`
        ##! experimental { scalar_lenses }
        source: x is a extend {
          join_one: y is a on true
          view: m is { aggregate: c is count() }
        }
        run: x -> m + y + { limit: 1 }`
    ).translationToFailWith(
      'named refinement `y` must be a view, found a struct'
    );
  });
  test('cannot use view from join as whole pipeline', () => {
    expect(
      markSource`
        ##! experimental { scalar_lenses }
        source: x is a extend {
          join_one: y is a extend {
            view: z is { group_by: d is 1 }
          } on true
        }
        run: x -> y.z
      `
    ).translationToFailWith('Cannot use view from join');
  });
  test('cannot use view from join in nest', () => {
    expect(
      markSource`
        ##! experimental { scalar_lenses }
        source: x is a extend {
          join_one: y is a extend {
            view: z is { group_by: d is 1 }
          } on true
        }
        run: x -> { nest: y.z }
      `
    ).translationToFailWith('Cannot nest view from join');
  });
  test('cannot use view from join as nest view head', () => {
    expect(
      markSource`
        ##! experimental { scalar_lenses }
        source: x is a extend {
          join_one: y is a extend {
            view: z is { group_by: d is 1 }
          } on true
        }
        run: x -> { nest: y.z + { limit: 1 } }
      `
    ).translationToFailWith('Cannot use view from join');
  });
  test('cannot use view from join as lens in query', () => {
    expect(
      markSource`
        ##! experimental { scalar_lenses }
        source: x is a extend {
          join_one: y is a extend {
            view: z is { group_by: d is 1 }
          } on true
        }
        run: x -> ai + y.z
      `
    ).translationToFailWith('Cannot use view from join as refinement');
  });
  test('cannot use view from join as lens in nest', () => {
    expect(
      markSource`
        ##! experimental { scalar_lenses }
        source: x is a extend {
          join_one: y is a extend {
            view: z is { group_by: d is 1 }
          } on true
        }
        run: x -> { nest: ai + y.z }
      `
    ).translationToFailWith('Cannot use view from join as refinement');
  });
  test('can nest dimension with refinement when experiment is enabled', () => {
    expect(
      markSource`
        ##! experimental { scalar_lenses }
        source: x is a extend {
          dimension: n is 1
          view: d is { nest: n + { where: n > 0 } }
        }
        run: x -> d
      `
    ).toTranslate();
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

describe('partial views', () => {
  test('allow where-headed refinement chains', () => {
    expect(
      markSource`
        source: x is a extend {
          view: metrics is { aggregate: c is count() }
          view: cool_metrics is { where: true } + metrics
        }
      `
    ).toTranslate();
  });
  test.skip('partial with index', () => {
    expect(
      markSource`
        source: x is a extend {
          view: idx is { index: * }
        }
        run: x -> { where: true } + idx
      `
    ).toTranslate();
  });
  test('disallow chains that have no fields in view', () => {
    expect(
      markSource`
        source: x is a extend {
          view: bad1 is { where: true }
          view: bad2 is { where: true } + { where: false }
        }
      `
    ).translationToFailWith(
      "Can't determine view type (`group_by` / `aggregate` / `nest`, `project`, `index`)",
      "Can't determine view type (`group_by` / `aggregate` / `nest`, `project`, `index`)"
    );
  });
  test('disallow chains that have no fields in multi-stage', () => {
    expect(
      markSource`
        source: x is a extend {
          view: v is { group_by: ai }
          view: v2 is v -> { where: true }
          view: v3 is { where: true } -> { group_by: undef }
        }
        run: x -> v -> { where: true }
        run: x -> { where: true } -> { group_by: undef }
      `
    ).translationToFailWith(
      "Can't determine view type (`group_by` / `aggregate` / `nest`, `project`, `index`)",
      "'undef' is not defined",
      "Can't determine view type (`group_by` / `aggregate` / `nest`, `project`, `index`)",
      "Can't determine view type (`group_by` / `aggregate` / `nest`, `project`, `index`)",
      "'undef' is not defined",
      "Can't determine view type (`group_by` / `aggregate` / `nest`, `project`, `index`)"
    );
  });
});
