/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {Model} from './core';
import {TestTranslator} from '../../lang/test/test-translator';

// Build a Model directly from translated IR — no connection needed — so the
// Explore source-reference getters can be exercised the way a consumer dumping
// a model would use them.
function modelOf(src: string): Model {
  const tt = new TestTranslator(src);
  const compiled = tt.translate();
  if (!compiled.modelDef) {
    throw new Error('source did not translate');
  }
  return new Model(compiled.modelDef, [], []);
}

describe('Explore source-reference introspection', () => {
  test('a source that defines its own shape is not a reference', () => {
    const model = modelOf("source: base is _db_.table('aTable')");
    expect(model.getExploreByName('base').referencedSource()).toBeUndefined();
  });

  test('an unmodified rename exposes the referenced source by name', () => {
    const model = modelOf(`
      source: base is _db_.table('aTable')
      source: ref is base
    `);
    expect(model.getExploreByName('ref').referencedSource()?.name).toBe('base');
  });

  test('an extended source is not a reference', () => {
    const model = modelOf(`
      source: base is _db_.table('aTable')
      source: ext is base extend { dimension: x is 1 }
    `);
    expect(model.getExploreByName('ext').referencedSource()).toBeUndefined();
  });
});
