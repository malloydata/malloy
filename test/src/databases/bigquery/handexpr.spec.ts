/*
 * Copyright 2023 Google LLC
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files
 * (the "Software"), to deal in the Software without restriction,
 * including without limitation the rights to use, copy, modify, merge,
 * publish, distribute, sublicense, and/or sell copies of the Software,
 * and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

/* eslint-disable no-console */

import type {ModelDef, Query, StructDef} from '@malloydata/malloy';
import {describeIfDatabaseAvailable, fStringLike, fToQF} from '../../util';

import * as malloy from '@malloydata/malloy';
import {RuntimeList} from '../../runtimes';
const [describe] = describeIfDatabaseAvailable(['bigquery']);

describe('BigQuery hand-built expression test', () => {
  const runtimes = new RuntimeList(['bigquery']);

  afterAll(async () => {
    await runtimes.closeAll();
  });

  function withJoin(
    sd: malloy.TableSourceDef,
    join: 'one' | 'many',
    as: string,
    keyExpr: string
  ): malloy.JoinFieldDef {
    const [leftKey, rightKey] = keyExpr.split('=');
    const ret: malloy.JoinFieldDef = {
      ...sd,
      join,
      onExpression: {
        node: '=',
        kids: {
          left: {node: 'field', path: leftKey.split('.')},
          right: {node: 'field', path: rightKey.split('.')},
        },
      },
    };
    if (as !== ret.name) {
      ret.as = as;
    }
    return ret;
  }

  async function validateCompilation(
    databaseName: string,
    sql: string
  ): Promise<boolean> {
    try {
      const runtime = runtimes.runtimeMap.get(databaseName);
      if (runtime === undefined) {
        throw new Error(`Unknown database ${databaseName}`);
      }
      await (
        await runtime.connections.lookupConnection(databaseName)
      ).runSQL(`WITH test AS(\n${sql}) SELECT 1`);
    } catch (e) {
      console.log(`SQL: didn't compile\n=============\n${sql}`);
      throw e;
    }
    return true;
  }

  function compileHandQueryToSQL(
    model: malloy.ModelMaterializer,
    queryDef: Query
  ): Promise<string> {
    return model._loadQueryFromQueryDef(queryDef).getSQL();
  }

  const modelHandBase: malloy.TableSourceDef = {
    name: 'malloydata-org.malloytest.aircraft_models',
    as: 'aircraft_models',
    type: 'table',
    dialect: 'standardsql',
    tablePath: 'malloydata-org.malloytest.aircraft_models',
    connection: 'bigquery',
    fields: [
      {type: 'string', name: 'aircraft_model_code'},
      {type: 'string', name: 'manufacturer'},
      {type: 'string', name: 'model'},
      {type: 'number', name: 'aircraft_type_id', numberType: 'integer'},
      {
        type: 'number',
        name: 'aircraft_engine_type_id',
        numberType: 'integer',
      },
      {
        type: 'number',
        name: 'aircraft_category_id',
        numberType: 'integer',
      },
      {type: 'number', name: 'amateur', numberType: 'integer'},
      {type: 'number', name: 'engines', numberType: 'integer'},
      {type: 'number', name: 'seats', numberType: 'integer'},
      {type: 'number', name: 'weight', numberType: 'integer'},
      {type: 'number', name: 'speed', numberType: 'integer'},
      {
        name: 'model_count',
        type: 'number',
        e: {node: 'aggregate', function: 'count', e: {node: ''}},
        expressionType: 'aggregate',
        numberType: 'float',
      },
      {
        name: 'total_seats',
        type: 'number',
        e: {
          node: 'aggregate',
          function: 'sum',
          e: {node: 'field', path: ['seats']},
        },
        expressionType: 'aggregate',
        numberType: 'float',
      },
      {
        name: 'boeing_seats',
        type: 'number',
        expressionType: 'aggregate',
        e: {
          node: 'filteredExpr',
          kids: {
            e: {
              node: 'aggregate',
              function: 'sum',
              e: {node: 'field', path: ['seats']},
            },
            filterList: [
              {
                node: 'filterCondition',
                expressionType: 'aggregate',
                code: "manufacturer='BOEING'",
                e: {
                  node: '=',
                  kids: {
                    left: {node: 'field', path: ['manufacturer']},
                    right: {node: 'stringLiteral', literal: 'BOEING'},
                  },
                },
              },
            ],
          },
        },
        numberType: 'float',
      },
      {
        name: 'percent_boeing',
        type: 'number',
        e: malloy.composeSQLExpr([
          '(',
          {node: 'field', path: ['boeing_seats']},
          '/',
          {node: 'field', path: ['total_seats']},
          ')*100',
        ]),
        expressionType: 'aggregate',
        numberType: 'float',
      },
      {
        name: 'percent_boeing_floor',
        type: 'number',
        expressionType: 'aggregate',
        e: malloy.composeSQLExpr([
          'FLOOR(',
          {node: 'field', path: ['percent_boeing']},
          ')',
        ]),
        numberType: 'float',
      },
    ],
    primaryKey: 'aircraft_model_code',
  };

  const aircraftHandBase: StructDef = {
    name: 'malloydata-org.malloytest.aircraft',
    dialect: 'standardsql',
    type: 'table',
    tablePath: 'malloydata-org.malloytest.aircraft',
    connection: 'bigquery',
    fields: [
      {type: 'string', name: 'tail_num'},
      {type: 'string', name: 'aircraft_serial'},
      {type: 'string', name: 'aircraft_model_code'},
      {type: 'string', name: 'aircraft_engine_code'},
      {type: 'number', name: 'year_built', numberType: 'integer'},
      {type: 'number', name: 'aircraft_type_id', numberType: 'integer'},
      {
        type: 'number',
        name: 'aircraft_engine_type_id',
        numberType: 'integer',
      },
      {
        type: 'number',
        name: 'registrant_type_id',
        numberType: 'integer',
      },
      {type: 'string', name: 'name'},
      {type: 'string', name: 'address1'},
      {type: 'string', name: 'address2'},
      {type: 'string', name: 'city'},
      {type: 'string', name: 'state'},
      {type: 'string', name: 'zip'},
      {type: 'string', name: 'region'},
      {type: 'string', name: 'county'},
      {type: 'string', name: 'country'},
      {type: 'string', name: 'certification'},
      {type: 'string', name: 'status_code'},
      {type: 'string', name: 'mode_s_code'},
      {type: 'string', name: 'fract_owner'},
      {type: 'date', name: 'last_action_date'},
      {type: 'date', name: 'cert_issue_date'},
      {type: 'date', name: 'air_worth_date'},
      {
        name: 'aircraft_count',
        type: 'number',
        e: {node: 'aggregate', function: 'count', e: {node: ''}},
        expressionType: 'aggregate',
        numberType: 'float',
      },
      {
        type: 'turtle',
        name: 'hand_turtle',
        pipeline: [{type: 'reduce', queryFields: fToQF(['aircraft_count'])}],
      },
      {
        type: 'turtle',
        name: 'hand_turtle_pipeline',
        pipeline: [
          {type: 'reduce', queryFields: fToQF(['aircraft_count'])},
          {type: 'reduce', queryFields: fToQF(['aircraft_count'])},
        ],
      },
      withJoin(
        modelHandBase,
        'one',
        'aircraft_models',
        'aircraft_model_code=aircraft_models.aircraft_model_code'
      ),
    ],
    primaryKey: 'tail_num',
    as: 'aircraft',
  };

  const handCodedModel: ModelDef = {
    name: 'Hand Coded Models',
    exports: ['aircraft'],
    contents: {
      aircraft: aircraftHandBase,
    },
    queryList: [],
    dependencies: {},
  };

  // BigQuery tests only on the Hand Coded models.
  const bqRuntime = runtimes.runtimeMap.get('bigquery');
  if (!bqRuntime) {
    throw new Error("Can't create bigquery RUntime");
  }

  const handModel = bqRuntime._loadModelFromModelDef(handCodedModel);
  const databaseName = 'bigquery';

  it(`hand query hand model - ${databaseName}`, async () => {
    const sql = await compileHandQueryToSQL(handModel, {
      structRef: 'aircraft',
      pipeline: [
        {
          type: 'reduce',
          queryFields: [
            // "aircraft_models.total_seats",
            // "aircraft_models.boeing_seats"
            // "aircraft_models.percent_boeing",
            // {
            //   type: "number",
            //   name: "my_boeing_seats",
            //   aggregate: true,
            //   e: [
            //     {
            //       type: "filterExpression",
            //  fieldDef    e: [{ type: "field", path: "aircraft_models.total_seats" }],
            //     },
            //   ],
            // },
            {
              name: 'total_seats',
              type: 'number',
              expressionType: 'aggregate',
              e: {
                node: 'filteredExpr',
                kids: {
                  e: {
                    node: 'aggregate',
                    function: 'sum',
                    e: {node: 'field', path: ['aircraft_models', 'seats']},
                  },
                  filterList: [
                    {
                      node: 'filterCondition',
                      expressionType: 'aggregate',
                      code: "manufacturer='BOEING'",
                      e: malloy.composeSQLExpr([
                        {
                          node: 'field',
                          path: ['aircraft_models', 'manufacturer'],
                        },
                        "='BOEING'",
                      ]),
                    },
                  ],
                },
              },
            },
            // {
            //   name: "aircraft_models.total_seats",
            //   as: "my_boeing_seats2",
            //   filterList: [fStringEq("aircraft_models.manufacturer", "BOEING")],
            // },
          ],
        },
      ],
    });
    await validateCompilation(databaseName, sql);
    // console.log(result.sql);
    // expect(result.data.value[0].total_seats).toBe(452415);
  });

  it(`hand turtle - ${databaseName}`, async () => {
    const result = await handModel
      ._loadQueryFromQueryDef({
        structRef: 'aircraft',
        name: 'hand_turtle',
        pipeline: [{type: 'reduce', queryFields: fToQF(['aircraft_count'])}],
      })
      .run();
    expect(result.data.value[0]['aircraft_count']).toBe(3599);
  });

  it(`hand turtle malloy - ${databaseName}`, async () => {
    const result = await handModel
      .loadQuery(
        `
      run: aircraft->hand_turtle
  `
      )
      .run();
    expect(result.data.value[0]['aircraft_count']).toBe(3599);
  });

  it(`default sort order - ${databaseName}`, async () => {
    const result = await handModel
      .loadQuery(
        `
        run: aircraft->{
          group_by: state
          aggregate: aircraft_count
          limit: 10
        }
      `
      )
      .run();
    expect(result.data.value[0]['aircraft_count']).toBe(367);
  });

  it(`default sort order by dir - ${databaseName}`, async () => {
    const result = await handModel
      .loadQuery(
        `
        run: aircraft->{
          group_by: state
          aggregate: aircraft_count
          order_by: 2
          limit:10
        }
      `
      )
      .run();
    expect(result.data.value[0]['aircraft_count']).toBe(1);
  });

  it(`hand turtle2 - ${databaseName}`, async () => {
    const sql = await compileHandQueryToSQL(handModel, {
      structRef: 'aircraft',
      pipeline: [
        {
          type: 'reduce',
          queryFields: fToQF([
            'state',
            'aircraft_count',
            {
              type: 'turtle',
              name: 'my_turtle',
              pipeline: [
                {
                  type: 'reduce',
                  queryFields: fToQF(['county', 'aircraft_count']),
                },
              ],
            },
          ]),
        },
      ],
    });
    await validateCompilation(databaseName, sql);
    // console.log(result.sql);
    // expect(result.data.value[0].total_seats).toBe(452415);
  });

  it(`hand total - ${databaseName}`, async () => {
    const sql = await compileHandQueryToSQL(handModel, {
      structRef: 'aircraft',
      pipeline: [
        {
          type: 'reduce',
          queryFields: fToQF([
            'state',
            'aircraft_count',
            {
              name: 'total_aircraft',
              type: 'number',
              expressionType: 'aggregate',
              e: {
                node: 'exclude',
                e: {node: 'field', path: ['aircraft_count']},
              },
            },
          ]),
        },
      ],
    });
    await validateCompilation(databaseName, sql);
    // console.log(sql);
    // expect(result.data.value[0].total_seats).toBe(452415);
  });

  it(`hand turtle3 - ${databaseName}`, async () => {
    const sql = await compileHandQueryToSQL(handModel, {
      structRef: 'aircraft',
      pipeline: [
        {
          type: 'reduce',
          queryFields: fToQF(['state', 'aircraft_count', 'hand_turtle']),
        },
      ],
    });
    await validateCompilation(databaseName, sql);
    // console.log(result.sql);
    // expect(result.data.value[0].total_seats).toBe(452415);
  });

  it(`hand turtle total - ${databaseName}`, async () => {
    const sql = await compileHandQueryToSQL(handModel, {
      structRef: 'aircraft',
      pipeline: [
        {
          type: 'reduce',
          queryFields: fToQF([
            'state',
            'aircraft_count',
            {
              type: 'turtle',
              name: 'my_turtle',
              pipeline: [
                {
                  type: 'reduce',
                  queryFields: fToQF([
                    'county',
                    'aircraft_count',
                    {
                      name: 'total_aircraft',
                      type: 'number',
                      expressionType: 'aggregate',
                      e: {
                        node: 'exclude',
                        e: {node: 'field', path: ['aircraft_count']},
                      },
                    },
                  ]),
                },
              ],
            },
          ]),
        },
      ],
    });
    await validateCompilation(databaseName, sql);
    // console.log(sql);
    // expect(result.data.value[0].total_seats).toBe(452415);
  });

  it(`hand: declared pipeline as main query - ${databaseName}`, async () => {
    const sql = await compileHandQueryToSQL(handModel, {
      structRef: 'aircraft',
      name: 'hand_turtle_pipeline',
      pipeline: [
        {type: 'reduce', queryFields: fToQF(['aircraft_count'])},
        {type: 'reduce', queryFields: fToQF(['aircraft_count'])},
      ],
    });
    // console.log(result.sql);
    await validateCompilation(databaseName, sql);
    // console.log(result.sql);
    // expect(result.data.value[0].total_seats).toBe(452415);
  });

  it(`hand: turtle is pipeline - ${databaseName}`, async () => {
    const result = await handModel
      ._loadQueryFromQueryDef({
        structRef: 'aircraft',
        pipeline: [
          {
            type: 'reduce',
            queryFields: fToQF([
              'aircraft_count',
              {
                type: 'turtle',
                name: 'pipe',
                pipeline: [
                  {
                    type: 'reduce',
                    queryFields: fToQF(['state', 'county', 'aircraft_count']),
                  },
                  {
                    type: 'reduce',
                    filterList: [fStringLike('county', '2%')],
                    queryFields: fToQF([
                      'state',
                      {
                        name: 'total_aircraft',
                        type: 'number',
                        e: {
                          node: 'aggregate',
                          function: 'sum',
                          e: {node: 'field', path: ['aircraft_count']},
                        },
                        expressionType: 'aggregate',
                        numberType: 'float',
                      },
                    ]),
                  },
                ],
              },
            ]),
          },
        ],
      })
      .run();
    expect(result.data.path(0, 'pipe', 0, 'total_aircraft').value).toBe(61);
  });

  // Hand model basic calculations for sum, filtered sum, without a join.
  it(`hand: lots of kinds of sums - ${databaseName}`, async () => {
    const result = await handModel
      .loadQuery(
        `
            run: aircraft->{
              aggregate:
                aircraft_models.total_seats,
                total_seats2 is sum(aircraft_models.seats),
                total_seats3 is aircraft_models.sum(aircraft_models.seats),
                aircraft_models.boeing_seats,
                boeing_seats2 is aircraft_models.sum(aircraft_models.seats) { where: aircraft_models.manufacturer ? 'BOEING'},
                boeing_seats3 is aircraft_models.boeing_seats { where: aircraft_models.manufacturer ? ~'B%'}
            }
          `
      )
      .run();
    // console.log(result.sql);
    expect(result.data.value[0]['total_seats']).toBe(18294);
    expect(result.data.value[0]['total_seats2']).toBe(31209);
    expect(result.data.value[0]['total_seats3']).toBe(18294);
    expect(result.data.value[0]['boeing_seats']).toBe(6244);
    expect(result.data.value[0]['boeing_seats2']).toBe(6244);
    expect(result.data.value[0]['boeing_seats3']).toBe(6244);
  });

  it(`hand: bad root name for pathed sum - ${databaseName}`, async () => {
    const result = await handModel
      .loadQuery(
        `
          run: aircraft->{
            aggregate: total_seats3 is aircraft_models.sum(aircraft_models.seats)
          }
            `
      )
      .run();
    // console.log(result.sql);
    expect(result.data.value[0]['total_seats3']).toBe(18294);
  });

  // WORKs: (hand coded model):
  // Model based version of sums.
  it(`hand: expression fixups. - ${databaseName}`, async () => {
    const result = await handModel
      .loadQuery(
        `
              run: aircraft->{
                aggregate:
                  aircraft_models.total_seats,
                  aircraft_models.boeing_seats
              }
            `
      )
      .run();
    expect(result.data.value[0]['total_seats']).toBe(18294);
    expect(result.data.value[0]['boeing_seats']).toBe(6244);
  });

  it(`model: filtered measures - ${databaseName}`, async () => {
    const result = await handModel
      .loadQuery(
        `
              run: aircraft->{
                aggregate: boeing_seats is aircraft_models.total_seats { where: aircraft_models.manufacturer ?'BOEING'}
              }
            `
      )
      .run();
    expect(result.data.value[0]['boeing_seats']).toBe(6244);
  });

  // does the filter force a join?
  it(`model: do filters force dependant joins? - ${databaseName}`, async () => {
    const result = await handModel
      .loadQuery(
        `
              run: aircraft->{
                aggregate: boeing_aircraft is count() { where:aircraft_models.manufacturer ?'BOEING'}
              }
            `
      )
      .run();
    expect(result.data.value[0]['boeing_aircraft']).toBe(69);
  });

  // Works: Generate query using named alias.
  it(`hand: filtered measures - ${databaseName}`, async () => {
    const result = await handModel
      ._loadQueryFromQueryDef({
        structRef: 'aircraft',
        pipeline: [
          {
            type: 'reduce',
            queryFields: [
              {
                name: 'boeing_seats',
                type: 'number',
                expressionType: 'aggregate',
                e: {
                  node: 'filteredExpr',
                  kids: {
                    e: {
                      node: 'aggregate',
                      function: 'sum',
                      structPath: ['aircraft_models'],
                      e: {node: 'field', path: ['aircraft_models', 'seats']},
                    },
                    filterList: [
                      {
                        node: 'filterCondition',
                        expressionType: 'aggregate',
                        code: "manufacturer='BOEING'",
                        e: malloy.composeSQLExpr([
                          {
                            node: 'field',
                            path: ['aircraft_models', 'manufacturer'],
                          },
                          "='BOEING'",
                        ]),
                      },
                    ],
                  },
                },
              },
            ],
          },
        ],
      })
      .run();
    // console.log(result.sql);
    expect(result.data.value[0]['boeing_seats']).toBe(6244);
  });

  const joinModelAircraftHandStructDef: StructDef = {
    ...modelHandBase,
    as: 'model_aircraft',
    fields: [
      ...modelHandBase.fields,
      withJoin(
        aircraftHandBase,
        'many',
        'aircraft',
        'aircraft_model_code=aircraft.aircraft_model_code'
      ),
    ],
  };

  // Join tests

  const joinModel: ModelDef = {
    name: 'Hand Coded Join Models',
    exports: ['model_aircraft'],
    contents: {
      model_aircraft: joinModelAircraftHandStructDef,
    },
    queryList: [],
    dependencies: {},
  };

  const handJoinModel = bqRuntime._loadModelFromModelDef(joinModel);

  it(`hand join ON - ${databaseName}`, async () => {
    const sql = await handJoinModel
      ._loadQueryFromQueryDef({
        structRef: 'model_aircraft',
        pipeline: [
          {
            type: 'reduce',
            queryFields: fToQF([
              'aircraft.state',
              'aircraft.aircraft_count',
              'model_count',
            ]),
          },
        ],
      })
      .getSQL();
    await validateCompilation(databaseName, sql);
    // console.log(result.sql);
    // expect(result.data.value[0].total_seats).toBe(452415);
  });

  it(`hand join symmetric agg - ${databaseName}`, async () => {
    const result = await handJoinModel
      ._loadQueryFromQueryDef({
        structRef: 'model_aircraft',
        pipeline: [
          {
            type: 'reduce',
            queryFields: fToQF(['total_seats', 'aircraft.aircraft_count']),
          },
        ],
      })
      .run();
    // await bqCompile(databaseName, result.sql);
    // console.log(result.data.value);
    expect(result.data.value[0]['total_seats']).toBe(452415);
    expect(result.data.value[0]['aircraft_count']).toBe(62644);
  });
});
