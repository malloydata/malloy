/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type * as Malloy from '@malloydata/malloy-interfaces';
import {flights_model} from './flights_model';
import './expects';
import type {
  ASTAggregateViewOperation,
  ASTArrowQueryDefinition,
  ASTOrderByViewOperation,
} from './query-ast';
import {ASTQuery} from './query-ast';

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
        source: {
          kind: 'source_reference',
          name: 'flights',
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
    };
    expect((q: ASTQuery) => {
      q.getOrAddDefaultSegment().addOrderBy('carrier', 'asc');
    }).toModifyQuery({
      model: flights_model,
      from,
      to: {
        definition: {
          kind: 'arrow',
          source: {
            kind: 'source_reference',
            name: 'flights',
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
        source: {
          kind: 'source_reference',
          name: 'flights',
        },
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
          source: {
            kind: 'source_reference',
            name: 'flights',
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
      malloy: 'run: flights -> { group_by: carrier }',
    });
  });
  test('add a group by with a new name', () => {
    const from: Malloy.Query = {
      definition: {
        kind: 'arrow',
        source: {
          kind: 'source_reference',
          name: 'flights',
        },
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
          source: {
            kind: 'source_reference',
            name: 'flights',
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
        source: {
          kind: 'source_reference',
          name: 'flights',
        },
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
          source: {
            kind: 'source_reference',
            name: 'flights',
          },
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
          source: {
            kind: 'source_reference',
            name: 'flights',
          },
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
            source: {
              kind: 'source_reference',
              name: 'flights',
            },
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
          source: {
            kind: 'source_reference',
            name: 'flights',
          },
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
            source: {
              kind: 'source_reference',
              name: 'flights',
            },
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
                            expression: {
                              kind: 'field_reference',
                              name: 'carrier',
                            },
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
        source: {
          kind: 'source_reference',
          name: 'flights',
        },
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
          source: {
            kind: 'source_reference',
            name: 'flights',
          },
          view: {
            kind: 'segment',
            operations: [
              {
                kind: 'where',
                filter: {
                  kind: 'filter_string',
                  expression: {
                    kind: 'field_reference',
                    name: 'carrier',
                  },
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
  test('add a where with a path', () => {
    const from: Malloy.Query = {
      definition: {
        kind: 'arrow',
        source: {
          kind: 'source_reference',
          name: 'flights',
        },
        view: {
          kind: 'segment',
          operations: [],
        },
      },
    };
    expect((q: ASTQuery) => {
      q.getOrAddDefaultSegment().addWhere('state', ['origin'], 'TX');
    }).toModifyQuery({
      model: flights_model,
      from,
      to: {
        definition: {
          kind: 'arrow',
          source: {
            kind: 'source_reference',
            name: 'flights',
          },
          view: {
            kind: 'segment',
            operations: [
              {
                kind: 'where',
                filter: {
                  kind: 'filter_string',
                  expression: {
                    kind: 'field_reference',
                    name: 'state',
                    path: ['origin'],
                  },
                  filter: 'TX',
                },
              },
            ],
          },
        },
      },
      malloy: 'run: flights -> { where: origin.state ~ f`TX` }',
    });
  });
  test('add a parsed where', () => {
    const from: Malloy.Query = {
      definition: {
        kind: 'arrow',
        source: {
          kind: 'source_reference',
          name: 'flights',
        },
        view: {
          kind: 'segment',
          operations: [],
        },
      },
    };
    expect((q: ASTQuery) => {
      q.getOrAddDefaultSegment().addWhere('carrier', {
        kind: 'string',
        parsed: {operator: '=', values: ['WN', 'AA']},
      });
    }).toModifyQuery({
      model: flights_model,
      from,
      to: {
        definition: {
          kind: 'arrow',
          source: {
            kind: 'source_reference',
            name: 'flights',
          },
          view: {
            kind: 'segment',
            operations: [
              {
                kind: 'where',
                filter: {
                  kind: 'filter_string',
                  expression: {
                    kind: 'field_reference',
                    name: 'carrier',
                  },
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
        source: {
          kind: 'source_reference',
          name: 'flights',
        },
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
          parsed: {operator: '=', values: [str]},
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
          source: {
            kind: 'source_reference',
            name: 'flights',
          },
          view: {
            kind: 'segment',
            operations: [
              {
                kind: 'where',
                filter: {
                  kind: 'filter_string',
                  expression: {
                    kind: 'field_reference',
                    name: 'carrier',
                  },
                  filter: "'",
                },
              },
              {
                kind: 'where',
                filter: {
                  kind: 'filter_string',
                  expression: {
                    kind: 'field_reference',
                    name: 'carrier',
                  },
                  filter: '\'"',
                },
              },
              {
                kind: 'where',
                filter: {
                  kind: 'filter_string',
                  expression: {
                    kind: 'field_reference',
                    name: 'carrier',
                  },
                  filter: '`',
                },
              },
              {
                kind: 'where',
                filter: {
                  kind: 'filter_string',
                  expression: {
                    kind: 'field_reference',
                    name: 'carrier',
                  },
                  filter: "`'",
                },
              },
              {
                kind: 'where',
                filter: {
                  kind: 'filter_string',
                  expression: {
                    kind: 'field_reference',
                    name: 'carrier',
                  },
                  filter: '`\'"',
                },
              },
              {
                kind: 'where',
                filter: {
                  kind: 'filter_string',
                  expression: {
                    kind: 'field_reference',
                    name: 'carrier',
                  },
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
          carrier ~ f\`'\`,
          carrier ~ f\`'"\`,
          carrier ~ f'\`',
          carrier ~ f"\`'",
          carrier ~ f\`\\\`"\`,
          carrier ~ f\`\\\`"""'''\`
      }`,
    });
  });
  describe('addWhere with conjunction', () => {
    test('add multiple wheres with AND conjunction', () => {
      const from: Malloy.Query = {
        definition: {
          kind: 'arrow',
          source: {
            kind: 'source_reference',
            name: 'flights',
          },
          view: {
            kind: 'segment',
            operations: [],
          },
        },
      };
      expect((q: ASTQuery) => {
        const segment = q.getOrAddDefaultSegment();
        segment.addWhere('carrier', 'WN');
        segment.addWhere('carrier', 'AA', 'and');
      }).toModifyQuery({
        model: flights_model,
        from,
        to: {
          definition: {
            kind: 'arrow',
            source: {
              kind: 'source_reference',
              name: 'flights',
            },
            view: {
              kind: 'segment',
              operations: [
                {
                  kind: 'where',
                  filter: {
                    kind: 'filter_string',
                    expression: {
                      kind: 'field_reference',
                      name: 'carrier',
                    },
                    filter: 'WN',
                  },
                },
                {
                  kind: 'where',
                  filter: {
                    kind: 'filter_string',
                    expression: {
                      kind: 'field_reference',
                      name: 'carrier',
                    },
                    filter: 'AA',
                  },
                  conjunction: 'and',
                },
              ],
            },
          },
        },
        malloy: dedent`
          run: flights -> {
            where:
              carrier ~ f\`WN\`
              and carrier ~ f\`AA\`
          }`,
      });
    });
    test('add multiple wheres with OR conjunction', () => {
      const from: Malloy.Query = {
        definition: {
          kind: 'arrow',
          source: {
            kind: 'source_reference',
            name: 'flights',
          },
          view: {
            kind: 'segment',
            operations: [],
          },
        },
      };
      expect((q: ASTQuery) => {
        const segment = q.getOrAddDefaultSegment();
        segment.addWhere('carrier', 'WN');
        segment.addWhere('carrier', 'AA', 'or');
      }).toModifyQuery({
        model: flights_model,
        from,
        to: {
          definition: {
            kind: 'arrow',
            source: {
              kind: 'source_reference',
              name: 'flights',
            },
            view: {
              kind: 'segment',
              operations: [
                {
                  kind: 'where',
                  filter: {
                    kind: 'filter_string',
                    expression: {
                      kind: 'field_reference',
                      name: 'carrier',
                    },
                    filter: 'WN',
                  },
                },
                {
                  kind: 'where',
                  filter: {
                    kind: 'filter_string',
                    expression: {
                      kind: 'field_reference',
                      name: 'carrier',
                    },
                    filter: 'AA',
                  },
                  conjunction: 'or',
                },
              ],
            },
          },
        },
        malloy: dedent`
          run: flights -> {
            where:
              carrier ~ f\`WN\`
              or carrier ~ f\`AA\`
          }`,
      });
    });
    test('add multiple wheres with mixed AND and OR conjunctions', () => {
      const from: Malloy.Query = {
        definition: {
          kind: 'arrow',
          source: {
            kind: 'source_reference',
            name: 'flights',
          },
          view: {
            kind: 'segment',
            operations: [],
          },
        },
      };
      expect((q: ASTQuery) => {
        const segment = q.getOrAddDefaultSegment();
        segment.addWhere('carrier', 'WN');
        segment.addWhere('carrier', 'AA', 'and');
        segment.addWhere('carrier', 'DL', 'or');
      }).toModifyQuery({
        model: flights_model,
        from,
        to: {
          definition: {
            kind: 'arrow',
            source: {
              kind: 'source_reference',
              name: 'flights',
            },
            view: {
              kind: 'segment',
              operations: [
                {
                  kind: 'where',
                  filter: {
                    kind: 'filter_string',
                    expression: {
                      kind: 'field_reference',
                      name: 'carrier',
                    },
                    filter: 'WN',
                  },
                },
                {
                  kind: 'where',
                  filter: {
                    kind: 'filter_string',
                    expression: {
                      kind: 'field_reference',
                      name: 'carrier',
                    },
                    filter: 'AA',
                  },
                  conjunction: 'and',
                },
                {
                  kind: 'where',
                  filter: {
                    kind: 'filter_string',
                    expression: {
                      kind: 'field_reference',
                      name: 'carrier',
                    },
                    filter: 'DL',
                  },
                  conjunction: 'or',
                },
              ],
            },
          },
        },
        malloy: dedent`
          run: flights -> {
            where:
              carrier ~ f\`WN\`
              and carrier ~ f\`AA\`
              or carrier ~ f\`DL\`
          }`,
      });
    });
    test('add where with path and AND conjunction', () => {
      const from: Malloy.Query = {
        definition: {
          kind: 'arrow',
          source: {
            kind: 'source_reference',
            name: 'flights',
          },
          view: {
            kind: 'segment',
            operations: [],
          },
        },
      };
      expect((q: ASTQuery) => {
        const segment = q.getOrAddDefaultSegment();
        segment.addWhere('state', ['origin'], 'TX');
        segment.addWhere('state', ['origin'], 'CA', 'and');
      }).toModifyQuery({
        model: flights_model,
        from,
        to: {
          definition: {
            kind: 'arrow',
            source: {
              kind: 'source_reference',
              name: 'flights',
            },
            view: {
              kind: 'segment',
              operations: [
                {
                  kind: 'where',
                  filter: {
                    kind: 'filter_string',
                    expression: {
                      kind: 'field_reference',
                      name: 'state',
                      path: ['origin'],
                    },
                    filter: 'TX',
                  },
                },
                {
                  kind: 'where',
                  filter: {
                    kind: 'filter_string',
                    expression: {
                      kind: 'field_reference',
                      name: 'state',
                      path: ['origin'],
                    },
                    filter: 'CA',
                  },
                  conjunction: 'and',
                },
              ],
            },
          },
        },
        malloy: dedent`
          run: flights -> {
            where:
              origin.state ~ f\`TX\`
              and origin.state ~ f\`CA\`
          }`,
      });
    });
    test('add where with ParsedFilter and AND conjunction', () => {
      const from: Malloy.Query = {
        definition: {
          kind: 'arrow',
          source: {
            kind: 'source_reference',
            name: 'flights',
          },
          view: {
            kind: 'segment',
            operations: [],
          },
        },
      };
      expect((q: ASTQuery) => {
        const segment = q.getOrAddDefaultSegment();
        segment.addWhere('carrier', {
          kind: 'string',
          parsed: {operator: '=', values: ['WN']},
        });
        segment.addWhere(
          'carrier',
          {
            kind: 'string',
            parsed: {operator: '=', values: ['AA']},
          },
          'and'
        );
      }).toModifyQuery({
        model: flights_model,
        from,
        to: {
          definition: {
            kind: 'arrow',
            source: {
              kind: 'source_reference',
              name: 'flights',
            },
            view: {
              kind: 'segment',
              operations: [
                {
                  kind: 'where',
                  filter: {
                    kind: 'filter_string',
                    expression: {
                      kind: 'field_reference',
                      name: 'carrier',
                    },
                    filter: 'WN',
                  },
                },
                {
                  kind: 'where',
                  filter: {
                    kind: 'filter_string',
                    expression: {
                      kind: 'field_reference',
                      name: 'carrier',
                    },
                    filter: 'AA',
                  },
                  conjunction: 'and',
                },
              ],
            },
          },
        },
        malloy: dedent`
          run: flights -> {
            where:
              carrier ~ f\`WN\`
              and carrier ~ f\`AA\`
          }`,
      });
    });
    test('first where with conjunction should ignore conjunction (no previous filter)', () => {
      const from: Malloy.Query = {
        definition: {
          kind: 'arrow',
          source: {
            kind: 'source_reference',
            name: 'flights',
          },
          view: {
            kind: 'segment',
            operations: [],
          },
        },
      };
      expect((q: ASTQuery) => {
        q.getOrAddDefaultSegment().addWhere('carrier', 'WN', 'and');
      }).toModifyQuery({
        model: flights_model,
        from,
        to: {
          definition: {
            kind: 'arrow',
            source: {
              kind: 'source_reference',
              name: 'flights',
            },
            view: {
              kind: 'segment',
              operations: [
                {
                  kind: 'where',
                  filter: {
                    kind: 'filter_string',
                    expression: {
                      kind: 'field_reference',
                      name: 'carrier',
                    },
                    filter: 'WN',
                  },
                  conjunction: 'and',
                },
              ],
            },
          },
        },
        malloy: 'run: flights -> { where: carrier ~ f`WN` }',
      });
    });
    test('default conjunction (no parameter) uses comma separator', () => {
      const from: Malloy.Query = {
        definition: {
          kind: 'arrow',
          source: {
            kind: 'source_reference',
            name: 'flights',
          },
          view: {
            kind: 'segment',
            operations: [],
          },
        },
      };
      expect((q: ASTQuery) => {
        const segment = q.getOrAddDefaultSegment();
        segment.addWhere('carrier', 'WN');
        segment.addWhere('carrier', 'AA');
      }).toModifyQuery({
        model: flights_model,
        from,
        to: {
          definition: {
            kind: 'arrow',
            source: {
              kind: 'source_reference',
              name: 'flights',
            },
            view: {
              kind: 'segment',
              operations: [
                {
                  kind: 'where',
                  filter: {
                    kind: 'filter_string',
                    expression: {
                      kind: 'field_reference',
                      name: 'carrier',
                    },
                    filter: 'WN',
                  },
                },
                {
                  kind: 'where',
                  filter: {
                    kind: 'filter_string',
                    expression: {
                      kind: 'field_reference',
                      name: 'carrier',
                    },
                    filter: 'AA',
                  },
                },
              ],
            },
          },
        },
        malloy: dedent`
          run: flights -> {
            where:
              carrier ~ f\`WN\`,
              carrier ~ f\`AA\`
          }`,
      });
    });
  });
  describe('addHaving with conjunction', () => {
    test('add multiple havings with AND conjunction', () => {
      const model: Malloy.ModelInfo = {
        entries: [
          {
            kind: 'source',
            name: 'flights',
            schema: {
              fields: [
                {
                  kind: 'measure',
                  name: 'flight_count',
                  type: {kind: 'number_type'},
                },
                {
                  kind: 'measure',
                  name: 'total_distance',
                  type: {kind: 'number_type'},
                },
              ],
            },
          },
        ],
        anonymous_queries: [],
      };
      const from: Malloy.Query = {
        definition: {
          kind: 'arrow',
          source: {
            kind: 'source_reference',
            name: 'flights',
          },
          view: {
            kind: 'segment',
            operations: [],
          },
        },
      };
      expect((q: ASTQuery) => {
        const segment = q.getOrAddDefaultSegment();
        segment.addHaving('flight_count', '> 100');
        segment.addHaving('total_distance', '> 1000', 'and');
      }).toModifyQuery({
        model,
        from,
        to: {
          definition: {
            kind: 'arrow',
            source: {
              kind: 'source_reference',
              name: 'flights',
            },
            view: {
              kind: 'segment',
              operations: [
                {
                  kind: 'having',
                  filter: {
                    kind: 'filter_string',
                    expression: {
                      kind: 'field_reference',
                      name: 'flight_count',
                    },
                    filter: '> 100',
                  },
                },
                {
                  kind: 'having',
                  filter: {
                    kind: 'filter_string',
                    expression: {
                      kind: 'field_reference',
                      name: 'total_distance',
                    },
                    filter: '> 1000',
                  },
                  conjunction: 'and',
                },
              ],
            },
          },
        },
        malloy: dedent`
          run: flights -> {
            having:
              flight_count ~ f\`> 100\`
              and total_distance ~ f\`> 1000\`
          }`,
      });
    });
    test('add multiple havings with OR conjunction', () => {
      const model: Malloy.ModelInfo = {
        entries: [
          {
            kind: 'source',
            name: 'flights',
            schema: {
              fields: [
                {
                  kind: 'measure',
                  name: 'flight_count',
                  type: {kind: 'number_type'},
                },
                {
                  kind: 'measure',
                  name: 'total_distance',
                  type: {kind: 'number_type'},
                },
              ],
            },
          },
        ],
        anonymous_queries: [],
      };
      const from: Malloy.Query = {
        definition: {
          kind: 'arrow',
          source: {
            kind: 'source_reference',
            name: 'flights',
          },
          view: {
            kind: 'segment',
            operations: [],
          },
        },
      };
      expect((q: ASTQuery) => {
        const segment = q.getOrAddDefaultSegment();
        segment.addHaving('flight_count', '> 100');
        segment.addHaving('total_distance', '> 1000', 'or');
      }).toModifyQuery({
        model,
        from,
        to: {
          definition: {
            kind: 'arrow',
            source: {
              kind: 'source_reference',
              name: 'flights',
            },
            view: {
              kind: 'segment',
              operations: [
                {
                  kind: 'having',
                  filter: {
                    kind: 'filter_string',
                    expression: {
                      kind: 'field_reference',
                      name: 'flight_count',
                    },
                    filter: '> 100',
                  },
                },
                {
                  kind: 'having',
                  filter: {
                    kind: 'filter_string',
                    expression: {
                      kind: 'field_reference',
                      name: 'total_distance',
                    },
                    filter: '> 1000',
                  },
                  conjunction: 'or',
                },
              ],
            },
          },
        },
        malloy: dedent`
          run: flights -> {
            having:
              flight_count ~ f\`> 100\`
              or total_distance ~ f\`> 1000\`
          }`,
      });
    });
  });
  test('add some drills', () => {
    const from: Malloy.Query = {
      definition: {
        kind: 'arrow',
        source: {
          kind: 'source_reference',
          name: 'flights',
        },
        view: {
          kind: 'segment',
          operations: [],
        },
      },
    };
    expect((q: ASTQuery) => {
      const segment = q.getOrAddDefaultSegment();
      segment.addDrill({
        filter: {
          kind: 'filter_string',
          expression: {
            kind: 'field_reference',
            name: 'carrier',
          },
          filter: 'WN, AA',
        },
      });
      segment.addDrill({
        filter: {
          kind: 'literal_equality',
          expression: {
            kind: 'field_reference',
            name: 'nickname',
            path: ['top_carriers'],
          },
          value: {
            kind: 'string_literal',
            string_value: 'Southwest',
          },
        },
      });
    }).toModifyQuery({
      model: flights_model,
      from,
      to: {
        definition: {
          kind: 'arrow',
          source: {
            kind: 'source_reference',
            name: 'flights',
          },
          view: {
            kind: 'segment',
            operations: [
              {
                kind: 'drill',
                filter: {
                  kind: 'filter_string',
                  expression: {
                    kind: 'field_reference',
                    name: 'carrier',
                  },
                  filter: 'WN, AA',
                },
              },
              {
                kind: 'drill',
                filter: {
                  kind: 'literal_equality',
                  expression: {
                    kind: 'field_reference',
                    name: 'nickname',
                    path: ['top_carriers'],
                  },
                  value: {
                    kind: 'string_literal',
                    string_value: 'Southwest',
                  },
                },
              },
            ],
          },
        },
      },
      malloy: dedent`
        run: flights -> {
          drill:
            carrier ~ f\`WN, AA\`,
            top_carriers.nickname = "Southwest"
        }
      `,
    });
  });
  test('can get drill field info', () => {
    const from: Malloy.Query = {
      definition: {
        kind: 'arrow',
        source: {
          kind: 'source_reference',
          name: 'flights',
        },
        view: {
          kind: 'segment',
          operations: [],
        },
      },
    };
    const q = new ASTQuery({model: flights_model, query: from});
    const segment = q.getOrAddDefaultSegment();
    const drill = segment.addDrill({
      filter: {
        kind: 'literal_equality',
        expression: {
          kind: 'field_reference',
          name: 'nickname',
          path: ['top_carriers'],
        },
        value: {
          kind: 'string_literal',
          string_value: 'Southwest',
        },
      },
    });
    expect(drill.filter.expression.getFieldInfo()).toMatchObject({
      kind: 'dimension',
      type: {kind: 'string_type'},
    });
  });
  test('add a having', () => {
    const from: Malloy.Query = {
      definition: {
        kind: 'arrow',
        source: {
          kind: 'source_reference',
          name: 'flights',
        },
        view: {
          kind: 'segment',
          operations: [],
        },
      },
    };
    expect((q: ASTQuery) => {
      q.getOrAddDefaultSegment().addHaving('flight_count', '>100');
    }).toModifyQuery({
      model: flights_model,
      from,
      to: {
        definition: {
          kind: 'arrow',
          source: {
            kind: 'source_reference',
            name: 'flights',
          },
          view: {
            kind: 'segment',
            operations: [
              {
                kind: 'having',
                filter: {
                  kind: 'filter_string',
                  expression: {
                    kind: 'field_reference',
                    name: 'flight_count',
                  },
                  filter: '>100',
                },
              },
            ],
          },
        },
      },
      malloy: 'run: flights -> { having: flight_count ~ f`>100` }',
    });
  });
  test('add a calculate moving average', () => {
    const from: Malloy.Query = {
      definition: {
        kind: 'arrow',
        source: {
          kind: 'source_reference',
          name: 'flights',
        },
        view: {
          kind: 'segment',
          operations: [],
        },
      },
    };
    expect((q: ASTQuery) => {
      q.getOrAddDefaultSegment().addCalculateMovingAverage(
        'flight_count_smoothed',
        'flight_count',
        [],
        7,
        0
      );
    }).toModifyQuery({
      model: flights_model,
      from,
      to: {
        definition: {
          kind: 'arrow',
          source: {
            kind: 'source_reference',
            name: 'flights',
          },
          view: {
            kind: 'segment',
            operations: [
              {
                kind: 'calculate',
                name: 'flight_count_smoothed',
                field: {
                  expression: {
                    kind: 'moving_average',
                    field_reference: {
                      name: 'flight_count',
                      path: [],
                    },
                    rows_preceding: 7,
                    rows_following: 0,
                  },
                },
              },
            ],
          },
        },
      },
      malloy:
        'run: flights -> { calculate: flight_count_smoothed is avg_moving(flight_count, 7, 0) }',
    });
  });
  test('convert an aggregate to a moving average', () => {
    const from: Malloy.Query = {
      definition: {
        kind: 'arrow',
        source: {
          kind: 'source_reference',
          name: 'flights',
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
            {
              kind: 'aggregate',
              field: {
                expression: {
                  kind: 'field_reference',
                  name: 'flight_count',
                  path: [],
                },
              },
            },
          ],
        },
      },
    };
    expect((q: ASTArrowQueryDefinition) => {
      const segment = q.getOrAddDefaultSegment();
      const aggregateOperation = segment.operations.index(
        1
      ) as ASTAggregateViewOperation;
      aggregateOperation.convertToCalculateMovingAverage(
        'flight_count_7d',
        7,
        0,
        ['carrier']
      );
    }).toModifyQuery({
      model: flights_model,
      from,
      to: {
        definition: {
          kind: 'arrow',
          source: {
            kind: 'source_reference',
            name: 'flights',
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
              {
                kind: 'calculate',
                name: 'flight_count_7d',
                field: {
                  expression: {
                    kind: 'moving_average',
                    field_reference: {
                      name: 'flight_count',
                      path: [],
                    },
                    rows_preceding: 7,
                    rows_following: 0,
                    partition_fields: [
                      {
                        name: 'carrier',
                      },
                    ],
                  },
                },
              },
            ],
          },
        },
      },
      malloy: `run: flights -> {
  group_by: carrier
  calculate: flight_count_7d is avg_moving(flight_count, 7, 0) { partition_by: carrier }
}`,
    });
  });
  test('add a date group by', () => {
    const from: Malloy.Query = {
      definition: {
        kind: 'arrow',
        source: {
          kind: 'source_reference',
          name: 'flights',
        },
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
          source: {
            kind: 'source_reference',
            name: 'flights',
          },
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
        source: {
          kind: 'source_reference',
          name: 'flights',
        },
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
          source: {
            kind: 'source_reference',
            name: 'flights',
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
        source: {
          kind: 'source_reference',
          name: 'flights',
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
          source: {
            kind: 'source_reference',
            name: 'flights',
          },
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
        source: {
          kind: 'source_reference',
          name: 'flights',
        },
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
          source: {
            kind: 'source_reference',
            name: 'flights',
          },
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
        source: {
          kind: 'source_reference',
          name: 'flights',
        },
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
          source: {
            kind: 'source_reference',
            name: 'flights',
          },
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
        source: {
          kind: 'source_reference',
          name: 'flights',
        },
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
          source: {
            kind: 'source_reference',
            name: 'flights',
          },
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
        source: {
          kind: 'source_reference',
          name: 'flights',
        },
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
          source: {
            kind: 'source_reference',
            name: 'flights',
          },
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
        source: {
          kind: 'source_reference',
          name: 'flights',
        },
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
          source: {
            kind: 'source_reference',
            name: 'flights',
          },
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
          source: {
            kind: 'source_reference',
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
            source: {
              kind: 'source_reference',
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
          source: {
            kind: 'source_reference',
            name: 'flights',
          },
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
            source: {
              kind: 'source_reference',
              name: 'flights',
            },
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
          source: {
            kind: 'source_reference',
            name: 'flights',
          },
          view: {
            kind: 'segment',
            operations: [],
          },
        },
      },
      to: {
        definition: {
          kind: 'arrow',
          source: {
            kind: 'source_reference',
            name: 'flights',
          },
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
        source: {
          kind: 'source_reference',
          name: 'flights',
        },
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
          source: {
            kind: 'source_reference',
            name: 'flights',
          },
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
        source: {
          kind: 'source_reference',
          name: 'flights',
        },
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
          source: {
            kind: 'source_reference',
            name: 'flights',
          },
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
        source: {
          kind: 'source_reference',
          name: 'flights',
        },
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
          source: {
            kind: 'source_reference',
            name: 'flights',
          },
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
          source: {
            kind: 'source_reference',
            name: 'flights',
          },
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
            source: {
              kind: 'source_reference',
              name: 'flights',
            },
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
    test('remove and add complex tag', () => {
      const from: Malloy.Query = {
        definition: {
          kind: 'arrow',
          source: {
            kind: 'source_reference',
            name: 'flights',
          },
          view: {
            kind: 'segment',
            operations: [
              {
                kind: 'group_by',
                field: {
                  expression: {
                    kind: 'field_reference',
                    name: 'test_field_with_annotations',
                  },
                },
              },
            ],
          },
        },
      };
      expect((q: ASTQuery) => {
        const gb = q
          .getOrAddDefaultSegment()
          .getGroupBy('test_field_with_annotations')!;
        gb.removeTagProperty(['line_chart']);
        gb.setTagProperty(['bar_chart']);
      }).toModifyQuery({
        model: flights_model,
        from,
        to: {
          definition: {
            kind: 'arrow',
            source: {
              kind: 'source_reference',
              name: 'flights',
            },
            view: {
              kind: 'segment',
              operations: [
                {
                  kind: 'group_by',
                  field: {
                    annotations: [{value: '# -line_chart bar_chart\n'}],
                    expression: {
                      kind: 'field_reference',
                      name: 'test_field_with_annotations',
                    },
                  },
                },
              ],
            },
          },
        },
        malloy: dedent`
          run: flights -> {
            # -line_chart bar_chart
            group_by: test_field_with_annotations
          }`,
      });
    });
    test('add tag to query', () => {
      const from: Malloy.Query = {
        definition: {
          kind: 'arrow',
          source: {
            kind: 'source_reference',
            name: 'flights',
          },
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
            source: {
              kind: 'source_reference',
              name: 'flights',
            },
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
    test('repeatedly add a tag property to a query', () => {
      const from: Malloy.Query = {
        definition: {
          kind: 'arrow',
          source: {
            kind: 'source_reference',
            name: 'flights',
          },
          view: {
            kind: 'segment',
            operations: [],
          },
        },
      };
      expect((q: ASTQuery) => {
        q.setTagProperty(['a']);
        q.setTagProperty(['b']);
      }).toModifyQuery({
        model: flights_model,
        from,
        to: {
          annotations: [{value: '# a b\n'}],
          definition: {
            kind: 'arrow',
            source: {
              kind: 'source_reference',
              name: 'flights',
            },
            view: {
              kind: 'segment',
              operations: [],
            },
          },
        },
        malloy: dedent`
          # a b
          run: flights -> { }
        `,
      });
    });

    test('remove then add a tag property to a query', () => {
      const from: Malloy.Query = {
        annotations: [{value: '# a\n'}],
        definition: {
          kind: 'arrow',
          source: {
            kind: 'source_reference',
            name: 'flights',
          },
          view: {
            kind: 'segment',
            operations: [],
          },
        },
      };
      expect((q: ASTQuery) => {
        q.removeTagProperty(['a']);
        q.setTagProperty(['b']);
      }).toModifyQuery({
        model: flights_model,
        from,
        to: {
          annotations: [{value: '# b\n'}],
          definition: {
            kind: 'arrow',
            source: {
              kind: 'source_reference',
              name: 'flights',
            },
            view: {
              kind: 'segment',
              operations: [],
            },
          },
        },
        malloy: dedent`
          # b
          run: flights -> { }
        `,
      });
    });

    test('clear an inherited tag', () => {
      const from: Malloy.Query = {
        definition: {
          kind: 'arrow',
          source: {
            kind: 'source_reference',
            name: 'flights',
          },
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
            source: {
              kind: 'source_reference',
              name: 'flights',
            },
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
        source: {
          kind: 'source_reference',
          name: 'flights',
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
          source: {
            kind: 'source_reference',
            name: 'flights',
          },
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
        source: {
          kind: 'source_reference',
          name: 'flights',
        },
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
          source: {
            kind: 'source_reference',
            name: 'flights',
          },
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
        source: {
          kind: 'source_reference',
          name: 'flights',
        },
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
          source: {
            kind: 'source_reference',
            name: 'flights',
          },
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
        source: {
          kind: 'source_reference',
          name: 'flights',
        },
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
          source: {
            kind: 'source_reference',
            name: 'flights',
          },
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
            source: {
              kind: 'source_reference',
              name: 'flights',
            },
            view: {
              kind: 'segment',
              operations: [],
            },
          },
        },
        to: {
          definition: {
            kind: 'arrow',
            source: {
              kind: 'source_reference',
              name: 'flights',
            },
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
            source: {
              kind: 'source_reference',
              name: 'flights',
            },
            view: {
              kind: 'view_reference',
              name: 'by_month',
            },
          },
        },
        to: {
          definition: {
            kind: 'arrow',
            source: {
              kind: 'source_reference',
              name: 'flights',
            },
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
            source: {
              kind: 'source_reference',
              name: 'flights',
            },
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
            source: {
              kind: 'source_reference',
              name: 'flights',
            },
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
            base: {
              kind: 'query_reference',
              name: 'flights_by_carrier',
            },
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
          source: {
            kind: 'source_reference',
            name: 'flights',
          },
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
          source: {
            kind: 'source_reference',
            name: 'flights',
          },
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
          source: {kind: 'source_reference', name: 'foo'},
          view: {
            kind: 'segment',
            operations: [],
          },
        },
      };
      expect((q: ASTQuery) => {
        const source = q.definition.as
          .ArrowQueryDefinition()
          .source.as.ReferenceQueryArrowSource();
        source.setParameter('string_param', 'COOL');
        source.setParameter('number_param', 7);
        source.setParameter('boolean_param', true);
        source.setParameter('date_param', {
          // TODO what am I supposed to do about timezones?
          date: new Date('2020-01-01 10:00:00+00:00'),
          granularity: 'month',
        });
        source.setParameter('short_date_param', {
          date: new Date('0123-01-01 10:00:00+00:00'),
          granularity: 'day',
        });
        source.setParameter('timestamp_param', {
          date: new Date('2020-01-01 10:00:00+00:00'),
          granularity: 'minute',
        });
        source.setParameter('filter_param', {
          kind: 'filter_expression_literal',
          filter_expression_value: '7 days',
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
              name: 'short_date_param',
              type: {kind: 'date_type'},
            },
            {
              name: 'timestamp_param',
              type: {kind: 'timestamp_type'},
            },
            {
              name: 'filter_param',
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
            source: {
              kind: 'source_reference',
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
                  name: 'short_date_param',
                  value: {
                    kind: 'date_literal',
                    date_value: '0123-01-01 10:00:00',
                    granularity: 'day',
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
                  name: 'filter_param',
                  value: {
                    kind: 'filter_expression_literal',
                    filter_expression_value: '7 days',
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
            short_date_param is @0123-01-01,
            timestamp_param is @2020-01-01 10:00,
            filter_param is f\`7 days\`,
            null_param is null
          ) -> { }
        `,
      });
    });
  });
  test('add parameter twice overrides', () => {
    const from: Malloy.Query = {
      definition: {
        kind: 'arrow',
        source: {kind: 'source_reference', name: 'foo'},
        view: {
          kind: 'segment',
          operations: [],
        },
      },
    };
    expect((q: ASTQuery) => {
      const source = q.definition.as
        .ArrowQueryDefinition()
        .source.as.ReferenceQueryArrowSource();
      source.setParameter('string_param', 'COOL');
      source.setParameter('string_param', 'COOLER');
    }).toModifyQuery({
      source: {
        name: 'foo',
        schema: {fields: []},
        parameters: [
          {
            name: 'string_param',
            type: {kind: 'string_type'},
          },
        ],
      },
      from,
      to: {
        definition: {
          kind: 'arrow',
          source: {
            kind: 'source_reference',
            name: 'foo',
            parameters: [
              {
                name: 'string_param',
                value: {kind: 'string_literal', string_value: 'COOLER'},
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
        run: foo(string_param is "COOLER") -> { }
      `,
    });
  });

  describe('isRunnable', () => {
    test('empty arrow segment is not runnable', () => {
      const from: Malloy.Query = {
        definition: {
          kind: 'arrow',
          source: {
            kind: 'source_reference',
            name: 'flights',
          },
          view: {
            kind: 'segment',
            operations: [
              {
                kind: 'nest',
                name: 'Nest',
                view: {
                  definition: {
                    kind: 'segment',
                    operations: [],
                  },
                },
              },
            ],
          },
        },
      };
      const query = new ASTQuery({
        query: from,
        source: flights_model.entries.at(-1) as Malloy.SourceInfo,
      });
      expect(query.isRunnable()).toBe(false);
    });
    test('view with refinement with no fields is runnable', () => {
      const from: Malloy.Query = {
        definition: {
          kind: 'arrow',
          source: {
            kind: 'source_reference',
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
                  kind: 'order_by',
                  field_reference: {
                    name: 'carrier',
                  },
                },
              ],
            },
          },
        },
      };
      const query = new ASTQuery({
        query: from,
        source: flights_model.entries.at(-1) as Malloy.SourceInfo,
      });
      expect(query.isRunnable()).toBe(true);
    });
    test('view with base as partial view and refinement with fields is runnable', () => {
      const from: Malloy.Query = {
        definition: {
          kind: 'arrow',
          source: {
            kind: 'source_reference',
            name: 'flights',
          },
          view: {
            kind: 'refinement',
            base: {
              kind: 'segment',
              operations: [
                {
                  kind: 'limit',
                  limit: 10,
                },
              ],
            },
            refinement: {
              kind: 'view_reference',
              name: 'top_carriers',
            },
          },
        },
      };
      const query = new ASTQuery({
        query: from,
        source: flights_model.entries.at(-1) as Malloy.SourceInfo,
      });
      expect(query.isRunnable()).toBe(true);
    });
    test('view refinement with no fields anywhere is not runnable', () => {
      const from: Malloy.Query = {
        definition: {
          kind: 'arrow',
          source: {
            kind: 'source_reference',
            name: 'flights',
          },
          view: {
            kind: 'refinement',
            base: {
              kind: 'segment',
              operations: [
                {
                  kind: 'limit',
                  limit: 10,
                },
              ],
            },
            refinement: {
              kind: 'segment',
              operations: [
                {
                  kind: 'limit',
                  limit: 2,
                },
              ],
            },
          },
        },
      };
      const query = new ASTQuery({
        query: from,
        source: flights_model.entries.at(-1) as Malloy.SourceInfo,
      });
      expect(query.isRunnable()).toBe(false);
    });
    test('query with empty refinement is runnable', () => {
      const from: Malloy.Query = {
        definition: {
          kind: 'refinement',
          base: {
            kind: 'query_reference',
            name: 'flights_by_carrier',
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
      };
      const query = new ASTQuery({
        query: from,
        model: {
          entries: [
            {
              kind: 'query',
              name: 'flights_by_carrier',
              schema: {
                fields: [
                  {
                    kind: 'dimension',
                    name: 'carrier',
                    type: {kind: 'string_type'},
                  },
                  {
                    kind: 'dimension',
                    name: 'flight_count',
                    type: {kind: 'number_type'},
                  },
                ],
              },
            },
          ],
          anonymous_queries: [],
        },
      });
      expect(query.isRunnable()).toBe(true);
    });
  });
  describe('insertion order', () => {
    const model: Malloy.ModelInfo = {
      entries: [
        {
          kind: 'source',
          name: 's',
          schema: {
            fields: [
              {kind: 'dimension', name: 'd1', type: {kind: 'number_type'}},
              {kind: 'dimension', name: 'd2', type: {kind: 'number_type'}},
              {kind: 'dimension', name: 'd3', type: {kind: 'number_type'}},
              {kind: 'measure', name: 'm1', type: {kind: 'number_type'}},
              {kind: 'measure', name: 'm2', type: {kind: 'number_type'}},
              {kind: 'measure', name: 'm3', type: {kind: 'number_type'}},
              {kind: 'view', name: 'v1', schema: {fields: []}},
              {kind: 'view', name: 'v2', schema: {fields: []}},
              {kind: 'view', name: 'v3', schema: {fields: []}},
            ],
          },
        },
      ],
      anonymous_queries: [],
    };
    function group_by(name: string): Malloy.ViewOperationWithGroupBy {
      return {
        kind: 'group_by',
        field: {
          expression: {
            kind: 'field_reference',
            name,
          },
        },
      };
    }
    function aggregate(name: string): Malloy.ViewOperationWithAggregate {
      return {
        kind: 'aggregate',
        field: {
          expression: {
            kind: 'field_reference',
            name,
          },
        },
      };
    }
    function nest(name: string): Malloy.ViewOperationWithNest {
      return {
        kind: 'nest',
        view: {
          definition: {
            kind: 'view_reference',
            name,
          },
        },
      };
    }
    test('add an aggregate after adding some group bys', () => {
      const from: Malloy.Query = {
        definition: {
          kind: 'arrow',
          source: {
            kind: 'source_reference',
            name: 's',
          },
          view: {
            kind: 'segment',
            operations: [],
          },
        },
      };
      expect((q: ASTQuery) => {
        const segment = q.getOrAddDefaultSegment();
        segment.addGroupBy('d1');
        segment.addGroupBy('d2');
        segment.addAggregate('m1');
      }).toModifyQuery({
        model,
        from,
        to: {
          definition: {
            kind: 'arrow',
            source: {
              kind: 'source_reference',
              name: 's',
            },
            view: {
              kind: 'segment',
              operations: [group_by('d1'), group_by('d2'), aggregate('m1')],
            },
          },
        },
        malloy: dedent`
          run: s -> {
            group_by:
              d1
              d2
            aggregate: m1
          }
        `,
      });
    });
    test('add GB, AGG, GB', () => {
      const from: Malloy.Query = {
        definition: {
          kind: 'arrow',
          source: {
            kind: 'source_reference',
            name: 's',
          },
          view: {
            kind: 'segment',
            operations: [],
          },
        },
      };
      expect((q: ASTQuery) => {
        const segment = q.getOrAddDefaultSegment();
        segment.addGroupBy('d1');
        segment.addAggregate('m1');
        segment.addGroupBy('d2');
      }).toModifyQuery({
        model,
        from,
        to: {
          definition: {
            kind: 'arrow',
            source: {
              kind: 'source_reference',
              name: 's',
            },
            view: {
              kind: 'segment',
              operations: [group_by('d1'), group_by('d2'), aggregate('m1')],
            },
          },
        },
        malloy: dedent`
          run: s -> {
            group_by:
              d1
              d2
            aggregate: m1
          }
        `,
      });
    });
    test('add GB, NEST, AGG', () => {
      const from: Malloy.Query = {
        definition: {
          kind: 'arrow',
          source: {
            kind: 'source_reference',
            name: 's',
          },
          view: {
            kind: 'segment',
            operations: [],
          },
        },
      };
      expect((q: ASTQuery) => {
        const segment = q.getOrAddDefaultSegment();
        segment.addGroupBy('d1');
        segment.addNest('v1');
        segment.addAggregate('m1');
      }).toModifyQuery({
        model,
        from,
        to: {
          definition: {
            kind: 'arrow',
            source: {
              kind: 'source_reference',
              name: 's',
            },
            view: {
              kind: 'segment',
              operations: [group_by('d1'), aggregate('m1'), nest('v1')],
            },
          },
        },
        malloy: dedent`
          run: s -> {
            group_by: d1
            aggregate: m1
            nest: v1
          }
        `,
      });
    });
    test('add GB, LIMIT, AGG', () => {
      const from: Malloy.Query = {
        definition: {
          kind: 'arrow',
          source: {
            kind: 'source_reference',
            name: 's',
          },
          view: {
            kind: 'segment',
            operations: [],
          },
        },
      };
      expect((q: ASTQuery) => {
        const segment = q.getOrAddDefaultSegment();
        segment.addGroupBy('d1');
        segment.setLimit(10);
        segment.addAggregate('m1');
      }).toModifyQuery({
        model,
        from,
        to: {
          definition: {
            kind: 'arrow',
            source: {
              kind: 'source_reference',
              name: 's',
            },
            view: {
              kind: 'segment',
              operations: [
                group_by('d1'),
                aggregate('m1'),
                {kind: 'limit', limit: 10},
              ],
            },
          },
        },
        malloy: dedent`
          run: s -> {
            group_by: d1
            aggregate: m1
            limit: 10
          }
        `,
      });
    });
    test('add HAVING, WHERE, GROUP BY, LIMIT', () => {
      const from: Malloy.Query = {
        definition: {
          kind: 'arrow',
          source: {
            kind: 'source_reference',
            name: 's',
          },
          view: {
            kind: 'segment',
            operations: [],
          },
        },
      };
      expect((q: ASTQuery) => {
        const segment = q.getOrAddDefaultSegment();
        segment.addHaving('m1', '> 10');
        segment.addWhere('d1', '> 10');
        segment.addGroupBy('d2');
        segment.setLimit(10);
      }).toModifyQuery({
        model,
        from,
        to: {
          definition: {
            kind: 'arrow',
            source: {
              kind: 'source_reference',
              name: 's',
            },
            view: {
              kind: 'segment',
              operations: [
                group_by('d2'),
                {
                  kind: 'where',
                  filter: {
                    kind: 'filter_string',
                    filter: '> 10',
                    expression: {
                      kind: 'field_reference',
                      name: 'd1',
                    },
                  },
                },
                {
                  kind: 'having',
                  filter: {
                    kind: 'filter_string',
                    filter: '> 10',
                    expression: {
                      kind: 'field_reference',
                      name: 'm1',
                    },
                  },
                },
                {kind: 'limit', limit: 10},
              ],
            },
          },
        },
        malloy: dedent`
          run: s -> {
            group_by: d2
            where: d1 ~ f\`> 10\`
            having: m1 ~ f\`> 10\`
            limit: 10
          }
        `,
      });
    });
  });
  describe('record support', () => {
    const model: Malloy.ModelInfo = {
      entries: [
        {
          kind: 'source',
          name: 's',
          schema: {
            fields: [
              {
                kind: 'dimension',
                name: 'r1',
                type: {
                  kind: 'record_type',
                  fields: [
                    {name: 'd1', type: {kind: 'string_type'}},
                    {name: 'd2', type: {kind: 'string_type'}},
                  ],
                },
              },
              {
                kind: 'dimension',
                name: 'rr1',
                type: {
                  kind: 'array_type',
                  element_type: {
                    kind: 'record_type',
                    fields: [
                      {name: 'd1', type: {kind: 'string_type'}},
                      {name: 'd2', type: {kind: 'string_type'}},
                    ],
                  },
                },
              },
            ],
          },
        },
      ],
      anonymous_queries: [],
    };
    test('add a group by of a field in a record field', () => {
      const from: Malloy.Query = {
        definition: {
          kind: 'arrow',
          source: {
            kind: 'source_reference',
            name: 's',
          },
          view: {
            kind: 'segment',
            operations: [],
          },
        },
      };
      expect((q: ASTQuery) => {
        q.getOrAddDefaultSegment().addGroupBy('d1', ['r1']);
      }).toModifyQuery({
        model,
        from,
        to: {
          definition: {
            kind: 'arrow',
            source: {
              kind: 'source_reference',
              name: 's',
            },
            view: {
              kind: 'segment',
              operations: [
                {
                  kind: 'group_by',
                  field: {
                    expression: {
                      kind: 'field_reference',
                      name: 'd1',
                      path: ['r1'],
                    },
                  },
                },
              ],
            },
          },
        },
        malloy: 'run: s -> { group_by: r1.d1 }',
      });
    });
    test('add a group by of a field in a repeated record field', () => {
      const from: Malloy.Query = {
        definition: {
          kind: 'arrow',
          source: {
            kind: 'source_reference',
            name: 's',
          },
          view: {
            kind: 'segment',
            operations: [],
          },
        },
      };
      expect((q: ASTQuery) => {
        q.getOrAddDefaultSegment().addGroupBy('d1', ['rr1']);
      }).toModifyQuery({
        model,
        from,
        to: {
          definition: {
            kind: 'arrow',
            source: {
              kind: 'source_reference',
              name: 's',
            },
            view: {
              kind: 'segment',
              operations: [
                {
                  kind: 'group_by',
                  field: {
                    expression: {
                      kind: 'field_reference',
                      name: 'd1',
                      path: ['rr1'],
                    },
                  },
                },
              ],
            },
          },
        },
        malloy: 'run: s -> { group_by: rr1.d1 }',
      });
    });
    test('add a where to a field in a record field', () => {
      const from: Malloy.Query = {
        definition: {
          kind: 'arrow',
          source: {
            kind: 'source_reference',
            name: 's',
          },
          view: {
            kind: 'segment',
            operations: [],
          },
        },
      };
      expect((q: ASTQuery) => {
        q.getOrAddDefaultSegment().addWhere('d1', ['r1'], 'WN, AA');
      }).toModifyQuery({
        model,
        from,
        to: {
          definition: {
            kind: 'arrow',
            source: {
              kind: 'source_reference',
              name: 's',
            },
            view: {
              kind: 'segment',
              operations: [
                {
                  kind: 'where',
                  filter: {
                    kind: 'filter_string',
                    expression: {
                      kind: 'field_reference',
                      name: 'd1',
                      path: ['r1'],
                    },
                    filter: 'WN, AA',
                  },
                },
              ],
            },
          },
        },
        malloy: 'run: s -> { where: r1.d1 ~ f`WN, AA` }',
      });
    });
    test('add a where to a field in a repeated record field', () => {
      const from: Malloy.Query = {
        definition: {
          kind: 'arrow',
          source: {
            kind: 'source_reference',
            name: 's',
          },
          view: {
            kind: 'segment',
            operations: [],
          },
        },
      };
      expect((q: ASTQuery) => {
        q.getOrAddDefaultSegment().addWhere('d1', ['rr1'], 'WN, AA');
      }).toModifyQuery({
        model,
        from,
        to: {
          definition: {
            kind: 'arrow',
            source: {
              kind: 'source_reference',
              name: 's',
            },
            view: {
              kind: 'segment',
              operations: [
                {
                  kind: 'where',
                  filter: {
                    kind: 'filter_string',
                    expression: {
                      kind: 'field_reference',
                      name: 'd1',
                      path: ['rr1'],
                    },
                    filter: 'WN, AA',
                  },
                },
              ],
            },
          },
        },
        malloy: 'run: s -> { where: rr1.d1 ~ f`WN, AA` }',
      });
    });
  });
});
