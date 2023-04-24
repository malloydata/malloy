/* eslint-disable no-console */
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

import {
  DocumentLocation,
  DocumentPosition,
  SQLBlockSource,
  SQLBlockStructDef,
  expressionIsCalculation,
  isFieldTypeDef,
  isFilteredAliasedName,
  isSQLFragment,
} from '../../model';
import {
  MarkedSource,
  TestTranslator,
  getExplore,
  getField,
  getJoinField,
  getModelQuery,
  getQueryField,
  markSource,
  BetaExpression,
} from './test-translator';
import isEqual from 'lodash/isEqual';
import {isGranularResult} from '../ast/types/granular-result';
import './parse-expects';

type TestFunc = () => undefined;

function exprOK(s: string): TestFunc {
  return () => {
    expect(new BetaExpression(s)).modelParsed();
    return undefined;
  };
}

function modelOK(s: string): TestFunc {
  return () => {
    const m = new TestTranslator(s);
    expect(m).modelCompiled();
    return undefined;
  };
}

function badModel(s: MarkedSource | string, msg: string): TestFunc {
  return () => {
    const src = typeof s === 'string' ? s : s.code;
    const emsg = `Error expectation not met\nExpected error: '${msg}'\nSource:\n${src}`;
    const m = new TestTranslator(src);
    const t = m.translate();
    if (t.translated) {
      fail(emsg);
    } else {
      const errList = m.errors().errors;
      const firstError = errList[0];
      if (firstError.message !== msg) {
        fail(`Received errror: ${firstError.message}\n${emsg}`);
      }
      if (typeof s !== 'string') {
        if (!isEqual(errList[0].at, s.locations[0])) {
          fail(
            `Expected location: ${s.locations[0]}\n` +
              `Received location: ${errList[0].at}\n${emsg}`
          );
        }
      }
    }
    return undefined;
  };
}

describe('model statements', () => {
  describe('explore:', () => {
    test('explore table', modelOK("explore: testA is table('aTable')"));
    test('explore shorcut fitlered table', () => {
      expect("explore: testA is table('aTable') {? astr ~ 'a%' } ").toCompile();
    });
    test(
      'explore fitlered table',
      modelOK(`
        explore: testA is table('aTable') { where: astr ~ 'a%' }
      `)
    );
    test('explore explore', modelOK('explore: testA is a'));
    test(
      'explore query',
      modelOK('explore: testA is from(a->{group_by: astr})')
    );
    test(
      'refine explore',
      modelOK('explore: aa is a { dimension: a is astr }')
    );
    test('source refinement preserves original', () => {
      const x = new TestTranslator('source: na is a + { dimension: one is 1 }');
      expect(x).modelCompiled();
      const a = x.getSourceDef('a');
      if (a) {
        const aFields = a.fields.map(f => f.as || f.name);
        expect(aFields).toContain('astr');
        expect(aFields).not.toContain('one');
      }
    });
  });
  describe('query:', () => {
    test(
      'anonymous query',
      modelOK("query: table('aTable') -> { group_by: astr }")
    );
    test(
      'query',
      modelOK("query: name is table('aTable') -> { group_by: astr }")
    );
    test(
      'query from query',
      modelOK(
        `
          query: q1 is ab->{ group_by: astr limit: 10 }
          query: q2 is ->q1
        `
      )
    );
    test(
      'query with refinements from query',
      modelOK(
        `
          query: q1 is ab->{ group_by: astr limit: 10 }
          query: q2 is ->q1 { aggregate: acount }
        `
      )
    );
    test(
      'chained query operations',
      modelOK(`
        query: ab
          -> { group_by: astr; aggregate: acount }
          -> { top: 5; where: astr ~ 'a%' group_by: astr }
      `)
    );
    test(
      'query from explore from query',
      modelOK(
        'query: from(ab -> {group_by: astr}) { dimension: bigstr is UPPER(astr) } -> { group_by: bigstr }'
      )
    );
    test(
      'query with shortcut filtered turtle',
      modelOK("query: allA is ab->aturtle {? astr ~ 'a%' }")
    );
    test(
      'query with filtered turtle',
      modelOK("query: allA is ab->aturtle { where: astr ~ 'a%' }")
    );
    test(
      'nest: in group_by:',
      modelOK(`
        query: ab -> {
          group_by: astr;
          nest: nested_count is {
            aggregate: acount
          }
        }
      `)
    );
    test(
      'reduce pipe project',
      modelOK(`
        query: a -> { aggregate: f is count() } -> { project: f2 is f + 1 }
      `)
    );
    test(
      'refine and extend query',
      modelOK(`
        query: a_by_str is a -> { group_by: astr }
        query: -> a_by_str { aggregate: str_count is count() }
      `)
    );
    test('query refinement preserves original', () => {
      const x = new TestTranslator(`
        query: q is a -> { aggregate: acount is count() }
        query: nq is -> q + { group_by: astr }
      `);
      expect(x).modelCompiled();
      const q = x.getQuery('q');
      expect(q).toBeDefined();
      if (q) {
        const qFields = q.pipeline[0].fields;
        expect(qFields.length).toBe(1);
      }
    });
    test('query composition preserves original', () => {
      const x = new TestTranslator(`
        query: q is ab -> { aggregate: acount }
        query: nq is -> q -> { project: * }
      `);
      expect(x).modelCompiled();
      const q = x.getQuery('q');
      expect(q).toBeDefined();
      if (q) {
        expect(q.pipeline.length).toBe(1);
      }
    });
    test(
      'all ungroup with args',
      modelOK(`
        query: a -> {
          group_by: astr
          nest: by_int is {
            group_by: ai
            aggregate: bi_count is all(count(), ai)
          }
        }
      `)
    );
    test('all ungroup checks args', () => {
      expect(`
      query: a -> {
        group_by: astr
        nest: by_int is {
          group_by: ai
          aggregate: bi_count is all(count(), afloat)
        }
      }
    `).compileToFailWith("all() 'afloat' is missing from query output");
    });
    test(
      'exclude ungroup with args',
      modelOK(`
        query: a -> {
          group_by: aa is 'a'
          nest: by_b is {
            group_by: bb is 'b'
            nest: by_c is {
              group_by: cc is 'c'
              aggregate: bb_count is exclude(count(), aa, cc)
            }
          }
        }
      `)
    );
    test('exclude ungroup checks args', () => {
      expect(`
        query: a -> {
          group_by: aa is 'a'
          nest: by_b is {
            group_by: bb is 'b'
            nest: by_c is {
              group_by: cc is 'c'
              aggregate: bb_count is exclude(count(), aaa, cc)
            }
          }
        }
      `).compileToFailWith("exclude() 'aaa' is missing from query output");
    });
    test(
      'exclude problem revealed by production models',
      modelOK(`
        source: carriers is table('malloytest.carriers') {
          primary_key: code
        }
        source: flights is table('malloytest.flights') {
          primary_key: id2
          join_one: carriers with carrier

          query: carrier_overview is {
            group_by: carrier_name is carriers.nickname
            nest: top_destinations is {
              group_by: destination
              aggregate:
                flights_to_dest is exclude(count(), carrier_name)*100
            }
          }
        }
      `)
    );
  });
});

describe('explore properties', () => {
  test('single dimension', modelOK('explore: aa is a { dimension: x is 1 }'));
  test(
    'multiple dimensions',
    modelOK(`
      explore: aa is a {
        dimension:
          x is 1
          y is 2
      }
    `)
  );
  test('single declare', modelOK('explore: aa is a { declare: x is 1 }'));
  test(
    'multiple declare',
    modelOK(`
      explore: aa is a {
        declare:
          x is 1
          y is 2
      }
    `)
  );
  test('single measure', modelOK('explore: aa is a { measure: x is count() }'));
  test(
    'multiple measures',
    modelOK(`
      explore: aa is a {
        dimension:
          x is count()
          y is x * x
      }
    `)
  );
  test('single where', modelOK('explore: aa is a { where: ai > 10 }'));
  test(
    'multiple where',
    modelOK(`
      explore: aa is a {
        where:
          ai > 10,
          af < 1000
      }
    `)
  );
  test(
    'where clause can use the join namespace in source refined query',
    modelOK(`
    source: flights is table('malloytest.flights') + {
      query: boo is {
        join_one: carriers is table('malloytest.carriers') on carrier = carriers.code
        where: carriers.code = 'WN' | 'AA'
        group_by: carriers.nickname
        aggregate: flight_count is count()
      }
    }`)
  );
  describe('joins', () => {
    test('with', modelOK('explore: x is a { join_one: b with astr }'));
    test('with', modelOK('explore: x is a { join_one: y is b with astr }'));
    test(
      'with dotted ref',
      modelOK('explore: x is ab { join_one: xz is a with b.astr }')
    );
    test('one on', modelOK('explore: x is a { join_one: b on astr = b.astr }'));
    test(
      'one is on',
      modelOK('explore: x is a { join_one: y is b on astr = y.astr }')
    );
    test(
      'many on',
      modelOK('explore: nab is a { join_many: b on astr = b.astr }')
    );
    test(
      'many is on',
      modelOK('explore: y is a { join_many: x is b on astr = x.astr }')
    );
    test('cross', modelOK('explore: nab is a { join_cross: b }'));
    test('cross is', modelOK('explore: nab is a { join_cross: xb is b }'));
    test('cross on', modelOK('explore: nab is a { join_cross: b on true}'));
    test(
      'multiple joins',
      modelOK(`
        explore: nab is a {
          join_one:
            b with astr,
            br is b with astr
        }
      `)
    );
    test('with requires primary key', () => {
      expect(
        markSource`
          source: nb is b {
            join_one: ${"bb is table('aTable') with astr"}
          }
        `
      ).compileToFailWith(
        'join_one: Cannot use with unless source has a primary key'
      );
    });
  });
  test('primary_key', modelOK('explore: c is a { primary_key: ai }'));
  test('rename', modelOK('explore: c is a { rename: nn is ai }'));
  test('accept single', () => {
    const onlyAstr = new TestTranslator('explore: c is a { accept: astr }');
    expect(onlyAstr).modelCompiled();
    const c = onlyAstr.getSourceDef('c');
    if (c) {
      expect(c.fields.length).toBe(1);
    }
  });
  test('accept multi', modelOK('explore: c is a { accept: astr, af }'));
  test('except single', () => {
    const noAstr = new TestTranslator('explore: c is a { except: astr }');
    expect(noAstr).modelCompiled();
    const c = noAstr.getSourceDef('c');
    if (c) {
      const foundAstr = c.fields.find(f => f.name === 'astr');
      expect(foundAstr).toBeUndefined();
    }
  });
  test('except multi', modelOK('explore: c is a { except: astr, af }'));
  test(
    'explore-query',
    modelOK('explore: c is a {query: q is { group_by: astr } }')
  );
  test(
    'refined explore-query',
    modelOK(`
      explore: abNew is ab {
        query: for1 is aturtle {? ai = 1 }
      }
    `)
  );
  test(
    'chained explore-query',
    modelOK(`
      explore: c is a {
        query: chain is {
          group_by: astr
        } -> {
          top: 10; order_by: astr
          project: *
        }
      }
    `)
  );
  test(
    'multiple explore-query',
    modelOK(`
      explore: abNew is ab {
        query:
          q1 is { group_by: astr },
          q2 is { group_by: ai }
      }
    `)
  );
});

describe('qops', () => {
  test('group by single', modelOK('query: a->{ group_by: astr }'));
  test("group_by x is x'", modelOK('query: a->{ group_by: ai is ai/2 }'));
  test('group by multiple', modelOK('query: a->{ group_by: astr,ai }'));
  test('aggregate single', modelOK('query: a->{ aggregate: num is count() }'));
  test(
    'aggregate multiple',
    modelOK(`
      query: a->{
        aggregate: num is count(), total is sum(ai)
      }
    `)
  );
  test('project ref', modelOK('query:ab->{ project: b.astr }'));
  test('project *', modelOK('query:ab->{ project: * }'));
  test('project def', modelOK('query:ab->{ project: one is 1 }'));
  test(
    'project multiple',
    modelOK(`
      query: a->{
        project: one is 1, astr
      }
    `)
  );
  test('index single', modelOK('query:a->{index: astr}'));
  test('index path', modelOK('query:ab->{index: ab.astr}'));
  test('index unique on path', modelOK('query:ab->{index: b.astr, ab.astr}'));
  test('index join.*', modelOK('query:ab->{index: ab.*}'));
  test('index multiple', () => {
    const model = new TestTranslator('query:a->{index: af, astr}');
    expect(model).modelCompiled();
    const q = model.getQuery(0);
    expect(q).toBeDefined();
    if (q) {
      const index = q.pipeline[0];
      expect(index.type).toBe('index');
      expect(index.fields).toEqual(['af', 'astr']);
    }
  });
  test('index star', () => {
    const model = new TestTranslator('query:a->{index: *, astr}');
    expect(model).modelCompiled();
    const q = model.getQuery(0);
    expect(q).toBeDefined();
    if (q) {
      const index = q.pipeline[0];
      expect(index.type).toBe('index');
      expect(index.fields).toEqual(['*', 'astr']);
    }
  });
  test('index by', modelOK('query:a->{index: * by ai}'));
  test('index sampled', modelOK('query:a->{index: *; sample: true}'));
  test('index unsampled', modelOK('query:a->{index: *; sample: false}'));
  test('index sample-percent', () => {
    const model = new TestTranslator('query:a->{index: *; sample: 42%}');
    expect(model).modelCompiled();
    const q = model.getQuery(0);
    expect(q).toBeDefined();
    if (q) {
      const index = q.pipeline[0];
      expect(index.type).toBe('index');
      if (index.type === 'index') {
        expect(index.sample).toEqual({percent: 42});
      }
    }
  });
  test('index sample-rows', modelOK('query:a->{index: *; sample: 100000}'));
  test('top N', modelOK('query: a->{ top: 5; group_by: astr }'));
  test('top N by field', modelOK('query: a->{top: 5 by af; group_by: astr}'));
  test(
    'top N by expression',
    modelOK('query: ab->{top: 5 by acount; group_by: astr}')
  );
  test('limit N', modelOK('query: a->{ limit: 5; group_by: astr }'));
  test('order by', modelOK('query: a->{ order_by: af; group_by: astr }'));
  test(
    'order by asc',
    modelOK('query: a->{ order_by: af asc; group_by: astr }')
  );
  test(
    'order by desc',
    modelOK('query: a->{ order_by: af desc; group_by: astr }')
  );
  test('order by N', modelOK('query: a->{ order_by: 1 asc; group_by: astr }'));
  test(
    'order by multiple',
    modelOK(`
      query: a->{
        order_by: 1 asc, af desc
        group_by: astr, af
      }
    `)
  );
  test('where single', modelOK('query:a->{ group_by: astr; where: af > 10 }'));
  test(
    'having single',
    modelOK(
      'query:ab->{ aggregate: acount; group_by: astr; having: acount > 10 }'
    )
  );
  test(
    'compound having still works',
    modelOK(
      'query:ab->{ aggregate: acount; having: acount > 10 and acount < 100 }'
    )
  );
  test(
    'compound aggregate still works',
    modelOK('query:ab->{ aggregate: thing is acount > 10 and acount < 100 }')
  );
  test(
    'where multiple',
    modelOK("query:a->{ group_by: astr; where: af > 10,astr~'a%' }")
  );
  test('filters preserve source formatting in code:', () => {
    const model = new TestTranslator(
      "source: notb is a + { where: astr  !=  'b' }"
    );
    expect(model).modelCompiled();
    const notb = model.getSourceDef('notb');
    expect(notb).toBeDefined();
    if (notb) {
      const f = notb.filterList;
      expect(f).toBeDefined();
      if (f) {
        expect(f[0].code).toBe("astr  !=  'b'");
      }
    }
  });
  test('field expressions preserve source formatting in code:', () => {
    const model = new TestTranslator(
      'source: notb is a + { dimension: d is 1 +   2 }'
    );
    expect(model).modelCompiled();
    const notb = model.getSourceDef('notb');
    expect(notb).toBeDefined();
    if (notb) {
      const d = notb.fields.find(f => f.as || f.name === 'd');
      expect(d).toBeDefined();
      expect(d?.type).toBe('number');
      if (d?.type === 'number') {
        expect(d.code).toBe('1 +   2');
      }
    }
  });
  test(
    'nest single',
    modelOK(`
      query: a->{
        group_by: ai
        nest: nestbystr is { group_by: astr; aggregate: N is count() }
      }
    `)
  );
  test(
    'nest multiple',
    modelOK(`
      query: a->{
        group_by: ai
        nest:
          nestbystr is { group_by: astr; aggregate: N is count() },
          renest is { group_by: astr; aggregate: N is count() }
      }
    `)
  );
  test('nest ref', modelOK('query: ab->{group_by: ai; nest: aturtle}'));
  test('refine query with extended source', () => {
    const m = new TestTranslator(`
      source: nab is ab {
        query: xturtle is aturtle + {
          declare: aratio is ai / acount
        }
      }
      query: nab -> xturtle + { aggregate: aratio }
    `);
    expect(m).modelCompiled();
    const t = m.translate();
    if (t.translated) {
      const q = t.translated.queryList[0].pipeline[0];
      if (q.type === 'reduce' && q.extendSource) {
        expect(q.extendSource.length).toBe(1);
        const f = q.extendSource[0];
        expect(f.type).toBe('number');
        if (f.type === 'number') {
          expect(expressionIsCalculation(f.expressionType)).toBeTruthy();
        }
      } else {
        fail('Did not generate extendSource');
      }
    }
  });
  test('refine query source with field', () => {
    const m = new TestTranslator(`
      query: ab -> aturtle + {
        declare: aratio is ai / acount
        aggregate: aratio
      }
    `);
    expect(m).modelCompiled();
    const t = m.translate();
    if (t.translated) {
      const q = t.translated.queryList[0].pipeline[0];
      if (q.type === 'reduce' && q.extendSource) {
        expect(q.extendSource.length).toBe(1);
        const f = q.extendSource[0];
        expect(f.type).toBe('number');
        if (f.type === 'number') {
          expect(expressionIsCalculation(f.expressionType)).toBeTruthy();
        }
      } else {
        fail('Did not generate extendSource');
      }
    }
  });
  test('refine query source with join', () => {
    const m = new TestTranslator(`
      query: ab -> aturtle + {
        join_one: bb is b on bb.astr = astr
        group_by: foo is bb.astr
      }
    `);
    expect(m).modelCompiled();
    const t = m.translate();
    if (t.translated) {
      const q = t.translated.queryList[0].pipeline[0];
      if (q.type === 'reduce' && q.extendSource) {
        expect(q.extendSource.length).toBe(1);
        expect(q.extendSource[0].type).toBe('struct');
      } else {
        fail('Did not generate extendSource');
      }
    }
  });
});

describe('literals', () => {
  test('integer', exprOK('42'));
  test('string', exprOK("'fortywo-two'"));
  test('string with quoted quote', exprOK("'Isn" + '\\' + "'t this nice'"));
  test('string with quoted backslash', exprOK("'Is " + '\\' + '\\' + " nice'"));
  const literalTimes: [string, string, string | undefined, unknown][] = [
    ['@1960', 'date', 'year', {literal: '1960-01-01'}],
    ['@1960-Q2', 'date', 'quarter', {literal: '1960-04-01'}],
    ['@1960-06', 'date', 'month', {literal: '1960-06-01'}],
    ['@1960-06-26-WK', 'date', 'week', {literal: '1960-06-26'}],
    ['@1960-06-30-WK', 'date', 'week', {literal: '1960-06-26'}],
    ['@1960-06-30', 'date', 'day', {literal: '1960-06-30'}],
    ['@1960-06-30 10', 'timestamp', 'hour', {literal: '1960-06-30 10:00:00'}],
    [
      '@1960-06-30 10:30',
      'timestamp',
      'minute',
      {literal: '1960-06-30 10:30:00'},
    ],
    [
      '@1960-06-30 10:30:00',
      'timestamp',
      undefined,
      {literal: '1960-06-30 10:30:00'},
    ],
    [
      '@1960-06-30 10:30:00.123',
      'timestamp',
      undefined,
      {literal: '1960-06-30 10:30:00.123'},
    ],
    [
      '@1960-06-30T10:30:00',
      'timestamp',
      undefined,
      {literal: '1960-06-30 10:30:00'},
    ],
    [
      '@1960-06-30 10:30:00+0',
      'timestamp',
      undefined,
      {literal: '1960-06-30 10:30:00', timezone: '+0'},
    ],
    [
      '@1960-06-30 10:30:00-7',
      'timestamp',
      undefined,
      {literal: '1960-06-30 10:30:00', timezone: '-7'},
    ],
    [
      '@1960-06-30 10:30:00-00:15',
      'timestamp',
      undefined,
      {literal: '1960-06-30 10:30:00', timezone: '-00:15'},
    ],
    [
      '@1960-06-30 10:30:00[America/Los_Angeles]',
      'timestamp',
      undefined,
      {
        literal: '1960-06-30 10:30:00',
        timezone: 'America/Los_Angeles',
      },
    ],
  ];
  test.each(literalTimes)('%s', (expr, timeType, timeframe, result) => {
    const exprModel = new BetaExpression(expr);
    expect(exprModel).modelCompiled();
    const ir = exprModel.generated();
    expect(ir.dataType).toEqual(timeType);
    if (timeframe) {
      expect(isGranularResult(ir)).toBeTruthy();
      if (isGranularResult(ir)) {
        expect(ir.timeframe).toEqual(timeframe);
      }
    } else {
      expect(isGranularResult(ir)).toBeFalsy();
    }
    expect(ir.value[0]).toEqual(expect.objectContaining(result));
  });
  const morphicLiterals: [string, string | undefined][] = [
    ['@1960', '1960-01-01 00:00:00'],
    ['@1960-Q2', '1960-04-01 00:00:00'],
    ['@1960-06', '1960-06-01 00:00:00'],
    ['@1960-06-30-Wk', '1960-06-26 00:00:00'],
    ['@1960-06-30', '1960-06-30 00:00:00'],
    ['@1960-06-30 00:00', undefined],
  ];
  test.each(morphicLiterals)('morphic value for %s is %s', (expr, morphic) => {
    const exprModel = new BetaExpression(expr);
    expect(exprModel).modelCompiled();
    const ir = exprModel.generated();
    const morphTo = ir.morphic && ir.morphic['timestamp'];
    if (morphic) {
      expect(morphTo).toBeDefined();
      if (morphTo) {
        expect(morphTo[0]).toEqual(expect.objectContaining({literal: morphic}));
      }
    } else {
      expect(morphTo).toBeUndefined();
    }
  });
  test('minute+locale', exprOK('@1960-06-30 10:30[America/Los_Angeles]'));
  test('second 8601', exprOK('@1960-06-30T10:30:31'));
  test('null', exprOK('null'));
  test('now', exprOK('now'));
  test('true', exprOK('true'));
  test('false', exprOK('false'));
  test('regex', exprOK("r'RegularExpression'"));
});

describe('expressions', () => {
  describe('timeframes', () => {
    const timeframes = [
      'second',
      'minute',
      'hour',
      'day',
      'week',
      'month',
      'quarter',
      'year',
    ];

    test.each(timeframes.map(x => [x]))('truncate %s', unit => {
      expect(new BetaExpression(`ats.${unit}`)).modelParsed();
    });

    // mtoy todo units missing: implement, or document
    const diffable = ['second', 'minute', 'hour', 'day', 'week'];
    test.each(diffable.map(x => [x]))('timestamp difference - %s', unit => {
      expect(new BetaExpression(`${unit}(@2021 to ats)`)).modelParsed();
    });
  });

  test('field name', exprOK('astr'));
  test('function call', exprOK('CURRENT_TIMESTAMP()'));

  describe('operators', () => {
    test('addition', exprOK('42 + 7'));
    test('subtraction', exprOK('42 - 7'));
    test('multiplication', exprOK('42 * 7'));
    test('mod', exprOK('42 % 7'));
    test('division', exprOK('42 / 7'));
    test('unary negation', exprOK('- ai'));
    test('equal', exprOK('42 = 7'));
    test('not equal', exprOK('42 != 7'));
    test('greater than', exprOK('42 > 7'));
    test('greater than or equal', exprOK('42 >= 7'));
    test('less than or equal', exprOK('42 <= 7'));
    test('less than', exprOK('42 < 7'));
    test('match', exprOK("'forty-two' ~ 'fifty-four'"));
    test('not match', exprOK("'forty-two' !~ 'fifty-four'"));
    test('apply', exprOK("'forty-two' ? 'fifty-four'"));
    test('not', exprOK('not true'));
    test('and', exprOK('true and false'));
    test('or', exprOK('true or false'));
  });

  test('filtered measure', exprOK("acount {? astr = 'why?' }"));
  describe('aggregate forms', () => {
    test('count', exprOK('count()'));
    test('count distinct', exprOK('count(distinct astr)'));
    test('join.count()', exprOK('b.count()'));
    for (const f of ['sum', 'min', 'max', 'avg']) {
      const fOfT = `${f}(af)`;
      test(fOfT, exprOK(fOfT));
      if (f !== 'min' && f !== 'max') {
        const joinDot = `b.af.${f}()`;
        test(joinDot, exprOK(joinDot));
        const joinAgg = `b.${f}(af)`;
        test(joinAgg, exprOK(joinAgg));
      }
    }
  });

  describe('pick statements', () => {
    test(
      'full',
      exprOK(`
        pick 'the answer' when ai = 42
        pick 'the questionable answer' when ai = 54
        else 'random'
    `)
    );
    test(
      'applied',
      exprOK(`
        astr ?
          pick 'the answer' when = '42'
          pick 'the questionable answer' when = '54'
          else 'random'
    `)
    );
    test(
      'filtering',
      exprOK(`
        astr ? pick 'missing value' when NULL
    `)
    );
    test(
      'tiering',
      exprOK(`
      ai ?
        pick 1 when < 10
        pick 10 when < 100
        pick 100 when < 1000
        else 10000
  `)
    );
    test(
      'transforming',
      exprOK(`
        ai ?
          pick 'small' when < 10
          pick 'medium' when < 100
          else 'large'
    `)
    );

    test(
      'when single values',
      exprOK(`
        ai ?
          pick 'one' when 1
          else 'a lot'
      `)
    );
    test('n-ary without else', () => {
      expect(markSource`
        explore: na is a + { dimension: d is
          pick 7 when true and true
        }
      `).compileToFailWith(
        "pick incomplete, missing 'else'",
        "Cannot define 'd', value has unknown type"
      );
    });
    test('n-ary with mismatch when clauses', () => {
      expect(markSource`
        explore: na is a + { dimension: d is
          pick 7 when true and true
          pick '7' when true or true
          else 7
        }
      `).compileToFailWith(
        "pick type 'string', expected 'number'",
        "Cannot define 'd', value has unknown type"
      );
    });
    test('n-ary with mismatched else clause', () => {
      expect(markSource`
        explore: na is a + { dimension: d is
          pick 7 when true and true
          else '7'
        }
      `).compileToFailWith(
        "else type 'string', expected 'number'",
        "Cannot define 'd', value has unknown type"
      );
    });
    test('applied else mismatch', () => {
      expect(markSource`
        explore: na is a + { dimension: d is
          7 ? pick 7 when 7 else 'not seven'
        }
      `).compileToFailWith(
        "else type 'string', expected 'number'",
        "Cannot define 'd', value has unknown type"
      );
    });
    test('applied default mismatch', () => {
      expect(markSource`
        explore: na is a + { dimension: d is
          7 ? pick 'seven' when 7
        }
      `).compileToFailWith(
        "pick default type 'number', expected 'string'",
        "Cannot define 'd', value has unknown type"
      );
    });
    test('applied when mismatch', () => {
      expect(markSource`
        explore: na is a + { dimension: d is
          7 ? pick 'seven' when 7 pick 6 when 6
        }
      `).compileToFailWith(
        "pick type 'number', expected 'string'",
        "Cannot define 'd', value has unknown type"
      );
    });
  });
  test('paren and applied div', () => {
    const modelSrc = 'query: z is a -> { group_by: x is 1+(3/4) }';
    const m = new TestTranslator(modelSrc);
    expect(m).modelCompiled();
    const queryDef = m.translate()?.translated?.modelDef.contents['z'];
    expect(queryDef).toBeDefined();
    expect(queryDef?.type).toBe('query');
    if (queryDef && queryDef.type === 'query') {
      const x = queryDef.pipeline[0].fields[0];
      if (
        typeof x !== 'string' &&
        !isFilteredAliasedName(x) &&
        isFieldTypeDef(x) &&
        x.type === 'number' &&
        x.e
      ) {
        const firstFrag = x.e[0];
        if (typeof firstFrag === 'string') {
          expect(firstFrag).toContain('(');
        } else {
          fail('expression with parens compiled oddly');
        }
      } else {
        fail('expression with parens compiled oddly');
      }
    }
  });
});
describe('unspported fields in schema', () => {
  test('unsupported reference in result allowed', () => {
    const uModel = new TestTranslator('query: a->{ group_by: aun }');
    expect(uModel).modelCompiled();
  });
  test('unsupported reference can be compared to NULL', () => {
    const uModel = new TestTranslator(
      'query: a->{ where: aun != NULL; project: * }'
    );
    expect(uModel).modelCompiled();
  });
  test('flag unsupported equality', () => {
    // because we don't know if the two unsupported types are comparable
    const uModel = new TestTranslator(
      'query: ab->{ where: aun = b.aun  project: * }'
    );
    expect(uModel).compileToFailWith(
      'Unsupported type not allowed in expression'
    );
  });
  test('flag unsupported compare', () => {
    // because we don't know if the two unsupported types are comparable
    const uModel = new TestTranslator(
      'query: ab->{ where: aun > b.aun  project: * }'
    );
    expect(uModel).compileToFailWith(
      'Unsupported type not allowed in expression'
    );
  });
  test('allow unsupported equality when raw types match', () => {
    const uModel = new TestTranslator(
      'query: ab->{ where: aweird = b.aweird  project: * }'
    );
    expect(uModel).modelCompiled();
  });
  test('flag not applied to unsupported', () => {
    const uModel = new TestTranslator(
      'source: x is a { dimension: notUn is not aun }'
    );
    expect(uModel).compileToFailWith("'not' Can't use type unsupported");
  });
  test('allow unsupported to be cast', () => {
    const uModel = new TestTranslator(
      'source: x is a { dimension: notUn is aun::string }'
    );
    expect(uModel).modelCompiled();
  });
});

describe('error handling', () => {
  test('field and query with same name does not overflow', () => {
    expect(`
      source: flights is table('malloytest.flights') {
        query: carrier is { group_by: carrier }
      }
    `).compileToFailWith("Cannot redefine 'carrier'");
  });
  test('redefine source', () => {
    expect(markSource`
      source: airports is table('malloytest.airports') + {
        primary_key: code
      }
      source: airports is table('malloytest.airports') + {
        primary_key: code
      }
    `).compileToFailWith("Cannot redefine 'airports'");
  });
  test('query from undefined source', () => {
    expect(markSource`query: ${'x'}->{ project: y }`).compileToFailWith(
      "Undefined source 'x'"
    );
  });
  test('query with expression from undefined source', () => {
    // Regression check: Once upon a time this died with an exception even
    // when "query: x->{ group_by: y}" (above) generated the correct error.
    expect(
      markSource`query: ${'x'}->{ project: y is z / 2 }`
    ).compileToFailWith("Undefined source 'x'");
  });
  test('join reference before definition', () => {
    expect(
      markSource`
        explore: newAB is a { join_one: newB is ${'bb'} on astring }
        explore: newB is b
      `
    ).compileToFailWith("Undefined source 'bb'");
  });
  test(
    'non-rename rename',
    badModel(
      'explore: na is a { rename: astr is astr }',
      "Can't rename field to itself"
    )
  );
  test(
    'reference to field in its definition',
    badModel(
      'explore: na is a { dimension: ustr is UPPER(ustr) } ',
      "Circular reference to 'ustr' in definition"
    )
  );
  test('empty model', modelOK(''));
  test('one line model ', modelOK('\n'));
  test(
    'query without fields',
    badModel(
      'query: a -> { top: 5 }',
      "Can't determine query type (group_by/aggregate/nest,project,index)"
    )
  );
  test(
    "refine can't change query type",
    badModel(
      'query: ab -> aturtle { project: astr }',
      'project: not legal in grouping query'
    )
  );
  test(
    'undefined field ref in query',
    badModel('query: ab -> { aggregate: xyzzy }', "'xyzzy' is not defined")
  );
  test('query on source with errors', () => {
    expect(markSource`
        explore: na is a { join_one: ${'n'} on astr }
      `).compileToFailWith("Undefined source 'n'");
  });
  test('detect duplicate output field names', () => {
    expect(
      markSource`query: ab -> { group_by: astr, ${'astr'} }`
    ).compileToFailWith("Output already has a field named 'astr'");
  });
  test('detect join tail overlap existing ref', () => {
    expect(
      markSource`query: ab -> { group_by: astr, ${'b.astr'} }`
    ).compileToFailWith("Output already has a field named 'astr'");
  });
  test('undefined in expression with regex compare', () => {
    expect(
      `
        source: c is a {
          dimension: d is meaning_of_life ~ r'(forty two|fifty four)'
        }
      `
    ).compileToFailWith("'meaning_of_life' is not defined");
  });
  test('detect output collision on join references', () => {
    expect(`
      query: ab -> {
        group_by: astr, b.astr
      }
    `).compileToFailWith("Output already has a field named 'astr'");
  });
  test(
    'rejoin a query is renamed',
    modelOK(`
      source: querySrc is from(
        table('malloytest.flights')->{
          group_by: origin
          nest: nested is { group_by: destination }
        }
      )

    source: refineQuerySrc is querySrc {
      join_one: rejoin is querySrc on 7=8
      query: broken is {
        group_by: rejoin.nested.destination
      }
    }
    `)
  );
  test('popping out of embedding when not embedded', () => {
    expect('}%').compileToFailWith(
      "extraneous input '}%' expecting {<EOF>, EXPLORE, QUERY, SOURCE, SQL, IMPORT, ';'}"
    );
  });

  test('bad sql in sql block', () => {
    const badModel = new TestTranslator('sql: { select: """)""" }');
    expect(badModel).modelParsed();
    const needSchema = badModel.translate();
    expect(needSchema.compileSQL).toBeDefined();
    if (needSchema.compileSQL) {
      badModel.update({
        errors: {
          compileSQL: {
            [needSchema.compileSQL.name]: 'ZZZZ',
          },
        },
      });
    }
    expect(badModel).compileToFailWith('Invalid SQL, ZZZZ');
  });
});

function getSelectOneStruct(sqlBlock: SQLBlockSource): SQLBlockStructDef {
  const selectThis = sqlBlock.select[0];
  if (!isSQLFragment(selectThis)) {
    throw new Error('weird test support error sorry');
  }
  return {
    type: 'struct',
    name: sqlBlock.name,
    dialect: 'bigquery',
    structSource: {
      type: 'sql',
      method: 'subquery',
      sqlBlock: {
        type: 'sqlBlock',
        name: sqlBlock.name,
        selectStr: selectThis.sql,
      },
    },
    structRelationship: {type: 'basetable', connectionName: 'bigquery'},
    fields: [{type: 'number', name: 'one'}],
  };
}

describe('source locations', () => {
  test('renamed explore location', () => {
    const source = markSource`explore: ${'na is a'}`;
    const m = new TestTranslator(source.code);
    expect(m).modelParsed();
    expect(getExplore(m.modelDef, 'na').location).toMatchObject(
      source.locations[0]
    );
  });

  test('refined explore location', () => {
    const source = markSource`explore: ${'na is a {}'}`;
    const m = new TestTranslator(source.code);
    expect(m).modelParsed();
    expect(getExplore(m.modelDef, 'na').location).toMatchObject(
      source.locations[0]
    );
  });

  test('location of defined dimension', () => {
    const source = markSource`explore: na is a { dimension: ${'x is 1'} }`;
    const m = new TestTranslator(source.code);
    expect(m).modelCompiled();
    const na = getExplore(m.modelDef, 'na');
    const x = getField(na, 'x');
    expect(x.location).toMatchObject(source.locations[0]);
  });

  test('location of defined measure', () => {
    const source = markSource`explore: na is a { measure: ${'x is count()'} }`;
    const m = new TestTranslator(source.code);
    expect(m).modelCompiled();
    const na = getExplore(m.modelDef, 'na');
    const x = getField(na, 'x');
    expect(x.location).toMatchObject(source.locations[0]);
  });

  test('location of defined query', () => {
    const source = markSource`explore: na is a { query: ${'x is { group_by: y is 1 }'} }`;
    const m = new TestTranslator(source.code);
    expect(m).modelCompiled();
    const na = getExplore(m.modelDef, 'na');
    const x = getField(na, 'x');
    expect(x.location).toMatchObject(source.locations[0]);
  });

  test('location of defined field inside a query', () => {
    const source = markSource`
      explore: na is a {
        query: x is {
          group_by: ${'y is 1'}
        }
      }`;

    const m = new TestTranslator(source.code);
    expect(m).modelCompiled();
    const na = getExplore(m.modelDef, 'na');
    const x = getQueryField(na, 'x');
    const y = getField(x.pipeline[0], 'y');
    expect(y.location).toMatchObject(source.locations[0]);
  });

  test('location of filtered field inside a query', () => {
    const source = markSource`
      explore: na is a {
        measure: y is count()
        query: x is {
          group_by: ${'z is y { where: true }'}
        }
      }`;

    const m = new TestTranslator(source.code);
    expect(m).modelCompiled();
    const na = getExplore(m.modelDef, 'na');
    const x = getQueryField(na, 'x');
    const z = getField(x.pipeline[0], 'z');
    expect(z.location).toMatchObject(source.locations[0]);
  });

  test('location of field inherited from table', () => {
    const source = markSource`explore: na is ${"table('aTable')"}`;
    const m = new TestTranslator(source.code);
    expect(m).modelCompiled();
    const na = getExplore(m.modelDef, 'na');
    const abool = getField(na, 'abool');
    expect(abool.location).toMatchObject(source.locations[0]);
  });

  test('location of field inherited from sql block', () => {
    const source = markSource`--- comment
      sql: s is { select: ${'"""SELECT 1 as one """'} }
      explore: na is from_sql(s)
    `;
    const m = new TestTranslator(source.code);
    expect(m).modelParsed();
    const compileSql = m.translate().compileSQL;
    expect(compileSql).toBeDefined();
    if (compileSql) {
      m.update({
        compileSQL: {[compileSql.name]: getSelectOneStruct(compileSql)},
      });
      expect(m).modelCompiled();
      const na = getExplore(m.modelDef, 'na');
      const one = getField(na, 'one');
      expect(one.location).isLocationIn(source.locations[0], source.code);
    }
  });

  test('location of fields inherited from a query', () => {
    const source = markSource`
      explore: na is from(
        ${"table('aTable')"} -> {
          group_by:
            abool
            ${'y is 1'}
        }
      )
    `;
    const m = new TestTranslator(source.code);
    expect(m).modelCompiled();
    const na = getExplore(m.modelDef, 'na');
    const abool = getField(na, 'abool');
    expect(abool.location).toMatchObject(source.locations[0]);
    const y = getField(na, 'y');
    expect(y.location).toMatchObject(source.locations[1]);
  });

  test('location of named query', () => {
    const source = markSource`query: ${'q is a -> { project: * }'}`;
    const m = new TestTranslator(source.code);
    expect(m).modelCompiled();
    const q = getExplore(m.modelDef, 'q');
    expect(q.location).toMatchObject(source.locations[0]);
  });

  test('location of field in named query', () => {
    const source = markSource`query: q is a -> { group_by: ${'b is 1'} }`;
    const m = new TestTranslator(source.code);
    expect(m).modelCompiled();
    const q = getModelQuery(m.modelDef, 'q');
    const a = getField(q.pipeline[0], 'b');
    expect(a.location).toMatchObject(source.locations[0]);
  });

  test('location of named SQL block', () => {
    const source = markSource`${'sql: s is { select: """SELECT 1 as one""" }'}`;
    const m = new TestTranslator(source.code);
    expect(m).modelParsed();
    const compileSql = m.translate().compileSQL;
    expect(compileSql).toBeDefined();
    if (compileSql) {
      m.update({
        compileSQL: {[compileSql.name]: getSelectOneStruct(compileSql)},
      });
      expect(m).modelCompiled();
      const s = m.sqlBlocks[0];
      expect(s.location).isLocationIn(source.locations[0], source.code);
    }
  });

  test('location of renamed field', () => {
    const source = markSource`
      explore: na is a {
        rename: ${'bbool is abool'}
      }
    `;
    const m = new TestTranslator(source.code);
    expect(m).modelCompiled();
    const na = getExplore(m.modelDef, 'na');
    const bbool = getField(na, 'bbool');
    expect(bbool.location).toMatchObject(source.locations[0]);
  });

  test('location of join on', () => {
    const source = markSource`
      explore: na is a {
        join_one: ${'x is a { primary_key: abool } on abool'}
      }
    `;
    const m = new TestTranslator(source.code);
    expect(m).modelCompiled();
    const na = getExplore(m.modelDef, 'na');
    const x = getField(na, 'x');
    expect(x.location).toMatchObject(source.locations[0]);
  });

  test('location of join with', () => {
    const source = markSource`
      explore: na is a {
        join_one: ${'x is a { primary_key: astr } with astr'}
      }
    `;
    const m = new TestTranslator(source.code);
    expect(m).modelCompiled();
    const na = getExplore(m.modelDef, 'na');
    const x = getField(na, 'x');
    expect(x.location).toMatchObject(source.locations[0]);
  });

  test('location of field in join', () => {
    const source = markSource`
      explore: na is a {
        join_one: x is a {
          primary_key: abool
          dimension: ${'y is 1'}
        } on abool
      }
    `;
    const m = new TestTranslator(source.code);
    expect(m).modelCompiled();
    const na = getExplore(m.modelDef, 'na');
    const x = getJoinField(na, 'x');
    const y = getField(x, 'y');
    expect(y.location).toMatchObject(source.locations[0]);
  });

  // Since """ strings are not single tokens, I don't know how to do this.
  // test("multi line sql block token span is correct", () => {
  //   const sqlSource = `sql: { select: """// line 0\n//line 1\n// line 2""" }`;
  //   const m = new TestTranslator(sqlSource);
  //   expect(m).not.modelParsed();
  //   const errList = m.errors().errors;
  //   expect(errList[0].at?.range.end).toEqual({ line: 2, character: 11 });
  // });

  test(
    'undefined query location',
    badModel(
      markSource`query: ${'-> xyz'}`,
      "Reference to undefined query 'xyz'"
    )
  );
  test(
    'undefined field reference',
    badModel(
      markSource`query: a -> { group_by: ${'xyz'} }`,
      "'xyz' is not defined"
    )
  );
  test(
    'bad query',
    badModel(
      markSource`query: a -> { group_by: astr; ${'project: *'} }`,
      'project: not legal in grouping query'
    )
  );

  test.skip(
    'undefined field reference in top',
    badModel(
      markSource`query: a -> { group_by: one is 1; top: 1 by ${'xyz'} }`,
      "'xyz' is not defined"
    )
  );

  test.skip(
    'undefined field reference in order_by',
    badModel(
      markSource`query: a -> { group_by: one is 1; order_by: ${'xyz'} }`,
      "'xyz' is not defined"
    )
  );
});

describe('source references', () => {
  test('reference to explore', () => {
    const source = markSource`
      explore: ${'na is a'}
      query: ${'na'} -> { project: * }
    `;
    const m = new TestTranslator(source.code);
    expect(m).modelCompiled();
    expect(m.referenceAt(pos(source.locations[1]))).toMatchObject({
      location: source.locations[1],
      type: 'exploreReference',
      text: 'na',
      definition: {
        location: source.locations[0],
      },
    });
  });

  test('reference to query in query', () => {
    const source = markSource`
      explore: t is a {
        query: ${'q is { project: * }'}
      }
      query: t -> ${'q'}
    `;
    const m = new TestTranslator(source.code);
    expect(m).modelCompiled();
    expect(m.referenceAt(pos(source.locations[1]))).toMatchObject({
      location: source.locations[1],
      type: 'fieldReference',
      text: 'q',
      definition: {
        location: source.locations[0],
      },
    });
  });

  test('reference to query in query (version 2)', () => {
    const source = markSource`
      explore: na is a { query: ${'x is { group_by: y is 1 }'} }
      query: na -> ${'x'}
    `;
    const m = new TestTranslator(source.code);
    expect(m).modelCompiled();
    expect(m.referenceAt(pos(source.locations[1]))).toMatchObject({
      location: source.locations[1],
      type: 'fieldReference',
      text: 'x',
      definition: {
        location: source.locations[0],
      },
    });
  });

  test('reference to sql block', () => {
    const source = markSource`
      ${'sql: s is {select:"""SELECT 1 as one"""}'}
      explore: na is from_sql(${'s'})
    `;
    const m = new TestTranslator(source.code);
    expect(m).modelParsed();
    const compileSql = m.translate().compileSQL;
    expect(compileSql).toBeDefined();
    if (compileSql) {
      m.update({
        compileSQL: {[compileSql.name]: getSelectOneStruct(compileSql)},
      });
      expect(m).modelCompiled();
      const ref = m.referenceAt(pos(source.locations[1]));
      expect(ref).toMatchObject({
        location: source.locations[1],
        type: 'sqlBlockReference',
        text: 's',
        definition: {
          ...getSelectOneStruct(compileSql),
          location: source.locations[0],
        },
      });
    }
  });

  test('reference to query in from', () => {
    const source = markSource`
      query: ${'q is a -> { project: * }'}
      explore: na is from(-> ${'q'})
    `;
    const m = new TestTranslator(source.code);
    expect(m).modelCompiled();
    expect(m.referenceAt(pos(source.locations[1]))).toMatchObject({
      location: source.locations[1],
      type: 'queryReference',
      text: 'q',
      definition: {
        location: source.locations[0],
      },
    });
  });

  test('reference to query in query head', () => {
    const source = markSource`
      query: ${'q is a -> { project: * }'}
      query: q2 is -> ${'q'} -> { project: * }
    `;
    const m = new TestTranslator(source.code);
    expect(m).modelCompiled();
    expect(m.referenceAt(pos(source.locations[1]))).toMatchObject({
      location: source.locations[1],
      type: 'queryReference',
      text: 'q',
      definition: {
        location: source.locations[0],
      },
    });
  });

  test('reference to query in refined query', () => {
    const source = markSource`
      query: ${'q is a -> { project: * }'}
      query: q2 is -> ${'q'} { limit: 10 }
    `;
    const m = new TestTranslator(source.code);
    expect(m).modelCompiled();
    expect(m.referenceAt(pos(source.locations[1]))).toMatchObject({
      location: source.locations[1],
      type: 'queryReference',
      text: 'q',
      definition: {
        location: source.locations[0],
      },
    });
  });

  test('reference to field in expression', () => {
    const source = markSource`
      explore: na is ${"table('aTable')"}
      query: na -> { project: bbool is not ${'abool'} }
    `;
    const m = new TestTranslator(source.code);
    expect(m).modelCompiled();
    expect(m.referenceAt(pos(source.locations[1]))).toMatchObject({
      location: source.locations[1],
      type: 'fieldReference',
      text: 'abool',
      definition: {
        location: source.locations[0],
      },
    });
  });

  test('reference to quoted field in expression', () => {
    const source = markSource`
      explore: na is a {
        dimension: ${"`name` is 'name'"}
      }
      query: na -> { project: ${'`name`'} }
    `;
    const m = new TestTranslator(source.code);
    expect(m).modelCompiled();
    expect(m.referenceAt(pos(source.locations[1]))).toMatchObject({
      location: source.locations[1],
      type: 'fieldReference',
      text: 'name',
      definition: {
        location: source.locations[0],
      },
    });
  });

  test('reference to joined field in expression', () => {
    const source = markSource`
      explore: na is a {
        join_one: self is ${"table('aTable')"}
          on astr = self.astr
      }
      query: na -> { project: bstr is self.${'astr'} }
    `;
    const m = new TestTranslator(source.code);
    expect(m).modelCompiled();
    expect(m.referenceAt(pos(source.locations[1]))).toMatchObject({
      location: source.locations[1],
      type: 'fieldReference',
      text: 'astr',
      definition: {
        location: source.locations[0],
      },
    });
  });

  test('reference to joined join in expression', () => {
    const source = markSource`
      explore: na is a {
        join_one: ${'self is a on astr = self.astr'}
      }
      query: na -> { project: bstr is ${'self'}.astr }
    `;
    const m = new TestTranslator(source.code);
    expect(m).modelCompiled();
    expect(m.referenceAt(pos(source.locations[1]))).toMatchObject({
      location: source.locations[1],
      type: 'joinReference',
      text: 'self',
      definition: {
        location: source.locations[0],
      },
    });
  });

  test('reference to field not in expression (group by)', () => {
    const source = markSource`
      query: ${"table('aTable')"} -> { group_by: ${'abool'} }
    `;
    const m = new TestTranslator(source.code);
    expect(m).modelCompiled();
    expect(m.referenceAt(pos(source.locations[1]))).toMatchObject({
      location: source.locations[1],
      type: 'fieldReference',
      text: 'abool',
      definition: {
        location: source.locations[0],
      },
    });
  });

  test('reference to field not in expression (project)', () => {
    const source = markSource`
      explore: na is ${"table('aTable')"}
      query: na -> { project: ${'abool'} }
    `;
    const m = new TestTranslator(source.code);
    expect(m).modelCompiled();
    expect(m.referenceAt(pos(source.locations[1]))).toMatchObject({
      location: source.locations[1],
      type: 'fieldReference',
      text: 'abool',
      definition: {
        location: source.locations[0],
      },
    });
  });

  test.skip('reference to field in order by', () => {
    const source = markSource`
      query: ${"table('aTable')"} -> {
        group_by: abool
        order_by: ${'abool'}
      }
    `;
    const m = new TestTranslator(source.code);
    expect(m).modelCompiled();
    expect(m.referenceAt(pos(source.locations[1]))).toMatchObject({
      location: source.locations[1],
      type: 'fieldReference',
      text: 'abool',
      definition: {
        location: source.locations[0],
      },
    });
  });

  test.skip('reference to field in order by (output space)', () => {
    const source = markSource`
      query: a -> {
        group_by: ${'one is 1'}
        order_by: ${'one'}
      }
    `;
    const m = new TestTranslator(source.code);
    expect(m).modelCompiled();
    expect(m.referenceAt(pos(source.locations[1]))).toMatchObject({
      location: source.locations[1],
      type: 'fieldReference',
      text: 'abool',
      definition: {
        location: source.locations[0],
      },
    });
  });

  test('reference to field in aggregate', () => {
    const source = markSource`
      query: a { measure: ${'c is count()'} } -> {
        group_by: abool
        aggregate: ${'c'}
      }
    `;
    const m = new TestTranslator(source.code);
    expect(m).modelCompiled();
    expect(m.referenceAt(pos(source.locations[1]))).toMatchObject({
      location: source.locations[1],
      type: 'fieldReference',
      text: 'c',
      definition: {
        location: source.locations[0],
      },
    });
  });

  test('reference to field in measure', () => {
    const source = markSource`
      explore: e is a {
        measure: ${'c is count()'}
        measure: c2 is ${'c'}
      }
    `;
    const m = new TestTranslator(source.code);
    expect(m).modelCompiled();
    expect(m.referenceAt(pos(source.locations[1]))).toMatchObject({
      location: source.locations[1],
      type: 'fieldReference',
      text: 'c',
      definition: {
        location: source.locations[0],
      },
    });
  });

  test.skip('reference to field in top', () => {
    const source = markSource`
      query: ${"table('aTable')"} -> {
        group_by: abool
        top: 10 by ${'abool'}
      }
    `;
    const m = new TestTranslator(source.code);
    expect(m).modelCompiled();
    expect(m.referenceAt(pos(source.locations[1]))).toMatchObject({
      location: source.locations[1],
      type: 'fieldReference',
      text: 'abool',
      definition: {
        location: source.locations[0],
      },
    });
  });

  test.skip('reference to field in top (output space)', () => {
    const source = markSource`
      query: a -> {
        group_by: ${'one is 1'}
        top: 10 by ${'one'}
      }
    `;
    const m = new TestTranslator(source.code);
    expect(m).modelCompiled();
    expect(m.referenceAt(pos(source.locations[1]))).toMatchObject({
      location: source.locations[1],
      type: 'fieldReference',
      text: 'abool',
      definition: {
        location: source.locations[0],
      },
    });
  });

  test('reference to field in filter', () => {
    const source = markSource`
      query: ${"table('aTable')"} -> {
        group_by: abool
        where: ${'abool'}
      }
    `;
    const m = new TestTranslator(source.code);
    expect(m).modelCompiled();
    expect(m.referenceAt(pos(source.locations[1]))).toMatchObject({
      location: source.locations[1],
      type: 'fieldReference',
      text: 'abool',
      definition: {
        location: source.locations[0],
      },
    });
  });

  test('reference to field in aggregate source', () => {
    const source = markSource`
      explore: na is ${"table('aTable')"}
      query: na -> { aggregate: ai_sum is ${'ai'}.sum() }
    `;
    const m = new TestTranslator(source.code);
    expect(m).modelCompiled();
    expect(m.referenceAt(pos(source.locations[1]))).toMatchObject({
      location: source.locations[1],
      type: 'fieldReference',
      text: 'ai',
      definition: {
        location: source.locations[0],
      },
    });
  });

  function pos(location: DocumentLocation): DocumentPosition {
    return location.range.start;
  }

  test('reference to join in aggregate source', () => {
    const source = markSource`
      explore: na is a {
        join_one: ${'self is a on astr = self.astr'}
      }
      query: na -> { aggregate: ai_sum is ${'self'}.sum(self.ai) }
    `;
    const m = new TestTranslator(source.code);
    expect(m).modelCompiled();
    expect(m.referenceAt(pos(source.locations[1]))).toMatchObject({
      location: source.locations[1],
      type: 'joinReference',
      text: 'self',
      definition: {
        location: source.locations[0],
      },
    });
  });

  test('reference to join in aggregate in expr', () => {
    const source = markSource`
      explore: na is a {
        join_one: ${'self is a on astr = self.astr'}
      }
      query: na -> { aggregate: ai_sum is self.sum(${'self'}.ai) }
    `;
    const m = new TestTranslator(source.code);
    expect(m).modelCompiled();
    expect(m.referenceAt(pos(source.locations[1]))).toMatchObject({
      location: source.locations[1],
      type: 'joinReference',
      text: 'self',
      definition: {
        location: source.locations[0],
      },
    });
  });

  test('reference to explore in join', () => {
    const source = markSource`
      explore: ${'exp1 is a'}
      explore: exp2 is a {
        join_one: ${'exp1'} on astr = exp1.astr
      }
    `;
    const m = new TestTranslator(source.code);
    expect(m).modelCompiled();
    expect(m.referenceAt(pos(source.locations[1]))).toMatchObject({
      location: source.locations[1],
      type: 'exploreReference',
      text: 'exp1',
      definition: {
        location: source.locations[0],
      },
    });
  });

  test('reference to field in aggregate (in expr)', () => {
    const source = markSource`
      explore: na is ${"table('aTable')"}
      query: na -> { aggregate: ai_sum is sum(${'ai'}) }
    `;
    const m = new TestTranslator(source.code);
    expect(m).modelCompiled();
    expect(m.referenceAt(pos(source.locations[1]))).toMatchObject({
      location: source.locations[1],
      type: 'fieldReference',
      text: 'ai',
      definition: {
        location: source.locations[0],
      },
    });
  });

  test('reference to field in rename', () => {
    const source = markSource`
      explore: na is ${"table('aTable')"} {
        rename: bbool is ${'abool'}
      }
    `;
    const m = new TestTranslator(source.code);
    expect(m).modelCompiled();
    expect(m.referenceAt(pos(source.locations[1]))).toMatchObject({
      location: source.locations[1],
      type: 'fieldReference',
      text: 'abool',
      definition: {
        location: source.locations[0],
      },
    });
  });

  test('reference to field in join with', () => {
    const source = markSource`
      explore: exp1 is a { primary_key: astr }
      explore: exp2 is ${"table('aTable')"} {
        join_one: exp1 with ${'astr'}
      }
    `;
    const m = new TestTranslator(source.code);
    expect(m).modelCompiled();
    expect(m.referenceAt(pos(source.locations[1]))).toMatchObject({
      location: source.locations[1],
      type: 'fieldReference',
      text: 'astr',
      definition: {
        location: source.locations[0],
      },
    });
  });
});

describe('translation need error locations', () => {
  test('import error location', () => {
    const source = markSource`import ${'"badfile"'}`;
    const m = new TestTranslator(source.code);
    const result = m.translate();
    m.update({
      errors: {urls: {[(result.urls || [])[0]]: 'Bad file!'}},
    });
    expect(m).not.modelParsed();
    const errList = m.errors().errors;
    expect(errList[0].at).isLocationIn(source.locations[0], source.code);
    return undefined;
  });

  test('sql struct error location', () => {
    const source = markSource`
      sql: bad_sql is {select: ${'"""BAD_SQL"""'}}
      query: from_sql(bad_sql) -> { project: * }
    `;
    const m = new TestTranslator(source.code);
    expect(m).modelParsed();
    const req = m.translate().compileSQL;
    expect(req).toBeDefined();
    if (req) {
      m.update({errors: {compileSQL: {[req.name]: 'Bad SQL!'}}});
    }
    expect(m).not.modelCompiled();
    const errList = m.errors().errors;
    expect(errList[0].at).isLocationIn(source.locations[0], source.code);
  });

  test('table struct error location', () => {
    const source = markSource`
      explore: bad_explore is ${"table('malloy-data.bad.table')"}
    `;
    const m = new TestTranslator(source.code);
    const result = m.translate();
    m.update({
      errors: {
        tables: {[(result.tables || [])[0]]: 'Bad table!'},
      },
    });
    expect(m).not.modelParsed();
    const errList = m.errors().errors;
    expect(errList[0].at).isLocationIn(source.locations[0], source.code);
    return undefined;
  });
});

describe('pipeline comprehension', () => {
  test(
    'second query gets namespace from first',
    modelOK(`
      explore: aq is a {
        query: t1 is {
          group_by: t1int is ai, t1str is astr
        } -> {
          project: t1str, t1int
        }
      }
    `)
  );
  test(
    "second query doesn't have access to original fields",
    badModel(
      markSource`
        explore: aq is a {
          query: t1 is {
            group_by: t1int is ai, t1str is astr
          } -> {
            project: ${'ai'}
          }
        }
      `,
      "'ai' is not defined"
    )
  );
  test(
    'new query can append ops to existing query',
    modelOK(`
      explore: aq is a {
        query: t0 is {
          group_by: t1int is ai, t1str is astr
        }
        query: t1 is t0 -> {
          project: t1str, t1int
        }
      }
    `)
  );
  test(
    'new query can refine and append to exisiting query',
    modelOK(`
      explore: aq is table('aTable') {
        query: by_region is { group_by: astr }
        query: by_region2 is by_region {
          nest: dateNest is { group_by: ad }
        } -> {
          project: astr, dateNest.ad
        }
      }
    `)
  );
  test(
    'reference to a query can include a refinement',
    modelOK(`
      query: ab -> {
        group_by: ai
        nest: aturtle { limit: 1 }
      }
    `)
  );
  test(
    'Querying an explore based on a query',
    modelOK(`
      query: q is a -> { group_by: astr; aggregate: strsum is ai.sum() }
      explore: aq is a {
        join_one: aq is from(->q) on astr = aq.astr
      }
      query: aqf is aq -> { project: * }
    `)
  );
  test('new query appends to existing query', () => {
    const src = `
      query: s1 is table('malloytest.flights') -> {
        group_by: origin, destination
      }
      query: s2 is ->s1 ->{
        group_by: destination
      }
    `;
    const m = new TestTranslator(src);
    expect(m).modelCompiled();
    const s2 = m.getQuery('s2');
    expect(s2?.pipeline.length).toBe(2);
  });
});

describe('standard sql function return types', () => {
  test('timestamp_seconds', () => {
    expect('timestamp_seconds(0)').toReturnType('timestamp');
  });
});
