# Serializers

Each parser has a complementary serializer that converts the structured clause list back
to string format.  Below are round-trip samples: `string` to `Clause[]` back to `string`.
Round-trip Examples:

```code
    Input  >  parse  >  Clause[]  >  serialize  >  Output
    string                                         string
```

-------------------------------------------------------------------------
## Number Serializer

```code
Input:  5
Output: 5

Input:  !=5
Output: !=5

Input:  1, 3, 5, null
Output: 1, 3, 5, null

Input:  1, 3, , 5,
Output: 1, 3, 5
Logs:    {
  severity: 'warn',
  message: 'Empty clause',
  startIndex: 6,
  endIndex: 7
}

Input:  <1, >=100
Output: <1, >=100

Input:  >=1
Output: >=1

Input:   <= 10
Output: <=10

Input:  NULL
Output: null

Input:   -NULL
Output: -null

Input:  (1, 7)
Output: (1, 7)

Input:  [-5, 90]
Output: [-5, 90]

Input:   != ( 12, 20 ]
Output: !=(12, 20]

Input:  [.12e-20, 20.0e3)
Output: [1.2e-21, 20000)

Input:  [0,9],[20,29]
Output: [0, 9], [20, 29]

Input:  [0,10], 20, NULL, ( 72, 82 ]
Output: [0, 10], 20, null, (72, 82]

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
Output: -5.5, 10
Logs:    {
  severity: 'error',
  message: 'Invalid expression: to',
  startIndex: 5,
  endIndex: 7
}
```

-------------------------------------------------------------------------
## String Serializer

```code
Input:  CAT, DOG,mouse
Output: CAT, DOG, mouse

Input:  -CAT,-DOG , -mouse
Output: -CAT, -DOG, -mouse

Input:   CAT,-"DOG",m o u s e
Output: CAT, -"DOG", m o u s e

Input:  -CAT,-DOG,mouse, bird, zebra, -horse, -goat
Output: -CAT, -DOG, mouse, bird, zebra, -horse, -goat

Input:  Missing ,NULL
Output: Missing, null

Input:  CAT%, D%OG, %ous%, %ira_f%, %_oat,
Output: CAT%, D%OG, %ous%, %ira_f%, %_oat
Logs:    {
  severity: 'warn',
  message: 'Empty clause',
  startIndex: 34,
  endIndex: 35
}

Input:  -CAT%,-D%OG,-%mouse,-%zebra%
Output: -CAT%, -D%OG, -%mouse, -%zebra%

Input:  CAT%,-CATALOG
Output: CAT%, -CATALOG

Input:  %,_,%%,%a%
Output: %, _, %%, %a%

Input:  %\_X
Output: %\_X

Input:  _\_X
Output: _\\_X

Input:  _CAT,D_G,mouse_
Output: _CAT, D_G, mouse_

Input:  \_CAT,D\%G,\mouse
Output: \_CAT, D\%G, mouse

Input:  CAT,-NULL
Output: CAT, -null

Input:  CAT,-"NULL"
Output: CAT, -"NULL"

Input:  CAT,NULL
Output: CAT, null

Input:  CAT,,
Output: CAT
Logs:    {
  severity: 'warn',
  message: 'Empty clause',
  startIndex: 4,
  endIndex: 5
}

Input:  CAT, , DOG
Output: CAT, DOG
Logs:    {
  severity: 'warn',
  message: 'Empty clause',
  startIndex: 4,
  endIndex: 5
}

Input:  EMPTY
Output: empty

Input:  -EMPTY
Output: -empty

Input:  CAT,-EMPTY
Output: CAT, -empty

Input:  "CAT,DOG',mo`use,zeb'''ra,g"""t,g\"ir\`af\'e
Output: "CAT, DOG', mo`use, zeb'''ra, g"""t, g"ir`af'e

Input:  CAT\,DOG
Output: CAT\,DOG

Input:  CAT,DOG,-, -
Output: CAT, DOG, -, -

Input:  --CAT,DOG,\
Output: --CAT, DOG
Logs:    {
  severity: 'warn',
  message: 'Empty clause',
  startIndex: 10,
  endIndex: 11
}

Input:  CAT\ DOG
Output: CAT DOG

Input:  _\_CAT
Output: _\\_CAT

Input:  \NULL
Output: NULL

Input:  \-NULL
Output: -NULL

Input:  -N\ULL
Output: -NULL

Input:  CA--,D-G
Output: CA--, D-G

Input:  Escaped\;chars\|are\(allowed\)ok
Output: Escaped\;chars\|are\(allowed\)ok

Input:  No(parens, No)parens, No;semicolons, No|ors
Output: No, parens, No, parens, No, semicolons, No, ors
Logs:    {
  severity: 'error',
  message: 'Invalid unescaped token: (',
  startIndex: 2,
  endIndex: 3
} {
  severity: 'error',
  message: 'Invalid unescaped token: )',
  startIndex: 13,
  endIndex: 14
} {
  severity: 'error',
  message: 'Invalid unescaped token: ;',
  startIndex: 24,
  endIndex: 25
} {
  severity: 'error',
  message: 'Invalid unescaped token: |',
  startIndex: 39,
  endIndex: 40
}

Input:   hello world, foo="bar baz" , qux=quux
Output: hello world, foo="bar baz", qux=quux

Input:  one ,Null ,  Empty,E M P T Y Y,EEmpty,        emptIEs
Output: one, null, empty, E M P T Y Y, EEmpty, emptIEs

Input:

```

-------------------------------------------------------------------------
## Boolean Serializer

```code
Input:  true
Output: true

Input:  FALSE
Output: false

Input:  =false
Output: =false

Input:  null
Output: null

Input:  -NULL
Output: -null

Input:  null,
Output: null

Input:   True , , faLSE,=false,NULl,-null
Output: true, false, =false, null, -null
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

Input:  (true)
Logs:    {
  severity: 'error',
  message: 'Invalid token (true)',
  startIndex: 0,
  endIndex: 6
}

Input:  false|true
Logs:    {
  severity: 'error',
  message: 'Invalid token false|true',
  startIndex: 0,
  endIndex: 10
}
```

-------------------------------------------------------------------------
## Date Serializer

```code
Input:  this month
Output: this month

Input:  3 days
Output: 3 days

Input:  3 days ago
Output: 3 days ago

Input:  3 months ago for 2 days
Output: 3 months ago for 2 days

Input:  2025 weeks ago
Output: 2025 weeks ago

Input:  before 3 days ago
Output: before 3 days ago

Input:  before 2025-08-30 08:30:20
Output: before 2025-08-30 08:30:20

Input:  after 2025-10-05
Output: after 2025-10-05

Input:  2025-08-30 12:00 to 2025-09-18 14:30
Output: 2025-08-30 12:00 to 2025-09-18 14:30

Input:  this year
Output: this year

Input:  next tuesday
Output: next tuesday

Input:  7 years from now
Output: 7 years from now

Input:  2025-01-01 12:00:00 for 3 days
Output: 2025-01-01 12:00:00 for 3 days

Input:  2020-08-12 03:12:56.57
Output: 2020-08-12 03:12:56.57

Input:  2020-08-12T03:12:56[PST]
Output: 2020-08-12T03:12:56[PST]

Input:  2020-08-12 03:12:56
Output: 2020-08-12 03:12:56

Input:  2020-08-12 03:22
Output: 2020-08-12 03:22

Input:  2020-08-12 03
Output: 2020-08-12 03

Input:  2020-08-12
Output: 2020-08-12

Input:  2020-Q3
Output: 2020-Q3

Input:  2020-08-07-wK
Logs:    {
  severity: 'error',
  message: 'Invalid token 2020-08-07-wk',
  startIndex: 0,
  endIndex: 13
}

Input:  2020-08
Output: 2020-08

Input:  today
Output: today

Input:  yesterday
Output: yesterday

Input:  tomorrow
Output: tomorrow

Input:  TODay,Yesterday, TOMORROW , ,TODay ,,
Output: today, yesterday, tomorrow, today
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
Output: 2010 to 2011, 2015 to 2016, 2018, 2020

Input:  next week
Output: next week

Input:  now
Output: now

Input:  now to next month
Output: now to next month

Input:  null
Output: null

Input:  -null,
Output: -null

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
Output: now
Logs:    {
  severity: 'error',
  message: 'Invalid token from',
  startIndex: 0,
  endIndex: 4
}

Input:  2025-12-25 12:32:
Output: 2025-12-25
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

Input:  (2025)
Logs:    {
  severity: 'error',
  message: 'Invalid token (2025)',
  startIndex: 0,
  endIndex: 6
}

Input:

```