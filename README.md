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

It is both a **semantic modeling layer** and a **query language** that compiles to SQL - Malloy doesn't replace SQL, it adds a layer of meaning on top that runs on your existing data warehouse. Define your measures, joins, and business logic once, then compose them freely without copy-pasting SQL snippets across queries and dashboards.

**Supported backends:** BigQuery · Snowflake · DuckDB · MotherDuck · PostgreSQL · MySQL · Trino · Presto · Databricks

Malloy is built for analytics engineers, SQL teams, and developers building data apps who need measures, joins, and views to mean the same thing across every dashboard, notebook, and pipeline — especially when that data is nested.

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

## How Does Malloy Compare?

| Tool | Key difference from Malloy |
|---|---|
| **Raw SQL** | No semantic layer - measures are copy-pasted into every query; fan-out bugs are silent |
| **LookML** | Proprietary and locked to Looker; Malloy is open source and targets any SQL warehouse |
| **dbt metrics / MetricFlow** | Definition-only; you still write SQL to consume metrics — Malloy is a full query language |
| **Cube** | JavaScript/YAML configuration; Malloy is a typed, composable query language |

---

## The Malloy Language at a Glance

SQL is the right tool for ad-hoc, single-analyst exploration against one table. Where Malloy earns its keep is when a team needs the same definition of *"active user"*, *"revenue"*, or *"on-time flight"* across dozens of queries, dashboards, and pipelines. **Malloy doesn't replace SQL — it compiles to it**, adding a semantic layer *inside* the query language so joins, measures, and business rules live in one place and feed every query downstream.

A bare Malloy query reads like an outline of what you want:

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
SELECT state, COUNT(*) AS airport_count, AVG(elevation) AS avg_elevation
FROM 'airports.parquet'
GROUP BY state
ORDER BY airport_count DESC  -- Malloy orders by first aggregate automatically
```

The real payoff is pinning down measures whose definitions aren't obvious. Take "on-time arrival" — the US DOT defines it as `arr_delay < 15` *with cancelled and diverted flights excluded*. A naive `count() { where: arr_delay < 15 } / count()` silently treats cancellations as on-time. Encode the rule once, and every dashboard, report, and ad-hoc query agrees:

```malloy
source: flights is duckdb.table('flights.parquet') extend {
  measure:
    on_time_rate is
      count() { where: cancelled = 'N' and diverted = 'N' and arr_delay < 15 }
      /
      count() { where: cancelled = 'N' and diverted = 'N' }
}
```

For the full language tour — sources, joins, nested results, symmetric aggregates, and the pipe operator — see the [10-minute quickstart](https://docs.malloydata.dev/documentation/user_guides/basic.html) and [Malloy by Example](https://docs.malloydata.dev/documentation/user_guides/malloy_by_example).

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
