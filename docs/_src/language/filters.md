# Filters

A filter can be applied to a stage in a query, or to a subexpression in a field
computation.

The syntax for a filter is

* _thingToBeFiltered_ `:` `[` _filterExpression_ ( `,` _filterExpression ... ) `]`

The comma seperated list of expressions can be thought of as being "AND"ed
together, though in reality, the expression conditions will be checked at different
parts of the query, depending on what types of computation (aggregate or not)
occurs in the expression.

## Filter Expressions

A filter expression is any legal expression which generates a boolean
result.  [Expressions](expressions.md) in Malloy are extended in
numerous ways in order to make the kinds of filtering which are
common very easy to express.

## Testing and Comparison

All normal comparison operators work ... some examples:

Example| Meaning
 --- | ---
  `size = 10` | Does size equal 10
  `size > 10` | Is size > 10
  `size != 10` | Size is not equal to 10

## Ranges and Multiple Conditions

A range of numeric or time values can be constructed
with _beginValue_ `to` _endValue_. The `~` operator will check to
see if a value is within a range.

If you want to place multiple conditions on one expression,
there are a number of ways to express them. Which is "best"
depends on which most clearly conveys the intent of the
conditions. All these mean the same thing:

Example| Meaning
 --- | ---
`size ~ 10 to 100` | size is in the range `10 to 100`
`size >= 10 and size < 100` | size is at least 10 and less than 100
`size: >=10 & < 100` | size is at least 10 and less than 100

### Partial Comparison and Alternation

In the examples above we see a new operator, `:` which works by
"filling in" the missing left hand side of the expressions on
it's right side, with the expression on the left hand side.

It can also be used to specify a list of values .. Or use
multiple values in combination with partial compairsons ...


Example| Meaning
 --- | ---
`color : 'red'\|'green'\|'blue'` | true if color is one of the primary colors
`size: 14 \| 42 \| > 100` | true if size is 14, 42, or greater than 100

## Special Time Features

Read the section on [Time and Ranges](time-ranges.md).
## Special String Features

### LIKE

For strings the `~` and `!~` operators, in most cases (see below)
mean <code>LIKE</code> and <code>NOT LIKE</code> ...

Example| Meaning
 --- | ---
`name ~ 'M%'` | first letter of name is 'M'
`name !~ '%Z%'` | name does not contain a 'Z'

### Regular Expressions

When the right hand side of a `~` or `!~` operator is a regular expression, then
Malloy generates <code>REGEXP_COMPARE</code>.

Example| Meaning
 --- | ---
`state ~ r'^(CA\|NY)$'` | true if state is 'CA' or 'NY'
`name !~ r'Z$'` | true name does not end with 'Z'

