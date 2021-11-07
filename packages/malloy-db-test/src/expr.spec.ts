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

import { Malloy, ModelDef, Query, StructDef } from "@malloy-lang/malloy";
import { fStringEq, fStringLike } from "./test_utils";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rows(qr: malloy.Result): any[] {
  return qr.getData().toObject();
}

import { BigQueryConnection } from "@malloy-lang/db-bigquery";
import * as malloy from "@malloy-lang/malloy";
import * as util from "util";
import * as fs from "fs";

Malloy.db = new BigQueryConnection("test");

async function bqCompile(sql: string): Promise<boolean> {
  try {
    await Malloy.db.executeSqlRaw(`WITH test AS(\n${sql}) SELECT 1`);
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

const expressionModelText = `
export define aircraft_models is (explore 'malloytest.aircraft_models'
  primary key aircraft_model_code
  airport_count is count(*),
  aircraft_model_count is count(),
  total_seats is sum(seats),
  boeing_seats is sum(seats) : [manufacturer: 'BOEING'],
  percent_boeing is boeing_seats / total_seats * 100,
  percent_boeing_floor is FLOOR(boeing_seats / total_seats * 100),
  seats_bucketed is FLOOR(seats/20)*20.0,
);

export define aircraft is (
  explore 'malloytest.aircraft'
  primary key tail_num
  aircraft_count is count(*),
  by_manufacturer is (reduce top 5
    aircraft_models.manufacturer,
    aircraft_count
  )

  joins
    aircraft_models on aircraft_model_code
);

`;

export const modelHandBase: StructDef = {
  name: "malloytest.aircraft_models",
  as: "aircraft_models",
  type: "struct",
  dialect: "standardsql",
  structSource: { type: "table" },
  structRelationship: { type: "basetable", connectionName: "test" },
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
  name: "malloytest.aircraft",
  dialect: "standardsql",
  structSource: { type: "table" },
  structRelationship: { type: "basetable", connectionName: "test" },
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

describe("expression tests", () => {
  let bq: BigQueryConnection;
  let runtime: malloy.Runtime;
  let model: malloy.ModelRuntimeRequest;
  let handModel: malloy.ModelRuntimeRequest;
  let orderByModel: malloy.ModelRuntimeRequest;
  let handJoinModel: malloy.ModelRuntimeRequest;

  beforeAll(() => {
    bq = new BigQueryConnection("test");
    const files = {
      readUrl: async (url: malloy.Url) => {
        const filePath = url.toString().replace(/^file:\/\//, "");
        return await util.promisify(fs.readFile)(filePath, "utf8");
      },
    };
    runtime = new malloy.Runtime({
      urls: files,
      schemas: bq,
      connections: bq,
    });
    model = runtime.makeModel(expressionModelText);

    orderByModel = runtime.makeModel(
      `export define models is ('malloytest.aircraft_models'
          model_count is count()
        )`
    );

    handModel = runtime._makeModelFromModelDef(handCodedModel);
    handJoinModel = runtime._makeModelFromModelDef(joinModel);
  });

  it("hand query hand model", async () => {
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
    await bqCompile(sql);
    // console.log(result.sql);
    // expect(result.getData().toObject()[0].total_seats).toBe(452415);
  });

  it("hand turtle", async () => {
    const result = await handModel
      ._makeQueryFromQueryDef({
        structRef: "aircraft",
        pipeHead: { name: "hand_turtle" },
        pipeline: [],
      })
      .run();
    expect(result.getData().toObject()[0].aircraft_count).toBe(3599);
  });

  it("hand turtle malloy", async () => {
    const result = await handModel
      .makeQuery(
        `
explore aircraft | hand_turtle
`
      )
      .run();
    expect(result.getData().toObject()[0].aircraft_count).toBe(3599);
  });

  it("default sort order", async () => {
    const result = await handModel
      .makeQuery(
        `
      explore aircraft | reduce state, aircraft_count limit 10
    `
      )
      .run();
    expect(result.getData().toObject()[0].aircraft_count).toBe(367);
  });

  it("default sort order by dir", async () => {
    const result = await handModel
      .makeQuery(
        `
      explore aircraft | reduce state, aircraft_count order by 2 limit 10
    `
      )
      .run();
    expect(result.getData().toObject()[0].aircraft_count).toBe(1);
  });

  it("hand turtle2", async () => {
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
    await bqCompile(sql);
    // console.log(result.sql);
    // expect(result.getData().toObject()[0].total_seats).toBe(452415);
  });

  it("hand turtle3", async () => {
    const sql = await compileHandQueryToSql(handModel, {
      structRef: "aircraft",
      pipeline: [
        {
          type: "reduce",
          fields: ["state", "aircraft_count", "hand_turtle"],
        },
      ],
    });
    await bqCompile(sql);
    // console.log(result.sql);
    // expect(result.getData().toObject()[0].total_seats).toBe(452415);
  });

  it("hand: declared pipeline as main query", async () => {
    const sql = await compileHandQueryToSql(handModel, {
      structRef: "aircraft",
      pipeHead: { name: "hand_turtle_pipeline" },
      pipeline: [],
    });
    // console.log(result.sql);
    await bqCompile(sql);
    // console.log(result.sql);
    // expect(result.getData().toObject()[0].total_seats).toBe(452415);
  });

  it("hand: turtle is pipeline", async () => {
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
    // await bqCompile(result.sql);
    // console.log(result.sql);
    // console.log(result.getData().toObject()[0]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((result.getData().toObject()[0] as any).pipe[0].total_aircraft).toBe(
      61
    );
  });

  // basic calculations for sum, filtered sum, without a join.
  it("basic calculations", async () => {
    const result = await model
      .makeQuery(
        `
        explore aircraft_models | reduce
          total_seats,
          total_seats2 is sum(seats),
          boeing_seats,
          boeing_seats2 is sum(seats) : [manufacturer: 'BOEING'],
          boeing_seats3 is total_seats : [manufacturer: 'BOEING'],
          percent_boeing,
          percent_boeing2 is boeing_seats / total_seats * 100,
          -- percent_boeing_floor,
          -- percent_boeing_floor2 is FLOOR(boeing_seats / total_seats * 100)
      `
      )
      .run();
    // console.log(JSON.stringify(result.getData().toObject(), undefined, 2));
    // console.log(result.sql);
    expect(result.getData().toObject()[0].total_seats).toBe(452415);
    expect(result.getData().toObject()[0].total_seats2).toBe(452415);
    expect(result.getData().toObject()[0].boeing_seats).toBe(252771);
    expect(result.getData().toObject()[0].boeing_seats2).toBe(252771);
    expect(result.getData().toObject()[0].boeing_seats3).toBe(252771);
    expect(
      Math.floor(result.getData().toObject()[0].percent_boeing as number)
    ).toBe(55);
    expect(
      Math.floor(result.getData().toObject()[0].percent_boeing2 as number)
    ).toBe(55);
    // expect(result.getData().toObject()[0].percent_boeing_floor).toBe(55);
    // expect(result.getData().toObject()[0].percent_boeing_floor2).toBe(55);
  });

  // Floor is broken (doesn't compile because the expression returned isn't an aggregate.)
  it("Floor() -or any function bustage with aggregates", async () => {
    const result = await model
      .makeQuery(
        `
        explore aircraft_models | reduce
          percent_boeing_floor,
          percent_boeing_floor2 is FLOOR(boeing_seats / total_seats * 100)
      `
      )
      .run();
    expect(result.getData().toObject()[0].percent_boeing_floor).toBe(55);
    expect(result.getData().toObject()[0].percent_boeing_floor2).toBe(55);
  });

  // Hand model basic calculations for sum, filtered sum, without a join.
  it("hand: lots of kinds of sums", async () => {
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

  it("hand: bad root name for pathed sum", async () => {
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

  // BROKEN:
  // Model based version of sums.
  it("model: expression fixups.", async () => {
    const result = await model
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

  // WORKs: (hand coded model):
  // Model based version of sums.
  it("hand: expression fixups.", async () => {
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

  it("model: filtered measures", async () => {
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
  it("model: do filters force dependant joins?", async () => {
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
  it("hand: filtered measures", async () => {
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
                filterList: [
                  fStringEq("aircraft_models.manufacturer", "BOEING"),
                ],
              },
            ],
          },
        ],
      })
      .run();
    // console.log(result.sql);
    expect(result.getData().toObject()[0].boeing_seats).toBe(6244);
  });

  // turtle expressions
  it("model: turtle", async () => {
    const result = await model
      .makeQuery(
        `
            explore aircraft | reduce
              by_manufacturer
          `
      )
      .run();
    expect(rows(result)[0].by_manufacturer[0].manufacturer).toBe("CESSNA");
  });

  // filtered turtle expressions
  it("model: filtered turtle", async () => {
    const result = await model
      .makeQuery(
        `
              explore aircraft | reduce
                b is by_manufacturer : [aircraft_models.manufacturer:~'B%']
            `
      )
      .run();
    expect(rows(result)[0].b[0].manufacturer).toBe("BEECH");
  });

  // having.
  it("model: simple having", async () => {
    const result = await model
      .makeQuery(
        `
          explore aircraft | reduce : [aircraft_count: >90 ]
            state,
            aircraft_count
            order by 2
          `
      )
      .run();
    expect(result.getData().toObject()[0].aircraft_count).toBe(91);
  });

  it("model: turtle having2", async () => {
    const result = await model
      .makeQuery(
        `
      -- hacking a null test for now
      explore aircraft
      | reduce top 10 order by 1: [region != NULL]
          region,
          by_state is (reduce top 10 order by 1 desc : [aircraft_count: >50]
            state,
            aircraft_count
          )
        `
      )
      .run();
    // console.log(result.sql);
    // console.log(JSON.stringify(result.getData().toObject(), undefined, 2));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((result.getData().toObject()[0] as any).by_state[0].state).toBe(
      "VA"
    );
  });

  it("model: turtle having on main", async () => {
    const result = await model
      .makeQuery(
        `
      -- hacking a null test for now
      explore aircraft
      | reduce order by 2 asc: [aircraft_count: >500]
          region
          aircraft_count
          by_state is (reduce  order by 2 asc : [aircraft_count: >45]
            state,
            aircraft_count
            by_city is (reduce  order by 2 asc : [aircraft_count: >5 ]
              city,
              aircraft_count
            )
          )
        `
      )
      .run();
    // console.log(result.sql);
    // console.log(pretty(result.getData().toObject()));
    expect(rows(result)[0].by_state[0].by_city[0].city).toBe("ALBUQUERQUE");
  });

  // bigquery doesn't like to partition by floats,
  it("model: having float group by partition", async () => {
    const result = await model
      .makeQuery(
        `
    -- hacking a null test for now
    explore aircraft_models
    | reduce order by 1 : [seats_bucketed > 0, aircraft_model_count > 400]
        seats_bucketed
        aircraft_model_count
        foo is (reduce
          engines
          aircraft_model_count
        )
      `
      )
      .run();
    // console.log(result.sql);
    // console.log(result.getData().toObject());
    expect(result.getData().toObject()[0].aircraft_model_count).toBe(448);
  });

  it("model: aggregate functions distinct min max", async () => {
    const result = await model
      .makeQuery(
        `
        explore aircraft_models | reduce
          distinct_seats is count(distinct seats),
          boeing_distinct_seats is count(distinct seats) : [manufacturer: 'BOEING'],
          min_seats is min(seats),
          cessna_min_seats is min(seats) : [manufacturer: 'CESSNA'],
          max_seats is max(seats),
          cessna_max_seats is max(seats) : [manufacturer: 'CESSNA'],
          min_model is min(model),
          boeing_min_model is min(model) : [manufacturer: 'BOEING'],
          max_model is max(model),
          boeing_max_model is max(model) : [manufacturer: 'BOEING'],
        `
      )
      .run();
    expect(result.getData().toObject()[0].distinct_seats).toBe(187);
    expect(result.getData().toObject()[0].boeing_distinct_seats).toBe(85);
    expect(result.getData().toObject()[0].min_seats).toBe(0);
    expect(result.getData().toObject()[0].cessna_min_seats).toBe(1);
    expect(result.getData().toObject()[0].max_seats).toBe(660);
    expect(result.getData().toObject()[0].cessna_max_seats).toBe(14);
    expect(result.getData().toObject()[0].min_model).toBe(" SEAREY");
    expect(result.getData().toObject()[0].boeing_min_model).toBe("100");
    expect(result.getData().toObject()[0].max_model).toBe("ZWEIFEL PA18");
    expect(result.getData().toObject()[0].boeing_max_model).toBe("YL-15");
  });

  it("model: dates", async () => {
    const result = await model
      .makeQuery(
        `
        explore 'malloytest.alltypes' | reduce
          t_date,
          t_date.\`month\`,
          t_date.\`year\`,
          t_date.day_of_month,
          t_date.day_of_year,
          t_timestamp,
          t_timestamp.\`date\`,
          t_timestamp.\`hour\`,
          t_timestamp.\`minute\`,
          t_timestamp.\`second\`,
          t_timestamp.\`month\`,
          t_timestamp.\`year\`,
          t_timestamp.day_of_month,
          t_timestamp.day_of_year,

        `
      )
      .run();
    expect(rows(result)[0].t_date.value).toBe("2020-03-02");
    expect(rows(result)[0].t_date_month.value).toBe("2020-03-01");
    expect(rows(result)[0].t_date_year.value).toBe("2020-01-01");
    expect(rows(result)[0].t_date_day_of_year).toBe(62);
    expect(rows(result)[0].t_date_day_of_month).toBe(2);
    expect(rows(result)[0].t_timestamp.value).toBe("2020-03-02T12:35:56.000Z");
    expect(rows(result)[0].t_timestamp_second.value).toBe(
      "2020-03-02T12:35:56.000Z"
    );
    expect(rows(result)[0].t_timestamp_minute.value).toBe(
      "2020-03-02T12:35:00.000Z"
    );
    expect(rows(result)[0].t_timestamp_hour.value).toBe(
      "2020-03-02T12:00:00.000Z"
    );
    expect(rows(result)[0].t_timestamp_date.value).toBe("2020-03-02");
    expect(rows(result)[0].t_timestamp_month.value).toBe("2020-03-01");
    expect(rows(result)[0].t_timestamp_year.value).toBe("2020-01-01");
    expect(rows(result)[0].t_timestamp_day_of_year).toBe(62);
    expect(rows(result)[0].t_timestamp_day_of_month).toBe(2);
  });

  it.skip("defines in model", async () => {
    // const result1 = await model.makeQuery(`
    //   define a is ('malloytest.alltypes');
    //   explore a | reduce x is count(*)
    //   `);
    // const result = await model.makeQuery(`
    //     define a is ('malloytest.alltypes');
    //     explore a | reduce x is count(*)
    //     `);
  });

  it("named query metadata undefined", async () => {
    const result = await model
      .makeQuery(
        `
        explore aircraft| reduce
          aircraft_count is count()
        `
      )
      .run();
    expect(result._getQueryResult().queryName).toBe(undefined);
  });

  it("named query metadata named", async () => {
    const result = await model
      .makeQuery(
        `
        explore aircraft | by_manufacturer
        `
      )
      .run();
    expect(result._getQueryResult().queryName).toBe("by_manufacturer");
  });

  it("named query metadata named head of pipeline", async () => {
    const result = await model
      .makeQuery(
        `
        explore aircraft | by_manufacturer | reduce c is count()
        `
      )
      .run();
    expect(result._getQueryResult().queryName).toBe(undefined);
  });

  it("filtered explores", async () => {
    const result = await model
      .makeQuery(
        `
        define b is (explore aircraft : [aircraft_models.manufacturer: ~'B%']);

        explore b | reduce m_count is count(distinct aircraft_models.manufacturer);
        `
      )
      .run();
    expect(rows(result)[0].m_count).toBe(63);
  });

  it("query with aliasname used twice", async () => {
    const result = await model
      .makeQuery(
        `
aircraft | reduce
first is substring(city,1,1)
aircraft_count is count()
aircraft is (reduce
  first_two is substring(city,1,2)
  aircraft_count is count()
  aircraft is (reduce
    first_three is substring(city,1,3)
    aircraft_count is count()
  )
)
| project
aircraft.aircraft.first_three
aircraft_count
    `
      )
      .run();
    expect(rows(result)[0].first_three).toBe("SAN");
  });

  it.skip("join foreign_key reverse", async () => {
    const result = await model
      .makeQuery(
        `
  define a is('malloytest.aircraft'
    primary key tail_num
    aircraft_count is count()
  );
  export define am is ('malloytest.aircraft_models'
    primary key aircraft_model_code
    a is join on a.aircraft_model_code

    some_measures is (reduce
      am_count is count()
      a.aircraft_count
    )
  );
  am | some_measures
    `
      )
      .run();
    expect(rows(result)[0].first_three).toBe("SAN");
  });

  it("joined filtered explores", async () => {
    const result = await model
      .makeQuery(
        `
    define a_models is (explore 'malloytest.aircraft_models'
    : [manufacturer: ~'B%']
    primary key aircraft_model_code
    model_count is count()
  )

    define aircraft2 is (explore 'malloytest.aircraft'
    model is join a_models on aircraft_model_code
    aircraft_count is count()
  )

    explore aircraft2 | reduce
      model.model_count
      aircraft_count
        `
      )
      .run();
    // console.log(result.sql);
    expect(rows(result)[0].model_count).toBe(244);
    expect(rows(result)[0].aircraft_count).toBe(3599);
  });

  it("joined filtered explores with dependancies", async () => {
    const result = await model
      .makeQuery(
        `
    define bo_models is (
      (explore 'malloytest.aircraft_models'
        : [manufacturer: ~ 'BO%']
      | project
        aircraft_model_code
        manufacturer
        seats
      )
      primary key aircraft_model_code
      bo_count is count()
    );

    define b_models is (
      (explore 'malloytest.aircraft_models'
        : [manufacturer: ~ 'B%']
      | project
        aircraft_model_code
        manufacturer
        seats
      ) : [bo_models.seats > 200]
      primary key aircraft_model_code
      b_count is count()
      bo_models is join on aircraft_model_code
    );

    define models is (explore 'malloytest.aircraft_models'
      b_models is join on aircraft_model_code
      model_count is count()
    )

    explore models | reduce
      model_count
      b_models.b_count
      -- b_models.bo_models.bo_count
        `
      )
      .run();
    expect(result.getData().toObject()[0].model_count).toBe(60461);
    expect(rows(result)[0].b_count).toBe(355);
  });

  it("boolean type", async () => {
    const result = await orderByModel
      .makeQuery(
        `
        explore models | reduce
          big is seats >=20
          model_count is count()
        `
      )
      .run();
    expect(rows(result)[0].big).toBe(false);
    expect(rows(result)[0].model_count).toBe(58451);
  });

  it("boolean in pipeline", async () => {
    const result = await orderByModel
      .makeQuery(
        `
        explore models | reduce
          manufacturer
          big is seats >=21
          model_count is count()
        | reduce
          big
          model_count is model_count.sum()
        `
      )
      .run();
    expect(rows(result)[0].big).toBe(false);
    expect(rows(result)[0].model_count).toBe(58500);
  });

  it("filtered measures in model are aggregates #352", async () => {
    const result = await orderByModel
      .makeQuery(
        `
        explore models
          j_names is model_count : [manufacturer ~ 'J%']
        | reduce
          j_names
        `
      )
      .run();
    expect(rows(result)[0].j_names).toBe(1358);
  });

  it("reserved words are quoted", async () => {
    const sql = (
      await orderByModel
        .makeQuery(
          `
        explore models | reduce
          fetch is count()
        | project
          fetch
        `
        )
        .getSql()
        .build()
    ).getSql();
    await bqCompile(sql);
  });

  it("reserved words are quoted in turtles", async () => {
    const sql = (
      await orderByModel
        .makeQuery(
          `
        explore models | reduce
          withx is (reduce
             select is UPPER(manufacturer)
             fetch is count()
          )
        | project
          withx is lower(withx.select)
          fetch is withx.fetch
        `
        )
        .getSql()
        .build()
    ).getSql();
    await bqCompile(sql);
  });

  it.skip("reserved words in structure definitions", async () => {
    const sql = (
      await orderByModel
        .makeQuery(
          `
        explore models | reduce
          with is (reduce
             select is UPPER(manufacturer)
             fetch is count()
          )
        | project
          withxis lower(withx.select)
          fetch is with.fetch
        `
        )
        .getSql()
        .build()
    ).getSql();
    await bqCompile(sql);
  });

  it("aggregate and scalar conditions", async () => {
    const sql = (
      await orderByModel
        .makeQuery(
          `
        explore models | reduce
          model_count is count() : [manufacturer: ~'A%']
        `
        )
        .getSql()
        .build()
    ).getSql();
    await bqCompile(sql);
  });

  it("modeled having simple", async () => {
    const result = await orderByModel
      .makeQuery(
        `
        define popular_names is (models
          | reduce : [model_count > 100]
            manufacturer
            model_count
        );
        popular_names | project order by 2
         manufacturer
         model_count
        `
      )
      .run();
    expect(rows(result)[0].model_count).toBe(102);
  });

  it("modeled having complex", async () => {
    const result = await orderByModel
      .makeQuery(
        `
        define popular_names is (models
          | reduce : [model_count > 100]
            manufacturer
            model_count
            l is (reduce top 5
              manufacturer
              model_count
            )
        );
        popular_names | project order by 2
         manufacturer
         model_count
        `
      )
      .run();
    expect(rows(result)[0].model_count).toBe(102);
  });

  it("turtle references joined element", async () => {
    const sql = (
      await orderByModel
        .makeQuery(
          `
      define a is ('malloytest.aircraft'
        primary key tail_num
        aircraft_count is count(*)
      );

      define f is ('malloytest.flights'
        primary key id2
        flight_count is count()
        foo is (reduce
          carrier
          flight_count
          a.aircraft_count
        )
        joins
          a on tail_num
      );
      explore f | foo
    `
        )
        .getSql()
        .build()
    ).getSql();
    await bqCompile(sql);
  });

  it("hand join ON", async () => {
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
    await bqCompile(sql);
    // console.log(result.sql);
    // expect(result.getData().toObject()[0].total_seats).toBe(452415);
  });

  it("hand join symmetric agg", async () => {
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
    // await bqCompile(result.sql);
    // console.log(result.sql);
    // console.log(result.getData().toObject());
    expect(result.getData().toObject()[0].total_seats).toBe(452415);
    expect(result.getData().toObject()[0].aircraft_count).toBe(62644);
  });

  it("hand join foreign key filtered inner", async () => {
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
    // await bqCompile(result.sql);
    // console.log(result.sql);
    // console.log(result.getData().toObject());
    expect(result.getData().toObject()[0].total_seats).toBe(7448);
    expect(result.getData().toObject()[0].aircraft_count).toBe(544);
  });
});
