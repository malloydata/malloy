/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {expr, makeExprFunc, model} from './test-translator';
import './parse-expects';

describe('cube usage', () => {
  test('looked up value', () => {
    expect(expr`ai`).hasCubeUsage([['ai']]);
  });

  test('multiple values', () => {
    expect(expr`ai + af`).hasCubeUsage([['ai'], ['af']]);
  });

  test('value plus constant', () => {
    expect(expr`ai + 1`).hasCubeUsage([['ai']]);
  });

  test('join usage', () => {
    expect(expr`b.ai + 1`).hasCubeUsage([['b', 'ai']]);
  });

  test('join usage complex', () => {
    const m = model`
      source: x is ab extend {
        dimension: aif is ai + af
      }
      source: y is a extend {
        join_one: x on 1 = 1
      }
    `;
    m.translator.translate();
    expect(m).toTranslate();
    const mexpr = makeExprFunc(m.translator.modelDef, 'y');
    expect(mexpr`x.aif`).hasCubeUsage([
      ['x', 'ai'],
      ['x', 'af'],
    ]);
  });
});
