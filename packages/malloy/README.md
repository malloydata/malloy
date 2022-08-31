# Malloy

Malloy is an experimental language for describing data relationships and transformations. It is both a semantic modeling language and a querying language that runs queries against a relational database. Malloy currently connects to BigQuery and Postgres, and natively supports DuckDB. We've built a Visual Studio Code extension to facilitate building Malloy data models, querying and transforming data, and creating simple visualizations and dashboards.

## Building applications or products in javascript with @malloydata/malloy

This package facilitates building the Malloy language - or the usage of data models or queries written in the Malloy language - into your product, data application, or website. The `@malloydata/malloy` library translates complex data operations written into the Malloy language into 1) SQL and 2) metadata. The SQL can be run against a database, and then combined with results and rendered or used in a varitey of ways.

## Show me an example!

```
import { Runtime } from "@malloy/malloy";
import { BigQueryConnection } from "@malloydata/db-bigquery";

const connection = new BigQueryConnection("bigquery");
const runtime = new Runtime(files, connection);

runtime.loadModel("source: flights is table('duckdb:data/flights.parquet')")

const runner = runtime.loadQuery("query: flights->{group_by: flight_num}")
runner.run() // <- executes query, returns JSON of results

```

Note: These APIs are still in beta and subject to change!

## What's actually going on here?

The `@malloydata/malloy` is basically a compiler that takes a few things as input - 1. Some text that defines a Malloy data model 2. Some text that defines a Malloy query and 3. Some schema information about the table(s) the query might run against. The compiler works by attempting to compile the data model, and stopping compilation when it needs to ask for things it requires to continue compilation.

In practice, much of this loop is handled by various database plugins:

- [DuckDB](https://github.com/looker-open-source/malloy/tree/main/packages/malloy-db-duckdb)
- [BigQuery](https://github.com/looker-open-source/malloy/tree/main/packages/malloy-db-bigquery)
- [Postgres](https://github.com/looker-open-source/malloy/tree/main/packages/malloy-db-postgres)

## Do you have any examples?

You can find a simple example of writing a CLI for executing Malloy queries [here](https://github.com/looker-open-source/malloy/tree/main/demo/malloy-demo-bq-cli)
