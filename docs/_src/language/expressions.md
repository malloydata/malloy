# Expressions

Expressions in Malloy are much like expressions in any other computer
language; they can have variables and operators and function calls in
the same syntax users are familiar with.

To support the task of data transformation and constructing a data model,
Malloy expressions provide the below syntax:

| Syntax | Example(s) | Section |
| ---- | ---------| ----- |
 _expr_ `:` `[` _filterList_ `]` | `count() : [state:'ca']` | [Filtered](filters.md) Sub Expression
 _expr_ `::` _type_  | `table.col::string` | Safe Type Cast
 _expr_ `to` _expr_ | `1 to 100` | Range
 _timeExpr_ `for` _nExpr_ _timeframe_ | `event.startAt for 3 hours` | [Duration Time Ranges](time-ranges.md)
 _compareOperator_ _expr_ | `> 42` | Partial Comparison
 _exprOrPartial_  `&` _exprOrPartial_ | `(>5 & <10)`, `('red' & 'blue')`  | Alternation
 _exprOrPartial_  `\|` _exprOrPartial_ | `(>5 \| <10)`, `('red' \| 'blue')`  | Alternation
_expr_ `:` _exprOrPartial_ | `weight: >100 & < 1000` | [Apply](apply.md)
_fieldName.aggregate()_ | `aircraft.aircraft_models.seats.avg()` | Asymmetric Aggregation
`pick` _expr_ `when` _exprOrPartial_ <br>...<br>`else` _expr_ _(optional_) | `pick 'small' when size < 10` <br/> `pick 'medium' when size < 20` <br/> `else 'large'` <br/> OR <br>`size:` <br> `  pick 'small' when < 10`<br>`    pick 'medium' when < 20`<br>`    else 'large'` | [Pick Expressions](pick-expressions.md)
`@`_timespec_ | `@2016`  , `@2020-01-13` , `@2020-00-01 00:00` | [Date Literals](time-ranges.md#literals)
_timeValue_._truncation_ | `eventTime.quarter` , `flightTime.year` | [Time Truncation](time-ranges.md#truncation)


<br>

# SQL functions

The intention is to be able to call from Malloy any function which
you could call from Standard SQL. This is not well implemented at
the moment. If you experience type check errors, use the `::type`
typecast to work around the errors in typing.
