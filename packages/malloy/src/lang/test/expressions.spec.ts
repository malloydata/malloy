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
  expr,
  TestTranslator,
  markSource,
  BetaExpression,
  model,
  makeModelFunc,
  getQueryFieldDef,
  getExplore,
  getFieldDef,
} from './test-translator';
import './parse-expects';

describe('expressions', () => {
  describe('timeframes', () => {
    const timeframes = [
      ['second', 'minute', 'hour', 'day', 'week', 'month', 'quarter', 'year'],
    ];
    test.each(timeframes)('timestamp truncate %s', unit => {
      const truncSrc = model`run: a->{select: tts is ats.${unit}}`;
      expect(truncSrc).toTranslate();
      const tQuery = truncSrc.translator.getQuery(0);
      expect(tQuery).toBeDefined();
      const tField = getQueryFieldDef(tQuery!.pipeline[0], 'tts');
      expect(tField['timeframe']).toEqual(unit);
    });

    const dateTF = [['week', 'month', 'quarter', 'year']];
    test.each(dateTF)('date truncate %s', unit => {
      const truncSrc = model`run: a->{select: td is ad.${unit}}`;
      expect(truncSrc).toTranslate();
      const tQuery = truncSrc.translator.getQuery(0);
      expect(tQuery).toBeDefined();
      const tField = getQueryFieldDef(tQuery!.pipeline[0], 'td');
      expect(tField['timeframe']).toEqual(unit);
    });

    // mtoy todo units missing: implement, or document
    const diffable = [['second', 'minute', 'hour', 'day']];
    test.each(diffable)('timestamp difference - %s', unit => {
      expect(new BetaExpression(`${unit}(@2021 to ats)`)).toParse();
    });
    test.each(diffable)('timestamp difference - %s', unit => {
      expect(new BetaExpression(`${unit}(ats to @2030)`)).toParse();
    });
  });

  test('field name', () => {
    expect(expr`astr`).compilesTo('astr');
  });
  test('function call', () => {
    expect(expr`concat('foo')`).toTranslate();
  });

  describe('operators', () => {
    test('addition', () => {
      expect('42 + 7').compilesTo('{42 + 7}');
    });
    test('typecheck addition lhs', () => {
      const wrong = expr`${'"string"'} + 1`;
      expect(wrong).translationToFailWith(
        "The '+' operator requires a number, not a 'string'"
      );
    });
    test('typecheck addition rhs', () => {
      const wrong = expr`1 + ${'"string"'}`;
      expect(wrong).translationToFailWith(
        "The '+' operator requires a number, not a 'string'"
      );
    });
    test('subtraction', () => {
      expect('42 - 7').compilesTo('{42 - 7}');
    });
    test('multiplication', () => {
      expect('42 * 7').compilesTo('{42 * 7}');
    });
    test('mod', () => {
      expect('42 % 7').compilesTo('{42 % 7}');
    });
    test('division', () => {
      expect('42 / 7').compilesTo('{42 / 7}');
    });
    test('unary negation', () => {
      expect('- ai').compilesTo('{unary- ai}');
    });
    test('equal', () => {
      expect('42 = 7').compilesTo('{42 = 7}');
    });
    test('not equal', () => {
      expect('42 != 7').compilesTo('{42 != 7}');
    });
    test('greater than', () => {
      expect('42 > 7').compilesTo('{42 > 7}');
    });
    test('greater than or equal', () => {
      expect('42 >= 7').compilesTo('{42 >= 7}');
    });
    test('less than or equal', () => {
      expect('42 <= 7').compilesTo('{42 <= 7}');
    });
    test('less than', () => {
      expect('42 < 7').compilesTo('{42 < 7}');
    });
    test('match', () => {
      expect("'forty-two' ~ 'fifty-four'").compilesTo(
        '{"forty-two" like "fifty-four"}'
      );
    });
    test('not match', () => {
      expect("'forty-two' !~ 'fifty-four'").compilesTo(
        '{"forty-two" !like "fifty-four"}'
      );
    });
    test('apply as equality', () => {
      expect("'forty-two' ? 'fifty-four'").compilesTo(
        '{"forty-two" = "fifty-four"}'
      );
    });
    test('not', () => {
      expect('not true').compilesTo('{not true}');
    });
    test('and', () => {
      expect('true and false').compilesTo('{true and false}');
    });
    test('or', () => {
      expect('true or false').compilesTo('{true or false}');
    });
    test('null-check (??)', () => {
      expect('ai ?? 7').compilesTo('{ai coalesce 7}');
    });
    test('coalesce type mismatch', () => {
      expect(new BetaExpression('ai ?? @2003')).translationToFailWith(
        'Mismatched types for coalesce (number, date)'
      );
    });
    test('disallow date OP number', () => {
      expect(new BetaExpression('@2001 = 7')).translationToFailWith(
        'Cannot compare a date to a number'
      );
    });
    test('disallow date OP timestamp', () => {
      expect(new BetaExpression('ad = ats')).translationToFailWith(
        'Cannot compare a date to a timestamp'
      );
    });
    test('disallow interval from date to timestamp', () => {
      expect(new BetaExpression('days(ad to ats)')).translationToFailWith(
        'Cannot measure from date to timestamp'
      );
    });
    test('compare to truncation uses straight comparison', () => {
      expect('ad = ad.quarter').compilesTo('{ad = {timeTrunc-quarter ad}}');
    });
    test('compare to granular result expression uses straight comparison', () => {
      expect('ad = ad.quarter + 1').compilesTo(
        '{ad = {+quarter {timeTrunc-quarter ad} 1}}'
      );
    });
    test('apply granular-truncation uses range', () => {
      expect('ad ? ad.quarter').compilesTo(
        '{{ad >= {timeTrunc-quarter ad}} and {ad < {+quarter {timeTrunc-quarter ad} 1}}}'
      );
    });
    test('apply granular-literal alternation uses all literals for range', () => {
      expect('ad ? @2020 | @2022').compilesTo(
        '{{{ad >= @2020-01-01} and {ad < @2021-01-01}} or {{ad >= @2022-01-01} and {ad < @2023-01-01}}}'
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
      expect(new BetaExpression(`ad + 10 ${unit}s`)).translationToFailWith(
        `Cannot offset date by ${unit}`
      );
    });
    test('apply with parens', () => {
      expect(expr`ai ? (> 1 & < 100)`).toTranslate();
    });
    describe('sql friendly warnings', () => {
      test('is null with warning', () => {
        const warnSrc = expr`ai is null`;
        expect(warnSrc).toTranslateWithWarnings(
          "Use '= NULL' to check for NULL instead of 'IS NULL'"
        );
        expect(warnSrc).compilesTo('{is-null ai}');
        const warning = warnSrc.translator.problems()[0];
        expect(warning.replacement).toEqual('ai = null');
      });
      test('is not null with warning', () => {
        const warnSrc = expr`ai is not null`;
        expect(warnSrc).toTranslateWithWarnings(
          "Use '!= NULL' to check for NULL instead of 'IS NOT NULL'"
        );
        expect(warnSrc).compilesTo('{is-not-null ai}');
        const warning = warnSrc.translator.problems()[0];
        expect(warning.replacement).toEqual('ai != null');
      });
      test('like with warning', () => {
        const warnSrc = expr`astr like 'a'`;
        expect(warnSrc).toTranslateWithWarnings(
          "Use Malloy operator '~' instead of 'LIKE'"
        );
        expect(warnSrc).compilesTo('{astr like "a"}');
        const warning = warnSrc.translator.problems()[0];
        expect(warning.replacement).toEqual("astr ~ 'a'");
      });
      test('NOT LIKE with warning', () => {
        const warnSrc = expr`astr not like 'a'`;
        expect(warnSrc).toTranslateWithWarnings(
          "Use Malloy operator '!~' instead of 'NOT LIKE'"
        );
        expect(warnSrc).compilesTo('{astr !like "a"}');
        const warning = warnSrc.translator.problems()[0];
        expect(warning.replacement).toEqual("astr !~ 'a'");
      });
      test('is is-null in a model', () => {
        const isNullSrc = model`source: xa is a extend { dimension: x1 is astr is null }`;
        expect(isNullSrc).toTranslateWithWarnings(
          "Use '= NULL' to check for NULL instead of 'IS NULL'"
        );
      });
      test('is not-null in a model', () => {
        const isNullSrc = model`source: xa is a extend { dimension: x1 is not null }`;
        expect(isNullSrc).toTranslate();
      });
      test('is not-null is in a model', () => {
        const isNullSrc = model`source: xa is a extend { dimension: x1 is not null is null }`;
        expect(isNullSrc).toTranslateWithWarnings(
          "Use '= NULL' to check for NULL instead of 'IS NULL'"
        );
        const warning = isNullSrc.translator.problems()[0];
        expect(warning.replacement).toEqual('null = null');
      });
      test('x is expr y is not null', () => {
        const isNullSrc = model`source: xa is a extend { dimension: x is 1 y is not null }`;
        expect(isNullSrc).toTranslate();
        const xaModel = isNullSrc.translator.translate().translated;
        const xa = getExplore(xaModel!.modelDef, 'xa');
        const x = getFieldDef(xa, 'x');
        expect(x).toMatchObject({e: {node: 'numberLiteral'}});
        const y = getFieldDef(xa, 'y');
        expect(y).toMatchObject({e: {node: 'not'}});
      });
      test('not null::number', () => {
        const notNull = expr`not null::number`;
        expect(notNull).translationToFailWith("'not' Can't use type number");
      });
      test('(not null)::number', () => {
        const notNull = expr`(not null)::number`;
        expect(notNull).toTranslate();
      });
    });
  });

  test('filtered measure', () => {
    expect(expr`acount {where: astr = 'why?' }`).toTranslate();
  });
  test('filtered ungrouped aggregate', () => {
    expect(`
        run: a -> {
          group_by: ai
          aggregate: x is all(avg(ai)) { where: true }
        }
      `).toTranslate();
  });
  test('correctly flags filtered scalar', () => {
    const e = new BetaExpression('ai { where: true }');
    expect(e).translationToFailWith(
      'Filtered expression requires an aggregate computation'
    );
  });
  test('correctly flags filtered analytic', () => {
    expect(markSource`
        run: a -> {
          group_by: ai
          calculate: l is lag(ai) { where: true }
        }
      `).translationToFailWith(
      'Filtered expression requires an aggregate computation'
    );
  });

  describe('expr props', () => {
    test('aggregate order by not allowed without experiments enabled', () => {
      expect(markSource`
          run: a -> {
            group_by: ai
            aggregate: x1 is string_agg(astr) { order_by: ai }
          }
        `).translationToFailWith(
        'Enable experiment `aggregate_order_by` to use `order_by` with an aggregate function'
      );
    });

    test('aggregate limit not allowed without experiments enabled', () => {
      expect(markSource`
          run: a -> {
            group_by: ai
            aggregate: x3 is string_agg(astr) { limit: 10 }
          }
        `).translationToFailWith(
        "Experimental flag 'aggregate_limit' required to enable this feature"
      );
    });

    test('aggregate order_by not allowed with different experiment enabled', () => {
      expect(markSource`
        ##! experimental.something_else
          run: a -> {
            group_by: ai
            aggregate: x1 is string_agg(astr) { order_by: ai }
          }
        `).translationToFailWith(
        'Enable experiment `aggregate_order_by` to use `order_by` with an aggregate function'
      );
    });

    test('aggregate limit not allowed with different experiment enabled', () => {
      expect(markSource`
        ##! experimental.something_else
          run: a -> {
            group_by: ai
            group_by: x3 is string_agg(astr) { limit: 10 }
          }
        `).translationToFailWith(
        "Experimental flag 'aggregate_limit' required to enable this feature"
      );
    });

    test('props not allowed on most expressions', () => {
      expect(markSource`
          ##! experimental { aggregate_order_by aggregate_limit }
          run: a -> {
            group_by: x1 is 1 { order_by: ai }
            group_by: x2 is 1 { partition_by: ai }
            group_by: x3 is 1 { limit: 10 }
            group_by: x4 is 1 { where: ai }
          }
        `).translationToFailWith(
        '`order_by` is not supported for this kind of expression',
        '`partition_by` is not supported for this kind of expression',
        '`limit` is not supported for this kind of expression',
        'Filtered expression requires an aggregate computation'
      );
    });

    test('analytics can take parititon_by and order_by', () => {
      expect(markSource`
        run: a -> {
          group_by: ai
          calculate: x is lag(ai) { partition_by: ai; order_by: ai }
        }
      `).toTranslate();
    });

    test('partition by works with scalar and aggregate', () => {
      expect(markSource`
        run: a -> {
          group_by: ai
          aggregate: c is count()
          calculate: x is lag(ai) { partition_by: ai, c }
        }
      `).toTranslate();
    });

    test('partition by fails with analytic and ungrouped aggregate', () => {
      expect(markSource`
        run: a -> {
          group_by: ai
          aggregate: ac is all(count())
          calculate: x is lag(ai) { partition_by: ac }
          calculate: y is lag(ai) { partition_by: x }
        }
      `).translationToFailWith(
        'Partition expression must be scalar or aggregate',
        'Partition expression must be scalar or aggregate'
      );
    });

    test('analytics order_by requires expression', () => {
      expect(markSource`
        ##! experimental { aggregate_order_by }
        run: a -> {
          group_by: ai
          calculate: x is lag(ai) { order_by: asc }
        }
      `).translationToFailWith(
        'analytic `order_by` must specify an aggregate expression or output field reference'
      );
    });

    test('string_agg_distinct order by cannot specify expression', () => {
      expect(markSource`
        ##! experimental { aggregate_order_by }
        run: a -> {
          group_by: ai
          aggregate: x is string_agg_distinct(astr) { order_by: ai }
        }
      `).translationToFailWith(
        '`order_by` must be only `asc` or `desc` with no expression'
      );
    });

    test('string_agg_distinct order by can be just direction', () => {
      expect(markSource`
        ##! experimental { aggregate_order_by }
        run: a -> {
          group_by: ai
          aggregate: x is string_agg_distinct(astr) { order_by: asc }
        }
      `).toTranslate();
    });

    test('string_agg order by can be just direction', () => {
      expect(markSource`
        ##! experimental { aggregate_order_by }
        run: a -> {
          group_by: ai
          aggregate: x is string_agg(astr) { order_by: asc }
        }
      `).toTranslate();
    });

    test('can specify multiple partition_bys', () => {
      expect(markSource`
        run: a -> {
          group_by: ai, astr, abool
          calculate: x is lag(ai) {
            partition_by: ai
            partition_by: astr, abool
          }
        }
      `).toTranslate();
    });

    test('can specify multiple order_bys', () => {
      expect(markSource`
        ##! experimental { aggregate_order_by }
        run: a -> {
          group_by: ai, astr, abool
          calculate: x is lag(ai) {
            order_by: ai
            order_by: astr, abool
          }
        }
      `).toTranslate();
    });

    test('aggregate order by cannot be aggregate', () => {
      expect(markSource`
        ##! experimental { aggregate_order_by }
        run: a -> {
          aggregate: x is string_agg(astr) {
            order_by: sum(ai)
          }
        }
      `).translationToFailWith('aggregate `order_by` must be scalar');
    });

    test('aggregate order by cannot be analytic', () => {
      expect(markSource`
        ##! experimental { aggregate_order_by }
        run: a -> {
          aggregate: x is string_agg(astr) {
            order_by: rank()
          }
        }
      `).translationToFailWith('aggregate `order_by` must be scalar');
    });

    test('analytic order by can be an aggregate', () => {
      expect(markSource`
        ##! experimental { aggregate_order_by }
        run: a -> {
          group_by: abool
          calculate: x is lag(abool) {
            order_by: sum(ai)
          }
        }
      `).toTranslate();
    });

    test('analytic order by can be an output field', () => {
      expect(markSource`
        ##! experimental { aggregate_order_by }
        run: a -> {
          group_by: ai
          calculate: x is lag(ai) {
            order_by: ai
          }
        }
      `).toTranslate();
    });

    test('analytic order by must be an output field', () => {
      expect(markSource`
        ##! experimental { aggregate_order_by }
        run: a -> {
          group_by: abool
          calculate: x is lag(abool) {
            order_by: ai
          }
        }
      `).translationToFailWith(
        'analytic `order_by` must be an aggregate or an output field reference'
      );
    });

    test('can specify multiple wheres', () => {
      expect(markSource`
        ##! experimental { aggregate_order_by }
        run: a -> {
          aggregate: x is count() {
            where: ai > 10
            where: astr ~ '%foo%'
          }
        }
      `).toTranslate();
    });

    test('string_agg can take order_by', () => {
      expect(markSource`
        ##! experimental { aggregate_order_by }
        run: a -> {
          aggregate: x1 is string_agg(astr) { order_by: ai }
          aggregate: x2 is string_agg(astr) { order_by: ai * 2 }
          aggregate: x3 is string_agg(astr) { order_by: ai desc }
          aggregate: x4 is string_agg(astr) { order_by: ai asc }
          aggregate: x5 is string_agg(astr) { order_by: ai asc, ai }
        }
      `).toTranslate();
    });
  });

  describe('aggregate forms', () => {
    const m = model`
      source: root is a extend {
        rename: column is ai
        rename: nested is astruct
        rename: inline is aninline
        dimension: field is column * 2
        dimension: many_field is many.column * 2
        dimension: many_one_field is many.column + one.column
        join_one: one is a extend {
          rename: column is ai
          dimension: field is column * 2
          dimension: many_field is many.column * 2
          join_many: many is a extend {
            rename: column is ai
            dimension: field is column * 2
            dimension: constant is 1
          } on true
        } on true
        join_many: many is a extend {
          rename: column is ai
          dimension: field is column * 2
          dimension: constant is 1
          join_one: one is a extend {
            rename: column is ai
            dimension: field is column * 2
            join_one: one is a extend {
              rename: column is ai
              dimension: field is column * 2
            } on true
          } on true
        } on true
        join_cross: cross is a extend {
          rename: column is ai
          dimension: field is column * 2
        } on true
      }
    `;
    m.translator.translate();
    expect(m).toTranslate();
    const modelX = makeModelFunc({
      model: m.translator.modelDef,
      wrap: x => `run: root -> { aggregate: x is ${x} }`,
    });
    test('one.column.min()', () => {
      expect(modelX`one.column.min()`).toTranslate();
    });
    test('one.min(one.column)', () => {
      expect(modelX`one.min(one.column)`).translationToFailWith(
        'Symmetric aggregate function `min` must be written as `min(expression)` or `path.to.field.min()`'
      );
    });
    test('min(one.column)', () => {
      expect(modelX`min(one.column)`).toTranslate();
    });
    test('min(many.column)', () => {
      expect(modelX`min(many.column)`).toTranslate();
    });
    test('min()', () => {
      expect(modelX`min()`).translationToFailWith(
        'Symmetric aggregate function `min` must be written as `min(expression)` or `path.to.field.min()`'
      );
    });
    test('source.min(column)', () => {
      expect(modelX`source.min(column)`).toTranslate();
    });
    test('many.column.max()', () => {
      expect(modelX`many.column.max()`).toTranslate();
    });
    test('max(many.column)', () => {
      expect(modelX`max(many.column)`).toTranslate();
    });
    test('max()', () => {
      expect(modelX`max()`).translationToFailWith(
        'Symmetric aggregate function `max` must be written as `max(expression)` or `path.to.field.max()`'
      );
    });
    test('source.max(many.column)', () => {
      expect(modelX`source.max(many.column)`).toTranslate();
    });
    test('many.column.count()', () => {
      expect(expr`many.column.count()`).toTranslate();
    });
    test('count()', () => {
      expect(modelX`count()`).toTranslate();
    });
    test('count(many.column)', () => {
      expect(modelX`count(many.column)`).toTranslate();
    });
    test('source.count()', () => {
      expect(modelX`source.count()`).toTranslate();
    });
    test('many.count()', () => {
      expect(modelX`many.count()`).toTranslate();
    });
    test('sum()', () => {
      expect(modelX`sum()`).translationToFailWith(
        'Asymmetric aggregate function `sum` must be written as `path.to.field.sum()`, `path.to.join.sum(expression)`, or `sum(expression)`'
      );
    });
    test('sum(column)', () => {
      expect(modelX`sum(column)`).toTranslate();
    });
    test('sum(column * 2)', () => {
      expect(modelX`sum(column * 2)`).toTranslate();
    });
    test('column.sum()', () => {
      expect(modelX`column.sum()`).toTranslate();
    });
    test('source.sum(column)', () => {
      expect(modelX`source.sum(column)`).toTranslate();
    });
    test('sum(many.column)', () => {
      expect(modelX`sum(many.column)`).translationToFailWith(
        'Join path is required for this calculation; use `many.column.sum()`'
      );
    });
    test('source.sum(many.column)', () => {
      expect(modelX`source.sum(many.column)`).translationToFailWith(
        'Cannot compute `sum` across `join_many` relationship `many`; use `many.column.sum()`'
      );
    });
    test('many.column.sum()', () => {
      expect(modelX`many.column.sum()`).toTranslate();
    });
    test('many.sum(many.column)', () => {
      expect(modelX`many.sum(many.column)`).toTranslate();
    });
    test('sum(one.column)', () => {
      expect(modelX`sum(one.column)`).toTranslateWithWarnings(
        'Join path is required for this calculation; use `one.column.sum()` or `source.sum(one.column)` to get a result weighted with respect to `source`'
      );
    });
    test('sum(many.constant)', () => {
      expect(modelX`sum(many.constant)`).toTranslate();
    });
    test('source.sum(many.constant)', () => {
      expect(modelX`source.sum(many.constant)`).toTranslate();
    });
    test('sum(nested.column)', () => {
      expect(modelX`sum(nested.column)`).translationToFailWith(
        'Join path is required for this calculation; use `nested.column.sum()`'
      );
    });
    test('nested.column.sum()', () => {
      expect(modelX`nested.column.sum()`).toTranslate();
    });
    test('source.sum(nested.column)', () => {
      expect(modelX`source.sum(nested.column)`).translationToFailWith(
        'Cannot compute `sum` across repeated relationship `nested`; use `nested.column.sum()`'
      );
    });
    test('can aggregate field defined with no join usage', () => {
      expect(markSource`
        ##! experimental { sql_functions }
        source: s is a extend {
          measure: c is count()
          dimension: f is 1
        }
        run: s -> {
          aggregate: v is f.sum()
        }
      `).toTranslate();
    });
    test('sum(inline.column)', () => {
      expect(modelX`sum(inline.column)`).toTranslateWithWarnings(
        'Join path is required for this calculation; use `inline.column.sum()` or `source.sum(inline.column)` to get a result weighted with respect to `source`'
      );
    });
    test('inline.column.sum()', () => {
      expect(modelX`inline.column.sum()`).toTranslate();
    });
    test('source.sum(inline.column)', () => {
      expect(modelX`source.sum(inline.column)`).toTranslate();
    });
    test('sum(many.field)', () => {
      expect(modelX`sum(many.field)`).translationToFailWith(
        'Join path is required for this calculation; use `many.field.sum()`'
      );
    });
    test('source.sum(many.field)', () => {
      expect(modelX`source.sum(many.field)`).translationToFailWith(
        'Cannot compute `sum` across `join_many` relationship `many`; use `many.field.sum()`'
      );
    });
    test('many.field.sum()', () => {
      expect(modelX`many.field.sum()`).toTranslate();
    });
    test('many.sum(many.field)', () => {
      expect(modelX`many.sum(many.field)`).toTranslate();
    });

    test('sum(many.field + many.field)', () => {
      expect(modelX`sum(many.field + many.field)`).translationToFailWith(
        'Join path is required for this calculation; use `many.sum(many.field + many.field)`'
      );
    });
    test('source.sum(many.field + many.field)', () => {
      expect(modelX`source.sum(many.field + many.field)`).translationToFailWith(
        'Cannot compute `sum` across `join_many` relationship `many`; use `many.sum(many.field + many.field)`'
      );
    });
    test('many.field + many.field.sum()', () => {
      expect(modelX`many.field + many.field.sum()`).toTranslate();
    });
    test('many.sum(many.field + many.field)', () => {
      expect(modelX`many.sum(many.field + many.field)`).toTranslate();
    });

    test('sum(many_field)', () => {
      expect(modelX`sum(many_field)`).translationToFailWith(
        'Join path is required for this calculation; use `many_field.sum()`'
      );
    });
    test('source.sum(many_field)', () => {
      expect(modelX`source.sum(many_field)`).translationToFailWith(
        'Cannot compute `sum` across `join_many` relationship `many`; use `many_field.sum()`'
      );
    });
    test('many_field.sum()', () => {
      expect(modelX`many_field.sum()`).toTranslate();
    });
    test('many.sum(many_field)', () => {
      expect(modelX`many.sum(many_field)`).toTranslate();
    });

    test('sum(one.many_field)', () => {
      expect(modelX`sum(one.many_field)`).translationToFailWith(
        'Join path is required for this calculation; use `one.many_field.sum()`'
      );
    });
    test('source.sum(one.many_field)', () => {
      expect(modelX`source.sum(one.many_field)`).translationToFailWith(
        'Cannot compute `sum` across `join_many` relationship `many`; use `one.many_field.sum()`'
      );
    });
    test('one.many_field.sum()', () => {
      expect(modelX`one.many_field.sum()`).toTranslate();
    });
    test('many.sum(one.many_field)', () => {
      expect(modelX`one.many.sum(one.many_field)`).toTranslate();
    });

    test('sum(many.field + one.field)', () => {
      expect(modelX`sum(many.field + one.field)`).translationToFailWith(
        'Aggregated dimensional expression contains multiple join paths; rewrite, for example `sum(first_join.field + second_join.field)` as `first_join.field.sum() + second_join.field.sum()`'
      );
    });
    test('source.sum(many.field + one.field)', () => {
      expect(modelX`source.sum(many.field + one.field)`).translationToFailWith(
        'Aggregated dimensional expression contains multiple join paths; rewrite, for example `sum(first_join.field + second_join.field)` as `first_join.field.sum() + second_join.field.sum()`'
      );
    });
    test('many.sum(many.field + one.field)', () => {
      expect(modelX`many.sum(many.field + one.field)`).toTranslate();
    });

    test('sum(many_one_field)', () => {
      expect(modelX`sum(many_one_field)`).translationToFailWith(
        'Aggregated dimensional expression contains multiple join paths; rewrite, for example `sum(first_join.field + second_join.field)` as `first_join.field.sum() + second_join.field.sum()`'
      );
    });
    test('source.sum(many_one_field)', () => {
      expect(modelX`source.sum(many_one_field)`).translationToFailWith(
        'Aggregated dimensional expression contains multiple join paths; rewrite, for example `sum(first_join.field + second_join.field)` as `first_join.field.sum() + second_join.field.sum()`'
      );
    });
    test('many.sum(many_one_field)', () => {
      expect(modelX`many.sum(many_one_field)`).toTranslate();
    });

    test('sum(many.one.field)', () => {
      expect(modelX`sum(many.one.field)`).translationToFailWith(
        'Join path is required for this calculation; use `many.one.field.sum()` or `many.sum(many.one.field)` to get a result weighted with respect to `many`'
      );
    });
    test('sum(many.one.one.field)', () => {
      expect(modelX`sum(many.one.one.field)`).translationToFailWith(
        'Join path is required for this calculation; use `many.one.one.field.sum()` or `many.sum(many.one.one.field)` to get a result weighted with respect to `many`'
      );
    });

    test('many.avg(field)', () => {
      expect(modelX`many.avg(field)`).toTranslate();
    });

    test('one.avg(field)', () => {
      expect(modelX`one.avg(field)`).toTranslate();
    });

    test('cross.avg(field)', () => {
      expect(modelX`cross.avg(field)`).translationToFailWith(
        'Cannot compute `avg` across `join_cross` relationship `cross`; use `field.avg()`'
      );
    });

    test('cross.avg(cross.field)', () => {
      expect(modelX`cross.avg(cross.field)`).toTranslate();
    });

    test('one.column.sum()', () => {
      expect(modelX`one.column.sum()`).toTranslate();
    });
    test('one.sum(one.column)', () => {
      expect(modelX`one.sum(one.column)`).toTranslate();
    });
    test('source.sum(one.column)', () => {
      expect(modelX`source.sum(one.column)`).toTranslate();
    });
    test('sum(one.column + one.column)', () => {
      expect(modelX`sum(one.column + one.column)`).toTranslateWithWarnings(
        'Join path is required for this calculation; use `one.sum(one.column + one.column)` or `source.sum(one.column + one.column)` to get a result weighted with respect to `source`'
      );
    });
    test('one.sum(one.column + one.column)', () => {
      expect(modelX`one.sum(one.column + one.column)`).toTranslate();
    });
    test('source.sum(one.column + one.column)', () => {
      expect(modelX`source.sum(one.column + one.column)`).toTranslate();
    });
    test('lag(sum(output))', () => {
      expect(model`
      ##! m4warnings=warn
      run: a -> {
        group_by: output is 1
        calculate: bar is lag(sum(output))
      }`).translationToFailWith("'output' is not defined");
    });
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
        source: na is a extend { dimension: d is
          pick 7 when true and true
        }
      `).translationToFailWith("pick incomplete, missing 'else'");
    });
    test('n-ary with mismatch when clauses', () => {
      expect(markSource`
        source: na is a extend { dimension: d is
          pick 7 when true and true
          pick '7' when true or true
          else 7
        }
      `).translationToFailWith("pick type 'string', expected 'number'");
    });
    test('n-ary with mismatched else clause', () => {
      expect(markSource`
        source: na is a extend { dimension: d is
          pick 7 when true and true
          else '7'
        }
      `).translationToFailWith("else type 'string', expected 'number'");
    });
    test('applied else mismatch', () => {
      expect(markSource`
        source: na is a extend { dimension: d is
          7 ? pick 7 when 7 else 'not seven'
        }
      `).translationToFailWith("else type 'string', expected 'number'");
    });
    test('applied default mismatch', () => {
      expect(markSource`
        source: na is a extend { dimension: d is
          7 ? pick 'seven' when 7
        }
      `).translationToFailWith("pick default type 'number', expected 'string'");
    });
    test('applied when mismatch', () => {
      expect(markSource`
        source: na is a extend { dimension: d is
          7 ? pick 'seven' when 7 pick 6 when 6
        }
      `).translationToFailWith("pick type 'number', expected 'string'");
    });
  });
  test('paren and applied div', () => {
    expect('1+(3/4)').compilesTo('{1 + ({3 / 4})}');
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
describe('sql native fields in schema', () => {
  test('sql native reference in result allowed', () => {
    const uModel = new TestTranslator('run: a->{ group_by: aun }');
    expect(uModel).toTranslate();
  });
  test('sql native reference can be compared to NULL', () => {
    const uModel = new TestTranslator(
      'run: a->{ where: aun != NULL; select: * }'
    );
    expect(uModel).toTranslate();
  });
  test('flag unsupported equality', () => {
    // because we don't know if the two unsupported types are comparable
    const uModel = new TestTranslator(
      'run: ab->{ where: aun = b.aun  select: * }'
    );
    expect(uModel).translationToFailWith(
      "Unsupported SQL native type 'undefined' not allowed in expression"
    );
  });
  test('flag unsupported compare', () => {
    // because we don't know if the two unsupported types are comparable
    const uModel = new TestTranslator(
      'run: ab->{ where: aun > b.aun  select: * }'
    );
    expect(uModel).translationToFailWith(
      "Unsupported SQL native type 'undefined' not allowed in expression"
    );
  });
  test('allow unsupported equality when raw types match', () => {
    const uModel = new TestTranslator(
      'run: ab->{ where: aweird = b.aweird  select: * }'
    );
    expect(uModel).toTranslate();
  });
  test('flag not applied to unsupported', () => {
    const uModel = new TestTranslator(
      'source: x is a extend { dimension: notUn is not aun }'
    );
    expect(uModel).translationToFailWith(
      "'not' Can't be used with unsupported SQL native type 'undefined'"
    );
  });
  test('allow unsupported to be cast', () => {
    const uModel = new TestTranslator(
      'source: x is a extend { dimension: notUn is aun::string }'
    );
    expect(uModel).toTranslate();
  });
  test('negative numbers are not tokens', () => {
    expect(expr`ai-1`).toTranslate();
  });

  describe('sql functions', () => {
    test('can aggregate a sql_ function', () => {
      expect(`
        ##! experimental.sql_functions
        run: a -> {
          aggregate: x is sum(sql_number("\${ai} * 2"))
        }
      `).toTranslate();
    });

    test('error when interpolating field that does not exist', () => {
      expect(`
        ##! experimental.sql_functions
        run: a -> {
          group_by: x is sql_number("\${asdfasdf} * 2")
        }
      `).translationToFailWith(
        "Invalid interpolation: 'asdfasdf' is not defined"
      );
    });

    test('error when using sql_ function without experiment', () => {
      expect(`
        run: a -> {
          group_by: x is sql_number("\${asdfasdf} * 2")
        }
      `).translationToFailWith(
        'Cannot use sql_function `sql_number`; use `sql_functions` experiment to enable this behavior'
      );
    });
  });

  describe('cast', () => {
    // The "+ 1"s are there to make sure the result is of type 'number'
    test('sql cast', () => {
      expect(expr`ai::'integer' + 1`).toTranslate();
      expect(expr`ai::"integer" + 1`).toTranslate();
      expect(expr`ai::"""integer""" + 1`).toTranslate();
    });
    test('sql safe cast', () => {
      expect(expr`astr:::'integer' + 1`).toTranslate();
      expect(expr`astr:::"integer" + 1`).toTranslate();
      expect(expr`astr:::"""integer""" + 1`).toTranslate();
    });
    test('malloy cast', () => {
      expect(expr`astr::number + 1`).toTranslate();
    });
    test('malloy safe cast', () => {
      expect(expr`astr:::number + 1`).toTranslate();
    });

    test('sql cast illegal type name', () => {
      expect(expr`astr::"stuff 'n' things"`).translationToFailWith(
        "Cast type `stuff 'n' things` is invalid for standardsql dialect"
      );
    });
  });
});
