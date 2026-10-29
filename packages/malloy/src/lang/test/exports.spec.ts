/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import './parse-expects';
import {TestTranslator, errorMessage} from './test-translator';

function exportsOf(t: TestTranslator): string[] {
  const exports = t.translate().modelDef?.exports ?? [];
  return [...exports].sort();
}

describe('export statement:', () => {
  test('without export, all definitions are exported', () => {
    const t = new TestTranslator(`
      source: aa is a
      source: bb is a
      query: qq is a -> { group_by: astr }
    `);
    expect(t).toTranslate();
    expect(exportsOf(t)).toEqual(['aa', 'bb', 'qq']);
  });

  test('with export, only listed names are exported', () => {
    const t = new TestTranslator(`
      source: aa is a
      source: bb is a
      query: qq is a -> { group_by: astr }
      export { aa, qq }
    `);
    expect(t).toTranslate();
    expect(exportsOf(t)).toEqual(['aa', 'qq']);
  });

  test('non-exported definitions are still in contents', () => {
    const t = new TestTranslator(`
      source: aa is a
      source: bb is a
      export { aa }
    `);
    expect(t).toTranslate();
    const md = t.translate().modelDef;
    expect(md?.contents['bb']).toBeDefined();
    expect(md?.exports).toEqual(['aa']);
  });

  test('multiple export statements are additive', () => {
    const t = new TestTranslator(`
      source: aa is a
      source: bb is a
      source: cc is a
      export { aa }
      export { cc }
    `);
    expect(t).toTranslate();
    expect(exportsOf(t)).toEqual(['aa', 'cc']);
  });

  test('export can re-export an imported source', () => {
    const t = new TestTranslator(`
      import { ii is original } from "child"
      source: aa is a
      export { aa, ii }
    `);
    t.update({
      urls: {'internal://test/langtests/child': 'source: original is a'},
    });
    expect(t).toTranslate();
    expect(exportsOf(t)).toEqual(['aa', 'ii']);
  });

  test('export of undefined name errors', () => {
    const t = new TestTranslator(`
      source: aa is a
      export { bb }
    `);
    expect(t).toLog(
      errorMessage(
        "Cannot export 'bb': no such definition above this statement"
      )
    );
  });

  test('export is order-dependent: forward reference errors', () => {
    const t = new TestTranslator(`
      export { aa }
      source: aa is a
    `);
    expect(t).toLog(
      errorMessage(
        "Cannot export 'aa': no such definition above this statement"
      )
    );
  });

  test('duplicate name within export errors', () => {
    const t = new TestTranslator(`
      source: aa is a
      export { aa, aa }
    `);
    expect(t).toLog(
      errorMessage("'aa' already appears in an export statement")
    );
  });

  test('duplicate name across export statements errors', () => {
    const t = new TestTranslator(`
      source: aa is a
      export { aa }
      export { aa }
    `);
    expect(t).toLog(
      errorMessage("'aa' already appears in an export statement")
    );
  });
});
