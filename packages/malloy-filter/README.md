# Malloy Filter Expressions

This repository contains the parser and serializer for Malloy filter expressions. Filter expressions give Malloy users a powerful, yet simple and intuitive, way to specify complex filtering conditions.

The library contains no external dependencies, and is designed to produce a lightweight data structure that can be embedded with minimal overhead into products interfacing with Malloy. Instructions for building and using the library are below.

The WN for filter expressions is [TBD].

## Building

```bash
npm run build
```

## Using

To use the parser, simply import `FilterParser` and go.

Example:

```code
import {BooleanParser} from './boolean_parser';
import {StringParser} from './string_parser';
import {NumberParser} from './number_parser';
import {DateParser} from './date_parser';

function aSimpleParser() {
  let str = 'CAT,DOG';
  const stringResponse = new StringParser(str).parse();
  console.log(str, '\n', ...stringResponse.clauses, '\n');

  str = '-5.5, 10, 2.3e7';
  const numberResponse = new NumberParser(str).parse();
  console.log(str, '\n', ...numberResponse.clauses, '\n');

  str = 'null, false';
  const booleanResponse = new BooleanParser(str).parse();
  console.log(str, '\n', ...booleanResponse.clauses, '\n');

  str = 'after 2025-10-05';
  const dateResponse = new DateParser(str).parse();
  console.log(str, '\n', ...dateResponse.clauses, '\n');
}

aSimpleParser();
```

Output:

```code
CAT,DOG
 { operator: '=', values: [ 'CAT', 'DOG' ] }

-5.5, 10, 2.3e7
 { operator: '=', values: [ -5.5, 10, 23000000 ] }

null, false
 { operator: 'NULL' } { operator: 'FALSEORNULL' }

after 2025-10-05
 {
  operator: 'AFTER',
  moment: { type: 'ABSOLUTE', date: '2025-10-05', unit: 'DAY' }
 }
```

Likewise, to use the serializers, simply import the `*Serializer` classes.

## Parsers

Each filter type is handled by a different parser (strings, numbers, dates and times, etc).

### Number Parser

The number parser `number_parser.ts` supports the operations highlighted on the [Samples](SAMPLES.md#numbers) page.

### String Parser

The string parser `string_parser.ts` supports the operations highlighted on the [Samples](SAMPLES.md#strings) page.

### Boolean Parser

The boolean parser `boolean_parser.ts` supports the operations highlighted on the [Samples](SAMPLES.md#booleans) page.

### Date and Time Parser

The date and time parser `date_parser.ts` supports the operations highlighted on the [Samples](SAMPLES.md#dates-and-times) page.

## Serializers

Each parser has a complementary serializer that converts the parser output (`xxxClause[]`) back to a string. See examples of the round trip from string to Clause to string on the [Serialization Samples](SERIALIZE_SAMPLES.md) page.
