<div align="center">

# Malloy

**A semantic modeling and query language built on top of SQL**

[![CI](https://github.com/malloydata/malloy/actions/workflows/run-tests.yaml/badge.svg)](https://github.com/malloydata/malloy/actions/workflows/run-tests.yaml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js >=20](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org)
[![npm](https://img.shields.io/npm/v/@malloydata/malloy)](https://www.npmjs.com/package/@malloydata/malloy)
[![npm downloads](https://img.shields.io/npm/dm/@malloydata/malloy)](https://www.npmjs.com/package/@malloydata/malloy)
[![GitHub Stars](https://img.shields.io/github/stars/malloydata/malloy?style=social)](https://github.com/malloydata/malloy/stargazers)

[Try in Browser](https://github.dev/malloydata/try-malloy/airports.malloy) · [Quickstart](https://docs.malloydata.dev/documentation/user_guides/basic.html) · [Docs](https://docs.malloydata.dev/documentation/) · [Slack](https://malloydata.github.io/slack) · [YouTube](https://www.youtube.com/channel/UCfN2td1dzf-fKmVtaDjacsg)

<img src=".github/images/malloy-logo.png" alt="Malloy" width="160"/>

</div>

---

## What is Malloy?

Malloy is an open source language for describing data relationships and transformations. It is both a semantic modeling language and a query language that uses an existing SQL engine to execute queries.

**Supported SQL engines:** BigQuery · Snowflake · DuckDB · MotherDuck · PostgreSQL · MySQL · Trino · Presto · Databricks

## Why Malloy?

Malloy is useful because it lets you describe analytics in terms of the data model, not just as one-off SQL queries. SQL is powerful, and Malloy is built to use that power, but analytical SQL often makes you work through the mechanics of the database schema: how tables connect, what to calculate, and how to shape the result. Malloy lets more of that logic live in the model, so it can be reused instead of rewritten for every query.

This gives teams a higher-level way to work with data while still running on the databases they already use. Instead of starting from tables, joins, and query mechanics, Malloy lets users start closer to the questions they want to ask about the data. The result is a more actionable query layer for analytics: easier to read, easier to share, and easier to build on than SQL alone.

<br>
<p>
  <em>“This feels like magic.”</em> -- Lloyd Tabb
</p>


---

## How Malloy Works

<picture>
  <source media="(prefers-color-scheme: dark)" srcset=".github/images/how-it-works-dark.svg">
  <img src=".github/images/how-it-works-light.svg" alt="How Malloy works: define a semantic .malloy model, compile to SQL, run natively on your warehouse. Consumed from VS Code, npm, CLI, Publisher, or Python." width="100%"/>
</picture>

---

## Quick Start

There are four ways to install Malloy:

### Install the VSCode Extension

The easiest way to try Malloy is the [VSCode Extension](https://docs.malloydata.dev/documentation/setup/extension.html#installation). You can do this locally, or [try it in the browser (no install)](https://github.dev/malloydata/try-malloy/airports.malloy), which opens a live Malloy notebook in github.dev (GitHub's in-browser VSCode; requires a GitHub sign-in).

Follow the instructions for [connecting Malloy to your database](https://docs.malloydata.dev/documentation/setup/extension.html#database-specific-setup). Supports BigQuery, Snowflake, DuckDB, MotherDuck, PostgreSQL, MySQL, Trino, Presto, or Databricks.

![Malloy VSCode Extension — write queries, explore results inline](https://user-images.githubusercontent.com/1093458/182458787-ca228186-c954-4a07-b298-f92dbf91e48d.gif)

> Note: The Malloy VSCode Extension collects a small amount of anonymous usage data. You can opt out in the extension settings. [Learn more](https://policies.google.com/technologies/cookies).

### Use the npm packages

To use Malloy in Node.js, install the compiler and a database connector. For example:

```bash
npm install @malloydata/malloy @malloydata/malloy-connections
```

Importing @malloydata/malloy-connections registers all supported database backends.

Run a query from Node.js:

```javascript
require('@malloydata/malloy-connections');

const {MalloyConfig, Runtime} = require('@malloydata/malloy');

async function main() {
  const config = new MalloyConfig({
    includeDefaultConnections: true,
  });
  const runtime = new Runtime({config});

  const result = await runtime.loadQuery(`
    source: sales is duckdb.sql("""
      SELECT * FROM (VALUES
        ('books', 20),
        ('books', 30),
        ('games', 40)
      ) AS sales(category, revenue)
    """) extend {
      measure: total_revenue is revenue.sum()
    }

    run: sales -> {
      group_by: category
      aggregate: total_revenue
    }
  `).run();

  console.table(result.data.toObject());
  await runtime.shutdown();
}

main().catch(console.error);
```

This defines `total_revenue` once in the semantic model, then uses it by name in the query. Other databases can be configured through MalloyConfig.

### Run Malloy from the command line

For scripting, pipelines, or CI, install the standalone Malloy CLI:

```bash
npm install -g malloy-cli
malloy-cli run my_query.malloy
```

It can `run` queries, `compile` to SQL, and `build` persistent tables from sources marked `#@ persist`.<br>
Connections are configured in `~/.config/malloy/malloy-config.json` (BigQuery, Snowflake, DuckDB, PostgreSQL, MySQL, Trino, Presto, Databricks; MotherDuck via DuckDB).<br>

See the [Malloy CLI docs](https://docs.malloydata.dev/documentation/malloy_cli/index) and [malloy-cli repo](https://github.com/malloydata/malloy-cli) for more details about using the CLI

### Serve models with Publisher

[Publisher](https://github.com/malloydata/publisher) is the open-source semantic model server for Malloy. It serves your `.malloy` models through REST and MCP APIs so apps, BI tools, and AI agents can query them through one interface:

```bash
npx @malloy-publisher/server --port 4000 --server_root path/to/your/models
```

Open `http://localhost:4000` to browse models, run queries, and grab MCP endpoints. See the [Publisher repo](https://github.com/malloydata/publisher) for setup, sample models, and deployment options.

---

## The Malloy Language at a Glance

SQL is the right tool for ad-hoc, single-analyst exploration against one table. Malloy is for the case where several analysts share a warehouse and the definition of "active user" (for example) has to be the same in every dashboard. Because it compiles to SQL, joins, measures, and business rules live in one place and feed every query downstream.

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

Malloy is most useful for pinning down measures whose definitions aren't obvious. Take "on-time arrival" - the US DOT defines it as `arr_delay < 15` *with cancelled and diverted flights excluded*. A naive `count() { where: arr_delay < 15 } / count()` silently treats cancellations as on-time. Encode the rule once, and every dashboard, report, and ad-hoc query agrees:

```malloy
source: flights is duckdb.table('flights.parquet') extend {
  measure:
    on_time_rate is
      count() { where: cancelled = 'N' and diverted = 'N' and arr_delay < 15 }
      /
      count() { where: cancelled = 'N' and diverted = 'N' }
}
```

These are two simple examples. The [10-minute quickstart](https://docs.malloydata.dev/documentation/user_guides/basic.html) and [Malloy by Example](https://docs.malloydata.dev/documentation/user_guides/malloy_by_example) cover additional topics like joins, nested results, symmetric aggregates, and the pipe operator.

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

## Community

- **[Slack](https://malloydata.github.io/slack)**: ask questions, share models, meet other users
- **[GitHub Issues](https://github.com/malloydata/malloy/issues)**: bug reports and feature requests
- **[YouTube](https://www.youtube.com/channel/UCfN2td1dzf-fKmVtaDjacsg)**: demos and tutorials

---

## Contributing

If you would like to contribute to Malloy, please read [`CONTRIBUTING.md`](CONTRIBUTING.md) and [`developing.md`](developing.md), and feel free to contact us on slack.

---

## Security

To report a security vulnerability, please follow our [Security Policy](SECURITY.md) rather than opening a public issue.
