# Types

All fields in Malloy have a type. Today, these types are
mostly scalar, with a few notable exceptions.

## Scalar Types

### Numbers

All numbers in Malloy are of type `number`, including BigQuery's <code>INTEGER</code>, <code>INT64</code>, <code>FLOAT</code>, and <code>FLOAT64</code> types.

Literal `number`s consist of one or more digits optionally followed
by a decimal point `.` and more digits, e.g. `42` or `3.14`.

Negative numbers are represented using the unary minus
operator, e.g. `-7`.

Today, no other forms of literal numbers (e.g. numbers in other
bases, numbers with thousand separators, exponential notation, etc.) are legal.

### Strings

In Malloy, strings of any length are represented by the `string` type.

Literal strings in Malloy are enclosed in single quotes `'`, and may include the escape sequences `\\` or `\.`, e.g. `'\'Hello, world\''`.

### Dates and Timestamps

Malloy has two time types, `date` and `timestamp`.

Both the `date` and `timestamp` types may have an associated
_timeframe_, which can be `year`, `quarter`, `month`,
`week`, or `day`, and for `timestamp`s only, additionally
`hour`, `minute`, or `second`.

Literals for `date` and `timestamp` are preceded by the `@` character, e.g. `@2003` or `@1983-11-23 10:00:10`. For all
variations of time literals and information about their interaction with comparison operators, see the [Time Ranges](time-ranges.html#literals) section.

### Booleans

The `boolean` type covers both the <code>BOOLEAN</code> and <code>BOOL</code> types from BigQuery.

In Malloy, the boolean literals are written `true` and `false`.

### Bytes

Bytestrings are represented by the <code>bytes</code> type
in Malloy.

There is currently no syntax for specifying <code>bytes</code> literals or casting to the <code>bytes</code> type.

<!-- TODO Add information about how Malloy has arrays and structs, though with no literal form, type keyword, or support in expressions. Currently, structs and arrays only exist in that the output type of a query is an array of structs (or possibly a single struct in some cases) -->

<!-- ## Compound Types

Today, Malloy contains only one compound type, the <code>struct</code>.

### Structs

All queries are of type <code>struct</code>, which map field
names to values. In JSON output from Malloy, structs are
represented by JSON objects. -->

## Intermediate Types

The following types are not assignable to fields, and are
therefore considered _intermediate types_, in that they are
primarily used to represent part of a computation that
yields a regular scalar type, often `boolean`.

### Regular Expressions

Literal regular expressions are enclosed in single quotation
marks `'` and preceded by either `/` or `r`, e.g. `/'.*'` or `r'.*'`. Both syntaxes are semantically equivalent.

In the future, the literal regular expressions will likely
be simply slash-enclosed, e.g <code>/.*/</code>.

Values of type `string` may be compared against regular
expressions using either the [apply operator](apply.md),`name: r'c.*'` or the like operator, `name ~ r'c.*'`.

### Ranges

There are three types of ranges today: `string` ranges, `date` ranges, and `timestamp` ranges. The most basic ranges
are of the form `start to end` and represent the inclusive range between `start` and `end`, e.g. `10 to 20` or `@2004-01 to @2005-05`.

Ranges may be used in conjunction with the [apply operator](apply.md) to test whether a value falls within a given range.

In the future, other ranges may be allowed, such as `string` ranges.

### Alternations and Partials

_Partials_ represent a "part of" a comparison.
Specifically, a partial is a comparison missing its
left-hand side, and represents the condition of the
comparison yielding `true` if a given value were to be
filled in for that missing left-hand side. For example, `> 10` is a partial that represents the condition "is greater
than ten." Likewise, `!= 'CA'` is a partial that represents the condition of not being equal to `'CA'`.

_Alternations_ are combinations of partials representing
either the logical union ("or") or conjunction ("and") of
their conditions. Alternations are represented using the
union alternation operator `|` and the conjunction
alternation operator `&`.

For example, `= 'CA' | = 'NY'` represents the condition of being equal to 'CA' or _alternatively_ being equal to 'NY'. On the other hand, `!= 'CA' & != 'NY'` represents the condition of being not equal to 'CA' _as well as_ being not equal to 'NY'.

Scalar values, regular expressions, and
ranges may also be used in alternations, in which case the
condition is assumed to be that of equality, matching, and
inclusion respectively.

For example, `'CA' | r'N.*'` represents the condition of being equal to 'CA' or starting with 'N', and `10 to 20 | 20 to 30` represents the condition of being _either_ between 10 and 20 _or_ 20 and 30.

Alternations and partials may be used in conjunction with the [apply operator](apply.md) to test whether a value meets the given condition.

## Nullability

Today, all Malloy types include the value `null`, however
in the future Malloy may have a concept of nullable vs.
non-nullable types.