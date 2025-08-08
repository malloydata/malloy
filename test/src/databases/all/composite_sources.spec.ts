/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {Runtime} from '@malloydata/malloy';
import {RuntimeList, allDatabases} from '../../runtimes';
import {databasesFromEnvironmentOr} from '../../util';
import '../../util/db-jest-matchers';

const runtimes = new RuntimeList(databasesFromEnvironmentOr(allDatabases));

afterAll(async () => {
  await runtimes.closeAll();
});

describe.each(runtimes.runtimeList)('%s', (databaseName, runtime) => {
  it('basic composite usage', async () => {
    await expect(`
      ##! experimental.composite_sources
      source: state_facts is ${databaseName}.table('malloytest.state_facts')
      source: x is compose(state_facts, state_facts extend { dimension: foo is 1 })
      run: x -> { group_by: foo }
    `).malloyResultMatches(runtime, {foo: 1});
  });
  it('composite usage multistage', async () => {
    await expect(`
      ##! experimental.composite_sources
      source: state_facts is ${databaseName}.table('malloytest.state_facts')
      source: x is compose(state_facts, state_facts extend { dimension: foo is 1 })
      run: x -> { group_by: foo } -> { select: foo }
    `).malloyResultMatches(runtime, {foo: 1});
  });
  it('composite view multistage', async () => {
    await expect(`
      ##! experimental.composite_sources
      source: state_facts is ${databaseName}.table('malloytest.state_facts')
      source: x is compose(state_facts, state_facts extend { dimension: foo is 1 }) extend {
        view: multistage is { group_by: foo } -> { select: foo }
      }
      run: x -> multistage
    `).malloyResultMatches(runtime, {foo: 1});
  });
  describe('composited joins', () => {
    it('basic composited join', async () => {
      await expect(`
        ##! experimental.composite_sources
        source: state_facts is ${databaseName}.table('malloytest.state_facts')
        source: s1 is state_facts extend {
          join_one: j is state_facts extend {
            dimension: f1 is 1
          } on j.state = state
        }
        source: s2 is state_facts extend {
          join_one: j is state_facts extend {
            dimension: f2 is 2
          } on j.state = state
        }
        source: c is compose(s1, s2)
        run: c -> { group_by: j.f2 }
      `).malloyResultMatches(runtime, {f2: 2});
    });
    it('selects correct join', async () => {
      await expect(`
        ##! experimental.composite_sources
        source: state_facts is ${databaseName}.table('malloytest.state_facts')
        source: s1 is state_facts extend {
          join_one: j is state_facts extend {
            dimension: jf is 1
          } on true
          dimension: f1 is 1
        }
        source: s2 is state_facts extend {
          join_one: j is state_facts extend {
            dimension: jf is 2
          } on true
          dimension: f2 is 2
        }
        source: c is compose(s1, s2)
        run: c -> { group_by: j.jf, f2 }
      `).malloyResultMatches(runtime, {f2: 2, jf: 2});
    });
    it('join on depends on selected join', async () => {
      await expect(`
        ##! experimental.composite_sources
        source: state_facts is ${databaseName}.table('malloytest.state_facts')
        source: jbase is compose(
          state_facts extend {
            dimension: jf1 is 1
          },
          state_facts extend {
            dimension: jf2 is 2
          }
        )
        source: s1 is state_facts extend {
          join_one: j is jbase on j.jf1 = 1 and j.state = 'CA'
          dimension: f1 is 1
        }
        source: s2 is state_facts extend {
          join_one: j is jbase on j.jf2 = 2 and j.state = 'IL'
          dimension: f2 is 2
        }
        source: c is compose(s1, s2)
        run: c -> { group_by: j.jf2, f2, j.state }
      `).malloyResultMatches(runtime, {jf2: 2, f2: 2, state: 'IL'});
    });
  });
  it('composite source used in join', async () => {
    await expect(`
      ##! experimental.composite_sources
      source: state_facts is ${databaseName}.table('malloytest.state_facts')
      source: x is compose(state_facts, state_facts extend { dimension: foo is 1 })
      source: y is ${databaseName}.table('malloytest.state_facts') extend {
        join_one: x on x.state = state
      }
      run: y -> { group_by: x.foo }
    `).malloyResultMatches(runtime, {foo: 1});
  });
  it('composite field from joined source used in join on', async () => {
    await expect(`
      ##! experimental.composite_sources
      source: state_facts is ${databaseName}.table('malloytest.state_facts')
      source: x is compose(state_facts, state_facts extend { dimension: state_copy is state })
      source: y is ${databaseName}.table('malloytest.state_facts') extend {
        // Join california by testing state copy;
        // composite field usage is in join on, so the composite source with state_copy should
        // be selected whenever this join is used
        join_one: ca is x on ca.state_copy = 'CA'
      }
      run: y -> { group_by: ca.state; where: state = 'IL' }
    `).malloyResultMatches(runtime, {state: 'CA'});
  });
  it('composite field from joining source used in join on', async () => {
    await expect(`
      ##! experimental.composite_sources
      source: state_facts is ${databaseName}.table('malloytest.state_facts')
      source: x is compose(
        state_facts extend {
          dimension:
            state_one is 'CA'
            state_two is 'IL'
        },
        state_facts extend {
          dimension: state_one is 'IL'
        }
      ) extend {
        join_one: state_facts on state_one = state_facts.state
      }
      run: x -> { group_by: state_facts.state }
    `).malloyResultMatches(runtime, {state: 'CA'});
  });
  it('query against composite resolves nested composite source even when no composite fields', async () => {
    await expect(`
      ##! experimental.composite_sources
      source: state_facts is ${databaseName}.table('malloytest.state_facts')
      source: x is compose(
        compose(
          state_facts,
          state_facts
        ),
        state_facts
      ) extend {
        dimension: a is 1
      }
      run: x -> { group_by: a }
    `).malloyResultMatches(runtime, {a: 1});
  });
  // TODO test always join composite field usage
  it('composite field used in view', async () => {
    await expect(`
      ##! experimental.composite_sources
      source: state_facts is ${databaseName}.table('malloytest.state_facts')
      source: x is compose(state_facts, state_facts extend { dimension: foo is 1 }) extend {
        view: v is { group_by: foo }
      }
      run: x -> v
    `).malloyResultMatches(runtime, {foo: 1});
  });
  it('composite field used in view refined with scalar', async () => {
    await expect(`
      ##! experimental.composite_sources
      source: state_facts is ${databaseName}.table('malloytest.state_facts')
      source: x is compose(state_facts, state_facts extend { dimension: foo is 1 }) extend {
        view: v is {
          group_by: state
          where: state = 'CA'
          limit: 1
        }
      }
      run: x -> v + foo
    `).malloyResultMatches(runtime, {foo: 1, state: 'CA'});
  });
  it('composite field used in view refined with literal view', async () => {
    await expect(`
      ##! experimental.composite_sources
      source: state_facts is ${databaseName}.table('malloytest.state_facts')
      source: x is compose(state_facts, state_facts extend { dimension: foo is 1 }) extend {
        view: v is {
          group_by: state
          where: state = 'CA'
          limit: 1
        }
      }
      run: x -> v + { group_by: foo }
    `).malloyResultMatches(runtime, {foo: 1, state: 'CA'});
  });
  it('composite field used in refined query', async () => {
    await expect(`
      ##! experimental.composite_sources
      source: state_facts is ${databaseName}.table('malloytest.state_facts')
      source: x is compose(state_facts, state_facts extend { dimension: foo is 1 }) extend {
        view: v is {
          group_by: state
          where: state = 'CA'
          limit: 1
        }
      }
      query: v is x -> v
      run: v + { group_by: foo }
    `).malloyResultMatches(runtime, {foo: 1, state: 'CA'});
  });
  it('composite of a composite', async () => {
    await expect(`
      ##! experimental.composite_sources
      source: state_facts is ${databaseName}.table('malloytest.state_facts')
      source: x is compose(
        state_facts,
        state_facts extend { dimension: foo is 1 }
      )
      source: y is compose(
        x,
        x extend { dimension: bar is 2 }
      )
      // in order to get bar, we need to use the second composite input, which is itself a composite source
      // then in order to get foo, we need to resolve the inner composite source to its second input
      run: y -> { group_by: foo, bar }
    `).malloyResultMatches(runtime, {foo: 1, bar: 2});
  });
  it('definitions from composite extension carry through', async () => {
    await expect(`
      ##! experimental.composite_sources
      source: state_facts is ${databaseName}.table('malloytest.state_facts')
      source: x is compose(
        state_facts,
        state_facts extend { dimension: foo is 1 }
      ) extend {
        dimension: bar is 2
      }
      run: x -> { group_by: foo, bar }
    `).malloyResultMatches(runtime, {foo: 1, bar: 2});
  });
  it('filters from composite extension carry through', async () => {
    await expect(`
      ##! experimental.composite_sources
      source: state_facts is ${databaseName}.table('malloytest.state_facts')
      source: x is compose(
        state_facts,
        state_facts extend { dimension: foo is 1 }
      ) extend {
        where: state = 'CA'
      }
      run: x -> { group_by: foo, state }
    `).malloyResultMatches(runtime, {foo: 1, state: 'CA'});
  });
  it(`composite of a composite where greedy is bad- ${databaseName}`, async () => {
    await expect(`
      ##! experimental.composite_sources
      source: state_facts is ${databaseName}.table('malloytest.state_facts')
      source: x is compose(
        compose(
          state_facts extend { dimension: foo is 1.1, bar is 2.1 },
          state_facts extend { dimension: foo is 1.2, baz is 3.2 }
        ),
        state_facts extend { dimension: foo is 1.3, bar is 2.3, baz is 3.3 }
      )
      // even though the first composite hAS all the fields foo, bar, baz; it is impossible
      // to resolve it using the first composite, because you can't have both bar and baz
      // so the second input source is used instead
      run: x -> { group_by: foo, bar, baz }
    `).malloyResultMatches(runtime, {foo: 1.3, bar: 2.3, baz: 3.3});
  });
  it('composite with parameters', async () => {
    await expect(`
      ##! experimental { composite_sources parameters }
      source: state_facts is ${databaseName}.table('malloytest.state_facts')
      source: x(param is 1) is compose(
        state_facts extend { dimension: a is param },
        state_facts extend { dimension: b is param + 1 }
      )
      run: x(param is 2) -> { group_by: b }
    `).malloyResultMatches(runtime, {b: 3});
  });
  it('issue where measure defined on composite source has the wrong structPath', async () => {
    await expect(`
      ##! experimental { composite_sources parameters }
      source: state_facts is ${databaseName}.table('malloytest.state_facts')
      run: compose(state_facts, state_facts) extend {
        measure: total_airport_count is airport_count.sum()
      } -> {
        aggregate: total_airport_count
        where: state = 'CA'
      }
    `).malloyResultMatches(runtime, {total_airport_count: 984});
  });
  it('issue where query against composite source with no composite field usage does not resolve the source', async () => {
    await expect(`
      ##! experimental { composite_sources parameters }
      source: state_facts is ${databaseName}.table('malloytest.state_facts')
      run: compose(state_facts, state_facts) extend {
        measure: total_airport_count is airport_count.sum()
      } -> {
        group_by: x is 1
      }
    `).malloyResultMatches(runtime, {x: 1});
  });
  it('reference composite field in nest', async () => {
    await expect(`
      ##! experimental { composite_sources parameters }
      source: state_facts is ${databaseName}.table('malloytest.state_facts')
      run: compose(state_facts, state_facts extend { dimension: x is 1 }) -> {
        nest: foo is {
          group_by: x
        }
      }
    `).malloyResultMatches(runtime, {'foo.x': 1});
  });
  it('composite with select *', async () => {
    await expect(`
      ##! experimental.composite_sources
      source: state_facts is ${databaseName}.table('malloytest.state_facts')
      source: x is compose(state_facts, state_facts extend { dimension: foo is 1 }) extend {
        accept: foo
      }
      run: x -> { select: * }
    `).malloyResultMatches(runtime, {foo: 1});
  });
  it('composite with each', async () => {
    await expect(`
      ##! experimental.composite_sources
      source: state_facts is ${databaseName}.table('malloytest.state_facts')
      source: x is compose(
        state_facts extend { measure: foo is sum(0); dimension: bar is 1 },
        state_facts extend { measure: foo is count() }
      ) extend {
        dimension: arr is [1, 2, 3]
      }
      run: x -> { aggregate: foo; group_by: bar, arr.each }
    `).malloyResultMatches(runtime, {foo: 0});
  });
  it('complex nesting composite without join', async () => {
    await expect(`
      ##! experimental.composite_sources
      source: state_facts is ${databaseName}.table('malloytest.state_facts')
      source: x is compose(
        compose(
          state_facts,
          state_facts extend {
            dimension: bar is 1
          }
        ) extend {
          measure: foo is sum(0)
        },
        state_facts extend {
          measure: foo is sum(0) + 1
          dimension: bar is 2
        }
      )
      run: x -> { aggregate: foo; group_by: bar }
    `).malloyResultMatches(runtime, {foo: 0, bar: 1});
  });
  it('complex nesting composite with join -- literal view', async () => {
    await expect(`
      ##! experimental.composite_sources
      source: state_facts is ${databaseName}.table('malloytest.state_facts')
      source: x is compose(
        compose(
          state_facts,
          state_facts extend {
            dimension: the_state is 'CA'
          }
        ),
        state_facts extend {
          dimension: the_state is 'IL'
        }
      ) extend {
        join_one: state_facts on the_state = state_facts.state
      }
      run: x -> { group_by: state_facts.state }
    `).malloyResultMatches(runtime, {state: 'CA'});
  });
  it('complex nesting composite with join -- double extend to define view', async () => {
    await expect(`
      ##! experimental.composite_sources
      source: state_facts is ${databaseName}.table('malloytest.state_facts')
      source: x is compose(
        compose(
          state_facts,
          state_facts extend {
            dimension: the_state is 'CA'
          }
        ),
        state_facts extend {
          dimension: the_state is 'IL'
        }
      ) extend {
        join_one: state_facts on the_state = state_facts.state
      } extend {
        view: y is { group_by: state_facts.state }
      }
      run: x -> y
    `).malloyResultMatches(runtime, {state: 'CA'});
  });
  it('complex nesting composite with join -- defined view', async () => {
    await expect(`
      ##! experimental.composite_sources
      source: state_facts is ${databaseName}.table('malloytest.state_facts')
      source: x is compose(
        compose(
          state_facts,
          state_facts extend {
            dimension: the_state is 'CA'
          }
        ),
        state_facts extend {
          dimension: the_state is 'IL'
        }
      ) extend {
        join_one: state_facts on the_state = state_facts.state

        view: y is { group_by: state_facts.state }
      }
      run: x -> y
    `).malloyResultMatches(runtime, {state: 'CA'});
  });
  describe('index queries against composite sources', () => {
    it('index query selects second input', async () => {
      await expect(`
        ##! experimental.composite_sources
        source: state_facts is ${databaseName}.table('malloytest.state_facts')
        run: compose(
          state_facts,
          state_facts extend { dimension: bar is 1 }
        ) -> { index: bar }
      `).malloyResultMatches(runtime, {}); // Just test that it runs
    });
    it('index query selects first input', async () => {
      await expect(`
        ##! experimental.composite_sources
        source: state_facts is ${databaseName}.table('malloytest.state_facts')
        run: compose(
          state_facts extend { dimension: bar is 1 },
          state_facts
        ) -> { index: bar }
      `).malloyResultMatches(runtime, {}); // Just test that it runs
    });
    it('index query resolves when two stages', async () => {
      await expect(`
        ##! experimental.composite_sources
        source: state_facts is ${databaseName}.table('malloytest.state_facts')
        run: compose(
          state_facts extend { dimension: bar is 1 },
          state_facts
        ) -> { index: bar } -> { group_by: fieldName; where: fieldName is not null }
      `).malloyResultMatches(runtime, {fieldName: 'bar'});
    });
  });
  it('composite with parameters in separate file', async () => {
    const wrappedRuntime = new Runtime({
      connections: runtime.connections,
      urlReader: {
        readURL(_url: URL) {
          return Promise.resolve(`
            ##! experimental { composite_sources parameters }
            source: state_facts is ${databaseName}.table('malloytest.state_facts')
            source: x(param is 2) is compose(
              state_facts extend { dimension: a is 1 },
              state_facts extend { dimension: b is 2 }
            ) extend {
              where: param = 1
            }
          `);
        },
      },
    });
    await expect(`
      import "http://foo.malloy"
      ##! experimental { composite_sources parameters }
      run: x(param is 1) -> { group_by: b }
    `).malloyResultMatches(wrappedRuntime, {b: 2});
  });
  it('composite with parameters in separate file passing parameter to use in extended compose', async () => {
    const wrappedRuntime = new Runtime({
      connections: runtime.connections,
      urlReader: {
        readURL(_url: URL) {
          return Promise.resolve(`
            ##! experimental { composite_sources parameters }
            source: state_facts is ${databaseName}.table('malloytest.state_facts')
            source: x(param is 1) is compose(
              state_facts extend { dimension: a is param },
              state_facts extend { dimension: b is param + 1 }
            )
          `);
        },
      },
    });
    await expect(`
      import "http://foo.malloy"
      ##! experimental { composite_sources parameters }
      run: x(param is 2) -> { group_by: b }
    `).malloyResultMatches(wrappedRuntime, {b: 3});
  });
  it('nested composite where field usage depends on which composite selected', async () => {
    await expect(`
      ##! experimental.composite_sources
      source: state_facts is ${databaseName}.table('malloytest.state_facts')
      source: x is compose(
        compose(
          state_facts extend {
            dimension: a is 'a1'
          },
          state_facts extend {
            dimension: b is 'b1'
          }
        ) extend {
          dimension: x is b
        },
        compose(
          state_facts extend {
            dimension: a is 'a2'
          },
          state_facts extend {
            dimension: b is 'b2'
          }
        ) extend {
          dimension: x is b
        }
      )
      run: x -> { group_by: x }
    `).malloyResultMatches(runtime, {x: 'b1'});
  });
  describe('partition composites', () => {
    const id = (n: string) => (databaseName === 'snowflake' ? `"${n}"` : n);
    test('partition composite basic', async () => {
      await expect(`
        #! experimental { partition_composite { partition_field=p partitions=[{id=a fields=[a]}, {id=b fields=[b]}] } }
        source: comp is ${databaseName}.sql("""
                    SELECT 10 AS ${id('a')}, 0 AS ${id('b')}, 'a' AS ${id('p')}
          UNION ALL SELECT 20 AS ${id('a')}, 0 AS ${id('b')}, 'a' AS ${id('p')}
          UNION ALL SELECT 0  AS ${id('a')}, 1 AS ${id('b')}, 'b' AS ${id('p')}
          UNION ALL SELECT 0  AS ${id('a')}, 2 AS ${id('b')}, 'b' AS ${id('p')}
        """)

        run: comp -> {
          aggregate: a_avg is a.avg()
          aggregate: c is count()
        }
      `).malloyResultMatches(runtime, {a_avg: 15, c: 2});
    });
    test('extended partition composite', async () => {
      await expect(`
        #! experimental { partition_composite { partition_field=p partitions=[{id=a fields=[a]}, {id=b fields=[b]}] } }
        source: comp is ${databaseName}.sql("""
                    SELECT 10 AS ${id('a')}, 0 AS ${id('b')}, 'a' AS ${id('p')}
          UNION ALL SELECT 20 AS ${id('a')}, 0 AS ${id('b')}, 'a' AS ${id('p')}
          UNION ALL SELECT 0  AS ${id('a')}, 1 AS ${id('b')}, 'b' AS ${id('p')}
          UNION ALL SELECT 0  AS ${id('a')}, 2 AS ${id('b')}, 'b' AS ${id('p')}
        """)

        source: comp_ext is comp extend {
          measure: a_avg is a.avg()
        }

        run: comp_ext -> {
          aggregate: a_avg
          aggregate: c is count()
        }
      `).malloyResultMatches(runtime, {a_avg: 15, c: 2});
    });
    test('partition composite nested in composite', async () => {
      await expect(`
        ##! experimental.composite_sources
        #! experimental { partition_composite { partition_field=p partitions=[{id=a fields=[a]}, {id=b fields=[b]}] } }
        source: part_comp is ${databaseName}.sql("""
                    SELECT 10 AS ${id('a')}, 0 AS ${id('b')}, 'a' AS ${id('p')}
          UNION ALL SELECT 20 AS ${id('a')}, 0 AS ${id('b')}, 'a' AS ${id('p')}
          UNION ALL SELECT 0  AS ${id('a')}, 1 AS ${id('b')}, 'b' AS ${id('p')}
          UNION ALL SELECT 0  AS ${id('a')}, 2 AS ${id('b')}, 'b' AS ${id('p')}
        """)

        source: comp is compose(
          part_comp,
          ${databaseName}.sql("SELECT 10 AS ${id('c')}")
        )

        run: comp -> {
          aggregate: a_avg is a.avg()
          aggregate: c is count()
        }
      `).malloyResultMatches(runtime, {a_avg: 15, c: 2});
    });
  });
});
