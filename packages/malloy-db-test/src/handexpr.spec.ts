/* eslint-disable no-console */
/*
 * Copyright 2021 Google LLC
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * version 2 as published by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without evenro the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 */

import { ModelDef, Query, StructDef } from "@malloy-lang/malloy";
import { fStringEq, fStringLike } from "./test_utils";

import * as malloy from "@malloy-lang/malloy";
import { getRuntimes } from "./runtimes";

const runtimes = getRuntimes(["bigquery"]);

async function validateCompilation(
  databaseName: string,
  sql: string
): Promise<boolean> {
  try {
    const runtime = runtimes.get(databaseName);
    if (runtime === undefined) {
      throw new Error(`Unknown database ${databaseName}`);
    }
    await (
      await runtime.getRunner().getSqlRunner(databaseName)
    ).runSql(`WITH test AS(\n${sql}) SELECT 1`);
  } catch (e) {
    console.log(`SQL: didn't compile\n=============\n${sql}`);
    throw e;
  }
  return true;
}

async function compileHandQueryToSql(
  model: malloy.ModelRuntimeRequest,
  queryDef: Query
): Promise<string> {
  return (
    await model._makeQueryFromQueryDef(queryDef).getSql().build()
  ).getSql();
}

export const modelHandBase: StructDef = {
  name: "malloy-303216.malloytest.aircraft_models",
  as: "aircraft_models",
  type: "struct",
  dialect: "standardsql",
  structSource: { type: "table" },
  structRelationship: { type: "basetable", connectionName: "bigquery" },
  fields: [
    { type: "string", name: "aircraft_model_code" },
    { type: "string", name: "manufacturer" },
    { type: "string", name: "model" },
    { type: "number", name: "aircraft_type_id", numberType: "integer" },
    {
      type: "number",
      name: "aircraft_engine_type_id",
      numberType: "integer",
    },
    { type: "number", name: "aircraft_category_id", numberType: "integer" },
    { type: "number", name: "amateur", numberType: "integer" },
    { type: "number", name: "engines", numberType: "integer" },
    { type: "number", name: "seats", numberType: "integer" },
    { type: "number", name: "weight", numberType: "integer" },
    { type: "number", name: "speed", numberType: "integer" },
    {
      name: "model_count",
      type: "number",
      e: [{ type: "aggregate", function: "count", e: [] }],
      aggregate: true,
      numberType: "float",
    },
    {
      name: "total_seats",
      type: "number",
      e: [
        {
          type: "aggregate",
          function: "sum",
          e: [{ type: "field", path: "seats" }],
        },
      ],
      aggregate: true,
      numberType: "float",
    },
    {
      name: "boeing_seats",
      type: "number",
      e: [
        {
          type: "filterExpression",
          e: [
            {
              type: "aggregate",
              function: "sum",
              e: [{ type: "field", path: "seats" }],
            },
          ],
          filterList: [
            {
              aggregate: false,
              source: "manufacturer='BOEING'",
              expression: [
                {
                  type: "field",
                  path: "manufacturer",
                },
                "='BOEING'",
              ],
            },
          ],
        },
      ],
      aggregate: true,
      numberType: "float",
    },
    {
      name: "percent_boeing",
      type: "number",
      e: [
        "(",
        { type: "field", path: "boeing_seats" },
        "/",
        { type: "field", path: "total_seats" },
        ")*100",
      ],
      aggregate: true,
      numberType: "float",
    },
    {
      name: "percent_boeing_floor",
      type: "number",
      aggregate: true,
      e: ["FLOOR(", { type: "field", path: "percent_boeing" }, ")"],
      numberType: "float",
    },
  ],
  primaryKey: "aircraft_model_code",
};

export const aircraftHandBase: StructDef = {
  type: "struct",
  name: "databamalloy-303216.malloytestseName.aircraft",
  dialect: "standardsql",
  structSource: { type: "table" },
  structRelationship: { type: "basetable", connectionName: "bigquery" },
  fields: [
    { type: "string", name: "tail_num" },
    { type: "string", name: "aircraft_serial" },
    { type: "string", name: "aircraft_model_code" },
    { type: "string", name: "aircraft_engine_code" },
    { type: "number", name: "year_built", numberType: "integer" },
    { type: "number", name: "aircraft_type_id", numberType: "integer" },
    { type: "number", name: "aircraft_engine_type_id", numberType: "integer" },
    { type: "number", name: "registrant_type_id", numberType: "integer" },
    { type: "string", name: "name" },
    { type: "string", name: "address1" },
    { type: "string", name: "address2" },
    { type: "string", name: "city" },
    { type: "string", name: "state" },
    { type: "string", name: "zip" },
    { type: "string", name: "region" },
    { type: "string", name: "county" },
    { type: "string", name: "country" },
    { type: "string", name: "certification" },
    { type: "string", name: "status_code" },
    { type: "string", name: "mode_s_code" },
    { type: "string", name: "fract_owner" },
    { type: "date", name: "last_action_date" },
    { type: "date", name: "cert_issue_date" },
    { type: "date", name: "air_worth_date" },
    {
      name: "aircraft_count",
      type: "number",
      e: [{ type: "aggregate", function: "count", e: [] }],
      aggregate: true,
      numberType: "float",
    },
    {
      type: "turtle",
      name: "hand_turtle",
      pipeline: [{ type: "reduce", fields: ["aircraft_count"] }],
    },
    {
      type: "turtle",
      name: "hand_turtle_pipeline",
      pipeline: [
        { type: "reduce", fields: [{ name: "aircraft_count", as: "a" }] },
        { type: "reduce", fields: ["a"] },
      ],
    },
  ],
  primaryKey: "tail_num",
  as: "aircraft",
};

export const aircraftHandStructDef: StructDef = {
  ...aircraftHandBase,
  fields: [
    ...aircraftHandBase.fields,
    {
      ...modelHandBase,
      structRelationship: {
        type: "foreignKey",
        foreignKey: "aircraft_model_code",
      },
    },
  ],
};

const handCodedModel: ModelDef = {
  name: "Hand Coded Models",
  exports: ["aircraft"],
  structs: {
    aircraft: aircraftHandStructDef,
  },
};

// BigQuery tests only on the Hand Coded models.
const bqRuntime = runtimes.get("bigquery");
if (!bqRuntime) {
  throw new Error("Can't create bigquery RUntime");
}

const handModel = bqRuntime._makeModelFromModelDef(handCodedModel);
const databaseName = "bigquery";

it(`hand query hand model - ${databaseName}`, async () => {
  const sql = await compileHandQueryToSql(handModel, {
    structRef: "aircraft",
    pipeline: [
      {
        type: "reduce",
        fields: [
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
            name: "aircraft_models.total_seats",
            as: "my_boeing_seats2",
            filterList: [fStringEq("aircraft_models.manufacturer", "BOEING")],
          },
        ],
      },
    ],
  });
  await validateCompilation(databaseName, sql);
  // console.log(result.sql);
  // expect(result.getData().toObject()[0].total_seats).toBe(452415);
});

it(`hand turtle - ${databaseName}`, async () => {
  const result = await handModel
    ._makeQueryFromQueryDef({
      structRef: "aircraft",
      pipeHead: { name: "hand_turtle" },
      pipeline: [],
    })
    .run();
  expect(result.getData().toObject()[0].aircraft_count).toBe(3599);
});

it(`hand turtle malloy - ${databaseName}`, async () => {
  const result = await handModel
    .makeQuery(
      `
explore aircraft | hand_turtle
`
    )
    .run();
  expect(result.getData().toObject()[0].aircraft_count).toBe(3599);
});

it(`default sort order - ${databaseName}`, async () => {
  const result = await handModel
    .makeQuery(
      `
      explore aircraft | reduce state, aircraft_count limit 10
    `
    )
    .run();
  expect(result.getData().toObject()[0].aircraft_count).toBe(367);
});

it(`default sort order by dir - ${databaseName}`, async () => {
  const result = await handModel
    .makeQuery(
      `
      explore aircraft | reduce state, aircraft_count order by 2 limit 10
    `
    )
    .run();
  expect(result.getData().toObject()[0].aircraft_count).toBe(1);
});

it(`hand turtle2 - ${databaseName}`, async () => {
  const sql = await compileHandQueryToSql(handModel, {
    structRef: "aircraft",
    pipeline: [
      {
        type: "reduce",
        fields: [
          "state",
          "aircraft_count",
          {
            type: "turtle",
            name: "my_turtle",
            pipeline: [
              { type: "reduce", fields: ["county", "aircraft_count"] },
            ],
          },
        ],
      },
    ],
  });
  await validateCompilation(databaseName, sql);
  // console.log(result.sql);
  // expect(result.getData().toObject()[0].total_seats).toBe(452415);
});

it(`hand turtle3 - ${databaseName}`, async () => {
  const sql = await compileHandQueryToSql(handModel, {
    structRef: "aircraft",
    pipeline: [
      {
        type: "reduce",
        fields: ["state", "aircraft_count", "hand_turtle"],
      },
    ],
  });
  await validateCompilation(databaseName, sql);
  // console.log(result.sql);
  // expect(result.getData().toObject()[0].total_seats).toBe(452415);
});

it(`hand: declared pipeline as main query - ${databaseName}`, async () => {
  const sql = await compileHandQueryToSql(handModel, {
    structRef: "aircraft",
    pipeHead: { name: "hand_turtle_pipeline" },
    pipeline: [],
  });
  // console.log(result.sql);
  await validateCompilation(databaseName, sql);
  // console.log(result.sql);
  // expect(result.getData().toObject()[0].total_seats).toBe(452415);
});

it(`hand: turtle is pipeline - ${databaseName}`, async () => {
  const result = await handModel
    ._makeQueryFromQueryDef({
      structRef: "aircraft",
      pipeline: [
        {
          type: "reduce",
          fields: [
            "aircraft_count",
            {
              type: "turtle",
              name: "pipe",
              pipeline: [
                {
                  type: "reduce",
                  fields: ["state", "county", "aircraft_count"],
                },
                {
                  type: "reduce",
                  filterList: [fStringLike("county", "2%")],
                  fields: [
                    "state",
                    {
                      name: "total_aircraft",
                      type: "number",
                      e: [
                        {
                          type: "aggregate",
                          function: "sum",
                          e: [{ type: "field", path: "aircraft_count" }],
                        },
                      ],
                      aggregate: true,
                      numberType: "float",
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    })
    .run();
  // console.log(result.sql);
  // await bqCompile(databaseName, result.sql);
  // console.log(result.sql);
  // console.log(result.getData().toObject()[0]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  expect((result.getData().toObject()[0] as any).pipe[0].total_aircraft).toBe(
    61
  );
});

// Hand model basic calculations for sum, filtered sum, without a join.
it(`hand: lots of kinds of sums - ${databaseName}`, async () => {
  const result = await handModel
    .makeQuery(
      `
          explore aircraft | reduce
            aircraft_models.total_seats,
            total_seats2 is sum(aircraft_models.seats),
            total_seats3 is aircraft_models.sum(aircraft_models.seats),
            aircraft_models.boeing_seats,
            boeing_seats2 is aircraft_models.sum(aircraft_models.seats) : [aircraft_models.manufacturer: 'BOEING'],
            boeing_seats3 is aircraft_models.boeing_seats : [aircraft_models.manufacturer: ~'B%']
        `
    )
    .run();
  // console.log(result.sql);
  expect(result.getData().toObject()[0].total_seats).toBe(18294);
  expect(result.getData().toObject()[0].total_seats2).toBe(31209);
  expect(result.getData().toObject()[0].total_seats3).toBe(18294);
  expect(result.getData().toObject()[0].boeing_seats).toBe(6244);
  expect(result.getData().toObject()[0].boeing_seats2).toBe(6244);
  expect(result.getData().toObject()[0].boeing_seats3).toBe(6244);
});

it(`hand: bad root name for pathed sum - ${databaseName}`, async () => {
  const result = await handModel
    .makeQuery(
      `
            explore aircraft | reduce
              total_seats3 is aircraft_models.sum(aircraft_models.seats),
          `
    )
    .run();
  // console.log(result.sql);
  expect(result.getData().toObject()[0].total_seats3).toBe(18294);
});

// WORKs: (hand coded model):
// Model based version of sums.
it(`hand: expression fixups. - ${databaseName}`, async () => {
  const result = await handModel
    .makeQuery(
      `
            explore aircraft | reduce
              aircraft_models.total_seats,
              aircraft_models.boeing_seats
          `
    )
    .run();
  expect(result.getData().toObject()[0].total_seats).toBe(18294);
  expect(result.getData().toObject()[0].boeing_seats).toBe(6244);
});

it(`model: filtered measures - ${databaseName}`, async () => {
  const result = await handModel
    .makeQuery(
      `
            explore aircraft | reduce
              boeing_seats is aircraft_models.total_seats : [aircraft_models.manufacturer:'BOEING']
          `
    )
    .run();
  expect(result.getData().toObject()[0].boeing_seats).toBe(6244);
});

// does the filter force a join?
it(`model: do filters force dependant joins? - ${databaseName}`, async () => {
  const result = await handModel
    .makeQuery(
      `
            explore aircraft | reduce
              boeing_aircraft is count() : [aircraft_models.manufacturer:'BOEING']
          `
    )
    .run();
  expect(result.getData().toObject()[0].boeing_aircraft).toBe(69);
});

// Works: Generate query using named alias.
it(`hand: filtered measures - ${databaseName}`, async () => {
  const result = await handModel
    ._makeQueryFromQueryDef({
      structRef: "aircraft",
      pipeline: [
        {
          type: "reduce",
          fields: [
            {
              name: "aircraft_models.total_seats",
              as: "boeing_seats",
              filterList: [fStringEq("aircraft_models.manufacturer", "BOEING")],
            },
          ],
        },
      ],
    })
    .run();
  // console.log(result.sql);
  expect(result.getData().toObject()[0].boeing_seats).toBe(6244);
});

/** Flight model */
export const exprHandModelDef: ModelDef = {
  name: "Hand Coded Expressions",
  exports: ["aircraft"],
  structs: { aircraft: aircraftHandStructDef },
};

export const joinModelAircraftHandStructDef: StructDef = {
  ...modelHandBase,
  as: "model_aircraft",
  fields: [
    ...modelHandBase.fields,
    {
      ...aircraftHandBase,
      structRelationship: {
        type: "condition",
        joinRelationship: "one_to_many",
        onExpression: {
          e: [
            { type: "field", path: "aircraft_model_code" },
            "=",
            { type: "field", path: "aircraft.aircraft_model_code" },
          ],
        },
      },
    },
  ],
};

// Join tests

// airport_models filtered to 'B%' manufacturer
export const modelB: StructDef = {
  ...modelHandBase,
  filterList: [
    {
      expression: [{ type: "field", path: "manufacturer" }, " LIKE 'B%'"],
      source: "manufacturer ~ 'B%'",
    },
  ],
};

// one to many
export const modelAircraftHandStructDef: StructDef = {
  ...modelHandBase,
  as: "model_aircraft",
  fields: [
    ...modelHandBase.fields,
    {
      ...aircraftHandBase,
      structRelationship: {
        type: "condition",
        joinRelationship: "one_to_many",
        onExpression: {
          e: [
            { type: "field", path: "aircraft_model_code" },
            "=",
            { type: "field", path: "aircraft.aircraft_model_code" },
          ],
        },
      },
    },
  ],
};

export const aircraftBModelInner: StructDef = {
  ...aircraftHandBase,
  as: "aircraft_modelb_inner",
  fields: [
    ...aircraftHandBase.fields,
    {
      ...modelB,
      structRelationship: {
        type: "foreignKey",
        foreignKey: "aircraft_model_code",
        joinType: "inner",
      },
    },
  ],
};

const joinModel: ModelDef = {
  name: "Hand Coded Join Models",
  exports: ["model_aircraft", "aircraft_modelb_inner"],
  structs: {
    model_aircraft: joinModelAircraftHandStructDef,
    aircraft_modelb_inner: aircraftBModelInner,
  },
};

const handJoinModel = bqRuntime._makeModelFromModelDef(joinModel);

it(`hand join ON - ${databaseName}`, async () => {
  const sql = (
    await handJoinModel
      ._makeQueryFromQueryDef({
        structRef: "model_aircraft",
        pipeline: [
          {
            type: "reduce",
            fields: [
              "aircraft.state",
              "aircraft.aircraft_count",
              "model_count",
            ],
          },
        ],
      })
      .getSql()
      .build()
  ).getSql();
  await validateCompilation(databaseName, sql);
  // console.log(result.sql);
  // expect(result.getData().toObject()[0].total_seats).toBe(452415);
});

it(`hand join symmetric agg - ${databaseName}`, async () => {
  const result = await handJoinModel
    ._makeQueryFromQueryDef({
      structRef: "model_aircraft",
      pipeline: [
        {
          type: "reduce",
          fields: ["total_seats", "aircraft.aircraft_count"],
        },
      ],
    })
    .run();
  // await bqCompile(databaseName, result.sql);
  // console.log(result.sql);
  // console.log(result.getData().toObject());
  expect(result.getData().toObject()[0].total_seats).toBe(452415);
  expect(result.getData().toObject()[0].aircraft_count).toBe(62644);
});

it(`hand join foreign key filtered inner - ${databaseName}`, async () => {
  const result = await handJoinModel
    ._makeQueryFromQueryDef({
      structRef: "aircraft_modelb_inner",
      pipeline: [
        {
          type: "reduce",
          fields: ["aircraft_models.total_seats", "aircraft_count"],
        },
      ],
    })
    .run();
  // await bqCompile(databaseName, result.sql);
  // console.log(result.sql);
  // console.log(result.getData().toObject());
  expect(result.getData().toObject()[0].total_seats).toBe(7448);
  expect(result.getData().toObject()[0].aircraft_count).toBe(544);
});
