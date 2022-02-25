
# Shape Maps

The plugin currently supports US maps and state names. The model and data styles for the subsequent examples are:

```malloy
--! {"isModel": true, "modelPath": "/inline/e.malloy"}
source: airports is table('malloy-data.faa.airports') {
  primary_key: code
  measure: airport_count is count()
  query: by_state is {
    where: state != null
    group_by: state
    aggregate: airport_count
  }
}
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
--! {"isRunnable": true, "runMode": "auto", "size": "medium", "source": "/inline/e.malloy","dataStyles":{"by_state": {"renderer": "shape_map"}}}
query: airports -> { nest: by_state }
```


## Run as a trellis
By calling the configured map as a nested subtable, a trellis is formed.


```malloy
--! {"isRunnable": true, "runMode": "auto", "size": "medium", "source": "/inline/e.malloy","dataStyles":{"by_state": {"renderer": "shape_map"}}}
query: airports -> {
  group_by: faa_region
  aggregate: airport_count
  nest: by_state
}
```

## Run as a trellis, repeated with different filters

```malloy
--! {"isRunnable": true, "runMode": "auto", "size": "large", "source": "/inline/e.malloy", "dataStyles": { "heliports": { "renderer": "shape_map" }, "seaplane_bases": { "renderer": "shape_map" } } }
query: airports -> {
  group_by: faa_region
  aggregate: airport_count
  nest:
    heliports is by_state { where: fac_type = 'HELIPORT' }
    seaplane_bases is by_state { where: fac_type = 'SEAPLANE BASE' }
}
```
