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
// value. `m` is a SQL Server source with a declared boolean, `big`.
const m = makeModelFunc({
  prefix: `##! experimental.dialect.sqlserver
source: m is _mssql_.table('aTable') extend {
  dimension: big is ai > 5
  measure: n is count()
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
        m`source: j is m extend { join_one: o is m on big and o.ai = ai }`
      ).toTranslate();
    });
    test('under not, and, or', () => {
      expect(
        m`run: m -> { where: not big and (big or ai = 1); aggregate: n }`
      ).toTranslate();
    });
    test('as a declared dimension', () => {
      expect(
        m`source: m2 is m extend { dimension: small is not big }`
      ).toTranslate();
    });
  });

  describe('is refused as a value', () => {
    test('a declared boolean in group_by:', () => {
      expect(m`run: m -> { group_by: big; aggregate: n }`).toLog(
        errorMessage(
          "'sqlserver' does not support a boolean as a result column; write the value, pick 'yes' when big else 'no'"
        )
      );
    });
    test('a comparison in select:', () => {
      expect(m`run: m -> { select: is_big is ai > 5 }`).toLog(
        errorMessage(
          "'sqlserver' does not support a boolean as a result column; write the value, pick 'yes' when ai > 5 else 'no'"
        )
      );
    });
    test('a boolean aggregate', () => {
      expect(m`run: m -> { aggregate: any_big is n > 1 }`).toLog(
        refused('as a result column')
      );
    });
    test('in index:', () => {
      expect(m`run: m -> { index: big }`).toLog(refused('as a result column'));
    });
    test('in a null test', () => {
      expect(m`run: m -> { where: big is null; aggregate: n }`).toLog(
        refused('in a null test')
      );
    });
    test('compared with = or !=', () => {
      expect(m`run: m -> { where: big = true; aggregate: n }`).toLog(
        refused('compared with =')
      );
      expect(m`run: m -> { where: big != (ai > 6); aggregate: n }`).toLog(
        refused('compared with !=')
      );
    });
    test('in an alternation', () => {
      expect(m`run: m -> { where: big ? true | false; aggregate: n }`).toLog(
        refused('compared with =')
      );
    });
    test('in ??', () => {
      expect(m`run: m -> { where: big ?? false; aggregate: n }`).toLog(
        refused('in \\?\\?')
      );
    });
    test('as the result of a pick', () => {
      expect(
        m`run: m -> { where: pick true when ai > 1 else false; aggregate: n }`
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
      expect(m`run: m -> { where: big ~ f'true'; aggregate: n }`).toLog(
        refused('matched with a filter expression')
      );
    });
    test('as a function argument', () => {
      expect(m`run: m -> { group_by: s is concat('x', big) }`).toLog(
        refused('as an argument of concat')
      );
    });
    test('in a cast, either way', () => {
      expect(m`run: m -> { group_by: s is big::string }`).toLog(
        refused('in a cast')
      );
      expect(m`run: m -> { where: ai::boolean; aggregate: n }`).toLog(
        refused('as the type of a cast')
      );
    });
  });

  test('select: * leaves a boolean out, with a warning', () => {
    expect(m`run: m -> { select: * }`).toLog(
      warningMessage(
        "'big' is left out of '*': 'sqlserver' does not support a boolean as a result column; write the value, pick 'yes' when big else 'no'"
      )
    );
  });

  test('the same boolean is a value on a dialect with booleans', () => {
    expect(model`
      source: d is _db_.table('aTable') extend { dimension: big is ai > 5 }
      run: d -> { group_by: big, s is big::string, c is concat('x', big); where: big = true }
    `).toTranslate();
  });
});
