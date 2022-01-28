
<!--

# Imports and Exports

Malloy allows for explores to be reused between files, or for a set of explores
to simply be split up among multiple files by using `import` and `export`.

## Exports

Before an explore definition, the `export` keyword means that the explore should
be included in the file's _public namespace_.

Consider a file <code>samples/faa/flights.malloy</code>:
```malloy
explore: airports is table('malloy-data.faa.airports') {
  primary_key: code
  dimension: name is concat(code, ' - ', full_name)
  measure: airport_count is count()
}

explore: flights is table('malloy-data.faa.flights') {
  join_one: origin is airports with origin_code
  join_one: destination is airports with destination_code
}
```

In this example, `flights` is exported, but `airports` is not, and therefore
only `flights` is part of the file's public namespace.
 -->

## Imports

In order to reuse or extend a explore from another file, you can include all the
exported explores from another file using `import "path/to/some/file.malloy"`.

For example, if you wanted to create a file <code>samples/flights_by_carrier.malloy</code> with a query from the
`flights` explore, you could write:

```malloy
import "faa/flights.malloy"

query: flights -> { top: 5; group_by: carrier; aggregate: flight_count }
```

<!-- Because `airports` is not exported, referencing it here would be invalid. -->

### Import Locations

Imported files may be specified with relative or absolute URLs.

| Import Statement | Meaning from `"file:///f1/a.malloy"` |
| ---------------- | --------|
| `import "b.malloy"` | `"file:///f1/b.malloy"` |
| `import "./c.malloy"` | `"file:///f1/c.malloy"` |
| `import "/f1/d.malloy"` | `"file:///f1/d.malloy"` |
| `import "file:///f1/e.malloy"` | `"file:///f1/e.malloy"` |
| `import "../f2/f.malloy"` | `"file:///f2/f.malloy"` |
| `import "https://example.com/g.malloy"` | `"https://example.com/g.malloy"` |
