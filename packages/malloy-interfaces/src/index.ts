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
      source: {
        name: 'flights',
        schema: {
          fields: [
            {
              __type: Malloy.FieldInfoType.Dimension,
              dimension: {
                name: 'carrier',
                type: {
                  __type: Malloy.AtomicTypeType.BooleanType,
                  boolean_type: {},
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
                          string_value: '1',
                        },
                      },
                    },
                  ],
                },
              },
            },
            {
              __type: Malloy.FieldInfoType.Dimension,
              dimension: {
                name: 'arr',
                type: {
                  __type: Malloy.AtomicTypeType.ArrayType,
                  array_type: {
                    element_type: {
                      __type: Malloy.AtomicTypeType.BooleanType,
                      boolean_type: {},
                    },
                  },
                },
              },
            },
            {
              __type: Malloy.FieldInfoType.Dimension,
              dimension: {
                name: 'arr_rec',
                type: {
                  __type: Malloy.AtomicTypeType.ArrayType,
                  array_type: {
                    element_type: {
                      __type: Malloy.AtomicTypeType.RecordType,
                      record_type: {
                        fields: [
                          {
                            name: 'arr',
                            type: {
                              __type: Malloy.AtomicTypeType.ArrayType,
                              array_type: {
                                element_type: {
                                  __type: Malloy.AtomicTypeType.BooleanType,
                                  boolean_type: {},
                                },
                              },
                            },
                          },
                        ],
                      },
                    },
                  },
                },
              },
            },
            {
              __type: Malloy.FieldInfoType.Dimension,
              dimension: {
                name: 'rec',
                type: {
                  __type: Malloy.AtomicTypeType.RecordType,
                  record_type: {
                    fields: [
                      {
                        name: 'arr',
                        type: {
                          __type: Malloy.AtomicTypeType.ArrayType,
                          array_type: {
                            element_type: {
                              __type: Malloy.AtomicTypeType.BooleanType,
                              boolean_type: {},
                            },
                          },
                        },
                      },
                    ],
                  },
                },
              },
            },
            {
              __type: Malloy.FieldInfoType.Join,
              join: {
                name: 'carriers',
                relationship: Malloy.Relationship.ONE,
                schema: {
                  fields: [
                    {
                      __type: Malloy.FieldInfoType.Dimension,
                      dimension: {
                        name: 'code',
                        type: {
                          __type: Malloy.AtomicTypeType.StringType,
                          string_type: {},
                        },
                      },
                    },
                  ],
                },
              },
            },
            {
              __type: Malloy.FieldInfoType.View,
              view: {
                name: 'by_carrier',
                schema: {
                  fields: [
                    {
                      __type: Malloy.FieldInfoType.Dimension,
                      dimension: {
                        name: 'carrier',
                        type: {
                          __type: Malloy.AtomicTypeType.StringType,
                          string_type: {},
                        },
                      },
                    },
                    {
                      __type: Malloy.FieldInfoType.Dimension,
                      dimension: {
                        name: 'flight_count',
                        // How do I say this "came from" a dimension
                        type: {
                          __type: Malloy.AtomicTypeType.NumberType,
                          number_type: {},
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
          string_literal: {string_value: 'foo'},
        },
      },
    ],
  },
  pipeline: {
    stages: [
      {
        __type: Malloy.PipeStageType.Reference,
        reference: {name: 'by_carrier'},
      },
      {
        __type: Malloy.PipeStageType.Segment,
        segment: {
          operations: [
            {
              __type: Malloy.ViewOperationType.GroupBy,
              group_by: {
                items: [
                  {
                    field: {
                      expression: {
                        __type: Malloy.ExpressionType.Reference,
                        reference: {name: 'thingy'},
                      },
                    },
                  },
                ],
              },
            },
            {
              __type: Malloy.ViewOperationType.OrderBy,
              order_by: {
                items: [
                  {
                    field: {name: 'thingy'},
                    direction: Malloy.OrderByDirection.ASC,
                  },
                ],
              },
            },
            {
              __type: Malloy.ViewOperationType.Limit,
              limit: {limit: 10},
            },
          ],
        },
      },
    ],
  },
};

export const q2: Malloy.Query = {
  pipeline: {
    stages: [
      // A query which is just a pipeline from a top level query
      {
        __type: Malloy.PipeStageType.Reference,
        reference: {name: 'flights_by_carrier'},
      },
      {
        __type: Malloy.PipeStageType.Segment,
        segment: {
          operations: [
            {
              __type: Malloy.ViewOperationType.GroupBy,
              group_by: {
                items: [
                  {
                    field: {
                      expression: {
                        __type: Malloy.ExpressionType.Reference,
                        reference: {name: 'thingy'},
                      },
                    },
                  },
                ],
              },
            },
            {
              __type: Malloy.ViewOperationType.OrderBy,
              order_by: {
                items: [
                  {
                    field: {name: 'thingy'},
                    direction: Malloy.OrderByDirection.ASC,
                  },
                ],
              },
            },
            {
              __type: Malloy.ViewOperationType.Limit,
              limit: {limit: 10},
            },
          ],
        },
      },
    ],
  },
};

export const q3: Malloy.Query = {
  pipeline: {
    stages: [
      // A query which is just a refinement of a top level query
      {
        __type: Malloy.PipeStageType.Refinement,
        refinement: {
          base: {
            __type: Malloy.RefinementBaseType.Reference,
            reference: {name: 'flights_by_carrier'},
          },
          operation: {
            __type: Malloy.RefinementOperationType.Segment,
            segment: {
              operations: [
                {
                  __type: Malloy.ViewOperationType.GroupBy,
                  group_by: {
                    items: [
                      {
                        field: {
                          expression: {
                            __type: Malloy.ExpressionType.Reference,
                            reference: {name: 'thingy'},
                          },
                        },
                      },
                    ],
                  },
                },
                {
                  __type: Malloy.ViewOperationType.GroupBy,
                  group_by: {
                    items: [
                      {
                        field: {
                          expression: {
                            __type: Malloy.ExpressionType.TimeTruncation,
                            time_truncation: {
                              reference: {name: 'thingy'},
                              truncation: Malloy.TimestampTimeframe.DAY,
                            },
                          },
                        },
                      },
                    ],
                  },
                },
                {
                  __type: Malloy.ViewOperationType.Nest,
                  nest: {
                    items: [
                      {
                        view: {
                          pipeline: {
                            stages: [
                              {
                                __type: Malloy.PipeStageType.Reference,
                                reference: {name: 'foo'},
                              },
                            ],
                          },
                        },
                      },
                    ],
                  },
                },
                {
                  __type: Malloy.ViewOperationType.Nest,
                  nest: {
                    items: [
                      {
                        name: 'thingy',
                        view: {
                          pipeline: {
                            stages: [
                              {
                                __type: Malloy.PipeStageType.Reference,
                                reference: {name: 'by_carrier'},
                              },
                              {
                                __type: Malloy.PipeStageType.Segment,
                                segment: {
                                  operations: [
                                    {
                                      __type: Malloy.ViewOperationType.GroupBy,
                                      group_by: {
                                        annotations: [
                                          {
                                            __type:
                                              Malloy.TagOrAnnotationType
                                                .Annotation,
                                            annotation: {value: '# bar'},
                                          },
                                        ],
                                        items: [
                                          {
                                            name: 'renamed',
                                            field: {
                                              expression: {
                                                __type:
                                                  Malloy.ExpressionType
                                                    .Reference,
                                                reference: {name: 'thingy'},
                                              },
                                              annotations: [
                                                {
                                                  __type:
                                                    Malloy.TagOrAnnotationType
                                                      .Annotation,
                                                  annotation: {value: '# foo'},
                                                },
                                              ],
                                            },
                                          },
                                        ],
                                      },
                                    },
                                    {
                                      __type: Malloy.ViewOperationType.OrderBy,
                                      order_by: {
                                        items: [
                                          {
                                            field: {name: 'thingy'},
                                            direction:
                                              Malloy.OrderByDirection.ASC,
                                          },
                                        ],
                                      },
                                    },
                                    {
                                      __type: Malloy.ViewOperationType.Limit,
                                      limit: {limit: 10},
                                    },
                                  ],
                                },
                              },
                            ],
                          },
                        },
                      },
                    ],
                  },
                },
                {
                  __type: Malloy.ViewOperationType.OrderBy,
                  order_by: {
                    items: [
                      {
                        field: {name: 'thingy'},
                        direction: Malloy.OrderByDirection.ASC,
                      },
                    ],
                  },
                },
                {
                  __type: Malloy.ViewOperationType.Where,
                  where: {
                    items: [
                      {
                        __type: Malloy.WhereItemType.FilterString,
                        filter_string: {field: {name: 'carrier'}, filter: 'WN'},
                      },
                    ],
                  },
                },
                {
                  __type: Malloy.ViewOperationType.Limit,
                  limit: {limit: 10},
                },
              ],
            },
          },
        },
      },
    ],
  },
};

export const res: Malloy.Result = {
  data: {
    __type: Malloy.DataType.Table,
    table: {
      rows: [
        {
          cells: [
            {
              __type: Malloy.CellType.StringCell,
              string_cell: {string_value: 'UA'},
            },
            {
              __type: Malloy.CellType.NumberCell,
              number_cell: {number_value: 12341234},
            },
          ],
        },
        {
          cells: [
            {
              __type: Malloy.CellType.StringCell,
              string_cell: {string_value: 'AA'},
            },
            {
              __type: Malloy.CellType.NumberCell,
              number_cell: {number_value: 2343},
            },
          ],
        },
      ],
    },
  },
  schema: {
    fields: [
      {
        __type: Malloy.FieldInfoType.Dimension,
        dimension: {
          name: 'carrier',
          type: {
            __type: Malloy.AtomicTypeType.StringType,
            string_type: {},
          },
        },
      },
      {
        __type: Malloy.FieldInfoType.Dimension,
        // TODO "wasMeasure?"
        dimension: {
          name: 'flight_count',
          type: {
            __type: Malloy.AtomicTypeType.NumberType,
            number_type: {},
          },
        },
      },
    ],
  },
  sql: 'SELECT * ...',
};
