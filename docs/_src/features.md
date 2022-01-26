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
