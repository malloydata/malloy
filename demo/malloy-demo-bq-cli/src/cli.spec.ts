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
import { InMemoryUriReader } from "malloy";
import { run } from "./index";

const unModeledQuery = "'examples.flights' | reduce flight_count is count()";
const modeledQuery = "flights | reduce flight_count";
const model = "define flights is ('examples.flights' flight_count is count());";

const modelUri = "file:///flights.malloy";
const modeledQueryUri = "file:///modeled_query.malloy";
const unmodeledQueryUri = "file:///unmodeled_.malloy";

const files = new InMemoryUriReader(
  new Map([
    [modelUri, model],
    [modeledQueryUri, modeledQuery],
    [unmodeledQueryUri, unModeledQuery],
  ])
);

it("runs a query string", async () => {
  const result = await run(files, ["--query", unModeledQuery]);
  expect(result.result).toMatchObject([{ flight_count: 37561525 }]);
});

it("runs a query file", async () => {
  const result = await run(files, ["--query-file", unmodeledQueryUri]);
  expect(result.result).toMatchObject([{ flight_count: 37561525 }]);
});

it("runs a query string against a model string", async () => {
  const result = await run(files, ["--query", modeledQuery, "--model", model]);
  expect(result.result).toMatchObject([{ flight_count: 37561525 }]);
});

it("runs a query string against a model file", async () => {
  const result = await run(files, [
    "--query",
    modeledQuery,
    "--model-file",
    modelUri,
  ]);
  expect(result.result).toMatchObject([{ flight_count: 37561525 }]);
});

it("runs a query file against a model string", async () => {
  const result = await run(files, [
    "--query-file",
    modeledQueryUri,
    "--model",
    model,
  ]);
  expect(result.result).toMatchObject([{ flight_count: 37561525 }]);
});

it("runs a query file against a model file", async () => {
  const result = await run(files, [
    "--query-file",
    modeledQueryUri,
    "--model-file",
    modelUri,
  ]);
  expect(result.result).toMatchObject([{ flight_count: 37561525 }]);
});
