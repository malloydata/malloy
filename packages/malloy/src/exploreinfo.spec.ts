/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {getExploreInfo} from './exploreinfo';
import {Model} from './malloy';
import type {
  TableSourceDef,
  SQLSourceDef,
  QuerySourceDef,
  CompositeSourceDef,
} from './model';

// Mock the Model class for testing
jest.mock('./malloy', () => {
  return {
    Model: jest.fn().mockImplementation((modelDef, _problems, _fromSources) => {
      return {
        _modelDef: modelDef,
        getExploreByName: jest.fn().mockImplementation(exploreName => {
          // Return a mock explore based on the name
          if (exploreName === 'simple_table') {
            return {
              structDef: {
                type: 'table',
                connection: 'my_connection',
                tablePath: 'my_table',
                fields: [],
                dialect: 'standardsql',
                name: 'simple_table',
              } as TableSourceDef,
            };
          } else if (exploreName === 'sql_explore') {
            return {
              structDef: {
                type: 'sql_select',
                connection: 'my_connection',
                selectStr: 'SELECT * FROM my_table',
                fields: [],
                dialect: 'standardsql',
                name: 'sql_explore',
              } as SQLSourceDef,
            };
          } else if (exploreName === 'composite_explore') {
            return {
              structDef: {
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
              } as CompositeSourceDef,
            };
          } else if (exploreName === 'explore_with_joins') {
            return {
              structDef: {
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
              } as TableSourceDef,
            };
          } else if (exploreName === 'nested_joins') {
            return {
              structDef: {
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
              } as TableSourceDef,
            };
          } else if (exploreName === 'query_source_explore') {
            return {
              structDef: {
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
              } as QuerySourceDef,
            };
          }

          throw new Error(`Unknown explore name: ${exploreName}`);
        }),
      };
    }),
    PreparedQuery: jest.fn().mockImplementation(() => {
      return {
        getPreparedResult: jest.fn().mockReturnValue({
          sql: 'SELECT * FROM test_query',
        }),
      };
    }),
  };
});

describe('getExploreInfo', () => {
  let model: Model;

  beforeEach(() => {
    // Create a new model instance for each test
    model = new Model(
      {
        name: 'test_model',
        exports: [],
        contents: {},
        queryList: [],
        dependencies: {},
      },
      [],
      []
    );
    jest.clearAllMocks();
  });

  test('should return table source info for a simple table explore', () => {
    const result = getExploreInfo(model, 'simple_table');

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      type: 'table',
      tableName: 'my_table',
      sourceID: 'my_connection:my_table',
    });
    expect(model.getExploreByName).toHaveBeenCalledWith('simple_table');
  });

  test('should return SQL source info for an SQL explore', () => {
    const result = getExploreInfo(model, 'sql_explore');

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      type: 'sql',
      selectStatement: 'SELECT * FROM my_table',
      sourceID: 'my_connection:SELECT * FROM my_table',
    });
    expect(model.getExploreByName).toHaveBeenCalledWith('sql_explore');
  });

  test('should return source info for all sources in a composite explore', () => {
    const result = getExploreInfo(model, 'composite_explore');

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      type: 'table',
      tableName: 'table1',
      sourceID: 'my_connection:table1',
    });
    expect(result[1]).toEqual({
      type: 'table',
      tableName: 'table2',
      sourceID: 'my_connection:table2',
    });
    expect(model.getExploreByName).toHaveBeenCalledWith('composite_explore');
  });

  test('should return source info for main table and joined tables', () => {
    const result = getExploreInfo(model, 'explore_with_joins');

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      type: 'table',
      tableName: 'main_table',
      sourceID: 'my_connection:main_table',
    });
    expect(result[1]).toEqual({
      type: 'table',
      tableName: 'joined_table',
      sourceID: 'my_connection:joined_table',
    });
    expect(model.getExploreByName).toHaveBeenCalledWith('explore_with_joins');
  });

  test('should return source info for nested joins', () => {
    const result = getExploreInfo(model, 'nested_joins');

    expect(result).toHaveLength(4);
    expect(result[0]).toEqual({
      type: 'table',
      tableName: 'main_table',
      sourceID: 'my_connection:main_table',
    });
    expect(result[1]).toEqual({
      type: 'table',
      tableName: 'joined_table1',
      sourceID: 'my_connection:joined_table1',
    });
    expect(result[2]).toEqual({
      type: 'table',
      tableName: 'nested_joined_table',
      sourceID: 'my_connection:nested_joined_table',
    });
    expect(result[3]).toEqual({
      type: 'sql',
      selectStatement: 'SELECT * FROM another_table',
      sourceID: 'my_connection:SELECT * FROM another_table',
    });
    expect(model.getExploreByName).toHaveBeenCalledWith('nested_joins');
  });

  test('should return source info for query source explore', () => {
    const result = getExploreInfo(model, 'query_source_explore');

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      type: 'sql',
      selectStatement: 'SELECT * FROM test_query',
      sourceID: 'my_connection:SELECT * FROM test_query',
    });
    expect(model.getExploreByName).toHaveBeenCalledWith('query_source_explore');
  });

  test('should throw an error for unknown explore name', () => {
    expect(() => {
      getExploreInfo(model, 'unknown_explore');
    }).toThrow('Unknown explore name: unknown_explore');
  });
});
