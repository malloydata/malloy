# malloy-demo-bq-cli

This is a much-simplified demonstration of one use-case of the `malloy`
library. In this demonstration, `index.ts` defines a basic CLI for
running Malloy queries agains a BigQuery connection, using the local
configuration.

# Building

To build this library, run `yarn workspace malloy-demo-bq-cli build`.

# Installation

To install this CLI onto your machine, run `yarn workspace malloy-demo-bq-cli install-local`.

# Usage

This demo supports specifying a query string directly, using the `--query` option, e.g.

```bash
malloy-demo-bq-cli --query "'examples.flights' | reduce flight_count is count()"
```

It also supports specifying a query file to run:

```bash
malloy-demo-bq-cli --query-file 'path/to/query.malloy'
```

A `--query` or `--query-file` must be provided.

Optionally, a `--model` or `--model-file` may be provided as well.

```bash
malloy-demo-bq-cli --query "flights | reduce flight_count" --model "define flights is ('examples.flights' flight_count is count());"
```

The `--query`, `--query-file`, `--model`, and `--model-file` options may be mix-and-matched, but only the last query specified will be used, and only the last model specified will be used.

```bash
malloy-demo-bq-cli --query "flights | reduce flight_count" --model-file 'path/to/model.malloy'
```
