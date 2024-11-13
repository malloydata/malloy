/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {errorMessage, makeExprFunc, model} from './test-translator';
import './parse-expects';

describe('cubes', () => {
  describe('cube usage', () => {
    const m = model`
      ##! experimental.cube_sources
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

  describe('cube resolution and validation', () => {
    test('cube fails on group_by that is relevant', () => {
      expect(`
        ##! experimental.cube_sources
        run: cube(
          a extend { dimension: one is 1, two is 2 },
          a extend { dimension: one is 1, three is 3 }
        ) -> {
          group_by: one
          group_by: three
          group_by: ${'two'}
        }
      `).toLog(
        errorMessage(
          'This operation uses cube field `two`, resulting in invalid usage of the a cube source, as there is no cube input source which defines all of `one`, `three`, `two`'
        )
      );
    });
    test('cube fails on filter that is relevant', () => {
      expect(`
        ##! experimental.cube_sources
        run: cube(
          a extend { dimension: one is 1, two is 2 },
          a extend { dimension: one is 1, three is 3 }
        ) -> {
          group_by: one
          group_by: three
          where: ${'two = 2'}
        }
      `).toLog(
        errorMessage(
          'This operation uses cube field `two`, resulting in invalid usage of the a cube source, as there is no cube input source which defines all of `one`, `three`, `two`'
        )
      );
    });
    test('cube resolution fails on inner cube', () => {
      expect(`
        ##! experimental.cube_sources
        run: cube(
          cube(
            a extend { dimension: one is 1, two is 2 },
            a extend { dimension: one is 1, three is 3 }
          ),
          a extend { dimension: one is 1, two is 2, three is 3 }
        ) -> {
          group_by: one, two ${'three'}
        }
      `).toTranslate();
    });
    test('good cube usage works', () =>
      expect(`
        ##! experimental.cube_sources
        run: cube(a, a extend { dimension: one is 1 }) -> { group_by: one }
    `).toTranslate());
  });
});
