/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {model} from './test-translator';
import './parse-expects';
import {isIndexSegment, isQuerySegment} from '../../model';

const sources = `
  ##! experimental.join_types
  source: s is a extend {
    dimension:
      od is o.ad
      picked is pick o.ad when ai > 1 else @2000-01-01
      big is o.ai > 10
    join_one: o is a extend {
      dimension:
        inner_date is ad
        computed_rec is {x is ai ?? 0, y is 1}
    } on o.ai = ai
    join_one: p is a on p.ai = o.ai
    join_one: q is a on q.ai = ai
    join_one: r is a right on r.ai = o.ai
  }
`;

/**
 * The joins the query's first segment marks `inner`.
 */
function innerJoins(query: string): string[] {
  const m = model`${sources} ${query}`;
  expect(m).toTranslate();
  const segment = m.translator.getQuery(0)?.pipeline[0];
  if (
    segment === undefined ||
    !(isQuerySegment(segment) || isIndexSegment(segment))
  ) {
    throw new Error('expected a query segment');
  }
  return (segment.activeJoins ?? [])
    .filter(j => j.inner)
    .map(j => j.path.join('.'));
}

function whereJoins(where: string): string[] {
  return innerJoins(`run: s -> { where: ${where}; select: ai }`);
}

describe('joins a where: requires are inner', () => {
  test('comparison with a join column', () => {
    expect(whereJoins('o.ad > @2001')).toEqual(['o']);
  });
  test('or with a side which does not read the join', () => {
    expect(whereJoins('o.ad > @2001 or ai > 1')).toEqual([]);
  });
  test('or with both sides reading the join', () => {
    expect(whereJoins('o.ad > @2001 or o.ai > 1')).toEqual(['o']);
  });
  test('and with one side reading the join', () => {
    expect(whereJoins('o.ad > @2001 and ai > 1')).toEqual(['o']);
  });
  test('two where: clauses', () => {
    expect(
      innerJoins('run: s -> { where: ai > 1; where: q.ai > 1; select: ai }')
    ).toEqual(['q']);
  });
  test('arithmetic and casts pass NULL through', () => {
    expect(whereJoins('(o.ai + 1) * 2 > 3')).toEqual(['o']);
    expect(whereJoins('o.astr::number > 3')).toEqual(['o']);
    expect(whereJoins('o.ats.year = @2001')).toEqual(['o']);
    expect(whereJoins('o.ats + 1 day > @2001')).toEqual(['o']);
  });
  test('like and in', () => {
    expect(whereJoins("o.astr ~ 'a%'")).toEqual(['o']);
    expect(whereJoins('o.ai = (1 | 2)')).toEqual(['o']);
  });
  test('is not null', () => {
    expect(whereJoins('o.ai is not null')).toEqual(['o']);
    expect(whereJoins('o.ai is null')).toEqual([]);
  });
  test('Malloy != and not are true for NULL', () => {
    expect(whereJoins("o.astr != 'x'")).toEqual([]);
    expect(whereJoins("o.astr !~ 'a%'")).toEqual([]);
    expect(whereJoins('not o.abool')).toEqual([]);
  });
  test('coalesce and function calls prove nothing', () => {
    expect(whereJoins('(o.ai ?? 0) > 1')).toEqual([]);
    expect(whereJoins("lower(o.astr) = 'x'")).toEqual([]);
  });
  test('a boolean column', () => {
    expect(whereJoins('o.abool')).toEqual(['o']);
  });
  test('a dimension is read through its definition', () => {
    expect(whereJoins('od > @2001')).toEqual(['o']);
    expect(whereJoins('big')).toEqual(['o']);
    expect(whereJoins('o.inner_date > @2001')).toEqual(['o']);
  });
  test('a pick in a dimension proves nothing', () => {
    expect(whereJoins('picked > @2001')).toEqual([]);
  });
  test('a record in the join is a column of it', () => {
    expect(whereJoins('o.aninline.column > 1')).toEqual(['o']);
  });
  test('a computed record in the join is not', () => {
    expect(whereJoins('o.computed_rec.x = 0')).toEqual([]);
    expect(whereJoins('o.computed_rec.y = 1')).toEqual([]);
  });
  test('a join whose on needs another join makes it required', () => {
    expect(whereJoins('p.ai > 1')).toEqual(['o', 'p']);
    expect(whereJoins('q.ai > 1')).toEqual(['q']);
  });
  test('the on of a right join proves nothing', () => {
    expect(whereJoins('r.ai > 1')).toEqual([]);
  });
  test("a source's where: counts", () => {
    expect(
      innerJoins('run: s extend { where: o.ai > 1 } -> { select: ai }')
    ).toEqual(['o']);
  });
  test("a nest's where: does not", () => {
    expect(
      innerJoins(`
        run: s -> {
          group_by: ai
          nest: n is { where: o.ai > 1; group_by: astr }
        }
      `)
    ).toEqual([]);
  });
  test('a having: with no aggregate is written in WHERE, and counts', () => {
    expect(innerJoins('run: s -> { group_by: ai; having: o.ai > 1 }')).toEqual([
      'o',
    ]);
  });
  test('a having: on an output column does not', () => {
    expect(
      innerJoins('run: s -> { group_by: x is o.ai; having: x > 1 }')
    ).toEqual([]);
  });
  test('a having: on an aggregate does not', () => {
    expect(
      innerJoins(`
        run: s -> {
          group_by: ai
          aggregate: c is o.count()
          having: c > 1
        }
      `)
    ).toEqual([]);
  });
  describe('filter expressions', () => {
    test.each([
      ["o.astr ~ f'abc%'", ['o']],
      ["o.astr ~ f'a, b'", ['o']],
      ["o.astr ~ f'a, null'", []],
      ["o.astr ~ f'-abc'", []],
      ["o.astr ~ f'null'", []],
      ["o.astr ~ f'-null'", ['o']],
      ["o.astr ~ f'empty'", []],
      ["o.astr ~ f'-empty'", ['o']],
      ["o.ai ~ f'> 5'", ['o']],
      ["o.ai ~ f'5 or null'", []],
      ["o.ai ~ f'!= 5'", []],
      ["o.ad ~ f'2001'", ['o']],
      ["o.ad ~ f'not 2001'", []],
      ["o.abool ~ f'true'", ['o']],
      ["o.abool ~ f'false'", []],
      ["o.astr ~ f''", []],
    ])('%s', (where, inner) => {
      expect(whereJoins(where)).toEqual(inner);
    });
  });
});
