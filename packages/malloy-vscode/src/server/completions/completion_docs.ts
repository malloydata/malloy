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

const DOCS_ROOT = "https://looker-open-source.github.io/malloy/documentation";

export const COMPLETION_DOCS: {
  [kind: string]: { [property: string]: string };
} = {
  model_property: {
    explore: `Use \`explore\` to name, describe, and augment a data source.

\`\`\`malloy
explore: flights is table('malloy-data.faa.flights') {
  measure: flight_count is count()
}
\`\`\`

View [the full documentation](${DOCS_ROOT}/language/explore.html).
`,
    query: `Use \`query\` to define a top-level query which can be run within this document.

\`\`\`malloy
query: flights -> {
  group_by: carrier
  aggregate: flight_count
}
\`\`\`

View [the full documentation](${DOCS_ROOT}/language/query.html).
`,
    sql: `Use \`sql\` to declare a block of SQL code.

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
`,
  },
  query_property: {
    group_by: `Use the \`group_by\` clause to specify dimensions by which to group aggregate calculations.

\`\`\`malloy
query: flights -> {
  group_by: carrier
  aggregate: flight_count
}
\`\`\`
    `,
    order_by: `Use \`order_by\` to control the ordering of results.

\`\`\`malloy
query: flights -> {
  group_by: carrier
  order_by: carrier asc
}
\`\`\`

View [the full documentation](${DOCS_ROOT}/language/order_by.html#explicit-ordering).
`,
    project: `Use \`project\` to retrieve dimensional values without grouping or aggregating.

\`\`\`malloy
query: flights -> {
  project: [ id2, carrier, dep_time ]
  limit: 10
}
\`\`\`

View [the full documentation](${DOCS_ROOT}/language/basic.html#project).
`,
    index: `Use \`index\` to produce a search index.

\`\`\`malloy
query: flights -> {
  index: * on flight_count
}
\`\`\`

View [the full documentation](${DOCS_ROOT}).
`,
    aggregate: `Use \`aggregate\` to perform aggregate computations like \`count()\` or \`sum()\`.

\`\`\`malloy
query: flights -> {
  group_by: carrier
  aggregate: [
    flight_count is count()
    total_distance is sum(distance)
  ]
}
\`\`\`

View [the full documentation](${DOCS_ROOT}/language/aggregates.html).
`,
    top: `Use \`top\` to restrict the number of results returned.

\`\`\`malloy
query: flights -> {
  top: 10 by flight_count asc
  group_by: carrier
  aggregate: flight_count
}
\`\`\`

View [the full documentation](${DOCS_ROOT}/language/order_by.html#limiting).
`,
    limit: `Use \`limit\` to restrict the number of results returned.

\`\`\`malloy
query: flights -> {
  project: *
  limit: 10
}
\`\`\`

View [the full documentation](${DOCS_ROOT}/language/order_by.html#limiting).
`,
    where: `Use \`where\` to narrow down results.

\`\`\`malloy
query: flights -> {
  where: origin.state = 'CA'
  aggregate: flight_count
}
\`\`\`

View [the full documentation](${DOCS_ROOT}/language/filters.html).
`,
    having: `Use \`having\` to narrow down results based on conditions of aggregate values.

\`\`\`malloy
query: flights -> {
  group_by: carrier
  aggregate: total_distance
  having: total_distance > 1000
}
\`\`\`

View [the full documentation](${DOCS_ROOT}/language/filters.html).
`,
    nest: `Use \`nest\` to include a nested query.

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
`,
  },
  explore_property: {
    dimension: `Use \`dimension\` to define a non-aggregate calculation.

\`\`\`malloy
explore: flights is table('malloy-data.faa.flights') {
  dimension: distance_km is distance * 1.609
}
\`\`\`

View [the full documentation](${DOCS_ROOT}/language/fields.html#dimensions).
`,
    measure: `Use \`measure\` to define an aggregate calculation.

\`\`\`malloy
explore: flights is table('malloy-data.faa.flights') {
  measure: flight_count is count()
}
\`\`\`

View [the full documentation](${DOCS_ROOT}/language/fields.html#measures).
`,
    query: `Use \`query\` to define a named query which can be referenced and/or refined.

\`\`\`malloy
explore: flights is table('malloy-data.faa.flights') {
  query: by_carrier is {
    group_by: carrier,
    aggregate: flight_count
  }
}
\`\`\`

View [the full documentation](${DOCS_ROOT}/language/fields.html#queries).
`,
    join_one: `Use \`join_one\` to define a joined explore which has one row for each row in the source table.

\`\`\`malloy
explore: flights is table('malloy-data.faa.flights') {
  join_one: carriers with carrier
  join_one: origin is airports with origin_code
}
\`\`\`

View [the full documentation](${DOCS_ROOT}/language/join.html).
`,
    join_many: `Use \`join_many\` to define a joined explore which has many rows for each row in the source table.

\`\`\`malloy
explore: users is table('users') {
  join_many: orders is table('orders') on id = orders.user_id and orders.user_id != null
}
\`\`\`

View [the full documentation](${DOCS_ROOT}/language/join.html).
`,
    join_cross: `Use \`join_cross\` to define a join via a cross product, resulting in many rows on each side of the join.

View [the full documentation](${DOCS_ROOT}/language/join.html).
`,
    where: `Use \`where\` to limit the limit the rows of an explore.

\`\`\`malloy
explore: long_flights is flights {
  where: distance > 1000
}
\`\`\`

View [the full documentation](${DOCS_ROOT}/language/filters.html).
`,
    primary_key: `Use \`primary_key\` to specify a primary key for joining.

\`\`\`malloy
explore: flights is table('malloy-data.faa.flights') {
  primary_key: id2
}
\`\`\`

View [the full documentation](${DOCS_ROOT}/language/explore.html#primary-keys).
`,
    rename: `Use \`rename\` to rename a field from the source explore/table.

\`\`\`malloy
explore: flights is table('malloy-data.faa.flights') {
  rename: origin_code is origin
}
\`\`\`

View [the full documentation](${DOCS_ROOT}/language/explore.html#renaming-fields).
`,
    accept: `Use \`accept\` to specify which fields to include from the source explore/table.

\`\`\`malloy
explore: airports is table('malloy-data.faa.airports') {
  accept: [ id, name, code, city, state, elevation ]
}
\`\`\`

View [the full documentation](${DOCS_ROOT}/language/explore.html#limiting-access-to-fields).
`,
    except: `Use \`except\` to specify which fields to exclude from the source explore/table.

\`\`\`malloy
explore: airports is table('malloy-data.faa.airports') {
  except: [ c_ldg_rts, aero_cht, cntl_twr ]
}
\`\`\`

View [the full documentation](${DOCS_ROOT}/language/explore.html#limiting-access-to-fields).
`,
  },
};
