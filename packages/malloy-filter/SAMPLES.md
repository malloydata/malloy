# Parsers

Each filter type is handled by a different parser (strings, numbers, dates and times, etc).
Sample outputs from each parser follow...

-------------------------------------------------------------------------
## Numbers

```code
Input:  5
Output:  { operator: '=', values: [ 5 ] }

Input:  !=5
Output:  { operator: '!=', values: [ 5 ] }

Input:  1, 3, 5, null
Output:  { operator: '=', values: [ 1, 3, 5 ] } { operator: 'null' }

Input:  1, 3, , 5,
Output:  { operator: '=', values: [ 1, 3, 5 ] }
Logs:    {
  severity: 'warn',
  message: 'Empty clause',
  startIndex: 6,
  endIndex: 7
}

Input:  <1, >=100
Output:  { operator: '<', values: [ 1 ] } { operator: '>=', values: [ 100 ] }

Input:  >=1
Output:  { operator: '>=', values: [ 1 ] }

Input:   <= 10
Output:  { operator: '<=', values: [ 10 ] }

Input:  NULL
Output:  { operator: 'null' }

Input:   -NULL
Output:  { operator: 'not_null' }

Input:  (1, 7)
Output:  {
  operator: 'range',
  startOperator: '>',
  startValue: 1,
  endOperator: '<',
  endValue: 7
}

Input:  [-5, 90]
Output:  {
  operator: 'range',
  startOperator: '>=',
  startValue: -5,
  endOperator: '<=',
  endValue: 90
}

Input:   != ( 12, 20 ]
Output:  {
  operator: 'range',
  startOperator: '<=',
  startValue: 12,
  endOperator: '>',
  endValue: 20
}

Input:  [.12e-20, 20.0e3)
Output:  {
  operator: 'range',
  startOperator: '>=',
  startValue: 1.2e-21,
  endOperator: '<',
  endValue: 20000
}

Input:  [0,9],[20,29]
Output:  {
  operator: 'range',
  startOperator: '>=',
  startValue: 0,
  endOperator: '<=',
  endValue: 9
} {
  operator: 'range',
  startOperator: '>=',
  startValue: 20,
  endOperator: '<=',
  endValue: 29
}

Input:  [0,10], 20, NULL, ( 72, 82 ]
Output:  {
  operator: 'range',
  startOperator: '>=',
  startValue: 0,
  endOperator: '<=',
  endValue: 10
} { operator: '=', values: [ 20 ] } { operator: 'null' } {
  operator: 'range',
  startOperator: '>',
  startValue: 72,
  endOperator: '<=',
  endValue: 82
}

Input:  , notanumber,, "null", apple pear orange, nulle, nnull, >=,
Logs:    {
  severity: 'error',
  message: 'Invalid expression: notanumber',
  startIndex: 2,
  endIndex: 12
} {
  severity: 'warn',
  message: 'Empty clause',
  startIndex: 13,
  endIndex: 14
} {
  severity: 'error',
  message: 'Invalid expression: "null"',
  startIndex: 15,
  endIndex: 21
} {
  severity: 'error',
  message: 'Invalid expression: apple',
  startIndex: 23,
  endIndex: 28
} {
  severity: 'error',
  message: 'Invalid expression: pear',
  startIndex: 29,
  endIndex: 33
} {
  severity: 'error',
  message: 'Invalid expression: orange',
  startIndex: 34,
  endIndex: 40
} {
  severity: 'error',
  message: 'Invalid expression: nulle',
  startIndex: 42,
  endIndex: 47
} {
  severity: 'error',
  message: 'Invalid expression: nnull',
  startIndex: 49,
  endIndex: 54
} {
  severity: 'error',
  message: 'Invalid expression: >=',
  startIndex: 56,
  endIndex: 58
}

Input:  [cat, 100], <cat
Logs:    {
  severity: 'error',
  message: 'Invalid number',
  startIndex: 1,
  endIndex: 4
} {
  severity: 'error',
  message: 'Invalid expression: <',
  startIndex: 12,
  endIndex: 13
} {
  severity: 'error',
  message: 'Invalid expression: cat',
  startIndex: 13,
  endIndex: 16
}

Input:  -5.5 to 10
Output:  { operator: '=', values: [ -5.5, 10 ] }
Logs:    {
  severity: 'error',
  message: 'Invalid expression: to',
  startIndex: 5,
  endIndex: 7
}
```

-------------------------------------------------------------------------
## Strings

```code
Input:  CAT, DOG,mouse
Output:  { operator: '=', values: [ 'CAT', 'DOG', 'mouse' ] }

Input:  -CAT,-DOG , -mouse
Output:  { operator: '!=', values: [ 'CAT', 'DOG', 'mouse' ] }

Input:   CAT,-"DOG",m o u s e
Output:  { operator: '=', values: [ 'CAT' ] } { operator: '!=', values: [ '"DOG"' ] } { operator: '=', values: [ 'm o u s e' ] }

Input:  -CAT,-DOG,mouse, bird, zebra, -horse, -goat
Output:  { operator: '!=', values: [ 'CAT', 'DOG' ] } { operator: '=', values: [ 'mouse', 'bird', 'zebra' ] } { operator: '!=', values: [ 'horse', 'goat' ] }

Input:  Missing ,NULL
Output:  { operator: '=', values: [ 'Missing' ] } { operator: 'null' }

Input:  CAT%, D%OG, %ous%, %ira_f%, %_oat,
Output:  { operator: 'starts', values: [ 'CAT' ] } { operator: '~', escaped_values: [ 'D%OG' ] } { operator: 'contains', values: [ 'ous' ] } { operator: '~', escaped_values: [ '%ira_f%', '%_oat' ] }
Logs:    {
  severity: 'warn',
  message: 'Empty clause',
  startIndex: 34,
  endIndex: 35
}

Input:  -CAT%,-D%OG,-%mouse,-%zebra%
Output:  { operator: 'not_starts', values: [ 'CAT' ] } { operator: '!~', escaped_values: [ 'D%OG' ] } { operator: 'not_ends', values: [ 'mouse' ] } { operator: 'not_contains', values: [ 'zebra' ] }

Input:  CAT%,-CATALOG
Output:  { operator: 'starts', values: [ 'CAT' ] } { operator: '!=', values: [ 'CATALOG' ] }

Input:  %,_,%%,%a%
Output:  { operator: '~', escaped_values: [ '%', '_', '%%' ] } { operator: 'contains', values: [ 'a' ] }

Input:  %\_X
Output:  { operator: 'ends', values: [ '_X' ] }

Input:  _\_X
Output:  { operator: '~', escaped_values: [ '_\\_X' ] }

Input:  _CAT,D_G,mouse_
Output:  { operator: '~', escaped_values: [ '_CAT', 'D_G', 'mouse_' ] }

Input:  \_CAT,D\%G,\mouse
Output:  { operator: '=', values: [ '_CAT', 'D%G', 'mouse' ] }

Input:  CAT,-NULL
Output:  { operator: '=', values: [ 'CAT' ] } { operator: 'not_null' }

Input:  CAT,-"NULL"
Output:  { operator: '=', values: [ 'CAT' ] } { operator: '!=', values: [ '"NULL"' ] }

Input:  CAT,NULL
Output:  { operator: '=', values: [ 'CAT' ] } { operator: 'null' }

Input:  CAT,,
Output:  { operator: '=', values: [ 'CAT' ] }
Logs:    {
  severity: 'warn',
  message: 'Empty clause',
  startIndex: 4,
  endIndex: 5
}

Input:  CAT, , DOG
Output:  { operator: '=', values: [ 'CAT', 'DOG' ] }
Logs:    {
  severity: 'warn',
  message: 'Empty clause',
  startIndex: 4,
  endIndex: 5
}

Input:  EMPTY
Output:  { operator: 'empty' }

Input:  -EMPTY
Output:  { operator: 'not_empty' }

Input:  CAT,-EMPTY
Output:  { operator: '=', values: [ 'CAT' ] } { operator: 'not_empty' }

Input:  "CAT,DOG',mo`use,zeb'''ra,g"""t,g\"ir\`af\'e
Output:  {
  operator: '=',
  values: [ '"CAT', "DOG'", 'mo`use', "zeb'''ra", 'g"""t', 'g"ir`af\'e' ]
}

Input:  CAT\,DOG
Output:  { operator: '=', values: [ 'CAT,DOG' ] }

Input:  CAT,DOG,-, -
Output:  { operator: '=', values: [ 'CAT', 'DOG', '-', '-' ] }

Input:  --CAT,DOG,\
Output:  { operator: '!=', values: [ '-CAT' ] } { operator: '=', values: [ 'DOG' ] }
Logs:    {
  severity: 'warn',
  message: 'Empty clause',
  startIndex: 10,
  endIndex: 11
}

Input:  CAT\ DOG
Output:  { operator: '=', values: [ 'CAT DOG' ] }

Input:  _\_CAT
Output:  { operator: '~', escaped_values: [ '_\\_CAT' ] }

Input:  \NULL
Output:  { operator: '=', values: [ 'NULL' ] }

Input:  \-NULL
Output:  { operator: '=', values: [ '-NULL' ] }

Input:  -N\ULL
Output:  { operator: '!=', values: [ 'NULL' ] }

Input:  CA--,D-G
Output:  { operator: '=', values: [ 'CA--', 'D-G' ] }

Input:   hello world, foo="bar baz" , qux=quux
Output:  {
  operator: '=',
  values: [ 'hello world', 'foo="bar baz"', 'qux=quux' ]
}

Input:  one ,Null ,  Empty,E M P T Y Y,EEmpty,        emptIEs
Output:  { operator: '=', values: [ 'one' ] } { operator: 'null' } { operator: 'empty' } { operator: '=', values: [ 'E M P T Y Y', 'EEmpty', 'emptIEs' ] }

Input:

```

-------------------------------------------------------------------------
## Booleans

```code
Input:  true
Output:  { operator: 'true' }

Input:  FALSE
Output:  { operator: 'false_or_null' }

Input:  =false
Output:  { operator: 'false' }

Input:  null
Output:  { operator: 'null' }

Input:  -NULL
Output:  { operator: 'not_null' }

Input:  null,
Output:  { operator: 'null' }

Input:   True , , faLSE,=false,NULl,-null
Output:  { operator: 'true' } { operator: 'false_or_null' } { operator: 'false' } { operator: 'null' } { operator: 'not_null' }
Logs:    {
  severity: 'warn',
  message: 'Empty clause',
  startIndex: 8,
  endIndex: 9
}

Input:  -'null'
Logs:    {
  severity: 'error',
  message: "Invalid token -'null'",
  startIndex: 0,
  endIndex: 7
}

Input:  10
Logs:    {
  severity: 'error',
  message: 'Invalid token 10',
  startIndex: 0,
  endIndex: 2
}

Input:  nnull
Logs:    {
  severity: 'error',
  message: 'Invalid token nnull',
  startIndex: 0,
  endIndex: 5
}

Input:   truee
Logs:    {
  severity: 'error',
  message: 'Invalid token truee',
  startIndex: 1,
  endIndex: 6
}
```

-------------------------------------------------------------------------
## Dates and Times

```code
Input:  this month
Output:  {
  operator: 'on',
  moment: { type: 'interval', kind: 'this', unit: 'month' }
}

Input:  3 days
Output:  { operator: 'duration', duration: { amount: 3, unit: 'days' } }

Input:  3 days ago
Output:  {
  operator: 'on',
  moment: {
    type: 'offset_from_now',
    direction: 'ago',
    amount: 3,
    unit: 'days'
  }
}

Input:  3 months ago for 2 days
Output:  {
  operator: 'for_range',
  from: {
    type: 'offset_from_now',
    direction: 'ago',
    amount: 3,
    unit: 'months'
  },
  duration: { amount: 2, unit: 'days' }
}

Input:  2025 weeks ago
Output:  {
  operator: 'on',
  moment: {
    type: 'offset_from_now',
    direction: 'ago',
    amount: 2025,
    unit: 'weeks'
  }
}

Input:  before 3 days ago
Output:  {
  operator: 'before',
  moment: {
    type: 'offset_from_now',
    direction: 'ago',
    amount: 3,
    unit: 'days'
  }
}

Input:  before 2025-08-30 08:30:20
Output:  {
  operator: 'before',
  moment: { type: 'absolute', date: '2025-08-30 08:30:20', unit: 'second' }
}

Input:  after 2025-10-05
Output:  {
  operator: 'after',
  moment: { type: 'absolute', date: '2025-10-05', unit: 'day' }
}

Input:  2025-08-30 12:00 to 2025-09-18 14:30
Output:  {
  operator: 'to_range',
  from: { type: 'absolute', date: '2025-08-30 12:00', unit: 'minute' },
  to: { type: 'absolute', date: '2025-09-18 14:30', unit: 'minute' }
}

Input:  this year
Output:  {
  operator: 'on',
  moment: { type: 'interval', kind: 'this', unit: 'year' }
}

Input:  next tuesday
Output:  {
  operator: 'on',
  moment: { type: 'interval', kind: 'next', unit: 'tuesday' }
}

Input:  7 years from now
Output:  {
  operator: 'on',
  moment: {
    type: 'offset_from_now',
    direction: 'from_now',
    amount: 7,
    unit: 'years'
  }
}

Input:  2025-01-01 12:00:00 for 3 days
Output:  {
  operator: 'for_range',
  from: { type: 'absolute', date: '2025-01-01 12:00:00', unit: 'second' },
  duration: { amount: 3, unit: 'days' }
}

Input:  2020-08-12 03:12:56.57
Output:  {
  operator: 'on',
  moment: { type: 'absolute', date: '2020-08-12 03:12:56.57', unit: 'instant' }
}

Input:  2020-08-12T03:12:56[PST]
Output:  {
  operator: 'on',
  moment: {
    type: 'absolute',
    date: '2020-08-12T03:12:56[PST]',
    unit: 'instant'
  }
}

Input:  2020-08-12 03:12:56
Output:  {
  operator: 'on',
  moment: { type: 'absolute', date: '2020-08-12 03:12:56', unit: 'second' }
}

Input:  2020-08-12 03:22
Output:  {
  operator: 'on',
  moment: { type: 'absolute', date: '2020-08-12 03:22', unit: 'minute' }
}

Input:  2020-08-12 03
Output:  {
  operator: 'on',
  moment: { type: 'absolute', date: '2020-08-12 03', unit: 'hour' }
}

Input:  2020-08-12
Output:  {
  operator: 'on',
  moment: { type: 'absolute', date: '2020-08-12', unit: 'day' }
}

Input:  2020-Q3
Output:  {
  operator: 'on',
  moment: { type: 'absolute', date: '2020-Q3', unit: 'quarter' }
}

Input:  2020-08-07-wK
Logs:    {
  severity: 'error',
  message: 'Invalid token 2020-08-07-wk',
  startIndex: 0,
  endIndex: 13
}

Input:  2020-08
Output:  {
  operator: 'on',
  moment: { type: 'absolute', date: '2020-08', unit: 'month' }
}

Input:  today
Output:  { operator: 'on', moment: { type: 'named', name: 'today' } }

Input:  yesterday
Output:  { operator: 'on', moment: { type: 'named', name: 'yesterday' } }

Input:  tomorrow
Output:  { operator: 'on', moment: { type: 'named', name: 'tomorrow' } }

Input:  TODay,Yesterday, TOMORROW , ,TODay ,,
Output:  { operator: 'on', moment: { type: 'named', name: 'today' } } { operator: 'on', moment: { type: 'named', name: 'yesterday' } } { operator: 'on', moment: { type: 'named', name: 'tomorrow' } } { operator: 'on', moment: { type: 'named', name: 'today' } }
Logs:    {
  severity: 'warn',
  message: 'Empty clause',
  startIndex: 28,
  endIndex: 29
} {
  severity: 'warn',
  message: 'Empty clause',
  startIndex: 36,
  endIndex: 37
}

Input:  2010 to 2011, 2015 to 2016 , 2018, 2020
Output:  {
  operator: 'to_range',
  from: { type: 'absolute', date: '2010', unit: 'year' },
  to: { type: 'absolute', date: '2011', unit: 'year' }
} {
  operator: 'to_range',
  from: { type: 'absolute', date: '2015', unit: 'year' },
  to: { type: 'absolute', date: '2016', unit: 'year' }
} {
  operator: 'on',
  moment: { type: 'absolute', date: '2018', unit: 'year' }
} {
  operator: 'on',
  moment: { type: 'absolute', date: '2020', unit: 'year' }
}

Input:  next week
Output:  {
  operator: 'on',
  moment: { type: 'interval', kind: 'next', unit: 'week' }
}

Input:  now
Output:  { operator: 'on', moment: { type: 'named', name: 'now' } }

Input:  now to next month
Output:  {
  operator: 'to_range',
  from: { type: 'named', name: 'now' },
  to: { type: 'interval', kind: 'next', unit: 'month' }
}

Input:  null
Output:  { operator: 'null' }

Input:  -null,
Output:  { operator: 'not_null' }

Input:   yyesterday
Logs:    {
  severity: 'error',
  message: 'Invalid token yyesterday',
  startIndex: 1,
  endIndex: 11
}

Input:  before

Input:  for
Logs:    {
  severity: 'error',
  message: 'Invalid token for',
  startIndex: 0,
  endIndex: 3
}

Input:  12
Logs:    {
  severity: 'error',
  message: 'Invalid token 12',
  startIndex: 0,
  endIndex: 2
}

Input:  from now
Output:  { operator: 'on', moment: { type: 'named', name: 'now' } }
Logs:    {
  severity: 'error',
  message: 'Invalid token from',
  startIndex: 0,
  endIndex: 4
}

Input:  2025-12-25 12:32:
Output:  {
  operator: 'on',
  moment: { type: 'absolute', date: '2025-12-25', unit: 'day' }
}
Logs:    {
  severity: 'error',
  message: 'Invalid token 12:32:',
  startIndex: 11,
  endIndex: 17
}

Input:  12:22
Logs:    {
  severity: 'error',
  message: 'Invalid token 12:22',
  startIndex: 0,
  endIndex: 5
}

Input:  after 2025 seconds
Logs:    {
  severity: 'error',
  message: 'Invalid token ',
  startIndex: 6,
  endIndex: 18
}

Input:

```
