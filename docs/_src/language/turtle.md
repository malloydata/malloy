# What is a "Turtle?"

In Malloy, an object which has a name and transforms a shape is called a "turtle". The technical name for what a turtle is doing is "aggregating subgquery." This is a mouthful, so we call it a turtle. The word comes from the philosophical phrase [Turtles All The Way Down](https://en.wikipedia.org/wiki/Turtles_all_the_way_down).

A turtle utilizes a named query, which might look like this when defined in the model, or within a query:

```malloy
  airports_by_facility is (reduce
    fac_type
    airport_count
    )
```

When a named query is nested inside of another query, this forms an aggregating subquery, or "turtle."

```malloy
--! {"isRunnable": true, "runMode": "auto", "source": "faa/airports.malloy"}
  explore airports | reduce
    state
    airports_by_facility is (reduce
      fac_type
      airport_count
    )
```

This "turtle" can additionally  be used to build out other computations, for example

```malloy
  airports_in_ca is airports_by_facility [ state : 'CA' ]
```

This is an unusual word, and it may be replaced once we figure out a better word
but right now, you will see the word "turtle" from time to time, and this
is what it means.
