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
    const from = {
      pipeline: {stages: []},
      source: {name: 'foo'},
    };
    expect((q: ASTQuery) => {
      q.getOrCreateDefaultSegment().addOrderBy(
        'baz',
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
                      __type: Malloy.ViewOperationType.OrderBy,
                      items: [
                        {
                          field: {name: 'baz'},
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
      malloy: 'run: foo -> { order_by: baz asc }',
    });
  });
  test('add a group by', () => {
    const from = {
      pipeline: {stages: []},
      source: {name: 'flights'},
    };
    expect((q: ASTQuery) => {
      q.getOrCreateDefaultSegment().addGroupBy('carrier');
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
      const seg = q.getOrCreateDefaultSegment();
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
});
