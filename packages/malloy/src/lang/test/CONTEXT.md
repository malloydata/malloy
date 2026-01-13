# Translator Test Infrastructure

This directory contains tests for the Malloy translator - the phase that transforms Malloy source code into Intermediate Representation (IR). These tests verify language semantics without requiring database connections.

## Philosophy

Translator tests should be **dialect-agnostic** where possible. The translator produces IR that is independent of any specific SQL dialect. However, some language features (like available functions or type support) vary by dialect, so the test infrastructure supports multiple dialects.

The tests use a mock schema system that provides pre-defined tables and sources, allowing tests to run without any actual database connections.

## Core Components

### TestTranslator

`TestTranslator` extends `MalloyTranslator` with a mock schema and pre-defined model. It provides:

- **Two connections:**
  - `_db_` - DuckDB dialect, supports `timestamptz`
  - `_bq_` - BigQuery/StandardSQL dialect
- **Mock tables** (accessible via `connection.table('path')`):
  - `_db_.table('aTable')` - base table with all field types
  - `_bq_.table('aTable')` - BigQuery version
  - `_db_.table('malloytest.carriers')`
  - `_db_.table('malloytest.flights')`
  - `_db_.table('malloytest.airports')`
- **Pre-defined sources** (available without declaration):
  - `a` - `_db_.table('aTable')`
  - `b` - Same as `a`
  - `ab` - `a` with a join to `b`, plus `acount` measure and `aturtle` query
  - `bq_a` - `_bq_.table('aTable')`
  - `carriers` - `_db_.table('malloytest.carriers')`
  - `flights` - `_db_.table('malloytest.flights')`
  - `airports` - `_db_.table('malloytest.airports')`

### BetaExpression

`BetaExpression` extends `TestTranslator` for testing individual expressions. It compiles an expression in the context of a source (default: `ab`) and provides access to the generated `ExprValue`.

## Template Literal Helpers

### `expr\`...\``

Creates a `BetaExpression` for testing expression compilation:

```typescript
expect(expr`astr`).compilesTo('astr');
expect(expr`ai + 1`).compilesTo('{+ ai 1}');
```

### `model\`...\``

Creates a `TestTranslator` for testing full Malloy source:

```typescript
expect(model`run: a -> { select: * }`).toTranslate();
```

### `markSource\`...\``

Creates source with marked locations for testing error positions. Use `${'text'}` to mark positions:

```typescript
expect(markSource`run: a -> { select: ${'bad_field'} }`)
  .toLog(errorMessage('Unknown field'));
```

The marked locations can be verified against error positions in the `toLog` matcher.

## Jest Matchers

Import matchers by including:
```typescript
import './parse-expects';
```

### `toParse()`

Passes if the source parses to an AST without errors:

```typescript
expect('source: x is a').toParse();
```

### `toTranslate()`

Passes if the source compiles completely to IR:

```typescript
expect('run: a -> { select: * }').toTranslate();
```

### `compilesTo(exprString)`

**Preferred for expression tests.** Compiles an expression and compares the generated IR to a human-readable string representation:

```typescript
expect(expr`ai + 1`).compilesTo('{+ ai 1}');
expect(expr`upper(astr)`).compilesTo('{upper astr}');
expect(expr`now.year`).compilesTo('{timeTrunc-year {now}}');
```

This is better than `toTranslate()` for expressions because it verifies the *actual IR generated*, not just that compilation succeeded.

### `toReturnType(type)`

Checks that an expression returns the expected type:

```typescript
expect('ai + 1').toReturnType('number');
```

### `toLog(...problems)`

Verifies that compilation produces specific errors or warnings:

```typescript
expect('run: a -> { select: unknown_field }')
  .toLog(errorMessage('Unknown field'));

expect(markSource`run: a -> { select: ${'bad'} }`)
  .toLog(error('unknown-field', {field: 'bad'}));
```

### `toLogAtLeast(...problems)`

Like `toLog` but allows additional errors beyond those specified.

### `hasFieldUsage(paths)`

Verifies which fields an expression references:

```typescript
expect(expr`ai + af`).hasFieldUsage([['ai'], ['af']]);
```

## Error/Warning Helpers

### By message (string or regex):

```typescript
errorMessage('exact message')
errorMessage(/pattern/)
warningMessage('warning text')
```

### By code (type-safe):

```typescript
error('unknown-field', {field: 'x'})
warning('deprecated-syntax')
```

## Example Patterns

### Testing expression compilation (preferred):

```typescript
test('addition compiles correctly', () => {
  expect(expr`ai + 1`).compilesTo('{+ ai 1}');
});
```

### Testing that a model construct translates:

```typescript
test('join works', () => {
  expect(model`
    source: x is a extend {
      join_one: b on astr = b.astr
    }
  `).toTranslate();
});
```

### Testing for expected errors:

```typescript
test('unknown field produces error', () => {
  expect(`run: a -> { select: not_a_field }`)
    .toLog(errorMessage(/Unknown field/));
});
```

### Testing error locations:

```typescript
test('error at correct location', () => {
  expect(markSource`run: a -> { select: ${'bad'} }`)
    .toLog(error('unknown-field'));
  // The marked location is automatically verified
});
```

### Testing dialect-specific behavior:

```typescript
test('BigQuery function available on bq_a', () => {
  expect(`run: bq_a -> { select: x is date_from_unix_date(1) }`)
    .toTranslate();
});

test('DuckDB function not available on bq_a', () => {
  expect(`run: bq_a -> { select: x is to_timestamp(1) }`)
    .toLog(errorMessage(/Unknown function/));
});
```

## Exported Utilities

- `TEST_DIALECT` - The default test dialect (`'duckdb'`)
- `getExplore(modelDef, name)` - Extract a source from compiled model
- `getFieldDef(source, name)` - Extract a field definition
- `getQueryFieldDef(segment, name)` - Extract a field from a query segment
- `getQuery(modelDef, name)` - Extract a named query
- `pretty(thing)` - Pretty-print IR for debugging
- `humanify(value)` - Pretty-print IR with location data stripped
