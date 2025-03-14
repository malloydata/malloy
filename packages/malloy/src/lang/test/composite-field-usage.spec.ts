/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {errorMessage, makeExprFunc, model} from './test-translator';
import './parse-expects';
import type {CompositeFieldUsage} from '../../model';
import {emptyCompositeFieldUsage} from '../../model/composite_source_utils';

function addPathToCompositeUsage(
  path: string[],
  compositeUsage: CompositeFieldUsage
): CompositeFieldUsage {
  if (path.length === 0) throw new Error('empty path');
  if (path.length === 1) {
    return {
      fields: [...compositeUsage.fields, path[0]],
      joinedUsage: compositeUsage.joinedUsage,
    };
  } else {
    return {
      fields: compositeUsage.fields,
      joinedUsage: {
        ...compositeUsage.joinedUsage,
        [path[0]]: addPathToCompositeUsage(
          path.slice(1),
          compositeUsage.joinedUsage[path[0]] ?? emptyCompositeFieldUsage()
        ),
      },
    };
  }
}

function paths(paths: string[][]): CompositeFieldUsage {
  let cu = emptyCompositeFieldUsage();
  for (const path of paths) {
    cu = addPathToCompositeUsage(path, cu);
  }
  return cu;
}

describe('composite sources', () => {
  describe('composite field usage', () => {
    const m = model`
      ##! experimental.composite_sources
      source: x is compose(ab, ab) extend {
        dimension: aif is ai + af
        measure: ss is ai.sum()
        measure: saiaf is ai.sum() { where: af > 1 }
      }

      source: y is compose(ab, ab) extend {
        join_one: x on 1 = 1
      }
    `;

    beforeAll(() => {
      m.translator.translate();
    });

    test('looked up value', () => {
      const mexpr = makeExprFunc(m.translator.modelDef, 'y');
      expect(mexpr`ai`).hasCompositeUsage(paths([['ai']]));
    });

    test('multiple values', () => {
      const mexpr = makeExprFunc(m.translator.modelDef, 'y');
      expect(mexpr`ai + af`).hasCompositeUsage(paths([['ai'], ['af']]));
    });

    test('value plus constant', () => {
      const mexpr = makeExprFunc(m.translator.modelDef, 'y');
      expect(mexpr`ai + 1`).hasCompositeUsage(paths([['ai']]));
    });

    test('join usage', () => {
      const mexpr = makeExprFunc(m.translator.modelDef, 'y');
      expect(mexpr`x.ai + 1`).hasCompositeUsage(paths([['x', 'ai']]));
    });

    test('join usage complex', () => {
      const mexpr = makeExprFunc(m.translator.modelDef, 'y');
      expect(mexpr`x.aif`).hasCompositeUsage(
        paths([
          ['x', 'ai'],
          ['x', 'af'],
        ])
      );
    });

    test('measure defined in composite source', () => {
      const mexpr = makeExprFunc(m.translator.modelDef, 'x');
      expect(mexpr`ss`).hasCompositeUsage(paths([['ai']]));
    });

    test('measure with filter defined in composite source', () => {
      const mexpr = makeExprFunc(m.translator.modelDef, 'x');
      expect(mexpr`saiaf`).hasCompositeUsage(paths([['ai'], ['af']]));
    });
  });

  describe('composite source resolution and validation', () => {
    test('compose fails on group_by that is relevant', () => {
      expect(`
        ##! experimental.composite_sources
        run: compose(
          a extend { dimension: one is 1, two is 2 },
          a extend { dimension: one is 1, three is 3 }
        ) -> {
          group_by: one
          group_by: three
          group_by: ${'two'}
        }
      `).toLog(
        errorMessage(
          'This operation uses composite field `two`, resulting in invalid usage of the composite source, as there is no composite input source which defines all of `one`, `three`, `two`'
        )
      );
    });
    test('compose fails on filter that is relevant', () => {
      expect(`
        ##! experimental.composite_sources
        run: compose(
          a extend { dimension: one is 1, two is 2 },
          a extend { dimension: one is 1, three is 3 }
        ) -> {
          group_by: one
          group_by: three
          where: ${'two = 2'}
        }
      `).toLog(
        errorMessage(
          'This operation uses composite field `two`, resulting in invalid usage of the composite source, as there is no composite input source which defines all of `one`, `three`, `two`'
        )
      );
    });
    test('compose fails in case where second field has overlap with first', () => {
      expect(`
        ##! experimental.composite_sources
        run: compose(
          a extend { dimension: one is 1 },
          a extend { dimension: two is 3 }
        ) -> {
          group_by: one
          group_by: ${'three is one + two'}
        }
      `).toLog(
        errorMessage(
          'This operation uses composite field `two`, resulting in invalid usage of the composite source, as there is no composite input source which defines all of `one`, `two`'
        )
      );
    });
    test('compose resolution succeeds nested', () => {
      expect(`
        ##! experimental.composite_sources
        run: compose(
          compose(
            a extend { dimension: one is 1, two is 2 },
            a extend { dimension: one is 1, three is 3 }
          ),
          a extend { dimension: one is 1, two is 2, three is 3 }
        ) -> {
          group_by: one, two ${'three'}
        }
      `).toTranslate();
    });
    test('good composite field usage works', () =>
      expect(`
        ##! experimental.composite_sources
        run: compose(a, a extend { dimension: one is 1 }) -> { group_by: one }
    `).toTranslate());
    test('index on composite translates', () =>
      expect(`
        ##! experimental.composite_sources
        source: x is compose(
          a extend { except: ai },
          a
        )
        run: x -> { index: ai }
        run: x -> { index: * }
    `).toTranslate());
    test('raw run of composite source fails', () =>
      expect(`
        ##! experimental.composite_sources
        run: compose(a extend { dimension: two is 2 }, a extend { dimension: one is 1 })
    `).toLog(errorMessage('Cannot run this object as a query')));
    test('composite source with parameter', () => {
      expect(`
        ##! experimental { composite_sources parameters }
        source: foo(param is 1) is compose(
          a extend { dimension: x is param },
          a extend { dimension: y is param + 1 }
        )
        run: foo(param is 2) -> { group_by: y }
      `).toTranslate();
    });
    test('composite source does not include private field', () => {
      expect(`
        ##! experimental { composite_sources access_modifiers }
        source: foo is compose(
          a extend {
            private dimension: x is 1
          },
          a
        )
        run: foo -> { group_by: x }
      `).toLog(errorMessage("'x' is not defined"));
    });
    test('composite source does not resolve to private field', () => {
      expect(`
        ##! experimental { composite_sources access_modifiers }
        source: foo is compose(
          a extend {
            private dimension: x is 1
            dimension: y is 1
          },
          a extend { dimension: x is 1 }
        )
        run: foo -> { group_by: x, y }
      `).toLog(
        errorMessage(
          'This operation uses composite field `y`, resulting in invalid usage of the composite source, as there is no composite input source which defines all of `x`, `y`'
        )
      );
    });
    test('composite source does include internal field', () => {
      expect(`
        ##! experimental { composite_sources access_modifiers }
        source: foo is compose(
          a extend {
            internal dimension: x is 1
          },
          a
        ) extend {
          view: v is { group_by: x }
        }
        run: foo -> v
      `).toTranslate();
    });
    test('access level mismatch in composite (before)', () => {
      expect(`
        ##! experimental { composite_sources access_modifiers }
        source: foo is compose(
          a extend {
            internal dimension: x is 1
          },
          a extend {
            dimension: x is 1
          }
        )
        run: foo -> { group_by: x }
      `).toLog(errorMessage("'x' is internal"));
    });
    test('access level mismatch in composite (after)', () => {
      expect(`
        ##! experimental { composite_sources access_modifiers }
        source: foo is compose(
          a extend {
            dimension: x is 1
          },
          a extend {
            internal dimension: x is 1
          }
        )
        run: foo -> { group_by: x }
      `).toLog(errorMessage("'x' is internal"));
    });
    test('array.each is okay', () => {
      expect(`
        ##! experimental { composite_sources }
        source: foo is compose(
          a extend { dimension: x is 1 },
          a extend { dimension: y is 2 }
        ) extend {
          dimension: arr is [1, 2, 3]
        }
        run: foo -> { group_by: y, arr.each }
      `).toTranslate();
    });
    test('timevalue extract okay', () => {
      expect(`
        ##! experimental { composite_sources }
        source: foo is compose(
          a extend { dimension: x is 1 },
          a extend { dimension: y is 2 }
        ) extend {
          dimension: time is now
        }
        run: foo -> { group_by: y, time.day }
      `).toTranslate();
    });
  });
});
