# Malloy's Features

### Reusable Analytical Data Model
Common calculations, table relationships and reusable queries can all be encoded in a Malloy
Data Model.  Malloy queries (equivalent of SQL's <code>SELECT</code>) run against the data model and
produce SQL.

### Filtering Data
The first step in working with data, often is isolating the data you are interested in.
Malloy introduces [simplified filtering](language/filters.md) for all types and allows these filters to be
applied.  [Time calculations](language/time-ranges.md) are powerful and understandable.

### Reusable Aggregates
In a Malloy Data Model, an aggregate computation need only be defined once (for example revenue).  Once defined, it can be used
in any query at any level of granularity or dimensionality. Malloy retains enough information in the data graph
to perform this calculation no matter how you ask for it. Reusable Aggregates help improve accuracy.

### Reusable Dimensional calculations
Dimensional (Scalar calculations) can also be introduced into the model. Dimensional calculation are useful
mapping values, bucketing results and data cleanup.

### Maintains Relationships
SQL's <code>SELECT</code> statement flattens the namespace into a wide table. Malloy retains the graph relationship
of data lets you access and correctly perform computations and any place in the graph.

### Reusable Queries
Queries can be introduced into a Malloy model and accessed by name.  One benefit is that the
queries are always accurate.  Think of a Malloy model as a data function library.
Queries can also be used to create [nested subtables](nesting.md) in other queries.

### Aggregating Subqueries
Malloy easily produces nested results.  Entire dashboards can be fetched in a single query.
Named queries of a given shape can easily be nested, visualized and reused.

### Pipelines
 Malloy can pipeline operations.  The output of one query can be the input for next.

### Metadata, Visualization and Drilling
Compiling a Malloy query returns metadata about the structure of the results. When combined with the query results, Malloy's rendering library can give a very
rich user experience, rendering dashboards, visualizations.  Through this metadata
the visualization library can rewrite queries to drill through to data detail.

# Why do we need another data language?

SQL is complete but ugly: everything is expressible, but nothing is reusable; simple ideas are complex to express; the language is verbose and lacks smart defaults. Malloy is immediately understandable by SQL users, and far easier to use and learn.

Key features and advantages:

- Query and model in the same language - everything is reusable and extensible.
- Malloy reads the schema so you don’t need to model everything. Malloy allows creation of re-usable metrics and logic, but there’s no need for boilerplate code that doesn’t add anything new.
- Pipelining: output one query into the next easily for powerful advanced analysis.
- Aggregating Subqueries let you build nested data sets to delve deeper into data quickly, and return complicated networks of data from single queries (like GraphQL).
- Queries do more: Power an entire dashboard with a single query. Nested queries are batched together, scanning the data only once.
- Indexes for unified suggest/search: Malloy automatically builds search indexes, making it easier to understand a dataset and filter values.
- Built to optimize the database: make the most of BigQuery, utilizing BI engine, caching, reading/writing nested datasets extremely fast, and more.
- Malloy models are purely about data; visualization and “styles” configurations live separately, keeping the model clean and easy to read.
- Aggregates are safe and accurate: Malloy generates distinct keys when they’re needed to ensure it never fans out your data.
- Nested tables are made approachable: you don’t have to model or flatten them; specify a query path and Malloy handles the rest.
- Compiler-based error checking: Malloy understands sql expressions so the compiler catches errors as you write, before the query is run.