# Rendering Results

Malloy, when running a query simply returns the data.  By default in the VSCode extension,
this data is shown as JSON.  Malloy includes a rendering library that can show this data in different ways.
The rendering library is a separate layer from Malloy's data access layer and using configuration an
convention to figure out how to show data.

The rendering engine works by mapping at the names of the fields to a renderer.
By default nested queries are rendered in tables, but, for example the field name ends in '_bar_chart' it is rendered as a bar chart instead.

This map can also be specified in a data styles file and included in the model.

## Example Model

```malloy
--! {"isModel": true, "modelPath": "/inline/airports_mini.malloy"}
source: airports is table('malloy-data.faa.airports') {
  measure: airport_count is count()
  query: by_state_and_county is {
    limit: 10
    group_by: state
    aggregate: airport_count
    nest: by_county is {
      limit: 5
      group_by: county
      aggregate:
        airport_count
        average_elevation is avg(elevation)
    }
    nest: by_fac_type is {
      group_by: fac_type
      aggregate: airport_count
    }
  }
}
```

## Results as JSON
Pressing the run button, shows the results as JSON.

```malloy
--! {"isRunnable": true, "showAs":"json", "runMode": "auto", "isPaginationEnabled": true, "source": "/inline/airports_mini.malloy"}
query: airports -> by_state_and_county
```


## Render shows results as a Table
By default, the renderer shows tabular results are rendered as tables.
```malloy
--! {"isRunnable": true, "showAs":"html", "runMode": "auto", "isPaginationEnabled": true, "source": "/inline/airports_mini.malloy"}
query: airports -> by_state_and_county
```

## Render shows results as a Dashboard
Naming the field with '_dashboard' is a quick way of telling the renderer to show the results as a dashboard.  You can also do this
by tying the field name to a renderer in the styles file.

```malloy
--! {"isRunnable": true, "showAs":"html", "runMode": "auto", "size":"large", "isPaginationEnabled": true, "source": "/inline/airports_mini.malloy", "queryName": "county_dashboard"}
query: county_dashboard is airports -> by_state_and_county
```

## Charting.
The Malloy Renderer uses [Vega](https://vega.github.io/vega-lite/) for charting.  Including some style information (that gets returned with the results) allows the renderer to
style nested queries using charts and more.

Add styles for `by_fac_type` and `by_county`

Data Style:
```json
{
  "by_fac_type": {
    "renderer": "bar_chart"
  },
  "by_county": {
    "renderer": "bar_chart"
  }
}
```

```malloy
--! {"isRunnable": true, "showAs":"html", "runMode": "auto", "size":"large", "isPaginationEnabled": true, "queryName": "county_dashboard", "source": "/inline/airports_mini.malloy", "dataStyles": {"by_fac_type": {"renderer": "bar_chart"},"by_county": {"renderer": "bar_chart"}}}
query: county_dashboard is airports -> by_state_and_county
```
