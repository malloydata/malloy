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
import type {Query, QueryFieldDef, QuerySegment} from '../../model';
import {
  expressionIsCalculation,
  isJoined,
  isQuerySegment,
  isAtomic,
  hasExpression,
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
      expect(`
        query: allA is ab -> aturtle + {where: astr ~ 'a%' }`).toTranslate();
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
    test('ungrouped from source matches ungrouped from query', () => {
      // https://github.com/malloydata/malloy/issues/2137
      // this query, when run, doesn't apply the ungrouping to the field which
      // was defined in the source so i wrote this test which passes to
      // make sure that the definition of the field referenced does
      // contain the ungrouping gesture
      const errQuery = model`
        run: _db_.table('malloytest.airports') extend {
          dimension: first_letter is substr(state, 1, 1)
          measure:
          total_elev is elevation.sum()
          all_total_elev is all(total_elev)
          all_total_elev_first_letter is all(total_elev, first_letter)
        } -> {
        group_by: first_letter
          aggregate:
            all_total_elev_first_letter
            all_total_elev_first_letter2 is all(total_elev, first_letter)
        }`;
      expect(errQuery).toTranslate();
      const q = errQuery.translator.getQuery(0);
      expect(q).toBeDefined();
      const f = q!.structRef;
      expect(typeof f).not.toBe('string');
      if (typeof f !== 'string') {
        const ate = f.fields.find(
          fd => fd.name === 'all_total_elev_first_letter'
        );
        expect(ate).toBeDefined();
        if (hasExpression(ate!)) {
          expect(ate.e.node).toEqual('all');
        } else {
          expect(hasExpression(ate!)).toBe(true);
        }
      }
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
      test('can order by a date grouped by timeframe', () => {
        expect(`
          run: a -> {
            group_by: ats.day
            order_by: ats
          }
        `).toTranslate();
      });
      test('use a calculate on a self-named group_by', () => {
        expect(`
        run: a -> {
          group_by: ai is round(ai)
          calculate: lats is lag(ai)
        }
      `).toTranslate();
      });
      test('use a having on a self-named aggregate', () => {
        expect(`
        run: a -> {
          aggregate: ai is round(ai.sum())
          having: ai > 0
        }
      `).toTranslate();
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
    test('reference field in double nested join inside nest', () => {
      expect(`
        source: a_2 is a extend { join_one: b is b extend {
          join_one: c is b on 1 = c.ai
        } with astr }

        run: a_2 -> {
          nest: x is {
            group_by: ai is b.c.ai
          }
        }
      `).toTranslate();
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
        expect(`run: bq_a -> {
          group_by: d is date_from_unix_date(1000)
        }`).toTranslate();
      });
      test('cannot use function enabled in a different dialect (duckdb)', () => {
        expect(`run: bq_a -> {
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
    test('array in query is passed into fields', () => {
      const selArray = model`run: a -> { select: ais }`;
      expect(selArray).toTranslate();
      const fields = getFirstSegmentFieldNames(selArray.translator.getQuery(0));
      expect(fields).toEqual(['ais']);
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
          expect(index.indexFields).toMatchObject([
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
    test('limit N', () => {
      expect('run: a->{ limit: 5; group_by: astr }').toTranslate();
    });
    describe('order by variations', () => {
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
      test('first aggregate used for default ordering', () => {
        const m = model`run: a->{
          group_by: astr
          aggregate: t is ai.sum()
        }`;
        expect(m).toTranslate();
        const runStmt = m.translator.getQuery(0)!;
        expect(runStmt).toBeDefined();
        const reduce = runStmt.pipeline[0];
        expect(reduce.type).toEqual('reduce');
        if (reduce.type === 'reduce') {
          expect(reduce.defaultOrderBy).toBeTruthy();
          expect(reduce.orderBy).toEqual([{field: 't', dir: 'desc'}]);
        }
      });
      test('first temporal used for default ordering', () => {
        const m = model`run: a->{
          group_by: astr, ats
        }`;
        expect(m).toTranslate();
        const runStmt = m.translator.getQuery(0)!;
        expect(runStmt).toBeDefined();
        const reduce = runStmt.pipeline[0];
        expect(reduce.type).toEqual('reduce');
        if (reduce.type === 'reduce') {
          expect(reduce.defaultOrderBy).toBeTruthy();
          expect(reduce.orderBy).toEqual([{field: 'ats', dir: 'desc'}]);
        }
      });
      test('first used for ordering when appropriate', () => {
        const m = model`run: a->{
          group_by: astr, big is upper(astr)
        }`;
        expect(m).toTranslate();
        const runStmt = m.translator.getQuery(0)!;
        expect(runStmt).toBeDefined();
        const reduce = runStmt.pipeline[0];
        expect(reduce.type).toEqual('reduce');
        if (reduce.type === 'reduce') {
          expect(reduce.defaultOrderBy).toBeTruthy();
          expect(reduce.orderBy).toEqual([{field: 'astr', dir: 'asc'}]);
        }
      });
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
      test('joins in query', () => {
        expect(
          markSource`
          run: a -> {
            join_one: b on true
            join_many: c is b on true
            join_cross: d is b on true
            group_by: b.astr
          }`
        ).toTranslate();
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
      if (t.modelDef) {
        const q = t.modelDef.queryList[0].pipeline[0];
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
      if (t.modelDef) {
        const q = t.modelDef.queryList[0].pipeline[0];
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
      if (t.modelDef) {
        const q = t.modelDef.queryList[0].pipeline[0];
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
  describe('drill:', () => {
    test('do not need experimental flag', () => {
      expect(`
        source: aext is a extend {
          view: by_ai is {
            group_by: ai
          }
        }
        run: aext -> {
          drill: by_ai.ai = 2
          group_by: astr
        }
      `).toTranslate();
    });
    test('basic drill', () => {
      const m = new TestTranslator(`
        source: aext is a extend {
          view: by_ai is {
            group_by: ai
          }
        }
        run: aext -> {
          drill: by_ai.ai = 2
          group_by: astr
        }
      `);
      expect(m).toTranslate();
      const q = m.modelDef.queryList[0];
      const f = q.pipeline[0].filterList!;
      expect(f.length).toBe(1);
      expect(f[0]).toBeExpr('{filterCondition {ai = 2}}');
    });
    test('do not double-collect view filters for multiple dimensions in the same nest', () => {
      const m = new TestTranslator(`
        source: aext is a extend {
          view: by_ai is {
            where: is_cool
            group_by: ai, abool
          }
          dimension: is_cool is false
        }
        run: aext -> {
          drill:
            by_ai.ai = 2,
            by_ai.abool = true
          group_by: astr
        }
      `);
      expect(m).toTranslate();
      const q = m.modelDef.queryList[0];
      const f = q.pipeline[0].filterList!;
      expect(f.length).toBe(2);
      expect(f[0]).toBeExpr('{filterCondition {is_cool and {ai = 2}}}');
      expect(f[1]).toBeExpr('{filterCondition {abool = true}}');
    });
    test('do not double-collect view filters for multiple dimensions in overlapping nests', () => {
      const m = new TestTranslator(`
        source: aext is a extend {
          view: by_ai is {
            where: is_cool
            group_by: ai
            nest: nested is {
              where: is_awesome
              group_by: abool
            }
          }
          dimension: is_cool is false
          dimension: is_awesome is true
        }
        run: aext -> {
          drill:
            by_ai.ai = 2,
            by_ai.nested.abool = true
          group_by: astr
        }
        run: aext -> {
          drill:
            by_ai.nested.abool = true,
            by_ai.ai = 2
          group_by: astr
        }
      `);
      expect(m).toTranslate();
      const q1 = m.modelDef.queryList[0];
      const f1 = q1.pipeline[0].filterList!;
      expect(f1.length).toBe(2);
      expect(f1[0]).toBeExpr('{filterCondition {is_cool and {ai = 2}}}');
      expect(f1[1]).toBeExpr(
        '{filterCondition {is_awesome and {abool = true}}}'
      );
      const q2 = m.modelDef.queryList[1];
      const f2 = q2.pipeline[0].filterList!;
      expect(f2.length).toBe(2);
      expect(f2[0]).toBeExpr(
        '{filterCondition {{is_cool and is_awesome} and {abool = true}}}'
      );
      expect(f2[1]).toBeExpr('{filterCondition {ai = 2}}');
    });
    test('can include normal filters in drill statement', () => {
      const m = new TestTranslator(`
        source: aext is a extend {
          view: by_ai is {
            group_by: ai
          }
          dimension: is_cool is false
          dimension: is_special is false
        }
        run: aext -> {
          drill:
            astr = 'foo',
            af > 100,
            is_cool and is_special,
            by_ai.ai = 2
          group_by: astr
        }
      `);
      expect(m).toTranslate();
      const q = m.modelDef.queryList[0];
      const f = q.pipeline[0].filterList!;
      expect(f.length).toBe(4);
      expect(f[0]).toBeExpr('{filterCondition {astr = {"foo"}}}');
      expect(f[1]).toBeExpr('{filterCondition {af > 100}}');
      expect(f[2]).toBeExpr('{filterCondition {is_cool and is_special}}');
      expect(f[3]).toBeExpr('{filterCondition {ai = 2}}');
    });
    test('drill view is not defined', () => {
      expect(
        markSource`
          run: a -> {
            drill: ${'by_ai'}.ai = 2
            group_by: astr
          }
        `
      ).toLog(errorMessage('No such view `by_ai`'));
    });
    test('drill field is not defined', () => {
      expect(
        markSource`
          source: aext is a extend {
            view: by_ai is {
              group_by: astr
            }
          }
          run: aext -> {
            drill: by_ai.${'ai'} = 2
            group_by: astr
          }
        `
      ).toLog(errorMessage('No such field `ai` found in `by_ai`'));
    });
    test('drill nest found', () => {
      const m = new TestTranslator(`
        source: aext is a extend {
          view: by_ai is {
            nest: nested is {
              group_by: astr
            }
          }
        }
        run: aext -> {
          drill: by_ai.nested.astr = 'foo'
          group_by: ai
        }
      `);
      expect(m).toTranslate();
      const q = m.modelDef.queryList[0];
      const f = q.pipeline[0].filterList!;
      expect(f.length).toBe(1);
      expect(f[0]).toBeExpr('{filterCondition {astr = {"foo"}}}');
    });
    test('can drill a nest and a field from another view', () => {
      const m = new TestTranslator(`
        source: aext is a extend {
          view: by_ai is {
            nest: nested is {
              group_by: astr
            }
          }
          view: other_view is {
            group_by: ai
          }
        }
        run: aext -> {
          drill:
            by_ai.nested.astr = 'foo',
            other_view.ai = 1
          group_by: ai
        }
      `);
      expect(m).toTranslate();
      const q = m.modelDef.queryList[0];
      const f = q.pipeline[0].filterList!;
      expect(f.length).toBe(2);
      expect(f[0]).toBeExpr('{filterCondition {astr = {"foo"}}}');
      expect(f[1]).toBeExpr('{filterCondition {ai = 1}}');
    });
    test('does not think you need to drill on measures', () => {
      expect(
        markSource`
          source: aext is a extend {
            view: view_one is {
              group_by: astr
              aggregate: c is count()
            }
          }
          run: aext -> {
            drill:
              ${'view_one.astr = "foo"'},
            group_by: ai
          }
        `
      ).toTranslate();
    });
    test('does not collect havings', () => {
      const m = new TestTranslator(`
          source: aext is a extend {
            view: view_one is {
              group_by: astr
              aggregate: c is count()
              having: c > 100
            }
          }
          run: aext -> {
            drill: view_one.astr = "foo",
            group_by: ai
          }
        `);
      expect(m).toTranslate();
      const q = m.modelDef.queryList[0];
      const f = q.pipeline[0].filterList!;
      expect(f.length).toBe(1);
      expect(f[0]).toBeExpr('{filterCondition {astr = {"foo"}}}');
    });
    test('drill missing some fields (sibling)', () => {
      expect(
        markSource`
          source: aext is a extend {
            view: view_one is {
              nest: nest_one is {
                group_by: astr
                group_by: abool
              }
            }
          }
          run: aext -> {
            drill:
              ${'view_one.nest_one.astr = "foo"'},
            group_by: ai
          }
        `
      ).toLog(
        errorMessage(
          'Must provide a value for all dimensions in a view when drilling: missing `view_one.nest_one.abool`'
        )
      );
    });
    test('drill multi-stage view', () => {
      expect(
        markSource`
          source: aext is a extend {
            view: view_one is {
              group_by: astr
            } -> { select: * }
          }
          run: aext -> {
            drill:
              ${'view_one'}.astr = "foo",
            group_by: ai
          }
        `
      ).toLog(
        errorMessage('`drill:` may not be used with multi-segment views')
      );
    });
    test('drill index view', () => {
      expect(
        markSource`
          source: aext is a extend {
            view: view_one is {
              index: *
            }
          }
          run: aext -> {
            drill:
              ${'view_one'}.fieldName = "astr",
            group_by: ai
          }
        `
      ).toLog(errorMessage('Index segments are not compatible with `drill:`'));
    });
    test('drill missing some fields (private sibling)', () => {
      expect(
        markSource`
          ##! experimental {access_modifiers}
          source: aext is a include { public: *; private: abool } extend {
            view: view_one is {
              nest: nest_one is {
                group_by: astr
                group_by: abool
              }
            }
          }
          run: aext -> {
            drill:
              ${'view_one.nest_one.astr = "foo"'},
            group_by: ai
          }
        `
      ).toLog(
        errorMessage(
          'Must provide a value for all dimensions in a view when drilling: missing `view_one.nest_one.abool`'
        )
      );
    });
    test('drill missing some fields (parent)', () => {
      expect(
        markSource`
          source: aext is a extend {
            view: view_one is {
              group_by: abool
              nest: nest_one is {
                group_by: astr
              }
            }
          }
          run: aext -> {
            drill:
              ${'view_one.nest_one.astr = "foo"'},
            group_by: ai
          }
        `
      ).toLog(
        errorMessage(
          'Must provide a value for all dimensions in a view when drilling: missing `view_one.abool`'
        )
      );
    });
    test('drill nest not found', () => {
      expect(
        markSource`
          source: aext is a extend {
            view: by_ai is {
              group_by: astr
            }
          }
          run: aext -> {
            drill: by_ai.nested.astr = 'foo'
            group_by: ai
          }
        `
      ).toLog(errorMessage('No such nest `nested` found in `by_ai`'));
    });
    test.skip('drill wrong type', () => {
      expect(
        markSource`
          source: aext is a extend {
            view: by_ai is {
              group_by: ai
            }
          }
          run: aext -> {
            drill: by_ai.ai = 'foo'
            group_by: astr
          }
        `
      ).toLog(errorMessage('Mismathcing type??'));
    });
    test('drill picks up wheres', () => {
      const m = new TestTranslator(`
        source: aext is a extend {
          view: by_ai is {
            where: ai = 2
            nest: nested is {
              where: abool = true
              group_by: astr
            }
          }
        }
        run: aext -> {
          drill: by_ai.nested.astr = 'foo'
          group_by: ai
        }
      `);
      expect(m).toTranslate();
      const q = m.modelDef.queryList[0];
      const f = q.pipeline[0].filterList!;
      expect(f.length).toBe(1);
      expect(f[0]).toBeExpr(
        '{filterCondition {{{ai = 2} and {abool = true}} and {astr = {"foo"}}}}'
      );
    });
    test('can filter on private field with drill', () => {
      const m = new TestTranslator(`
        source: aext is a extend {
          private dimension: private_ai is ai
          view: by_private_ai is {
            group_by: private_ai
          }
        }
        run: aext -> {
          drill: by_private_ai.private_ai = 2
          group_by: astr
        }
      `);
      expect(m).toTranslate();
      const q = m.modelDef.queryList[0];
      const f = q.pipeline[0].filterList!;
      expect(f.length).toBe(1);
      expect(f[0]).toBeExpr('{filterCondition {private_ai = 2}}');
    });
    test('can filter on private nest field with drill', () => {
      const m = new TestTranslator(`
        source: aext is a extend {
          private view: private_by_ai is {
            group_by: ai
          }
          view: nest_private_by_ai is { nest: private_by_ai }
        }
        run: aext -> {
          drill: nest_private_by_ai.private_by_ai.ai = 2
          group_by: astr
        }
      `);
      expect(m).toTranslate();
      const q = m.modelDef.queryList[0];
      const f = q.pipeline[0].filterList!;
      expect(f.length).toBe(1);
      expect(f[0]).toBeExpr('{filterCondition {ai = 2}}');
    });
    test('can filter on join with drill', () => {
      const m = new TestTranslator(`
        source: aext is a extend {
          join_one: b on true
          view: by_b_ai is {
            group_by: b.ai
          }
        }
        run: aext -> {
          drill: by_b_ai.ai = 2
          group_by: astr
        }
      `);
      expect(m).toTranslate();
      const q = m.modelDef.queryList[0];
      const f = q.pipeline[0].filterList!;
      expect(f.length).toBe(1);
      expect(f[0]).toBeExpr('{filterCondition {b.ai = 2}}');
    });
    test('resolve composite slice correctly when using drill', () => {
      const m = new TestTranslator(`
        ##! experimental { composite_sources }
        source: a_with_x is a extend { dimension: x is 1 }
        source: a_with_y is a extend { dimension: y is 1 }
        source: a_with_x_and_y is a_with_x extend { dimension: y is 1 }
        source: aext is compose(
          a,
          a_with_x,
          a_with_y,
          a_with_x_and_y
        ) extend {
          view: by_y is {
            where: x = 1
            group_by: y
          }
        }
        run: aext -> {
          drill: by_y.y = 2
          group_by: astr
        }
      `);
      expect(m).toTranslate();
      const q = m.modelDef.queryList[0];
      const f = q.pipeline[0].filterList!;
      expect(f.length).toBe(1);
      expect(f[0]).toBeExpr('{filterCondition {{x = 1} and {y = 2}}}');
      expect(q.compositeResolvedSourceDef?.as).toBe('a_with_x_and_y');
    });
    test('can filter on param with drill', () => {
      const m = new TestTranslator(`
        ##! experimental { parameters }
        source: aext(param is 1) is a extend {
          view: by_param is {
            group_by: param
          }
        }
        run: aext -> {
          drill: by_param.param = 2
          group_by: astr
        }
      `);
      expect(m).toTranslate();
      const q = m.modelDef.queryList[0];
      const f = q.pipeline[0].filterList!;
      expect(f.length).toBe(1);
      expect(f[0]).toBeExpr('{filterCondition {{parameter param} = 2}}');
    });
    test.todo('cannot drill on joined view');
    test('can filter on expression with drill', () => {
      const m = new TestTranslator(`
        ##! experimental { parameters }
        source: aext(param is 1) is a extend {
          dimension: private_field is 1
          view: by_param is {
            group_by: x is param + private_field
          }
        }
        run: aext -> {
          drill: by_param.x = 2
          group_by: astr
        }
      `);
      expect(m).toTranslate();
      const q = m.modelDef.queryList[0];
      const f = q.pipeline[0].filterList!;
      expect(f.length).toBe(1);
      expect(f[0]).toBeExpr(
        '{filterCondition {{{parameter param} + private_field} = 2}}'
      );
    });
  });
  describe('grouped_by', () => {
    test('grouped_by requires compiler flag', () => {
      expect(
        markSource`
          source: aext is a extend {
            measure: aisum is ai.sum() { grouped_by: astr }
          }
        `
      ).toLog(
        errorMessage(
          'Experimental flag `grouped_by` is not set, feature not available'
        )
      );
    });
    test('grouped_by basic success', () => {
      expect(
        markSource`
          ##! experimental.grouped_by
          source: aext is a extend {
            measure: aisum is ai.sum() { grouped_by: astr }
          }
          run: aext -> { group_by: astr; aggregate: aisum }
        `
      ).toTranslate();
    });
    test('grouped_by basic failure', () => {
      expect(
        markSource`
          ##! experimental.grouped_by
          source: aext is a extend {
            measure: aisum is ai.sum() { grouped_by: astr }
          }
          run: aext -> { aggregate: ${'aisum'} }
        `
      ).toLog(
        errorMessage(
          'Group by or single value filter of `astr` is required but not present'
        )
      );
    });
    describe('single value filters', () => {
      test('single value filter equal basic success', () => {
        expect(
          markSource`
            ##! experimental.grouped_by
            source: aext is a extend {
              measure: aisum is ai.sum() { grouped_by: astr }
            }
            run: aext -> { where: astr = 'foo'; aggregate: aisum }
          `
        ).toTranslate();
      });
      test('multi value filter equal basic failure', () => {
        expect(
          markSource`
            ##! experimental.grouped_by
            source: aext is a extend {
              measure: aisum is ai.sum() { grouped_by: astr }
            }
            run: aext -> { where: astr = 'foo' | 'bar'; aggregate: aisum }
          `
        ).toLog(
          errorMessage(
            'Group by or single value filter of `astr` is required but not present'
          )
        );
      });
      test('single value filter equal works with boolean, string, number, timestamp, date, null', () => {
        expect(
          markSource`
            ##! experimental.grouped_by
            source: aext is a extend {
              dimension: abool2 is abool
              measure: aisum is ai.sum() {
                grouped_by:
                  astr, abool, abool2, ai, af, ats, ad
              }
            }
            run: aext -> {
              where:
                astr = 'foo',
                abool = true,
                abool2 = false,
                ai = 2,
                ad = @2003-01-01,
                ats = @2003-01-01 10:00:00,
                af is null
              aggregate: aisum
            }
          `
        ).toTranslate();
      });
      test('single value filter ANDED equal works with boolean, string, number, timestamp, date, null', () => {
        expect(
          markSource`
            ##! experimental.grouped_by
            source: aext is a extend {
              dimension: abool2 is abool
              measure: aisum is ai.sum() {
                grouped_by:
                  astr, abool, abool2, ai, af, ats, ad
              }
            }
            run: aext -> {
              where:
                astr = 'foo'
                and abool = true
                and abool2 = false
                and ai = 2
                and ad = @2003-01-01
                and ats = @2003-01-01 10:00:00
                and af is null
              aggregate: aisum
            }
          `
        ).toTranslate();
      });
      test('single value filter ANDED (parenthesized) equal works with boolean, string, number, timestamp, date, null', () => {
        expect(
          markSource`
            ##! experimental.grouped_by
            source: aext is a extend {
              dimension: abool2 is abool
              measure: aisum is ai.sum() {
                grouped_by:
                  astr, abool, abool2, ai, af, ats, ad
              }
            }
            run: aext -> {
              where:
                (astr = 'foo'
                and abool = true)
                and (abool2 = false
                and ai = 2
                and ad = @2003-01-01
                and (ats = @2003-01-01 10:00:00
                and af is null))
              aggregate: aisum
            }
          `
        ).toTranslate();
      });
      test('single value filter expression works with boolean, string, number, date, timestamp, null', () => {
        expect(
          markSource`
            ##! experimental.grouped_by
            source: aext is a extend {
              dimension: abool2 is abool
              dimension: abool3 is abool
              dimension: astr2 is astr
              measure: aisum is ai.sum() {
                grouped_by:
                  astr, abool, abool2, ai, af, abool3, astr2, ats, ad
              }
            }
            run: aext -> {
              where:
                astr ~ f'foo',
                abool ~ f'true',
                abool2 ~ f'=false',
                ai ~ f'2',
                ad ~ f'2003-01-01',
                ats ~ f'2003-01-01 10:00:00',
                af ~ f'null',
                abool3 ~ f'null',
                astr2 ~ f'null'
              aggregate: aisum
            }
          `
        ).toTranslate();
      });
      test('single value filter expression ANDed together works with boolean, string, number, date, timestamp, null', () => {
        expect(
          markSource`
            ##! experimental.grouped_by
            source: aext is a extend {
              dimension: abool2 is abool
              dimension: abool3 is abool
              dimension: astr2 is astr
              measure: aisum is ai.sum() {
                grouped_by:
                  astr, abool, abool2, ai, af, abool3, astr2, ats, ad
              }
            }
            run: aext -> {
              where:
                astr ~ f'foo'
                and abool ~ f'true'
                and abool2 ~ f'=false'
                and ai ~ f'2'
                and ad ~ f'2003-01-01'
                and ats ~ f'2003-01-01 10:00:00'
                and af ~ f'null'
                and abool3 ~ f'null'
                and astr2 ~ f'null'
              aggregate: aisum
            }
          `
        ).toTranslate();
      });
      test('no single value filter expression trickery', () => {
        expect(
          markSource`
            ##! experimental.grouped_by
            source: aext is a extend {
              measure: aisum is ai.sum() {
                grouped_by:
                  astr, abool, ai, ad, ats
              }
            }
            run: aext -> {
              where:
                astr ~ f'foo, bar',
                astr ~ f'-null',
                astr ~ f'-foo',
                abool ~ f'false', // false or null
                abool ~ f'not null',
                ai ~ f'not null',
                ai ~ f'> 3',
                ai ~ f'not 3',
                ad ~ f'2003',
                ad ~ f'not 2003-01-01',
                ats ~ f'2003-01-01 10:00', // not granular enough?
                ats ~ f'not 2003-01-01 10:00:00',
              aggregate: aisum
            }
          `
        ).toLog(
          errorMessage(
            'Group by or single value filter of `astr` is required but not present'
          ),
          errorMessage(
            'Group by or single value filter of `abool` is required but not present'
          ),
          errorMessage(
            'Group by or single value filter of `ai` is required but not present'
          ),
          errorMessage(
            'Group by or single value filter of `ad` is required but not present'
          ),
          errorMessage(
            'Group by or single value filter of `ats` is required but not present'
          )
        );
      });
    });
    test('grouped_by double failure on same path', () => {
      expect(
        markSource`
          ##! experimental.grouped_by
          source: aext is a extend {
            measure: aisum is ai.sum() { grouped_by: astr }
            measure: afsum is af.sum() { grouped_by: astr }
          }
          run: aext -> {
            aggregate: ${'aisum'}, ${'afsum'}
          }
        `
      ).toLog(
        errorMessage(
          'Group by or single value filter of `astr` is required but not present'
        ),
        errorMessage(
          'Group by or single value filter of `astr` is required but not present'
        )
      );
    });
    // TODO would be nice to have an error here, before you use it
    test.skip('failure in multi-stage view in source', () => {
      expect(
        markSource`
          ##! experimental.grouped_by
          source: aext is a extend {
            measure: aisum is ai.sum() { grouped_by: astr }

            view: x is { aggregate: ${'aisum'} } -> { select: * }
          }
        `
      ).toLog(
        errorMessage(
          'Group by or single value filter of `astr` is required but not present'
        )
      );
    });
    test('failure in multi-stage view used later', () => {
      expect(
        markSource`
          ##! experimental.grouped_by
          source: aext is a extend {
            measure: aisum is ai.sum() { grouped_by: astr }

            view: x is { aggregate: aisum } -> { select: * }
          }
          run: aext -> ${'x'}
        `
      ).toLog(
        errorMessage(
          'Group by or single value filter of `astr` is required but not present'
        )
      );
    });
    test('failure in multi-stage view used in nest', () => {
      expect(
        markSource`
          ##! experimental.grouped_by
          source: aext is a extend {
            measure: aisum is ai.sum() { grouped_by: astr }

            view: x is { aggregate: aisum } -> { select: * }
          }
          run: aext -> {
            nest: ${'x'}
          }
        `
      ).toLog(
        errorMessage(
          'Group by or single value filter of `astr` is required but not present'
        )
      );
    });
    test('grouped_by failure direct in query', () => {
      expect(
        markSource`
          ##! experimental.grouped_by
          run: a -> { aggregate: aisum is ${'ai.sum() { grouped_by: astr }'} }
        `
      ).toLog(
        errorMessage(
          'Group by or single value filter of `astr` is required but not present'
        )
      );
    });
    test('view with inherited grouped_by failure', () => {
      expect(
        markSource`
          ##! experimental.grouped_by
          source: aext is a extend {
            measure: aisum is ai.sum() { grouped_by: astr }

            view: requires_astr is {
              aggregate: aisum
            }
          }
          run: aext -> { nest: ${'requires_astr'} }
        `
      ).toLog(
        errorMessage(
          'Group by or single value filter of `astr` is required but not present'
        )
      );
    });
    test('view with inherited grouped_by success', () => {
      expect(
        markSource`
          ##! experimental.grouped_by
          source: aext is a extend {
            measure: aisum is ai.sum() { grouped_by: astr }

            view: requires_astr is {
              aggregate: aisum
            }
          }
          run: aext -> { group_by: astr; nest: requires_astr }
        `
      ).toTranslate();
    });
    test('lens error shows up in the right place', () => {
      expect(
        markSource`
          ##! experimental.grouped_by
          source: aext is a extend {
            measure: aisum is ai.sum() { grouped_by: astr }
            measure: aisum_plus_one is aisum + 1
          }
          run: aext -> { where: true } + ${'aisum_plus_one'}
        `
      ).toLog(
        errorMessage(
          'Group by or single value filter of `astr` is required but not present'
        )
      );
    });
    test('nest satisfies required group by', () => {
      expect(
        markSource`
          ##! experimental.grouped_by
          source: aext is a extend {
            measure: aisum is ai.sum() { grouped_by: astr }
          }
          run: aext -> {
            group_by: ai
            nest: no_require is {
              group_by: astr
              aggregate: aisum
            }
          }
        `
      ).toTranslate();
    });
    test('composed source picked correctly', () => {
      expect(
        markSource`
          ##! experimental { composite_sources grouped_by }
          source: aext is compose(
            a,
            a extend { dimension: x is 1 }
          ) extend {
            measure: aisum is ai.sum() { grouped_by: x }
          }
          run: aext -> {
            group_by: x
            aggregate: aisum
          }
        `
      ).toTranslate();
    });
    test('composed source input skipped when invalid require group by usage but field is present in source', () => {
      const t = new TestTranslator(`
        ##! experimental { composite_sources grouped_by }
        source: s1 is a extend {
          measure: aisum is ai.sum() { grouped_by: astr }
        }
        source: s2 is a extend {
          measure: aisum is ai.sum()
        }
        source: aext is compose(s1, s2)
        run: aext -> {
          aggregate: aisum
        }
      `);
      expect(t).toTranslate();
      const q = t.modelDef.queryList[0];
      expect(q).toBeDefined();
      expect(q.compositeResolvedSourceDef?.as).toBe('s2');
    });
    test('composed source input skipped when invalid require group by usage', () => {
      const t = new TestTranslator(`
        ##! experimental { composite_sources grouped_by }
        source: s1 is a extend {
          dimension: x is 1
          measure: aisum is ai.sum() { grouped_by: x }
        }
        source: s2 is a extend {
          measure: aisum is ai.sum()
        }
        source: aext is compose(s1, s2)
        run: aext -> {
          aggregate: aisum
        }
      `);
      expect(t).toTranslate();
      const q = t.modelDef.queryList[0];
      expect(q).toBeDefined();
      expect(q.compositeResolvedSourceDef?.as).toBe('s2');
    });
    test('required group by causes composed source to fall off end', () => {
      expect(
        markSource`
          ##! experimental { composite_sources grouped_by }
          source: aext is compose(
            a extend {
              dimension: x is 1
              measure: aisum is ai.sum() { grouped_by: x }
            },
            a extend {
              dimension: y is 1
              measure: aisum is ai.sum() { grouped_by: y }
            }
          )
          run: aext -> { aggregate: ${'aisum'} }
        `
      ).toLog(
        errorMessage(
          'This operation uses field `aisum`, resulting in invalid usage of the composite source, as there is a missing required group by or single value filter of `x` and/or `y` (fields required in source: `aisum`)'
        )
      );
    });
    test('required group by fails one slice; other slice fails because of field usage', () => {
      expect(
        markSource`
          ##! experimental { composite_sources grouped_by }
          source: aext is compose(
            a extend {
              dimension: x is 1
              measure: aisum is ai.sum() { grouped_by: x }
              dimension: foo is 1
            },
            a extend {
              measure: aisum is ai.sum()
            }
          )
          run: aext -> {
            aggregate: aisum
            group_by: ${'foo'}
          }
        `
      ).toLog(
        errorMessage(
          'This operation uses field `foo`, resulting in invalid usage of the composite source, as there is no composite input source which defines `foo` without having an unsatisfied required group by or single value filter on `x` (fields required in source: `aisum` and `foo`)'
        )
      );
    });
    test('joined composed source input skipped when invalid require group by usage', () => {
      const t = new TestTranslator(`
        ##! experimental { composite_sources grouped_by }
        source: s1 is a extend {
          dimension: x is 1
          measure: aisum is ai.sum() { grouped_by: x }
        }
        # only_on_s2
        source: s2 is a extend {
          measure: aisum is ai.sum()
        }
        source: aext is compose(s1, s2)
        source: bext is b extend {
          join_one: aext on true
        }
        run: bext -> {
          aggregate: aext.aisum
        }
      `);
      expect(t).toTranslate();
      const q = t.modelDef.queryList[0];
      expect(q).toBeDefined();
      const aext = q.compositeResolvedSourceDef?.fields.find(
        f => f.as === 'aext'
      );
      expect(aext).toBeDefined();
      expect(aext?.annotation?.blockNotes).toMatchObject([
        {text: '# only_on_s2\n'},
      ]);
    });
    test('evil case where cannot resolve join composite because of field in root', () => {
      // Here, `aext_aisum` is defined in `bext`, which means that when we are looking up the
      // aggregate usage of `aext_aisum` (when deciding whether the first slice of the joined
      // composite is valid), we need to know `bext`'s fields.
      const t = new TestTranslator(`
        ##! experimental { composite_sources grouped_by }
        # only_on_s2
        source: s2 is a extend {
          measure: aisum is ai.sum()
        }
        source: aext is compose(
          a extend {
            dimension: x is 1
            measure: aisum is ai.sum() { grouped_by: x }
          },
          s2
        )
        source: bext is b extend {
          join_one: aext on true
          measure: aext_aisum is aext.aisum
        }
        run: bext -> {
          aggregate: aext_aisum
        }
      `);
      expect(t).toTranslate();
      const q = t.modelDef.queryList[0];
      expect(q).toBeDefined();
      const aext = q.compositeResolvedSourceDef?.fields.find(
        f => f.as === 'aext'
      );
      expect(aext).toBeDefined();
      expect(aext?.annotation?.blockNotes).toMatchObject([
        {text: '# only_on_s2\n'},
      ]);
    });
    test('require_group_by expression additive', () => {
      expect(
        markSource`
          ##! experimental.grouped_by
          source: aext is a extend {
            measure: aisum1 is ai.sum() { grouped_by: astr }
            measure: aisum2 is ai.sum() { grouped_by: abool }
          }
          run: aext -> { aggregate: aisum is ${'aisum1'} + ${'aisum2'} }
        `
      ).toLog(
        errorMessage(
          'Group by or single value filter of `astr` is required but not present'
        ),
        errorMessage(
          'Group by or single value filter of `abool` is required but not present'
        )
      );
    });
    test('grouped_by basic joined success', () => {
      expect(
        markSource`
          ##! experimental.grouped_by
          source: aext is a extend {
            measure: aisum is ai.sum() { grouped_by: astr }
          }
          source: bext is b extend {
            join_one: aext on true
          }
          run: bext -> { group_by: aext.astr; aggregate: aext.aisum }
        `
      ).toTranslate();
    });
    test('grouped_by basic joined failure', () => {
      expect(
        markSource`
          ##! experimental.grouped_by
          source: aext is a extend {
            measure: aisum is ai.sum() { grouped_by: astr }
          }
          source: bext is b extend {
            join_one: aext on true
          }
          // Note that the 'group_by: astr' does not fool the checker!
          run: bext -> { group_by: astr; aggregate: aext.aisum }
        `
      ).toLog(
        errorMessage(
          'Group by or single value filter of `aext.astr` is required but not present'
        )
      );
    });
    test('grouped by failure when ungrouped (all, expression)', () => {
      expect(
        markSource`
          ##! experimental.grouped_by
          run: a -> { group_by: astr; aggregate: x is all(ai.sum() { grouped_by: astr }) }
        `
      ).toLog(
        errorMessage(
          'Group by or single value filter of `astr` is required but not present'
        )
      );
    });
    test('grouped by success when ungrouped (exclude okay, expression)', () => {
      expect(
        markSource`
          ##! experimental.grouped_by
          run: a -> { group_by: astr, abool; aggregate: x is exclude(ai.sum() { grouped_by: astr }, abool) }
        `
      ).toTranslate();
    });
    test('grouped by failure when ungrouped (all) direct in query', () => {
      expect(
        markSource`
          ##! experimental.grouped_by
          source: aext is a extend {
            measure: aisum is ai.sum() { grouped_by: astr }
          }
          run: aext -> { group_by: astr; aggregate: x is all(aisum) }
        `
      ).toLog(
        errorMessage(
          'Group by or single value filter of `astr` is required but not present'
        )
      );
    });
    test('grouped by failure when ungrouped (exclude)', () => {
      expect(
        markSource`
          ##! experimental.grouped_by
          source: aext is a extend {
            measure: aisum is ai.sum() { grouped_by: astr }
          }
          run: aext -> { group_by: astr; aggregate: x is exclude(aisum, astr) }
        `
      ).toLog(
        errorMessage(
          'Group by or single value filter of `astr` is required but not present'
        )
      );
    });
    test('grouped by success when ungrouped (exclude, different name)', () => {
      expect(
        markSource`
          ##! experimental.grouped_by
          source: aext is a extend {
            measure: aisum is ai.sum() { grouped_by: astr }
          }
          run: aext -> { group_by: astr, abool; aggregate: x is exclude(aisum, abool) }
        `
      ).toTranslate();
    });
    // Ideally, in cases where the aggregate usage is known when the measure is defined,
    // we should log an error immediately rather than waiting until it is used in a query.
    test.skip('grouped by failure when ungrouped (all) in measure definition not used in query', () => {
      expect(
        markSource`
          ##! experimental.grouped_by
          source: aext is a extend {
            measure: aisum is ai.sum() { grouped_by: astr }
            measure: x is all(${'aisum'})
          }
        `
      ).toLog(
        errorMessage(
          'Ungrouped aggregate results in unsatisfiable required Group by or single value filter of `astr`'
        )
      );
    });
    test('grouped by failure when ungrouped (all) in measure definition then used in query', () => {
      expect(
        markSource`
          ##! experimental.grouped_by
          source: aext is a extend {
            measure: aisum is ai.sum() { grouped_by: astr }
            measure: x is all(aisum)
          }
          run: aext -> { group_by: astr; aggregate: ${'x'} }
        `
      ).toLog(
        // TODO Might not really need both these errors...
        // errorMessage(
        //   'Ungrouped aggregate results in unsatisfiable required Group by or single value filter of `astr`'
        // ),
        errorMessage(
          'Group by or single value filter of `astr` is required but not present'
        )
      );
    });
    test('ungroup fails composite slice', () => {
      const t = new TestTranslator(`
        ##! experimental { grouped_by composite_sources }
        source: s2 is a extend {
          measure: aisum is ai.sum()
        }
        source: aext is compose(
          a extend {
            measure: aisum is ai.sum() { grouped_by: astr }
          },
          s2
        )
        run: aext -> { group_by: astr; aggregate: x is exclude(aisum, astr) }
      `);
      expect(t).toTranslate();
      const q = t.modelDef.queryList[0];
      expect(q).toBeDefined();
      expect(q.compositeResolvedSourceDef?.as).toBe('s2');
    });
    test('ungroup fails composite source', () => {
      expect(
        markSource`
          ##! experimental { grouped_by composite_sources }
          source: slice_1 is a extend {
            measure: aisum is ai.sum() { grouped_by: astr }
          }
          source: aext is compose(
            slice_1,
            a extend {
              measure: aisum is ai.sum() { grouped_by: abool }
            }
          )
          run: aext -> { group_by: astr, abool; aggregate: x is exclude(aisum, astr, abool) }
        `
      ).toLog(
        errorMessage(
          'This operation uses field `aisum`, resulting in invalid usage of the composite source, as there is a missing required group by or single value filter of `astr` and/or `abool` (fields required in source: `astr`, `abool`, and `aisum`)'
        )
      );
    });
    test('grouped_by: is ignored if field does not exist in slice', () => {
      expect(
        markSource`
          ##! experimental { grouped_by composite_sources access_modifiers }
          source: abase is a extend {
            measure: aisum is ai.sum() { grouped_by: astr, abool }
          }
          source: aext is compose(
            abase include {
              except: *
              public: ai, astr, aisum
            } extend {
              dimension: x is 1
            },
            abase include {
              except: *
              public: ai, abool, aisum
            } extend {
              dimension: y is 1
            }
          )
          run: aext -> {
            group_by: astr, x
            aggregate: aisum
          }
          run: aext -> {
            group_by: abool, y
            aggregate: aisum
          }
        `
      ).toTranslate();
    });
    test('ignore grouped_by which has been removed from source (non-composite)', () => {
      expect(
        markSource`
          ##! experimental { grouped_by composite_sources access_modifiers }
          source: abase is a extend {
            measure: aisum is ai.sum() { grouped_by: astr, abool }
          }
          source: aext is abase include {
            except: *
            public: ai, astr, aisum
          } extend {
            dimension: x is 1
          }
          run: aext -> {
            group_by: astr, x
            aggregate: aisum
          }
        `
      ).toTranslate();
    });
    test('ungroup in join expression', () => {
      expect(
        markSource`
          ##! experimental { grouped_by composite_sources }
          source: aext is a extend {
            measure: aisum is ai.sum() { grouped_by: astr }
          }
          source: bext is b extend {
            join_one: aext on true
          }
          run: bext -> { group_by: aext.astr; aggregate: x is exclude(${'aext.aisum'}, astr) }
        `
      ).toLog(
        errorMessage(
          'Group by or single value filter of `aext.astr` is required but not present'
        )
      );
    });
    test('ungroup in join reference', () => {
      expect(
        markSource`
          ##! experimental { grouped_by composite_sources }
          source: aext is a extend {
            measure: aisum is ai.sum() { grouped_by: astr }
            measure: x is all(aisum)
          }
          source: bext is b extend {
            join_one: aext on true
          }
          run: bext -> { group_by: aext.astr; aggregate: ${'aext.x'} }
        `
      ).toLog(
        errorMessage(
          'Group by or single value filter of `aext.astr` is required but not present'
        )
      );
    });
    test('ungroup shadowed by definition', () => {
      expect(
        markSource`
          ##! experimental { grouped_by composite_sources }
          source: aext is a extend {
            measure: aisum is ai.sum() { grouped_by: astr }
          }
          run: aext -> {
            group_by: astr;
            nest: foo is {
              group_by: astr is 'foo'
              aggregate: x is exclude(${'aisum'}, astr)
            }
          }
        `
      ).toTranslate();
    });
    test('ungroup shadowed by reference', () => {
      expect(
        markSource`
          ##! experimental { grouped_by composite_sources }
          source: aext is a extend {
            measure: aisum is ai.sum() { grouped_by: astr }
            join_one: a on true
          }
          run: aext -> {
            group_by: astr;
            nest: foo is {
              group_by: a.astr
              aggregate: x is exclude(${'aisum'}, astr)
            }
          }
        `
      ).toTranslate();
    });
    test('ungroup nested', () => {
      expect(
        markSource`
          ##! experimental { grouped_by composite_sources }
          source: aext is a extend {
            measure: aisum is ai.sum() { grouped_by: astr }
          }
          run: aext -> {
            group_by: astr;
            nest: foo is {
              aggregate: x is exclude(${'aisum'}, astr)
            }
          }
        `
      ).toLog(
        errorMessage(
          'Group by or single value filter of `astr` is required but not present'
        )
      );
    });
    test('malformed query source does not die with "Unknown Dialect"', () => {
      expect('source: nsq is a->no_such_query').toLog(
        errorMessage("'no_such_query' is not defined")
      );
    });
  });
});
