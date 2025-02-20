
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

{@link ASTQuery.setView}

```ts
query.setSource('flights');
query.setView('by_carrier');
```
```
run: flights -> by_carrier
```

## Add a new field to a particular literal view

{@link ASTSegmentRefinement.addGroupBy}
{@link ASTSegmentRefinement.addAggregate}
{@link ASTSegmentRefinement.addNest}

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
## A measure reference with filters

## Rename/delete a field

{@link ASTGroupByItem.delete}
{@link ASTAggregateItem.delete}
{@link ASTNestItem.delete}
{@link ASTGroupByItem.rename}
{@link ASTAggregateItem.rename}
{@link ASTNestItem.rename}

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
## Add/edit/delete order by

{@link ASTOrderByItem.delete}

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

{@link ASTOrderByItem.setField}

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

{@link ASTOrderByItem.setDirection}

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
## Add/edit/delete limit
## Create new nest with name

{@link ASTSegmentRefinement.addEmptyNest}


```ts
query.getOrAddDefaultSegment().addEmptyNest("by_origin");
```
```
run: flights -> { nest: by_origin is { } }
```

## Reorder fields
## To a particular nesting level (literal view or view + refinements), reorder fields

## For a particular literal view, list the fields which can be added

{@link ASTSegmentRefinement.getInputSchema}

```ts
query.getOrAddDefaultSegment().getInputSchema();
```
```
{
  fields: [
    { __type: "measure", name: "flight_count", type: { __type: "string_type" }}
    ...
  ]
}
```

## To a particular view reference, add a new literal view as a refinement

{@link ASTPipeStage.addEmptyRefinement}
{@link ASTSegmentRefinement.addEmptyRefinement}
{@link ASTReferenceRefinement.addEmptyRefinement}

TODO this should also be a method on the refinement itself, which inserts a refinement

```ts
query.setView("by_carrier");
const segment = query.pipeline.stages.index(0).addEmptyRefinement();
segment.setLimit(10);
```
```
run: flights -> by_carrier + { limit: 10 }
```

## To a particular view reference, add a new view reference as a refinement

{@link ASTPipeStage.addViewRefinement}
{@link ASTSegmentRefinement.addViewRefinement}
{@link ASTReferenceRefinement.addViewRefinement}

```ts
query.setView("by_carrier");
query.pipeline.stages.index(0).addViewRefinement("top10");
```
```
run: flights -> by_carrier + top10
```

## To a particular view (literal or reference), specify the order of fields by way of adding/editing an annotation
## To a particular aggregate field in the query, add/edit/delete filter
## Specify or remove source parameter value

{@link ASTSourceReference.setParameter}

```ts
query.source.setParameter("param", 1);
```
```
run: flights(param is 1) ->
```

## List parameters of the source and whether they are required
## To a particular field in the query (including nests), add/edit/delete annotation
## To a particular field, ask which annotations come from the input field vs in the query itself
## To the query itself, add/edit/delete annotation
## After any operation of a QueryBuilder, perform a partial validation of the query
This is only ever a partial validation: cube resolution, aggregate validation, and expression validation (and possibly other validation) must happen in the translator, and will not be replicated in the QueryBuilder
We will do as much validation as we can do, but it is possible some queries will only generate errors when you do a full translation (probably when you run it)
## Given a filter string and a field type, parse it into a StableFilterDef
## Given a StableFilterDef, serialize it into a filter string
## Automatically determine where in a literal view is most appropriate to place a new field


## This is the current behavior in the Explorer (dimensions, measures, and views are by default grouped together)

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
