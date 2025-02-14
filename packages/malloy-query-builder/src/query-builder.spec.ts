import {QueryNode} from '.';
// eslint-disable-next-line node/no-extraneous-import
import * as Malloy from '@malloydata/malloy-interfaces';

describe('query builder', () => {
  describe('defaultSegment', () => {
    test('default segment when no stages', () => {
      const qb = new QueryNode({pipeline: {stages: []}});
      // TODO actually add a source...
      const query = qb.editDefaultSegment().addGroupBy('foo');
      const expected: Malloy.Query = {
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
                              name: 'foo',
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
      };
      expect(query).toMatchObject(expected);
    });
    test('default segment when there is already one stage', () => {
      const qb = new QueryNode({pipeline: {stages: []}});
      // TODO actually add a source...
      qb.editDefaultSegment().addGroupBy('foo');
      const query = qb.editDefaultSegment().addGroupBy('bar');
      const expected: Malloy.Query = {
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
                              name: 'foo',
                            },
                          },
                        },
                        {
                          field: {
                            expression: {
                              __type: Malloy.ExpressionType.Reference,
                              name: 'bar',
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
      };
      expect(query).toMatchObject(expected);
    });
    test('cascading deletion', () => {
      const q = new QueryNode({pipeline: {stages: []}});
      q.setSource({name: 'foo', schema: {fields: []}});
      q.source!.parameters.setParameter('foo', 3);
      q.editDefaultSegment().addGroupBy('foo');
      q.editDefaultSegment().addOrderBy('foo', Malloy.OrderByDirection.ASC);
      q.editDefaultSegment().addOrderBy('foo', Malloy.OrderByDirection.DESC);
      // saveState?.index(0).delete();

      q.editGroupByItem([
        'pipeline',
        'stages',
        0,
        'refinements',
        0,
        'operations',
        0,
        'items',
        0,
      ]).delete();
      // saveState?.setParameter('bar', 5);
      expect(q.query).toMatchObject({foo: 'bar'});
    });
  });
  describe('play', () => {
    test('foo', () => {
      const q = new QueryNode({pipeline: {stages: []}});
      q.setSource({name: 'foo', schema: {fields: []}});
      q.source!.parameters.setParameter('foo', 3);
      q.editDefaultSegment().addGroupBy('foo');
      q.editDefaultSegment().editLimit().setLimit(5);
      q.editDefaultSegment().addOrderBy('foo', Malloy.OrderByDirection.ASC);
      q.editDefaultSegment().addOrderBy('foo', Malloy.OrderByDirection.DESC);
      // saveState?.index(0).delete();

      q.editParameter(['source', 'parameters', 0]).setValue(8);
      // saveState?.setParameter('bar', 5);
      expect(q.query).toMatchObject({foo: 'bar'});
    });
  });
});
