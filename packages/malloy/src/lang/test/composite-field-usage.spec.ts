/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {errorMessage, makeExprFunc, model} from './test-translator';
import './parse-expects';

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
          'This operation uses field `three`, resulting in invalid usage of the composite source, as there is no composite input source which defines all of `two` and `three` (fields required in source: `one`, `three`, and `two`)'
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
  describe('partition composites', () => {
    test('basic okay', () => {
      expect(`
        #! experimental { partition_composite { partition_field=astr partitions=[{id=ai fields=[ai]}] } }
        source: a_partition is a
      `).toTranslate();
    });
    test('can use field from extension not mentioned in partition spec', () => {
      expect(`
        #! experimental { partition_composite { partition_field=astr partitions=[{id=ai fields=[ai]}] } }
        source: a_partition is a

        source: a_partition_ext is a_partition extend {
          measure: ai_sum is ai.sum()
        }

        run: a_partition_ext -> { aggregate: ${'ai_sum'} }
      `).toTranslate();
    });
    test('missing partition field', () => {
      expect(`
        #! experimental { partition_composite { partitions=[{id=ai fields=[ai]}] } }
        source: a_partition is a
      `).toLog(
        errorMessage('Partition composite must specify `partition_field`')
      );
    });
    test('missing partitions', () => {
      expect(`
        #! experimental { partition_composite { partition_field=astr } }
        source: a_partition is a
      `).toLog(errorMessage('Partition composite must specify `partitions`'));
    });
    test('missing partition id', () => {
      expect(`
        #! experimental { partition_composite { partition_field=astr partitions=[{fields=[ai]}] }
        source: a_partition is a
      `).toLog(
        errorMessage(
          'Must specify `id` for each partition of a partition composite'
        )
      );
    });
    test('missing partition fields', () => {
      expect(`
        #! experimental { partition_composite { partition_field=astr partitions=[{id=ai}] }
        source: a_partition is a
      `).toLog(
        errorMessage(
          'Must specify `fields` array for each partition of a partition composite'
        )
      );
    });
    test('missing partition fields', () => {
      expect(`
        ##! experimental.composite_sources
        #! experimental { partition_composite { partition_field=astr partitions=[{id=ai fields=[ai]}] } }
        source: a_partition is compose(a, a)
      `).toLog(
        errorMessage(
          'Source is already composite; cannot apply partition composite'
        )
      );
    });
    test('cannot resolve partition composite', () => {
      expect(`
        #! experimental { partition_composite { partition_field=astr partitions=[{id=ai fields=[ai]}] } }
        source: a_partition is a

        run: a_partition -> { group_by: ${'af'} }
      `).toLog(
        errorMessage(
          'This operation uses field `af`, resulting in invalid usage of the composite source, as there is no composite input source which defines all of `af` (fields required in source: `af`)'
        )
      );
    });
  });
});
