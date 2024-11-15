/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {errorMessage, makeExprFunc, model} from './test-translator';
import './parse-expects';
import {CubeUsage} from '../../model';
import {emptyCubeUsage} from '../../model/cube_utils';

function addPathToCubeUsage(path: string[], cubeUsage: CubeUsage): CubeUsage {
  if (path.length === 0) throw new Error('empty path');
  if (path.length === 1) {
    return {
      fields: [...cubeUsage.fields, path[0]],
      joinedUsage: cubeUsage.joinedUsage,
    };
  } else {
    return {
      fields: cubeUsage.fields,
      joinedUsage: {
        ...cubeUsage.joinedUsage,
        [path[0]]: addPathToCubeUsage(
          path.slice(1),
          cubeUsage.joinedUsage[path[0]] ?? emptyCubeUsage()
        ),
      },
    };
  }
}

function paths(paths: string[][]): CubeUsage {
  let cu = emptyCubeUsage();
  for (const path of paths) {
    cu = addPathToCubeUsage(path, cu);
  }
  return cu;
}

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
      expect(mexpr`ai`).hasCubeUsage(paths([['ai']]));
    });

    test('multiple values', () => {
      const mexpr = makeExprFunc(m.translator.modelDef, 'y');
      expect(mexpr`ai + af`).hasCubeUsage(paths([['ai'], ['af']]));
    });

    test('value plus constant', () => {
      const mexpr = makeExprFunc(m.translator.modelDef, 'y');
      expect(mexpr`ai + 1`).hasCubeUsage(paths([['ai']]));
    });

    test('join usage', () => {
      const mexpr = makeExprFunc(m.translator.modelDef, 'y');
      expect(mexpr`x.ai + 1`).hasCubeUsage(paths([['x', 'ai']]));
    });

    test('join usage complex', () => {
      const mexpr = makeExprFunc(m.translator.modelDef, 'y');
      expect(mexpr`x.aif`).hasCubeUsage(
        paths([
          ['x', 'ai'],
          ['x', 'af'],
        ])
      );
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
    test.skip('index on cube fails', () =>
      expect(`
        ##! experimental.cube_sources
        run: cube(a extend { dimension: two is 2 }, a extend { dimension: one is 1 }) -> { index: * }
    `).toLog(errorMessage('Cannot index on a cube source')));
    test('raw run of cube fails', () =>
      expect(`
        ##! experimental.cube_sources
        run: cube(a extend { dimension: two is 2 }, a extend { dimension: one is 1 })
    `).toLog(errorMessage('Cannot run this object as a query')));
    test('cube with parameter', () => {
      expect(`
        ##! experimental { cube_sources parameters }
        source: foo(param is 1) is cube(
          a extend { dimension: x is param },
          a extend { dimension: y is param + 1 }
        )
        run: foo(param is 2) -> { group_by: y }
      `).toTranslate();
    });
  });
});
