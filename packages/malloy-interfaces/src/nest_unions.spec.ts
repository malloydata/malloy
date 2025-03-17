/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  convertFromThrift,
  convertToThrift,
  nestUnions,
  unnestUnions,
} from './nest_unions';
import type * as Malloy from './types';

describe('nest/unnest unions', () => {
  test('works', () => {
    const unnested: Malloy.Query = {
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
              kind: 'limit',
              limit: 10,
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
    };
    const nested = {
      definition: {
        arrow: {
          source: {
            source_reference: {
              name: 'flights',
            },
          },
          view: {
            segment: {
              operations: [
                {
                  group_by: {
                    field: {
                      expression: {
                        field_reference: {name: 'carrier'},
                      },
                    },
                  },
                },
                {
                  limit: {limit: 10},
                },
                {
                  order_by: {
                    field_reference: {
                      name: 'carrier',
                    },
                    direction: 'asc',
                  },
                },
              ],
            },
          },
        },
      },
    };
    bidirectional(nested, unnested, 'Query');
  });
  test('works with an explicit undefined', () => {
    const unnested: Malloy.SourceInfo = {
      name: 'foo',
      annotations: undefined,
      schema: {
        fields: [],
      },
    };
    const nested = {
      name: 'foo',
      annotations: undefined,
      schema: {
        fields: [],
      },
    };
    bidirectional(nested, unnested, 'SourceInfo');
  });
  test('works with boolean values', () => {
    const unnested: Malloy.Data = {
      kind: 'record_cell',
      record_value: [
        {
          kind: 'boolean_cell',
          boolean_value: true,
        },
        {
          kind: 'boolean_cell',
          boolean_value: false,
        },
      ],
    };
    const nested = {
      record_cell: {
        record_value: [
          {boolean_cell: {boolean_value: true}},
          {boolean_cell: {boolean_value: false}},
        ],
      },
    };
    bidirectional(nested, unnested, 'Data');
  });
});

function bidirectional(nested: {}, unnested: {}, type: string) {
  expect(nestUnions(unnested)).toMatchObject(nested);
  expect(unnestUnions(nested, type)).toMatchObject(unnested);
}

describe('convert between default thrift and Malloy types', () => {
  test('works with a query', () => {
    const typescript: Malloy.Query = {
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
              kind: 'limit',
              limit: 10,
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
    };
    const thrift = {
      definition: {
        arrow: {
          source: {
            source_reference: {
              name: 'flights',
            },
          },
          view: {
            segment: {
              operations: [
                {
                  group_by: {
                    field: {
                      expression: {
                        field_reference: {name: 'carrier'},
                      },
                    },
                  },
                },
                {
                  limit: {limit: 10},
                },
                {
                  order_by: {
                    field_reference: {
                      name: 'carrier',
                    },
                    direction: 1,
                  },
                },
              ],
            },
          },
        },
      },
    };
    thriftBidirectional(typescript, thrift, 'Query');
  });
  test('works with an empty value', () => {
    const typescript: Malloy.SourceInfo = {
      name: 'foo',
      schema: {
        fields: [
          {
            kind: 'dimension',
            name: 'bar',
            type: {
              kind: 'string_type',
            },
          },
        ],
      },
    };
    const thrift = {
      name: 'foo',
      schema: {
        fields: [
          {
            dimension: {
              name: 'bar',
              type: {
                string_type: {},
              },
            },
          },
        ],
      },
    };
    thriftBidirectional(typescript, thrift, 'SourceInfo');
  });
  test('works with an empty array', () => {
    const typescript: Malloy.SourceInfo = {
      name: 'foo',
      annotations: [],
      schema: {
        fields: [],
      },
    };
    const thrift = {
      name: 'foo',
      annotations: [],
      schema: {
        fields: [],
      },
    };
    thriftBidirectional(typescript, thrift, 'SourceInfo');
  });
  test('works with an explicit undefined', () => {
    const typescript: Malloy.SourceInfo = {
      name: 'foo',
      annotations: undefined,
      schema: {
        fields: [],
      },
    };
    const thrift = {
      name: 'foo',
      annotations: undefined,
      schema: {
        fields: [],
      },
    };
    thriftBidirectional(typescript, thrift, 'SourceInfo');
  });
  test('works with boolean values', () => {
    const typescript: Malloy.Data = {
      kind: 'record_cell',
      record_value: [
        {
          kind: 'boolean_cell',
          boolean_value: true,
        },
        {
          kind: 'boolean_cell',
          boolean_value: false,
        },
      ],
    };
    const thrift = {
      record_cell: {
        record_value: [
          {boolean_cell: {boolean_value: true}},
          {boolean_cell: {boolean_value: false}},
        ],
      },
    };
    thriftBidirectional(typescript, thrift, 'Data');
  });
});

function thriftBidirectional(typescript: {}, thrift: {}, type: string) {
  const actualThrift = convertToThrift(typescript, type);
  const actualTypescript = convertFromThrift(thrift, type);
  expect(actualTypescript).toMatchObject(typescript);
  expect(actualThrift).toMatchObject(thrift);
  expect(JSON.stringify(actualThrift, null, 2)).toBe(
    JSON.stringify(thrift, null, 2)
  );
  expect(JSON.stringify(actualTypescript, null, 2)).toBe(
    JSON.stringify(typescript, null, 2)
  );
}
