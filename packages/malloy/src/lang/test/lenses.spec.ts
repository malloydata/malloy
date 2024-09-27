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

import {error, errorMessage, markSource} from './test-translator';
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
  test('lens parens patterns', () => {
    expect(
      markSource`
        source: s1 is a extend {
          view: v1 is { group_by: d1 is 1 }
          view: v2 is { group_by: d2 is 2 }
          view: v3 is { group_by: d3 is 3 }
          view: v4 is (v1 + v2) + v3
          view: v5 is {
            nest: n1 is v1 + (v2 + v3)
            nest: n2 is (({ group_by: d1 is 1 } + v2) + v3)
            nest: n3 is v1 + v2 + { group_by: d3 is 3 }
          }
          view: v6 is { group_by: d1 is 1 } + (v2 + v3)
        }
        run: (s1 -> v4)
        run: (s1 -> (((v4))))
        source: s2 is ((s1 -> v1) + v2) + v3
        source: s3 is s1 -> (v1 + (v2 + v3))
        source: s4 is (s1 -> v1) + (v2 + v3)
        source: s5 is s1 -> { group_by: d1 is 1 } + v2 + v3
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
    ).toLog(errorMessage('overlapping fields in refinement: n'));
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
    ).toLog(errorMessage('refinement cannot override existing limit'));
  });
  test('cannot override ordering', () => {
    expect(
      markSource`
        source: x is a extend {
          view: d1 is { group_by: n1 is ai; order_by: n1 }
          view: d2 is { group_by: n2 is 1; order_by: n2 }
        }
        run: x -> d1 + d2
      `
    ).toLog(errorMessage('refinement cannot override existing ordering'));
  });
  test('weird issue with order by constant group by', () => {
    expect(
      markSource`
        source: x is a extend {
          view: d1 is { group_by: n1 is 1; order_by: n1 }
        }
      `
    ).toTranslate();
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
    ).toLog(
      errorMessage('cannot refine reduce view with project view'),
      errorMessage('cannot refine reduce view with index view'),
      errorMessage('cannot refine project view with index view'),
      errorMessage('cannot refine project view with reduce view'),
      errorMessage('cannot refine index view with reduce view'),
      errorMessage('cannot refine index view with project view')
    );
  });
  test('can reference dimension at head of query when experiment is enabled', () => {
    expect(
      markSource`
        source: x is a extend {
          dimension: n is 1
        }
        run: x -> n
      `
    ).toTranslate();
  });
  test('can change refine precedence', () => {
    expect(
      markSource`
        source: x is a extend {
          dimension:
            a is 1
            b is 2
            c is 3
        }
        run: x -> a + (b + c)
      `
    ).toTranslate();
  });
  test.skip('can split multi-stage refinement with plus', () => {
    expect(
      markSource`
        source: x is a extend {
          view: two_stage is { group_by: a is 1 } -> { group_by: a }
        }
        run: x -> two_stage + ({ where: true } + { limit: 3 })
      `
    ).toTranslate();
  });
  test('cannot refine with multi-stage', () => {
    expect(
      markSource`
        source: x is a extend {
          view: one_stage is { group_by: a is 1 }
          view: two_stage is { group_by: a is 1 } -> { group_by: a }
        }
        run: x -> one_stage + two_stage
      `
    ).toLog(
      errorMessage('named refinement `two_stage` must have exactly one stage')
    );
  });
  test('cannot refine with literal multi-stage', () => {
    expect(
      markSource`
        source: x is a extend {
          view: one_stage is { group_by: a is 1 }
          view: two_stage is { group_by: a is 1 } -> { group_by: a }
        }
        run: x -> one_stage + ({ group_by: a is 1 } -> { group_by: a })
      `
    ).toLog(
      errorMessage('A multi-segment view cannot be used as a refinement')
    );
  });
  test('can reference dimension in refinement when experiment is enabled', () => {
    expect(
      markSource`
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
        source: x is a extend {
          join_one: y is a on true
          view: m is { aggregate: c is count() }
        }
        run: x -> m + y + { limit: 1 }`
    ).toLog(
      errorMessage('named refinement `y` must be a view, found a struct')
    );
  });
  test('cannot use view from join as whole pipeline', () => {
    expect(
      markSource`
        source: x is a extend {
          join_one: y is a extend {
            view: z is { group_by: d is 1 }
          } on true
        }
        run: x -> y.z
      `
    ).toLog(errorMessage('Cannot use view from join'));
  });
  test('cannot use view from join in nest', () => {
    expect(
      markSource`
        source: x is a extend {
          join_one: y is a extend {
            view: z is { group_by: d is 1 }
          } on true
        }
        run: x -> { nest: y.z }
      `
    ).toLog(errorMessage('Cannot use view from join'));
  });
  test('cannot use view from join as nest view head', () => {
    expect(
      markSource`
        source: x is a extend {
          join_one: y is a extend {
            view: z is { group_by: d is 1 }
          } on true
        }
        run: x -> { nest: y.z + { limit: 1 } }
      `
    ).toLog(errorMessage('Cannot use view from join'));
  });
  test('cannot use view from join as lens in query', () => {
    expect(
      markSource`
        source: x is a extend {
          join_one: y is a extend {
            view: z is { group_by: d is 1 }
          } on true
        }
        run: x -> ai + y.z
      `
    ).toLog(errorMessage('Cannot use view from join as refinement'));
  });
  test('cannot use view from join as lens in nest', () => {
    expect(
      markSource`
        source: x is a extend {
          join_one: y is a extend {
            view: z is { group_by: d is 1 }
          } on true
        }
        run: x -> { nest: ai + y.z }
      `
    ).toLog(errorMessage('Cannot use view from join as refinement'));
  });
  test('can nest dimension with refinement when experiment is enabled', () => {
    expect(
      markSource`
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
    ).toLog(
      errorMessage('named refinement `b` must be a view, found a struct')
    );
  });
  test('cannot reference field in LHS of refinement in group_by', () => {
    expect(
      markSource`
        source: x is a extend {
          view: v is { group_by: i is 1 }
        }
        run: x -> v + { group_by: j is ${'i'} }
      `
    ).toLog(errorMessage("'i' is not defined"));
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
    ).toLog(
      errorMessage('Named refinements of multi-stage views are not supported'),
      errorMessage('named refinement `multi` must have exactly one stage')
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
  test('order by tacked on the end should work', () => {
    expect(
      markSource`
        run: a -> {
          nest: astr + ai + { order_by: astr }
        }
        run: a -> {
          nest: astr + { order_by: astr }
        }
        run: a -> astr + { order_by: astr }
        run: a -> astr + ai + { order_by: astr }
      `
    ).toTranslate();
  });
  test('name can be inferred with arrow', () => {
    expect(
      markSource`
        run: a extend { view: foo is { group_by: astr } } -> {
          nest: foo -> astr + { order_by: astr }
        }
      `
    ).toTranslate();
  });
  test('nice error when nest has no name', () => {
    expect(
      markSource`
        run: a -> {
          nest: { group_by: astr }
        }
      `
    ).toLog(
      errorMessage('`nest:` view requires a name (add `nest_name is ...`)')
    );
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
    ).toLog(error('ambiguous-view-type'), error('ambiguous-view-type'));
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
    ).toLog(
      error('ambiguous-view-type'),
      errorMessage("'undef' is not defined"),
      error('ambiguous-view-type'),
      error('ambiguous-view-type'),
      errorMessage("'undef' is not defined"),
      error('ambiguous-view-type')
    );
  });
  test('copy of view with refinement should work', () => {
    expect(
      markSource`
        source: x is a extend {
          view: metrics is { aggregate: c is count() }
          view: v is { group_by: ai } + metrics
          view: v2 is v + { order_by: c }
        }
      `
    ).toTranslate();
  });
});
