/*
 * Copyright 2021 Google LLC
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * version 2 as published by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 */

import { StructDef } from "@malloydata/malloy";

// will it build?

/** Medicare Model */
export const medicareModel: StructDef = {
  as: "medicare_test",
  dialect: "standardsql",
  fields: [
    // Fields in the flights table.
    { name: "id", numberType: "integer", type: "number" },
    { name: "drg_definition", type: "string" },
    { name: "provider_id", numberType: "integer", type: "number" },
    { name: "provider_name", type: "string" },
    { name: "provider_street", type: "string" },
    { name: "provider_city", type: "string" },
    { name: "provider_state", type: "string" },
    { name: "provider_zipcode", numberType: "integer", type: "number" },
    { name: "hospital_referral_region_description", type: "string" },
    {
      as: "discharges",
      name: "total_discharges",
      numberType: "float",
      type: "number",
    },
    { name: "average_covered_charges", numberType: "float", type: "number" },
    { name: "average_total_payments", numberType: "float", type: "number" },
    { name: "average_medicare_payments", numberType: "float", type: "number" },
    {
      type: "number",
      name: "count_of_drugs",
      aggregate: true,
      e: [{ type: "aggregate", function: "count", e: [] }],
    },
    {
      type: "number",
      name: "provider_count",
      aggregate: true,
      e: ["COUNT(DISTINCT ", { type: "fieldPath", path: ["provider_id"] }, ")"],
    },
    {
      type: "number",
      name: "total_discharges",
      aggregate: true,
      e: [
        {
          type: "aggregate",
          function: "sum",
          e: [{ type: "fieldPath", path: ["discharges"] }],
        },
      ],
    },

    {
      type: "turtle",
      name: "discharges_by_state",
      pipeline: [
        {
          fields: ["provider_state", "total_discharges"],
          orderBy: [{ dir: "desc", field: 2 }],
          type: "reduce",
        },
      ],
    },
    {
      type: "turtle",
      name: "discharges_by_city",
      pipeline: [
        {
          fields: ["provider_city", "total_discharges"],
          orderBy: [{ dir: "desc", field: 2 }],
          type: "reduce",
        },
      ],
    },
    {
      type: "turtle",
      name: "bigturtle_state",
      pipeline: [
        {
          fields: [
            "provider_state",
            "total_discharges",
            "discharges_by_city",
            "discharges_by_zip",
          ],
          orderBy: [{ dir: "desc", field: 1 }],
          type: "reduce",
        },
      ],
    },
    {
      type: "turtle",
      name: "discharges_by_zip",
      pipeline: [
        {
          fields: ["provider_zipcode", "total_discharges"],
          orderBy: [{ dir: "desc", field: 2 }],
          type: "reduce",
        },
      ],
    },
    {
      type: "turtle",
      name: "turtle_city_zip",
      pipeline: [
        {
          fields: ["provider_city", "total_discharges", "discharges_by_zip"],
          orderBy: [{ dir: "desc", field: 1 }],
          type: "reduce",
        },
      ],
    },
    {
      type: "turtle",
      name: "triple_turtle",
      pipeline: [
        {
          fields: ["provider_state", "total_discharges", "turtle_city_zip"],
          orderBy: [{ dir: "desc", field: 1 }],
          type: "reduce",
        },
      ],
    },
    {
      type: "turtle",
      name: "rollup_by_location",
      pipeline: [
        {
          fields: [
            "provider_state",
            "total_discharges",
            {
              type: "turtle",
              name: "turtle_city_zip",
              pipeline: [
                {
                  fields: [
                    "provider_city",
                    "total_discharges",
                    {
                      type: "turtle",
                      name: "discharges_by_zip",
                      pipeline: [
                        {
                          fields: ["provider_zipcode", "total_discharges"],
                          orderBy: [{ dir: "desc", field: 2 }],
                          type: "reduce",
                        },
                      ],
                    },
                  ],
                  orderBy: [{ dir: "desc", field: 1 }],
                  type: "reduce",
                },
              ],
            },
          ],
          orderBy: [{ dir: "desc", field: 1 }],
          type: "reduce",
        },
      ],
    },
  ],
  name: "malloy-data.malloytest.bq_medicare_test",
  primaryKey: "id",
  structRelationship: { type: "basetable", connectionName: "bigquery" },
  structSource: { type: "table" },
  type: "struct",
};

export const medicareStateFacts: StructDef = {
  fields: [],
  name: "medicare_state_facts",
  dialect: "standardsql",
  structRelationship: { type: "basetable", connectionName: "bigquery" },
  structSource: {
    query: {
      structRef: "medicare_test",
      pipeline: [
        {
          fields: [
            "provider_state",
            { as: "num_providers", name: "provider_count" },
          ],
          type: "reduce",
        },
      ],
    },
    type: "query",
  },
  type: "struct",
};

// export const medicareStateFacts: StructDef = {
//   type: 'struct',
//   name: '(SELECT provider_state, COUNT(DISTINCT provider_id) as num_providers FROM malloytest.medicare_test GROUP BY 1)',
//   as: 'medicare_state_facts',
//   structRelationship: {type:'basetable'},
//   structSource: {type:'table'},
//   primaryKey: 'provider_state',
//   fields: [{type:'string', name:'provider_state'}, {type:'number', name: 'num_providers', numberType: 'integer'}]
// }
