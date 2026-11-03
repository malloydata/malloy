/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import './parse-expects';
import {error, errorMessage, makeModelFunc, model} from './test-translator';

const restricted = makeModelFunc({restrictedMode: true});

describe('restricted mode', () => {
  test('the flag defaults to false', () => {
    expect(
      model`run: a -> { aggregate: c is count() }`.translator.restrictedMode
    ).toBe(false);
  });

  test('the flag is stored when passed', () => {
    expect(
      restricted`run: a -> { aggregate: c is count() }`.translator
        .restrictedMode
    ).toBe(true);
  });

  test('AST nodes see the flag via isRestricted()', () => {
    const ast =
      restricted`run: a -> { aggregate: c is count() }`.translator.ast();
    expect(ast).toBeDefined();
    expect(ast?.isRestricted()).toBe(true);
  });

  test('AST nodes see false when restrictedMode is not set', () => {
    const ast = model`run: a -> { aggregate: c is count() }`.translator.ast();
    expect(ast).toBeDefined();
    expect(ast?.isRestricted()).toBe(false);
  });

  test('a clean translation in restricted mode produces the same modelDef as without', () => {
    const open =
      model`run: a -> { aggregate: c is count() }`.translator.translate();
    const constrained =
      restricted`run: a -> { aggregate: c is count() }`.translator.translate();

    expect(open.problems ?? []).toHaveLength(0);
    expect(constrained.problems ?? []).toHaveLength(0);
    expect(constrained.modelDef).toEqual(open.modelDef);
  });

  test('`import` is rejected in restricted mode', () => {
    expect(restricted`import "child"`).toLog(
      error('restricted-construct-forbidden')
    );
  });

  describe('`given:`', () => {
    const restrictedGivens = makeModelFunc({
      restrictedMode: true,
      compilerFlags: ['experimental.givens'],
    });
    const restrictedFinalizedX = makeModelFunc({
      restrictedMode: true,
      compilerFlags: ['experimental.givens'],
      finalizedGivens: new Set(['X']),
    });

    test('can be declared in restricted mode', () => {
      expect(restrictedGivens`given: X :: number is 1`).toTranslate();
    });

    test('can be used across the restricted text', () => {
      expect(restrictedGivens`
        given: X :: number is 1
        source: extended is a extend {
          dimension: scaled is ai * $X
        }
        run: extended -> { select: scaled, x is $X }
      `).toTranslate();
    });

    test('needs the experimental flag', () => {
      expect(restricted`given: X :: number is 1`).toLog(
        error('experiment-not-enabled')
      );
    });

    test('a finalized name cannot be declared', () => {
      expect(restrictedFinalizedX`given: X :: number is 1`).toLog(
        errorMessage(/Cannot redefine 'X'/)
      );
    });

    test('an unfinalized name can be declared when others are finalized', () => {
      expect(restrictedFinalizedX`given: Y :: number is 1`).toTranslate();
    });

    test('a finalized name can be declared outside restricted mode', () => {
      const trustedFinalizedX = makeModelFunc({
        compilerFlags: ['experimental.givens'],
        finalizedGivens: new Set(['X']),
      });
      expect(trustedFinalizedX`given: X :: number is 1`).toTranslate();
    });

    test('`sql_*` is rejected in a default', () => {
      const restrictedSqlFunctions = makeModelFunc({
        restrictedMode: true,
        compilerFlags: ['experimental.givens', 'experimental.sql_functions'],
      });
      expect(
        restrictedSqlFunctions`given: X :: string is sql_string("1")`
      ).toLog(error('restricted-construct-forbidden'));
    });

    test('a raw function call is rejected in a default', () => {
      expect(restrictedGivens`given: X :: string is f!string()`).toLog(
        error('restricted-construct-forbidden')
      );
    });
  });

  test('`##!` is rejected in restricted mode', () => {
    expect(restricted`##! experimental.givens`).toLog(
      error('restricted-construct-forbidden')
    );
  });

  test('`connection.table(...)` is rejected in restricted mode', () => {
    expect(restricted`source: x is _db_.table('foo')`).toLog(
      error('restricted-construct-forbidden')
    );
  });

  test('`connection.sql(...)` is rejected in restricted mode', () => {
    expect(restricted`source: x is _db_.sql("""SELECT 1""")`).toLog(
      error('restricted-construct-forbidden')
    );
  });

  test('`name!type(args)` raw-SQL function is rejected in restricted mode', () => {
    expect(restricted`run: a -> { select: x is myfn!number(1) }`).toLog(
      error('restricted-construct-forbidden')
    );
  });

  test('`sql_*` raw-SQL functions are rejected in restricted mode', () => {
    const restrictedSqlFuncs = makeModelFunc({
      restrictedMode: true,
      compilerFlags: ['experimental.sql_functions'],
    });
    expect(
      restrictedSqlFuncs`run: a -> { select: x is sql_number("1") }`
    ).toLog(error('restricted-construct-forbidden'));
  });

  test('every forbidden construct in one compile gets its own error', () => {
    // toLog is position-sensitive; the rejections fire in source order
    // because Document.executeList walks statements in order, so each
    // construct's diagnostic lands in its own slot.
    const restrictedAll = makeModelFunc({
      restrictedMode: true,
      compilerFlags: ['experimental.givens', 'experimental.sql_functions'],
    });
    expect(restrictedAll`
      ##! experimental.givens
      import "other"
      source: t is _db_.table('foo')
      source: s is _db_.sql("""SELECT 1""")
      run: a -> { select: y is myfn!number(1) }
      run: a -> { select: z is sql_number("1") }
    `).toLog(
      errorMessage(/##! experimental\.givens/),
      errorMessage(/import "other"/),
      errorMessage(/_db_\.table/),
      errorMessage(/_db_\.sql/),
      errorMessage(/myfn!number/),
      errorMessage(/sql_number/)
    );
  });
});
