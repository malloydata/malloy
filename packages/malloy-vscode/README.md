# Malloy

## Query Files

If a file contains a query, you may use the "Run Malloy Query File" command (by default, ⌘+Enter) to run the query.

```malloy
define things is ('my.cool.table');

explore things | reduce type, thing_count is count()
```

## Model Files

If a file does not contain a query, then you may use the "Run" and "Edit and Run" code lenses to run turtles defined in the model.

## Data Styles

For the time being, data styles may be included with a comment like `--! styles ./path/to/styles.json` on the first line of a 
query or model file, e.g.

```malloy
--! styles ./flights_styles.json

export define flights is ('my.flights.table'
  -- ...
)
```

Currently, the following renderers are supported:
- `bar_chart`
- `dashboard`
- `date`
- `line_chart`
- `point_map`
- `scatter_chart`
- `segment_map`
- `shape_map`
- `table`
- `text`
- `list`
- `list_detail`
- `link`
- `number`
- `currency`
- `bytes`
- `boolean`

Currently no renderers support any additional options (e.g. `{ "data": { "color": "red" }, "text": { "italic": true } }`). 

Example data styles:

```json
{
  "flights_by_carrier": {
    "renderer": "bar_chart"
  },
  "flights_by_state": {
    "renderer": "shape_map"
  },
  "flights_by_month": {
    "renderer": "line_chart"
  }
}
```

## Outline View

The Outline view in the Explorer panel shows fields defined in the current file. 

## Schema View

The Schema view in the Explorer panel shows fields accessible in the current file, including those inherited from tables and joins.