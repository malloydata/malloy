# Malloy Public Roadmap

It is a common request for "what to expect next". This roadmap file is our best effort to share with the community our thoughts about Malloy roadmap.
* This is directional, not a commitment schedule.
* Items shift as PRs land and priorities change.

**2026 goal:** Make Malloy + Publisher as capable as commercially available semantic modeling & BI tools — from warehouse connection to polished dashboard — fully open source.

Have a request or idea? [Open an issue](https://github.com/malloydata/malloy/issues/new/choose) · [Start a Discussion](https://github.com/malloydata/malloy/discussions) · [Join Slack](https://malloydata.github.io/slack)

---

## In Progress 🚧

### Language

- **Timestamp types** — first-class `TIME`, `DATETIME`, and timezone-aware timestamps *(accepted)*
- **Field properties** — structured metadata and annotations on fields *(accepted)*
- **The `in` operator** — membership testing: `carrier in ['UA', 'AA']` *(accepted)*
- **Persistent sources** — `#@ persist` to cache expensive intermediate results as tables *(experimental: `persistence`)*
- **Type declarations & virtual sources** — abstract source schemas bindable at runtime *(experimental)*

### Ecosystem

- **Publisher UI refresh** — new layout, navigation, modern styling with polished visualization defaults
- **Materialization via CLI** — `# materialize` annotation + `malloy build` to persist tables with dependency ordering
- **Interactive notebook filters** — dropdowns, date pickers, sliders in VS Code and Publisher
- **Query result cache & pagination** — handle large result sets without timeouts
- **Python DataFrame client** — robust Publisher REST client returning pandas/Polars DataFrames
- **MCP toolset** — revised core tools for model discovery, query execution, and result retrieval
- **Core chart enhancements** — reference lines, combo charts, dual Y-axes, `snake_case`→Title Case
- **Table enhancements** — pinned header, conditional formatting (heatmap coloring), interactive sort

---

## Planned 📋

### Language

Full proposal details in [malloydata/whatsnext](https://github.com/malloydata/whatsnext).

| Feature | What it enables |
|---|---|
| [Relationships](https://github.com/malloydata/whatsnext/blob/main/wns/WN-0001-relationships/wn-0001.md) | Top-level two-way join declarations between sources |
| [Source & query parameters](https://github.com/malloydata/whatsnext/blob/main/wns/WN-0002-parameters/wn-0002.md) | Parameterized `time_filter`, `string_filter`, `numeric_filter` on sources and views |
| [Arrays & records](https://github.com/malloydata/whatsnext/blob/main/wns/WN-0015-arrays-and-records/WN-0015.md) | First-class array and record type support |
| [Joins in queries](https://github.com/malloydata/whatsnext/blob/main/wns/WN-0018-joins-in-queries/wn-0018.md) | Inline join declarations inside a `run:` block |
| [Drill](https://github.com/malloydata/whatsnext/blob/main/wns/WN-0021-drill/wn-0021.md) | Structured drill-down from summary views to detail rows |
| [Modules](https://github.com/malloydata/whatsnext/blob/main/wns/WN-0010-module-support/wn-0010.md) | URL-based module imports for shared Malloy libraries |

### Database Support

Current: BigQuery · Snowflake · DuckDB · PostgreSQL · MySQL · Trino · Presto · Databricks

| Connector | Notes |
|---|---|
| **T-SQL** (SQL Server / Azure SQL) | High priority; MS Fabric requires Entra ID auth |
| **Redshift** | Amazon Redshift / Serverless / Spectrum |
| **ClickHouse** | — |
| **Oracle** | Oracle Database / Autonomous DB |
| **Arrow Flight / GizmoSQL** | Community-driven |
| Dialect hardening | Expanded native function support (e.g. DuckDB `max_by`, Trino timezone); CI infra for all dialects |

### Publisher & Ecosystem

| Area | Feature |
|---|---|
| **Explorer** | Dimensional index values in filter UI; field documentation display; cross-filtering between charts |
| **Notebooks** | PDF export; pinned filter panels; table of contents |
| **Publisher** | Standalone Python MCP server; `malloy-pub` CLI; Windows/Linux support |
| **Renderer** | Dark/light mode; CSS variables for embedding; chart legend consistency; `# area_chart`, `# pie_chart`, `# heatmap` |
| **Transformation** | `malloy test` for data quality validation; pre-aggregation definitions; dbt interop |
| **Python** | Ibis-style API: `ibis.malloy.connect(...)` with `s.dimensions()`, `s.measures()` selectors |
| **Docs** | LLM-optimized documentation page; expanded `malloy-samples` |

---

## Under Consideration 💭

Ideas with varying amounts of design work behind them. Not commitments — [the full list](https://gist.github.com/mtoy-googly-moogly/af3d937033d69e50980a428e36f0a4a3).

- **Language:** Abstract sources, progressive refinement (`source: flights += {...}`), `exists` gesture, lateral joins, correlated sub-queries, expression interpolation in strings, expanded data types (`MAP<T1,T2>`, Durations, Temporal ranges), SQL pipeline elements
- **Tooling:** IDE-aware re-written parser, full dialect-native function support, model-level embedded data sources (JSON/CSV)
- **Publisher:** Fine-grained access control (row/column-level security); Postgres-wire query API; query telemetry and cost tracking
- **Ecosystem:** R client; data lineage and field-level impact analysis; incremental materialization (append, merge, delete+insert)

---

## How to Influence This Roadmap

| Channel | Best for |
|---|---|
| [malloydata/whatsnext](https://github.com/malloydata/whatsnext) | Formal language change proposals (WNs) |
| [GitHub Discussions](https://github.com/malloydata/malloy/discussions) | RFCs, design conversations, questions |
| [GitHub Issues](https://github.com/malloydata/malloy/issues) | Bug reports, concrete feature requests — 👍 votes signal demand |
| [Slack `#feedback`](https://malloydata.github.io/slack) | Informal ideas and early feedback |
| [Pull requests](CONTRIBUTING.md) | New database connectors especially welcome |
