/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

const DOCS_ROOT = 'https://docs.malloydata.dev/documentation';

const MODEL_SOURCE_DOC = `Use \`source\` to name, describe, and augment a data source.

\`\`\`malloy
source: flights is duckdb.table('flights.parquet') extend {
  measure: flight_count is count()
}
\`\`\`

View [the full documentation](${DOCS_ROOT}/language/source).
`;

const MODEL_QUERY_DOC = `Use \`query\` to define a query which can be run within this document.

\`\`\`malloy
query: flights_by_carrier is flights -> {
  group_by: carrier
  aggregate: flight_count
}
\`\`\`

View [the full documentation](${DOCS_ROOT}/language/query).
`;

const MODEL_RUN_DOC = `Use \`run\` to define an anonymous query which can be run within this document.

\`\`\`malloy
run: flights -> {
  group_by: carrier
  aggregate: flight_count
}
\`\`\`

View [the full documentation](${DOCS_ROOT}/language/statement#run-statements).
`;

const QUERY_GROUP_BY_DOC = `Use the \`group_by\` clause to specify dimensions by which to group aggregate calculations.

\`\`\`malloy
run: flights -> {
  group_by: carrier
  aggregate: flight_count
}
\`\`\`
`;

const QUERY_ORDER_BY_DOC = `Use \`order_by\` to control the ordering of results.

\`\`\`malloy
run: flights -> {
  group_by: carrier
  order_by: carrier asc
}
\`\`\`

View [the full documentation](${DOCS_ROOT}/language/order_by#explicit-ordering).
`;

const QUERY_SELECT_DOC = `Use \`select\` to retrieve dimensional values without grouping or aggregating.

\`\`\`malloy
run: flights -> {
  select: id2, carrier, dep_time
  limit: 10
}
\`\`\`

View [the full documentation](${DOCS_ROOT}/user_guides/basic#select).
`;

const QUERY_INDEX_DOC = `Use \`index\` to produce a search index.

\`\`\`malloy
run: flights -> {
  index: * on flight_count
}
\`\`\`

View [the full documentation](${DOCS_ROOT}).
`;

const QUERY_AGGREGATE_DOC = `Use \`aggregate\` to perform aggregate computations like \`count()\` or \`sum()\`.

\`\`\`malloy
run: flights -> {
  group_by: carrier
  aggregate:
    flight_count is count()
    total_distance is sum(distance)
}
\`\`\`

View [the full documentation](${DOCS_ROOT}/language/aggregates).
`;

const QUERY_CALCULATE_DOC = `Use \`calculate\` to perform aggregate computations like \`count()\` or \`sum()\`.

\`\`\`malloy
query: flights -> {
  group_by: carrier
  calculate: previous_carrier is lag(carrier)
}
\`\`\`

View [the full documentation](${DOCS_ROOT}/language/calculations).
`;

const QUERY_TOP_DOC = `Use \`top\` to restrict the number of results returned.

\`\`\`malloy
run: flights -> {
  top: 10
  group_by: carrier
  aggregate: flight_count
}
\`\`\`

View [the full documentation](${DOCS_ROOT}/language/order_by#limiting).
`;

const QUERY_LIMIT_DOC = `Use \`limit\` to restrict the number of results returned.

\`\`\`malloy
run: flights -> {
  select: *
  limit: 10
}
\`\`\`

View [the full documentation](${DOCS_ROOT}/language/order_by#limiting).
`;

const QUERY_WHERE_DOC = `Use \`where\` to narrow down results.

\`\`\`malloy
run: flights -> {
  where: origin.state = 'CA'
  aggregate: flight_count
}
\`\`\`

View [the full documentation](${DOCS_ROOT}/language/filters).
`;

const QUERY_HAVING_DOC = `Use \`having\` to narrow down results based on conditions of aggregate values.

\`\`\`malloy
run: flights -> {
  group_by: carrier
  aggregate: total_distance
  having: total_distance > 1000
}
\`\`\`

View [the full documentation](${DOCS_ROOT}/language/filters).
`;

const QUERY_NEST_DOC = `Use \`nest\` to include a nested view.

\`\`\`malloy
run: flights -> {
  group_by: carrier
  nest: by_origin_state is {
    group_by: origin.state
    aggregate: flight_count
  }
}
\`\`\`

View [the full documentation](${DOCS_ROOT}/language/nesting).
`;

const SOURCE_DIMENSION_DOC = `Use \`dimension\` to define a non-aggregate calculation.

\`\`\`malloy
source: flights is duckdb.table('flights.parquet') extend {
  dimension: distance_km is distance * 1.609
}
\`\`\`

View [the full documentation](${DOCS_ROOT}/language/fields#dimensions).
`;

const SOURCE_MEASURE_DOC = `Use \`measure\` to define an aggregate calculation.

\`\`\`malloy
source: flights is duckdb.table('flights.parquet') extend {
  measure: flight_count is count()
}
\`\`\`

View [the full documentation](${DOCS_ROOT}/language/fields#measures).
`;

const SOURCE_VIEW_DOC = `Use \`view\` to define a named view which can be referenced and/or refined in queries.

\`\`\`malloy
source: flights is duckdb.table('flights.parquet') extend {
  view: by_carrier is {
    group_by: carrier,
    aggregate: flight_count
  }
}
\`\`\`

View [the full documentation](${DOCS_ROOT}/language/fields#queries).
`;

const SOURCE_JOIN_ONE_DOC = `Use \`join_one\` to define a joined explore which has one row for each row in the source table.

\`\`\`malloy
source: flights is duckdb.table('flights.parquet') extend {
  join_one: carriers with carrier
  join_one: origin is airports with origin_code
}
\`\`\`

View [the full documentation](${DOCS_ROOT}/language/join).
`;

const SOURCE_JOIN_MANY_DOC = `Use \`join_many\` to define a joined explore which has many rows for each row in the source table.

\`\`\`malloy
source: users is table('users') extend {
  join_many: orders is table('orders') on id = orders.user_id and orders.user_id != null
}
\`\`\`

View [the full documentation](${DOCS_ROOT}/language/join).
`;

const SOURCE_JOIN_CROSS_DOC = `Use \`join_cross\` to define a join via a cross product, resulting in many rows on each side of the join.

View [the full documentation](${DOCS_ROOT}/language/join).
`;

const SOURCE_WHERE_DOC = `Use \`where\` to limit the limit the rows of an explore.

\`\`\`malloy
source: long_flights is flights extend {
  where: distance > 1000
}
\`\`\`

View [the full documentation](${DOCS_ROOT}/language/filters).
`;

const SOURCE_PRIMARY_KEY_DOC = `Use \`primary_key\` to specify a primary key for joining.

\`\`\`malloy
source: flights is duckdb.table('flights.parquet') extend {
  primary_key: id2
}
\`\`\`

View [the full documentation](${DOCS_ROOT}/language/explore#primary-keys).
`;

const SOURCE_RENAME_DOC = `Use \`rename\` to rename a field from the source explore/table.

\`\`\`malloy
source: flights is duckdb.table('flights.parquet') extend {
  rename: origin_code is origin
}
\`\`\`

View [the full documentation](${DOCS_ROOT}/language/explore#renaming-fields).
`;

const SOURCE_ACCEPT_DOC = `Use \`accept\` to specify which fields to include from the source explore/table.

\`\`\`malloy
source: airports is table('malloy-data.faa.airports') extend {
  accept: [ id, name, code, city, state, elevation ]
}
\`\`\`

View [the full documentation](${DOCS_ROOT}/language/explore#limiting-access-to-fields).
`;

const SOURCE_EXCEPT_DOC = `Use \`except\` to specify which fields to exclude from the source explore/table.

\`\`\`malloy
source: airports is table('malloy-data.faa.airports') extend {
  except: [ c_ldg_rts, aero_cht, cntl_twr ]
}
\`\`\`

View [the full documentation](${DOCS_ROOT}/language/explore#limiting-access-to-fields).
`;

export const COMPLETION_DOCS: {
  [kind: string]: {[property: string]: string};
} = {
  model_property: {
    source: MODEL_SOURCE_DOC,
    query: MODEL_QUERY_DOC,
    run: MODEL_RUN_DOC,
  },
  query_property: {
    group_by: QUERY_GROUP_BY_DOC,
    order_by: QUERY_ORDER_BY_DOC,
    select: QUERY_SELECT_DOC,
    index: QUERY_INDEX_DOC,
    aggregate: QUERY_AGGREGATE_DOC,
    top: QUERY_TOP_DOC,
    limit: QUERY_LIMIT_DOC,
    where: QUERY_WHERE_DOC,
    having: QUERY_HAVING_DOC,
    nest: QUERY_NEST_DOC,
    calculate: QUERY_CALCULATE_DOC,
  },
  explore_property: {
    dimension: SOURCE_DIMENSION_DOC,
    measure: SOURCE_MEASURE_DOC,
    view: SOURCE_VIEW_DOC,
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
