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

import { BigQueryConnection } from "@malloy-lang/db-bigquery";
import { Runtime, EmptyUrlReader } from "@malloy-lang/malloy";

const files = new EmptyUrlReader();
const bqConnection = new BigQueryConnection("bigquery");
const bigquery = new Runtime({
  urls: files,
  schemas: bqConnection,
  connections: bqConnection,
});

const theModel = `
define flights is (explore 'malloy-data.malloytest.flights'
  measures is (reduce
    total_distance is sum(distance)
    flight_count is count()
  )
);
`;

it("can correctly make a query from an explore and a name", async () => {
  const result = await bigquery
    .makeModel(theModel)
    .getExploreByName("flights")
    .getQueryByName("measures")
    .run();
  expect(result.getData().toObject()).toMatchObject([
    {
      measures: { flight_count: 37561525, total_distance: 27540298839 },
    },
  ]);
});
