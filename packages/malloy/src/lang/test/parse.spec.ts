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
  model,
  expr,
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
  describe('source:', () => {
    test('table', () => {
      expect("source: testA is table('aTable')").toTranslate();
    });
    test('shorcut fitlered table', () => {
      expect("source: xA is table('aTable') {? astr ~ 'a%' }").toTranslate();
    });
    test('fitlered table', () => {
      expect(
        "source: testA is table('aTable') { where: astr ~ 'a%' }"
      ).toTranslate();
    });
    test('ref source with no refinement', () => {
      expect('source: testA is a').toTranslate();
    });
    test('from(query)', () => {
      expect('source: testA is from(a->{group_by: astr})').toTranslate();
    });
    test('refine source', () => {
      expect('source: aa is a { dimension: a is astr }').toTranslate();
    });
    test('source refinement preserves original', () => {
      const x = new TestTranslator('source: na is a + { dimension: one is 1 }');
      expect(x).toTranslate();
      const a = x.getSourceDef('a');
      if (a) {
        const aFields = a.fields.map(f => f.as || f.name);
        expect(aFields).toContain('astr');
        expect(aFields).not.toContain('one');
      }
    });
  });
  describe('query:', () => {
    test('anonymous query', () => {
      expect("query: table('aTable') -> { group_by: astr }").toTranslate();
    });
    test('query', () => {
      expect(
        "query: name is table('aTable') -> { group_by: astr }"
      ).toTranslate();
    });
    test('query from query', () => {
      expect(
        `
          query: q1 is ab->{ group_by: astr limit: 10 }
          query: q2 is ->q1
        `
      ).toTranslate();
    });
    test('query with refinements from query', () => {
      expect(
        `
          query: q1 is ab->{ group_by: astr limit: 10 }
          query: q2 is ->q1 { aggregate: acount }
        `
      ).toTranslate();
    });
    test('chained query operations', () => {
      expect(`
        query: ab
          -> { group_by: astr; aggregate: acount }
          -> { top: 5; where: astr ~ 'a%' group_by: astr }
      `).toTranslate();
    });
    test('from(query) refined into query', () => {
      expect(
        'query: from(ab -> {group_by: astr}) { dimension: bigstr is UPPER(astr) } -> { group_by: bigstr }'
      ).toTranslate();
    });
    test('query with shortcut filtered turtle', () => {
      expect("query: allA is ab->aturtle {? astr ~ 'a%' }").toTranslate();
    });
    test('query with filtered turtle', () => {
      expect("query: allA is ab->aturtle { where: astr ~ 'a%' }").toTranslate();
    });
    test('nest: in group_by:', () => {
      expect(`
        query: ab -> {
          group_by: astr;
          nest: nested_count is {
            aggregate: acount
          }
        }
      `).toTranslate();
    });
    test('reduce pipe project', () => {
      expect(`
        query: a -> { aggregate: f is count() } -> { project: f2 is f + 1 }
      `).toTranslate();
    });
    test('refine and extend query', () => {
      expect(`
        query: a_by_str is a -> { group_by: astr }
        query: -> a_by_str { aggregate: str_count is count() }
      `).toTranslate();
    });
    test('query refinement preserves original', () => {
      const x = new TestTranslator(`
        query: q is a -> { aggregate: acount is count() }
        query: nq is -> q + { group_by: astr }
      `);
      expect(x).toTranslate();
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
      expect(x).toTranslate();
      const q = x.getQuery('q');
      expect(q).toBeDefined();
      if (q) {
        expect(q.pipeline.length).toBe(1);
      }
    });
    test('all ungroup with args', () => {
      expect(`
        query: a -> {
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
      query: a -> {
        group_by: astr
        nest: by_int is {
          group_by: ai
          aggregate: bi_count is all(count(), afloat)
        }
      }
    `).compileToFailWith("all() 'afloat' is missing from query output");
    });
    test('exclude ungroup with args', () => {
      expect(`
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
      `).toTranslate();
    });
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
    test('exclude problem revealed by production models', () => {
      expect(`
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
      `).toTranslate();
    });
    describe('query operation typechecking', () => {
      describe('field declarations', () => {
        test('cannot use aggregate in group_by', () => {
          expect('query: a -> { group_by: s is count()}').compileToFailWith(
            'Cannot use an aggregate field in a group_by operation, did you mean to use an aggregate operation instead?'
          );
        });
        test('cannot use ungrouped_aggregate in group_by', () => {
          expect(
            'query: a -> { group_by: s is all(count())}'
          ).compileToFailWith(
            'Cannot use an aggregate field in a group_by operation, did you mean to use an aggregate operation instead?'
          );
        });
        test('cannot use analytic in group_by', () => {
          expect(
            'query: a -> { group_by: s is row_number()}'
          ).compileToFailWith(
            'Cannot use an analytic field in a group_by operation, did you mean to use a calculate operation instead?'
          );
        });
        test('cannot use aggregate in dimension', () => {
          expect(
            'source: a1 is a { dimension: s is count()}'
          ).compileToFailWith(
            'Cannot use an aggregate field in a dimension declaration, did you mean to use a measure declaration instead?'
          );
        });
        test('cannot use ungrouped_aggregate in dimension', () => {
          expect(
            'source: a1 is a { dimension: s is all(count())}'
          ).compileToFailWith(
            'Cannot use an aggregate field in a dimension declaration, did you mean to use a measure declaration instead?'
          );
        });
        test('cannot use analytic in dimension', () => {
          expect(
            'source: a1 is a { dimension: s is row_number()}'
          ).compileToFailWith(
            'Cannot use an analytic field in a dimension declaration'
          );
        });
        test('cannot use scalar in measure', () => {
          expect('source: a1 is a { measure: s is 1}').compileToFailWith(
            'Cannot use a scalar field in a measure declaration, did you mean to use a dimension declaration instead?'
          );
        });
        test('cannot use analytic in measure', () => {
          expect(
            'source: a1 is a { measure: s is lag(count())}'
          ).compileToFailWith(
            'Cannot use an analytic field in a measure declaration'
          );
        });
        test('cannot use scalar in aggregate', () => {
          expect('query: a -> { aggregate: s is 1}').compileToFailWith(
            'Cannot use a scalar field in an aggregate operation, did you mean to use a group_by or project operation instead?'
          );
        });
        test('cannot use analytic in aggregate', () => {
          expect(
            'query: a -> { aggregate: s is lag(count())}'
          ).compileToFailWith(
            'Cannot use an analytic field in an aggregate operation, did you mean to use a calculate operation instead?'
          );
        });
        test('cannot use scalar in calculate', () => {
          expect(
            'query: a -> { group_by: a is 1; calculate: s is 1 }'
          ).compileToFailWith(
            'Cannot use a scalar field in a calculate operation, did you mean to use a group_by or project operation instead?'
          );
        });
        test('cannot use aggregate in calculate', () => {
          expect(
            'query: a -> { group_by: a is 1; calculate: s is count() }'
          ).compileToFailWith(
            'Cannot use an aggregate field in a calculate operation, did you mean to use an aggregate operation instead?'
          );
        });
        test('cannot use aggregate in project', () => {
          expect('query: a -> { project: s is count() }').compileToFailWith(
            'Cannot use an aggregate field in a project operation, did you mean to use an aggregate operation instead?'
          );
        });
        test('cannot use analytic in project', () => {
          expect(
            'query: a -> { project: s is row_number() }'
          ).compileToFailWith(
            'Cannot use an analytic field in a project operation, did you mean to use a calculate operation instead?'
          );
        });
        test('cannot use analytic in declare', () => {
          expect(
            'query: a -> { group_by: a is 1; declare: s is row_number() }'
          ).compileToFailWith(
            'Analytic expressions can not be used in a declare block'
          );
        });
        test('cannot use aggregate in index', () => {
          expect(
            'query: a { measure: acount is count() } -> { index: acount }'
          ).compileToFailWith(
            'Cannot use an aggregate field in an index operation'
          );
        });
        test('can use aggregate in except', () => {
          expect(`
            source: b1 is a { measure: acount is count() }
            source: c1 is b1 { except: acount }
          `).toTranslate();
        });
      });
      describe('field references', () => {
        test('cannot use aggregate in group_by', () => {
          expect(
            'query: a -> { declare: acount is count(); group_by: acount }'
          ).compileToFailWith(
            'Cannot use an aggregate field in a group_by operation, did you mean to use an aggregate operation instead?'
          );
        });
        test('cannot use query in group_by', () => {
          expect(
            'query: a { query: q is { group_by: x is 1 } } -> { group_by: q }'
          ).compileToFailWith(
            'Cannot use a query field in a group_by operation, did you mean to use a nest operation instead?'
          );
        });
        test('cannot use scalar in aggregate', () => {
          expect(
            'query: a -> { declare: aconst is 1; aggregate: aconst }'
          ).compileToFailWith(
            'Cannot use a scalar field in an aggregate operation, did you mean to use a group_by or project operation instead?'
          );
        });
        test('cannot use scalar in calculate', () => {
          expect(
            'query: a -> { declare: aconst is 1; group_by: x is 1; calculate: aconst }'
          ).compileToFailWith(
            'Cannot use a scalar field in a calculate operation, did you mean to use a group_by or project operation instead?'
          );
        });
        test('cannot use aggregate in calculate', () => {
          expect(
            'query: a -> { declare: acount is count(); group_by: x is 1; calculate: acount }'
          ).compileToFailWith(
            'Cannot use an aggregate field in a calculate operation, did you mean to use an aggregate operation instead?'
          );
        });
        test('cannot use query in project', () => {
          expect(
            'query: a { query: q is { group_by: x is 1 } } -> { project: q }'
          ).compileToFailWith(
            'Cannot use a query field in a project operation, did you mean to use a nest operation instead?'
          );
        });
        test('cannot use query in index', () => {
          expect(
            'query: a { query: q is { group_by: x is 1 } } -> { index: q }'
          ).compileToFailWith('Cannot use a query field in an index operation');
        });
        test('cannot use query in calculate', () => {
          expect(
            'query: a { query: q is { group_by: x is 1 } } -> { group_by: x is 1; calculate: q }'
          ).compileToFailWith(
            'Cannot use a query field in a calculate operation, did you mean to use a nest operation instead?'
          );
        });
        test('cannot use query in aggregate', () => {
          expect(
            'query: a { query: q is { group_by: x is 1 } } -> { aggregate: q }'
          ).compileToFailWith(
            'Cannot use a query field in an aggregate operation, did you mean to use a nest operation instead?'
          );
        });
        test('cannot use aggregate in calculate, preserved over refinement', () => {
          expect(`query: a1 is a -> {
            aggregate: c is count()
          }
          query: -> a1 {
            calculate: b is c
          }`).compileToFailWith(
            'Cannot use an aggregate field in a calculate operation, did you mean to use an aggregate operation instead?'
          );
        });
        test('cannot use scalar in calculate, preserved over refinement', () => {
          expect(`query: a1 is a -> {
            group_by: c is 1
          }
          query: -> a1 {
            calculate: b is c
          }`).compileToFailWith(
            'Cannot use a scalar field in a calculate operation, did you mean to use a group_by or project operation instead?'
          );
        });
        test('cannot use analytic in group_by, preserved over refinement', () => {
          expect(`query: a1 is a -> {
            group_by: c is 1
            calculate: c2 is lag(c)
          }
          query: -> a1 {
            group_by: b is c2
          }`).compileToFailWith(
            // c2 is not defined because group_by doesn't know to look in the output space
            "'c2' is not defined",
            "Cannot define 'b', value has unknown type"
          );
        });
        test('cannot use analytic in order_by, preserved over refinement', () => {
          expect(`query: a1 is a -> {
            group_by: c is 1
            calculate: c2 is lag(c)
          }
          query: -> a1 {
            order_by: c2
          }`).compileToFailWith('Illegal order by of analytic field c2');
        });
        test('cannot ungroup an ungrouped', () => {
          expect(`query: a1 is a -> {
            group_by: c is 1
            aggregate: c2 is all(all(sum(ai)))
          }`).compileToFailWith(
            'all() expression must not already be ungrouped',
            "Cannot define 'c2', value has unknown type"
          );
        });
        test('cannot aggregate an ungrouped', () => {
          expect(`query: a1 is a -> {
            group_by: c is 1
            aggregate: c2 is sum(all(sum(ai)))
          }`).compileToFailWith(
            'Aggregate expression cannot be aggregate',
            "Cannot define 'c2', value has unknown type"
          );
        });
        test('cannot aggregate an aggregate', () => {
          expect(`query: a1 is a -> {
            group_by: c is 1
            aggregate: c2 is sum(sum(ai))
          }`).compileToFailWith(
            'Aggregate expression cannot be aggregate',
            "Cannot define 'c2', value has unknown type"
          );
        });
        test('can use field def in group_by, preserved over refinement', () => {
          expect(`query: a1 is a -> {
            group_by: c is 1
          }
          query: -> a1 {
            order_by: c
          }`).toTranslate();
        });
        test('can use field ref in group_by, preserved over refinement', () => {
          expect(`query: a1 is a -> {
            group_by: c is astr
          }
          query: -> a1 {
            order_by: c
          }`).toTranslate();
        });
      });
    });
    describe('function typechecking', () => {
      test('use function correctly', () => {
        expect(`query: a -> {
          group_by: s is concat('a', 'b')
        }`).toTranslate();
      });
      test('function no matching overload', () => {
        expect(`query: a -> {
          group_by: s is floor('a', 'b')
        }`).compileToFailWith(
          'No matching overload for function floor(string, string)',
          "Cannot define 's', value has unknown type"
        );
      });
      test('unknown function', () => {
        expect(`query: a -> {
          group_by: s is asdfasdf()
        }`).compileToFailWith(
          "Unknown function 'asdfasdf'. Use 'asdfasdf!(...)' to call a SQL function directly.",
          "Cannot define 's', value has unknown type"
        );
      });
      test('can select different overload', () => {
        expect('query: a -> { group_by: s is concat() }').toTranslate();
      });
      test('can pass different expression types', () => {
        expect(`query: a -> {
          group_by: f1 is sqrt(1)
          aggregate: f2 is sqrt(count())
          aggregate: f3 is sqrt(all(count()))
          calculate: f4 is sqrt(lag(f1))
          calculate: f5 is sqrt(lag(count()))
        }`).toTranslate();
      });
      test('function return type correct', () => {
        expect(`query: a -> {
          group_by: s is floor(1.2) + 1
        }`).toTranslate();
      });
      test('function return type incorrect', () => {
        expect(`query: a -> {
            group_by: s is floor(1.2) + 'a'
        }`).compileToFailWith(
          "Non numeric('number,string') value with '+'",
          "Cannot define 's', value has unknown type"
        );
      });
      test('can use output value in calculate', () => {
        expect(`query: a -> {
          group_by: x is 1
          calculate: s is lag(x)
        }`).toTranslate();
      });
      test('cannot use output value in group_by', () => {
        expect(`query: a -> {
          group_by: x is 1
          group_by: y is x
        }`).compileToFailWith(
          "'x' is not defined",
          "Cannot define 'y', value has unknown type"
        );
      });
      test('lag can check that other args are constant', () => {
        expect(`query: a -> {
          group_by: x is 1
          calculate: s is lag(x, 1, x)
        }`).compileToFailWith(
          // TODO improve this error message
          "Parameter 3 ('default') of lag must be literal or constant, but received output"
        );
      });
      test('lag can check that other args are literal', () => {
        expect(`query: a -> {
          group_by: x is 1
          calculate: s is lag(x, 1 + 1)
        }`).compileToFailWith(
          // TODO improve this error message
          "Parameter 2 ('offset') of lag must be literal, but received constant"
        );
      });
      test('lag can check that other args are nonnull', () => {
        expect(`query: a -> {
          group_by: x is 1
          calculate: s is lag(x, null)
        }`).compileToFailWith(
          "Parameter 2 ('offset') of lag must not be a literal null"
        );
      });
      test('lag can use constant values for other args', () => {
        expect(`query: a -> {
          group_by: x is 1
          calculate: s is lag(x, 2)
        }`).toTranslate();
      });
      test('cannot name top level objects same as functions', () => {
        expect(
          markSource`query: ${'concat is a -> { group_by: x is 1 }'}`
        ).compileToFailWith(
          // TODO improve this error message
          "'concat' is already defined, cannot redefine"
        );
      });
      test('`now` is considered constant`', () => {
        expect(`query: a -> {
          group_by: n is now
          calculate: l is lag(n, 1, now)
        }`).toTranslate();
      });
      // TODO it might be nice to reference a field which is a constant, and be able to
      // use that as a constant param. Same with a literal.
      test('cannot use a field which is a constant in a constant param', () => {
        expect(
          `query: a -> {
            group_by: ai, pi is pi()
            calculate: l is lag(ai, 1, pi)
          }`
        ).compileToFailWith(
          "Parameter 3 ('default') of lag must be literal or constant, but received output"
        );
      });
      // TODO we don't handle referencing a join as a field correctly in all cases today.
      // For now, it at least is considered type `struct` and therefore fails to parse
      // as a function argument.
      // We add <join_name>_id to the query, but it's not included in the output space
      test('cannot use struct in function arg', () => {
        expect(
          `query: a {join_one: b with astr } -> {
            group_by: b
            calculate: foo is lag(b)
          }`
        ).compileToFailWith(
          'No matching overload for function lag(struct)',
          "Cannot define 'foo', value has unknown type"
        );
      });
      // TODO this doesn't work today, we're not rigorous enough with integer
      // subtypes. But we should probably make this typecheck properly.
      test.skip('cannot use float in round precision', () => {
        expect(`query: a -> {
          group_by: x is round(1.5, 1.6)
        }`).compileToFailWith(
          // TODO improve this error message
          "Parameter 2 ('precision') for round must be integer, received float"
        );
      });
      test('cannot use stddev with no arguments', () => {
        expect(`query: a -> {
          aggregate: x is stddev()
        }`).compileToFailWith(
          'No matching overload for function stddev()',
          "Cannot define 'x', value has unknown type"
        );
      });
      test('can use stddev with postfix syntax', () => {
        expect(`query: a -> {
          declare: y is 1
          aggregate: x is y.stddev()
        }`).toTranslate();
      });
      test('can use stddev with postfix syntax on join', () => {
        expect(`query: a -> {
          join_one: b with astr
          aggregate: x is b.ai.stddev()
        }`).toTranslate();
      });
      test('can use calculate with a measure', () => {
        expect(`query: a { measure: c is count() } -> {
          group_by: y is 1
          calculate: x is lag(c)
        }`).toTranslate();
      });
      test('cannot use calculate with input fields', () => {
        expect(`query: a -> {
          group_by: y is 1
          calculate: x is lag(ai)
        }`).compileToFailWith(
          // TODO improve this error message:
          // Parameter 1 ('value') of 'lag' must be a constant, an aggregate, or an expression using
          // only fields that appear in the query output. Received an expression which uses a field
          // that is not in the query output.
          "Parameter 1 ('value') of lag must be literal, constant or output, but received input"
        );
      });
      test('can use calculate with aggregate field which is not in query', () => {
        expect(`query: a { measure: acount is count() } -> {
          group_by: astr
          calculate: pc is lag(acount)
        }`).toTranslate();
      });
      test('cannot use agregate as argument to agg function', () => {
        expect(`query: a -> {
          aggregate: x is stddev(count())
        }`).compileToFailWith(
          "Parameter 1 ('value') of stddev must be scalar, but received aggregate"
        );
      });
      test('cannot use calculate with no other fields', () => {
        expect(`query: a -> {
          calculate: x is row_number()
        }`).compileToFailWith(
          "Can't determine query type (group_by/aggregate/nest,project,index)"
        );
      });
      // TODO someday make it so we can order by an analytic function
      test('today: cannot order by analytic function', () => {
        expect(`query: a -> {
          group_by: astr
          calculate: row_num is row_number()
          order_by: row_num desc
        }`).compileToFailWith('Illegal order by of analytic field row_num');
      });
      test('cannot use analytic in calculate -- and preserved over refinement', () => {
        expect(`query: a1 is a -> {
          group_by: astr
          calculate: p is lag(astr)
        }
        query: -> a1 {
          calculate: p1 is lag(p)
        }`).compileToFailWith(
          "Parameter 1 ('value') of lag must be scalar or aggregate, but received scalar_analytic"
        );
      });
      test('cannot use aggregate analytic in project', () => {
        expect(`query: a -> {
          project: astr
          calculate: p is lag(count())
        }`).compileToFailWith('Cannot add aggregate analyics to project');
      });
      test('reference field in join', () => {
        expect(`query: a -> {
          join_one: b with astr
          group_by: b.ai
        }`).toTranslate();
      });
      // TODO decide whether this syntax should be legal, really...
      test('reference join name in group_by', () => {
        expect(`query: a -> {
          join_one: b with astr
          group_by: b
        }`).toTranslate();
      });
      test('can reference project: inline join.* field in calculate', () => {
        expect(`query: a -> {
          join_one: b with astr
          project: b.*
          calculate: s is lag(ai)
        }`).toTranslate();
      });
      test('can reference project: join.* field in calculate', () => {
        expect(`query: a { join_one: b with astr } -> {
          project: b.*
          calculate: s is lag(ai)
        }`).toTranslate();
      });
    });
  });
  test('errors on redefinition of query', () => {
    expect(
      'query: q1 is a -> { project: * }, q1 is a -> { project: * }'
    ).compileToFailWith("'q1' is already defined, cannot redefine");
  });
});

describe('source properties', () => {
  test('single dimension', () => {
    expect('source: aa is a { dimension: x is 1 }').toTranslate();
  });
  test('multiple dimensions', () => {
    expect(`
      source: aa is a {
        dimension:
          x is 1
          y is 2
      }
    `).toTranslate();
  });
  test('single declare', () => {
    expect('source: aa is a { declare: x is 1 }').toTranslate();
  });
  test('multiple declare', () => {
    expect(`
      source: aa is a {
        declare:
          x is 1
          y is 2
      }
    `).toTranslate();
  });
  test('single measure', () => {
    expect('source: aa is a { measure: x is count() }').toTranslate();
  });
  test('multiple measures', () => {
    expect(`
      source: aa is a {
        measure:
          x is count()
          y is x * x
      }
    `).toTranslate();
  });
  test('single where', () => {
    expect('source: aa is a { where: ai > 10 }').toTranslate();
  });
  test('multiple where', () => {
    expect(`
      source: aa is a {
        where:
          ai > 10,
          af < 1000
      }
    `).toTranslate();
  });
  test('where clause can use the join namespace in source refined query', () => {
    expect(`
    source: flights is table('malloytest.flights') + {
      query: boo is {
        join_one: carriers is table('malloytest.carriers') on carrier = carriers.code
        where: carriers.code = 'WN' | 'AA'
        group_by: carriers.nickname
        aggregate: flight_count is count()
      }
    }`).toTranslate();
  });
  describe('joins', () => {
    test('with', () => {
      expect('source: x is a { join_one: b with astr }').toTranslate();
    });
    test('with', () => {
      expect(
        model`source: x is a { join_one: y is b with astr }`
      ).toTranslate();
    });
    test('with dotted ref', () => {
      expect(
        model`source: x is ab { join_one: xz is a with b.astr }`
      ).toTranslate();
    });
    test('one on', () => {
      expect(
        model`source: x is a { join_one: b on astr = b.astr }`
      ).toTranslate();
    });
    test('one is on', () => {
      expect(
        'source: x is a { join_one: y is b on astr = y.astr }'
      ).toTranslate();
    });
    test('many on', () => {
      expect(
        'source: nab is a { join_many: b on astr = b.astr }'
      ).toTranslate();
    });
    test('many is on', () => {
      expect(
        'source: y is a { join_many: x is b on astr = x.astr }'
      ).toTranslate();
    });
    test('cross', () => {
      expect('source: nab is a { join_cross: b }').toTranslate();
    });
    test('cross is', () => {
      expect('source: nab is a { join_cross: xb is b }').toTranslate();
    });
    test('cross on', () => {
      expect('source: nab is a { join_cross: b on true}').toTranslate();
    });
    test('multiple joins', () => {
      expect(`
        source: nab is a {
          join_one:
            b with astr,
            br is b with astr
        }
      `).toTranslate();
    });
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
  test('primary_key', () => {
    expect('source: c is a { primary_key: ai }').toTranslate();
  });
  test('rename', () => {
    expect('source: c is a { rename: nn is ai }').toTranslate();
  });
  test('accept single', () => {
    const onlyAstr = new TestTranslator('source: c is a { accept: astr }');
    expect(onlyAstr).toTranslate();
    const c = onlyAstr.getSourceDef('c');
    if (c) {
      expect(c.fields.length).toBe(1);
    }
  });
  test('accept multi', () => {
    expect('source: c is a { accept: astr, af }').toTranslate();
  });
  test('except single', () => {
    const noAstr = new TestTranslator('source: c is a { except: astr }');
    expect(noAstr).toTranslate();
    const c = noAstr.getSourceDef('c');
    if (c) {
      const foundAstr = c.fields.find(f => f.name === 'astr');
      expect(foundAstr).toBeUndefined();
    }
  });
  test('except multi', () => {
    expect('source: c is a { except: astr, af }').toTranslate();
  });
  test('explore-query', () => {
    expect('source: c is a {query: q is { group_by: astr } }').toTranslate();
  });
  test('refined explore-query', () => {
    expect(`
      source: abNew is ab {
        query: for1 is aturtle {? ai = 1 }
      }
    `).toTranslate();
  });
  test('chained explore-query', () => {
    expect(`
      source: c is a {
        query: chain is {
          group_by: astr
        } -> {
          top: 10; order_by: astr
          project: *
        }
      }
    `).toTranslate();
  });
  test('multiple explore-query', () => {
    expect(`
      source: abNew is ab {
        query:
          q1 is { group_by: astr },
          q2 is { group_by: ai }
      }
    `).toTranslate();
  });
});

describe('qops', () => {
  test('group by single', () => {
    expect('query: a->{ group_by: astr }').toTranslate();
  });
  test("group_by x is x'", () => {
    expect('query: a->{ group_by: ai is ai/2 }').toTranslate();
  });
  test('group by multiple', () => {
    expect('query: a->{ group_by: astr,ai }').toTranslate();
  });
  test('aggregate single', () => {
    expect('query: a->{ aggregate: num is count() }').toTranslate();
  });
  test('aggregate multiple', () => {
    expect(`
      query: a->{
        aggregate: num is count(), total is sum(ai)
      }
    `).toTranslate();
  });
  test('project ref', () => {
    expect('query:ab->{ project: b.astr }').toTranslate();
  });
  test('project *', () => {
    expect('query:ab->{ project: * }').toTranslate();
  });
  test('project def', () => {
    expect('query:ab->{ project: one is 1 }').toTranslate();
  });
  test('project multiple', () => {
    expect(`
      query: a->{
        project: one is 1, astr
      }
    `).toTranslate();
  });
  test('index single', () => {
    expect('query:a->{index: astr}').toTranslate();
  });
  test('index path', () => {
    expect('query:ab->{index: ab.astr}').toTranslate();
  });
  test('index unique on path', () => {
    expect('query:ab->{index: b.astr, ab.astr}').toTranslate();
  });
  test('index join.*', () => {
    expect('query:ab->{index: ab.*}').toTranslate();
  });
  test('index multiple', () => {
    const model = new TestTranslator('query:a->{index: af, astr}');
    expect(model).toTranslate();
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
    expect(model).toTranslate();
    const q = model.getQuery(0);
    expect(q).toBeDefined();
    if (q) {
      const index = q.pipeline[0];
      expect(index.type).toBe('index');
      expect(index.fields).toEqual(['*', 'astr']);
    }
  });
  test('index by', () => {
    expect('query:a->{index: * by ai}').toTranslate();
  });
  test('index sampled', () => {
    expect('query:a->{index: *; sample: true}').toTranslate();
  });
  test('index unsampled', () => {
    expect('query:a->{index: *; sample: false}').toTranslate();
  });
  test('index sample-percent', () => {
    const model = new TestTranslator('query:a->{index: *; sample: 42%}');
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
    expect('query:a->{index: *; sample: 100000}').toTranslate();
  });
  test('top N', () => {
    expect('query: a->{ top: 5; group_by: astr }').toTranslate();
  });
  test('top N by field', () => {
    expect('query: a->{top: 5 by astr; group_by: astr}').toTranslate();
  });
  test('top N by expression', () => {
    expect('query: ab->{top: 5 by ai + 1; group_by: ai}').toTranslate();
  });
  test('top N by field must be in the output space', () =>
    expect('query: a->{top: 5 by af; group_by: astr}').compileToFailWith(
      'Unknown field af in output space'
    ));
  test('limit N', () => {
    expect('query: a->{ limit: 5; group_by: astr }').toTranslate();
  });
  test('order by', () => {
    expect('query: a->{ order_by: astr; group_by: astr }').toTranslate();
  });
  test('order by preserved over refinement', () => {
    expect(`
      query: a1 is a -> { group_by: astr }
      query: -> a1 { order_by: astr }
    `).toTranslate();
  });
  test('order by must be in the output space', () =>
    expect('query: a -> { order_by: af; group_by: astr }').compileToFailWith(
      'Unknown field af in output space'
    ));
  test('order by asc', () => {
    expect('query: a->{ order_by: astr asc; group_by: astr }').toTranslate();
  });
  test('order by desc', () => {
    expect('query: a->{ order_by: astr desc; group_by: astr }').toTranslate();
  });
  test('order by N', () => {
    expect('query: a->{ order_by: 1 asc; group_by: astr }').toTranslate();
  });
  test('order by multiple', () => {
    expect(`
      query: a->{
        order_by: 1 asc, af desc
        group_by: astr, af
      }
    `).toTranslate();
  });
  test('where single', () => {
    expect('query:a->{ group_by: astr; where: af > 10 }').toTranslate();
  });
  test('having single', () => {
    expect(
      'query:ab->{ aggregate: acount; group_by: astr; having: acount > 10 }'
    ).toTranslate();
  });
  test('compound having still works', () => {
    expect(
      'query:ab->{ aggregate: acount; having: acount > 10 and acount < 100 }'
    ).toTranslate();
  });
  test('compound aggregate still works', () => {
    expect(
      'query:ab->{ aggregate: thing is acount > 10 and acount < 100 }'
    ).toTranslate();
  });
  test('where multiple', () => {
    expect(
      "query:a->{ group_by: astr; where: af > 10,astr~'a%' }"
    ).toTranslate();
  });
  test('filters preserve source formatting in code:', () => {
    const model = new TestTranslator(
      "source: notb is a + { where: astr  !=  'b' }"
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
      'source: notb is a + { dimension: d is 1 +   2 }'
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
      query: a->{
        group_by: ai
        nest: nestbystr is { group_by: astr; aggregate: N is count() }
      }
    `).toTranslate();
  });
  test('nest multiple', () => {
    expect(`
      query: a->{
        group_by: ai
        nest:
          nestbystr is { group_by: astr; aggregate: N is count() },
          renest is { group_by: astr; aggregate: N is count() }
      }
    `).toTranslate();
  });
  test('nest ref', () => {
    expect('query: ab->{group_by: ai; nest: aturtle}').toTranslate();
  });
  test('refine query with extended source', () => {
    const m = new TestTranslator(`
      source: nab is ab {
        query: xturtle is aturtle + {
          declare: aratio is ai / acount
        }
      }
      query: nab -> xturtle + { aggregate: aratio }
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
  test('refine query source with field', () => {
    const m = new TestTranslator(`
      query: ab -> aturtle + {
        declare: aratio is ai / acount
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
      query: ab -> aturtle + {
        join_one: bb is b on bb.astr = astr
        group_by: foo is bb.astr
      }
    `);
    expect(m).toTranslate();
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
  test('integer', () => {
    expect(expr`42`).toTranslate();
  });
  test('string', () => {
    expect(expr`'fortywo-two'`).toTranslate();
  });
  test('string with quoted quote', () => {
    const str = "'Isn" + '\\' + "'t this nice'";
    expect(new BetaExpression(str)).toTranslate();
  });
  test('string with quoted backslash', () => {
    const str = "'Is " + '\\' + '\\' + " nice'";
    expect(new BetaExpression(str)).toTranslate();
  });
  const literalTimes: [string, string, string | undefined, unknown][] = [
    ['@1960', 'date', 'year', {literal: '1960-01-01'}],
    ['@1960-Q2', 'date', 'quarter', {literal: '1960-04-01'}],
    ['@1960-06', 'date', 'month', {literal: '1960-06-01'}],
    ['@1960-06-26-WK', 'date', 'week', {literal: '1960-06-26'}],
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
    expect(exprModel).toTranslate();
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
    ['@1960-06-26-Wk', '1960-06-26 00:00:00'],
    ['@1960-06-30', '1960-06-30 00:00:00'],
    ['@1960-06-30 00:00', undefined],
  ];
  test.each(morphicLiterals)('morphic value for %s is %s', (expr, morphic) => {
    const exprModel = new BetaExpression(expr);
    expect(exprModel).toTranslate();
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
  test('minute+locale', () => {
    expect(expr`@1960-06-30 10:30[America/Los_Angeles]`).toTranslate();
  });
  test('second 8601', () => {
    expect(expr`@1960-06-30T10:30:31`).toTranslate();
  });
  test('null', () => {
    expect(expr`null`).toTranslate();
  });
  test('now', () => {
    expect(expr`now`).toTranslate();
  });
  test('true', () => {
    expect(expr`true`).toTranslate();
  });
  test('false', () => {
    expect(expr`false`).toTranslate();
  });
  test('regex', () => {
    expect(expr`r'RegularExpression'`).toTranslate();
  });
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
      expect(new BetaExpression(`ats.${unit}`)).toParse();
    });

    // mtoy todo units missing: implement, or document
    const diffable = ['second', 'minute', 'hour', 'day'];
    test.each(diffable.map(x => [x]))('timestamp difference - %s', unit => {
      expect(new BetaExpression(`${unit}(@2021 to ats)`)).toParse();
    });
    test.each(diffable.map(x => [x]))('timestamp difference - %s', unit => {
      expect(new BetaExpression(`${unit}(ats to @2030)`)).toParse();
    });
  });

  test('field name', () => {
    expect(expr`astr`).toTranslate();
  });
  test('function call', () => {
    expect(expr`concat('foo')`).toTranslate();
  });

  describe('operators', () => {
    test('addition', () => {
      expect(expr`42 + 7`).toTranslate();
    });
    test('subtraction', () => {
      expect(expr`42 - 7`).toTranslate();
    });
    test('multiplication', () => {
      expect(expr`42 * 7`).toTranslate();
    });
    test('mod', () => {
      expect(expr`42 % 7`).toTranslate();
    });
    test('division', () => {
      expect(expr`42 / 7`).toTranslate();
    });
    test('unary negation', () => {
      expect(expr`- ai`).toTranslate();
    });
    test('equal', () => {
      expect(expr`42 = 7`).toTranslate();
    });
    test('not equal', () => {
      expect(expr`42 != 7`).toTranslate();
    });
    test('greater than', () => {
      expect(expr`42 > 7`).toTranslate();
    });
    test('greater than or equal', () => {
      expect(expr`42 >= 7`).toTranslate();
    });
    test('less than or equal', () => {
      expect(expr`42 <= 7`).toTranslate();
    });
    test('less than', () => {
      expect(expr`42 < 7`).toTranslate();
    });
    test('match', () => {
      expect(expr`'forty-two' ~ 'fifty-four'`).toTranslate();
    });
    test('not match', () => {
      expect(expr`'forty-two' !~ 'fifty-four'`).toTranslate();
    });
    test('apply', () => {
      expect(expr`'forty-two' ? 'fifty-four'`).toTranslate();
    });
    test('not', () => {
      expect(expr`not true`).toTranslate();
    });
    test('and', () => {
      expect(expr`true and false`).toTranslate();
    });
    test('or', () => {
      expect(expr`true or false`).toTranslate();
    });
    test('null-check (??)', () => {
      expect(expr`ai ?? 7`).toTranslate();
    });
    test('disallow date OP number', () => {
      expect(new BetaExpression('@2001 = 7')).compileToFailWith(
        'Cannot compare a date to a number'
      );
    });
    test('disallow date OP timestamp', () => {
      expect(new BetaExpression('ad = ats')).compileToFailWith(
        'Cannot compare a date to a timestamp'
      );
    });
    test('disallow interval from date to timestamp', () => {
      expect(new BetaExpression('days(ad to ats)')).compileToFailWith(
        'Cannot measure from date to timestamp'
      );
    });
    test('comparison promotes date literal to timestamp', () => {
      expect(expr`@2001 = ats`).toTranslate();
    });
    test('can apply range to date', () => {
      expect(expr`ad ? @2001 for 1 day`).toTranslate();
    });
    const noOffset = ['second', 'minute', 'hour'];

    test.each(noOffset.map(x => [x]))('disallow date delta %s', unit => {
      expect(new BetaExpression(`ad + 10 ${unit}s`)).compileToFailWith(
        `Cannot offset date by ${unit}`
      );
    });
  });

  test('filtered measure', () => {
    expect(expr`acount {? astr = 'why?' }`).toTranslate();
  });
  test('filtered ungrouped aggregate', () => {
    expect(`
        query: a -> {
          group_by: ai
          aggregate: x is all(avg(ai)) { where: true }
        }
      `).toTranslate();
  });
  test('correctly flags filtered scalar', () => {
    const e = new BetaExpression('ai { where: true }');
    expect(e).compileToFailWith(
      'Filtered expression requires an aggregate computation'
    );
  });
  test('correctly flags filtered analytic', () => {
    expect(markSource`
        query: a -> {
          group_by: ai
          calculate: l is lag(ai) { where: true }
        }
      `).compileToFailWith(
      'Filtered expression requires an aggregate computation'
    );
  });

  describe('aggregate forms', () => {
    test('count', () => {
      expect(expr`count()`).toTranslate();
    });
    test('count distinct', () => {
      expect(expr`count(distinct astr)`).toTranslate();
    });
    test('join.count()', () => {
      expect(expr`b.count()`).toTranslate();
    });
    for (const f of ['sum', 'min', 'max', 'avg']) {
      const fOfT = `${f}(af)`;
      test(fOfT, () => {
        expect(new BetaExpression(fOfT)).toTranslate();
      });
      if (f !== 'min' && f !== 'max') {
        const joinDot = `b.af.${f}()`;
        test(joinDot, () => {
          expect(new BetaExpression(joinDot)).toTranslate();
        });
        const joinAgg = `b.${f}(af)`;
        test(joinAgg, () => {
          expect(new BetaExpression(joinAgg)).toTranslate();
        });
      }
    }
  });

  describe('pick statements', () => {
    test('full', () => {
      expect(expr`
        pick 'the answer' when ai = 42
        pick 'the questionable answer' when ai = 54
        else 'random'
    `).toTranslate();
    });
    test('applied', () => {
      expect(expr`
        astr ?
          pick 'the answer' when = '42'
          pick 'the questionable answer' when = '54'
          else 'random'
    `).toTranslate();
    });
    test('filtering', () => {
      expect(expr`astr ? pick 'missing value' when NULL`).toTranslate();
    });
    test('null branch with else', () => {
      expect("astr ? pick null when = '42' else 3").toReturnType('number');
    });
    test('null branch no else', () => {
      expect("astr ? pick null when = '42'").toReturnType('string');
    });
    test('null branch no apply', () => {
      expect('pick null when 1 = 1 else 3').toReturnType('number');
    });
    test('tiering', () => {
      expect(expr`
      ai ?
        pick 1 when < 10
        pick 10 when < 100
        pick 100 when < 1000
        else 10000
  `).toTranslate();
    });
    test('transforming', () => {
      expect(expr`
        ai ?
          pick 'small' when < 10
          pick 'medium' when < 100
          else 'large'
    `).toTranslate();
    });

    test('when single values', () => {
      expect(expr`
        ai ?
          pick 'one' when 1
          else 'a lot'
      `).toTranslate();
    });
    test('n-ary without else', () => {
      expect(`
        source: na is a + { dimension: d is
          pick 7 when true and true
        }
      `).compileToFailWith(
        "pick incomplete, missing 'else'",
        "Cannot define 'd', value has unknown type"
      );
    });
    test('n-ary with mismatch when clauses', () => {
      expect(markSource`
        source: na is a + { dimension: d is
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
        source: na is a + { dimension: d is
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
        source: na is a + { dimension: d is
          7 ? pick 7 when 7 else 'not seven'
        }
      `).compileToFailWith(
        "else type 'string', expected 'number'",
        "Cannot define 'd', value has unknown type"
      );
    });
    test('applied default mismatch', () => {
      expect(markSource`
        source: na is a + { dimension: d is
          7 ? pick 'seven' when 7
        }
      `).compileToFailWith(
        "pick default type 'number', expected 'string'",
        "Cannot define 'd', value has unknown type"
      );
    });
    test('applied when mismatch', () => {
      expect(markSource`
        source: na is a + { dimension: d is
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
    expect(m).toTranslate();
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
        expect(x).toMatchObject({
          'e': [
            {
              'function': 'numberLiteral',
              'literal': '1',
              'type': 'dialect',
            },
            // TODO not sure why there are TWO sets of parentheses... A previous version of this test
            // just checked that there were ANY parens, so that went under the radar. Not fixing now.
            '+((',
            {
              'denominator': [
                {
                  'function': 'numberLiteral',
                  'literal': '4',
                  'type': 'dialect',
                },
              ],
              'function': 'div',
              'numerator': [
                {
                  'function': 'numberLiteral',
                  'literal': '3',
                  'type': 'dialect',
                },
              ],
              'type': 'dialect',
            },
            '))',
          ],
        });
      } else {
        fail('expression with parens compiled oddly');
      }
    }
  });
  test.each([
    ['ats', 'timestamp'],
    ['ad', 'date'],
    ['ai', 'number'],
    ['astr', 'string'],
    ['abool', 'boolean'],
  ])('Can compare field %s (type %s) to NULL', (name, _datatype) => {
    expect(expr`${name} = NULL`).toTranslate();
  });
});
describe('unspported fields in schema', () => {
  test('unsupported reference in result allowed', () => {
    const uModel = new TestTranslator('query: a->{ group_by: aun }');
    expect(uModel).toTranslate();
  });
  test('unsupported reference can be compared to NULL', () => {
    const uModel = new TestTranslator(
      'query: a->{ where: aun != NULL; project: * }'
    );
    expect(uModel).toTranslate();
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
    expect(uModel).toTranslate();
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
    expect(uModel).toTranslate();
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
        source: newAB is a { join_one: newB is ${'bb'} on astring }
        source: newB is b
      `
    ).compileToFailWith("Undefined source 'bb'");
  });
  test(
    'non-rename rename',
    badModel(
      'source: na is a { rename: astr is astr }',
      "Can't rename field to itself"
    )
  );
  test(
    'reference to field in its definition',
    badModel(
      'source: na is a { dimension: ustr is UPPER(ustr) } ',
      "Circular reference to 'ustr' in definition"
    )
  );
  test('empty model', () => {
    expect('').toTranslate();
  });
  test('one line model ', () => {
    expect('\n').toTranslate();
  });
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
        source: na is a { join_one: ${'n'} on astr }
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
  test('rejoin a query is renamed', () => {
    expect(`
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
    `).toTranslate();
  });
  test('popping out of embedding when not embedded', () => {
    expect('}%').compileToFailWith(/extraneous input '}%' expecting/);
  });

  test('bad sql in sql block', () => {
    const badModel = new TestTranslator('sql: { select: """)""" }');
    expect(badModel).toParse();
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
  test('renamed source location', () => {
    const source = markSource`source: ${'na is a'}`;
    const m = new TestTranslator(source.code);
    expect(m).toParse();
    expect(getExplore(m.modelDef, 'na').location).toMatchObject(
      source.locations[0]
    );
  });

  test('refined source location', () => {
    const source = markSource`source: ${'na is a {}'}`;
    const m = new TestTranslator(source.code);
    expect(m).toParse();
    expect(getExplore(m.modelDef, 'na').location).toMatchObject(
      source.locations[0]
    );
  });

  test('location of defined dimension', () => {
    const source = markSource`source: na is a { dimension: ${'x is 1'} }`;
    const m = new TestTranslator(source.code);
    expect(m).toTranslate();
    const na = getExplore(m.modelDef, 'na');
    const x = getField(na, 'x');
    expect(x.location).toMatchObject(source.locations[0]);
  });

  test('location of defined measure', () => {
    const source = markSource`source: na is a { measure: ${'x is count()'} }`;
    const m = new TestTranslator(source.code);
    expect(m).toTranslate();
    const na = getExplore(m.modelDef, 'na');
    const x = getField(na, 'x');
    expect(x.location).toMatchObject(source.locations[0]);
  });

  test('location of defined query', () => {
    const source = markSource`source: na is a { query: ${'x is { group_by: y is 1 }'} }`;
    const m = new TestTranslator(source.code);
    expect(m).toTranslate();
    const na = getExplore(m.modelDef, 'na');
    const x = getField(na, 'x');
    expect(x.location).toMatchObject(source.locations[0]);
  });

  test('location of defined field inside a query', () => {
    const source = markSource`
      source: na is a {
        query: x is {
          group_by: ${'y is 1'}
        }
      }`;

    const m = new TestTranslator(source.code);
    expect(m).toTranslate();
    const na = getExplore(m.modelDef, 'na');
    const x = getQueryField(na, 'x');
    const y = getField(x.pipeline[0], 'y');
    expect(y.location).toMatchObject(source.locations[0]);
  });

  test('location of filtered field inside a query', () => {
    const source = markSource`
      source: na is a {
        measure: y is count()
        query: x is {
          aggregate: ${'z is y { where: true }'}
        }
      }`;

    const m = new TestTranslator(source.code);
    expect(m).toTranslate();
    const na = getExplore(m.modelDef, 'na');
    const x = getQueryField(na, 'x');
    const z = getField(x.pipeline[0], 'z');
    expect(z.location).toMatchObject(source.locations[0]);
  });

  test('location of field inherited from table', () => {
    const source = markSource`source: na is ${"table('aTable')"}`;
    const m = new TestTranslator(source.code);
    expect(m).toTranslate();
    const na = getExplore(m.modelDef, 'na');
    const abool = getField(na, 'abool');
    expect(abool.location).toMatchObject(source.locations[0]);
  });

  test('location of field inherited from sql block', () => {
    const source = markSource`--- comment
      sql: s is { select: ${'"""SELECT 1 as one """'} }
      source: na is from_sql(s)
    `;
    const m = new TestTranslator(source.code);
    expect(m).toParse();
    const compileSql = m.translate().compileSQL;
    expect(compileSql).toBeDefined();
    if (compileSql) {
      m.update({
        compileSQL: {[compileSql.name]: getSelectOneStruct(compileSql)},
      });
      expect(m).toTranslate();
      const na = getExplore(m.modelDef, 'na');
      const one = getField(na, 'one');
      expect(one.location).isLocationIn(source.locations[0], source.code);
    }
  });

  test('location of fields inherited from a query', () => {
    const source = markSource`
      source: na is from(
        ${"table('aTable')"} -> {
          group_by:
            abool
            ${'y is 1'}
        }
      )
    `;
    const m = new TestTranslator(source.code);
    expect(m).toTranslate();
    const na = getExplore(m.modelDef, 'na');
    const abool = getField(na, 'abool');
    expect(abool.location).toMatchObject(source.locations[0]);
    const y = getField(na, 'y');
    expect(y.location).toMatchObject(source.locations[1]);
  });

  test('location of named query', () => {
    const source = markSource`query: ${'q is a -> { project: * }'}`;
    const m = new TestTranslator(source.code);
    expect(m).toTranslate();
    const q = getExplore(m.modelDef, 'q');
    expect(q.location).toMatchObject(source.locations[0]);
  });

  test('location of field in named query', () => {
    const source = markSource`query: q is a -> { group_by: ${'b is 1'} }`;
    const m = new TestTranslator(source.code);
    expect(m).toTranslate();
    const q = getModelQuery(m.modelDef, 'q');
    const a = getField(q.pipeline[0], 'b');
    expect(a.location).toMatchObject(source.locations[0]);
  });

  test('location of named SQL block', () => {
    const source = markSource`${'sql: s is { select: """SELECT 1 as one""" }'}`;
    const m = new TestTranslator(source.code);
    expect(m).toParse();
    const compileSql = m.translate().compileSQL;
    expect(compileSql).toBeDefined();
    if (compileSql) {
      m.update({
        compileSQL: {[compileSql.name]: getSelectOneStruct(compileSql)},
      });
      expect(m).toTranslate();
      const s = m.sqlBlocks[0];
      expect(s.location).isLocationIn(source.locations[0], source.code);
    }
  });

  test('location of renamed field', () => {
    const source = markSource`
      source: na is a {
        rename: ${'bbool is abool'}
      }
    `;
    const m = new TestTranslator(source.code);
    expect(m).toTranslate();
    const na = getExplore(m.modelDef, 'na');
    const bbool = getField(na, 'bbool');
    expect(bbool.location).toMatchObject(source.locations[0]);
  });

  test('location of join on', () => {
    const source = markSource`
      source: na is a {
        join_one: ${'x is a { primary_key: abool } on abool'}
      }
    `;
    const m = new TestTranslator(source.code);
    expect(m).toTranslate();
    const na = getExplore(m.modelDef, 'na');
    const x = getField(na, 'x');
    expect(x.location).toMatchObject(source.locations[0]);
  });

  test('location of join with', () => {
    const source = markSource`
      source: na is a {
        join_one: ${'x is a { primary_key: astr } with astr'}
      }
    `;
    const m = new TestTranslator(source.code);
    expect(m).toTranslate();
    const na = getExplore(m.modelDef, 'na');
    const x = getField(na, 'x');
    expect(x.location).toMatchObject(source.locations[0]);
  });

  test('location of field in join', () => {
    const source = markSource`
      source: na is a {
        join_one: x is a {
          primary_key: abool
          dimension: ${'y is 1'}
        } on abool
      }
    `;
    const m = new TestTranslator(source.code);
    expect(m).toTranslate();
    const na = getExplore(m.modelDef, 'na');
    const x = getJoinField(na, 'x');
    const y = getField(x, 'y');
    expect(y.location).toMatchObject(source.locations[0]);
  });

  // Since """ strings are not single tokens, I don't know how to do this.
  // test("multi line sql block token span is correct", () => {
  //   const sqlSource = `sql: { select: """// line 0\n//line 1\n// line 2""" }`;
  //   const m = new TestTranslator(sqlSource);
  //   expect(m).not.toParse();
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
      source: ${'na is a'}
      query: ${'na'} -> { project: * }
    `;
    const m = new TestTranslator(source.code);
    expect(m).toTranslate();
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
      source: t is a {
        query: ${'q is { project: * }'}
      }
      query: t -> ${'q'}
    `;
    const m = new TestTranslator(source.code);
    expect(m).toTranslate();
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
      source: na is a { query: ${'x is { group_by: y is 1 }'} }
      query: na -> ${'x'}
    `;
    const m = new TestTranslator(source.code);
    expect(m).toTranslate();
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
      source: na is from_sql(${'s'})
    `;
    const m = new TestTranslator(source.code);
    expect(m).toParse();
    const compileSql = m.translate().compileSQL;
    expect(compileSql).toBeDefined();
    if (compileSql) {
      m.update({
        compileSQL: {[compileSql.name]: getSelectOneStruct(compileSql)},
      });
      expect(m).toTranslate();
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
      source: na is from(-> ${'q'})
    `;
    const m = new TestTranslator(source.code);
    expect(m).toTranslate();
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
    expect(m).toTranslate();
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
    expect(m).toTranslate();
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
      source: na is ${"table('aTable')"}
      query: na -> { project: bbool is not ${'abool'} }
    `;
    const m = new TestTranslator(source.code);
    expect(m).toTranslate();
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
      source: na is a {
        dimension: ${"`name` is 'name'"}
      }
      query: na -> { project: ${'`name`'} }
    `;
    const m = new TestTranslator(source.code);
    expect(m).toTranslate();
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
      source: na is a {
        join_one: self is ${"table('aTable')"}
          on astr = self.astr
      }
      query: na -> { project: bstr is self.${'astr'} }
    `;
    const m = new TestTranslator(source.code);
    expect(m).toTranslate();
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
      source: na is a {
        join_one: ${'self is a on astr = self.astr'}
      }
      query: na -> { project: bstr is ${'self'}.astr }
    `;
    const m = new TestTranslator(source.code);
    expect(m).toTranslate();
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
    expect(m).toTranslate();
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
      source: na is ${"table('aTable')"}
      query: na -> { project: ${'abool'} }
    `;
    const m = new TestTranslator(source.code);
    expect(m).toTranslate();
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
    expect(m).toTranslate();
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
    expect(m).toTranslate();
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
    expect(m).toTranslate();
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
      source: e is a {
        measure: ${'c is count()'}
        measure: c2 is ${'c'}
      }
    `;
    const m = new TestTranslator(source.code);
    expect(m).toTranslate();
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
    expect(m).toTranslate();
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
    expect(m).toTranslate();
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
    expect(m).toTranslate();
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
      source: na is ${"table('aTable')"}
      query: na -> { aggregate: ai_sum is ${'ai'}.sum() }
    `;
    const m = new TestTranslator(source.code);
    expect(m).toTranslate();
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
      source: na is a {
        join_one: ${'self is a on astr = self.astr'}
      }
      query: na -> { aggregate: ai_sum is ${'self'}.sum(self.ai) }
    `;
    const m = new TestTranslator(source.code);
    expect(m).toTranslate();
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
      source: na is a {
        join_one: ${'self is a on astr = self.astr'}
      }
      query: na -> { aggregate: ai_sum is self.sum(${'self'}.ai) }
    `;
    const m = new TestTranslator(source.code);
    expect(m).toTranslate();
    expect(m.referenceAt(pos(source.locations[1]))).toMatchObject({
      location: source.locations[1],
      type: 'joinReference',
      text: 'self',
      definition: {
        location: source.locations[0],
      },
    });
  });

  test('reference to sourcein join', () => {
    const source = markSource`
      source: ${'exp1 is a'}
      source: exp2 is a {
        join_one: ${'exp1'} on astr = exp1.astr
      }
    `;
    const m = new TestTranslator(source.code);
    expect(m).toTranslate();
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
      source: na is ${"table('aTable')"}
      query: na -> { aggregate: ai_sum is sum(${'ai'}) }
    `;
    const m = new TestTranslator(source.code);
    expect(m).toTranslate();
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
      source: na is ${"table('aTable')"} {
        rename: bbool is ${'abool'}
      }
    `;
    const m = new TestTranslator(source.code);
    expect(m).toTranslate();
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
      source: exp1 is a { primary_key: astr }
      source: exp2 is ${"table('aTable')"} {
        join_one: exp1 with ${'astr'}
      }
    `;
    const m = new TestTranslator(source.code);
    expect(m).toTranslate();
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
    expect(m).not.toParse();
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
    expect(m).toParse();
    const req = m.translate().compileSQL;
    expect(req).toBeDefined();
    if (req) {
      m.update({errors: {compileSQL: {[req.name]: 'Bad SQL!'}}});
    }
    expect(m).not.toTranslate();
    const errList = m.errors().errors;
    expect(errList[0].at).isLocationIn(source.locations[0], source.code);
  });

  test('table struct error location', () => {
    const source = markSource`
      source: bad_explore is ${"table('malloy-data.bad.table')"}
    `;
    const m = new TestTranslator(source.code);
    const result = m.translate();
    m.update({
      errors: {
        tables: {[(result.tables || [])[0]]: 'Bad table!'},
      },
    });
    expect(m).not.toParse();
    const errList = m.errors().errors;
    expect(errList[0].at).isLocationIn(source.locations[0], source.code);
    return undefined;
  });
});

describe('pipeline comprehension', () => {
  test('second query gets namespace from first', () => {
    expect(`
      source: aq is a {
        query: t1 is {
          group_by: t1int is ai, t1str is astr
        } -> {
          project: t1str, t1int
        }
      }
    `).toTranslate();
  });
  test(
    "second query doesn't have access to original fields",
    badModel(
      markSource`
        source: aq is a {
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
  test('new query can append ops to existing query', () => {
    expect(`
      source: aq is a {
        query: t0 is {
          group_by: t1int is ai, t1str is astr
        }
        query: t1 is t0 -> {
          project: t1str, t1int
        }
      }
    `).toTranslate();
  });
  test('new query can refine and append to exisiting query', () => {
    expect(`
      source: aq is table('aTable') {
        query: by_region is { group_by: astr }
        query: by_region2 is by_region {
          nest: dateNest is { group_by: ad }
        } -> {
          project: astr, dateNest.ad
        }
      }
    `).toTranslate();
  });
  test('reference to a query can include a refinement', () => {
    expect(`
      query: ab -> {
        group_by: ai
        nest: aturtle { limit: 1 }
      }
    `).toTranslate();
  });
  test('Querying an sourcebased on a query', () => {
    expect(`
      query: q is a -> { group_by: astr; aggregate: strsum is ai.sum() }
      source: aq is a {
        join_one: aq is from(->q) on astr = aq.astr
      }
      query: aqf is aq -> { project: * }
    `).toTranslate();
  });
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
    expect(m).toTranslate();
    const s2 = m.getQuery('s2');
    expect(s2?.pipeline.length).toBe(2);
  });
});

describe('raw function call with type specified', () => {
  test('timestamp_seconds', () => {
    expect('timestamp_seconds!timestamp(0)').toReturnType('timestamp');
  });
});
