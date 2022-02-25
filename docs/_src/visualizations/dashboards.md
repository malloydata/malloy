# Rendering Results

Malloy simply returns the data when running a query.  In the VS Code extension, this is rendered as an HTML table, JSON, or can show the generated SQL by  toggling in the top right of the Query Results window.

The extension additionally includes the [Vega-Lite](https://vega.github.io/vega-lite/) rendering library for charting, allowing visualization of results. This rendering library is a separate layer from Malloy's data access layer. The preferred approach to specify visualization in the extension is to use a styles file.

To set up a styles file for a Malloy model:
1. Create a new file with the `.styles.json` suffix (for example, `flights.styles.json`).
2. Specify styles
3. Reference your styles document in your `.malloy` file, by adding `--! styles ecommerce.styles.json` to the first line.

We recommend looking at the individual visualization documents in this section as well as the [sample models](/documentation/samples.html) for examples of how this looks in action.

While the above approach is preferred, the extension additionally allows the renderer to utilize naming conventions as a shortcut for visualization specification. For example:

```
query: flights_bar_chart is table('malloy-data.faa.flights') -> {
  group_by: origin
  aggregate: flight_count is count()
}
```

Will render as a Bar Chart because of the `bar_chart` suffix.

These naming convention shortcuts currently include:
* [Bar Chart](/documentation/visualizations/bar_charts.html): `_bar_chart`
* [Line Chart](/documentation/visualizations/charts_line_chart.html): `_line_chart`
* [Scatter Chart](/documentation/visualizations/scatter_charts.html): `_scatter_chart`
* [Shape Map](/documentation/visualizations/shape_maps.html): `_shape_map`
* [Segment Map](/documentation/visualizations/segment_maps.html): `_segment_map`
* Dashboard: `_dashboard`

Styles apply to standalone queries as well as when nested.

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
      aggregate:[
        airport_count
        average_elevation is avg(elevation)
      ]
    }
    nest: by_fac_type is {
      group_by: fac_type
      aggregate: airport_count
    }
  }
}
```


## Shows results as a Dashboard
The `dashboard` style can be invoked either through the styles file or the `_dashboard` suffix.

```malloy
--! {"isRunnable": true, "showAs":"html", "runMode": "auto", "size":"large", "isPaginationEnabled": true, "source": "/inline/airports_mini.malloy", "queryName": "county_dashboard"}
query: county_dashboard is airports -> by_state_and_county
```

## Example
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

## Additional Charting with Vega Lite
The `vega` renderer allows much more customization of rendering than the default visualization options provided in the Extension, using the [Vega-Lite](https://vega.github.io/vega-lite/) library. For examples of using these in Malloy, check out the `flights_custom_vis` model and styles files in the FAA [Sample Models](/documentation/samples.html) download.