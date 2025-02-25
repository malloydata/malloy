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
Output: 1, 3, 5, NULL

Input:  <1, >=100
Output: <1, >=100

Input:  >=1
Output: >=1

Input:   <= 10
Output: <=10

Input:  NULL
Output: NULL

Input:   -NULL
Output: -NULL

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
Output: [0, 10], 20, NULL, (72, 82]

Input:  , notanumber,, "null", apple pear orange, nulle, nnull, >=,
Errors:  { message: 'Invalid expression', startIndex: 2, endIndex: 12 } { message: 'Invalid expression', startIndex: 15, endIndex: 21 } { message: 'Invalid expression', startIndex: 23, endIndex: 28 } { message: 'Invalid expression', startIndex: 29, endIndex: 33 } { message: 'Invalid expression', startIndex: 34, endIndex: 40 } { message: 'Invalid expression', startIndex: 42, endIndex: 47 } { message: 'Invalid expression', startIndex: 49, endIndex: 54 } { message: 'Invalid expression', startIndex: 56, endIndex: 58 }

Input:  [cat, 100], <cat
Errors:  { message: 'Invalid number', startIndex: 1, endIndex: 4 } { message: 'Invalid expression', startIndex: 12, endIndex: 13 } { message: 'Invalid expression', startIndex: 13, endIndex: 16 }

Input:  -5.5 to 10
Output: -5.5, 10
Errors:  { message: 'Invalid expression', startIndex: 5, endIndex: 7 }
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
Output: Missing, NULL

Input:  CAT%, D%OG, %ous%, %ira_f%, %_oat,
Output: CAT%, D%OG, %ous%, %ira_f%, %_oat
Errors:  { message: 'Invalid expression', startIndex: 34, endIndex: 35 }

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
Output: CAT, -NULL

Input:  CAT,-"NULL"
Output: CAT, -"NULL"

Input:  CAT,NULL
Output: CAT, NULL

Input:  EMPTY
Output: EMPTY

Input:  -EMPTY
Output: -EMPTY

Input:  CAT,-EMPTY
Output: CAT, -EMPTY

Input:  "CAT,DOG',mo`use,zeb'''ra,g"""t,g\"ir\`af\'e
Output: "CAT, DOG', mo`use, zeb'''ra, g"""t, g"ir`af'e

Input:  CAT\,DOG
Output: CAT\,DOG

Input:  CAT,DOG,-, -
Output: CAT, DOG, -, -

Input:  --CAT,DOG,\
Output: --CAT, DOG
Errors:  { message: 'Invalid expression', startIndex: 10, endIndex: 11 }

Input:  CAT\ DOG
Output: CAT DOG

Input:  _\_CAT
Output: _\\_CAT

Input:  \NULL
Output: \NULL

Input:  \-NULL
Output: \-NULL

Input:  -N\ULL
Output: -\NULL

Input:  CA--,D-G
Output: CA--, D-G

Input:   hello world, foo="bar baz" , qux=quux
Output: hello world, foo="bar baz", qux=quux

Input:  one ,Null ,  Empty,E M P T Y Y,EEmpty,        emptIEs
Output: one, NULL, EMPTY, E M P T Y Y, EEmpty, emptIEs

Input:

```

-------------------------------------------------------------------------
## Boolean Serializer

```code
Input:  true
Output: TRUE

Input:  FALSE
Output: FALSE

Input:  =false
Output: =FALSE

Input:  null
Output: NULL

Input:  -NULL
Output: -NULL

Input:   True , faLSE,=false,NULl,-null
Output: TRUE, FALSE, =FALSE, NULL, -NULL

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
## Date Serializer

```code
Input:  this month
Output: THIS MONTH

Input:  3 days
Output: 3 DAYS

Input:  3 days ago
Output: 3 DAYS AGO

Input:  3 months ago for 2 days
Output: 3 MONTHS AGO FOR 2 DAYS

Input:  2025 weeks ago
Output: 2025 WEEKS AGO

Input:  before 3 days ago
Output: BEFORE 3 DAYS AGO

Input:  before 2025-08-30 08:30:20
Output: BEFORE 2025-08-30 08:30:20

Input:  after 2025-10-05
Output: AFTER 2025-10-05

Input:  2025-08-30 12:00 to 2025-09-18 14:30
Output: 2025-08-30 12:00 TO 2025-09-18 14:30

Input:  this year
Output: THIS YEAR

Input:  next tuesday
Output: NEXT TUESDAY

Input:  7 years from now
Output: 7 YEARS FROM NOW

Input:  2025-01-01 12:00:00 for 3 days
Output: 2025-01-01 12:00:00 FOR 3 DAYS

Input:  2020-08-12
Output: 2020-08-12

Input:  2020-08
Output: 2020-08

Input:  today
Output: TODAY

Input:  yesterday
Output: YESTERDAY

Input:  tomorrow
Output: TOMORROW

Input:  TODay,Yesterday, TOMORROW , ,TODay ,,
Output: TODAY, YESTERDAY, TOMORROW, TODAY

Input:  2010 to 2011, 2015 to 2016 , 2018, 2020
Output: 2010 TO 2011, 2015 TO 2016, 2018, 2020

Input:  next week
Output: NEXT WEEK

Input:  now
Output: NOW

Input:  now to next month
Output: NOW TO NEXT MONTH

Input:  null
Output: NULL
Errors:  { message: 'Invalid token NULL', startIndex: 0, endIndex: 4 }

Input:  -null,
Output: -NULL
Errors:  { message: 'Invalid token -NULL', startIndex: 0, endIndex: 5 }

Input:   yyesterday
Errors:  { message: 'Invalid token yyesterday', startIndex: 1, endIndex: 11 }

Input:  before

Input:  for
Errors:  { message: 'Invalid token FOR', startIndex: 0, endIndex: 3 }

Input:  7
Errors:  { message: 'Invalid token 7', startIndex: 0, endIndex: 1 }

Input:  from now
Output: NOW
Errors:  { message: 'Invalid token FROM', startIndex: 0, endIndex: 4 }

Input:  2025-12-25 12:32:
Output: 2025-12-25
Errors:  { message: 'Invalid token 12:32:', startIndex: 11, endIndex: 17 }

Input:  after 2025 seconds
Errors:  { message: 'Invalid token ', startIndex: 6, endIndex: 18 }

Input:

```