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

  test('`given:` is rejected in restricted mode', () => {
    const restrictedGivens = makeModelFunc({
      restrictedMode: true,
      compilerFlags: ['experimental.givens'],
    });
    expect(restrictedGivens`given: x :: number is 1`).toLog(
      error('restricted-construct-forbidden')
    );
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

  test('every forbidden construct in one compile gets its own error', () => {
    // toLog is position-sensitive; the rejections fire in source order
    // because Document.executeList walks statements in order, so each
    // construct's diagnostic lands in its own slot.
    const restrictedAll = makeModelFunc({
      restrictedMode: true,
      compilerFlags: ['experimental.givens'],
    });
    expect(restrictedAll`
      ##! experimental.givens
      import "other"
      given: X :: number is 1
      source: t is _db_.table('foo')
      source: s is _db_.sql("""SELECT 1""")
      run: a -> { select: y is myfn!number(1) }
    `).toLog(
      errorMessage(/##! experimental\.givens/),
      errorMessage(/import "other"/),
      errorMessage(/given:/),
      errorMessage(/_db_\.table/),
      errorMessage(/_db_\.sql/),
      errorMessage(/myfn!number/)
    );
  });
});
