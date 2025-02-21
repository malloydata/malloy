# Parsers

Each filter type is handled by a different parser (strings, numbers, dates and times, etc). Sample outputs from each parser follow...

## Numbers

The number parser `number_parser.ts` supports the "numeric" expressions shown below. `Input` is the input string and `Output` shows the output of `number_parser`:

```code
Input:  5
Output:  { operator: '=', values: [ 5 ] }

Input:  !=5
Output:  { operator: '!=', values: [ 5 ] }

Input:  1, 3, null , 7
Output:  { operator: '=', values: [ 1, 3, null, 7 ] }

Input:  <1, >=100
Output:  { operator: '<', values: [ 1 ] } { operator: '>=', values: [ 100 ] }

Input:  >=1
Output:  { operator: '>=', values: [ 1 ] }

Input:   <= 10
Output:  { operator: '<=', values: [ 10 ] }

Input:  NULL
Output:  { operator: '=', values: [ null ] }

Input:   -NULL
Output:  { operator: '!=', values: [ null ] }

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
} { operator: '=', values: [ 20, null ] } {
  operator: 'range',
  startOperator: '>',
  startValue: 72,
  endOperator: '<=',
  endValue: 82
}

Input:  , notanumber,, "null", apple pear orange, nulle, nnull, >=,
Errors:  { message: 'Invalid expression', startIndex: 2, endIndex: 12 } { message: 'Invalid expression', startIndex: 15, endIndex: 21 } { message: 'Invalid expression', startIndex: 23, endIndex: 28 } { message: 'Invalid expression', startIndex: 29, endIndex: 33 } { message: 'Invalid expression', startIndex: 34, endIndex: 40 } { message: 'Invalid expression', startIndex: 42, endIndex: 47 } { message:
 'Invalid expression', startIndex: 49, endIndex: 54 } { message: 'Invalid expression', startIndex: 56, endIndex: 58 }

Input:  [cat, 100], <cat
Errors:  { message: 'Invalid number', startIndex: 1, endIndex: 4 } { message: 'Invalid expression', startIndex: 12, endIndex: 13 } { message: 'Invalid expression', startIndex: 13, endIndex: 16 }

Input:  -5.5 to 10
Output:  { operator: '=', values: [ -5.5, 10 ] }
Errors:  { message: 'Invalid expression', startIndex: 5, endIndex: 7 }
```

## Strings

The string parser `string_parser.ts` supports the "string expressions" shown below. `Input` is the input string and `Output` shows the output of `string_parser`. Note that **several examples below are illogical**, and are intended to stress-test the parser.

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
Output:  { operator: '=', values: [ 'Missing', null ] }

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
Output:  { operator: '=', values: [ 'CAT' ] } { operator: '!=', values: [ null ] }

Input:  CAT,-"NULL"
Output:  { operator: '=', values: [ 'CAT' ] } { operator: '!=', values: [ '"NULL"' ] }

Input:  CAT,NULL
Output:  { operator: '=', values: [ 'CAT', null ] }

Input:  EMPTY
Output:  { operator: 'EMPTY', values: [ null ] }

Input:  -EMPTY
Output:  { operator: 'NOTEMPTY', values: [ null ] }

Input:  CAT,-EMPTY
Output:  { operator: '=', values: [ 'CAT' ] } { operator: 'NOTEMPTY', values: [ null ] }

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

Input:  one ,Null ,  Empty,E M P T Y Y,EEmpty,        emptIEs
Output:  { operator: '=', values: [ 'one', null ] } { operator: 'EMPTY', values: [ null ] } { operator: '=', values: [ 'E M P T Y Y', 'EEmpty', 'emptIEs' ] }

Input:
```

## Booleans

The boolean parser `boolean_parser.ts` supports the "truthy" expressions shown below. `Input` is the input string and `Output` shows the output of `boolean_parser`:

```code
Input:  true
Output:  { operator: 'TRUE' }

Input:  FALSE
Output:  { operator: 'FALSE' }

Input:  null
Output:  { operator: 'NULL' }

Input:  -NULL
Output:  { operator: 'NOTNULL' }

Input:   True , faLSE,NULl,-null
Output:  { operator: 'TRUE' } { operator: 'FALSE' } { operator: 'NULL' } { operator: 'NOTNULL' }

Input:  -'null'
Errors:  { message: "Invalid token -'null'", startIndex: 0, endIndex: 7 }

Input:  10
Errors:  { message: 'Invalid token 10', startIndex: 0, endIndex: 2 }

Input:  nnull
Errors:  { message: 'Invalid token nnull', startIndex: 0, endIndex: 5 }

Input:   truee
Errors:  { message: 'Invalid token truee', startIndex: 1, endIndex: 6 }
```

## Dates and Times

The date and time parser `date_parser.ts` supports the date and time expressions shown below. `Input` is the input string and `Output` shows the output of `date_parser`. Note that, like with strings above, we include several invalid examples to highlight error responses:

```code
Input:  this month
Output:  { operator: 'THIS', unit: 'MONTH' }

Input:  3 days
Output:  { operator: 'TIMEBLOCK', value: '3', unit: 'DAYS' }

Input:  3 days ago
Output:  { operator: 'AGO', value: '3', unit: 'DAYS' }

Input:  3 months ago for 2 days
Output:  {
  start: { operator: 'AGO', value: '3', unit: 'MONTHS' },
  operator: 'FOR',
  end: { operator: 'TIMEBLOCK', value: '2', unit: 'DAYS' }
}

Input:  after 2025 seconds
Output:  {
  operator: 'TIMEBLOCK',
  value: '2025',
  unit: 'SECONDS',
  prefix: 'AFTER'
}

Input:  2025 weeks ago
Output:  { operator: 'AGO', value: '2025', unit: 'WEEKS' }

Input:  before 3 days ago
Output:  { operator: 'AGO', value: '3', unit: 'DAYS', prefix: 'BEFORE' }

Input:  before 2025-08-30 08:30:20
Output:  {
  operator: 'DATETIME',
  date: '2025-08-30',
  time: '08:30:20',
  prefix: 'BEFORE'
}

Input:  after 2025-10-05
Output:  { operator: 'DATE', date: '2025-10-05', prefix: 'AFTER' }

Input:  2025-08-30 12:00:00 to 2025-09-18 14:00:00
Output:  {
  start: { operator: 'DATETIME', date: '2025-08-30', time: '12:00:00' },
  operator: 'TO',
  end: { operator: 'DATETIME', date: '2025-09-18', time: '14:00:00' }
}

Input:  this year
Output:  { operator: 'THIS', unit: 'YEAR' }

Input:  next tuesday
Output:  { operator: 'NEXT', unit: 'TUESDAY' }

Input:  7 years from now
Output:  { operator: 'FROMNOW', value: '7', unit: 'YEARS' }

Input:  2025-01-01 12:00:00 for 3 days
Output:  {
  start: { operator: 'DATETIME', date: '2025-01-01', time: '12:00:00' },
  operator: 'FOR',
  end: { operator: 'TIMEBLOCK', value: '3', unit: 'DAYS' }
}

Input:  2020-08-12
Output:  { operator: 'DATE', date: '2020-08-12' }

Input:  2020-08
Output:  { operator: 'DATE', date: '2020-08' }

Input:  today
Output:  { operator: 'TODAY' }

Input:  yesterday
Output:  { operator: 'YESTERDAY' }

Input:  tomorrow
Output:  { operator: 'TOMORROW' }

Input:  TODay,Yesterday, TOMORROW , ,TODay ,,
Output:  { operator: 'TODAY' } { operator: 'YESTERDAY' } { operator: 'TOMORROW' } { operator: 'TODAY' }

Input:  2010 to 2011, 2015 to 2016 , 2018, 2020
Output:  {
  start: { operator: 'DATE', date: '2010' },
  operator: 'TO',
  end: { operator: 'DATE', date: '2011' }
} {
  start: { operator: 'DATE', date: '2015' },
  operator: 'TO',
  end: { operator: 'DATE', date: '2016' }
} { operator: 'DATE', date: '2018' } { operator: 'DATE', date: '2020' }

Input:  next week
Output:  { operator: 'NEXT', unit: 'WEEK' }

Input:  now
Output:  { operator: 'NOW' }

Input:  now to next month
Output:  {
  start: { operator: 'NOW' },
  operator: 'TO',
  end: { operator: 'NEXT', unit: 'MONTH' }
}

Input:   yyesterday
Errors:  { message: 'Invalid token yyesterday', startIndex: 1, endIndex: 11 }

Input:  before

Input:  for
Errors:  { message: 'Invalid token FOR', startIndex: 0, endIndex: 3 }

Input:  7
Errors:  { message: 'Invalid token 7', startIndex: 0, endIndex: 1 }

Input:  from now
Output:  { operator: 'NOW' }
Errors:  { message: 'Invalid token FROM', startIndex: 0, endIndex: 4 }

Input:
```
