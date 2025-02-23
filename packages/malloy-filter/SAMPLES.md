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
Output:  { operator: '=', values: [ 1, 3, 5 ] } { operator: 'NULL' }

Input:  <1, >=100
Output:  { operator: '<', values: [ 1 ] } { operator: '>=', values: [ 100 ] }

Input:  >=1
Output:  { operator: '>=', values: [ 1 ] }

Input:   <= 10
Output:  { operator: '<=', values: [ 10 ] }

Input:  NULL
Output:  { operator: 'NULL' }

Input:   -NULL
Output:  { operator: 'NOTNULL' }

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
} { operator: '=', values: [ 20 ] } { operator: 'NULL' } {
  operator: 'range',
  startOperator: '>',
  startValue: 72,
  endOperator: '<=',
  endValue: 82
}

Input:  , notanumber,, "null", apple pear orange, nulle, nnull, >=,
Errors:  { message: 'Invalid expression', startIndex: 2, endIndex: 12 } { message: 'Invalid expression', startIndex: 15, endIndex: 21 } { message: 'Invalid expression', startIndex: 23, endIndex: 28 } { message: 'Invalid expression', startIndex: 29, endIndex: 33 } { message: 'Invalid expression', startIndex: 34, endIndex: 40 } { message: 'Invalid expression', startIndex: 42, endIndex: 47 } { message: 'Invalid expression', startIndex: 49, endIndex: 54 } { message: 'Invalid expression', startIndex: 56, endIndex: 58 }

Input:  [cat, 100], <cat
Errors:  { message: 'Invalid number', startIndex: 1, endIndex: 4 } { message: 'Invalid expression', startIndex: 12, endIndex: 13 } { message: 'Invalid expression', startIndex: 13, endIndex: 16 }

Input:  -5.5 to 10
Output:  { operator: '=', values: [ -5.5, 10 ] }
Errors:  { message: 'Invalid expression', startIndex: 5, endIndex: 7 }

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
Quotes:  DOUBLE

Input:  -CAT,-DOG,mouse, bird, zebra, -horse, -goat
Output:  { operator: '!=', values: [ 'CAT', 'DOG' ] } { operator: '=', values: [ 'mouse', 'bird', 'zebra' ] } { operator: '!=', values: [ 'horse', 'goat' ] }

Input:  Missing ,NULL
Output:  { operator: '=', values: [ 'Missing' ] } { operator: 'NULL' }

Input:  CAT%, D%OG, %ous%, %ira_f%, %_oat,
Output:  { operator: 'starts', values: [ 'CAT' ] } { operator: '~', values: [ 'D%OG' ] } { operator: 'contains', values: [ 'ous' ] } { operator: '~', values: [ '%ira_f%', '%_oat' ] }
Errors:  { message: 'Invalid expression', startIndex: 34, endIndex: 35 }

Input:  -CAT%,-D%OG,-%mouse,-%zebra%
Output:  { operator: 'notStarts', values: [ 'CAT' ] } { operator: '!~', values: [ 'D%OG' ] } { operator: 'notEnds', values: [ 'mouse' ] } { operator: 'notContains', values: [ 'zebra' ] }

Input:  CAT%,-CATALOG
Output:  { operator: 'starts', values: [ 'CAT' ] } { operator: '!=', values: [ 'CATALOG' ] }

Input:  %,_,%%,%a%
Output:  { operator: '~', values: [ '%', '_', '%%' ] } { operator: 'contains', values: [ 'a' ] }

Input:  %\_X
Output:  { operator: 'ends', values: [ '_X' ] }

Input:  _\_X
Output:  { operator: '~', values: [ '_\\_X' ] }

Input:  _CAT,D_G,mouse_
Output:  { operator: '~', values: [ '_CAT', 'D_G', 'mouse_' ] }

Input:  \_CAT,D\%G,\mouse
Output:  { operator: '=', values: [ '_CAT', 'D%G', 'mouse' ] }

Input:  CAT,-NULL
Output:  { operator: '=', values: [ 'CAT' ] } { operator: 'NOTNULL' }

Input:  CAT,-"NULL"
Output:  { operator: '=', values: [ 'CAT' ] } { operator: '!=', values: [ '"NULL"' ] }
Quotes:  DOUBLE

Input:  CAT,NULL
Output:  { operator: '=', values: [ 'CAT' ] } { operator: 'NULL' }

Input:  EMPTY
Output:  { operator: 'EMPTY' }

Input:  -EMPTY
Output:  { operator: 'NOTEMPTY' }

Input:  CAT,-EMPTY
Output:  { operator: '=', values: [ 'CAT' ] } { operator: 'NOTEMPTY' }

Input:  "CAT,DOG',mo`use,zeb'''ra,g"""t,g\"ir\`af\'e
Output:  {
  operator: '=',
  values: [ '"CAT', "DOG'", 'mo`use', "zeb'''ra", 'g"""t', 'g"ir`af\'e' ]
}
Quotes:  DOUBLE SINGLE BACKTICK TRIPLESINGLE TRIPLEDOUBLE ESCAPEDDOUBLE ESCAPEDBACKTICK ESCAPEDSINGLE

Input:  CAT\,DOG
Output:  { operator: '=', values: [ 'CAT,DOG' ] }

Input:  CAT,DOG,-, -
Output:  { operator: '=', values: [ 'CAT', 'DOG', '-', '-' ] }

Input:  --CAT,DOG,\
Output:  { operator: '!=', values: [ '-CAT' ] } { operator: '=', values: [ 'DOG' ] }
Errors:  { message: 'Invalid expression', startIndex: 10, endIndex: 11 }

Input:  CAT\ DOG
Output:  { operator: '=', values: [ 'CAT DOG' ] }

Input:  _\_CAT
Output:  { operator: '~', values: [ '_\\_CAT' ] }

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
Quotes:  DOUBLE

Input:  one ,Null ,  Empty,E M P T Y Y,EEmpty,        emptIEs
Output:  { operator: '=', values: [ 'one' ] } { operator: 'NULL' } { operator: 'EMPTY' } { operator: '=', values: [ 'E M P T Y Y', 'EEmpty', 'emptIEs' ] }

Input:

```

-------------------------------------------------------------------------
## Booleans

```code
Input:  true
Output:  { operator: 'TRUE' }

Input:  FALSE
Output:  { operator: 'FALSEORNULL' }

Input:  =false
Output:  { operator: 'FALSE' }

Input:  null
Output:  { operator: 'NULL' }

Input:  -NULL
Output:  { operator: 'NOTNULL' }

Input:   True , faLSE,=false,NULl,-null
Output:  { operator: 'TRUE' } { operator: 'FALSEORNULL' } { operator: 'FALSE' } { operator: 'NULL' } { operator: 'NOTNULL' }

Input:  -'null'
Errors:  { message: "Invalid token -'null'", startIndex: 0, endIndex: 7 }

Input:  10
Errors:  { message: 'Invalid token 10', startIndex: 0, endIndex: 2 }

Input:  nnull
Errors:  { message: 'Invalid token nnull', startIndex: 0, endIndex: 5 }

Input:   truee
Errors:  { message: 'Invalid token truee', startIndex: 1, endIndex: 6 }

```

-------------------------------------------------------------------------
## Dates and Times

```code
Input:  this month
Output:  {
  operator: 'ON',
  moment: { type: 'INTERVAL', kind: 'THIS', unit: 'MONTH' }
}

Input:  3 days
Output:  { operator: 'DURATION', duration: { amount: 3, unit: 'DAYS' } }

Input:  3 days ago
Output:  {
  operator: 'ON',
  moment: {
    type: 'OFFSET_FROM_NOW',
    direction: 'AGO',
    amount: 3,
    unit: 'DAYS'
  }
}

Input:  3 months ago for 2 days
Output:  {
  operator: 'FOR_RANGE',
  from: {
    type: 'OFFSET_FROM_NOW',
    direction: 'AGO',
    amount: 3,
    unit: 'MONTHS'
  },
  duration: { amount: 2, unit: 'DAYS' }
}

Input:  2025 weeks ago
Output:  {
  operator: 'ON',
  moment: {
    type: 'OFFSET_FROM_NOW',
    direction: 'AGO',
    amount: 2025,
    unit: 'WEEKS'
  }
}

Input:  before 3 days ago
Output:  {
  operator: 'BEFORE',
  moment: {
    type: 'OFFSET_FROM_NOW',
    direction: 'AGO',
    amount: 3,
    unit: 'DAYS'
  }
}

Input:  before 2025-08-30 08:30:20
Output:  {
  operator: 'BEFORE',
  moment: { type: 'ABSOLUTE', date: '2025-08-30 08:30:20', unit: 'SECOND' }
}

Input:  after 2025-10-05
Output:  {
  operator: 'AFTER',
  moment: { type: 'ABSOLUTE', date: '2025-10-05', unit: 'DAY' }
}

Input:  2025-08-30 12:00 to 2025-09-18 14:30
Output:  {
  operator: 'TO_RANGE',
  from: { type: 'ABSOLUTE', date: '2025-08-30 12:00', unit: 'MINUTE' },
  to: { type: 'ABSOLUTE', date: '2025-09-18 14:30', unit: 'MINUTE' }
}

Input:  this year
Output:  {
  operator: 'ON',
  moment: { type: 'INTERVAL', kind: 'THIS', unit: 'YEAR' }
}

Input:  next tuesday
Output:  {
  operator: 'ON',
  moment: { type: 'INTERVAL', kind: 'NEXT', unit: 'TUESDAY' }
}

Input:  7 years from now
Output:  {
  operator: 'ON',
  moment: {
    type: 'OFFSET_FROM_NOW',
    direction: 'FROMNOW',
    amount: 7,
    unit: 'YEARS'
  }
}

Input:  2025-01-01 12:00:00 for 3 days
Output:  {
  operator: 'FOR_RANGE',
  from: { type: 'ABSOLUTE', date: '2025-01-01 12:00:00', unit: 'SECOND' },
  duration: { amount: 3, unit: 'DAYS' }
}

Input:  2020-08-12
Output:  {
  operator: 'ON',
  moment: { type: 'ABSOLUTE', date: '2020-08-12', unit: 'DAY' }
}

Input:  2020-08
Output:  {
  operator: 'ON',
  moment: { type: 'ABSOLUTE', date: '2020-08', unit: 'MONTH' }
}

Input:  today
Output:  { operator: 'ON', moment: { type: 'NAMED', name: 'TODAY' } }

Input:  yesterday
Output:  { operator: 'ON', moment: { type: 'NAMED', name: 'YESTERDAY' } }

Input:  tomorrow
Output:  { operator: 'ON', moment: { type: 'NAMED', name: 'TOMORROW' } }

Input:  TODay,Yesterday, TOMORROW , ,TODay ,,
Output:  { operator: 'ON', moment: { type: 'NAMED', name: 'TODAY' } } { operator: 'ON', moment: { type: 'NAMED', name: 'YESTERDAY' } } { operator: 'ON', moment: { type: 'NAMED', name: 'TOMORROW' } } { operator: 'ON', moment: { type: 'NAMED', name: 'TODAY' } }

Input:  2010 to 2011, 2015 to 2016 , 2018, 2020
Output:  {
  operator: 'TO_RANGE',
  from: { type: 'ABSOLUTE', date: '2010', unit: 'YEAR' },
  to: { type: 'ABSOLUTE', date: '2011', unit: 'YEAR' }
} {
  operator: 'TO_RANGE',
  from: { type: 'ABSOLUTE', date: '2015', unit: 'YEAR' },
  to: { type: 'ABSOLUTE', date: '2016', unit: 'YEAR' }
} {
  operator: 'ON',
  moment: { type: 'ABSOLUTE', date: '2018', unit: 'YEAR' }
} {
  operator: 'ON',
  moment: { type: 'ABSOLUTE', date: '2020', unit: 'YEAR' }
}

Input:  next week
Output:  {
  operator: 'ON',
  moment: { type: 'INTERVAL', kind: 'NEXT', unit: 'WEEK' }
}

Input:  now
Output:  { operator: 'ON', moment: { type: 'NAMED', name: 'NOW' } }

Input:  now to next month
Output:  {
  operator: 'TO_RANGE',
  from: { type: 'NAMED', name: 'NOW' },
  to: { type: 'INTERVAL', kind: 'NEXT', unit: 'MONTH' }
}

Input:  null
Output:  { operator: 'NULL' }
Errors:  { message: 'Invalid token NULL', startIndex: 0, endIndex: 4 }

Input:  -null,
Output:  { operator: 'NOTNULL' }
Errors:  { message: 'Invalid token -NULL', startIndex: 0, endIndex: 5 }

Input:   yyesterday
Errors:  { message: 'Invalid token yyesterday', startIndex: 1, endIndex: 11 }

Input:  before

Input:  for
Errors:  { message: 'Invalid token FOR', startIndex: 0, endIndex: 3 }

Input:  7
Errors:  { message: 'Invalid token 7', startIndex: 0, endIndex: 1 }

Input:  from now
Output:  { operator: 'ON', moment: { type: 'NAMED', name: 'NOW' } }
Errors:  { message: 'Invalid token FROM', startIndex: 0, endIndex: 4 }

Input:  2025-12-25 12:32:
Output:  {
  operator: 'ON',
  moment: { type: 'ABSOLUTE', date: '2025-12-25', unit: 'DAY' }
}
Errors:  { message: 'Invalid token 12:32:', startIndex: 11, endIndex: 17 }

Input:  after 2025 seconds
Errors:  { message: 'Invalid token ', startIndex: 6, endIndex: 18 }

Input:

```
