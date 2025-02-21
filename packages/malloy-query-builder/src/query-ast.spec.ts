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
      const segment = view.getOrAddDefaultSegment();
      // TODO need a view.addEmptyRefinement();
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
  test('set view reference with named refinement', () => {
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
      const view = q.setView('by_carrier');
      view.list.stage.addViewRefinement('cool_state_measures');
    }).toModifyQuery({
      source: {
        name: 'flights',
        schema: {
          fields: [
            {
              __type: Malloy.FieldInfoType.Dimension,
              name: 'carrier',
              type: {__type: Malloy.AtomicTypeType.StringType},
            },
            {
              __type: Malloy.FieldInfoType.Measure,
              name: 'flight_count',
              type: {__type: Malloy.AtomicTypeType.NumberType},
            },
            {
              __type: Malloy.FieldInfoType.View,
              name: 'by_carrier',
              schema: {
                fields: [
                  {
                    __type: Malloy.FieldInfoType.Dimension,
                    name: 'carrier',
                    type: {__type: Malloy.AtomicTypeType.StringType},
                  },
                  {
                    __type: Malloy.FieldInfoType.Measure,
                    name: 'flight_count',
                    type: {__type: Malloy.AtomicTypeType.NumberType},
                  },
                ],
              },
            },
            {
              __type: Malloy.FieldInfoType.View,
              name: 'cool_state_measures',
              schema: {
                fields: [
                  {
                    __type: Malloy.FieldInfoType.Measure,
                    name: 'il_flight_count',
                    type: {__type: Malloy.AtomicTypeType.NumberType},
                  },
                  {
                    __type: Malloy.FieldInfoType.Measure,
                    name: 'ca_flight_count',
                    type: {__type: Malloy.AtomicTypeType.NumberType},
                  },
                ],
              },
            },
          ],
        },
      },
      from,
      to: {
        pipeline: {
          stages: [
            {
              refinements: [
                {
                  __type: Malloy.RefinementType.Reference,
                  name: 'by_carrier',
                },
                {
                  __type: Malloy.RefinementType.Reference,
                  name: 'cool_state_measures',
                },
              ],
            },
          ],
        },
        source: from.source,
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
});
