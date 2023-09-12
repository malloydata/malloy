# Malloy Syntax Highlighting

Malloy is an experimental language for describing data relationships and transformations. It is both a semantic modeling language and a querying language that runs queries against a relational database. Malloy currently supports BigQuery and Postgres, as well as querying Parquet and CSV files via DuckDB.

Currently, two other dialects of Malloy are supported in addition to the standard syntax used in `.malloy` files: the Malloy notebook format (`.malloynb`) and Malloy SQL (`.malloysql`). The purpose of this `npm` package is to mitigate syncing issues across `@malloydata` repositories that depend upon syntax highlight files and to make these assets more easily available for future integrations.

This `npm` package does not include the source files used to develop these syntax highlighting files. If you are interested in using the existing infrastructure to modify, test, or generate these grammar files, please refer to the [malloy monorepo](https://github.com/malloydata/malloy/tree/main/packages/malloy-syntax-highlight) and see `DEVELOPING.md` for steps to do so.