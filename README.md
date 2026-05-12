<div align="center">

# Malloy

**A modern semantic modeling and query language built on top of SQL**

[![CI](https://github.com/malloydata/malloy/actions/workflows/run-tests.yaml/badge.svg)](https://github.com/malloydata/malloy/actions/workflows/run-tests.yaml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js >=20](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org)
[![npm](https://img.shields.io/npm/v/@malloydata/malloy)](https://www.npmjs.com/package/@malloydata/malloy)
[![npm downloads](https://img.shields.io/npm/dm/@malloydata/malloy)](https://www.npmjs.com/package/@malloydata/malloy)
[![GitHub Stars](https://img.shields.io/github/stars/malloydata/malloy?style=social)](https://github.com/malloydata/malloy/stargazers)

[Try in Browser](https://github.dev/malloydata/try-malloy/airports.malloy) · [Quickstart](https://docs.malloydata.dev/documentation/user_guides/basic.html) · [Docs](https://docs.malloydata.dev/documentation/) · [Slack](https://malloydata.github.io/slack) · [YouTube](https://www.youtube.com/channel/UCfN2td1dzf-fKmVtaDjacsg)

<picture>
  <source media="(prefers-color-scheme: dark)" srcset=".github/images/hero-dark.svg">
  <img src=".github/images/hero-light.svg" alt="Malloy — semantic modeling and query language for SQL" width="100%"/>
</picture>

</div>

---

## What is Malloy?

Malloy is an open source language for describing **data relationships and transformations**.

It is both a **semantic modeling layer** and a **query language** that compiles to SQL — Malloy doesn't replace SQL, it adds a layer of meaning on top that runs on your existing data warehouse. Define your measures, joins, and business logic once, then compose them freely without copy-pasting SQL snippets across queries and dashboards.

**Supported backends:** BigQuery · Snowflake · DuckDB · MotherDuck · PostgreSQL · MySQL · Trino · Presto · Databricks

---

## Who Malloy Is For

- **Analytics engineers and data teams** who want reusable measures, dimensions, joins, and views without scattering business logic across SQL files and dashboards.
- **SQL teams** who need the same metric to mean the same thing across every dashboard, notebook, and report — without relying on everyone remembering the same rules.
- **Teams working with nested data** who want first-class support for arrays, records, and nested query results instead of repeated unnesting boilerplate.
- **Developers building data applications or BI experiences** who need a semantic model, query language, and rendering-friendly result shapes in one open source stack.

---

## Why Malloy?

SQL gives you maximum flexibility — exactly what you want when one analyst is asking one-off questions. But at team scale, that same flexibility quietly turns into duplicated joins, fan-out bugs, and measures that drift across dashboards. Existing semantic layers add safety but lock you into their query model. Malloy gives you both: **the safety of a semantic data model with the full flexibility of a relational query language.**

<p>
  <em>“This feels like magic.”</em> — Lloyd Tabb
</p>


| Pain point | How Malloy solves it |
|---|---|
| Joins duplicated everywhere | Define joins once in a source, reuse across every query |
| Aggregation fans out silently | Symmetric aggregates make `count()`, `sum()`, and `avg()` fan-out safe by default |
| Measures drift across dashboards | Single source of truth — change a measure once, every query updates |
| Nested data requires boilerplate | First-class support for nested and repeated fields, no unnesting required |
| Multi-step transforms are hard to read | Pipe operator `->` chains transformations linearly, like a Unix pipeline |

---

## How Does Malloy Compare?

| Tool | Key difference from Malloy |
|---|---|
| **Raw SQL** | No semantic layer - measures are copy-pasted into every query; fan-out bugs are silent |
| **LookML** | Proprietary and locked to Looker; Malloy is open source and targets any SQL warehouse |
| **dbt metrics / MetricFlow** | Definition-only; you still write SQL to consume metrics — Malloy is a full query language |
| **Cube** | JavaScript/YAML configuration; Malloy is a typed, composable query language |

---

## Quick Start

To install Malloy - there are three independent paths — pick whichever best fits your setup:

### Install the VSCode Extension

A quick and easy way to try Malloy is to use VSCode by [installing the Malloy extension into directly from the VSCode Marketplace](https://docs.malloydata.dev/documentation/setup/extension.html#installation). You can do this locally or [Try it in the browser (no install)](https://github.dev/malloydata/try-malloy/airports.malloy) — opens a live Malloy notebook in github.dev, GitHub's in-browser VSCode. Requires a GitHub sign-in.

Follow the instructions for [connecting Malloy to your database](https://docs.malloydata.dev/documentation/setup/extension.html#database-specific-setup) — supports BigQuery, Snowflake, DuckDB, Postgres, MySQL, Trino/Presto, or MotherDuck

![Malloy VSCode Extension — write queries, explore results inline](https://user-images.githubusercontent.com/1093458/182458787-ca228186-c954-4a07-b298-f92dbf91e48d.gif)

### Use the npm packages

To use Malloy in Node.js - install the compiler and a database connector, for example:

```bash
npm install @malloydata/malloy @malloydata/db-duckdb
```

Run a query from Node.js:

```javascript
const malloy = require("@malloydata/malloy");
const duckdb = require("@malloydata/db-duckdb");

const connection = new duckdb.DuckDBConnection("duckdb");
const runtime = new malloy.SingleConnectionRuntime({ connection });

const query = runtime.loadQuery(`
  run: duckdb.sql('SELECT 1 AS one UNION ALL SELECT 2 AS one') -> {
    aggregate: total is sum(one)
  }
`);

query.run().then(result => console.log(result.data.value));
// [ { total: 3 } ]
```

### Run Malloy from the command line

For scripting, pipelines, or CI — you can install the standalone Malloy CLI:

```bash
npm install -g malloy-cli
malloy-cli run my_query.malloy
```

It can `run` queries, `compile` to SQL, and `build` persistent tables from sources marked `#@ persist`.<br>
Connections are configured in `~/.config/malloy/malloy-config.json` (DuckDB, BigQuery, Postgres, Snowflake, Trino, Presto).<br>
See the [Malloy CLI docs](https://docs.malloydata.dev/documentation/malloy_cli/index) and [malloy-cli repo](https://github.com/malloydata/malloy-cli).

See the [language docs](https://docs.malloydata.dev/documentation/) for the full SDK reference and more examples.

---

## The Malloy Language at a Glance

SQL is the right tool for a vast range of analytics — direct exploration, one-off queries, anything where the question and the data sit in front of a single analyst. **Malloy doesn't replace SQL — it compiles to it.** What Malloy adds is a *semantic layer inside the query language itself*: joins, measures, and business rules live in one place and compose, so the same definitions feed every dashboard, every query, every report.

Where it earns its keep is whenever more than one person — or more than one query — needs to agree on what *"active user"*, *"revenue"*, or *"on-time flight"* actually means. If you're a solo analyst writing ad-hoc SQL against one table, Malloy buys you less. If you're a team trying to keep dozens of dashboards and pipelines aligned on the same definitions, that's exactly the gap it fills.

The four stages below build the picture incrementally — bare query → reusable measures → encoded business rules → multi-table joins. The snippets run against two small parquet files; grab them once, then paste any example into the Malloy VSCode extension or `malloy-cli` (no warehouse account required):

```bash
curl -O https://raw.githubusercontent.com/malloydata/malloy-samples/main/data/airports.parquet
curl -O https://raw.githubusercontent.com/malloydata/malloy-samples/main/data/flights.parquet
```

### 1. A first query — Malloy compiles to SQL

A bare Malloy query reads like an outline of what you want, in the order you'd describe it out loud:

**Malloy**
```malloy
run: duckdb.table('airports.parquet') -> {
  group_by: state
  aggregate:
    airport_count is count()
    avg_elevation is elevation.avg()
}
```

**Equivalent SQL**
```sql
SELECT
  state,
  COUNT(*)         AS airport_count,
  AVG(elevation)   AS avg_elevation
FROM 'airports.parquet'
GROUP BY state
ORDER BY airport_count DESC  -- Malloy orders by first aggregate automatically
```

### 2. Define a source — write the model once, reuse everywhere

Pull the measures out of the query and into a **source**. Now `airport_count` and `avg_elevation` are defined once, and any number of queries can compose them without copy-paste:

```malloy
-- Define once
source: airports is duckdb.table('airports.parquet') extend {
  measure:
    airport_count is count()
    avg_elevation is elevation.avg()
}

-- Group by state
run: airports -> {
  group_by: state
  aggregate: airport_count, avg_elevation
}

-- Group by facility type — same measures, zero duplication
run: airports -> {
  group_by: fac_type
  aggregate: airport_count, avg_elevation
}
```

Change `avg_elevation` once and every query updates automatically.

### 3. Pin contested definitions — write the rules down once

The real payoff of a source isn't avoiding a few `count()` calls — it's pinning down measures whose definitions are *not* obvious, where different teams in an organization would otherwise compute them differently.

Take "on-time arrival rate" on the flights data. The US DOT regulatory definition is precise: a flight is on-time if `arr_delay < 15` minutes, and cancelled or diverted flights are excluded from both numerator and denominator. A naive `count() { where: arr_delay < 15 } / count()` quietly counts cancellations as on-time arrivals (they have an `arr_delay` of 0 in this dataset) — a real data-quality trap.

Encode the rule once, in the source, with a comment that explains *why*:

```malloy
source: flights is duckdb.table('flights.parquet') extend {
  -- "On-time" follows the US DOT definition: arrived within 14 minutes of
  -- schedule. Cancelled and diverted flights are excluded entirely — they
  -- had no arrival outcome to measure. Change the rule here and every
  -- dashboard in the company moves.
  measure:
    completed_flights is count() { where: cancelled = 'N' and diverted = 'N' }
    on_time_flights is count() {
      where: cancelled = 'N' and diverted = 'N' and arr_delay < 15
    }
    on_time_rate is on_time_flights / completed_flights
}

run: flights -> {
  group_by: carrier
  aggregate: on_time_rate, completed_flights
  order_by: on_time_rate desc
}
```

Now every dashboard, every report, every ad-hoc query agrees on what "on-time" means — not because everyone remembered the same rule, but because the rule lives in one place.

### 4. Compose across tables — joins live in the source

Sources can join other tables. Measures and dimensions then compose across the join, and Malloy's symmetric aggregates keep `count()`, `sum()`, and `avg()` correct even when a one-to-many join would otherwise fan rows out:

```malloy
-- Define once: flights joined to their origin airport
source: flights is duckdb.table('flights.parquet') extend {
  join_one: origin_airport is
    duckdb.table('airports.parquet') on origin = origin_airport.code

  measure:
    flight_count is count()
    avg_origin_elevation is origin_airport.elevation.avg()
}

-- Group by carrier — joined measure reused
run: flights -> {
  group_by: carrier
  aggregate: flight_count, avg_origin_elevation
}

-- Group by the joined table's column — same measures, no extra joins to write
run: flights -> {
  group_by: origin_airport.state
  aggregate: flight_count, avg_origin_elevation
}
```

The [language guide](https://docs.malloydata.dev/documentation/user_guides/basic.html) walks through this in depth, including filters, nested queries, and the pipe operator.

---

## Examples

| Example | What it shows |
|---|---|
| [Build a semantic model](https://docs.malloydata.dev/documentation/user_guides/quickstart_modeling) | Define sources, joins, dimensions, and measures once, then reuse them across queries |
| [Percent of total](https://docs.malloydata.dev/documentation/patterns/percent_of_total) | Express common analytics patterns with reusable calculations instead of window-function-heavy SQL |
| [Nested subtotals](https://docs.malloydata.dev/documentation/patterns/nested_subtotals) | Drill from high-level totals into nested detail without hand-writing rollups or self-joins |

---

## Key Features

- **Semantic model** — capture joins, measures, and dimensions once; query them everywhere
- **Composable pipelines** — chain transformations with `->` for readable multi-step analysis
- **Nested data** — query arrays and structs naturally without unnesting boilerplate
- **Symmetric aggregates** — fan-out safe `count()`, `sum()`, and `avg()` across any join path
- **Multi-dialect SQL output** — one model targets BigQuery, Snowflake, DuckDB, and more
- **VSCode integration** — schema explorer, inline results, and syntax highlighting

---

## Packages

This monorepo ships the core compiler, database connectors, and rendering utilities as separate npm packages:

| Package | Description |
|---|---|
| [`@malloydata/malloy`](https://www.npmjs.com/package/@malloydata/malloy) | Core compiler & runtime |
| [`@malloydata/db-duckdb`](https://www.npmjs.com/package/@malloydata/db-duckdb) | DuckDB connector (also supports MotherDuck and MSSQL via extensions) |
| [`@malloydata/db-bigquery`](https://www.npmjs.com/package/@malloydata/db-bigquery) | BigQuery connector |
| [`@malloydata/db-snowflake`](https://www.npmjs.com/package/@malloydata/db-snowflake) | Snowflake connector |
| [`@malloydata/db-postgres`](https://www.npmjs.com/package/@malloydata/db-postgres) | PostgreSQL connector |
| [`@malloydata/db-mysql`](https://www.npmjs.com/package/@malloydata/db-mysql) | MySQL connector |
| [`@malloydata/db-trino`](https://www.npmjs.com/package/@malloydata/db-trino) | Trino / Presto connector |
| [`@malloydata/db-databricks`](https://www.npmjs.com/package/@malloydata/db-databricks) | Databricks connector |
| [`@malloydata/render`](https://www.npmjs.com/package/@malloydata/render) | Result rendering / charting |

---

## Documentation

| Resource | Description |
|---|---|
| [Language Reference](https://docs.malloydata.dev/documentation/) | Full language guide |
| [Quickstart](https://docs.malloydata.dev/documentation/user_guides/basic.html) | 10-minute tour |
| [Malloy by Example](https://docs.malloydata.dev/documentation/user_guides/malloy_by_example) | Advanced modeling patterns and idioms |
| [Malloy CLI](https://docs.malloydata.dev/documentation/malloy_cli/index) | Command-line reference for `run`, `compile`, `build` |
| [YouTube Channel](https://www.youtube.com/channel/UCfN2td1dzf-fKmVtaDjacsg) | Video demos and walkthroughs |

---

## Roadmap

See [`ROADMAP.md`](ROADMAP.md) for the public roadmap and upcoming priorities.

Have a feature request? Open a [GitHub issue](https://github.com/malloydata/malloy/issues/new/choose) or start a conversation in [Slack](https://malloydata.github.io/slack).

---

## Community

- **[Slack](https://malloydata.github.io/slack)** — ask questions, share models, meet other users
- **[GitHub Discussions](https://github.com/malloydata/malloy/discussions)** — longer-form conversations and RFCs
- **[GitHub Issues](https://github.com/malloydata/malloy/issues)** — bug reports and feature requests
- **[YouTube](https://www.youtube.com/channel/UCfN2td1dzf-fKmVtaDjacsg)** — demos and tutorials

> Note: The Malloy VSCode Extension collects a small amount of anonymous usage data. You can opt out in the extension settings. [Learn more](https://policies.google.com/technologies/cookies).

---

## Contributing

We welcome contributions of all kinds — bug fixes, new database connectors, documentation, and examples.

1. Read [`CONTRIBUTING.md`](CONTRIBUTING.md) for licensing and DCO requirements
2. Read [`developing.md`](developing.md) to set up your local environment
3. Pick up an issue tagged [`good first issue`](https://github.com/malloydata/malloy/issues?q=is%3Aopen+is%3Aissue+label%3A%22good+first+issue%22) or propose something new in Slack

---

## Security

To report a security vulnerability, please follow our [Security Policy](SECURITY.md) rather than opening a public issue.

---

## License

Malloy is released under the [MIT License](LICENSE).
