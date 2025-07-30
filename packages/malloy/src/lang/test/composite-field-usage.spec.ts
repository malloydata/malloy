/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {errorMessage, makeExprFunc, model} from './test-translator';
import './parse-expects';
import type {FieldUsage, PipeSegment, Query} from '../../model';
import {isIndexSegment, isQuerySegment} from '../../model';

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
      expect(mexpr`ai`).hasFieldUsage([['ai']]);
    });

    test('multiple values', () => {
      const mexpr = makeExprFunc(m.translator.modelDef, 'y');
      expect(mexpr`ai + af`).hasFieldUsage([['ai'], ['af']]);
    });

    test('value plus constant', () => {
      const mexpr = makeExprFunc(m.translator.modelDef, 'y');
      expect(mexpr`ai + 1`).hasFieldUsage([['ai']]);
    });

    test('join usage', () => {
      const mexpr = makeExprFunc(m.translator.modelDef, 'y');
      expect(mexpr`x.ai + 1`).hasFieldUsage([['x', 'ai']]);
    });

    test('use in function-style aggregate', () => {
      const mexpr = makeExprFunc(m.translator.modelDef, 'y');
      expect(mexpr`sum(ai)`).hasFieldUsage([['ai']]);
    });

    test('use in method-style aggregate', () => {
      const mexpr = makeExprFunc(m.translator.modelDef, 'y');
      expect(mexpr`ai.sum()`).hasFieldUsage([['ai']]);
    });

    test('join use in method-style aggregate', () => {
      const mexpr = makeExprFunc(m.translator.modelDef, 'y');
      expect(mexpr`x.ai.sum()`).hasFieldUsage([['ai']]);
    });
  });

  describe('expanded field usage', () => {
    function segmentExpandedFieldUsage(segment: PipeSegment) {
      return isQuerySegment(segment) || isIndexSegment(segment)
        ? segment.expandedFieldUsage?.filter(
            u =>
              u.analyticFunctionUse === undefined &&
              u.uniqueKeyRequirement === undefined
          )
        : undefined;
    }
    test('direct field reference', () => {
      const m = model`
        run: a -> { group_by: ai }
      `;
      expect(m).toTranslate();
      const query = m.translator.modelDef.queryList[0];
      expect(segmentExpandedFieldUsage(query.pipeline[0])).toMatchObject([
        {path: ['ai']},
      ]);
    });

    test('where reference', () => {
      const m = model`
        run: a -> { group_by: ai; where: af = 2 }
      `;
      expect(m).toTranslate();
      const query = m.translator.modelDef.queryList[0];
      expect(segmentExpandedFieldUsage(query.pipeline[0])).toMatchObject([
        {path: ['ai']},
        {path: ['af']},
      ]);
    });

    test('reference in calculate', () => {
      const m = model`
        run: a extend {
          measure: c is count()
        } -> { group_by: ai; calculate: lag_c is lag(c) }
      `;
      expect(m).toTranslate();
      const query = m.translator.modelDef.queryList[0];
      expect(segmentExpandedFieldUsage(query.pipeline[0])).toMatchObject([
        {path: ['ai']},
        {path: ['c']},
      ]);
    });

    test('exclude field is not counted', () => {
      const m = model`
        run: a -> {
          group_by: ai_2 is ai
          nest: x is {
            aggregate: c is exclude(count(), ai_2)
          }
        }
      `;
      expect(m).toTranslate();
      const query = m.translator.modelDef.queryList[0];
      expect(segmentExpandedFieldUsage(query.pipeline[0])).toMatchObject([
        {path: ['ai']},
      ]);
    });

    test('view is not included', () => {
      const m = model`
        run: a extend {
          view: x is {
            group_by: ai
          }
        } -> x
      `;
      expect(m).toTranslate();
      const query = m.translator.modelDef.queryList[0];
      expect(segmentExpandedFieldUsage(query.pipeline[0])).toMatchObject([
        {path: ['ai']},
      ]);
    });

    test('join in view is included', () => {
      const m = model`
        run: a extend {
          join_one: b is a on true
          view: x is {
            group_by: b.ai
          }
        } -> x
      `;
      expect(m).toTranslate();
      const query = m.translator.modelDef.queryList[0];
      expect(segmentExpandedFieldUsage(query.pipeline[0])).toMatchObject([
        {path: ['b', 'ai']},
      ]);
    });

    test('expression involving multiple fields', () => {
      const m = model`
        run: a -> { group_by: ai_plus_af is ai + af }
      `;
      expect(m).toTranslate();
      const query = m.translator.modelDef.queryList[0];
      expect(segmentExpandedFieldUsage(query.pipeline[0])).toMatchObject([
        {path: ['ai']},
        {path: ['af']},
      ]);
    });

    test('dimension reference', () => {
      const m = model`
        run: a extend {
          dimension: ai_2 is ai
        } -> { group_by: ai_2 }
      `;
      expect(m).toTranslate();
      const query = m.translator.modelDef.queryList[0];
      expect(segmentExpandedFieldUsage(query.pipeline[0])).toMatchObject([
        {path: ['ai_2']},
        {path: ['ai']},
      ]);
    });

    test('join on reference', () => {
      const m = model`
        run: a extend {
          join_one: b is a on b.ai = ai
        } -> { group_by: b.astr }
      `;
      expect(m).toTranslate();
      const query = m.translator.modelDef.queryList[0];
      expect(segmentExpandedFieldUsage(query.pipeline[0])).toMatchObject([
        {path: ['b', 'astr']},
        {path: ['b', 'ai']},
        {path: ['ai']},
      ]);
    });

    test('two-step resolution of dimension', () => {
      const m = model`
        run: a extend {
          dimension: ai_2 is ai
          dimension: ai_3 is ai_2
        } -> { group_by: ai_3 }
      `;
      expect(m).toTranslate();
      const query = m.translator.modelDef.queryList[0];
      expect(segmentExpandedFieldUsage(query.pipeline[0])).toMatchObject([
        {path: ['ai_3']},
        {path: ['ai_2']},
        {path: ['ai']},
      ]);
    });

    test('source where is included', () => {
      const m = model`
        run: a extend {
          where: ai = 2
        } -> { group_by: astr }
      `;
      expect(m).toTranslate();
      const query = m.translator.modelDef.queryList[0];
      expect(segmentExpandedFieldUsage(query.pipeline[0])).toMatchObject([
        {path: ['ai']},
        {path: ['astr']},
      ]);
    });

    test('join where is included', () => {
      const m = model`
        run: a extend {
          join_one: b is a extend { where: ai = 1 } on true
        } -> { group_by: b.astr }
      `;
      expect(m).toTranslate();
      const query = m.translator.modelDef.queryList[0];
      expect(segmentExpandedFieldUsage(query.pipeline[0])).toMatchObject([
        {path: ['b', 'astr']},
        {path: ['b', 'ai']},
      ]);
    });

    test('expansion respects selected composite', () => {
      const m = model`
        ##! experimental.composite_sources
        run: compose(
          a extend {
            dimension: ai_1 is 1
            where: astr = 'foo'
          },
          a extend {
            dimension: ai_2 is 2
            where: ai = 2
          }
        ) -> { group_by: ai_2 }
      `;
      expect(m).toTranslate();
      const query = m.translator.modelDef.queryList[0];
      expect(segmentExpandedFieldUsage(query.pipeline[0])).toMatchObject([
        {path: ['ai']},
        {path: ['ai_2']},
      ]);
    });

    test('second-stage extend dimension works', () => {
      const m = model`
        run: a -> { group_by: ai } -> {
          extend: {
            dimension: ai_2 is ai
          }
          group_by: ai_2
        }
      `;
      expect(m).toTranslate();
      const query = m.translator.modelDef.queryList[0];
      expect(segmentExpandedFieldUsage(query.pipeline[1])).toMatchObject([
        {path: ['ai_2']},
        {path: ['ai']},
      ]);
    });

    test('param is not included', () => {
      const m = model`
        ##! experimental.parameters
        source: a_2(param is 1) is a extend {
          dimension: param_value is param
        }
        run: a_2(param is 2) -> { group_by: param_value }
      `;
      expect(m).toTranslate();
      const query = m.translator.modelDef.queryList[0];
      expect(segmentExpandedFieldUsage(query.pipeline[0])).toMatchObject([
        {path: ['param_value']},
      ]);
    });

    test('query arrow usage', () => {
      const m = model`
        query: q is a -> { group_by: ai }
        run: q -> { group_by: ai }
      `;
      expect(m).toTranslate();
      const query = m.translator.modelDef.queryList[0];
      expect(segmentExpandedFieldUsage(query.pipeline[1])).toMatchObject([
        {path: ['ai']},
      ]);
    });

    test('query arrow usage with composite ', () => {
      const m = model`
        ##! experimental.composite_sources
        query: q is compose(
          a extend {
            dimension: ai_1 is 1
            where: astr = 'foo'
          },
          a extend {
            dimension: ai_2 is 2
            where: ai = 2
          }
        ) -> { group_by: ai is ai_2 }
        run: q -> { group_by: ai }
      `;
      expect(m).toTranslate();
      const query = m.translator.modelDef.queryList[0];
      expect(segmentExpandedFieldUsage(query.pipeline[1])).toMatchObject([
        {path: ['ai']},
      ]);
    });

    test('query refine usage', () => {
      const m = model`
        query: q is a -> { group_by: ai }
        run: q + { group_by: af }
      `;
      expect(m).toTranslate();
      const query = m.translator.modelDef.queryList[0];
      expect(segmentExpandedFieldUsage(query.pipeline[0])).toMatchObject([
        {path: ['ai']},
        {path: ['af']},
      ]);
    });
  });

  describe('composite source resolution and validation', () => {
    describe('compose type errors', () => {
      test('compose incompatible scalar types', () => {
        expect(`
          ##! experimental {composite_sources}
          source: c is compose(
            a extend { dimension: x is 'foo' },
            ${'a extend { dimension: x is 1 }'}
          )
        `).toLog(
          errorMessage(
            'field `x` must have the same type in all composite inputs: `number` does not match `string`'
          )
        );
      });
    });
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
          'This operation uses field `two`, resulting in invalid usage of the composite source, as there is no composite input source which defines all of `three` and `two` (fields required in source: `one`, `three`, and `two`)'
        )
      );
    });
    test('compose fails on scalar lens', () => {
      expect(`
        ##! experimental.composite_sources
        run: compose(
          a extend { dimension: one is 1, two is 2 },
          a extend { dimension: one is 1, three is 3 }
        ) -> {
          group_by: one
          group_by: three
        } + ${'two'}
      `).toLog(
        errorMessage(
          'This operation uses field `two`, resulting in invalid usage of the composite source, as there is no composite input source which defines all of `three` and `two` (fields required in source: `one`, `three`, and `two`)'
        )
      );
    });
    test('compose fails on view lens', () => {
      expect(`
        ##! experimental.composite_sources
        run: compose(
          a extend { dimension: one is 1, two is 2 },
          a extend { dimension: one is 1, three is 3 }
        ) extend {
          view: v is { group_by: two }
        } -> {
          group_by: one
          group_by: three
        } + ${'v'}
      `).toLog(
        errorMessage(
          'This operation uses field `two`, resulting in invalid usage of the composite source, as there is no composite input source which defines all of `three` and `two` (fields required in source: `one`, `three`, and `two`)'
        )
      );
    });
    test('composite used in join', () => {
      expect(
        `
          ##! experimental { composite_sources grouped_by }
          source: x is compose(a, a extend { dimension: foo is 1 })
          source: y is a extend {
            join_one: x on x.ai = ai
          }
          run: y -> { group_by: x.foo }
        `
      ).toTranslate();
    });
    test('required group by mixed with missing field', () => {
      expect(
        `
              ##! experimental { composite_sources grouped_by }
              source: aext is compose(
                a extend {
                  dimension: x is 1
                  dimension: y is 1
                  measure: aisum is ai.sum() { grouped_by: x }
                },
                a extend {
                  measure: aisum is ai.sum()
                }
              )
              run: aext -> { aggregate: aisum, group_by: y }
            `
      ).toLog(
        errorMessage(
          'This operation uses field `y`, resulting in invalid usage of the composite source, as there is no composite input source which defines `y` without having an unsatisfied required group by or single value filter on `x` (fields required in source: `aisum` and `y`)'
        )
      );
    });
    test('error message when composited join (join is a nested composite) results in failure', () => {
      expect(`
        ##! experimental.composite_sources
        source: jbase is compose(
          a extend {
            dimension: jf1 is 1
          },
          a extend {
            dimension: jf2 is 2
          }
        )
        source: s1 is a extend {
          join_one: j is jbase on j.jf1 = 1
        }
        source: s2 is a extend {
          join_one: j is jbase on j.jf2 = 2
        }
        source: c is compose(s1, s2)
        run: c -> { group_by: ${'j.jf2'}, j.jf1 }
      `).toLog(
        errorMessage(
          'This operation results in invalid usage of the composite source, as join `j` could not be resolved (fields required in source: `j.jf2` and `j.jf1`)'
        )
      );
    });
    test('nested composited join', () => {
      expect(`
        ##! experimental.composite_sources
        source: jbase is compose(
          a extend {
            dimension: jf1 is 1
          },
          a extend {
            dimension: jf2 is 2
          }
        )
        source: s1 is a extend {
          join_one: j is jbase on j.jf1 = 1
        }
        source: s2 is a extend {
          join_one: j is jbase on j.jf2 = 2
        }
        source: c is compose(s1, s2)
        source: c2 is compose(c, c extend { dimension: f1 is 1 })
        run: c2 -> { group_by: f1, ${'j.jf2'}, j.jf1 }
      `).toLog(
        errorMessage(
          'This operation results in invalid usage of the composite source, as there is no composite input source which defines all of `f1` and join `j` could not be resolved (fields required in source: `f1`, `j.jf2`, and `j.jf1`)'
        )
      );
    });
    test('composited join cannot use join from other source (with incompatible fields)', () => {
      expect(`
        ##! experimental.composite_sources
        source: s1 is a extend {
          join_one: j is a extend {
            dimension: jf1 is 1
          } on true
          dimension: f1 is 1
        }
        source: s2 is a extend {
          join_one: j is a extend {
            dimension: jf2 is 2
          } on true
          dimension: f2 is 2
        }
        source: c is compose(s1, s2)
        run: c -> { group_by: f1, ${'j.jf2'} }
      `).toLog(
        errorMessage(
          'This operation uses field `j.jf2`, resulting in invalid usage of the composite source, as there is no composite input source which defines all of `f1` and `j.jf2` (fields required in source: `f1` and `j.jf2`)'
        )
      );
    });
    test('error message when composited join (join is not nested composite) results in failure', () => {
      expect(`
        ##! experimental.composite_sources
        source: s1 is a extend {
          join_one: j is b extend {
            dimension: jf1 is 1
          } on true
        }
        source: s2 is a extend {
          join_one: j is b extend {
            dimension: jf2 is 1
          } on true
        }
        source: c is compose(s1, s2)
        run: c -> { group_by: j.jf2, ${'j.jf1'} }
      `).toLog(
        errorMessage(
          'This operation uses field `j.jf1`, resulting in invalid usage of the composite source, as there is no composite input source which defines all of `j.jf2` and `j.jf1` (fields required in source: `j.jf2` and `j.jf1`)'
        )
      );
    });
    test('compose fails on scalar lens that is dimension', () => {
      expect(`
        ##! experimental.composite_sources
        run: compose(
          a extend { dimension: one is 1, two is 2 },
          a extend { dimension: one is 1, three is 3 }
        ) extend {
          dimension: x is two
        } -> {
          group_by: one
          group_by: three
        } + ${'x'}
      `).toLog(
        errorMessage(
          'This operation uses field `two`, resulting in invalid usage of the composite source, as there is no composite input source which defines all of `three` and `two` (fields required in source: `one`, `three`, and `two`)'
        )
      );
    });
    test('compose fails due to filter in source', () => {
      expect(`
        ##! experimental.composite_sources
        run: compose(
          a extend { dimension: one is 1, two is 2 },
          a extend { dimension: one is 1, three is 3 }
        ) extend {
          where: two = 2
        } -> {
          group_by: one
          group_by: ${'three'}
        }
      `).toLog(
        errorMessage(
          'This operation uses field `three`, resulting in invalid usage of the composite source, as there is no composite input source which defines all of `two` and `three` (fields required in source: `two`, `one`, and `three`)'
        )
      );
    });
    test('compose fails due to filter reference in source', () => {
      expect(`
        ##! experimental.composite_sources
        run: compose(
          a extend { dimension: one is 1, two is 2 },
          a extend { dimension: one is 1, three is 3 }
        ) extend {
          dimension: two_prime is two + 1
          where: two_prime = 2
        } -> {
          group_by: one
          group_by: ${'three'}
        }
      `).toLog(
        errorMessage(
          'This operation uses field `three`, resulting in invalid usage of the composite source, as there is no composite input source which defines all of `two` and `three` (fields required in source: `one`, `three`, and `two`)'
        )
      );
    });
    test('field usage from selected composite source where is picked up in resolution', () => {
      expect(`
        ##! experimental.composite_sources
        run: compose(
          compose(
            a extend { dimension: one is 1, two is 2 },
            a extend { dimension: one is 1, three is 3 }
          ) extend {
            where: two = 2
          },
          a extend { dimension: one is 1 }
        ) -> {
          group_by: one
          group_by: ${'three'}
        }
      `).toLog(
        errorMessage(
          'This operation uses field `three`, resulting in invalid usage of the composite source, as there is no composite input source which defines all of `two` and `three` (fields required in source: `one` and `three`)'
        )
      );
    });
    test('where in join is picked up', () => {
      expect(`
        ##! experimental.composite_sources
        run: a extend {
          join_one: b is compose(
            a extend { dimension: one is 1, two is 2 },
            a extend { dimension: one is 1, three is 3 }
          ) extend {
            where: two = 2
          }
        } -> {
          group_by: b.one
          group_by: ${'b.three'}
        }
      `).toLog(
        errorMessage(
          'This operation uses field `b.three`, resulting in invalid usage of the composite source, as there is no composite input source which defines all of `b.two` and `b.three` (fields required in source: `b.one`, `b.three`, and `b.two`)'
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
          'This operation uses field `two`, resulting in invalid usage of the composite source, as there is no composite input source which defines all of `three` and `two` (fields required in source: `one`, `three`, and `two`)'
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
          'This operation uses field `two`, resulting in invalid usage of the composite source, as there is no composite input source which defines all of `one` and `two` (fields required in source: `one` and `two`)'
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
    test('composite source with parameter in expression', () => {
      expect(`
        ##! experimental { composite_sources parameters }
        source: foo(param is 1) is compose(
          a extend { dimension: x is param },
          a extend { dimension: y is param + 1 }
        )
        run: foo(param is 2) -> { group_by: y2 is y + 1 }
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
          'This operation uses field `y`, resulting in invalid usage of the composite source, as there is no composite input source which defines all of `x` and `y` (fields required in source: `x` and `y`)'
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

function pathToKey(path: string[]): string {
  return path.map(el => `${el.length}-${el}`).join(':');
}

/**
 * Instead of a custom matcher, new test pattern I thought I would try out.
 * A field usage might be spread out among multiple records, so this looks
 * through all matching records.
 * @param ref The expected field usage
 * @param query Look in the first segment of this query for usages
 * @returns [bool,msg] if false, will explain what was wrong
 */
function checkForFieldUsage(
  ref: FieldUsage,
  query: Query | undefined
): [boolean, string] {
  if (!query) {
    return [false, 'Query not found'];
  }
  const ps = query.pipeline[0];
  const pathStr = ref.path.length > 0 ? ref.path.join('.') : '[]';
  if (!isQuerySegment(ps)) {
    return [false, 'Pipeline did not contain a query segment'];
  }
  let found = false;
  const refKey = pathToKey(ref.path);
  let needAnalytic = ref.analyticFunctionUse || false;
  let needCount = ref.uniqueKeyRequirement?.isCount || false;
  let needAsymmetric = ref.uniqueKeyRequirement?.isCount === false;
  for (const fu of ps.expandedFieldUsage || []) {
    if (pathToKey(fu.path) !== refKey) continue;
    found = true;
    if (needAnalytic && fu.analyticFunctionUse) needAnalytic = false;
    if (needAsymmetric && fu.uniqueKeyRequirement?.isCount === false)
      needAsymmetric = false;
    if (needCount && fu?.uniqueKeyRequirement?.isCount) needCount = false;
  }
  if (found) {
    const missing: string[] = [];
    if (needAnalytic) missing.push('analytic');
    if (needCount) missing.push('count');
    if (needAsymmetric) missing.push('asymmetric');
    if (missing.length > 0) {
      return [
        false,
        `Missing properties for path ${pathStr}: ${missing.join(',')}`,
      ];
    }
    return [true, `Found usage reference to path ${pathStr}`];
  }
  return [false, `Did not find usage reference to path ${pathStr}`];
}

describe('field usage with compiler extensions', () => {
  test('filters on source are reflected in usage', () => {
    const mTest = model`
      run: a extend { where: ai = 1} -> { select: astr }
    `;
    expect(mTest).toTranslate();
    const mq = mTest.translator.getQuery(0);
    const [found, message] = checkForFieldUsage({path: ['ai']}, mq);
    expect(found, message).toBeTruthy();
  });
  test('filters on segment are reflected in usage', () => {
    const mTest = model`
      run: a -> { where: ai = 1; select: astr }
    `;
    expect(mTest).toTranslate();
    const mq = mTest.translator.getQuery(0);
    const [found, message] = checkForFieldUsage({path: ['ai']}, mq);
    expect(found, message).toBeTruthy();
  });
  test('on expressions in joins reflected in field usage', () => {
    const mTest = model`
      source: bintoa is a extend { join_one: b on ai = b.ai }
      query: uses_b is bintoa -> { select: b.astr }
      query: ignore_b is bintoa -> { select: astr }
    `;
    expect(mTest).toTranslate();
    let mq = mTest.translator.getQuery('uses_b');
    let [found, message] = checkForFieldUsage({path: ['ai']}, mq);
    expect(found, message).toBeTruthy();
    mq = mTest.translator.getQuery('ignore_b');
    [found, message] = checkForFieldUsage({path: ['b', 'ai']}, mq);
    expect(found, message).toBeFalsy();
  });
  test('filters on joins reflected in field usage', () => {
    const mTest = model`
      source: bone is b extend { where: ai = 1 }
      source: bintoa is a extend { join_one: b is bone on b.astr = astr }
      query: uses_b is bintoa -> { select: b.af }
      query: ignore_b is bintoa -> { select: af }
    `;
    expect(mTest).toTranslate();
    let mq = mTest.translator.getQuery('uses_b');
    let [found, message] = checkForFieldUsage({path: ['b', 'ai']}, mq);
    expect(found, message).toBeTruthy();
    mq = mTest.translator.getQuery('ignore_b');
    [found, message] = checkForFieldUsage({path: ['ai']}, mq);
    expect(found, message).toBeFalsy();
  });
  test('count with no path reflected in field usage', () => {
    const mTest = model`
      run: a -> { group_by: astr; aggregate: acnt is count() }
    `;
    expect(mTest).toTranslate();
    const mq = mTest.translator.getQuery(0);
    const [found, message] = checkForFieldUsage(
      {path: [], uniqueKeyRequirement: {isCount: true}},
      mq
    );
    expect(found, message).toBeTruthy();
  });
  test('source count reflected in field usage', () => {
    const mTest = model`
      run: a -> { group_by: astr; aggregate: acnt is source.count() }
    `;
    expect(mTest).toTranslate();
    const mq = mTest.translator.getQuery(0);
    const [found, message] = checkForFieldUsage(
      {path: [], uniqueKeyRequirement: {isCount: true}},
      mq
    );
    expect(found, message).toBeTruthy();
  });
  test('count with path reflected in field usage', () => {
    const mTest = model`
      run: ab -> { group_by: astr; aggregate: bcnt is b.count() }
    `;
    expect(mTest).toTranslate();
    const mq = mTest.translator.getQuery(0);
    const [found, message] = checkForFieldUsage(
      {path: ['b'], uniqueKeyRequirement: {isCount: true}},
      mq
    );
    expect(found, message).toBeTruthy();
  });
  test('asymmetric internal with no path reflected in field usage', () => {
    const mTest = model`
      run: a -> { group_by: astr; aggregate: avf_f is avg(af) }
    `;
    expect(mTest).toTranslate();
    const mq = mTest.translator.getQuery(0);
    const [found, message] = checkForFieldUsage(
      {path: [], uniqueKeyRequirement: {isCount: false}},
      mq
    );
    expect(found, message).toBeTruthy();
  });
  test('asymmetric internal with path reflected in field usage', () => {
    const mTest = model`
      run: ab -> { group_by: astr; aggregate: allbf is b.sum(af) }
    `;
    expect(mTest).toTranslate();
    const mq = mTest.translator.getQuery(0);
    const [found, message] = checkForFieldUsage(
      {path: ['b'], uniqueKeyRequirement: {isCount: false}},
      mq
    );
    expect(found, message).toBeTruthy();
  });
  test('asymmetric custom function reflected in field usage', () => {
    // non-distinct string_add is asymmetric
    const mTest = model`
      run: a -> { group_by: ai; aggregate: custom_a is string_agg(astr, ',') }
    `;
    expect(mTest).toTranslate();
    const mq = mTest.translator.getQuery(0);
    const [found, message] = checkForFieldUsage(
      {path: [], uniqueKeyRequirement: {isCount: false}},
      mq
    );
    expect(found, message).toBeTruthy();
  });
  test('analytic function call reflected in field usage', () => {
    const mTest = model`
      run: a -> { group_by: ai; calculate: lag_i is lag(ai) }
    `;
    expect(mTest).toTranslate();
    const mq = mTest.translator.getQuery(0);
    const [found, message] = checkForFieldUsage(
      {path: [], analyticFunctionUse: true},
      mq
    );
    expect(found, message).toBeTruthy();
  });
  // mtoy TODO noticed this, maybe check for complete usage in above tests, not just the one usage
  // it's probably benign, but not knowing why it happens is a concern
  test.todo(
    "aircraft_models.stddev(aircrat_models.seats) doesn't generate a path: [] field usage"
  );
});
