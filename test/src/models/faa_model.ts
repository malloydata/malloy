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

import { ModelDef, StructDef, StructRelationship } from "@malloydata/malloy";

import { fStringEq, fYearEq } from "../util";

import { medicareModel, medicareStateFacts } from "./medicare_model";

function withJoin(leftKey: string, rightKey: string): StructRelationship {
  return {
    "type": "one",
    "onExpression": [
      { "type": "field", "path": `${leftKey}` },
      "=",
      { "type": "field", "path": `${rightKey}` }
    ]
  };
}

/** Flight Model */
export const FLIGHTS_EXPLORE: StructDef = {
  "type": "struct",
  "name": "malloy-data.malloytest.flights",
  "as": "flights",
  "dialect": "standardsql",
  "structSource": {
    "type": "table",
    "tablePath": "malloy-data.malloytest.flights"
  },
  "structRelationship": { "type": "basetable", "connectionName": "bigquery" },
  "primaryKey": "id2",
  "fields": [
    // Fields in the flights table.
    { "type": "string", "name": "carrier" },
    { "type": "string", "name": "origin", "as": "origin_code" },
    { "type": "timestamp", "name": "dep_time" },
    { "type": "string", "name": "destination", "as": "destination_code" },
    { "type": "string", "name": "flight_num" },
    { "type": "number", "name": "flight_time", "numberType": "integer" },
    { "type": "string", "name": "tail_num" },
    { "type": "number", "name": "dep_delay", "numberType": "integer" },
    { "type": "number", "name": "arr_delay", "numberType": "integer" },
    { "type": "number", "name": "taxi_out", "numberType": "integer" },
    { "type": "number", "name": "taxi_in", "numberType": "integer" },
    { "type": "number", "name": "distance", "numberType": "integer" },
    { "type": "string", "name": "cancelled" },
    { "type": "string", "name": "diverted" },
    { "type": "number", "name": "id2", "numberType": "integer" },
    {
      "type": "number",
      "name": "flight_count",
      "expressionType": "aggregate",
      "e": [{ "type": "aggregate", "function": "count", "e": [] }]
    },
    {
      "type": "number",
      "name": "total_distance",
      "expressionType": "aggregate",
      "e": [
        {
          "type": "aggregate",
          "function": "sum",
          "e": [{ "type": "field", "path": "distance" }]
        }
      ]
    },

    // carriers
    {
      "type": "struct",
      "name": "malloy-data.malloytest.carriers",
      "as": "carriers",
      "dialect": "standardsql",
      "structSource": {
        "type": "table",
        "tablePath": "malloy-data.malloytest.carriers"
      },
      "structRelationship": {
        "type": "one",
        "onExpression": [
          { "type": "field", "path": "carrier" },
          "=",
          { "type": "field", "path": "carriers.code" }
        ]
      },
      "primaryKey": "code",
      "fields": [
        { "type": "string", "name": "code" },
        { "type": "string", "name": "name" },
        { "type": "string", "name": "nickname" }
      ]
    },

    // aircraft
    {
      "type": "struct",
      "name": "malloy-data.malloytest.aircraft",
      "as": "aircraft",
      "dialect": "standardsql",
      "structSource": {
        "type": "table",
        "tablePath": "malloy-data.malloytest.aircraft"
      },
      "structRelationship": withJoin("tail_num", "aircraft.tail_num"),
      "primaryKey": "tail_num",
      "fields": [
        { "type": "string", "name": "tail_num" },
        { "type": "string", "name": "aircraft_serial" },
        { "type": "string", "name": "aircraft_model_code" },
        { "type": "string", "name": "aircraft_engine_code" },
        { "type": "number", "name": "year_built", "numberType": "integer" },
        {
          "type": "number",
          "name": "aircraft_type_id",
          "numberType": "integer"
        },
        {
          "type": "number",
          "name": "aircraft_engine_type_id",
          "numberType": "integer"
        },
        {
          "type": "number",
          "name": "registrant_type_id",
          "numberType": "integer"
        },
        { "type": "string", "name": "name" },
        { "type": "string", "name": "address1" },
        { "type": "string", "name": "address2" },
        { "type": "string", "name": "city" },
        { "type": "string", "name": "state" },
        { "type": "string", "name": "zip" },
        { "type": "string", "name": "region" },
        { "type": "string", "name": "county" },
        { "type": "string", "name": "country" },
        { "type": "string", "name": "certification" },
        { "type": "string", "name": "status_code" },
        { "type": "string", "name": "mode_s_code" },
        { "type": "string", "name": "fract_owner" },
        {
          "type": "number",
          "name": "aircraft_count",
          "expressionType": "aggregate",
          "e": [{ "type": "aggregate", "function": "count", "e": [] }]
        },
        {
          "type": "number",
          "name": "total_engines",
          "expressionType": "aggregate",
          "e": [
            {
              "type": "aggregate",
              "function": "sum",
              "e": [{ "type": "field", "path": "aircraft_models.engines" }]
            }
          ]
        },

        // subjoin aircraft models
        {
          "type": "struct",
          "name": "malloy-data.malloytest.aircraft_models",
          "as": "aircraft_models",
          "dialect": "standardsql",
          "primaryKey": "aircraft_model_code",
          "structSource": {
            "type": "table",
            "tablePath": "malloy-data.malloytest.aircraft_models"
          },
          "structRelationship": withJoin(
            "aircraft_model_code",
            "aircraft_models.aircraft_model_code"
          ),
          "fields": [
            { "type": "string", "name": "aircraft_model_code" },
            { "type": "string", "name": "manufacturer" },
            { "type": "string", "name": "model" },
            {
              "type": "number",
              "name": "aircraft_type_id",
              "numberType": "integer"
            },
            {
              "type": "number",
              "name": "aircraft_engine_type_id",
              "numberType": "integer"
            },
            {
              "type": "number",
              "name": "aircraft_category_id",
              "numberType": "integer"
            },
            { "type": "number", "name": "amateur", "numberType": "integer" },
            { "type": "number", "name": "engines", "numberType": "integer" },
            { "type": "number", "name": "seats", "numberType": "integer" },
            { "type": "number", "name": "weight", "numberType": "integer" },
            { "type": "number", "name": "speed", "numberType": "integer" },
            {
              "type": "number",
              "expressionType": "aggregate",
              "name": "total_seats",
              "e": [
                {
                  "type": "aggregate",
                  "function": "sum",
                  "e": [{ "type": "field", "path": "seats" }]
                }
              ]
            }
          ]
        }
      ]
    },

    // origin
    {
      "type": "struct",
      "name": "malloy-data.malloytest.airports",
      "as": "origin",
      "dialect": "standardsql",
      "structSource": {
        "type": "table",
        "tablePath": "malloy-data.malloytest.airports"
      },
      "structRelationship": withJoin("origin_code", "origin.code"),
      "primaryKey": "code",
      "fields": [
        { "type": "number", "name": "id", "numberType": "integer" },
        { "type": "string", "name": "code" },
        { "type": "string", "name": "site_number" },
        { "type": "string", "name": "fac_type", "as": "facility_type" },
        { "type": "string", "name": "fac_use", "as": "facility_use" },
        { "type": "string", "name": "faa_region" },
        { "type": "string", "name": "faa_dist" },
        { "type": "string", "name": "city" },
        { "type": "string", "name": "county" },
        { "type": "string", "name": "state" },
        { "type": "string", "name": "full_name" },
        { "type": "string", "name": "own_type" },
        { "type": "number", "name": "longitude", "numberType": "float" },
        { "type": "number", "name": "latitude", "numberType": "float" },
        { "type": "number", "name": "elevation", "numberType": "integer" },
        { "type": "string", "name": "aero_cht" },
        { "type": "number", "name": "cbd_dist", "numberType": "integer" },
        { "type": "string", "name": "cbd_dir" },
        { "type": "string", "name": "act_date" },
        { "type": "string", "name": "cert" },
        { "type": "string", "name": "fed_agree" },
        { "type": "string", "name": "cust_intl" },
        { "type": "string", "name": "c_ldg_rts" },
        { "type": "string", "name": "joint_use" },
        { "type": "string", "name": "mil_rts" },
        { "type": "string", "name": "cntl_twr" },
        { "type": "string", "name": "major" },
        {
          "type": "number",
          "name": "count",
          "expressionType": "aggregate",
          "e": [{ "type": "aggregate", "function": "count", "e": [] }]
        }
      ]
    },

    // destination
    {
      "type": "struct",
      "name": "malloy-data.malloytest.airports",
      "as": "destination",
      "dialect": "standardsql",
      "structSource": {
        "type": "table",
        "tablePath": "malloy-data.malloytest.airports"
      },
      "structRelationship": withJoin("destination_code", "destination.code"),
      "primaryKey": "code",
      "fields": [
        { "type": "number", "name": "id", "numberType": "integer" },
        { "type": "string", "name": "code" },
        { "type": "string", "name": "site_number" },
        { "type": "string", "name": "fac_type", "as": "facility_type" },
        { "type": "string", "name": "fac_use", "as": "facility_use" },
        { "type": "string", "name": "faa_region" },
        { "type": "string", "name": "faa_dist" },
        { "type": "string", "name": "city" },
        { "type": "string", "name": "county" },
        { "type": "string", "name": "state" },
        { "type": "string", "name": "full_name" },
        { "type": "string", "name": "own_type" },
        { "type": "number", "name": "longitude", "numberType": "float" },
        { "type": "number", "name": "latitude", "numberType": "float" },
        { "type": "number", "name": "elevation", "numberType": "integer" },
        { "type": "string", "name": "aero_cht" },
        { "type": "number", "name": "cbd_dist", "numberType": "integer" },
        { "type": "string", "name": "cbd_dir" },
        { "type": "string", "name": "act_date" },
        { "type": "string", "name": "cert" },
        { "type": "string", "name": "fed_agree" },
        { "type": "string", "name": "cust_intl" },
        { "type": "string", "name": "c_ldg_rts" },
        { "type": "string", "name": "joint_use" },
        { "type": "string", "name": "mil_rts" },
        { "type": "string", "name": "cntl_twr" },
        { "type": "string", "name": "major" },
        {
          "type": "number",
          "name": "count",
          "expressionType": "aggregate",
          "e": [{ "type": "aggregate", "function": "count", "e": [] }]
        }
      ]
    },

    // derived table from a named query.
    {
      "type": "struct",
      "name": "aircraft_facts",
      "dialect": "standardsql",
      "structSource": {
        "type": "query",
        "query": {
          "type": "query",
          "structRef": "flights",
          "pipeHead": { "name": "aircraft_facts_query" },
          "pipeline": []
        }
      },
      "structRelationship": withJoin("tail_num", "aircraft_facts.tail_num"),
      "primaryKey": "tail_num",
      "fields": [
        { "type": "string", "name": "tail_num" },
        { "type": "number", "name": "lifetime_distance" }
      ]
    },

    // // Inline derived table
    // {
    //   type: 'struct',
    //   name: "aircraft_facts2",
    //   structSource: {
    //     type: 'query',
    //     query: {
    //       type: 'reduce',
    //         fields: [
    //           'tail_num',
    //           {name: 'total_distance', as: 'lifetime_distance'}
    //         ]
    //       }
    //   },
    //   structRelationship: {type: 'foreignKey', keyExpression: [{ type: "field", path:  'tail_num'},
    //   fields: [
    //   ]
    // },
    // query definition
    // EXPLORE flights | REDUCE carriers.name, flight_count ORDER BY 1
    {
      "type": "turtle",
      "name": "flights_by_carrier",
      "pipeline": [
        {
          "type": "reduce",
          "fields": [
            "carriers.name",
            "flight_count",
            // { name: "origin.count", as: "origin_count" },
            {
              "type": "number",
              "name": "origin_count",
              "expressionType": "aggregate",
              "e": [
                {
                  "type": "aggregate",
                  "function": "count",
                  "e": [],
                  "structPath": "origin"
                }
              ]
            },
            {
              "type": "number",
              "name": "my_total_distance",
              "expressionType": "aggregate",
              "e": [
                {
                  "type": "aggregate",
                  "function": "sum",
                  "e": [{ "type": "field", "path": "distance" }]
                }
              ]
            }
          ],
          "orderBy": [{ "field": "name", "dir": "asc" }]
        }
      ]
    },
    {
      "type": "turtle",
      "name": "flights_by_carrier_2001_2002",
      "pipeline": [
        {
          "type": "reduce",

          "fields": [
            "carriers.name",
            {
              "name": "flights_2001",
              "type": "number",
              "expressionType": "aggregate",
              "e": [
                {
                  "type": "filterExpression",
                  "filterList": [fYearEq("dep_time", 2001)],
                  "e": [
                    {
                      "type": "aggregate",
                      "function": "count",
                      "e": []
                    }
                  ]
                }
              ]
            },
            {
              "name": "flights_2002",
              "type": "number",
              "expressionType": "aggregate",
              "e": [
                {
                  "type": "filterExpression",
                  "filterList": [fYearEq("dep_time", 2001)],
                  "e": [
                    {
                      "type": "aggregate",
                      "function": "count",
                      "e": []
                    }
                  ]
                }
              ]
            }
          ],
          "orderBy": [{ "field": "name", "dir": "asc" }]
        }
      ]
    },
    // EXPLORE flights | REDUCE destination.city, flight_count ORDER BY 2 desc
    {
      "type": "turtle",
      "name": "flights_by_city_top_5",
      "pipeline": [
        {
          "type": "reduce",
          "fields": ["destination.city", "flight_count"],
          "orderBy": [{ "field": 2, "dir": "desc" }],
          "limit": 5
        }
      ]
    },
    // EXPLORE flights [origin.state:'CA] | REDUCE aircraft.aircraft_models.manufacturer, aircraft.aircraft_models.manufacturer.
    //    aircraft.aircraft_count, flight_count ORDER BY flight_count LIMIT 5
    {
      "type": "turtle",
      "name": "flights_by_model",
      "pipeline": [
        {
          "type": "reduce",
          "fields": [
            "aircraft.aircraft_models.manufacturer",
            "aircraft.aircraft_models.model",
            "aircraft.aircraft_count",
            "flight_count"
          ],
          "orderBy": [{ "field": "flight_count", "dir": "desc" }],
          "filterList": [fStringEq("origin.state", "CA")],
          "limit": 5
        }
      ]
    },
    // EXPLORE flights | REDUCE tail_num, total_distance as lifetime_distance
    {
      "type": "turtle",
      "name": "aircraft_facts_query",
      "pipeline": [
        {
          "type": "reduce",

          "fields": [
            "tail_num",
            {
              "type": "number",
              "name": "lifetime_distance",
              "expressionType": "aggregate",
              "e": [
                {
                  "type": "aggregate",
                  "function": "sum",
                  "e": [{ "type": "field", "path": "distance" }]
                }
              ]
            }
          ]
        }
      ]
    },
    // expore flights | reduce carriers.name, aircraft.total_engines, flight_count
    {
      "type": "turtle",
      "name": "carriers_by_total_engines",
      "pipeline": [
        {
          "type": "reduce",
          "fields": ["carriers.name", "aircraft.total_engines", "flight_count"]
        }
      ]
    },
    // expore flights | reduce aircraft_facts.lifetime_distance, flight_count
    {
      "type": "turtle",
      "name": "aircraft_facts_test",
      "pipeline": [
        {
          "type": "reduce",
          "fields": ["aircraft_facts.lifetime_distance", "flight_count"]
        }
      ]
    },
    // expore flights | reduce flight_count, origin.city, origin.state
    {
      "type": "turtle",
      "name": "measures_first",
      "pipeline": [
        {
          "type": "reduce",
          "fields": ["flight_count", "origin.city", "origin.state"]
        }
      ]
    },

    // explore flights
    // | reduce
    //   carrier
    //   flight_count
    //   top_5_routes is (reduce top 5 order by 3 desc
    //      origin_code
    //      destination_code,
    //      flight_count
    //   )
    {
      "type": "turtle",
      "name": "first_turtle",
      "pipeline": [
        {
          "type": "reduce",
          "fields": [
            "carrier",
            "flight_count",
            {
              "type": "turtle",
              "name": "top_5_routes",
              "pipeline": [
                {
                  "type": "reduce",
                  "fields": ["origin_code", "destination_code", "flight_count"],
                  "limit": 5,
                  "orderBy": [{ "field": "flight_count", "dir": "desc" }]
                }
              ]
            }
          ]
        }
      ]
    },
    // explore flights
    // | reduce order by 3 desc
    //    origin_code
    //    destination_code
    //    flight_count
    {
      "type": "turtle",
      "name": "top_5_routes",
      "pipeline": [
        {
          "type": "reduce",
          "fields": ["origin_code", "destination_code", "flight_count"],
          "limit": 5,
          "orderBy": [{ "field": "flight_count", "dir": "desc" }]
        }
      ]
    },
    // EXPLORE flights | REDUCE carrier, flight_count, top_5_routes
    {
      "type": "turtle",
      "name": "carriers_routes",
      "pipeline": [
        {
          "type": "reduce",
          "fields": ["carrier", "flight_count", "top_5_routes"]
        }
      ]
    },
    // EXPLORE flights [destination.state: 'NY] | REDUCE destination.code as newyork_airport, flight_count ORDER BY 2 DESC
    {
      "type": "turtle",
      "name": "new_york_airports",
      "pipeline": [
        {
          "type": "reduce",
          "fields": ["destination.code", "flight_count"],
          "filterList": [fStringEq("destination.state", "NY")],
          "orderBy": [{ "field": "flight_count", "dir": "desc" }]
        }
      ]
    },
    // EXPLORE flights | REDUCE aircraft.aircraft_models.manufacturer, aircraft.aircraft_count, flight_count ORDER BY 3 DESC
    {
      "type": "turtle",
      "name": "flights_by_manufacturer",
      "pipeline": [
        {
          "type": "reduce",
          "fields": [
            "aircraft.aircraft_models.manufacturer",
            "aircraft.aircraft_count",
            "flight_count"
          ],
          "orderBy": [{ "field": "flight_count", "dir": "desc" }],
          "limit": 5
        }
      ]
    },
    // EXPLORE flights [origin.state:'CA'x] | REDUCE carrier, flight_count, top_5_routes, flights_by_manufacturer
    {
      "type": "turtle",
      "name": "carriers_routes_manufacturer",
      "pipeline": [
        {
          "type": "reduce",
          "fields": [
            "carrier",
            "flight_count",
            "top_5_routes",
            "flights_by_manufacturer"
          ],
          "filterList": [fStringEq("origin.state", "CA")]
        }
      ]
    },
    {
      "type": "turtle",
      "name": "top_5_routes_carriers",
      "pipeline": [
        {
          "type": "reduce",
          "fields": [
            "origin_code",
            "destination_code",
            "flight_count",
            "flights_by_carrier"
          ],
          "limit": 5,
          "orderBy": [{ "field": "flight_count", "dir": "desc" }]
        }
      ]
    },
    {
      "type": "turtle",
      "name": "flights_by_carrier_with_totals",
      "pipeline": [
        {
          "type": "reduce",
          "filterList": [fStringEq("origin.state", "CA")],
          "fields": [
            {
              "type": "turtle",
              "name": "main",
              "pipeline": [
                {
                  "type": "reduce",
                  "fields": [
                    "carriers.name",
                    "flight_count",
                    //{ name: "origin.count", as: "origin_count" },
                    {
                      "type": "number",
                      "name": "origin_count",
                      "expressionType": "aggregate",
                      "e": [
                        {
                          "type": "aggregate",
                          "function": "count",
                          "e": [],
                          "structPath": "origin"
                        }
                      ]
                    }
                  ],
                  "orderBy": [{ "field": "flight_count", "dir": "desc" }]
                }
              ]
            },
            {
              "type": "turtle",
              "name": "totals",
              "pipeline": [
                {
                  "type": "reduce",
                  "fields": ["flight_count"]
                }
              ]
            }
          ]
        }
      ]
    },
    {
      "type": "turtle",
      "name": "flight_detail",
      "pipeline": [
        {
          "type": "reduce",
          "orderBy": [{ "field": "dep_time", "dir": "asc" }],
          "fields": [
            "id2",
            "dep_time",
            "tail_num",
            "carrier",
            "origin_code",
            "destination_code",
            "distance",
            "dep_delay"
          ],
          "limit": 500
        }
      ]
    },
    {
      "type": "turtle",
      "name": "some_measures",
      "pipeline": [
        {
          "type": "reduce",
          "fields": [
            "flight_count",
            "total_distance",
            "aircraft.aircraft_count"
          ]
        }
      ]
    },
    {
      "type": "turtle",
      "name": "flights_routes_sessionized",
      "pipeline": [
        {
          "type": "reduce",
          "filterList": [
            fStringEq("origin.state", "CA"),
            fStringEq("carrier", "UA")
          ],
          "limit": 20,
          "fields": [
            {
              "type": "timestamp",
              "name": "dep_time",
              "as": "dep_date",
              "timeframe": "day"
            },
            "carrier",
            {
              "type": "turtle",
              "name": "routes",
              "pipeline": [
                {
                  "type": "reduce",
                  "fields": [
                    "origin_code",
                    "destination_code",
                    "flight_count",
                    {
                      "type": "turtle",
                      "name": "flight_detail",
                      "pipeline": [
                        {
                          "type": "reduce",
                          "orderBy": [{ "field": "dep_time", "dir": "asc" }],
                          "limit": 5,
                          "fields": [
                            "id2",
                            "dep_time",
                            "tail_num",
                            "flight_num",
                            "dep_delay"
                          ]
                        }
                      ]
                    }
                  ],
                  "orderBy": [{ "field": "flight_count", "dir": "desc" }]
                }
              ]
            }
          ]
        }
      ]
    },
    /*
      FROM flights |
        REDUCE
          dep_time.date as dep_date,
          carrier,
          flight_count,
          (REDUCE
            tail_num,
            flight_count,
            (REDUCE
              id2, dep_time, origin_code, destination_code, flight_num, dep_delay
              ORDER BY 2
            )
          ) as aircraft
    */
    {
      "type": "turtle",
      "name": "flights_aircraft_sessionized",
      "pipeline": [
        {
          "type": "reduce",
          "filterList": [fStringEq("carrier", "UA")],
          "limit": 2,
          "fields": [
            {
              "type": "timestamp",
              "name": "dep_time",
              "as": "dep_date",
              "timeframe": "day"
            },
            "carrier",
            "flight_count",
            {
              "type": "turtle",
              "name": "aircraft",
              "pipeline": [
                {
                  "type": "reduce",
                  "limit": 10,
                  "fields": [
                    "tail_num",
                    "flight_count",
                    {
                      "type": "turtle",
                      "name": "flight_detail",
                      "pipeline": [
                        {
                          "type": "reduce",
                          "orderBy": [{ "field": "dep_time", "dir": "asc" }],
                          "fields": [
                            "id2",
                            "dep_time",
                            "origin_code",
                            "destination_code",
                            "flight_num",
                            "dep_delay"
                          ]
                        }
                      ]
                    }
                  ],
                  "orderBy": [{ "field": "flight_count", "dir": "desc" }]
                }
              ]
            }
          ]
        }
      ]
    },
    {
      "type": "turtle",
      "name": "search_index",
      "pipeline": [
        {
          "type": "index",
          "weightMeasure": "flight_count",
          "fields": [
            "carrier",
            "origin_code",
            "destination_code",
            "carriers.name",
            "carriers.nickname",
            "carriers.code",
            "origin.code",
            "origin.full_name",
            "origin.city",
            "origin.state",
            "destination.code",
            "destination.full_name",
            "destination.city",
            "destination.state",
            "aircraft.aircraft_model_code",
            "aircraft.aircraft_models.manufacturer",
            "aircraft.aircraft_models.model"
          ]
        }
      ]
    }
    // {
    //   type: "reduce",
    //   name: "some_measures",
    //   fields: ["flight_count", "total_distance"],
    // },
  ]
};

const tableAirports: StructDef = {
  "type": "struct",
  "name": "malloy-data.malloytest.airports",
  "as": "table_airports",
  "dialect": "standardsql",
  "structSource": {
    "type": "table",
    "tablePath": "malloy-data.malloytest.airports"
  },
  "structRelationship": { "type": "basetable", "connectionName": "bigquery" },
  "primaryKey": "code",
  "fields": [
    { "type": "number", "name": "id", "numberType": "integer" },
    { "type": "string", "name": "code" },
    { "type": "string", "name": "site_number" },
    { "type": "string", "name": "fac_type", "as": "facility_type" },
    { "type": "string", "name": "fac_use", "as": "facility_use" },
    { "type": "string", "name": "faa_region" },
    { "type": "string", "name": "faa_dist" },
    { "type": "string", "name": "city" },
    { "type": "string", "name": "county" },
    { "type": "string", "name": "state" },
    { "type": "string", "name": "full_name" },
    { "type": "string", "name": "own_type" },
    { "type": "number", "name": "longitude", "numberType": "float" },
    { "type": "number", "name": "latitude", "numberType": "float" },
    { "type": "number", "name": "elevation", "numberType": "integer" },
    { "type": "string", "name": "aero_cht" },
    { "type": "number", "name": "cbd_dist", "numberType": "integer" },
    { "type": "string", "name": "cbd_dir" },
    { "type": "string", "name": "act_date" },
    { "type": "string", "name": "cert" },
    { "type": "string", "name": "fed_agree" },
    { "type": "string", "name": "cust_intl" },
    { "type": "string", "name": "c_ldg_rts" },
    { "type": "string", "name": "joint_use" },
    { "type": "string", "name": "mil_rts" },
    { "type": "string", "name": "cntl_twr" },
    { "type": "string", "name": "major" },
    {
      "type": "number",
      "name": "count",
      "expressionType": "aggregate",
      "e": [{ "type": "aggregate", "function": "count", "e": [] }]
    }
  ]
};

/** Test model */
export const testModel: ModelDef = {
  "name": "Hand Coded Models",
  "exports": [
    "flights",
    "table_airports",
    "medicare_test",
    "medicare_state_facts"
    // "aircraft",
  ],
  "contents": {
    "flights": FLIGHTS_EXPLORE,
    "table_airports": tableAirports,
    "medicare_test": medicareModel,
    "medicare_state_facts": medicareStateFacts
    // aircraft: aircraftHandStructDef,
  }
};

// // clang-format on
