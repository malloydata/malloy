# Turtles
In malloy queries can nest in other queries.  

Examples use the following model.

```malloy
define ('malloy-data.faa.airports'
    airport_count is count(*)
);
```

Turtles are queries nested in other queries.

```malloy
--! {"isRunnable": true, "runMode": "auto", "source": "faa/airports.malloy"}

explore airports 
| reduce
  state
  airport_count
  by_facility is (reduce
    fac_type
    airport_count
  )
```


##   Turtles in Turtles

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

##   Turtles and Filters can be applied at any level, any number of Turtles

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