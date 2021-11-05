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
import { InMemoryUrlReader } from "malloy";
import { run, pathToUrl } from "./index";

const unModeledQuery = "'examples.flights' | reduce flight_count is count()";
const modeledQuery = "flights | reduce flight_count";
const model = "define flights is ('examples.flights' flight_count is count());";

const modelPath = "/flights.malloy";
const modeledQueryPath = "/modeled_query.malloy";
const unmodeledQueryPath = "/unmodeled_.malloy";

const files = new InMemoryUrlReader(
  new Map([
    [pathToUrl(modelPath).toString(), model],
    [pathToUrl(modeledQueryPath).toString(), modeledQuery],
    [pathToUrl(unmodeledQueryPath).toString(), unModeledQuery],
  ])
);

it("runs a query string", async () => {
  const result = await run(files, ["--query", unModeledQuery]);
  expect(result.getData().toObject()).toMatchObject([
    { flight_count: 37561525 },
  ]);
});

it("runs a query file", async () => {
  const result = await run(files, ["--query-file", unmodeledQueryPath]);
  expect(result.getData().toObject()).toMatchObject([
    { flight_count: 37561525 },
  ]);
});

it("runs a query string against a model string", async () => {
  const result = await run(files, ["--query", modeledQuery, "--model", model]);
  expect(result.getData().toObject()).toMatchObject([
    { flight_count: 37561525 },
  ]);
});

it("runs a query string against a model file", async () => {
  const result = await run(files, [
    "--query",
    modeledQuery,
    "--model-file",
    modelPath,
  ]);
  expect(result.getData().toObject()).toMatchObject([
    { flight_count: 37561525 },
  ]);
});

it("runs a query file against a model string", async () => {
  const result = await run(files, [
    "--query-file",
    modeledQueryPath,
    "--model",
    model,
  ]);
  expect(result.getData().toObject()).toMatchObject([
    { flight_count: 37561525 },
  ]);
});

it("runs a query file against a model file", async () => {
  const result = await run(files, [
    "--query-file",
    modeledQueryPath,
    "--model-file",
    modelPath,
  ]);
  expect(result.getData().toObject()).toMatchObject([
    { flight_count: 37561525 },
  ]);
});
