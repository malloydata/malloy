/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {model} from './test-translator';
import './parse-expects';
import type {QuerySegment} from '../../model';
import {isQuerySegment} from '../../model';

/*
 * `whereOnlyJoins`: the joins which only a segment's own `where:` needs. The
 * compiler can test such an array's elements in place instead of unnesting it.
 */
function firstSegment(src: ReturnType<typeof model>): QuerySegment {
  expect(src).toTranslate();
  const segment = src.translator.getQuery(0)?.pipeline[0];
  if (segment === undefined || !isQuerySegment(segment)) {
    throw new Error('expected a query segment');
  }
  return segment;
}

describe('where-only joins', () => {
  test('an array only the where: reads', () => {
    const segment = firstSegment(
      model`run: a -> { where: ais.each = 1; aggregate: c is count() }`
    );
    expect(segment.whereOnlyJoins).toEqual([{path: ['ais']}]);
    expect(segment.refSummaryOutsideWhere).toBeUndefined();
  });

  test('a record array only the where: reads', () => {
    const segment = firstSegment(
      model`run: a -> { where: astruct.column = 1; aggregate: c is count() }`
    );
    expect(segment.whereOnlyJoins).toEqual([{path: ['astruct']}]);
  });

  test('an array a group_by also reads', () => {
    const segment = firstSegment(
      model`run: a -> { where: ais.each = 1; group_by: ais.each }`
    );
    expect(segment.whereOnlyJoins).toBeUndefined();
  });

  test('an array an aggregate also counts', () => {
    const segment = firstSegment(
      model`run: a -> { where: ais.each = 1; aggregate: c is ais.count() }`
    );
    expect(segment.whereOnlyJoins).toBeUndefined();
  });

  test("an array a nest's where: reads", () => {
    const segment = firstSegment(model`
      run: a -> {
        where: ais.each = 1
        aggregate: c is count()
        nest: x is { where: ais.each = 2; aggregate: c is count() }
      }
    `);
    expect(segment.whereOnlyJoins).toBeUndefined();
  });

  test("an array the source's own where: reads", () => {
    const segment = firstSegment(model`
      source: f is a extend { where: ais.each = 1 }
      run: f -> { where: ais.each = 2; aggregate: c is count() }
    `);
    expect(segment.whereOnlyJoins).toBeUndefined();
  });

  test('a join only the where: reads', () => {
    const segment = firstSegment(model`
      source: j is a extend { join_one: b is a on b.astr = astr }
      run: j -> { where: b.ai = 1; aggregate: c is count() }
    `);
    expect(segment.whereOnlyJoins).toEqual([{path: ['b']}]);
  });

  test("an array another join's on clause reads", () => {
    const segment = firstSegment(model`
      source: j is a extend { join_one: b is a on b.ai = ais.each }
      run: j -> { where: ais.each = 1; aggregate: c is b.count() }
    `);
    expect(segment.whereOnlyJoins).toBeUndefined();
  });

  test('a view, run as it is', () => {
    const segment = firstSegment(model`
      source: v is a extend {
        view: w is { where: ais.each = 1; aggregate: c is count() }
      }
      run: v -> w
    `);
    expect(segment.whereOnlyJoins).toEqual([{path: ['ais']}]);
  });

  test("a refined view: the view's where: counts as outside", () => {
    const segment = firstSegment(model`
      source: v is a extend {
        view: w is { where: ais.each = 1; aggregate: c is count() }
      }
      run: v -> w + { where: ai = 1 }
    `);
    expect(segment.whereOnlyJoins).toBeUndefined();
  });
});
