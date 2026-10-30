/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
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
  describe('quoted identifiers', () => {
    test('source name with dots is quoted as single identifier', () => {
      idempotent('run: `foo.bar` -> { group_by: carrier }', {
        query: {
          definition: {
            kind: 'arrow',
            source: {
              kind: 'source_reference',
              name: 'foo.bar',
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
    test('source name with hyphens and dots is quoted as single identifier', () => {
      idempotent('run: `foo-bar.baz` -> { group_by: carrier }', {
        query: {
          definition: {
            kind: 'arrow',
            source: {
              kind: 'source_reference',
              name: 'foo-bar.baz',
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
    test('source name with colons is quoted as single identifier', () => {
      idempotent('run: `foo:bar:baz` -> { group_by: carrier }', {
        query: {
          definition: {
            kind: 'arrow',
            source: {
              kind: 'source_reference',
              name: 'foo:bar:baz',
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

    test('field path with quoted segment containing dot', () => {
      idempotent('run: a -> { group_by: `foo.bar`.baz }', {
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
                  kind: 'group_by',
                  field: {
                    expression: {
                      kind: 'field_reference',
                      name: 'baz',
                      path: ['foo.bar'],
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
  describe('escaping', () => {
    const awkwardStrings = [
      'plain',
      'say "hi"',
      "it's",
      'both \' and "',
      'back`tick',
      '`\'"',
      'C:\\',
      'backslash \\n is not a newline',
      'line\nbreak',
      'cr\rlf\r\n',
      'tab\there',
      'controls \b\f\v\0\x01\x1f\x7f',
      'unicode é 😀 \u2028',
    ];

    function whereQuery(
      fieldName: string,
      filter: Malloy.Filter['kind'],
      value: string
    ): Malloy.Query {
      const expression: Malloy.Expression = {
        kind: 'field_reference',
        name: fieldName,
      };
      return {
        definition: {
          kind: 'arrow',
          source: {kind: 'source_reference', name: 'flights'},
          view: {
            kind: 'segment',
            operations: [
              {
                kind: 'where',
                filter:
                  filter === 'filter_string'
                    ? {kind: 'filter_string', expression, filter: value}
                    : {
                        kind: 'literal_equality',
                        expression,
                        value: {kind: 'string_literal', string_value: value},
                      },
              },
            ],
          },
        },
      };
    }

    test.each(awkwardStrings)('string literal %j round trips', str => {
      roundTrip(whereQuery('carrier', 'literal_equality', str));
    });

    test.each(awkwardStrings)('source parameter %j round trips', str => {
      roundTrip({
        definition: {
          kind: 'arrow',
          source: {
            kind: 'source_reference',
            name: 'flights',
            parameters: [
              {name: 'p', value: {kind: 'string_literal', string_value: str}},
            ],
          },
          view: {kind: 'view_reference', name: 'v'},
        },
      });
    });

    test.each(awkwardStrings)('identifier %j round trips', str => {
      roundTrip(whereQuery(str, 'literal_equality', 'AA'));
    });

    test.each(awkwardStrings.filter(s => s !== 'C:\\'))(
      'filter string %j round trips',
      str => {
        roundTrip(whereQuery('carrier', 'filter_string', str));
      }
    );

    test('string literal uses the quote it does not contain', () => {
      expect(
        Malloy.queryToMalloy(
          whereQuery('carrier', 'literal_equality', 'say "hi"')
        )
      ).toContain('carrier = \'say "hi"\'');
      expect(
        Malloy.queryToMalloy(whereQuery('carrier', 'literal_equality', "it's"))
      ).toContain('carrier = "it\'s"');
    });

    test('filter string uses triple quotes when it needs them', () => {
      expect(
        Malloy.queryToMalloy(whereQuery('carrier', 'filter_string', 'a`\'"b'))
      ).toContain('carrier ~ f```a`\'"b```');
      expect(
        Malloy.queryToMalloy(whereQuery('carrier', 'filter_string', 'a\nb'))
      ).toContain('carrier ~ f```a\nb```');
    });

    test('filter string that no quoting can hold is an error', () => {
      expect(() =>
        Malloy.queryToMalloy(whereQuery('carrier', 'filter_string', 'C:\\'))
      ).toThrow('cannot be written as a Malloy filter string');
    });

    function timestampQuery(timezone: string, minute?: 'minute'): Malloy.Query {
      return {
        definition: {
          kind: 'arrow',
          source: {kind: 'source_reference', name: 'flights'},
          view: {
            kind: 'segment',
            operations: [
              {
                kind: 'where',
                filter: {
                  kind: 'literal_equality',
                  expression: {kind: 'field_reference', name: 'dep_time'},
                  value: {
                    kind: 'timestamp_literal',
                    timestamp_value: minute
                      ? '2020-01-01 12:34:00'
                      : '2020-01-01 12:34:56',
                    granularity: minute,
                    timezone,
                  },
                },
              },
            ],
          },
        },
      };
    }

    const timezones = [
      'America/Los_Angeles',
      'America/Port-au-Prince',
      'Etc/GMT+5',
      '+05:30',
      'EST5EDT,M3.2.0/2,M11.1.0/2',
    ];

    test.each(timezones)('timestamp timezone %s round trips', timezone => {
      roundTrip(timestampQuery(timezone));
    });

    test.each(timezones)(
      'minute timestamp timezone %s round trips',
      timezone => {
        roundTrip(timestampQuery(timezone, 'minute'));
      }
    );

    test.each(['UTC] x', 'UTC\nx', 'UTC\rx', ''])(
      'timestamp timezone %j that a literal cannot hold is an error',
      timezone => {
        expect(() => Malloy.queryToMalloy(timestampQuery(timezone))).toThrow(
          'cannot be written in a timestamp literal'
        );
      }
    );
  });
  describe('annotation printing', () => {
    const annotationValues = [
      '# bar_chart\n',
      '# label = "two\\nlines"\n',
      '#|\nlabel="a"',
      '#| opener text\nline one\n\n  indented\n\tline two',
      '#|\nbody line\n|#\nafter a body |#',
      '#|',
      '#|\n',
      '#|\na\n\n\n\n\n\n',
      '#|\n\na\n\n',
      '#|\n   ',
      '#|\n\t\n  \n',
      '#|\n  \na\n    ',
    ];

    function groupBys(
      ...annotations: (Malloy.Annotation[] | undefined)[]
    ): Malloy.Query {
      return {
        definition: {
          kind: 'arrow',
          source: {kind: 'source_reference', name: 'flights'},
          view: {
            kind: 'segment',
            operations: annotations.map((a, i) => ({
              kind: 'group_by',
              field: {
                expression: {kind: 'field_reference', name: `f${i}`},
                annotations: a,
              },
            })),
          },
        },
      };
    }

    test.each(annotationValues)('query annotation %j round trips', value => {
      roundTrip({...groupBys(undefined), annotations: [{value}]});
    });

    test.each(annotationValues)(
      'annotation %j on a lone field round trips',
      value => {
        roundTrip(groupBys([{value}]));
      }
    );

    test.each(annotationValues)(
      'annotation %j on one of several fields round trips',
      value => {
        roundTrip(groupBys(undefined, [{value}, {value: '# second\n'}]));
      }
    );

    test.each([0, 1, 4])(
      'block annotations round trip with tab width %d',
      tabWidth => {
        for (const value of annotationValues) {
          roundTrip(groupBys(undefined, [{value}]), {tabWidth});
        }
      }
    );

    test.each([
      ['  # leading space\n', '# leading space\n'],
      ['# crlf\r\n', '# crlf\n'],
      ['#|\r\na\r\nb', '#|\na\nb'],
    ])('annotation %j prints as %j', (value, printed) => {
      const query = groupBys([{value}]);
      expect(
        malloyToQuery(Malloy.queryToMalloy(query)).query?.definition
      ).toEqual(groupBys([{value: printed}]).definition);
    });

    test('block annotation keeps its trailing blank lines', () => {
      const src =
        '#|\na\n\n\n\n\n\n\n|#\nrun: flights -> { group_by: carrier }';
      const parsed = malloyToQuery(src);
      expect(parsed.query?.annotations).toEqual([{value: '#|\na\n\n\n\n\n\n'}]);
      roundTrip(parsed.query!);
    });

    test('block annotation from source survives printing', () => {
      const src = [
        'run: flights -> {',
        '  #|',
        '    label="a"',
        '      |#',
        '  |#',
        '  group_by: carrier',
        '}',
      ].join('\n');
      const parsed = malloyToQuery(src);
      expect(parsed.logs).toEqual([]);
      roundTrip(parsed.query!);
    });

    test.each([
      '## model annotation\n',
      '##| model block',
      'group_by: x',
      '# two\nlines\n',
      '# carriage\rreturn\n',
    ])('annotation %j that is not an object annotation is an error', value => {
      expect(() => Malloy.queryToMalloy(groupBys([{value}]))).toThrow(
        'cannot be written as an object annotation'
      );
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

function roundTrip(query: Malloy.Query, options?: {tabWidth: number}) {
  const malloy = Malloy.queryToMalloy(query, options);
  expect(malloyToQuery(malloy)).toEqual({query, logs: []});
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
