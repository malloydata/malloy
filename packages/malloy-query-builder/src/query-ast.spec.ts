/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

// eslint-disable-next-line node/no-extraneous-import
import * as Malloy from '@malloydata/malloy-interfaces';
import {flights_model} from './flights_model';
import './expects';
import {ASTQuery} from './query-ast';

describe('query builder', () => {
  test('add an order by', () => {
    const from: Malloy.Query = {
      definition: {
        kind: 'arrow',
        source_reference: {name: 'flights'},
        view: {
          kind: 'segment',
          operations: [
            {
              kind: 'group_by',
              field: {
                expression: {
                  kind: 'field_reference',
                  name: 'carrier',
                },
              },
            },
          ],
        },
      },
    };
    expect((q: ASTQuery) => {
      q.getOrAddDefaultSegment().addOrderBy('carrier', 'asc');
    }).toModifyQuery({
      model: flights_model,
      from,
      to: {
        definition: {
          kind: 'arrow',
          source_reference: {name: 'flights'},
          view: {
            kind: 'segment',
            operations: [
              {
                kind: 'group_by',
                field: {
                  expression: {
                    kind: 'field_reference',
                    name: 'carrier',
                  },
                },
              },
              {
                kind: 'order_by',
                field_reference: {
                  name: 'carrier',
                },
                direction: 'asc',
              },
            ],
          },
        },
      },
      malloy: `run: flights -> {
  group_by: carrier
  order_by: carrier asc
}`,
    });
  });
  test('add a group by', () => {
    const from: Malloy.Query = {
      definition: {
        kind: 'arrow',
        source_reference: {name: 'flights'},
        view: {
          kind: 'segment',
          operations: [],
        },
      },
    };
    expect((q: ASTQuery) => {
      q.getOrAddDefaultSegment().addGroupBy('carrier');
    }).toModifyQuery({
      model: flights_model,
      from,
      to: {
        definition: {
          kind: 'arrow',
          source_reference: {name: 'flights'},
          view: {
            kind: 'segment',
            operations: [
              {
                kind: 'group_by',
                field: {
                  expression: {
                    kind: 'field_reference',
                    name: 'carrier',
                  },
                },
              },
            ],
          },
        },
      },
      malloy: 'run: flights -> { group_by: carrier }',
    });
  });
  test('add a date group by', () => {
    const from: Malloy.Query = {
      definition: {
        kind: 'arrow',
        source_reference: {name: 'flights'},
        view: {
          kind: 'segment',
          operations: [],
        },
      },
    };
    expect((q: ASTQuery) => {
      q.getOrAddDefaultSegment().addTimestampGroupBy('dep_time', 'month');
    }).toModifyQuery({
      model: flights_model,
      from,
      to: {
        definition: {
          kind: 'arrow',
          source_reference: {name: 'flights'},
          view: {
            kind: 'segment',
            operations: [
              {
                kind: 'group_by',
                field: {
                  expression: {
                    kind: 'time_truncation',
                    field_reference: {name: 'dep_time'},
                    truncation: 'month',
                  },
                },
              },
            ],
          },
        },
      },
      malloy: 'run: flights -> { group_by: dep_time.month }',
    });
  });
  test('add two group bys', () => {
    const from: Malloy.Query = {
      definition: {
        kind: 'arrow',
        source_reference: {name: 'flights'},
        view: {
          kind: 'segment',
          operations: [],
        },
      },
    };
    expect((q: ASTQuery) => {
      const seg = q.getOrAddDefaultSegment();
      seg.addGroupBy('carrier');
      seg.addGroupBy('origin_code');
    }).toModifyQuery({
      model: flights_model,
      from,
      to: {
        definition: {
          kind: 'arrow',
          source_reference: {name: 'flights'},
          view: {
            kind: 'segment',
            operations: [
              {
                kind: 'group_by',
                field: {
                  expression: {
                    kind: 'field_reference',
                    name: 'carrier',
                  },
                },
              },
              {
                kind: 'group_by',
                field: {
                  expression: {
                    kind: 'field_reference',
                    name: 'origin_code',
                  },
                },
              },
            ],
          },
        },
      },
      malloy: `
run: flights -> {
  group_by:
    carrier
    origin_code
}`.trim(),
    });
  });
  test('add a nest', () => {
    const from: Malloy.Query = {
      definition: {
        kind: 'arrow',
        source_reference: {name: 'flights'},
        view: {
          kind: 'segment',
          operations: [],
        },
      },
    };
    expect((q: ASTQuery) => {
      const seg = q.getOrAddDefaultSegment();
      const nest = seg.addEmptyNest('by_carrier');
      const seg2 = nest.view.getOrAddDefaultSegment();
      seg2.addGroupBy('carrier');
    }).toModifyQuery({
      model: flights_model,
      from,
      to: {
        definition: {
          kind: 'arrow',
          source_reference: {name: 'flights'},
          view: {
            kind: 'segment',
            operations: [
              {
                kind: 'nest',
                name: 'by_carrier',
                view: {
                  definition: {
                    kind: 'segment',
                    operations: [
                      {
                        kind: 'group_by',
                        field: {
                          expression: {
                            kind: 'field_reference',
                            name: 'carrier',
                          },
                        },
                      },
                    ],
                  },
                },
              },
            ],
          },
        },
      },
      malloy: 'run: flights -> { nest: by_carrier is { group_by: carrier } }',
    });
  });
  test('nest via field reference', () => {
    const from: Malloy.Query = {
      definition: {
        kind: 'arrow',
        source_reference: {name: 'flights'},
        view: {
          kind: 'segment',
          operations: [],
        },
      },
    };
    expect((q: ASTQuery) => {
      const seg = q.getOrAddDefaultSegment();
      seg.addNest('by_month');
    }).toModifyQuery({
      model: flights_model,
      from,
      to: {
        definition: {
          kind: 'arrow',
          source_reference: {name: 'flights'},
          view: {
            kind: 'segment',
            operations: [
              {
                kind: 'nest',
                view: {
                  definition: {
                    kind: 'view_reference',
                    name: 'by_month',
                  },
                },
              },
            ],
          },
        },
      },
      malloy: 'run: flights -> { nest: by_month }',
    });
  });
  test('set view reference', () => {
    const from: Malloy.Query = {
      definition: {
        kind: 'arrow',
        source_reference: {name: 'flights'},
        view: {
          kind: 'segment',
          operations: [],
        },
      },
    };
    expect((q: ASTQuery) => {
      q.setView('by_month');
    }).toModifyQuery({
      model: flights_model,
      from,
      to: {
        definition: {
          kind: 'arrow',
          source_reference: {name: 'flights'},
          view: {
            kind: 'view_reference',
            name: 'by_month',
          },
        },
      },
      malloy: 'run: flights -> by_month',
    });
  });
  test('set view with segment refinement', () => {
    const from: Malloy.Query = {
      definition: {
        kind: 'arrow',
        source_reference: {name: 'flights'},
        view: {
          kind: 'segment',
          operations: [],
        },
      },
    };
    expect((q: ASTQuery) => {
      const view = q.setView('by_month');
      const segment = view.addEmptyRefinement();
      segment.setLimit(10);
    }).toModifyQuery({
      model: flights_model,
      from,
      to: {
        definition: {
          kind: 'arrow',
          source_reference: {name: 'flights'},
          view: {
            kind: 'refinement',
            base: {
              kind: 'view_reference',
              name: 'by_month',
            },
            refinement: {
              kind: 'segment',
              operations: [
                {
                  kind: 'limit',
                  limit: 10,
                },
              ],
            },
          },
        },
      },
      malloy: 'run: flights -> by_month + { limit: 10 }',
    });
  });
  test('do nothing', () => {
    expect((_q: ASTQuery) => {}).toModifyQuery({
      model: flights_model,
      from: {
        definition: {
          kind: 'arrow',
          source_reference: {name: 'flights'},
          view: {
            kind: 'segment',
            operations: [],
          },
        },
      },
      to: {
        definition: {
          kind: 'arrow',
          source_reference: {name: 'flights'},
          view: {
            kind: 'segment',
            operations: [],
          },
        },
      },
      malloy: 'run: flights -> { }',
    });
  });
  test('set view reference with named refinement', () => {
    const from: Malloy.Query = {
      definition: {
        kind: 'arrow',
        source_reference: {name: 'flights'},
        view: {
          kind: 'view_reference',
          name: 'by_carrier',
        },
      },
    };
    expect((q: ASTQuery) => {
      q.definition
        .asArrowQueryDefinition()
        .view.addViewRefinement('cool_state_measures');
    }).toModifyQuery({
      source: {
        name: 'flights',
        schema: {
          fields: [
            {
              kind: 'dimension',
              name: 'carrier',
              type: {kind: 'string_type'},
            },
            {
              kind: 'measure',
              name: 'flight_count',
              type: {kind: 'number_type'},
            },
            {
              kind: 'view',
              name: 'by_carrier',
              schema: {
                fields: [
                  {
                    kind: 'dimension',
                    name: 'carrier',
                    type: {kind: 'string_type'},
                  },
                  {
                    kind: 'measure',
                    name: 'flight_count',
                    type: {kind: 'number_type'},
                  },
                ],
              },
            },
            {
              kind: 'view',
              name: 'cool_state_measures',
              schema: {
                fields: [
                  {
                    kind: 'measure',
                    name: 'il_flight_count',
                    type: {kind: 'number_type'},
                  },
                  {
                    kind: 'measure',
                    name: 'ca_flight_count',
                    type: {kind: 'number_type'},
                  },
                ],
              },
            },
          ],
        },
      },
      from,
      to: {
        definition: {
          kind: 'arrow',
          source_reference: {name: 'flights'},
          view: {
            kind: 'refinement',
            base: {
              kind: 'view_reference',
              name: 'by_carrier',
            },
            refinement: {
              kind: 'view_reference',
              name: 'cool_state_measures',
            },
          },
        },
      },
      malloy: 'run: flights -> by_carrier + cool_state_measures',
    });
  });
  test('add limit', () => {
    const from: Malloy.Query = {
      definition: {
        kind: 'arrow',
        source_reference: {name: 'flights'},
        view: {
          kind: 'segment',
          operations: [],
        },
      },
    };
    expect((q: ASTQuery) => {
      const seg = q.getOrAddDefaultSegment();
      seg.setLimit(10);
    }).toModifyQuery({
      model: flights_model,
      from,
      to: {
        definition: {
          kind: 'arrow',
          source_reference: {name: 'flights'},
          view: {
            kind: 'segment',
            operations: [
              {
                kind: 'limit',
                limit: 10,
              },
            ],
          },
        },
      },
      malloy: 'run: flights -> { limit: 10 }',
    });
  });
  test('change limit', () => {
    const from: Malloy.Query = {
      definition: {
        kind: 'arrow',
        source_reference: {name: 'flights'},
        view: {
          kind: 'segment',
          operations: [
            {
              kind: 'limit',
              limit: 10,
            },
          ],
        },
      },
    };
    expect((q: ASTQuery) => {
      const seg = q.getOrAddDefaultSegment();
      seg.setLimit(20);
    }).toModifyQuery({
      model: flights_model,
      from,
      to: {
        definition: {
          kind: 'arrow',
          source_reference: {name: 'flights'},
          view: {
            kind: 'segment',
            operations: [
              {
                kind: 'limit',
                limit: 20,
              },
            ],
          },
        },
      },
      malloy: 'run: flights -> { limit: 20 }',
    });
  });
  test('add a tag property to a group by', () => {
    const from: Malloy.Query = {
      definition: {
        kind: 'arrow',
        source_reference: {name: 'flights'},
        view: {
          kind: 'segment',
          operations: [],
        },
      },
    };
    expect((q: ASTQuery) => {
      const gb = q.getOrAddDefaultSegment().addGroupBy('carrier');
      gb.setTagProperty(['a', 'b', 'c'], 10);
    }).toModifyQuery({
      model: flights_model,
      from,
      to: {
        definition: {
          kind: 'arrow',
          source_reference: {name: 'flights'},
          view: {
            kind: 'segment',
            operations: [
              {
                kind: 'group_by',
                field: {
                  annotations: [{value: '# a.b.c = 10'}],
                  expression: {
                    kind: 'field_reference',
                    name: 'carrier',
                  },
                },
              },
            ],
          },
        },
      },
      malloy: `
run: flights -> {
  # a.b.c = 10
  group_by: carrier
}`.trim(),
    });
  });
  describe('getOrAddDefaultSegment', () => {
    test('on an arrow query with a segment', () => {
      expect((q: ASTQuery) => {
        q.getOrAddDefaultSegment();
      }).toModifyQuery({
        model: flights_model,
        from: {
          definition: {
            kind: 'arrow',
            source_reference: {name: 'flights'},
            view: {
              kind: 'segment',
              operations: [],
            },
          },
        },
        to: {
          definition: {
            kind: 'arrow',
            source_reference: {name: 'flights'},
            view: {
              kind: 'segment',
              operations: [],
            },
          },
        },
        malloy: 'run: flights -> { }',
      });
    });
    test('on an arrow query with a view reference', () => {
      expect((q: ASTQuery) => {
        q.getOrAddDefaultSegment();
      }).toModifyQuery({
        model: flights_model,
        from: {
          definition: {
            kind: 'arrow',
            source_reference: {name: 'flights'},
            view: {
              kind: 'view_reference',
              name: 'by_month',
            },
          },
        },
        to: {
          definition: {
            kind: 'arrow',
            source_reference: {name: 'flights'},
            view: {
              kind: 'refinement',
              base: {
                kind: 'view_reference',
                name: 'by_month',
              },
              refinement: {
                kind: 'segment',
                operations: [],
              },
            },
          },
        },
        malloy: 'run: flights -> by_month + { }',
      });
    });
    test('on an arrow query with a view reference that already has a segment refinement', () => {
      expect((q: ASTQuery) => {
        q.getOrAddDefaultSegment();
      }).toModifyQuery({
        model: flights_model,
        from: {
          definition: {
            kind: 'arrow',
            source_reference: {name: 'flights'},
            view: {
              kind: 'refinement',
              base: {
                kind: 'view_reference',
                name: 'by_month',
              },
              refinement: {
                kind: 'segment',
                operations: [],
              },
            },
          },
        },
        to: {
          definition: {
            kind: 'arrow',
            source_reference: {name: 'flights'},
            view: {
              kind: 'refinement',
              base: {
                kind: 'view_reference',
                name: 'by_month',
              },
              refinement: {
                kind: 'segment',
                operations: [],
              },
            },
          },
        },
        malloy: 'run: flights -> by_month + { }',
      });
    });
    test('on a query reference', () => {
      expect((q: ASTQuery) => {
        q.getOrAddDefaultSegment();
      }).toModifyQuery({
        model: flights_model,
        from: {
          definition: {
            kind: 'query_reference',
            name: 'flights_by_carrier',
          },
        },
        to: {
          definition: {
            kind: 'refinement',
            query_reference: {name: 'flights_by_carrier'},
            refinement: {
              kind: 'segment',
              operations: [],
            },
          },
        },
        malloy: 'run: flights_by_carrier + { }',
      });
    });
  });
  test('on an arrow query with a view reference that already has a reference refinement', () => {
    expect((q: ASTQuery) => {
      q.getOrAddDefaultSegment();
    }).toModifyQuery({
      model: flights_model,
      from: {
        definition: {
          kind: 'arrow',
          source_reference: {name: 'flights'},
          view: {
            kind: 'refinement',
            base: {
              kind: 'view_reference',
              name: 'by_month',
            },
            refinement: {
              kind: 'view_reference',
              name: 'top10',
            },
          },
        },
      },
      to: {
        definition: {
          kind: 'arrow',
          source_reference: {name: 'flights'},
          view: {
            kind: 'refinement',
            base: {
              kind: 'view_reference',
              name: 'by_month',
            },
            refinement: {
              kind: 'refinement',
              base: {
                kind: 'view_reference',
                name: 'top10',
              },
              refinement: {
                kind: 'segment',
                operations: [],
              },
            },
          },
        },
      },
      malloy: 'run: flights -> by_month + top10 + { }',
    });
  });
});
