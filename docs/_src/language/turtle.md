# What is a "Turtle?"

Turtles are queries nested in other queries. The technical name for what a turtle is doing is "aggregating subgquery--in Malloy, it is an object which has a name, and transforms a shape. "Aggregating subquery" is a bit of a mouthful, so we call it a turtle. The word comes from the philosophical phrase [Turtles All The Way Down](https://en.wikipedia.org/wiki/Turtles_all_the_way_down).

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
  airport_count
  by_facility is (reduce
    fac_type
    airport_count
  )
```

This "turtle" can additionally  be used to build out other computations, for example

```malloy
  airports_in_ca is airports_by_facility [ state : 'CA' ]
```

This is an unusual word, and it may be replaced once we figure out a better word but right now, you will see the word "turtle" from time to time, and this is what it means.

## Turtles in Turtles
Turtles can be nested infinitely

```malloy
--! {"isRunnable": true, "runMode": "auto", "source": "faa/airports.malloy", "size": "large"}
explore airports
| reduce
  state
  airport_count
  top_5_counties is (reduce top 5
    county
    airport_count
    by_facility is (reduce
      fac_type
      airport_count
    )
  )
```

## Filters in Turtles
Filters can be applied at any level within turtles.

```malloy
--! {"isRunnable": true, "runMode": "auto", "source": "faa/airports.malloy", "size": "large"}
explore airports
| reduce : [state : 'CA'|'NY'|'MN']
  state
  airport_count
  top_5_counties is (reduce top 5
    county
    airport_count
    major_facilities is (reduce : [major:'Y']
      name is concat(code, ' - ', full_name)
    )
    by_facility is (reduce
      fac_type
      airport_count
    )
  )
```