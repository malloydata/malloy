
# Malloy Query AST

Get started with the {@link ASTQuery} class.

## Serialize itself to a Malloy Query string

{@link ASTQuery.toMalloy}

```ts
query.setSource('flights');
query.setView('by_carrier');
query.toMalloy();
```
```
run: flights -> by_carrier
```

## Provide an interface to walk the tree

This is for the Explorer, e.g., to create the query summary UI

## To the empty query, add a starting point which is either a new literal view or a view reference which can later be refined

{@link ASTQuery.getOrAddDefaultSegment}

```ts
query.setSource('flights');
query.getOrAddDefaultSegment().addGroupBy("carrier");
```
```
run: flights -> { group_by: carrier }
```

{@link ASTQuery.setViewToEmptySegment}

```ts
query.setSource('flights');
query.setViewToEmptySegment().addGroupBy("carrier");
```
```
run: flights -> { group_by: carrier }
```

{@link ASTQuery.setView}

```ts
query.setSource('flights');
query.setView('by_carrier');
```
```
run: flights -> by_carrier
```

## Determine if the query can be run

{@link ASTSegmentViewDefinition.isRunnable}

```
run: flights -> { }
```
```ts
query.isRunnable() // false
```

## Add a new field to a particular literal view

{@link ASTSegmentViewDefinition.addGroupBy}
{@link ASTSegmentViewDefinition.addAggregate}
{@link ASTSegmentViewDefinition.addNest}

```ts
const segment = query.getOrAddDefaultSegment();
segment.addGroupBy('carrier');
segment.addAggregate('flight_count');
segment.addNest('by_origin');
```
```
run: flights -> {
  group_by: carrier
  aggregate: flight_count
  nest: by_origin
}
```

## A field reference
## A time truncation of a field reference

{@link ASTSegmentViewDefinition.addDateGroupBy}
{@link ASTSegmentViewDefinition.addTimestampGroupBy}

```ts
const segment = query.getOrAddDefaultSegment();
segment.addTimestampGroupBy('dep_time', 'month');
```
```
run: flights -> {
  group_by: dep_time.month
}
```

## A measure reference with filters

## Rename/delete a field

{@link ASTGroupByViewOperation.delete}
{@link ASTAggregateViewOperation.delete}
{@link ASTNestViewOperation.delete}
{@link ASTGroupByViewOperation.rename}
{@link ASTAggregateViewOperation.rename}
{@link ASTNestViewOperation.rename}

```
run: flights -> {
  group_by: carrier
  aggregate: flight_count
}
```
```ts
groupBy.delete();
aggregate.rename("flight_count_2");
```
```
run: flights -> { aggregate: flight_count_2 is flight_count }
```

## Check if a field is present

{@link ASTSegmentViewDefinition.hasField}

```ts
query.getOrAddDefaultSegment().hasField('carrier');
```

## Add/edit/delete order by

{@link ASTOrderByViewOperation.delete}

```
run: flights -> {
  group_by: carrier
  order_by: carrier desc
}
```
```ts
orderBy.delete();
```
```
run: flights -> { group_by: carrier }
```

{@link ASTOrderByViewOperation.setField}

```
run: flights -> {
  group_by:
    carrier
    flight_count
  order_by: carrier desc
}
```
```ts
orderBy.setField("flight_count");
```
```
run: flights -> {
  group_by:
    carrier
    flight_count
  order_by: flight_count desc
}
```

{@link ASTOrderByViewOperation.setDirection}

```
run: flights -> {
  group_by: carrier
  order_by: carrier desc
}
```
```ts
orderBy.setDirection(Malloy.OrderByDirection.ASC);
```
```
run: flights -> {
  group_by: carrier
  order_by: flight_count asc
}
```

## Add/edit/delete filter

* {@link ASTSegmentViewDefinition.addWhere}
* {@link ASTFilterWithFilterString.setFilterString}
* {@link ASTFilterWithFilterString.setFilter}
* {@link ASTFilterWithFilterString.getFilter}
* {@link ASTWhereViewOperation.delete}
* {@link ASTWhere.delete}

```ts
query.getOrAddDefaultSegment().addWhere("carrier", "WN, AA");
```
```
run: flights -> { where: carrier ~ f`WN, AA` }
```

## Add/edit/delete limit

* {@link ASTSegmentViewDefinition.setLimit}
* {@link ASTLimitViewOperation.delete}

```ts
query.getOrAddDefaultSegment().setLimit(10);
```
```
run: flights -> { limit: 10 }
```

## Create new nest with name

{@link ASTSegmentViewDefinition.addEmptyNest}


```ts
query.getOrAddDefaultSegment().addEmptyNest("by_origin");
```
```
run: flights -> { nest: by_origin is { } }
```

## Reorder fields
## To a particular nesting level (literal view or view + refinements), reorder fields

## For a particular literal view, list the fields which can be added

{@link ASTSegmentViewDefinition.getInputSchema}

```ts
query.getOrAddDefaultSegment().getInputSchema();
```
```
{
  fields: [
    { kind: "measure", name: "flight_count", type: { kind: "string_type" }}
    ...
  ]
}
```

## To a particular view reference, add a new literal view as a refinement

{@link IASTViewDefinition.addEmptyRefinement}


```ts
const view = query.setView("by_carrier");
const segment = view.addEmptyRefinement();
segment.setLimit(10);
```
```
run: flights -> by_carrier + { limit: 10 }
```

## To a particular view reference, add a new view reference as a refinement

{@link IASTViewDefinition.addViewRefinement}

```ts
const view = query.setView("by_carrier");
view.addViewRefinement("top10");
```
```
run: flights -> by_carrier + top10
```

## To a particular view (literal or reference), specify the order of fields by way of adding/editing an annotation

{@link ASTQuery.reorderFields}
{@link ASTView.reorderFields}

If the view or query is a simple segment, it will automatically reorder the clauses.

```
run: flights -> {
  group_by: carrier
  aggregate: flight_count
}
```
```ts
query.reorderFields(['flight_count', 'carrier']);
```
```
run: flights -> {
  aggregate: flight_count
  group_by: carrier
}
```

Otherwise, it will add an annotation:

```
run: flights -> by_carrier
```
```ts
query.reorderFields(['flight_count', 'carrier']);
```
```
# field_order = [flight_count, carrier]
run: flights -> by_carrier
```

## To a particular aggregate field in the query, add/edit/delete filter

* {@link ASTAggregateViewOperation.addWhere}
* {@link ASTFilterWithFilterString.setFilter}
* {@link ASTWhere.delete}

```ts
query.getOrAddDefaultSegment().addAggregate('flight_count').addWhere('carrier', 'WN, AA');
```
```
run: flights -> { aggregate: flight_count { where: carrier ~ f`WN, AA`} }
```

## Specify or remove source parameter value

{@link ASTSourceReference.setParameter}

```ts
query.source.setParameter("param", 1);
```
```
run: flights(param is 1) ->
```

## List parameters of the source and whether they are required

{@link ASTSourceReference.getSourceParameters}

```ts
query.definition.asArrowQueryDefinition().source.getSourceParameters();
```

## To a particular field in the query (including nests), add/edit/delete annotation

{@link IASTAnnotatable.setTagProperty}
{@link IASTAnnotatable.removeTagProperty}

```ts
query
  .getOrAddDefaultSegment()
  .addGroupBy('carrier');
  .setTagProperty(['a', 'b', 'c'], 10);
```
```
run: flights -> {
  # a.b.c = 10
  group_by: carrier
}
```

```ts
// Assume that 'by_carrier' has, in the model, a tag "bar_chart"
query
  .getOrAddDefaultSegment()
  .addNest('by_carrier');
  .removeTagProperty(['bar_chart']);
```
```
run: flights -> {
  # -bar_chart
  nest: by_carrier
}
```

## To a particular field, ask which annotations come from the input field vs in the query itself

{@link IASTAnnotatable.getIntrinsicTag}
{@link IASTAnnotatable.getInheritedTag}

```ts
query
  .getOrAddDefaultSegment()
  .addGroupBy('carrier');
  .getIntrinsicTag()
  .has('some_tag');
query
  .getOrAddDefaultSegment()
  .addGroupBy('carrier');
  .getInheritedTag()
  .has('some_tag');
```

## To the query itself, add/edit/delete annotation

```ts
query.setTagProperty(['bar_chart']);
query.setSource('flights');
query.setView('by_carrier');
```
```
# bar_chart
run: flights -> by_carrier
```

## After any operation of a QueryBuilder, perform a partial validation of the query
This is only ever a partial validation: cube resolution, aggregate validation, and expression validation (and possibly other validation) must happen in the translator, and will not be replicated in the QueryBuilder
We will do as much validation as we can do, but it is possible some queries will only generate errors when you do a full translation (probably when you run it)
## Given a filter string and a field type, parse it into a StableFilterDef
## Given a StableFilterDef, serialize it into a filter string
## Automatically determine where in a literal view is most appropriate to place a new field

This happens automatically when you call {@link ASTSegmentViewDefinition.addGroupBy}, {@link ASTSegmentViewDefinition.addAggregate}, {@link ASTSegmentViewDefinition.addNest}, {@link ASTSegmentViewDefinition.addWhere}, {@link ASTSegmentViewDefinition.addOrderBy}, {@link ASTSegmentViewDefinition.setLimit}, etc..

## Finding the default place in the tree to put a new field

{@link ASTQuery.getOrAddDefaultSegment}

```ts
query.setSource('flights');
query.getOrAddDefaultSegment().addGroupBy("carrier");
```
```
run: flights -> { group_by: carrier }
```

```
run: flights -> by_carrier
```
```ts
query.setSource('flights');
query.getOrAddDefaultSegment().setLimit(10);
```
```
run: flights -> by_carrier + { limit: 10 }
```
