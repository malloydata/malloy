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

// eslint-disable-next-line @typescript-eslint/no-explicit-any

import { DuckDBTestConnection } from "./runtimes";

const duckDB = new DuckDBTestConnection("duckdb");

it(`silly test}`, async () => {
  // // eslint-disable-next-line @typescript-eslint/no-var-requires
  // // const count = await duckDB.runSQL("SELECT COUNT(*) FROM 'airports';");
  const count = await duckDB.runSQL(
    // `SELECT ('x'|| SUBSTR(MD5('hello')::varchar,16,14))::DECIMAL(38,9)`
    // `SELECT
    //   SUM(
    `
      SELECT
        (10::DECIMAL(18,3)*100000000)
    `
    //     (
    //     SELECT
    //     0::DECIMAL(38,9) + sum(DISTINCT 16::DECIMAL(38,9)^rr::DECIMAL(38,9) * CASE WHEN f >= 'a' THEN ord(f)- ord('a') ELSE  ord(f) - ord('0') END)
    //    FROM (SELECT f, row_number() over () as rr FROM (SELECT UNNEST(STR_SPLIT(MD5('hello')[1:10],'')) f) as x)
    //    )
    //     -
    //   (
    //     SELECT
    //    0::DECIMAL(38,9) + sum(DISTINCT 16::DECIMAL(38,9)^rr::DECIMAL(38,9) * CASE WHEN f >= 'a' THEN ord(f)- ord('a') ELSE  ord(f) - ord('0') END) + 4
    //    FROM (SELECT f, row_number() over () as rr FROM (SELECT UNNEST(STR_SPLIT(MD5('hello')[1:10],'')) f) as x)
    //   )
    // `
    //   )::DECIMAL(38,9) as bighash
    // FROM malloytest.airports
    // limit 10`
  );

  // const count = await duckDB.fetchSchemaForTables(["malloytest.airports"]);

  console.log(count);
});
