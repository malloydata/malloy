/*
 * Copyright 2022 Google LLC
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
import { InMemoryURLReader } from "@malloydata/malloy";
import { run, pathToURL } from "./index";

const unModeledQuery =
  "query: table('malloy-data.malloytest.flights')->{aggregate: flight_count is count()}";
const modeledQuery = "query: flights->{ aggregate: flight_count}";
const model =
  "explore: flights is table('malloy-data.malloytest.flights'){measure: flight_count is count()}";

const modelPath = "/flights.malloy";
const modeledQueryPath = "/modeled_query.malloy";
const unmodeledQueryPath = "/unmodeled_.malloy";

const files = new InMemoryURLReader(
  new Map([
    [pathToURL(modelPath).toString(), model],
    [pathToURL(modeledQueryPath).toString(), modeledQuery],
    [pathToURL(unmodeledQueryPath).toString(), unModeledQuery],
  ])
);

it("runs a query string", async () => {
  const result = await run(files, ["--query", unModeledQuery]);
  expect(result.data.value[0].flight_count).toBe(344827);
});

it("runs a query file", async () => {
  const result = await run(files, ["--query-file", unmodeledQueryPath]);
  expect(result.data.value[0].flight_count).toBe(344827);
});

it("runs a query string against a model string", async () => {
  const result = await run(files, ["--query", modeledQuery, "--model", model]);
  expect(result.data.value[0].flight_count).toBe(344827);
});

it("runs a query string against a model file", async () => {
  const result = await run(files, [
    "--query",
    modeledQuery,
    "--model-file",
    modelPath,
  ]);
  expect(result.data.value[0].flight_count).toBe(344827);
});

it("runs a query file against a model string", async () => {
  const result = await run(files, [
    "--query-file",
    modeledQueryPath,
    "--model",
    model,
  ]);
  expect(result.data.value[0].flight_count).toBe(344827);
});

it("runs a query file against a model file", async () => {
  const result = await run(files, [
    "--query-file",
    modeledQueryPath,
    "--model-file",
    modelPath,
  ]);
  expect(result.data.value[0].flight_count).toBe(344827);
});
