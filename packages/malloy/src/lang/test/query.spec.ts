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
  TestTranslator,
  aTableDef,
  markSource,
  model,
  errorMessage,
  warningMessage,
  error,
} from './test-translator';
import './parse-expects';
import {
  Query,
  QueryFieldDef,
  QuerySegment,
  expressionIsCalculation,
  isJoined,
  isQuerySegment,
  isAtomic,
} from '../../model';

function getFirstQuerySegment(q: Query | undefined): QuerySegment | undefined {
  const qSeg = q?.pipeline[0];
  if (qSeg && isQuerySegment(qSeg)) {
    return qSeg;
  }
}

function getFirstSegmentFields(q: Query | undefined): QueryFieldDef[] {
  const qSeg = getFirstQuerySegment(q);
  return qSeg?.queryFields ?? [];
}

function getFirstSegmentFieldNames(q: Query | undefined): string[] {
  const qf = getFirstSegmentFields(q);
  return qf.map(f =>
    f.type === 'fieldref' && f.path.length === 1
      ? f.path[0]
      : `expected simple ref, got ${JSON.stringify(f)}`
  );
}

describe('query:', () => {
  describe('basic query syntax', () => {
    test('run:anonymous query', () =>
      expect('run: a -> { group_by: astr }').toTranslate());
    test('query:anonymous query m4 warning', () => {
      expect(
        markSource`##! m4warnings=warn
          query: ${'a  -> { group_by: astr }'}`
      ).toLog(
        warningMessage(
          'Anonymous `query:` statements are deprecated, use `run:` instead'
        )
      );
    });
    test('named query:', () =>
      expect('query: aq is a -> { group_by: astr }').toTranslate());
    test('run query ref', () =>
      expect(`
        query: foo is a -> { group_by: astr }
        run: foo
    `).toTranslate());
    test('query from query', () => {
      expect(
        `
        query: q1 is ab->{ group_by: astr limit: 10 }
        query: q2 is q1
      `
      ).toTranslate();
    });
    test('query with refinements from query', () => {
      expect(
        `
        query: q1 is ab->{ group_by: astr limit: 10 }
        query: q2 is q1 + { aggregate: acount }
      `
      ).toTranslate();
    });
    test('chained query operations', () => {
      expect(`
      run: ab
        -> { group_by: astr; aggregate: acount }
        -> { top: 5; where: astr ~ 'a%' group_by: astr }
    `).toTranslate();
    });
    test('query output refined into another query', () => {
      expect(
        'run: ab -> {group_by: astr} extend { dimension: bigstr is upper(astr) } -> { group_by: bigstr }'
      ).toTranslate();
    });
    test('query with shortcut filtered turtle', () => {
      expect(`##! -m4warnings
        query: allA is ab -> aturtle + {? astr ~ 'a%' }`).toTranslate();
    });
    test('query with filtered turtle', () => {
      expect(
        "query: allA is ab -> aturtle + { where: astr ~ 'a%' }"
      ).toTranslate();
    });
    test('nest: in group_by:', () => {
      expect(`
      run: ab -> {
        group_by: astr;
        nest: nested_count is {
          aggregate: acount
        }
      }
    `).toTranslate();
    });
    test('reduce pipe project', () => {
      expect(`
      run: a -> { aggregate: f is count() } -> { select: f2 is f + 1 }
    `).toTranslate();
    });
    test('refine and extend query', () => {
      expect(`
      query: a_by_str is a -> { group_by: astr }
      run: a_by_str + { aggregate: str_count is count() }
    `).toTranslate();
    });
    test('query refinement preserves original', () => {
      const x = new TestTranslator(`
      query: q is a -> { aggregate: acount is count() }
      query: nq is q + { group_by: astr }
    `);
      expect(x).toTranslate();
      const q = getFirstSegmentFields(x.getQuery('q'));
      expect(q).toBeDefined();
      if (q) {
        expect(q.length).toBe(1);
      }
    });
    test('query composition preserves original', () => {
      const x = new TestTranslator(`
      query: q is ab -> { aggregate: acount }
      query: nq is q -> { select: * }
    `);
      expect(x).toTranslate();
      const q = x.getQuery('q');
      expect(q).toBeDefined();
      if (q) {
        expect(q.pipeline.length).toBe(1);
      }
    });
    test('all ungroup with args', () => {
      expect(`
      run: a -> {
        group_by: astr
        nest: by_int is {
          group_by: ai
          aggregate: bi_count is all(count(), ai)
        }
      }
    `).toTranslate();
    });
    test('all ungroup checks args', () => {
      expect(`
        run: a -> {
        group_by: astr
        nest: by_int is {
          group_by: ai
          aggregate: bi_count is all(count(), afloat)
        }
      }`).toLog(errorMessage("all() 'afloat' is missing from query output"));
    });
    test('exclude ungroup with args', () => {
      expect(`
      run: a -> {
        group_by: aa is 'a'
        nest: by_b is {
          group_by: bb is 'b'
          nest: by_c is {
            group_by: cc is 'c'
            aggregate: bb_count is exclude(count(), aa, cc)
          }
        }
      }
    `).toTranslate();
    });
    test('exclude ungroup checks args', () => {
      expect(`
      run: a -> {
        group_by: aa is 'a'
        nest: by_b is {
          group_by: bb is 'b'
          nest: by_c is {
            group_by: cc is 'c'
            aggregate: bb_count is exclude(count(), aaa, cc)
          }
        }
      }
    `).toLog(errorMessage("exclude() 'aaa' is missing from query output"));
    });
    test('exclude problem revealed by production models', () => {
      expect(`
      source: carriers is _db_.table('malloytest.carriers') extend {
        primary_key: code
      }
      source: flights is _db_.table('malloytest.flights') extend {
        primary_key: id2
        join_one: carriers with carrier

        view: carrier_overview is {
          group_by: carrier_name is carriers.nickname
          nest: top_destinations is {
            group_by: destination
            aggregate:
              flights_to_dest is exclude(count(), carrier_name)*100
          }
        }
      }
    `).toTranslate();
    });
    test('exclude output checking survives refinement', () => {
      // This was https://github.com/malloydata/malloy/issues/1474
      const nestExclude = model`
        source: flights is a extend {
          dimension: carrier is astr, destination is astr
          measure: flight_count is count()
          view: by_dest is {
            group_by: destination
            aggregate: flight_count
          }
        }
        run: flights -> {
          group_by: carrier
          nest: broken is by_dest + {
            top: 5
            aggregate: flights_to_dest_all_carriers is exclude(flight_count, carrier)
          }
        }`;
      expect(nestExclude).toTranslate();
    });
  });
  describe('query operation typechecking', () => {
    describe('field declarations', () => {
      test('cannot use aggregate in group_by', () => {
        expect('run: a -> { group_by: s is count()}').toLog(
          errorMessage(
            'Cannot use an aggregate field in a group_by operation, did you mean to use an aggregate operation instead?'
          )
        );
      });
      test('cannot use ungrouped_aggregate in group_by', () => {
        expect('run: a -> { group_by: s is all(count())}').toLog(
          errorMessage(
            'Cannot use an aggregate field in a group_by operation, did you mean to use an aggregate operation instead?'
          )
        );
      });
      test('cannot use analytic in group_by', () => {
        expect('run: a -> { group_by: s is row_number()}').toLog(
          errorMessage(
            'Cannot use an analytic field in a group_by operation, did you mean to use a calculate operation instead?'
          )
        );
      });
      test('cannot use aggregate in dimension', () => {
        expect('source: a1 is a extend { dimension: s is count()}').toLog(
          errorMessage(
            'Cannot use an aggregate field in a dimension declaration, did you mean to use a measure declaration instead?'
          )
        );
      });
      test('cannot use ungrouped_aggregate in dimension', () => {
        expect('source: a1 is a extend { dimension: s is all(count())}').toLog(
          errorMessage(
            'Cannot use an aggregate field in a dimension declaration, did you mean to use a measure declaration instead?'
          )
        );
      });
      test('cannot use analytic in dimension', () => {
        expect('source: a1 is a extend { dimension: s is row_number()}').toLog(
          errorMessage(
            'Cannot use an analytic field in a dimension declaration'
          )
        );
      });
      test('cannot use scalar in measure', () => {
        expect('source: a1 is a extend { measure: s is 1}').toLog(
          errorMessage(
            'Cannot use a scalar field in a measure declaration, did you mean to use a dimension declaration instead?'
          )
        );
      });
      test('cannot use analytic in measure', () => {
        expect('source: a1 is a extend { measure: s is lag(count())}').toLog(
          errorMessage('Cannot use an analytic field in a measure declaration')
        );
      });
      test('cannot use scalar in aggregate', () => {
        expect('run: a -> { aggregate: s is 1}').toLog(
          errorMessage(
            'Cannot use a scalar field in an aggregate operation, did you mean to use a group_by or select operation instead?'
          )
        );
      });
      test('cannot use analytic in aggregate', () => {
        expect('run: a -> { aggregate: s is lag(count())}').toLog(
          errorMessage(
            'Cannot use an analytic field in an aggregate operation, did you mean to use a calculate operation instead?'
          )
        );
      });
      test('cannot use scalar in calculate', () => {
        expect('run: a -> { group_by: a is 1; calculate: s is 1 }').toLog(
          errorMessage(
            'Cannot use a scalar field in a calculate operation, did you mean to use a group_by or select operation instead?'
          )
        );
      });
      test('cannot use aggregate in calculate', () => {
        expect('run: a -> { group_by: a is 1; calculate: s is count() }').toLog(
          errorMessage(
            'Cannot use an aggregate field in a calculate operation, did you mean to use an aggregate operation instead?'
          )
        );
      });
      test('cannot use aggregate in project', () => {
        expect('run: a -> { select: s is count() }').toLog(
          errorMessage(
            'Cannot use an aggregate field in a select operation, did you mean to use an aggregate operation instead?'
          )
        );
      });
      test('cannot use analytic in project', () => {
        expect('run: a -> { select: s is row_number() }').toLog(
          errorMessage(
            'Cannot use an analytic field in a select operation, did you mean to use a calculate operation instead?'
          )
        );
      });
      test('cannot use analytic in extended source', () => {
        expect(
          `##! -m4warnings
          run: a -> { group_by: a is 1; declare: s is row_number() }`
        ).toLog(
          errorMessage(
            'Analytic expressions can not be used in a declare block'
          )
        );
      });
      test('cannot use aggregate in index', () => {
        expect(
          'run: a extend { measure: acount is count() } -> { index: acount }'
        ).toLog(
          errorMessage('Cannot use an aggregate field in an index operation')
        );
      });
      test('can use aggregate in except', () => {
        expect(`
          source: b1 is a extend { measure: acount is count() }
          source: c1 is b1 extend { except: acount }
        `).toTranslate();
      });
    });
    describe('field references', () => {
      test('cannot use aggregate in group_by', () => {
        expect(
          'run: a -> { extend: {measure: acount is count()} group_by: acount }'
        ).toLog(
          errorMessage(
            'Cannot use an aggregate field in a group_by operation, did you mean to use an aggregate operation instead?'
          )
        );
      });
      test('cannot use query in group_by', () => {
        expect(
          'run: a extend { view: q is { group_by: x is 1 } } -> { group_by: q }'
        ).toLog(
          errorMessage(
            'Cannot use a view field in a group_by operation, did you mean to use a nest operation instead?'
          )
        );
      });
      test('cannot use scalar in aggregate', () => {
        expect(
          'run: a -> { extend: {dimension: aconst is 1} aggregate: aconst }'
        ).toLog(
          errorMessage(
            'Cannot use a scalar field in an aggregate operation, did you mean to use a group_by or select operation instead?'
          )
        );
      });
      test('cannot use scalar in calculate', () => {
        expect(
          'run: a -> { extend: {dimension: aconst is 1} group_by: x is 1; calculate: aconst }'
        ).toLog(
          errorMessage(
            'Cannot use a scalar field in a calculate operation, did you mean to use a group_by or select operation instead?'
          )
        );
      });
      test('cannot use aggregate in calculate', () => {
        expect(
          'run: a -> { extend: {measure: acount is count()} group_by: x is 1; calculate: acount }'
        ).toLog(
          errorMessage(
            'Cannot use an aggregate field in a calculate operation, did you mean to use an aggregate operation instead?'
          )
        );
      });
      test('cannot use query in project', () => {
        expect(
          'run: a extend { view: q is { group_by: x is 1 } } -> { select: q }'
        ).toLog(
          errorMessage(
            'Cannot use a view field in a select operation, did you mean to use a nest operation instead?'
          )
        );
      });
      test('cannot use query in index', () => {
        expect(
          'run: a extend { view: q is { group_by: x is 1 } } -> { index: q }'
        ).toLog(errorMessage('Cannot use a view field in an index operation'));
      });
      test('cannot use query in calculate', () => {
        expect(
          'run: a extend { view: q is { group_by: x is 1 } } -> { group_by: x is 1; calculate: q }'
        ).toLog(
          errorMessage(
            'Cannot use a view field in a calculate operation, did you mean to use a nest operation instead?'
          )
        );
      });
      test('cannot use query in aggregate', () => {
        expect(
          'run: a extend { view: q is { group_by: x is 1 } } -> { aggregate: q }'
        ).toLog(
          errorMessage(
            'Cannot use a view field in an aggregate operation, did you mean to use a nest operation instead?'
          )
        );
      });
      test('cannot use aggregate in calculate, preserved over refinement', () => {
        expect(`query: a1 is a -> {
          aggregate: c is count()
        }
        run: a1 + {
          calculate: b is c
        }`).toLog(
          errorMessage(
            'Cannot use an aggregate field in a calculate operation, did you mean to use an aggregate operation instead?'
          )
        );
      });
      test('cannot use scalar in calculate, preserved over refinement', () => {
        expect(`query: a1 is a -> {
          group_by: c is 1
        }
        run: a1 + {
          calculate: b is c
        }`).toLog(
          errorMessage(
            'Cannot use a scalar field in a calculate operation, did you mean to use a group_by or select operation instead?'
          )
        );
      });
      test('cannot use analytic in group_by, preserved over refinement', () => {
        expect(`query: a1 is a -> {
          group_by: c is 1
          calculate: c2 is lag(c)
        }
        run: a1 + {
          group_by: b is c2
        }`).toLog(
          // c2 is not defined because group_by doesn't know to look in the output space
          errorMessage("'c2' is not defined")
        );
      });
      test('cannot use analytic in order_by, preserved over refinement', () => {
        expect(`query: a1 is a -> {
          group_by: c is 1
          calculate: c2 is lag(c)
        }
        run: a1 + {
          order_by: c2
        }`).toLog(errorMessage('Illegal order by of analytic field c2'));
      });
      test('cannot ungroup an ungrouped', () => {
        expect(`query: a1 is a -> {
          group_by: c is 1
          aggregate: c2 is all(all(sum(ai)))
        }`).toLog(
          errorMessage('all() expression must not already be ungrouped')
        );
      });
      test('cannot aggregate an ungrouped', () => {
        expect(`query: a1 is a -> {
          group_by: c is 1
          aggregate: c2 is sum(all(sum(ai)))
        }`).toLog(errorMessage('Aggregate expression cannot be aggregate'));
      });
      test('cannot aggregate an aggregate', () => {
        expect(`query: a1 is a -> {
          group_by: c is 1
          aggregate: c2 is sum(sum(ai))
        }`).toLog(errorMessage('Aggregate expression cannot be aggregate'));
      });
      test('can use field def in group_by, preserved over refinement', () => {
        expect(`query: a1 is a -> {
          group_by: c is 1
        }
        run: a1 + {
          order_by: c
        }`).toTranslate();
      });
      test('can use field ref in group_by, preserved over refinement', () => {
        expect(`query: a1 is a -> {
          group_by: c is astr
        }
        run: a1 + {
          order_by: c
        }`).toTranslate();
      });
    });
  });
  describe('function typechecking', () => {
    test('use function correctly', () => {
      expect(`run: a -> {
        group_by: s is concat('a', 'b')
      }`).toTranslate();
    });
    test('function incorrect case', () => {
      expect(`run: a -> {
        group_by: s is CONCAT('a', 'b')
      }`).toLog(
        warningMessage(
          "Case insensitivity for function names is deprecated, use 'concat' instead"
        )
      );
    });
    test('function no matching overload', () => {
      expect(`run: a -> {
        group_by: s is floor('a', 'b')
      }`).toLog(
        errorMessage('No matching overload for function floor(string, string)')
      );
    });
    test('unknown function', () => {
      expect(`run: a -> {
        group_by: s is asdfasdf()
      }`).toLog(
        errorMessage(
          "Unknown function 'asdfasdf'. Use 'asdfasdf!(...)' to call a SQL function directly."
        )
      );
    });
    test('can select different overload', () => {
      expect('run: a -> { group_by: s is concat() }').toTranslate();
    });
    test('can pass different expression types', () => {
      expect(`run: a -> {
        group_by: f1 is sqrt(1)
        aggregate: f2 is sqrt(count())
        aggregate: f3 is sqrt(all(count()))
        calculate: f4 is sqrt(lag(f1))
        calculate: f5 is sqrt(lag(count()))
      }`).toTranslate();
    });
    test('function return type correct', () => {
      expect(`run: a -> {
        group_by: s is floor(1.2) + 1
      }`).toTranslate();
    });
    test('function return type incorrect', () => {
      expect(`run: a -> {
          group_by: s is floor(1.2) + 'a'
      }`).toLog(
        errorMessage("The '+' operator requires a number, not a 'string'")
      );
    });
    test('can use output value in calculate', () => {
      expect(`run: a -> {
        group_by: x is 1
        calculate: s is lag(x)
      }`).toTranslate();
    });
    test('cannot use output value in group_by', () => {
      expect(`run: a -> {
        group_by: x is 1
        group_by: y is x
      }`).toLog(errorMessage("'x' is not defined"));
    });
    test('lag can check that other args are constant', () => {
      expect(`run: a -> {
        group_by: x is 1
        calculate: s is lag(x, 1, x)
      }`).toLog(
        // TODO improve this error message
        errorMessage(
          "Parameter 3 ('default') of lag must be literal or constant, but received output"
        )
      );
    });
    test('lag can check that other args are literal', () => {
      expect(`run: a -> {
        group_by: x is 1
        calculate: s is lag(x, 1 + 1)
      }`).toLog(
        // TODO improve this error message
        errorMessage(
          "Parameter 2 ('offset') of lag must be literal, but received constant"
        )
      );
    });
    test('lag can check that other args are nonnull', () => {
      expect(`run: a -> {
        group_by: x is 1
        calculate: s is lag(x, null)
      }`).toLog(
        errorMessage("Parameter 2 ('offset') of lag must not be a literal null")
      );
    });
    test('lag can use constant values for other args', () => {
      expect(`run: a -> {
        group_by: x is 1
        calculate: s is lag(x, 2)
      }`).toTranslate();
    });
    test('cannot name top level objects same as functions', () => {
      expect(markSource`query: ${'concat is a -> { group_by: x is 1 }'}`).toLog(
        // TODO improve this error message
        errorMessage("'concat' is already defined, cannot redefine")
      );
    });
    test('`now` is considered constant`', () => {
      expect(`run: a -> {
        group_by: n is now
        calculate: l is lag(n, 1, now)
      }`).toTranslate();
    });
    // TODO it might be nice to reference a field which is a constant, and be able to
    // use that as a constant param. Same with a literal.
    test('cannot use a field which is a constant in a constant param', () => {
      expect(
        `run: a -> {
          group_by: ai, pi is pi()
          calculate: l is lag(ai, 1, pi)
        }`
      ).toLog(
        errorMessage(
          "Parameter 3 ('default') of lag must be literal or constant, but received output"
        )
      );
    });
    test('cannot use struct in function arg', () => {
      expect(
        `run: ab -> {
          group_by: b.astr
          calculate: foo is lag(b)
        }`
      ).toLog(errorMessage('No matching overload for function lag(table)'));
    });
    // TODO this doesn't work today, we're not rigorous enough with integer
    // subtypes. But we should probably make this typecheck properly.
    test.skip('cannot use float in round precision', () => {
      expect(`run: a -> {
        group_by: x is round(1.5, 1.6)
      }`).toLog(
        // TODO improve this error message
        errorMessage(
          "Parameter 2 ('precision') for round must be integer, received float"
        )
      );
    });
    test('cannot use stddev with no arguments', () => {
      expect(`run: a -> {
        aggregate: x is stddev()
      }`).toLog(errorMessage('No matching overload for function stddev()'));
    });
    test('can use stddev with postfix syntax', () => {
      expect(`run: a -> {
        extend: { dimension: y is 1 }
        aggregate: x is y.stddev()
      }`).toTranslate();
    });
    test('can use stddev with postfix syntax on join', () => {
      expect(`run: a -> {
        extend: { join_one: b with astr }
        aggregate: x is b.ai.stddev()
      }`).toTranslate();
    });
    test('can use calculate with a measure', () => {
      expect(`run: a extend { measure: c is count() } -> {
        group_by: y is 1
        calculate: x is lag(c)
      }`).toTranslate();
    });
    test('cannot use calculate with input fields', () => {
      expect(`run: a -> {
        group_by: y is 1
        calculate: x is lag(ai)
      }`).toLog(
        // TODO improve this error message:
        // Parameter 1 ('value') of 'lag' must be a constant, an aggregate, or an expression using
        // only fields that appear in the query output. Received an expression which uses a field
        // that is not in the query output.
        errorMessage(
          "Parameter 1 ('value') of lag must be literal, constant or output, but received input"
        )
      );
    });
    test('can use calculate with aggregate field which is not in query', () => {
      expect(`run: a extend { measure: acount is count() } -> {
        group_by: astr
        calculate: pc is lag(acount)
      }`).toTranslate();
    });
    test('cannot use agregate as argument to agg function', () => {
      expect(`run: a -> {
        aggregate: x is stddev(count())
      }`).toLog(
        errorMessage(
          "Parameter 1 ('value') of stddev must be scalar, but received aggregate"
        )
      );
    });
    test('cannot use calculate with no other fields', () => {
      expect(`run: a -> {
        calculate: x is row_number()
      }`).toLog(error('ambiguous-view-type', {}));
    });
    // TODO someday make it so we can order by an analytic function
    test('today: cannot order by analytic function', () => {
      expect(`run: a -> {
        group_by: astr
        calculate: row_num is row_number()
        order_by: row_num desc
      }`).toLog(errorMessage('Illegal order by of analytic field row_num'));
    });
    test('cannot use analytic in calculate -- and preserved over refinement', () => {
      expect(`query: a1 is a -> {
        group_by: astr
        calculate: p is lag(astr)
      }
      run: a1 + {
        calculate: p1 is lag(p)
      }`).toLog(
        errorMessage(
          "Parameter 1 ('value') of lag must be scalar or aggregate, but received scalar_analytic"
        )
      );
    });
    test('cannot use aggregate analytic in project', () => {
      expect(`run: a -> {
        select: astr
        calculate: p is lag(count())
      }`).toLog(errorMessage('Cannot add aggregate analyics to select'));
    });
    test('reference field in join', () => {
      expect(`run: a -> {
        extend: { join_one: b with astr }
        group_by: b.ai
      }`).toTranslate();
    });
    test.skip('reference join as field', () => {
      expect(`run: a -> {
        extend: { join_one: b with astr }
        group_by: b
      }`).toLog(errorMessage('foo'));
    });
    test('can reference select: inline join.* field in calculate', () => {
      expect(`run: a -> {
        extend: { join_one: b with astr }
        select: b.*
        calculate: s is lag(ai)
      }`).toTranslate();
    });
    test('can reference select: join.* field in calculate', () => {
      expect(`run: a extend { join_one: b with astr } -> {
        select: b.*
        calculate: s is lag(ai)
      }`).toTranslate();
    });
    test('can reference implied output entries in calculate', () => {
      expect(`source: aaa is a extend { dimension: big_i is ai+10 }
      run: a extend { join_one: aaa on astr=aaa.astr } -> {
        group_by: aaa.big_i
        aggregate: s is aaa.big_i.sum()
        calculate: a is lag(big_i)
      }`).toTranslate();
    });
    describe('dialect functions', () => {
      test('can use function enabled in this dialect (standardsql)', () => {
        expect(`run: a -> {
          group_by: d is date_from_unix_date(1000)
        }`).toTranslate();
      });
      test('cannot use function enabled in a different dialect (duckdb)', () => {
        expect(`run: a -> {
          group_by: ts is to_timestamp(1000)
        }`).toLog(errorMessage(/Unknown function/));
      });
    });
  });

  describe('qops', () => {
    test('group by single', () => {
      expect('run: a->{ group_by: astr }').toTranslate();
    });
    test("group_by x is x'", () => {
      expect('run: a->{ group_by: ai is ai/2 }').toTranslate();
    });
    test('group by multiple', () => {
      expect('run: a->{ group_by: astr,ai }').toTranslate();
    });
    test('aggregate single', () => {
      expect('run: a->{ aggregate: num is count() }').toTranslate();
    });
    test('calculate in reduce', () => {
      expect(
        'run: a->{ group_by: astr, ai calculate: num is lag(ai) }'
      ).toTranslate();
    });
    test('calculate in project', () => {
      expect(
        'run: a->{ select: astr, ai calculate: num is lag(ai) }'
      ).toTranslate();
    });
    test('aggregate reference', () => {
      const doc = model`run: a->{ aggregate: ai.sum() }`;
      expect(doc).toTranslate();
      const q = getFirstSegmentFields(doc.translator.getQuery(0));
      expect(q).toBeDefined();
      expect(q[0]).toMatchObject({
        name: 'ai',
        type: 'number',
        expressionType: 'aggregate',
      });
    });
    test('timeunit reference', () => {
      const doc = model`run: a->{ group_by: ats.day }`;
      expect(doc).toTranslate();
      const q = getFirstSegmentFields(doc.translator.getQuery(0));
      expect(q).toBeDefined();
      expect(q[0]).toMatchObject({name: 'ats', type: 'timestamp'});
    });
    test('aggregate multiple', () => {
      expect(`
        run: a->{
          aggregate: num is count(), total is sum(ai)
        }
      `).toTranslate();
    });
    test('project ref', () => {
      expect('run:ab->{ select: b.astr }').toTranslate();
    });
    const afields = aTableDef.fields
      .filter(f => isAtomic(f))
      .map(f => f.name)
      .sort();
    test('expands star correctly', () => {
      const selstar = model`run: ab->{select: *}`;
      expect(selstar).toTranslate();
      const fields = getFirstSegmentFieldNames(selstar.translator.getQuery(0));
      expect(fields).toEqual(afields);
    });
    test('expands join dot star correctly', () => {
      const selstar = model`run: ab->{select: b.*}`;
      expect(selstar).toTranslate();
      const query = selstar.translator.getQuery(0);
      expect(query).toBeDefined();
      const fields = getFirstSegmentFields(selstar.translator.getQuery(0)).map(
        f => (f.type === 'fieldref' ? f.path : `wrong field type ${f.type}`)
      );
      expect(fields).toEqual(afields.map(f => ['b', f]));
    });
    test('expands star with exclusions', () => {
      const selstar = model`run: ab->{select: * { except: ai, except: aun, aweird }}`;
      const filterdFields = afields.filter(
        f => f !== 'ai' && f !== 'aun' && f !== 'aweird'
      );
      expect(selstar).toTranslate();
      const fields = getFirstSegmentFieldNames(selstar.translator.getQuery(0));
      expect(fields).toEqual(filterdFields);
    });
    test('star error checking', () => {
      expect(markSource`run: a->{select: ${'zzz'}.*}`).toLog(
        errorMessage("No such field as 'zzz'")
      );
      expect(markSource`run: ab->{select: b.${'zzz'}.*}`).toLog(
        errorMessage("No such field as 'zzz'")
      );
      expect(markSource`run: a->{select: ${'ai'}.*}`).toLog(
        errorMessage(
          "Field 'ai' does not contain rows and cannot be expanded with '*'"
        )
      );
      expect(markSource`run: a->{select:ai,${'*'}}`).toLog(
        errorMessage(
          "Cannot expand 'ai' in '*' because a field with that name already exists"
        )
      );
      expect(markSource`run: ab->{select:ai,${'b.*'}}`).toLog(
        errorMessage(
          "Cannot expand 'ai' in 'b.*' because a field with that name already exists"
        )
      );
      const m = `
        source: nab is a extend {
          accept: ai
          join_one: b is a extend {accept: ai} on ai=b.ai
        }
        run: nab->{select: b.*,*}
      `;
      expect(m).toLog(
        errorMessage(
          "Cannot expand 'ai' in '*' because a field with that name already exists (conflicts with b.ai)"
        )
      );
    });
    test('regress check extend: and star', () => {
      const m = model`run: ab->{ extend: {dimension: x is 1} select: * }`;
      expect(m).toTranslate();
      const fields = getFirstSegmentFieldNames(m.translator.getQuery(0));
      expect(fields).toEqual(afields.concat('x'));
    });
    test('project def', () => {
      expect('run: ab->{ select: one is 1 }').toTranslate();
    });
    test('project multiple', () => {
      expect('run: a->{ select: one is 1, astr }').toTranslate();
    });
    test('index single', () => {});
    test('regress check extend: and star', () => {
      const m = model`run: ab->{ extend: {dimension: x is 1} select: * }`;
      expect(m).toTranslate();
      const fields = getFirstSegmentFieldNames(m.translator.getQuery(0));
      expect(fields).toEqual(afields.concat('x'));
    });
    test('project def', () => {
      expect('run:ab->{ select: one is 1 }').toTranslate();
    });
    test('project multiple', () => {
      expect(`
        run: a->{
          select: one is 1, astr
        }
      `).toTranslate();
    });
    test('index single', () => {
      expect('run:a->{index: astr}').toTranslate();
    });
    test('index path', () => {
      expect('run:ab->{index: b.astr}').toTranslate();
    });
    test('index unique on path', () => {
      expect('run:ab->{index: astr, b.astr}').toTranslate();
    });
    test('index join.*', () => {
      expect('run:ab->{index: b.*}').toTranslate();
    });
    test('index multiple', () => {
      const model = new TestTranslator('run:a->{index: af, astr}');
      expect(model).toTranslate();
      const q = model.getQuery(0);
      expect(q).toBeDefined();
      if (q) {
        const index = q.pipeline[0];
        expect(index.type).toBe('index');
        if (index.type === 'index') {
          expect(index.indexFields).toEqual([
            {type: 'fieldref', path: ['af']},
            {type: 'fieldref', path: ['astr']},
          ]);
        }
      }
    });
    test('index by', () => {
      expect('run:a->{index: * by ai}').toTranslate();
    });
    test('index sampled', () => {
      expect('run:a->{index: *; sample: true}').toTranslate();
    });
    test('index unsampled', () => {
      expect('run:a->{index: *; sample: false}').toTranslate();
    });
    test('index sample-percent', () => {
      const model = new TestTranslator('run:a->{index: *; sample: 42%}');
      expect(model).toTranslate();
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
    test('index sample-rows', () => {
      expect('run:a->{index: *; sample: 100000}').toTranslate();
    });
    test('top N', () => {
      expect('run: a->{ top: 5; group_by: astr }').toTranslate();
    });
    test('top N by field', () => {
      expect(
        `##! m4warnings=warn
        run: a->{top: 5 ${'by astr'}; group_by: astr}`
      ).toLog(
        warningMessage(
          'by clause of top statement unupported. Use order_by instead'
        )
      );
    });
    test('top N by expression', () => {
      expect(
        `##! m4warnings=warn
        run: ab->{top: 5 by ai + 1; group_by: ai}`
      ).toLog(
        warningMessage(
          'by clause of top statement unupported. Use order_by instead'
        )
      );
    });
    test('limit N', () => {
      expect('run: a->{ limit: 5; group_by: astr }').toTranslate();
    });
    test('order by', () => {
      expect('run: a->{ order_by: astr; group_by: astr }').toTranslate();
    });
    test('order by preserved over refinement', () => {
      expect(`
        query: a1 is a -> { group_by: astr }
        run: a1 + { order_by: astr }
      `).toTranslate();
    });
    test('order by must be in the output space', () =>
      expect('run: a -> { order_by: af; group_by: astr }').toLog(
        errorMessage('Unknown field af in output space')
      ));
    test('order by asc', () => {
      expect('run: a->{ order_by: astr asc; group_by: astr }').toTranslate();
    });
    test('order by desc', () => {
      expect('run: a->{ order_by: astr desc; group_by: astr }').toTranslate();
    });
    test('order by N', () => {
      expect('run: a->{ order_by: 1 asc; group_by: astr }').toTranslate();
    });
    test('order by multiple', () => {
      expect(`
        run: a->{
          order_by: 1 asc, af desc
          group_by: astr, af
        }
      `).toTranslate();
    });
    test('agg cannot be used in where', () => {
      expect(
        'run:ab->{ aggregate: acount; group_by: astr; where: acount > 10 }'
      ).toLog(
        errorMessage(
          'Aggregate expressions are not allowed in `where:`; use `having:`'
        )
      );
    });
    test('analytic cannot be used in where', () => {
      expect(
        'run:ab->{ calculate: prevc is lag(count()); group_by: astr; where: prevc > 10 }'
      ).toLog(errorMessage("'prevc' is not defined"));
    });
    test('analytic cannot be used in having', () => {
      expect(
        'run:ab->{ calculate: prevc is lag(count()); group_by: astr; having: prevc > 10 }'
      ).toLog(
        errorMessage('Analytic expressions are not allowed in `having:`')
      );
    });
    test('where single', () => {
      expect('run:a->{ group_by: astr; where: af > 10 }').toTranslate();
    });
    test('having single', () => {
      expect(
        'run:ab->{ aggregate: acount; group_by: astr; having: acount > 10 }'
      ).toTranslate();
    });
    test('compound having still works', () => {
      expect(
        'run:ab->{ aggregate: acount; having: acount > 10 and acount < 100 }'
      ).toTranslate();
    });
    test('compound aggregate still works', () => {
      expect(
        'run:ab->{ aggregate: thing is acount > 10 and acount < 100 }'
      ).toTranslate();
    });
    test('where multiple', () => {
      expect(
        "run:a->{ group_by: astr; where: af > 10,astr~'a%' }"
      ).toTranslate();
    });
    test('filters preserve source formatting in code:', () => {
      const model = new TestTranslator(
        "source: notb is a extend { where: astr  !=  'b' }"
      );
      expect(model).toTranslate();
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
        'source: notb is a extend { dimension: d is 1 +   2 }'
      );
      expect(model).toTranslate();
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
    test('nest single', () => {
      expect(`
        run: a->{
          group_by: ai
          nest: nestbystr is { group_by: astr; aggregate: N is count() }
        }
      `).toTranslate();
    });
    test('nest multiple', () =>
      expect(`
        run: a->{
          group_by: ai
          nest:
            nestbystr is { group_by: astr; aggregate: N is count() },
            renest is { group_by: astr; aggregate: N is count() }
        }
      `).toTranslate());
    test('nest ref', () =>
      expect('run: ab->{group_by: ai; nest: aturtle}').toTranslate());
    describe('extend block', () => {
      test('works with dimension', () => {
        expect(
          'run: a -> { extend: { dimension: x is 1 }; group_by: x }'
        ).toTranslate();
      });
      test('works with measure', () => {
        expect(
          'run: a -> { extend: { measure: x is count() }; aggregate: x }'
        ).toTranslate();
      });
      test('works with join_one', () => {
        expect(
          'run: a -> { extend: { join_one: bb is b on bb.astr = astr }; group_by: bb.astr }'
        ).toTranslate();
      });
      test('works with join_many', () => {
        expect(
          'run: a -> { extend: { join_many: b on astr = b.astr }; group_by: b.astr }'
        ).toTranslate();
      });
      test('works with join_cross', () => {
        expect(
          'run: a -> { extend: { join_cross: b on true }; group_by: b.astr }'
        ).toTranslate();
      });
      test('works with multiple in one block', () => {
        expect(
          'run: a -> { extend: { dimension: x is 1, y is 2 }; group_by: x, y }'
        ).toTranslate();
      });
      test('works with multiple blocks', () => {
        expect(
          'run: a -> { extend: { dimension: x is 1; dimension: y is 2; measure: c is count() }; group_by: x, y; aggregate: c }'
        ).toTranslate();
      });
    });
    describe('declare/query join warnings', () => {
      test('declare warning in query', () => {
        expect(
          markSource`##! m4warnings=warn
          run: a -> { ${'declare: x is 1'}; group_by: x }`
        ).toLog(
          warningMessage(
            '`declare:` is deprecated; use `dimension:` or `measure:` inside a source or `extend:` block'
          )
        );
      });
      test('declare warning in source', () => {
        expect(
          markSource`##! m4warnings=warn
          source: a2 is a extend { ${'declare: x is 1'} }`
        ).toLog(
          warningMessage(
            '`declare:` is deprecated; use `dimension:` or `measure:` inside a source or `extend:` block'
          )
        );
      });
      test('joins in query', () => {
        expect(
          markSource`##! m4warnings=warn
          run: a -> { ${'join_one: b on true'}; ${'join_many: c is b on true'}; ${'join_cross: d is b on true'}; group_by: b.astr }`
        ).toLog(
          warningMessage(
            'Joins in queries are deprecated, move into an `extend:` block.'
          ),
          warningMessage(
            'Joins in queries are deprecated, move into an `extend:` block.'
          ),
          warningMessage(
            'Joins in queries are deprecated, move into an `extend:` block.'
          )
        );
      });
    });
    test('refine query with extended source', () => {
      const m = new TestTranslator(`
        run: ab extend {
          view: xturtle is aturtle + {
            extend: { measure: aratio is ai / acount }
          }
        } -> xturtle + { aggregate: aratio }
      `);
      expect(m).toTranslate();
      const t = m.translate();
      if (t.translated) {
        const q = t.translated.queryList[0].pipeline[0];
        expect(q).toBeDefined();
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
        run: ab -> aturtle + {
          extend: { measure:  aratio is ai / acount }
          aggregate: aratio
        }
      `);
      expect(m).toTranslate();
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
        run: ab -> aturtle + {
          extend: { join_one: bb is b on bb.astr = astr }
          group_by: foo is bb.astr
        }
      `);
      expect(m).toTranslate();
      const t = m.translate();
      if (t.translated) {
        const q = t.translated.queryList[0].pipeline[0];
        if (q.type === 'reduce' && q.extendSource) {
          expect(q.extendSource.length).toBe(1);
          expect(isJoined(q.extendSource[0])).toBeTruthy();
          expect(q.extendSource[0].type).toBe('table');
        } else {
          fail('Did not generate extendSource');
        }
      }
    });
  });

  describe('refinement location rules', () => {
    test('where clauses go into the first segment', () => {
      const doc = model`
          query: refineme is a -> { select: stage is "stage1" } -> { select: stage is "stage2" }
          query: checkme is refineme + { where: astr = 'a' }`;
      expect(doc).toTranslate();
      const checkme = doc.translator.getQuery('checkme');
      expect(checkme).toBeDefined();
      if (checkme) {
        const whereClause = checkme.pipeline[0].filterList;
        expect(whereClause).toBeDefined();
        if (whereClause) {
          expect(whereClause.length).toBe(1);
        }
      }
    });
    test('having clauses go into the last segment', () => {
      const doc = model`
        query: refineme is a -> { group_by: ai,astr  } -> { group_by: ai, aggregate: ac is count() }
        query: checkme is refineme + { having: ac > 0 }`;
      expect(doc).toTranslate();
      const checkme = doc.translator.getQuery('checkme');
      expect(checkme).toBeDefined();
      if (checkme) {
        const havingClause = checkme.pipeline[1].filterList;
        expect(havingClause).toBeDefined();
        if (havingClause) {
          expect(havingClause.length).toBe(1);
        }
      }
    });
    test('limit goes into the last segment', () => {
      const doc = model`
        query: refineme is a -> { group_by: ai,astr  } -> { group_by: ai, aggregate: ac is count() }
        query: checkme is refineme + { limit: 1 }`;
      expect(doc).toTranslate();
      const checkme = doc.translator.getQuery('checkme');
      expect(checkme).toBeDefined();
      if (checkme) {
        expect(checkme.pipeline[1]).toMatchObject({limit: 1});
      }
    });
    test('order_by goes into the last segment', () => {
      const doc = model`
        query: refineme is a -> { group_by: ai,astr  } -> { group_by: ai, aggregate: ac is count() }
        query: checkme is refineme + { order_by: 2 }`;
      expect(doc).toTranslate();
      const checkme = doc.translator.getQuery('checkme');
      expect(checkme).toBeDefined();
      if (checkme) {
        expect(checkme.pipeline[1]).toHaveProperty('orderBy');
      }
    });

    const stageErr =
      'Illegal in refinement of a query with more than one stage';
    test('group_by illegal in long pipes', () => {
      expect(
        markSource`query: refineme is a -> { select: stage is "stage1" } -> { select: stage is "stage2" }
        query: checkme is refineme + { ${'group_by: stage'} }`
      ).toLog(errorMessage(stageErr));
    });
    test('aggregate illegal in long pipes', () => {
      expect(
        markSource`query: refineme is a -> { select: stage is "stage1" } -> { select: stage is "stage2" }
        query: checkme is refineme + { ${'aggregate: c is count()'} }`
      ).toLog(errorMessage(stageErr));
    });
    test('calcluate illegal in long pipes', () => {
      expect(
        markSource`query: refineme is a -> { select: stage is "stage1" } -> { select: stage is "stage2" }
        query: checkme is refineme + { ${'calculate: c is count()'} }`
      ).toLog(errorMessage(stageErr));
    });
    test('extend illegal in long pipes', () => {
      expect(
        markSource`query: refineme is a -> { select: stage is "stage1" } -> { select: stage is "stage2" }
        query: checkme is refineme + { ${'extend: {measure: c is count()}'} }`
      ).toLog(errorMessage(stageErr));
    });
    test('nest illegal in long pipes', () => {
      expect(
        markSource`query: refineme is a -> { select: stage is "stage1" } -> { select: stage is "stage2" }
        query: checkme is refineme + { ${'nest: b is {group_by: stage}'} }`
      ).toLog(errorMessage(stageErr));
    });
    test('all single stage refinements are accepted', () => {
      expect(
        markSource`query: refineme is a -> { group_by: stage is "stage1" }
        query: checkme is refineme + {
          extend: { dimension: red is 'red' }
          nest: nestRed is { group_by: red }
          group_by: ai
          aggregate: counted is count()
          calculate: l is lag(ai)
        }`
      ).toTranslate();
    });
  });
});
