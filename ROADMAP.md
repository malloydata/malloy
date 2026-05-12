# Malloy Public Roadmap

It is a common request for "what to expect next". This roadmap file is our best effort to share with the community our thoughts about Malloy roadmap.
* This is directional, not a commitment schedule.
* Items shift as PRs land and priorities change.

**2026 goal:** Make Malloy + Publisher as capable as commercially available semantic modeling & BI tools — from warehouse connection to polished dashboard — fully open source.

Have a request or idea? [Open an issue](https://github.com/malloydata/malloy/issues/new/choose) · [Start a Discussion](https://github.com/malloydata/malloy/discussions) · [Join Slack](https://malloydata.github.io/slack)

---

## In Progress 🚧

### Language

- **The `in` operator** — membership testing: `carrier in ['UA', 'AA']` *(accepted)*
- **Persistent sources** — `#@ persist` to cache expensive intermediate results as tables *(experimental: `persistence`)*
- **Type declarations & virtual sources** — abstract source schemas bindable at runtime *(experimental: `virtual_source`)*

### Ecosystem

- **Publisher UI refresh** — new layout, navigation, modern styling with polished visualization defaults
- **Materialization via CLI** — `#@ persist` annotation + `malloy build` to persist tables with dependency ordering
- **Model Parameters** - TBD: OM to research Givens and add here. (experimental: `givens`)
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
| [Source & query parameters](https://github.com/malloydata/whatsnext/blob/main/wns/WN-0002-parameters/wn-0002.md) | Parameterized `time_filter`, `string_filter`, `numeric_filter` on sources and views |
| [Drill](https://github.com/malloydata/whatsnext/blob/main/wns/WN-0021-drill/wn-0021.md) | Structured drill-down from summary views to detail rows |
| [Modules](https://github.com/malloydata/whatsnext/blob/main/wns/WN-0010-module-support/wn-0010.md) | URL-based module imports for shared Malloy libraries |

### Database Support

Current: BigQuery · Snowflake · DuckDB · MotherDuck · PostgreSQL · MySQL · Trino · Presto · Databricks

Other databases under consideration:

| Connector | Notes |
|---|---|
| **Redshift** | Amazon Redshift / Serverless / Spectrum |
| **Oracle** | Oracle Database / Autonomous DB |
| **Native T-SQL** (SQL Server / Azure SQL) | High priority; MS Fabric requires Entra ID auth |

### Publisher & Ecosystem

| Area | Feature |
|---|---|
| **Explorer** | Dimensional index values in filter UI; field documentation display; cross-filtering between charts |
| **Publisher** | Standalone Python MCP server; `malloy-pub` CLI; Windows/Linux support |
| **Renderer** | Dark/light mode; CSS variables for embedding; chart legend consistency; `# area_chart`, `# pie_chart`, `# heatmap` |
| **Python** | Ibis-style API: `ibis.malloy.connect(...)` with `s.dimensions()`, `s.measures()` selectors |
| **Docs** | LLM-optimized documentation page; expanded `malloy-samples` |

---

## How to Influence This Roadmap

| Channel | Best for |
|---|---|
| [malloydata/whatsnext](https://github.com/malloydata/whatsnext) | Formal language change proposals (WNs) |
| [GitHub Discussions](https://github.com/malloydata/malloy/discussions) | RFCs, design conversations, questions |
| [GitHub Issues](https://github.com/malloydata/malloy/issues) | Bug reports, concrete feature requests — 👍 votes signal demand |
| [Slack `#feedback`](https://malloydata.github.io/slack) | Informal ideas and early feedback |
| [Pull requests](CONTRIBUTING.md) | New database connectors especially welcome |
