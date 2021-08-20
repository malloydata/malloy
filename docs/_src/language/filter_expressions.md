# Filter Expressions

## Examples

Filter expressions in Malloy are simply boolean expressions in the Malloy
language. Here are some patterns for filters which you can use.

Example| Meaning
 --- | ---
`size = 10` | size is equal to 10
`size > 10` | size is greater than 10
`size != 10` | size is not equal to 10
`size:  10 to 100` | size is greater than or equal to 10 and less than 100
`size >= 10 and size < 100` | size is greater than or equal to 10 and less than 100
`size: >=10 & < 100` | size is greater than or equal to 10 and less than 100
`color : 'red'\|'green'\|'blue'` | color is red, green or blue
`size: 14 \| 42 \| > 100` | size is 14, 42, or greater than 100
`eventTime: @2003 to @2013` | eventTime is between the years 2003 and 2013 (excluding 2013)
`eventTime > 1591129283 + 10 hours` | eventTime greater than 10 hours after 1591129283 (epoch timestamp) 
`eventTime: now.date` | eventTime is today
`eventTime: now.month - 1` | eventTime is in the previous calendar month
`name ~ 'M%'` | first letter of name is 'M' (case sensitive)
`name !~ '%z%'` | name does not contain a 'z' (case sensitive)
`state ~ r'^(CA\|NY)$'` | regex - state is 'CA' or 'NY'
`name !~ r'Z$'` | regex - name does not end with 'Z'

## Reference
Further reading on the components of these expressions can be found
in the [Reference](../language/overview.md) section, especially

* [Languge / Expressions](../language/expressions.md)
* [Language / Time and Ranges](../language/time-ranges.md)
* [Language / Filters](../language/filters.md)
