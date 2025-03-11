/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as Malloy from '@malloydata/malloy-interfaces';
import {flights_model} from './flights_model';
import './expects';
import {ASTOrderByViewOperation, ASTQuery} from './query-ast';

function dedent(strs: TemplateStringsArray) {
  const str = strs.join('');
  let lines = str.split('\n');
  const firstNonEmptyLine = lines.findIndex(l => l.trim().length > 0);
  let lastNonEmptyLine = 0;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].trim().length > 0) {
      lastNonEmptyLine = i;
      break;
    }
  }
  lines = lines.slice(firstNonEmptyLine, lastNonEmptyLine + 1);
  let minIndent: number | undefined = undefined;
  for (const line of lines) {
    if (line.trim().length === 0) continue;
    const indent = line.length - line.trimStart().length;
    if (minIndent === undefined || indent < minIndent) minIndent = indent;
  }
  if (!minIndent) return str;
  return lines.map(l => l.slice(minIndent)).join('\n');
}

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
  test('add a group by with a new name', () => {
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
      q.getOrAddDefaultSegment().addGroupBy('carrier', [], 'carrier_2');
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
                name: 'carrier_2',
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
      malloy: dedent`
        run: flights -> {
          group_by:
            carrier
            carrier_2 is carrier
        }
      `,
    });
  });
  test('add a group by in a join', () => {
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
      const segment = q.getOrAddDefaultSegment();
      segment.addGroupBy('code', ['origin']);
      segment.addOrderBy('code', 'asc');
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
                    name: 'code',
                    path: ['origin'],
                  },
                },
              },
              {
                kind: 'order_by',
                field_reference: {name: 'code'},
                direction: 'asc',
              },
            ],
          },
        },
      },
      malloy: dedent`
        run: flights -> {
          group_by: origin.code
          order_by: code asc
        }
      `,
    });
  });
  describe('aggregate', () => {
    test('added aggregate should have calculation annotation', () => {
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
        const aggregate = q
          .getOrAddDefaultSegment()
          .addAggregate('flight_count');
        expect(ASTQuery.fieldWasCalculation(aggregate.getFieldInfo())).toBe(
          true
        );
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
                  kind: 'aggregate',
                  field: {
                    expression: {
                      kind: 'field_reference',
                      name: 'flight_count',
                    },
                  },
                },
              ],
            },
          },
        },
        malloy: 'run: flights -> { aggregate: flight_count }',
      });
    });
    test('add an aggregate with a where', () => {
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
        q.getOrAddDefaultSegment()
          .addAggregate('flight_count')
          .addWhere('carrier', 'WN, AA');
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
                  kind: 'aggregate',
                  field: {
                    expression: {
                      kind: 'filtered_field',
                      field_reference: {name: 'flight_count'},
                      where: [
                        {
                          filter: {
                            kind: 'filter_string',
                            field_reference: {name: 'carrier'},
                            filter: 'WN, AA',
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
        malloy:
          'run: flights -> { aggregate: flight_count { where: carrier ~ f`WN, AA` } }',
      });
    });
  });
  test('add a where', () => {
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
      q.getOrAddDefaultSegment().addWhere('carrier', 'WN, AA');
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
                kind: 'where',
                filter: {
                  kind: 'filter_string',
                  field_reference: {name: 'carrier'},
                  filter: 'WN, AA',
                },
              },
            ],
          },
        },
      },
      malloy: 'run: flights -> { where: carrier ~ f`WN, AA` }',
    });
  });
  test('add a parsed where', () => {
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
      q.getOrAddDefaultSegment().addWhere('carrier', {
        kind: 'string',
        clauses: [{operator: '=', values: ['WN', 'AA']}],
      });
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
                kind: 'where',
                filter: {
                  kind: 'filter_string',
                  field_reference: {name: 'carrier'},
                  filter: 'WN, AA',
                },
              },
            ],
          },
        },
      },
      malloy: 'run: flights -> { where: carrier ~ f`WN, AA` }',
    });
  });
  test('add some parsed wheres with different quote requirements', () => {
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
      const segment = q.getOrAddDefaultSegment();
      function add(str: string) {
        segment.addWhere('carrier', {
          kind: 'string',
          clauses: [{operator: '=', values: [str]}],
        });
      }
      add("'");
      add('\'"');
      add('`');
      add("`'");
      add('`\'"');
      add("`'\"\"\"'''");
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
                kind: 'where',
                filter: {
                  kind: 'filter_string',
                  field_reference: {name: 'carrier'},
                  filter: "'",
                },
              },
              {
                kind: 'where',
                filter: {
                  kind: 'filter_string',
                  field_reference: {name: 'carrier'},
                  filter: '\'"',
                },
              },
              {
                kind: 'where',
                filter: {
                  kind: 'filter_string',
                  field_reference: {name: 'carrier'},
                  filter: '`',
                },
              },
              {
                kind: 'where',
                filter: {
                  kind: 'filter_string',
                  field_reference: {name: 'carrier'},
                  filter: "`'",
                },
              },
              {
                kind: 'where',
                filter: {
                  kind: 'filter_string',
                  field_reference: {name: 'carrier'},
                  filter: '`\'"',
                },
              },
              {
                kind: 'where',
                filter: {
                  kind: 'filter_string',
                  field_reference: {name: 'carrier'},
                  filter: "`'\"\"\"'''",
                },
              },
            ],
          },
        },
      },
      malloy: dedent`
      run: flights -> {
        where:
          carrier ~ f\`'\`
          carrier ~ f\`'"\`
          carrier ~ f'\`'
          carrier ~ f"\`'"
          carrier ~ f\`\\\`"\`
          carrier ~ f\`\\\`"""'''\`
      }`,
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
      malloy: dedent`
        run: flights -> {
          group_by:
            carrier
            origin_code
        }`,
    });
  });
  test('reorder fields', () => {
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
    };
    expect((q: ASTQuery) => {
      const seg = q.getOrAddDefaultSegment();
      seg.reorderFields(['origin_code', 'carrier']);
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
                    name: 'origin_code',
                  },
                },
              },
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
      malloy: dedent`
        run: flights -> {
          group_by:
            origin_code
            carrier
        }`,
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
  test('reorder fields in a view reference', () => {
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
      q.reorderFields(['flight_count', 'dep_month']);
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
      malloy: dedent`
        # field_order = [flight_count, dep_month]
        run: flights -> by_month
      `,
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
  describe('add order by', () => {
    test('add an order by to a complex refinement', () => {
      const from: Malloy.Query = {
        definition: {
          kind: 'arrow',
          source_reference: {
            name: 'flights',
          },
          view: {
            kind: 'refinement',
            base: {
              kind: 'view_reference',
              name: 'top_carriers',
            },
            refinement: {
              kind: 'segment',
              operations: [
                {
                  kind: 'group_by',
                  field: {
                    expression: {
                      kind: 'field_reference',
                      name: 'carrier',
                      path: [],
                    },
                  },
                },
                {
                  kind: 'nest',
                  name: 'by_month',
                  view: {
                    definition: {
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
              ],
            },
          },
        },
      };
      expect((q: ASTQuery) => {
        q.getOrAddDefaultSegment().addOrderBy('carrier');
      }).toModifyQuery({
        model: flights_model,
        from,
        to: {
          definition: {
            kind: 'arrow',
            source_reference: {
              name: 'flights',
            },
            view: {
              kind: 'refinement',
              base: {
                kind: 'view_reference',
                name: 'top_carriers',
              },
              refinement: {
                kind: 'segment',
                operations: [
                  {
                    kind: 'group_by',
                    field: {
                      expression: {
                        kind: 'field_reference',
                        name: 'carrier',
                        path: [],
                      },
                    },
                  },
                  {
                    kind: 'nest',
                    name: 'by_month',
                    view: {
                      definition: {
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
                  {
                    kind: 'order_by',
                    field_reference: {
                      name: 'carrier',
                    },
                  },
                ],
              },
            },
          },
        },
        malloy: dedent`
          run: flights -> top_carriers + {
            group_by: carrier
            nest: by_month is by_month + { }
            order_by: carrier
          }
        `,
      });
    });
    test('add an order by in a refinement', () => {
      let orderBy: ASTOrderByViewOperation | undefined;
      const from: Malloy.Query = {
        definition: {
          kind: 'arrow',
          source_reference: {name: 'flights'},
          view: {
            kind: 'view_reference',
            name: 'by_month',
          },
        },
      };
      expect((q: ASTQuery) => {
        orderBy = q.getOrAddDefaultSegment().addOrderBy('dep_month', 'asc');
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
                    kind: 'order_by',
                    field_reference: {name: 'dep_month'},
                    direction: 'asc',
                  },
                ],
              },
            },
          },
        },
        malloy: 'run: flights -> by_month + { order_by: dep_month asc }',
      });
      expect(orderBy?.fieldReference.getFieldInfo()).toMatchObject({
        'kind': 'dimension',
        'name': 'dep_month',
      });
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
      q.definition.as
        .ArrowQueryDefinition()
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
  describe('tags', () => {
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
                    annotations: [{value: '# a.b.c = 10\n'}],
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
        malloy: dedent`
          run: flights -> {
            # a.b.c = 10
            group_by: carrier
          }`,
      });
    });
    test('add tag to query', () => {
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
        q.setTagProperty(['a'], 'foo');
      }).toModifyQuery({
        model: flights_model,
        from,
        to: {
          definition: {
            kind: 'arrow',
            source_reference: {name: 'flights'},
            view: {
              kind: 'segment',
              operations: [],
            },
          },
          annotations: [{value: '# a = foo\n'}],
        },
        malloy: dedent`
          # a = foo
          run: flights -> { }
        `,
      });
    });
    test('clear an inherited tag', () => {
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
        q.getOrAddDefaultSegment()
          .addGroupBy('carrier')
          .removeTagProperty(['a']);
      }).toModifyQuery({
        source: {
          name: 'flights',
          schema: {
            fields: [
              {
                kind: 'dimension',
                name: 'carrier',
                type: {kind: 'string_type'},
                annotations: [{value: '# a\n'}],
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
              kind: 'segment',
              operations: [
                {
                  kind: 'group_by',
                  field: {
                    annotations: [{value: '# -a\n'}],
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
        malloy: dedent`
          run: flights -> {
            # -a
            group_by: carrier
          }`,
      });
    });
  });
  test('rename a group by', () => {
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
            {
              kind: 'order_by',
              field_reference: {name: 'carrier'},
            },
          ],
        },
      },
    };
    expect((q: ASTQuery) => {
      q.getOrAddDefaultSegment().getGroupBy('carrier')!.rename('carrier_2');
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
                name: 'carrier_2',
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
                  name: 'carrier_2',
                },
              },
            ],
          },
        },
      },
      malloy: `run: flights -> {
  group_by: carrier_2 is carrier
  order_by: carrier_2
}`,
    });
  });
  test('rename a group by should change order by in refinement', () => {
    const from: Malloy.Query = {
      definition: {
        kind: 'arrow',
        source_reference: {name: 'flights'},
        view: {
          kind: 'refinement',
          base: {
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
          refinement: {
            kind: 'segment',
            operations: [
              {
                kind: 'order_by',
                field_reference: {name: 'carrier'},
              },
            ],
          },
        },
      },
    };
    expect((q: ASTQuery) => {
      const segment = q.definition.as
        .ArrowQueryDefinition()
        .view.as.RefinementViewDefinition()
        .base.as.SegmentViewDefinition();
      segment.getGroupBy('carrier')!.rename('carrier_2');
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
              kind: 'segment',
              operations: [
                {
                  kind: 'group_by',
                  name: 'carrier_2',
                  field: {
                    expression: {
                      kind: 'field_reference',
                      name: 'carrier',
                    },
                  },
                },
              ],
            },
            refinement: {
              kind: 'segment',
              operations: [
                {
                  kind: 'order_by',
                  field_reference: {name: 'carrier_2'},
                },
              ],
            },
          },
        },
      },
      malloy:
        'run: flights -> { group_by: carrier_2 is carrier } + { order_by: carrier_2 }',
    });
  });
  test('deleting a group by should delete order by in refinement', () => {
    const from: Malloy.Query = {
      definition: {
        kind: 'arrow',
        source_reference: {name: 'flights'},
        view: {
          kind: 'refinement',
          base: {
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
          refinement: {
            kind: 'segment',
            operations: [
              {
                kind: 'order_by',
                field_reference: {name: 'carrier'},
              },
            ],
          },
        },
      },
    };
    expect((q: ASTQuery) => {
      const segment = q.definition.as
        .ArrowQueryDefinition()
        .view.as.RefinementViewDefinition()
        .base.as.SegmentViewDefinition();
      segment.getGroupBy('carrier')!.delete();
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
              kind: 'segment',
              operations: [],
            },
            refinement: {
              kind: 'segment',
              operations: [],
            },
          },
        },
      },
      malloy: 'run: flights -> { } + { }',
    });
  });
  test.skip('deleting a group by should remove a group by in subsequent stage', () => {
    const from: Malloy.Query = {
      definition: {
        kind: 'arrow',
        source_reference: {name: 'flights'},
        view: {
          kind: 'arrow',
          source: {
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
    };
    expect((q: ASTQuery) => {
      const segment = q.definition.as
        .ArrowQueryDefinition()
        .view.as.ArrowViewDefinition()
        .source.as.SegmentViewDefinition();
      segment.getGroupBy('carrier')!.delete();
    }).toModifyQuery({
      model: flights_model,
      from,
      to: {
        definition: {
          kind: 'arrow',
          source_reference: {name: 'flights'},
          view: {
            kind: 'arrow',
            source: {
              kind: 'segment',
              operations: [],
            },
            view: {
              kind: 'segment',
              operations: [],
            },
          },
        },
      },
      malloy: 'run: flights -> { } -> { }',
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
  describe('parameters', () => {
    test('add parameters of different types', () => {
      const from: Malloy.Query = {
        definition: {
          kind: 'arrow',
          source_reference: {name: 'foo'},
          view: {
            kind: 'segment',
            operations: [],
          },
        },
      };
      expect((q: ASTQuery) => {
        const source = q.definition.as.ArrowQueryDefinition().sourceReference;
        source.setParameter('string_param', 'COOL');
        source.setParameter('number_param', 7);
        source.setParameter('boolean_param', true);
        source.setParameter('date_param', {
          // TODO what am I supposed to do about timezones?
          date: new Date('2020-01-01 10:00:00+00:00'),
          granularity: 'month',
        });
        source.setParameter('timestamp_param', {
          date: new Date('2020-01-01 10:00:00+00:00'),
          granularity: 'minute',
        });
        source.setParameter('null_param', null);
      }).toModifyQuery({
        source: {
          name: 'foo',
          schema: {fields: []},
          parameters: [
            {
              name: 'string_param',
              type: {kind: 'string_type'},
            },
            {
              name: 'number_param',
              type: {kind: 'number_type'},
            },
            {
              name: 'boolean_param',
              type: {kind: 'boolean_type'},
            },
            {
              name: 'date_param',
              type: {kind: 'date_type'},
            },
            {
              name: 'timestamp_param',
              type: {kind: 'timestamp_type'},
            },
            {
              name: 'null_param',
              type: {kind: 'string_type'},
            },
          ],
        },
        from,
        to: {
          definition: {
            kind: 'arrow',
            source_reference: {
              name: 'foo',
              parameters: [
                {
                  name: 'string_param',
                  value: {kind: 'string_literal', string_value: 'COOL'},
                },
                {
                  name: 'number_param',
                  value: {kind: 'number_literal', number_value: 7},
                },
                {
                  name: 'boolean_param',
                  value: {kind: 'boolean_literal', boolean_value: true},
                },
                {
                  name: 'date_param',
                  value: {
                    kind: 'date_literal',
                    date_value: '2020-01-01 10:00:00',
                    granularity: 'month',
                  },
                },
                {
                  name: 'timestamp_param',
                  value: {
                    kind: 'timestamp_literal',
                    timestamp_value: '2020-01-01 10:00:00',
                    granularity: 'minute',
                  },
                },
                {
                  name: 'null_param',
                  value: {kind: 'null_literal'},
                },
              ],
            },
            view: {
              kind: 'segment',
              operations: [],
            },
          },
        },
        malloy: dedent`
          run: foo(
            string_param is "COOL",
            number_param is 7,
            boolean_param is true,
            date_param is @2020-01,
            timestamp_param is @2020-01-01 18:00,
            null_param is null
          ) -> { }
        `,
      });
    });
  });
});
