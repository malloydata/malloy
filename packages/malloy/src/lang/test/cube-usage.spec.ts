/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {makeExprFunc, model} from './test-translator';
import './parse-expects';

describe('cube usage', () => {
  const m = model`
    source: x is cube(ab, ab) extend {
      dimension: aif is ai + af
    }

    source: y is cube(ab, ab) extend {
      join_one: x on 1 = 1
    }
  `;

  beforeAll(() => {
    m.translator.translate();
  });

  test('looked up value', () => {
    const mexpr = makeExprFunc(m.translator.modelDef, 'y');
    expect(mexpr`ai`).hasCubeUsage([['ai']]);
  });

  test('multiple values', () => {
    const mexpr = makeExprFunc(m.translator.modelDef, 'y');
    expect(mexpr`ai + af`).hasCubeUsage([['ai'], ['af']]);
  });

  test('value plus constant', () => {
    const mexpr = makeExprFunc(m.translator.modelDef, 'y');
    expect(mexpr`ai + 1`).hasCubeUsage([['ai']]);
  });

  test('join usage', () => {
    const mexpr = makeExprFunc(m.translator.modelDef, 'y');
    expect(mexpr`b.ai + 1`).hasCubeUsage([['b', 'ai']]);
  });

  test('join usage complex', () => {
    const mexpr = makeExprFunc(m.translator.modelDef, 'y');
    expect(mexpr`x.aif`).hasCubeUsage([
      ['x', 'ai'],
      ['x', 'af'],
    ]);
  });
});
