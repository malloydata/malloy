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

import {isFieldTypeDef, isFilteredAliasedName} from '../../model';
import {
  expr,
  TestTranslator,
  markSource,
  BetaExpression,
  model,
  makeModelFunc,
} from './test-translator';
import './parse-expects';

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
  test('shortcut filtered measure m4warning', () => {
    expect(`
      ##! m4warnings
      run: a -> {
        group_by: ai
        aggregate: x is avg(ai) {? astr = 'why?' }
      }
    `).toTranslateWithWarnings(
      'Filter shortcut `{? condition }` is deprecated; use `{ where: condition } instead'
    );
  });
  test('correctly flags filtered scalar', () => {
    const e = new BetaExpression('ai { where: true }');
    expect(e).translationToFailWith(
      'Filtered expression requires an aggregate computation'
    );
  });
  test('correctly flags filtered analytic', () => {
    expect(markSource`
        query: a -> {
          group_by: ai
          calculate: l is lag(ai) { where: true }
        }
      `).translationToFailWith(
      'Filtered expression requires an aggregate computation'
    );
  });

  describe('aggregate forms', () => {
    const m = model`
      ##! m4warnings
      source: root is a {
        rename: column is ai
        rename: nested is astruct
        dimension: field is column * 2
        dimension: many_field is many.column * 2
        dimension: many_one_field is many.column + one.column
        join_one: one is a {
          rename: column is ai
          dimension: field is column * 2
          dimension: many_field is many.column * 2
          join_many: many is a {
            rename: column is ai
            dimension: field is column * 2
            dimension: constant is 1
          } on true
        } on true
        join_many: many is a {
          rename: column is ai
          dimension: field is column * 2
          dimension: constant is 1
          join_one: one is a {
            rename: column is ai
            dimension: field is column * 2
            join_one: one is a {
              rename: column is ai
              dimension: field is column * 2
            } on true
          } on true
        } on true
        join_cross: cross is a {
          rename: column is ai
          dimension: field is column * 2
        } on true
      }
    `;
    m.translator.translate();
    const modelX = makeModelFunc({
      model: m.translator.modelDef,
      prefix: '##! m4warnings\n',
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
      expect(modelX`sum(many.column)`).toTranslateWithWarnings(
        'Join path is required for this calculation; use `many.column.sum()`'
      );
    });
    test('source.sum(many.column)', () => {
      expect(modelX`source.sum(many.column)`).toTranslateWithWarnings(
        'Cannot compute asymmetric aggregate across forward join_many relationship `many`; use `many.column.sum()`'
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
      expect(modelX`sum(nested.column)`).toTranslateWithWarnings(
        'Join path is required for this calculation; use `nested.column.sum()` or `source.sum(nested.column)` to get a result weighted with respect to `source`'
      );
    });
    test('nested.column.sum()', () => {
      expect(modelX`nested.column.sum()`).toTranslate();
    });
    test('source.sum(nested.column)', () => {
      expect(modelX`source.sum(nested.column)`).toTranslate();
    });
    test('sum(many.field)', () => {
      expect(modelX`sum(many.field)`).toTranslateWithWarnings(
        'Join path is required for this calculation; use `many.field.sum()`'
      );
    });
    test('source.sum(many.field)', () => {
      expect(modelX`source.sum(many.field)`).toTranslateWithWarnings(
        'Cannot compute asymmetric aggregate across forward join_many relationship `many`; use `many.field.sum()`'
      );
    });
    test('many.field.sum()', () => {
      expect(modelX`many.field.sum()`).toTranslate();
    });
    test('many.sum(many.field)', () => {
      expect(modelX`many.sum(many.field)`).toTranslate();
    });

    test('sum(many.field + many.field)', () => {
      expect(modelX`sum(many.field + many.field)`).toTranslateWithWarnings(
        'Join path is required for this calculation; use `many.sum(many.field + many.field)`'
      );
    });
    test('source.sum(many.field + many.field)', () => {
      expect(
        modelX`source.sum(many.field + many.field)`
      ).toTranslateWithWarnings(
        'Cannot compute asymmetric aggregate across forward join_many relationship `many`; use `many.sum(many.field + many.field)`'
      );
    });
    test('many.field + many.field.sum()', () => {
      expect(modelX`many.field + many.field.sum()`).toTranslate();
    });
    test('many.sum(many.field + many.field)', () => {
      expect(modelX`many.sum(many.field + many.field)`).toTranslate();
    });

    test('sum(many_field)', () => {
      expect(modelX`sum(many_field)`).toTranslateWithWarnings(
        'Join path is required for this calculation; use `many_field.sum()`'
      );
    });
    test('source.sum(many_field)', () => {
      expect(modelX`source.sum(many_field)`).toTranslateWithWarnings(
        'Cannot compute asymmetric aggregate across forward join_many relationship `many`; use `many_field.sum()`'
      );
    });
    test('many_field.sum()', () => {
      // TODO test this case that we generate the right SQL
      expect(modelX`many_field.sum()`).toTranslate();
    });
    test('many.sum(many_field)', () => {
      expect(modelX`many.sum(many_field)`).toTranslate();
    });

    test('sum(one.many_field)', () => {
      expect(modelX`sum(one.many_field)`).toTranslateWithWarnings(
        'Join path is required for this calculation; use `one.many_field.sum()`'
      );
    });
    test('source.sum(one.many_field)', () => {
      expect(modelX`source.sum(one.many_field)`).toTranslateWithWarnings(
        'Cannot compute asymmetric aggregate across forward join_many relationship `many`; use `one.many_field.sum()`'
      );
    });
    test('one.many_field.sum()', () => {
      // TODO test this case that we generate the right SQL
      expect(modelX`one.many_field.sum()`).toTranslate();
    });
    test('many.sum(one.many_field)', () => {
      expect(modelX`one.many.sum(one.many_field)`).toTranslate();
    });

    test('sum(many.field + one.field)', () => {
      expect(modelX`sum(many.field + one.field)`).toTranslateWithWarnings(
        'Aggregated dimensional expression contains multiple join paths; rewrite, for example `sum(first_join.field + second_join.field)` as `first_join.field.sum() + second_join.field.sum()`'
      );
    });
    test('source.sum(many.field + one.field)', () => {
      expect(
        modelX`source.sum(many.field + one.field)`
      ).toTranslateWithWarnings(
        'Aggregated dimensional expression contains multiple join paths; rewrite, for example `sum(first_join.field + second_join.field)` as `first_join.field.sum() + second_join.field.sum()`'
      );
    });
    test('many.sum(many.field + one.field)', () => {
      expect(modelX`many.sum(many.field + one.field)`).toTranslate();
    });

    test('sum(many_one_field)', () => {
      expect(modelX`sum(many_one_field)`).toTranslateWithWarnings(
        'Aggregated dimensional expression contains multiple join paths; rewrite, for example `sum(first_join.field + second_join.field)` as `first_join.field.sum() + second_join.field.sum()`'
      );
    });
    test('source.sum(many_one_field)', () => {
      expect(modelX`source.sum(many_one_field)`).toTranslateWithWarnings(
        'Aggregated dimensional expression contains multiple join paths; rewrite, for example `sum(first_join.field + second_join.field)` as `first_join.field.sum() + second_join.field.sum()`'
      );
    });
    test('many.sum(many_one_field)', () => {
      expect(modelX`many.sum(many_one_field)`).toTranslate();
    });

    test('sum(many.one.field)', () => {
      expect(modelX`sum(many.one.field)`).toTranslateWithWarnings(
        'Join path is required for this calculation; use `many.one.field.sum()` or `many.sum(many.one.field)` to get a result weighted with respect to `many`'
      );
    });
    test('sum(many.one.one.field)', () => {
      expect(modelX`sum(many.one.one.field)`).toTranslateWithWarnings(
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
      expect(modelX`cross.avg(field)`).toTranslateWithWarnings(
        'Cannot compute asymmetric aggregate across join_cross relationship `cross`; use `field.avg()`'
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
      ##! m4warnings
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
        source: na is a + { dimension: d is
          pick 7 when true and true
        }
      `).translationToFailWith("pick incomplete, missing 'else'");
    });
    test('n-ary with mismatch when clauses', () => {
      expect(markSource`
        source: na is a + { dimension: d is
          pick 7 when true and true
          pick '7' when true or true
          else 7
        }
      `).translationToFailWith("pick type 'string', expected 'number'");
    });
    test('n-ary with mismatched else clause', () => {
      expect(markSource`
        source: na is a + { dimension: d is
          pick 7 when true and true
          else '7'
        }
      `).translationToFailWith("else type 'string', expected 'number'");
    });
    test('applied else mismatch', () => {
      expect(markSource`
        source: na is a + { dimension: d is
          7 ? pick 7 when 7 else 'not seven'
        }
      `).translationToFailWith("else type 'string', expected 'number'");
    });
    test('applied default mismatch', () => {
      expect(markSource`
        source: na is a + { dimension: d is
          7 ? pick 'seven' when 7
        }
      `).translationToFailWith("pick default type 'number', expected 'string'");
    });
    test('applied when mismatch', () => {
      expect(markSource`
        source: na is a + { dimension: d is
          7 ? pick 'seven' when 7 pick 6 when 6
        }
      `).translationToFailWith("pick type 'number', expected 'string'");
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
    expect(uModel).translationToFailWith(
      'Unsupported type not allowed in expression'
    );
  });
  test('flag unsupported compare', () => {
    // because we don't know if the two unsupported types are comparable
    const uModel = new TestTranslator(
      'query: ab->{ where: aun > b.aun  project: * }'
    );
    expect(uModel).translationToFailWith(
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
    expect(uModel).translationToFailWith("'not' Can't use type unsupported");
  });
  test('allow unsupported to be cast', () => {
    const uModel = new TestTranslator(
      'source: x is a { dimension: notUn is aun::string }'
    );
    expect(uModel).toTranslate();
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
