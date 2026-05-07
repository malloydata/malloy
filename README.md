<div align="center">

# Malloy

**A modern semantic modeling and query language built on top of SQL**

[![CI](https://github.com/malloydata/malloy/actions/workflows/run-tests.yaml/badge.svg)](https://github.com/malloydata/malloy/actions/workflows/run-tests.yaml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js >=20](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org)
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

It is both a **semantic modeling layer** and a **query language** that compiles down to SQL and runs on your existing data warehouse. Think of it as "SQL with a type system for your data" — define your metrics, joins, and business logic once, then compose them freely without copy-pasting SQL snippets.

**Supported backends:** BigQuery · Snowflake · DuckDB · PostgreSQL · MySQL · Trino · Presto · Databricks

---

## Why Malloy?

| Pain point in SQL | How Malloy solves it |
|---|---|
| Joins duplicated everywhere | Define joins once in a source, reuse everywhere |
| Aggregation fans out unexpectedly | Symmetric aggregate functions eliminate fan-out bugs |
| Metrics drift across dashboards | Single source of truth for every measure |
| Nested data is awkward | First-class support for nested/repeated fields |
| Pipelines are hard to read | Pipe operator `->` makes multi-step transforms linear |

---

## Quick Start

### 1. Install the VS Code Extension

The fastest path to Malloy — install directly from the VS Code Marketplace:

- **[I already have VS Code →](https://docs.malloydata.dev/documentation/setup/extension.html#using-the-malloy-extension-on-your-desktop)**
- **[I use BigQuery / Google Cloud →](https://docs.malloydata.dev/documentation/setup/extension.html#using-the-malloy-extension-on-google-cloud-shell-editor)**
- **[I want to try it on a `.csv` / `.parquet` in a GitHub repo →](https://docs.malloydata.dev/documentation/setup/extension.html#using-the-malloy-extension-on-github-dev)**

![Malloy VS Code Extension — write queries, explore results inline](https://user-images.githubusercontent.com/1093458/182458787-ca228186-c954-4a07-b298-f92dbf91e48d.gif)

### 2. Try in your browser (no install)

**[Click here to open a live Malloy notebook in github.dev →](https://github.dev/malloydata/try-malloy/airports.malloy)**

### 3. Use the npm packages

```bash
npm install @malloydata/malloy @malloydata/db-duckdb
```

---

## Language at a Glance

Malloy compiles to SQL. Here is what a query looks like side by side:

**Malloy**
```malloy
run: bigquery.table('malloydata-org.faa.flights') -> {
  where: origin = 'SFO'
  group_by: carrier
  aggregate:
    flight_count is count()
    average_flight_time is flight_time.avg()
}
```

**Equivalent SQL**
```sql
SELECT
  carrier,
  COUNT(*)           AS flight_count,
  AVG(flight_time)   AS average_flight_time
FROM `malloydata-org.faa.flights`
WHERE origin = 'SFO'
GROUP BY carrier
ORDER BY flight_count DESC  -- Malloy orders by first aggregate automatically
```

Malloy's power shows when you **reuse a model** — defining joins, measures, and dimensions once, then composing them freely across many queries. The [language guide](https://docs.malloydata.dev/documentation/user_guides/basic.html) walks through this in depth.

---

## Key Features

- **Semantic model** — capture joins, measures, and dimensions once; query them everywhere
- **Composable pipelines** — chain transformations with `->` for readable multi-step analysis
- **Nested data** — query arrays and structs naturally without unnesting boilerplate
- **Symmetric aggregates** — fan-out safe `count()`, `sum()`, and `avg()` across any join path
- **Multi-dialect SQL output** — one model targets BigQuery, Snowflake, DuckDB, and more
- **VS Code integration** — schema explorer, inline results, and syntax highlighting

---

## Packages

This monorepo ships the core compiler, database connectors, and rendering utilities as separate npm packages:

| Package | Description |
|---|---|
| [`@malloydata/malloy`](https://www.npmjs.com/package/@malloydata/malloy) | Core compiler & runtime |
| [`@malloydata/db-duckdb`](https://www.npmjs.com/package/@malloydata/db-duckdb) | DuckDB connector |
| [`@malloydata/db-bigquery`](https://www.npmjs.com/package/@malloydata/db-bigquery) | BigQuery connector |
| [`@malloydata/db-snowflake`](https://www.npmjs.com/package/@malloydata/db-snowflake) | Snowflake connector |
| [`@malloydata/db-postgres`](https://www.npmjs.com/package/@malloydata/db-postgres) | PostgreSQL connector |
| [`@malloydata/render`](https://www.npmjs.com/package/@malloydata/render) | Result rendering / charting |

---

## Documentation

| Resource | Description |
|---|---|
| [Language Reference](https://docs.malloydata.dev/documentation/) | Full language guide |
| [Quickstart](https://docs.malloydata.dev/documentation/user_guides/basic.html) | 10-minute tour |
| [eCommerce Example](https://docs.malloydata.dev/documentation/examples/ecommerce.html) | End-to-end walkthrough on a real dataset |
| [Iowa Modeling Walkthrough](https://docs.malloydata.dev/documentation/examples/iowa/iowa.html) | Semantic modeling from scratch |
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

> Note: The Malloy VS Code Extension collects a small amount of anonymous usage data. You can opt out in the extension settings. [Learn more](https://policies.google.com/technologies/cookies).

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
