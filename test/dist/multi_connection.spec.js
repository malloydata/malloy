"use strict";
/* eslint-disable no-console */
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const malloy = __importStar(require("@malloydata/malloy"));
const malloy_1 = require("@malloydata/malloy");
const runtimes_1 = require("./runtimes");
const bqConnection = new runtimes_1.BigQueryTestConnection("bigquery", {}, { defaultProject: "malloy-data" });
const postgresConnection = new runtimes_1.PostgresTestConnection("postgres");
const files = new malloy_1.EmptyURLReader();
const connectionMap = new malloy.FixedConnectionMap(new Map(Object.entries({
    bigquery: bqConnection,
    postgres: postgresConnection,
})), "bigquery");
const runtime = new malloy.Runtime(files, connectionMap);
afterAll(async () => {
    await postgresConnection.drain();
});
const expressionModelText = `
explore: default_aircraft is table('malloytest.aircraft'){
  measure: aircraft_count is count(DISTINCT tail_num)
}

explore: bigquery_state_facts is table('malloytest.state_facts'){
  measure: state_count is count(DISTINCT state)+2
}

explore: postgres_aircraft is table('postgres:malloytest.aircraft'){
  measure: aircraft_count is count(DISTINCT tail_num)+4
}
`;
const expressionModel = runtime.loadModel(expressionModelText);
it(`default query`, async () => {
    const result = await expressionModel
        .loadQuery(`
      query: default_aircraft-> {
        aggregate: aircraft_count
      }
    `)
        .run();
    // console.log(result.sql);
    expect(result.data.path(0, "aircraft_count").value).toBe(3599);
});
it(`bigquery query`, async () => {
    const result = await expressionModel
        .loadQuery(`
      query: bigquery_state_facts-> {
        aggregate: state_count
      }
    `)
        .run();
    // console.log(result.sql);
    expect(result.data.path(0, "state_count").value).toBe(53);
});
it(`postgres query`, async () => {
    const result = await expressionModel
        .loadQuery(`
      query: postgres_aircraft-> {
        aggregate: aircraft_count
      }
    `)
        .run();
    expect(result.data.path(0, "aircraft_count").value).toBe(3603);
});
it(`postgres raw query`, async () => {
    const result = await runtime
        .loadQuery(`
      query: table('postgres:malloytest.airports')->{
        group_by:
          version is version()
        aggregate:
          code_count is count(distinct code)
          airport_count is count()
      }
    `)
        .run();
    expect(result.data.path(0, "airport_count").value).toBe(19793);
    expect(result.data.path(0, "version").value).toMatch(/Postgre/);
    expect(result.data.path(0, "code_count").value).toBe(19793);
});
//# sourceMappingURL=multi_connection.spec.js.map