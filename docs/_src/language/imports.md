# Imports and Exports

Malloy allows for shapes to be reused between files, or for a set of shapes
to simply be split up among multiple files by using `import` and `export`.

## Exports

Before a shape definition, the `export` keyword means that the shape should
be included in the file's _public namespace_.

Consider a file <code>samples/faa/flights.malloy</code>:
```malloy
define airports is (explore 'malloy-data.faa.airports'
  primary key code
  name is concat(code, ' - ', full_name)
  airport_count is count()
);

export define flights is (explore 'malloy-data.faa.flights'
  origin is join airports on origin_code
  destination is join airports on destination_code
  ...
);
```

In this example, `flights` is exported, but `airports` is not, and therefore
only `flights` is part of the file's public namespace.

## Imports

In order to reuse or extend a shape from another file, you can include all the
exported shapes from another file using `import "path/to/some/file.malloy"`.

For example, if you wanted to create a file <code>samples/flights_by_carrier.malloy</code> with a query from the
`flights` shape, you could write:

```malloy
--! {"isRunnable": true, "runMode": "auto", "isPaginationEnabled": false, "pageSize": 100, "size": "large"}
import "faa/flights.malloy"

flights | reduce top 5 carrier, flight_count
```

Because `airports` is not exported, referencing it here would be invalid.

### Import Locations

Imported files may be specified with relative or absolute URIs.

| Import Statement | Meaning from `"file:///f1/a.malloy"` |
| ---------------- | --------|
| `import "b.malloy"` | `"file:///f1/b.malloy"` |
| `import "./c.malloy"` | `"file:///f1/c.malloy"` |
| `import "/f1/d.malloy"` | `"file:///f1/d.malloy"` |
| `import "file:///f1/e.malloy"` | `"file:///f1/e.malloy"` |
| `import "../f2/f.malloy"` | `"file:///f2/f.malloy"` |
| `import "https://example.com/g.malloy"` | `"https://example.com/g.malloy"` |