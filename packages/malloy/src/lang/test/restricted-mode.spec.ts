/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import './parse-expects';
import {TestTranslator} from './test-translator';

describe('restricted mode — plumbing (no-op stage)', () => {
  // Step 1 of the restricted-mode rollout only threads the flag from
  // ParseOptions through MalloyTranslator and exposes it via
  // MalloyElement.isRestricted(). No rejections fire yet. These tests
  // assert the flag is plumbed correctly and that nothing about
  // translation has changed.

  test('the flag defaults to false', () => {
    const t = new TestTranslator('run: a -> { aggregate: c is count() }');
    expect(t.restrictedMode).toBe(false);
  });

  test('the flag is stored when passed', () => {
    const t = new TestTranslator('run: a -> { aggregate: c is count() }', {
      restrictedMode: true,
    });
    expect(t.restrictedMode).toBe(true);
  });

  test('AST nodes see the flag via isRestricted()', () => {
    const t = new TestTranslator('run: a -> { aggregate: c is count() }', {
      restrictedMode: true,
    });
    const ast = t.ast();
    expect(ast).toBeDefined();
    expect(ast?.isRestricted()).toBe(true);
  });

  test('AST nodes see false when restrictedMode is not set', () => {
    const t = new TestTranslator('run: a -> { aggregate: c is count() }');
    const ast = t.ast();
    expect(ast).toBeDefined();
    expect(ast?.isRestricted()).toBe(false);
  });

  test('a clean translation in restricted mode produces the same modelDef as without', () => {
    const src = 'run: a -> { aggregate: c is count() }';
    const open = new TestTranslator(src);
    const restricted = new TestTranslator(src, {restrictedMode: true});

    const openResult = open.translate();
    const restrictedResult = restricted.translate();

    expect(openResult.problems ?? []).toHaveLength(0);
    expect(restrictedResult.problems ?? []).toHaveLength(0);
    // Final IR shape is the same — no rejections fire yet, no behavior changes.
    expect(restrictedResult.modelDef).toEqual(openResult.modelDef);
  });

  test('a forbidden construct still translates without error at this stage', () => {
    // `import` is the first construct slated for rejection. At Step 1,
    // it must still translate cleanly — the rejection comes in Step 2.
    const t = new TestTranslator('import "child"', {restrictedMode: true});
    expect(t.restrictedMode).toBe(true);
    // The import will surface a `urls` need; we don't fulfill it. The
    // point is that there's no `restricted-construct-forbidden` log entry yet.
    t.translate();
    const restrictedErrors = t.logger
      .getLog()
      .filter(p => p.code === 'restricted-construct-forbidden');
    expect(restrictedErrors).toEqual([]);
  });
});
