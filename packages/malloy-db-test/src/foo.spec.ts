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

import { Runtime, EmptyURLReader } from "malloy";
import { BigQueryConnection } from "malloy-db-bigquery";

const files = new EmptyURLReader();
const bqConnection = new BigQueryConnection("bigquery");
const bigquery = new Runtime({
  urls: files,
  schemas: bqConnection,
  connections: bqConnection,
});

const theModel = `
define flights is (explore 'examples.flights'
  measures is (reduce
    total_distance is sum(distance)
    flight_count is count()
  )
);
`;

it("demo", async () => {
  // await bigquery
  //   .makeQuery("'examples.flights' | reduce flight_count is count()")
  //   .run();

  await bigquery
    .makeModel(theModel)
    .makeQuery("flights | reduce flight_count is count()")
    .run();

  const modelRequest = bigquery.makeModel(theModel);

  const model = await modelRequest.build();
  await modelRequest
    .getExploreByName("flights")
    .getQueryByName("measures")
    .run();
  await modelRequest
    .getExploreByName("flights")
    .getQueryByName("measures")
    .run();

  const query = await modelRequest
    .getExploreByName("flights")
    .getQueryByName("measures")
    .build();


  const params = unfulfilledParams.stuff();

  const queryRequest = await modelRequest
    .getExploreByName("flights")
    .getQueryByName("measures");

  const requirements: Requirements = await queryRequest
    .getRequirements();

  await queryRequest.run(fulfill(requirements));

  (await queryRequest.build()).getResultExplore();
  await queryRequest.getResultExplore().build();

  // PreparedQuery.getSourceExplore(): Explore
  // PreparedQuery.getResultExplore(): Explore
  // PreparedQuery.getRequirements(): Requirments
  // PreparedQuery.getSQL(): PreparedSQL

  // BuildPreparedQuery.getSourceExplore(): BuildExplore
  // BuildPreparedQuery.getResultExplore(): BuildExplore
  // BuildPreparedQuery.getRequirements(): BuildRequirements
  // BuildPreparedQuery.getSQL(): BuildPreparedSQL
  // BuildPreparedQuery.run(): Promise<Result>



  await modelRequest
    .getExploreByName("flights")
    .getQueryByName("measures")
    .run(params);


    // Runtime
    // Model
    // Explore
    // ----- PreparedQuery
    // PreparedSQL --- PreparedResult
    // Result

  // nix withModel etc.
  // add caching to the builders
  // PreparedQuery.getExplore();
  // Root explore has BaseTable relationship "source" or Query
  // better names that represent that the result is a "request" or "builder" and not a thing.
});
