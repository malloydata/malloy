/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import './parse-expects';
import {
  errorMessage,
  makeModelFunc,
  model,
  warningMessage,
} from './test-translator';

// On a dialect with booleanType 'none' a boolean is a condition and never a
// value. `m` is a SQL Server source with a declared boolean, `big`, a boolean
// measure, `anyn`, and a view, `v`. In a refusal test, the `${…}` marks the
// expression the error is expected at.
const m = makeModelFunc({
  prefix: `##! experimental.dialect.sqlserver
source: m is _mssql_.table('aTable') extend {
  dimension: big is ai > 5
  measure: n is count()
  measure: anyn is n > 1
  view: v is { group_by: ai }
  join_one: o is _mssql_.table('aTable') extend { dimension: big is ai > 5 } on o.ai = ai
}
`,
});

const refused = (where: string) =>
  errorMessage(new RegExp(`^'sqlserver' does not support a boolean ${where};`));

describe('a boolean on a dialect without boolean values', () => {
  describe('is a condition', () => {
    test('in where: and having:', () => {
      expect(
        m`run: m -> { where: big; aggregate: n; having: n > 1 }`
      ).toTranslate();
    });
    test('in pick … when', () => {
      expect(
        m`run: m -> { group_by: size is pick 'big' when big else 'small' }`
      ).toTranslate();
    });
    test('in a filtered aggregate', () => {
      expect(
        m`run: m -> { aggregate: bigs is n { where: big } }`
      ).toTranslate();
    });
    test('in a join on:', () => {
      expect(
        m`source: j is m extend { join_one: p is m on big and p.ai = ai }`
      ).toTranslate();
    });
    test('under not, and, or', () => {
      expect(
        m`run: m -> { where: not big and (big or ai = 1); aggregate: n }`
      ).toTranslate();
    });
    test('as a declared dimension or measure', () => {
      expect(
        m`source: m2 is m extend { dimension: small is not big; measure: none is n = 0 }`
      ).toTranslate();
    });
  });

  describe('is refused as a value', () => {
    test('a declared boolean in group_by:', () => {
      expect(m`run: m -> { group_by: ${'big'}; aggregate: n }`).toLog(
        errorMessage(
          "'sqlserver' does not support a boolean as a result column; write the value, pick 'yes' when big else 'no'"
        )
      );
    });
    test('a comparison in select:', () => {
      expect(m`run: m -> { select: is_big is ${'ai > 5'} }`).toLog(
        errorMessage(
          "'sqlserver' does not support a boolean as a result column; write the value, pick 'yes' when ai > 5 else 'no'"
        )
      );
    });
    test('a boolean aggregate', () => {
      expect(m`run: m -> { aggregate: any_big is ${'n > 1'} }`).toLog(
        refused('as a result column')
      );
    });
    test('in index:', () => {
      expect(m`run: m -> { index: ${'big'} }`).toLog(
        refused('as a result column')
      );
    });
    test('a boolean field named as the whole view', () => {
      expect(m`run: m -> ${'big'}`).toLog(refused('as a result column'));
      expect(m`run: m -> ${'anyn'}`).toLog(refused('as a result column'));
      expect(m`run: m -> v + ${'big'}`).toLog(refused('as a result column'));
    });
    test('in a null test', () => {
      expect(m`run: m -> { where: ${'big'} is null; aggregate: n }`).toLog(
        errorMessage(
          "'sqlserver' does not support a boolean in a null test; test the condition itself; unknown already tests as false"
        )
      );
    });
    test('compared with = or !=', () => {
      expect(m`run: m -> { where: ${'big'} = true; aggregate: n }`).toLog(
        refused('compared with =')
      );
      expect(m`run: m -> { where: ${'big'} != (ai > 6); aggregate: n }`).toLog(
        refused('compared with !=')
      );
    });
    test('compared with an ordering operator', () => {
      expect(m`run: m -> { where: ${'big'} > false; aggregate: n }`).toLog(
        refused('compared with >')
      );
      expect(m`run: m -> { where: ${'big'} ? > false; aggregate: n }`).toLog(
        refused('compared with >')
      );
      expect(
        m`run: m -> { where: ${'big'} ? > false | < true; aggregate: n }`
      ).toLog(refused('compared with >'), refused('compared with <'));
    });
    test('in an alternation', () => {
      expect(
        m`run: m -> { where: ${'big'} ? true | false; aggregate: n }`
      ).toLog(refused('compared with ='));
    });
    test('in ??', () => {
      expect(m`run: m -> { where: ${'big ?? false'}; aggregate: n }`).toLog(
        errorMessage(
          "'sqlserver' does not support a boolean in ??; test the condition itself; unknown already tests as false"
        )
      );
    });
    test('as the result of a pick', () => {
      expect(
        m`run: m -> { where: ${'pick true when ai > 1 else false'}; aggregate: n }`
      ).toLog(refused('as the result of a pick'));
    });
    test('as the result of a case', () => {
      expect(
        m`run: m -> { where: case when ai > 1 then true else false end; aggregate: n }`
      ).toLog(
        warningMessage('Use a `pick` statement instead of `case`'),
        refused('as the result of a case')
      );
    });
    test('matched with a filter expression', () => {
      expect(m`run: m -> { where: ${'big'} ~ f'true'; aggregate: n }`).toLog(
        refused('matched with a filter expression')
      );
    });
    test('as a function argument', () => {
      expect(m`run: m -> { group_by: s is concat('x', ${'big'}) }`).toLog(
        refused('as an argument of concat')
      );
    });
    test('in a cast, either way', () => {
      expect(m`run: m -> { group_by: s is ${'big::string'} }`).toLog(
        refused('in a cast')
      );
      expect(m`run: m -> { where: ${'ai::boolean'}; aggregate: n }`).toLog(
        refused('as the type of a cast')
      );
    });
    test('once, at the expression which used it', () => {
      expect(
        m`run: m -> { group_by: x is ${'pick big when ai > 1 else big'} }`
      ).toLog(refused('as the result of a pick'));
    });
  });

  describe('select: * leaves a boolean out, with a warning', () => {
    test('naming the field, and not a measure', () => {
      expect(m`run: m -> { select: * }`).toLog(
        warningMessage(
          "'big' is left out of '*': 'sqlserver' does not support a boolean as a result column; write the value, pick 'yes' when big else 'no'"
        )
      );
    });
    test('naming a joined field by its path', () => {
      expect(m`run: m -> { select: o.* }`).toLog(
        warningMessage(
          "'o.big' is left out of 'o.*': 'sqlserver' does not support a boolean as a result column; write the value, pick 'yes' when o.big else 'no'"
        )
      );
    });
    test('and so does index: *', () => {
      expect(m`run: m -> { index: * }`).toLog(
        warningMessage(
          "'big' is left out of '*': 'sqlserver' does not support a boolean as a result column; write the value, pick 'yes' when big else 'no'"
        )
      );
    });
  });

  test('the same boolean is a value on a dialect with booleans', () => {
    expect(model`
      source: d is _db_.table('aTable') extend { dimension: big is ai > 5 }
      run: d -> { group_by: big, s is big::string, c is concat('x', big); where: big = true and big > false }
      run: d -> big
    `).toTranslate();
  });
});
