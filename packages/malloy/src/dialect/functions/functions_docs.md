# Functions

This doc is a draft of the documentation for functions.

Malloy has a standard set of functions available at all times. These include scalar functions (e.g. `concat`), aggregate functions (e.g. `stddev`), and analytic (or "window") functions (e.g. `lag`).

## Scalar Functions

### String Functions

#### `concat(...values)`

Concatenates multiple values together, casting non-`string` values to `string`. The exact behavior of string casting may depend on the dialect.

If no values are given, `concat` returns the empty string.

<!-- `concat('foo', 'bar') = 'foobar'`

`concat(1, null) = null` -->

#### `lower(value)`

Returns the a string like `value` but with all alphabetic characters in lowercase.

#### `upper(value)`

Returns the a string like `value` but with all alphabetic characters in uppercase.

#### `strpos(test_string, search_string)`

Returns the 1-based position of the first occurrence of `search_string` in `test_string`, or `0` if `search_string` is not found.

#### `starts_with(value, prefix)`

Returns `true` if `value` begins with `prefix` and `false` otherwise.

#### `ends_with(value, suffix)`

Returns `true` if `value` ends with `prefix` and `false` otherwise.

#### `trim(value, trim_characters?)`

Returns a string with leading and trailing characters in `trim_characters` (or whitespace, if `trim_characters` is unspecified) removed.

#### `ltrim(value, trim_characters)`

Like `trim(value, trim_characters)` but only removes leading characters.

#### `rtrim`

Like `trim(value, trim_characters)` but only removes trailing characters.

#### `substr(value, position, length?)`




`regexp_extract`
`replace`
`length`
`byte_length`
`chr`
`ascii`
`unicode`
`format`
`repeat`
`reverse`
`to_hex`


### Numeric Functions

`round`
`trunc`
`floor`
`ceil`

`cos`
`cosh`
`acos`
`acosh`
`sin`
`sinh`
`asin`
`asinh`
`tan`
`tanh`
`atan`
`atanh`
`atan2`
`sqrt`
`pow`
`abs`
`sign`
`is_inf`
`is_nan`
`div`
`rand`
`pi`

### Other Functions

`greatest`
`least`

`num_nulls`
`num_nonnulls`
`ifnull`
`nullif`


## Aggregate Functions

`stddev`
`first`

## Analytics Functions

`row_number`
`lag`
`rank`
`first_value`


### Notes from Carlin

Can analytics just be in an `aggregate:` block?

- Aggregate over a window:

```
query: foo is -> {
  group_by: date
  aggregate: rolling_avg is avg(earnings) {
    limit: 10
  }
}
```

- Specified window
```
query: foo is -> {
  // I don't really know what this means.... need to figure that out
  aggregate: a is lag(state) {
    order_by: foo
    group_by: bar
  }
}
```

- Can we just say when resolving a field "this is available in the output space and in the input space"
  - Not really, because the input and output interpretation of the same name could be a different type, as in

  ```
  query: foo is -> {
    group_by: state is 1 // normally string
    aggregate: a is lag(state)
  }
  ```
  - Maybe we could just say: you can't shadow fields in the source inside of a query... `state is 1` is illegal. If we did that, then you'd never get a different type for looking up a field in the input vs. output space, which would mean the chosen overload would never be wrong.

- Can window functions return whether they are "scalar_analytic" or "aggregate_analytic"?


Syntax for Carlin:

Normal syntax where the window function is partitioned over the same `group_by` as the query, and with the same `order_by`

```
query: airports -> {
    group_by: state
    calculate: prev_state is lag(state)
}
```

Imagined syntax for a rolling average (not sure if "limit" is confuisng here / whether it's obvious that the limit is over rows of the query, and not rows within the group).
```
query: revenue_by_day -> {
    group_by: day
    aggregate: rolling_revenue is avg(revenue) {
        limit: 30
    }
}
```

Imagined syntax for specifying partition or ordering for a particular window function:
within the group).
```
query: stuff -> {
    group_by: day
    calculate: some_thing is some_window_fn(thing) {
        group_by: foo
        order_by: bar
    }
}
```
