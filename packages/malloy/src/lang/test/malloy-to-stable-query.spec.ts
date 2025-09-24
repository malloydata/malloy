/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {malloyToQuery} from '../malloy-to-stable-query';
import * as Malloy from '@malloydata/malloy-interfaces';

type QueryAndLogs = {query?: Malloy.Query; logs: Partial<Malloy.LogMessage>[]};

// TODO put this into a malloy-common util file?
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

describe('Malloy to Stable Query', () => {
  describe('field exprs', () => {
    test('field reference (not renamed)', () => {
      idempotent('run: flights -> { group_by: carrier }', {
        query: {
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
        logs: [],
      });
    });
    test('field reference (renamed)', () => {
      idempotent('run: flights -> { group_by: carrier2 is carrier }', {
        query: {
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
                  name: 'carrier2',
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
        logs: [],
      });
    });
    test('field time trunctation (not renamed)', () => {
      idempotent('run: flights -> { group_by: dep_time.day }', {
        query: {
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
                      truncation: 'day',
                    },
                  },
                },
              ],
            },
          },
        },
        logs: [],
      });
    });
    test('field time trunctation (renamed)', () => {
      idempotent('run: flights -> { group_by: dep_day is dep_time.day }', {
        query: {
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
                  name: 'dep_day',
                  field: {
                    expression: {
                      kind: 'time_truncation',
                      field_reference: {name: 'dep_time'},
                      truncation: 'day',
                    },
                  },
                },
              ],
            },
          },
        },
        logs: [],
      });
    });
  });
  describe('nests', () => {
    test('simple named nest', () => {
      idempotent(
        'run: flights -> { nest: carriers is { group_by: carrier } }',
        {
          logs: [],
          query: {
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
                    name: 'carriers',
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
        }
      );
    });
  });
  describe('parameters', () => {
    test('parameter is passed properly', () => {
      idempotent('run: a(p is 1) -> by_carrier', {
        query: {
          definition: {
            kind: 'arrow',
            source: {
              kind: 'source_reference',
              name: 'a',
              parameters: [
                {
                  name: 'p',
                  value: {
                    kind: 'number_literal',
                    number_value: 1,
                  },
                },
              ],
            },
            view: {
              kind: 'view_reference',
              name: 'by_carrier',
            },
          },
        },
        logs: [],
      });
    });
    test('filter parameter is passed properly', () => {
      idempotent('run: a(p is f`foo`) -> by_carrier', {
        query: {
          definition: {
            kind: 'arrow',
            source: {
              kind: 'source_reference',
              name: 'a',
              parameters: [
                {
                  name: 'p',
                  value: {
                    kind: 'filter_expression_literal',
                    filter_expression_value: 'foo',
                  },
                },
              ],
            },
            view: {
              kind: 'view_reference',
              name: 'by_carrier',
            },
          },
        },
        logs: [],
      });
    });
  });
  describe('drill', () => {
    test('drill clauses with all the literal types, as well as a filter string comparison', () => {
      idempotent(
        dedent`
          run: a -> {
            drill:
              a = 1,
              a ~ f\`AA\`,
              a.b = "foo",
              a = 1e+32,
              a = -10,
              a = @2000,
              a = @2000-01,
              a = @2000-01-01,
              a = @2000-01-01 10,
              a = @2000-01-01 10:00,
              a = @2000-01-01 10:00:00,
              a = @2000-01-01 10:00:00[America/Los_Angeles]
          }
        `,
        {
          query: {
            definition: {
              kind: 'arrow',
              source: {
                kind: 'source_reference',
                name: 'a',
              },
              view: {
                kind: 'segment',
                operations: [
                  {
                    filter: {
                      expression: {
                        kind: 'field_reference',
                        name: 'a',
                      },
                      kind: 'literal_equality',
                      value: {
                        kind: 'number_literal',
                        number_value: 1,
                      },
                    },
                    kind: 'drill',
                  },
                  {
                    filter: {
                      expression: {
                        kind: 'field_reference',
                        name: 'a',
                      },
                      filter: 'AA',
                      kind: 'filter_string',
                    },
                    kind: 'drill',
                  },
                  {
                    filter: {
                      expression: {
                        kind: 'field_reference',
                        name: 'b',
                        path: ['a'],
                      },
                      kind: 'literal_equality',
                      value: {
                        kind: 'string_literal',
                        string_value: 'foo',
                      },
                    },
                    kind: 'drill',
                  },
                  {
                    filter: {
                      expression: {
                        kind: 'field_reference',
                        name: 'a',
                      },
                      kind: 'literal_equality',
                      value: {
                        kind: 'number_literal',
                        number_value: 1e32,
                      },
                    },
                    kind: 'drill',
                  },
                  {
                    filter: {
                      expression: {
                        kind: 'field_reference',
                        name: 'a',
                      },
                      kind: 'literal_equality',
                      value: {
                        kind: 'number_literal',
                        number_value: -10,
                      },
                    },
                    kind: 'drill',
                  },
                  {
                    filter: {
                      expression: {
                        kind: 'field_reference',
                        name: 'a',
                      },
                      kind: 'literal_equality',
                      value: {
                        kind: 'date_literal',
                        date_value: '2000-01-01',
                        granularity: 'year',
                      },
                    },
                    kind: 'drill',
                  },
                  {
                    filter: {
                      expression: {
                        kind: 'field_reference',
                        name: 'a',
                      },
                      kind: 'literal_equality',
                      value: {
                        kind: 'date_literal',
                        date_value: '2000-01-01',
                        granularity: 'month',
                      },
                    },
                    kind: 'drill',
                  },
                  {
                    filter: {
                      expression: {
                        kind: 'field_reference',
                        name: 'a',
                      },
                      kind: 'literal_equality',
                      value: {
                        kind: 'date_literal',
                        date_value: '2000-01-01',
                        granularity: 'day',
                      },
                    },
                    kind: 'drill',
                  },
                  {
                    filter: {
                      expression: {
                        kind: 'field_reference',
                        name: 'a',
                      },
                      kind: 'literal_equality',
                      value: {
                        kind: 'timestamp_literal',
                        timestamp_value: '2000-01-01 10:00:00',
                        granularity: 'hour',
                      },
                    },
                    kind: 'drill',
                  },
                  {
                    filter: {
                      expression: {
                        kind: 'field_reference',
                        name: 'a',
                      },
                      kind: 'literal_equality',
                      value: {
                        kind: 'timestamp_literal',
                        timestamp_value: '2000-01-01 10:00:00',
                        granularity: 'minute',
                      },
                    },
                    kind: 'drill',
                  },
                  {
                    filter: {
                      expression: {
                        kind: 'field_reference',
                        name: 'a',
                      },
                      kind: 'literal_equality',
                      value: {
                        kind: 'timestamp_literal',
                        timestamp_value: '2000-01-01 10:00:00',
                        granularity: undefined,
                      },
                    },
                    kind: 'drill',
                  },
                  {
                    filter: {
                      expression: {
                        kind: 'field_reference',
                        name: 'a',
                      },
                      kind: 'literal_equality',
                      value: {
                        kind: 'timestamp_literal',
                        timestamp_value: '2000-01-01 10:00:00',
                        timezone: 'America/Los_Angeles',
                        granularity: undefined,
                      },
                    },
                    kind: 'drill',
                  },
                ],
              },
            },
          },
          logs: [],
        }
      );
    });
    test('timestamp with T in it is simplified', () => {
      simplified(
        'run: a -> { drill: a = @2000-01-01T10:00:00 }',
        'run: a -> { drill: a = @2000-01-01 10:00:00 }',
        {
          query: {
            definition: {
              kind: 'arrow',
              source: {
                kind: 'source_reference',
                name: 'a',
              },
              view: {
                kind: 'segment',
                operations: [
                  {
                    filter: {
                      expression: {
                        kind: 'field_reference',
                        name: 'a',
                      },
                      kind: 'literal_equality',
                      value: {
                        kind: 'timestamp_literal',
                        timestamp_value: '2000-01-01 10:00:00',
                        granularity: undefined,
                      },
                    },
                    kind: 'drill',
                  },
                ],
              },
            },
          },
          logs: [],
        }
      );
    });
  });
  describe('filters', () => {
    test('where clause with one filter', () => {
      idempotent('run: a -> { where: carrier ~ f`AA` }', {
        query: {
          definition: {
            kind: 'arrow',
            source: {
              kind: 'source_reference',
              name: 'a',
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
                    filter: 'AA',
                  },
                },
              ],
            },
          },
        },
        logs: [],
      });
    });
    test('all different filter quotings', () => {
      const where: Malloy.ViewOperationWithWhere = {
        kind: 'where',
        filter: {
          kind: 'filter_string',
          expression: {
            kind: 'field_reference',
            name: 'carrier',
          },
          filter: 'AA',
        },
      };
      simplified(
        dedent`
          run: a -> {
            where:
              carrier ~ f'AA',
              carrier ~ f"AA",
              carrier ~ f\`AA\`,
              carrier ~ f\`\`\`AA\`\`\`,
              carrier ~ f'''AA''',
              carrier ~ f"""AA""",
          }
        `,
        dedent`
          run: a -> {
            where:
              carrier ~ f\`AA\`,
              carrier ~ f\`AA\`,
              carrier ~ f\`AA\`,
              carrier ~ f\`AA\`,
              carrier ~ f\`AA\`,
              carrier ~ f\`AA\`
          }
        `,
        {
          query: {
            definition: {
              kind: 'arrow',
              source: {
                kind: 'source_reference',
                name: 'a',
              },
              view: {
                kind: 'segment',
                operations: [where, where, where, where, where, where],
              },
            },
          },
          logs: [],
        }
      );
    });
  });
  describe('query combinations', () => {
    test('a -> b -> c', () => {
      idempotent('run: a -> b -> c', {
        query: {
          definition: {
            kind: 'arrow',
            source: {
              kind: 'source_reference',
              name: 'a',
            },
            view: {
              kind: 'arrow',
              source: {
                kind: 'view_reference',
                name: 'b',
              },
              view: {
                kind: 'view_reference',
                name: 'c',
              },
            },
          },
        },
        logs: [],
      });
    });
    test('a -> b + c', () => {
      idempotent('run: a -> b + c', {
        query: {
          definition: {
            kind: 'arrow',
            source: {
              kind: 'source_reference',
              name: 'a',
            },
            view: {
              kind: 'refinement',
              base: {
                kind: 'view_reference',
                name: 'b',
              },
              refinement: {
                kind: 'view_reference',
                name: 'c',
              },
            },
          },
        },
        logs: [],
      });
    });
    test('a + b -> c', () => {
      idempotent('run: a + b -> c', {
        query: {
          definition: {
            kind: 'arrow',
            source: {
              kind: 'refinement',
              base: {
                kind: 'query_reference',
                name: 'a',
              },
              refinement: {
                kind: 'view_reference',
                name: 'b',
              },
            },
            view: {
              kind: 'view_reference',
              name: 'c',
            },
          },
        },
        logs: [],
      });
    });
    test('(a + b) -> c', () => {
      simplified('run: (a + b) -> c', 'run: a + b -> c', {
        query: {
          definition: {
            kind: 'arrow',
            source: {
              kind: 'refinement',
              base: {
                kind: 'query_reference',
                name: 'a',
              },
              refinement: {
                kind: 'view_reference',
                name: 'b',
              },
            },
            view: {
              kind: 'view_reference',
              name: 'c',
            },
          },
        },
        logs: [],
      });
    });
    test('(a -> b) + c', () => {
      idempotent('run: (a -> b) + c', {
        query: {
          definition: {
            kind: 'refinement',
            base: {
              kind: 'arrow',
              source: {
                kind: 'source_reference',
                name: 'a',
              },
              view: {
                kind: 'view_reference',
                name: 'b',
              },
            },
            refinement: {
              kind: 'view_reference',
              name: 'c',
            },
          },
        },
        logs: [],
      });
    });
    test('a + b + c', () => {
      idempotent('run: a + b + c', {
        query: {
          definition: {
            kind: 'refinement',
            base: {
              kind: 'query_reference',
              name: 'a',
            },
            refinement: {
              kind: 'refinement',
              base: {
                kind: 'view_reference',
                name: 'b',
              },
              refinement: {
                kind: 'view_reference',
                name: 'c',
              },
            },
          },
        },
        logs: [],
      });
    });
  });
  describe('Render annotations', () => {
    test('single render annotation', () => {
      idempotent('# bar_chart\nrun: flights -> { group_by: carrier }', {
        query: {
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
                  'field': {
                    'annotations': undefined,
                    'expression': {
                      'kind': 'field_reference',
                      'name': 'carrier',
                      'path': undefined,
                    },
                  },
                  'kind': 'group_by',
                  'name': undefined,
                },
              ],
            },
          },
          annotations: [{value: '# bar_chart\n'}],
        },
        logs: [],
      });
    });
  });
});

function idempotent(query: string, expected?: QueryAndLogs) {
  const result = malloyToQuery(query);
  if (expected) {
    expect(result).toMatchObject(expected);
  }
  expect(result.query).not.toBeUndefined();
  const malloy = Malloy.queryToMalloy(result.query!);
  expect(query).toEqual(malloy);
}

function simplified(
  query: string,
  expected: string,
  expectedParsed?: QueryAndLogs
) {
  const result = malloyToQuery(query);
  expect(result.query).not.toBeUndefined();
  if (expectedParsed) {
    expect(result).toMatchObject(expectedParsed);
  }
  const malloy = Malloy.queryToMalloy(result.query!);
  expect(malloy).toEqual(expected);
}
