# Nested Patterns

Malloy can express many of the same concepts as SQL in the very same way.  `group_by:`
and `aggregate:` work pretty much the same way they do in SQL.  In malloy you can
declare a `query: foo is` and later make another query based on the result using `query: from(-> foo)`
in much the same way you can use `WITH` in SQL.

But Malloy presents something very new, `nest:` and pipelining `->` and *symmetric aggregates*.

*Nesting* resuts (using `nest:`) allows result sets to be built at named multiple levels of
aggregation simultaniously.

*Pipelining* (using the `->` operation) allows you to take the output of one stage of a query
and directly feed it into another.

*Symmetric Aggregates* guarentees that any calculation at any level of aggregate computes
correctly regardless of join pattern.

These three features together produce patterns not available anywhere else in data analysis.

## Example

query: table('malloy-data.malloytest.flights') ->{
  where: [
    dep_time = @2002-02-02 07:00 for 1 hour,
    origin: 'SJC'
  ]
  project: [
    dep_time
    carrier
    destination
    dep_delay
    distance
  ]
}
