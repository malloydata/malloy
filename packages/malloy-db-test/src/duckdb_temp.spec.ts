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
  // // eslint-disable-next-line @typescript-eslint/nom-var-requires
  // // const count = await duckDB.runSQL("SELECT COUNT(*) FROM 'airports';");
  const count = await duckDB.runSQL(
`
WITH __stage0 AS (
  SELECT
    group_set,
    base.state as state__0,
    CASE WHEN group_set=0 THEN
      COUNT( 1)
      END as airport_count__0,
    CASE WHEN group_set=1 THEN
      base.fac_type
      END as fac_type__1,
    CASE WHEN group_set=1 THEN
      COUNT( 1)
      END as airport_count__1
  FROM malloytest.airports as base
  CROSS JOIN (SELECT UNNEST(GENERATE_SERIES(0,1,1)) as group_set  ) as group_set
  WHERE base.state IS NOT NULL
  GROUP BY 1,2,4
)
, __stage1 AS (
  SELECT
    state__0 as state,
    (LIST(airport_count__0) FILTER (WHERE group_set=0 AND airport_count__0 IS NOT NULL))[1] as airport_count,
    LIST({
      fac_type: fac_type__1,
      airport_count: airport_count__1}  ORDER BY  airport_count__1 desc) FILTER(WHERE group_set=1) as by_fac_type
  FROM __stage0
  GROUP BY 1
  ORDER BY 2 desc
  LIMIT 2
), __stage2 as (
  SELECT *, UNNEST(by_fac_type) as by_fac_type  FROM __stage1
)
SELECT to_json(list(row(state, airport_count, by_fac_type)))::VARCHAR as results FROM __stage2 AS finalStage
`
    // `SELECT ('x'|| SUBSTR(MD5('hello')::varchar,16,14))::DECIMAL(38,9)`
    // `SELECT
    //   SUM(
    // `
    //   SELECT
    //     (10::DECIMAL(18,3)*100000000)
    // `
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
