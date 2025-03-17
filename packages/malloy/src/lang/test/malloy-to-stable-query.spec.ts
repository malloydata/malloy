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
  describe('query combinations', () => {
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
                      field_reference: {
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
            field_reference: {
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
