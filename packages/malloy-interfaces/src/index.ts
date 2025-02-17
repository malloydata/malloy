/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as Malloy from './types';
export * from './types';
export {queryToMalloy} from './to_malloy';

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
            tag: {
              properties: [
                // TODO maybe just say that a tag can have an optional string value and an optional array value
                // even though technially this would mean it could have BOTH
                {
                  name: 'foo',
                  value: {
                    value: {
                      __type: Malloy.TagValueType.StringValue,
                      value: '1',
                    },
                  },
                },
              ],
            },
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

export const q: Malloy.Query = {
  source: {
    name: 'flights',
    parameters: [
      {
        name: 'param',
        value: {
          __type: Malloy.LiteralValueType.StringLiteral,
          string_value: 'foo',
        },
      },
    ],
  },
  pipeline: {
    stages: [
      {
        refinements: [
          {
            __type: Malloy.RefinementType.Reference,
            name: 'by_carrier',
          },
        ],
      },
      {
        refinements: [
          {
            __type: Malloy.RefinementType.Segment,
            operations: [
              {
                __type: Malloy.ViewOperationType.GroupBy,
                items: [
                  {
                    field: {
                      expression: {
                        __type: Malloy.ExpressionType.Reference,
                        name: 'thingy',
                      },
                    },
                  },
                ],
              },
              {
                __type: Malloy.ViewOperationType.OrderBy,
                items: [
                  {
                    field: {name: 'thingy'},
                    direction: Malloy.OrderByDirection.ASC,
                  },
                ],
              },
              {
                __type: Malloy.ViewOperationType.Limit,
                limit: 10,
              },
            ],
          },
        ],
      },
    ],
  },
};

export const q2: Malloy.Query = {
  pipeline: {
    stages: [
      // A query which is just a pipeline from a top level query
      {
        refinements: [
          {
            __type: Malloy.RefinementType.Reference,
            name: 'flights_by_carrier',
          },
        ],
      },
      {
        refinements: [
          {
            __type: Malloy.RefinementType.Segment,
            operations: [
              {
                __type: Malloy.ViewOperationType.GroupBy,
                items: [
                  {
                    field: {
                      expression: {
                        __type: Malloy.ExpressionType.Reference,
                        name: 'thingy',
                      },
                    },
                  },
                ],
              },
              {
                __type: Malloy.ViewOperationType.OrderBy,
                items: [
                  {
                    field: {name: 'thingy'},
                    direction: Malloy.OrderByDirection.ASC,
                  },
                ],
              },
              {
                __type: Malloy.ViewOperationType.Limit,
                limit: 10,
              },
            ],
          },
        ],
      },
    ],
  },
};

// A query which is just a refinement of a top level query
export const q3: Malloy.Query = {
  pipeline: {
    stages: [
      {
        refinements: [
          {
            __type: Malloy.RefinementType.Reference,
            name: 'flights_by_carrier',
          },
          {
            __type: Malloy.RefinementType.Segment,
            operations: [
              {
                __type: Malloy.ViewOperationType.GroupBy,
                items: [
                  {
                    field: {
                      expression: {
                        __type: Malloy.ExpressionType.Reference,
                        name: 'thingy',
                      },
                    },
                  },
                ],
              },
              {
                __type: Malloy.ViewOperationType.GroupBy,
                items: [
                  {
                    field: {
                      expression: {
                        __type: Malloy.ExpressionType.TimeTruncation,
                        reference: {name: 'thingy'},
                        truncation: Malloy.TimestampTimeframe.DAY,
                      },
                    },
                  },
                ],
              },
              {
                __type: Malloy.ViewOperationType.Nest,
                items: [
                  {
                    view: {
                      pipeline: {
                        stages: [
                          {
                            refinements: [
                              {
                                __type: Malloy.RefinementType.Reference,
                                name: 'foo',
                              },
                            ],
                          },
                        ],
                      },
                    },
                  },
                ],
              },
              {
                __type: Malloy.ViewOperationType.Nest,
                items: [
                  {
                    name: 'thingy',
                    view: {
                      pipeline: {
                        stages: [
                          {
                            refinements: [
                              {
                                __type: Malloy.RefinementType.Reference,
                                name: 'by_carrier',
                              },
                            ],
                          },
                          {
                            refinements: [
                              {
                                __type: Malloy.RefinementType.Segment,
                                operations: [
                                  {
                                    __type: Malloy.ViewOperationType.GroupBy,
                                    annotations: [
                                      {
                                        __type:
                                          Malloy.TagOrAnnotationType.Annotation,
                                        value: '# bar',
                                      },
                                    ],
                                    items: [
                                      {
                                        name: 'renamed',
                                        field: {
                                          expression: {
                                            __type:
                                              Malloy.ExpressionType.Reference,
                                            name: 'thingy',
                                          },
                                          annotations: [
                                            {
                                              __type:
                                                Malloy.TagOrAnnotationType
                                                  .Annotation,
                                              value: '# foo',
                                            },
                                          ],
                                        },
                                      },
                                    ],
                                  },
                                  {
                                    __type: Malloy.ViewOperationType.OrderBy,
                                    items: [
                                      {
                                        field: {name: 'thingy'},
                                        direction: Malloy.OrderByDirection.ASC,
                                      },
                                    ],
                                  },
                                  {
                                    __type: Malloy.ViewOperationType.Limit,
                                    limit: 10,
                                  },
                                ],
                              },
                            ],
                          },
                        ],
                      },
                    },
                  },
                ],
              },
              {
                __type: Malloy.ViewOperationType.OrderBy,
                items: [
                  {
                    field: {name: 'thingy'},
                    direction: Malloy.OrderByDirection.ASC,
                  },
                ],
              },
              {
                __type: Malloy.ViewOperationType.Where,
                items: [
                  {
                    __type: Malloy.WhereItemType.FilterString,
                    field: {name: 'carrier'},
                    filter: 'WN',
                  },
                ],
              },
              {
                __type: Malloy.ViewOperationType.Limit,
                limit: 10,
              },
            ],
          },
        ],
      },
    ],
  },
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
