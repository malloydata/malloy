
# Shape Maps

The plugin currently supports US maps and state names. The model and data styles for the subsequent examples are:

```malloy
export define airports is (explore 'malloy-data.faa.airports'
  primary key code
  airport_count is count(*)
  by_state is (reduce
    state
    airport_count
  )
);
```

Data Styles
```json
{
  "by_state": {
    "renderer": "shape_map"
  }
}
```

## Run as a simple query

```malloy
--! {"isRunnable": true, "runMode": "auto", "size": "medium", "source": "faa/airports.malloy"}
explore airports
| by_state
```

## Running a named query

```malloy
--! {"isRunnable": true, "runMode": "auto", "size": "medium", "source": "faa/airports.malloy"}
explore airports
| reduce
  by_state
```

## Run as a trellis
By calling the configured map as a nested subtable, a trellis is formed.

```malloy
--! {"isRunnable": true, "runMode": "auto", "size": "large", "source": "faa/airports.malloy"}
explore airports
| reduce
  faa_region
  airport_count,
  by_state
```

## Run as a trellis, repeated with different filters

```malloy
--! {"isRunnable": true, "runMode": "auto", "size": "large", "source": "faa/airports.malloy", "dataStyles": { "heliports": { "renderer": "shape_map" }, "seaplane_bases": { "renderer": "shape_map" } } }
explore airports
| reduce
  faa_region
  airport_count,
  by_state
  heliports is by_state : [fac_type :'HELIPORT']
  seaplane_bases is by_state : [fac_type :'SEAPLANE BASE']
```