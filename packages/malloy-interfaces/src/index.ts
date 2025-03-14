/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type * as Malloy from './types';
export * from './types';
export {queryToMalloy} from './to_malloy';
export {nestUnions} from './nest_unions';

export const test: Malloy.ModelInfo = {
  entries: [
    {
      kind: 'source',
      name: 'flights',
      schema: {
        fields: [
          {
            kind: 'dimension',
            name: 'carrier',
            type: {
              kind: 'boolean_type',
            },
            annotations: [{value: '# foo=1'}],
          },
          {
            kind: 'dimension',
            name: 'arr',
            type: {
              kind: 'array_type',
              element_type: {
                kind: 'boolean_type',
              },
            },
          },
          {
            kind: 'dimension',
            name: 'arr_rec',
            type: {
              kind: 'array_type',
              element_type: {
                kind: 'record_type',
                fields: [
                  {
                    name: 'arr',
                    type: {
                      kind: 'array_type',
                      element_type: {
                        kind: 'boolean_type',
                      },
                    },
                  },
                ],
              },
            },
          },
          {
            kind: 'dimension',
            name: 'rec',
            type: {
              kind: 'record_type',
              fields: [
                {
                  name: 'arr',
                  type: {
                    kind: 'array_type',
                    element_type: {
                      kind: 'boolean_type',
                    },
                  },
                },
              ],
            },
          },
          {
            kind: 'join',
            name: 'carriers',
            relationship: 'one',
            schema: {
              fields: [
                {
                  kind: 'dimension',
                  name: 'code',
                  type: {
                    kind: 'string_type',
                  },
                },
              ],
            },
          },
          {
            kind: 'view',
            name: 'by_carrier',
            schema: {
              fields: [
                {
                  kind: 'dimension',
                  name: 'carrier',
                  type: {
                    kind: 'string_type',
                  },
                },
                {
                  kind: 'dimension',
                  name: 'flight_count',
                  // How do I say this "came from" a dimension
                  type: {
                    kind: 'number_type',
                  },
                },
              ],
            },
          },
        ],
      },
      parameters: [
        {
          name: 'param',
          type: {
            kind: 'number_type',
          },
          default_value: {
            kind: 'number_literal',
            number_value: 7,
          },
        },
      ],
    },
  ],
  anonymous_queries: [],
};

export const res: Malloy.Result = {
  connection_name: 'foo',
  data: {
    kind: 'array_cell',
    array_value: [
      {
        kind: 'record_cell',
        record_value: [
          {
            kind: 'string_cell',
            string_value: 'UA',
          },
          {
            kind: 'number_cell',
            number_value: 12341234,
          },
        ],
      },
      {
        kind: 'record_cell',
        record_value: [
          {
            kind: 'string_cell',
            string_value: 'AA',
          },
          {
            kind: 'number_cell',
            number_value: 2343,
          },
        ],
      },
    ],
  },
  schema: {
    fields: [
      {
        kind: 'dimension',
        name: 'carrier',
        type: {
          kind: 'string_type',
        },
      },
      {
        kind: 'dimension',
        // TODO "wasMeasure?"
        name: 'flight_count',
        type: {
          kind: 'number_type',
        },
      },
    ],
  },
  sql: 'SELECT * ...',
};

export const thingy1: Malloy.Query = {
  definition: {
    kind: 'query_reference',
    name: 'flights_by_carrier',
  },
};

export const thingy123r: Malloy.Query = {
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

export const thingyssdfg: Malloy.Query = {
  definition: {
    kind: 'refinement',
    base: {
      kind: 'query_reference',
      name: 'flights',
    },
    refinement: {
      kind: 'view_reference',
      name: 'by_carrier',
    },
  },
};

export const thingy2asdf: Malloy.Query = {
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
        kind: 'segment',
        operations: [
          {
            kind: 'where',
            filter: {
              kind: 'filter_string',
              field_reference: {name: 'carrier'},
              filter: 'WN',
            },
          },
        ],
      },
    },
  },
};

export const thingy3: Malloy.Query = {
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
                name: 'foo',
              },
            },
          },
        ],
      },
    },
  },
};

export const thingy3dfdf: Malloy.Query = {
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
        name: 'top10',
      },
    },
  },
};

export const thingy4asdfasdf: Malloy.Query = {
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
              name: 'foo',
            },
          },
        },
      ],
    },
  },
};

// run: flights -> by_carrier
export const thingy4asdfas: Malloy.Query = {
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

// run: flights -> by_carrier + { limit: 10 }
export const thingy4dfdsfs: Malloy.Query = {
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
};

// run: flights -> { group_by: carrier }
export const thingy4sdfsd: Malloy.Query = {
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
      ],
    },
  },
};

// run: flights -> { }
export const thingy4sddfdfsd: Malloy.Query = {
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
