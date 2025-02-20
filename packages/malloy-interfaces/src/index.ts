/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as Malloy from './types';
export * from './types';

export const test: Malloy.ModelInfo = {
  entries: [
    {
      __type: Malloy.ModelEntryValueType.Source,
      name: 'flights',
      schema: {
        fields: [
          {
            __type: Malloy.FieldInfoType.Dimension,
            name: 'carrier',
            type: {
              __type: Malloy.AtomicTypeType.BooleanType,
            },
            annotations: [{value: '# foo=1'}],
          },
          {
            __type: Malloy.FieldInfoType.Dimension,
            name: 'arr',
            type: {
              __type: Malloy.AtomicTypeType.ArrayType,
              element_type: {
                __type: Malloy.AtomicTypeType.BooleanType,
              },
            },
          },
          {
            __type: Malloy.FieldInfoType.Dimension,
            name: 'arr_rec',
            type: {
              __type: Malloy.AtomicTypeType.ArrayType,
              element_type: {
                __type: Malloy.AtomicTypeType.RecordType,
                fields: [
                  {
                    name: 'arr',
                    type: {
                      __type: Malloy.AtomicTypeType.ArrayType,
                      element_type: {
                        __type: Malloy.AtomicTypeType.BooleanType,
                      },
                    },
                  },
                ],
              },
            },
          },
          {
            __type: Malloy.FieldInfoType.Dimension,
            name: 'rec',
            type: {
              __type: Malloy.AtomicTypeType.RecordType,
              fields: [
                {
                  name: 'arr',
                  type: {
                    __type: Malloy.AtomicTypeType.ArrayType,
                    element_type: {
                      __type: Malloy.AtomicTypeType.BooleanType,
                    },
                  },
                },
              ],
            },
          },
          {
            __type: Malloy.FieldInfoType.Join,
            name: 'carriers',
            relationship: Malloy.Relationship.ONE,
            schema: {
              fields: [
                {
                  __type: Malloy.FieldInfoType.Dimension,
                  name: 'code',
                  type: {
                    __type: Malloy.AtomicTypeType.StringType,
                  },
                },
              ],
            },
          },
          {
            __type: Malloy.FieldInfoType.View,
            name: 'by_carrier',
            schema: {
              fields: [
                {
                  __type: Malloy.FieldInfoType.Dimension,
                  name: 'carrier',
                  type: {
                    __type: Malloy.AtomicTypeType.StringType,
                  },
                },
                {
                  __type: Malloy.FieldInfoType.Dimension,
                  name: 'flight_count',
                  // How do I say this "came from" a dimension
                  type: {
                    __type: Malloy.AtomicTypeType.NumberType,
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
            __type: Malloy.AtomicTypeType.NumberType,
          },
          default_value: {
            __type: Malloy.LiteralValueType.NumberLiteral,
            number_value: 7,
          },
        },
      ],
    },
  ],
  anonymous_queries: [],
};

export const res: Malloy.Result = {
  data: {
    __type: Malloy.DataType.Table,
    rows: [
      {
        cells: [
          {
            __type: Malloy.CellType.StringCell,
            string_value: 'UA',
          },
          {
            __type: Malloy.CellType.NumberCell,
            number_value: 12341234,
          },
        ],
      },
      {
        cells: [
          {
            __type: Malloy.CellType.StringCell,
            string_value: 'AA',
          },
          {
            __type: Malloy.CellType.NumberCell,
            number_value: 2343,
          },
        ],
      },
    ],
  },
  schema: {
    fields: [
      {
        __type: Malloy.FieldInfoType.Dimension,
        name: 'carrier',
        type: {
          __type: Malloy.AtomicTypeType.StringType,
        },
      },
      {
        __type: Malloy.FieldInfoType.Dimension,
        // TODO "wasMeasure?"
        name: 'flight_count',
        type: {
          __type: Malloy.AtomicTypeType.NumberType,
        },
      },
    ],
  },
  sql: 'SELECT * ...',
};

export const thingy1: Malloy.Query = {
  definition: {
    __type: Malloy.QueryDefinitionType.Reference,
    name: 'flights_by_carrier',
  },
};

export const thingy123r: Malloy.Query = {
  definition: {
    __type: Malloy.QueryDefinitionType.Arrow,
    source: {name: 'flights'},
    view: {
      __type: Malloy.ViewDefinitionType.Reference,
      name: 'by_carrier',
    },
  },
};

export const thingyssdfg: Malloy.Query = {
  definition: {
    __type: Malloy.QueryDefinitionType.Refinement,
    query: {name: 'flights'},
    refinement: {
      __type: Malloy.ViewDefinitionType.Reference,
      name: 'by_carrier',
    },
  },
};

export const thingy2asdf: Malloy.Query = {
  definition: {
    __type: Malloy.QueryDefinitionType.Arrow,
    source: {name: 'flights'},
    view: {
      __type: Malloy.ViewDefinitionType.Refinement,
      base: {
        __type: Malloy.ViewDefinitionType.Reference,
        name: 'by_carrier',
      },
      refinement: {
        __type: Malloy.ViewDefinitionType.Segment,
        operations: [
          {
            __type: Malloy.ViewOperationType.Where,
            filter: {
              __type: Malloy.FilterType.FilterString,
              field: {name: 'carrier'},
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
    __type: Malloy.QueryDefinitionType.Arrow,
    source: {
      name: 'flights',
    },
    view: {
      __type: Malloy.ViewDefinitionType.Refinement,
      base: {
        __type: Malloy.ViewDefinitionType.Reference,
        name: 'by_carrier',
      },
      refinement: {
        __type: Malloy.ViewDefinitionType.Segment,
        operations: [
          {
            __type: Malloy.ViewOperationType.GroupBy,
            field: {
              expression: {
                __type: Malloy.ExpressionType.Reference,
                name: 'carrier',
              },
            },
          },
          {
            __type: Malloy.ViewOperationType.GroupBy,
            field: {
              expression: {
                __type: Malloy.ExpressionType.Reference,
                name: 'foo',
              },
            },
          },
        ],
      },
    },
  },
};

export const thingy4: Malloy.Query = {
  definition: {
    __type: Malloy.QueryDefinitionType.Arrow,
    source: {
      name: 'flights',
    },
    view: {
      __type: Malloy.ViewDefinitionType.Segment,
      operations: [
        {
          __type: Malloy.ViewOperationType.GroupBy,
          field: {
            expression: {
              __type: Malloy.ExpressionType.Reference,
              name: 'carrier',
            },
          },
        },
        {
          __type: Malloy.ViewOperationType.GroupBy,
          field: {
            expression: {
              __type: Malloy.ExpressionType.Reference,
              name: 'foo',
            },
          },
        },
      ],
    },
  },
};
