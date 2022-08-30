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

const DOCS_ROOT = "https://looker-open-source.github.io/malloy/documentation";

const MODEL_SOURCE_DOC = `Use \`source\` to name, describe, and augment a data source.

\`\`\`malloy
source: flights is table('malloy-data.faa.flights') {
  measure: flight_count is count()
}
\`\`\`

View [the full documentation](${DOCS_ROOT}/language/source.html).
`;

const MODEL_QUERY_DOC = `Use \`query\` to define a top-level query which can be run within this document.

\`\`\`malloy
query: flights -> {
  group_by: carrier
  aggregate: flight_count
}
\`\`\`

View [the full documentation](${DOCS_ROOT}/language/query.html).
`;

const MODEL_SQL_DOC = `Use \`sql\` to declare a block of SQL code.

\`\`\`malloy
sql: users_sample is ||
  SELECT
    first_name,
    last_name,
    gender
  FROM malloy-data.ecomm.users
  LIMIT 10
;;
\`\`\`

View [the full documentation](${DOCS_ROOT}/language/sql_blocks.html).
`;

const QUERY_GROUP_BY_DOC = `Use the \`group_by\` clause to specify dimensions by which to group aggregate calculations.

\`\`\`malloy
query: flights -> {
  group_by: carrier
  aggregate: flight_count
}
\`\`\`
`;

const QUERY_ORDER_BY_DOC = `Use \`order_by\` to control the ordering of results.

\`\`\`malloy
query: flights -> {
  group_by: carrier
  order_by: carrier asc
}
\`\`\`

View [the full documentation](${DOCS_ROOT}/language/order_by.html#explicit-ordering).
`;

const QUERY_PROJECT_DOC = `Use \`project\` to retrieve dimensional values without grouping or aggregating.

\`\`\`malloy
query: flights -> {
  project: id2, carrier, dep_time
  limit: 10
}
\`\`\`

View [the full documentation](${DOCS_ROOT}/language/basic.html#project).
`;

const QUERY_INDEX_DOC = `Use \`index\` to produce a search index.

\`\`\`malloy
query: flights -> {
  index: * on flight_count
}
\`\`\`

View [the full documentation](${DOCS_ROOT}).
`;

const QUERY_AGGREGATE_DOC = `Use \`aggregate\` to perform aggregate computations like \`count()\` or \`sum()\`.

\`\`\`malloy
query: flights -> {
  group_by: carrier
  aggregate:
    flight_count is count()
    total_distance is sum(distance)
}
\`\`\`

View [the full documentation](${DOCS_ROOT}/language/aggregates.html).
`;

const QUERY_TOP_DOC = `Use \`top\` to restrict the number of results returned.

\`\`\`malloy
query: flights -> {
  top: 10 by flight_count asc
  group_by: carrier
  aggregate: flight_count
}
\`\`\`

View [the full documentation](${DOCS_ROOT}/language/order_by.html#limiting).
`;

const QUERY_LIMIT_DOC = `Use \`limit\` to restrict the number of results returned.

\`\`\`malloy
query: flights -> {
  project: *
  limit: 10
}
\`\`\`

View [the full documentation](${DOCS_ROOT}/language/order_by.html#limiting).
`;

const QUERY_WHERE_DOC = `Use \`where\` to narrow down results.

\`\`\`malloy
query: flights -> {
  where: origin.state = 'CA'
  aggregate: flight_count
}
\`\`\`

View [the full documentation](${DOCS_ROOT}/language/filters.html).
`;

const QUERY_HAVING_DOC = `Use \`having\` to narrow down results based on conditions of aggregate values.

\`\`\`malloy
query: flights -> {
  group_by: carrier
  aggregate: total_distance
  having: total_distance > 1000
}
\`\`\`

View [the full documentation](${DOCS_ROOT}/language/filters.html).
`;

const QUERY_NEST_DOC = `Use \`nest\` to include a nested query.

\`\`\`malloy
query: flights -> {
  group_by: carrier
  nest: by_origin_state is {
    group_by: origin.state
    aggregate: flight_count
  }
}
\`\`\`

View [the full documentation](${DOCS_ROOT}/language/nesting.html).
`;

const SOURCE_DIMENSION_DOC = `Use \`dimension\` to define a non-aggregate calculation.

\`\`\`malloy
source: flights is table('malloy-data.faa.flights') {
  dimension: distance_km is distance * 1.609
}
\`\`\`

View [the full documentation](${DOCS_ROOT}/language/fields.html#dimensions).
`;

const SOURCE_MEASURE_DOC = `Use \`measure\` to define an aggregate calculation.

\`\`\`malloy
source: flights is table('malloy-data.faa.flights') {
  measure: flight_count is count()
}
\`\`\`

View [the full documentation](${DOCS_ROOT}/language/fields.html#measures).
`;

const SOURCE_QUERY_DOC = `Use \`query\` to define a named query which can be referenced and/or refined.

\`\`\`malloy
source: flights is table('malloy-data.faa.flights') {
  query: by_carrier is {
    group_by: carrier,
    aggregate: flight_count
  }
}
\`\`\`

View [the full documentation](${DOCS_ROOT}/language/fields.html#queries).
`;

const SOURCE_JOIN_ONE_DOC = `Use \`join_one\` to define a joined explore which has one row for each row in the source table.

\`\`\`malloy
source: flights is table('malloy-data.faa.flights') {
  join_one: carriers with carrier
  join_one: origin is airports with origin_code
}
\`\`\`

View [the full documentation](${DOCS_ROOT}/language/join.html).
`;

const SOURCE_JOIN_MANY_DOC = `Use \`join_many\` to define a joined explore which has many rows for each row in the source table.

\`\`\`malloy
source: users is table('users') {
  join_many: orders is table('orders') on id = orders.user_id and orders.user_id != null
}
\`\`\`

View [the full documentation](${DOCS_ROOT}/language/join.html).
`;

const SOURCE_JOIN_CROSS_DOC = `Use \`join_cross\` to define a join via a cross product, resulting in many rows on each side of the join.

View [the full documentation](${DOCS_ROOT}/language/join.html).
`;

const SOURCE_WHERE_DOC = `Use \`where\` to limit the limit the rows of an explore.

\`\`\`malloy
source: long_flights is flights {
  where: distance > 1000
}
\`\`\`

View [the full documentation](${DOCS_ROOT}/language/filters.html).
`;

const SOURCE_PRIMARY_KEY_DOC = `Use \`primary_key\` to specify a primary key for joining.

\`\`\`malloy
source: flights is table('malloy-data.faa.flights') {
  primary_key: id2
}
\`\`\`

View [the full documentation](${DOCS_ROOT}/language/explore.html#primary-keys).
`;

const SOURCE_RENAME_DOC = `Use \`rename\` to rename a field from the source explore/table.

\`\`\`malloy
source: flights is table('malloy-data.faa.flights') {
  rename: origin_code is origin
}
\`\`\`

View [the full documentation](${DOCS_ROOT}/language/explore.html#renaming-fields).
`;

const SOURCE_ACCEPT_DOC = `Use \`accept\` to specify which fields to include from the source explore/table.

\`\`\`malloy
source: airports is table('malloy-data.faa.airports') {
  accept: [ id, name, code, city, state, elevation ]
}
\`\`\`

View [the full documentation](${DOCS_ROOT}/language/explore.html#limiting-access-to-fields).
`;

const SOURCE_EXCEPT_DOC = `Use \`except\` to specify which fields to exclude from the source explore/table.

\`\`\`malloy
source: airports is table('malloy-data.faa.airports') {
  except: [ c_ldg_rts, aero_cht, cntl_twr ]
}
\`\`\`

View [the full documentation](${DOCS_ROOT}/language/explore.html#limiting-access-to-fields).
`;

export const COMPLETION_DOCS: {
  [kind: string]: { [property: string]: string };
} = {
  model_property: {
    source: MODEL_SOURCE_DOC,
    query: MODEL_QUERY_DOC,
    sql: MODEL_SQL_DOC,
  },
  query_property: {
    group_by: QUERY_GROUP_BY_DOC,
    order_by: QUERY_ORDER_BY_DOC,
    project: QUERY_PROJECT_DOC,
    index: QUERY_INDEX_DOC,
    aggregate: QUERY_AGGREGATE_DOC,
    top: QUERY_TOP_DOC,
    limit: QUERY_LIMIT_DOC,
    where: QUERY_WHERE_DOC,
    having: QUERY_HAVING_DOC,
    nest: QUERY_NEST_DOC,
  },
  explore_property: {
    dimension: SOURCE_DIMENSION_DOC,
    measure: SOURCE_MEASURE_DOC,
    query: SOURCE_QUERY_DOC,
    join_one: SOURCE_JOIN_ONE_DOC,
    join_many: SOURCE_JOIN_MANY_DOC,
    join_cross: SOURCE_JOIN_CROSS_DOC,
    where: SOURCE_WHERE_DOC,
    primary_key: SOURCE_PRIMARY_KEY_DOC,
    rename: SOURCE_RENAME_DOC,
    accept: SOURCE_ACCEPT_DOC,
    except: SOURCE_EXCEPT_DOC,
  },
};
