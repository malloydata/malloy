/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {Model} from '../../api/foundation';
import type {
  TableSourceDef,
  SQLSourceDef,
  QuerySourceDef,
  CompositeSourceDef,
  ModelDef,
  SourceDef,
} from '../malloy_types';

// Helper function to create a Model instance with a specific explore
function createModelWithExplore(exploreDef: SourceDef): Model {
  const modelDef: ModelDef = {
    name: 'test_model',
    exports: [],
    contents: {
      [exploreDef.name]: exploreDef,
    },
    sourceRegistry: {},
    queryList: [],
    dependencies: {},
  };

  return new Model(modelDef, [], []);
}

describe('Explore.getSourceComponents', () => {
  test('should return table source info for a simple table explore', () => {
    // Create a model with a simple table explore
    const tableExplore: TableSourceDef = {
      type: 'table',
      connection: 'my_connection',
      tablePath: 'my_table',
      fields: [],
      dialect: 'standardsql',
      name: 'simple_table',
    };

    const model = createModelWithExplore(tableExplore);
    const result = model.getExploreByName('simple_table').getSourceComponents();

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      type: 'table',
      tableName: 'my_table',
      sourceID: 'my_connection:my_table',
      componentID: 'my_connection:my_table',
    });
  });

  test('should return SQL source info for an SQL explore', () => {
    // Create a model with an SQL explore
    const sqlExplore: SQLSourceDef = {
      type: 'sql_select',
      connection: 'my_connection',
      selectStr: 'SELECT * FROM my_table',
      fields: [],
      dialect: 'standardsql',
      name: 'sql_explore',
    };

    const model = createModelWithExplore(sqlExplore);
    const result = model.getExploreByName('sql_explore').getSourceComponents();

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      type: 'sql',
      selectStatement: 'SELECT * FROM my_table',
      sourceID: 'my_connection:SELECT * FROM my_table',
      componentID: 'my_connection:SELECT * FROM my_table',
    });
  });

  test('should return source info for all sources in a composite explore', () => {
    // Create a model with a composite explore
    const compositeExplore: CompositeSourceDef = {
      type: 'composite',
      sources: [
        {
          type: 'table',
          connection: 'my_connection',
          tablePath: 'table1',
          fields: [],
          dialect: 'standardsql',
          name: 'table1',
        },
        {
          type: 'table',
          connection: 'my_connection',
          tablePath: 'table2',
          fields: [],
          dialect: 'standardsql',
          name: 'table2',
        },
      ],
      fields: [],
      connection: 'my_connection',
      dialect: 'standardsql',
      name: 'composite_explore',
    };

    const model = createModelWithExplore(compositeExplore);
    const result = model
      .getExploreByName('composite_explore')
      .getSourceComponents();

    expect(result).toHaveLength(2);
    // Check that the result contains all expected sources, regardless of order
    expect(result).toEqual(
      expect.arrayContaining([
        {
          type: 'table',
          tableName: 'table1',
          sourceID: 'my_connection:table1',
          componentID: 'my_connection:table1',
        },
        {
          type: 'table',
          tableName: 'table2',
          sourceID: 'my_connection:table2',
          componentID: 'my_connection:table2',
        },
      ])
    );
  });

  test('should return source info for main table and joined tables', () => {
    // Create a model with a table that has joins
    const exploreWithJoins: TableSourceDef = {
      type: 'table',
      connection: 'my_connection',
      tablePath: 'main_table',
      fields: [
        {
          type: 'table',
          connection: 'my_connection',
          tablePath: 'joined_table',
          fields: [],
          onExpression: {
            node: 'filterCondition',
            code: 'main_table.id = joined_table.main_id',
            expressionType: 'scalar',
            e: {node: 'true'},
          },
          join: 'one',
          name: 'joined_data',
          dialect: 'standardsql',
        },
      ],
      dialect: 'standardsql',
      name: 'explore_with_joins',
    };

    const model = createModelWithExplore(exploreWithJoins);
    const result = model
      .getExploreByName('explore_with_joins')
      .getSourceComponents();

    expect(result).toHaveLength(2);
    // Check that the result contains all expected sources, regardless of order
    expect(result).toEqual(
      expect.arrayContaining([
        {
          type: 'table',
          tableName: 'main_table',
          sourceID: 'my_connection:main_table',
          componentID: 'my_connection:main_table',
        },
        {
          type: 'table',
          tableName: 'joined_table',
          sourceID: 'my_connection:joined_table',
          componentID: 'my_connection:joined_table',
        },
      ])
    );
  });

  test('should return source info for nested joins', () => {
    // Create a model with nested joins
    const nestedJoinsExplore: TableSourceDef = {
      type: 'table',
      connection: 'my_connection',
      tablePath: 'main_table',
      fields: [
        {
          type: 'table',
          connection: 'my_connection',
          tablePath: 'joined_table1',
          fields: [
            {
              type: 'table',
              connection: 'my_connection',
              tablePath: 'nested_joined_table',
              fields: [],
              onExpression: {
                node: 'filterCondition',
                code: 'joined_table1.id = nested_joined_table.joined_id',
                expressionType: 'scalar',
                e: {node: 'true'},
              },
              join: 'one',
              name: 'nested_join',
              dialect: 'standardsql',
            },
          ],
          onExpression: {
            node: 'filterCondition',
            code: 'main_table.id = joined_table1.main_id',
            expressionType: 'scalar',
            e: {node: 'true'},
          },
          join: 'one',
          name: 'joined_data1',
          dialect: 'standardsql',
        },
        {
          type: 'sql_select',
          connection: 'my_connection',
          selectStr: 'SELECT * FROM another_table',
          fields: [],
          onExpression: {
            node: 'filterCondition',
            code: 'main_table.id = another_table.main_id',
            expressionType: 'scalar',
            e: {node: 'true'},
          },
          join: 'one',
          name: 'joined_data2',
          dialect: 'standardsql',
        },
      ],
      dialect: 'standardsql',
      name: 'nested_joins',
    };

    const model = createModelWithExplore(nestedJoinsExplore);
    const result = model.getExploreByName('nested_joins').getSourceComponents();

    expect(result).toHaveLength(4);
    // Check that the result contains all expected sources, regardless of order
    expect(result).toEqual(
      expect.arrayContaining([
        {
          type: 'table',
          tableName: 'main_table',
          sourceID: 'my_connection:main_table',
          componentID: 'my_connection:main_table',
        },
        {
          type: 'table',
          tableName: 'joined_table1',
          sourceID: 'my_connection:joined_table1',
          componentID: 'my_connection:joined_table1',
        },
        {
          type: 'table',
          tableName: 'nested_joined_table',
          sourceID: 'my_connection:nested_joined_table',
          componentID: 'my_connection:nested_joined_table',
        },
        {
          type: 'sql',
          selectStatement: 'SELECT * FROM another_table',
          sourceID: 'my_connection:SELECT * FROM another_table',
          componentID: 'my_connection:SELECT * FROM another_table',
        },
      ])
    );
  });

  test('should return source info for query source explore', () => {
    // Create a model with a query source explore
    // We need to mock the PreparedQuery behavior for this test
    const originalPreparedQuery = jest.requireActual(
      '../../api/foundation'
    ).PreparedQuery;
    jest
      .spyOn(originalPreparedQuery.prototype, 'getPreparedResult')
      .mockReturnValue({
        sql: 'SELECT * FROM test_query',
      });

    const querySourceExplore: QuerySourceDef = {
      type: 'query_source',
      connection: 'my_connection',
      query: {
        name: 'test_query',
        structRef: 'some_struct',
        pipeline: [],
      },
      fields: [],
      dialect: 'standardsql',
      name: 'query_source_explore',
    };

    const model = createModelWithExplore(querySourceExplore);

    // Mock the PreparedQuery for this specific test
    jest.spyOn(model, '_modelDef', 'get').mockReturnValue({
      name: 'test_model',
      exports: [],
      contents: {
        'query_source_explore': querySourceExplore,
      },
      sourceRegistry: {},
      queryList: [],
      dependencies: {},
    });

    const result = model
      .getExploreByName('query_source_explore')
      .getSourceComponents();

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      type: 'sql',
      selectStatement: 'SELECT * FROM test_query',
      sourceID: 'my_connection:SELECT * FROM test_query',
      componentID: 'my_connection:SELECT * FROM test_query',
    });
  });
});
