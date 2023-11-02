# Malloy Syntax Highlighting

Malloy is an experimental language for describing data relationships and transformations. It is both a semantic modeling language and a querying language that runs queries against a relational database. Malloy currently supports BigQuery and Postgres, as well as querying Parquet and CSV files via DuckDB.

Currently, two other dialects of Malloy are supported in addition to the standard syntax used in `.malloy` files: the Malloy notebook format (`.malloynb`) and Malloy SQL (`.malloysql`). Ensuring the visual and semantic accuracy of the syntax highlighting provided by each dialects' TextMate grammars was previously done through manual verification alone and often caused syncing issues between Malloy packages that each maintained their own copy of these grammars.

Thus, this package can be pulled into only the Malloy repos that need it and includes a test runner to verify the semantic and visual accuracy of syntax highlighting provided by our TextMate grammars. Additionally, the need to maintain a Monarch grammar for Malloy has necessitated the inclusion of both a script to generate Monarch grammars from ground truth TextMate grammars as well as infrastructure to test all Monarch grammars for parity with their TextMate counterparts.

Please refer to `DEVELOPING.md` for more information on using the tools introduced in this package.
