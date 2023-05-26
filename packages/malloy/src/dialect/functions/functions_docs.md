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

Returns a string like `value` but with all alphabetic characters in lowercase.

#### `upper(value)`

Returns a string like `value` but with all alphabetic characters in uppercase.

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
