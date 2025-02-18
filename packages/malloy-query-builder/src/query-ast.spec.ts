/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

// eslint-disable-next-line node/no-extraneous-import
import * as Malloy from '@malloydata/malloy-interfaces';
import {flights_model} from './flights_model';
import './expects';
import {ASTQuery} from './query-ast';

describe('query builder', () => {
  test('add an order by', () => {
    const from: Malloy.Query = {
      pipeline: {
        stages: [
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
                            name: 'carrier',
                          },
                        },
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
      source: {name: 'flights'},
    };
    expect((q: ASTQuery) => {
      q.getOrAddDefaultSegment().addOrderBy(
        'carrier',
        Malloy.OrderByDirection.ASC
      );
    }).toModifyQuery({
      model: flights_model,
      from,
      to: {
        pipeline: {
          stages: [
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
                              name: 'carrier',
                            },
                          },
                        },
                      ],
                    },
                    {
                      __type: Malloy.ViewOperationType.OrderBy,
                      items: [
                        {
                          field: {name: 'carrier'},
                          direction: Malloy.OrderByDirection.ASC,
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
        source: from.source,
      },
      malloy: `run: flights -> {
  group_by: carrier
  order_by: carrier asc
}`,
    });
  });
  test('add a group by', () => {
    const from = {
      pipeline: {stages: []},
      source: {name: 'flights'},
    };
    expect((q: ASTQuery) => {
      q.getOrAddDefaultSegment().addGroupBy('carrier');
    }).toModifyQuery({
      model: flights_model,
      from,
      to: {
        pipeline: {
          stages: [
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
                              name: 'carrier',
                            },
                          },
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
        source: from.source,
      },
      malloy: 'run: flights -> { group_by: carrier }',
    });
  });
  test('add two group bys', () => {
    const from = {
      pipeline: {stages: []},
      source: {name: 'flights'},
    };
    expect((q: ASTQuery) => {
      const seg = q.getOrAddDefaultSegment();
      seg.addGroupBy('carrier');
      seg.addGroupBy('origin_code');
    }).toModifyQuery({
      model: flights_model,
      from,
      to: {
        pipeline: {
          stages: [
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
                              name: 'carrier',
                            },
                          },
                        },
                        {
                          field: {
                            expression: {
                              __type: Malloy.ExpressionType.Reference,
                              name: 'origin_code',
                            },
                          },
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
        source: from.source,
      },
      malloy: `
run: flights -> {
  group_by:
    carrier
    origin_code
}`.trim(),
    });
  });
  test('add a nest', () => {
    const from = {
      pipeline: {stages: []},
      source: {name: 'flights'},
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
        pipeline: {
          stages: [
            {
              refinements: [
                {
                  __type: Malloy.RefinementType.Segment,
                  operations: [
                    {
                      __type: Malloy.ViewOperationType.Nest,
                      items: [
                        {
                          name: 'by_carrier',
                          view: {
                            pipeline: {
                              stages: [
                                {
                                  refinements: [
                                    {
                                      __type: Malloy.RefinementType.Segment,
                                      operations: [
                                        {
                                          __type:
                                            Malloy.ViewOperationType.GroupBy,
                                          items: [
                                            {
                                              field: {
                                                expression: {
                                                  __type:
                                                    Malloy.ExpressionType
                                                      .Reference,
                                                  name: 'carrier',
                                                },
                                              },
                                            },
                                          ],
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
                  ],
                },
              ],
            },
          ],
        },
        source: from.source,
      },
      malloy: 'run: flights -> { nest: by_carrier is { group_by: carrier } }',
    });
  });
  test('nest via field reference', () => {
    const from = {
      pipeline: {stages: []},
      source: {name: 'flights'},
    };
    expect((q: ASTQuery) => {
      const seg = q.getOrAddDefaultSegment();
      seg.addNest('by_month');
    }).toModifyQuery({
      model: flights_model,
      from,
      to: {
        pipeline: {
          stages: [
            {
              refinements: [
                {
                  __type: Malloy.RefinementType.Segment,
                  operations: [
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
                                      name: 'by_month',
                                    },
                                  ],
                                },
                              ],
                            },
                          },
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
        source: from.source,
      },
      malloy: 'run: flights -> { nest: by_month }',
    });
  });
  test('add limit', () => {
    const from = {
      pipeline: {stages: []},
      source: {name: 'flights'},
    };
    expect((q: ASTQuery) => {
      const seg = q.getOrAddDefaultSegment();
      seg.setLimit(10);
    }).toModifyQuery({
      model: flights_model,
      from,
      to: {
        pipeline: {
          stages: [
            {
              refinements: [
                {
                  __type: Malloy.RefinementType.Segment,
                  operations: [
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
        source: from.source,
      },
      malloy: 'run: flights -> { limit: 10 }',
    });
  });
  test('change limit', () => {
    const from: Malloy.Query = {
      pipeline: {
        stages: [
          {
            refinements: [
              {
                __type: Malloy.RefinementType.Segment,
                operations: [
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
      source: {name: 'flights'},
    };
    expect((q: ASTQuery) => {
      const seg = q.getOrAddDefaultSegment();
      seg.setLimit(20);
    }).toModifyQuery({
      model: flights_model,
      from,
      to: {
        pipeline: {
          stages: [
            {
              refinements: [
                {
                  __type: Malloy.RefinementType.Segment,
                  operations: [
                    {
                      __type: Malloy.ViewOperationType.Limit,
                      limit: 20,
                    },
                  ],
                },
              ],
            },
          ],
        },
        source: from.source,
      },
      malloy: 'run: flights -> { limit: 20 }',
    });
  });
});
