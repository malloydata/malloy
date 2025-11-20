# Week Start Day Implementation

## Overview

The `week_start` parameter allows configuring which day is considered the first day of the week for week truncation operations. This document describes the internal implementation.

## Architecture

The implementation follows the same pattern as `timezone:`, flowing from source definition through to SQL generation.

### Data Flow

1. **Parse**: Grammar recognizes `week_start: <day>` at source or query level
2. **AST**: `WeekStartStatement` validates day name and sets in field space
3. **Model**: `weekStartDay` property propagates through `SourceDef` and `QuerySegment`
4. **Query**: Setting flows to `QueryInfo` passed to dialects
5. **Dialect**: SQL generation adjusts `DATE_TRUNC('week', ...)` based on week start

## Type System

### WeekDay Type

```typescript
export type WeekDay =
  | 'sunday'
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday';
```

### Properties Added

- `SourceDefBase.weekStartDay?: WeekDay`
- `QuerySegment.weekStartDay?: WeekDay`
- `RecordDef.weekStartDay?: WeekDay`
- `RepeatedRecordDef.weekStartDay?: WeekDay`
- `QueryInfo.weekStartDay?: WeekDay`

## Grammar

### Lexer Token

```antlr
WEEK_START: W E E K '_' S T A R T SPACE_CHAR* ':';
```

### Parser Rules

```antlr
weekStartStatement: WEEK_START id;

defExplore
  : ...
  | weekStartStatement  # defExploreWeekStart
  ;

queryProperty
  : ...
  | weekStartStatement
  ;
```

## AST Implementation

### WeekStartStatement

Location: `packages/malloy/src/lang/ast/source-properties/week-start-statement.ts`

Key methods:
- `isValid`: Checks if day name is in `VALID_WEEK_DAYS`
- `normalizedWeekDay`: Returns lowercase day name
- `queryExecute(executeFor)`: Calls `executeFor.resultFS.setWeekStart()`

### Validation

Invalid day names trigger error:
```typescript
this.astError(stmt, 'invalid-week-start', {weekDay: weekDay});
```

Error message in `parse-log.ts`:
```typescript
'invalid-week-start': e =>
  `Invalid week start day: ${e.weekDay}. Must be one of: sunday, monday, ...`
```

## Field Space Integration

### DynamicSpace

```typescript
protected newWeekStart?: model.WeekDay;

setWeekStart(weekDay: model.WeekDay): void {
  this.newWeekStart = weekDay;
}
```

In `structDef()`:
```typescript
if (this.newWeekStart && model.isSourceDef(this.sourceDef)) {
  this.sourceDef.weekStartDay = this.newWeekStart;
}
```

### QuerySpace

In `segment()` creation:
```typescript
if (this.newWeekStart) {
  segment.weekStartDay = this.newWeekStart;
}
```

## Query Propagation

### Source to Query

In `query_query.ts`, default propagation from source to first segment:
```typescript
if (
  isSourceDef(sourceDef) &&
  sourceDef.weekStartDay &&
  isQuerySegment(firstStage) &&
  firstStage.weekStartDay === undefined
) {
  firstStage.weekStartDay = sourceDef.weekStartDay;
}
```

### Nested Queries

Week start propagates to nested queries via `QueryInfo`:
```typescript
const nestedQueryInfo = fi.getQueryInfo();
const weekStartDay = nestedQueryInfo.weekStartDay;
// ...
...(weekStartDay && {weekStartDay}),
```

## Dialect Implementation

### Helper Method

Base `Dialect` class provides:
```typescript
protected getWeekStartOffsetFromMonday(weekStartDay: WeekDay): number {
  const dayOfWeek = {
    monday: 0, tuesday: 1, wednesday: 2, thursday: 3,
    friday: 4, saturday: 5, sunday: 6,
  };
  return dayOfWeek[weekStartDay];
}
```

### sqlTruncate Signature

Updated to accept `QueryInfo`:
```typescript
abstract sqlTruncate(
  expr: string,
  unit: TimestampUnit,
  typeDef: AtomicTypeDef,
  inCivilTime: boolean,
  timezone?: string,
  qi?: QueryInfo  // Added
): string;
```

### Dialect Strategies

#### PostgreSQL, DuckDB, Trino

Interval-based offset:
```typescript
if (unit === 'week') {
  const weekStartDay = qi?.weekStartDay || 'sunday';
  const offsetDays = this.getWeekStartOffsetFromMonday(weekStartDay);
  return `(DATE_TRUNC('week', (${expr} + INTERVAL '${offsetDays}' DAY)) - INTERVAL '${offsetDays}' DAY)`;
}
```

**Why this works**: DATE_TRUNC('week') uses each database's default (Monday for PG/DuckDB). By adding N days before truncating and subtracting N days after, we shift the week boundary.

#### BigQuery (StandardSQL)

Native parameter support:
```typescript
const weekParam = unit.toUpperCase() === 'WEEK' && qi?.weekStartDay
  ? `, ${qi.weekStartDay.toUpperCase()}`
  : '';
return `TIMESTAMP_TRUNC(${expr}, ${unit}${weekParam})`;
```

Generates: `TIMESTAMP_TRUNC(expr, WEEK(MONDAY))`

#### MySQL

DAYOFWEEK arithmetic:
```typescript
if (unit === 'week') {
  const dayNumbers = {sunday: 1, monday: 2, tuesday: 3, ...};
  const targetDayNumber = dayNumbers[weekDay];
  adjustedExpr = `DATE_SUB(${expr}, INTERVAL MOD(DAYOFWEEK(${expr}) - ${targetDayNumber} + 7, 7) DAY)`;
}
```

**Why MOD**: `DAYOFWEEK()` returns 1-7 (Sunday=1). MOD with +7 handles negative offsets.

#### Snowflake

Conditional adjustment (default is Sunday):
```typescript
if (unit === 'week' && qi?.weekStartDay && qi.weekStartDay !== 'sunday') {
  const offsetDays = this.getWeekStartOffsetFromMonday(qi.weekStartDay);
  return `(DATE_TRUNC('week', (${expr} + INTERVAL '${offsetDays}' DAY)) - INTERVAL '${offsetDays}' DAY)`;
}
return `DATE_TRUNC('${unit}', ${expr})`;
```

## Serialization

In `to_stable.ts`, week start serializes as annotation:
```typescript
if (field.weekStartDay) {
  const weekStartTag = Tag.withPrefix('#(malloy) ');
  weekStartTag.set(['week_start_day'], field.weekStartDay);
  weekStartAnnotation = {value: weekStartTag.toString()};
}
```

## Testing

Test file: `test/src/databases/all/week-start.spec.ts`

Coverage:
- Default behavior (Sunday)
- All 7 days
- Source-level configuration
- Query-level override
- Precedence (query > source)
- Invalid day error handling
- Cross-database compatibility

## Precedence Rules

1. Query-level `week_start:` (highest priority)
2. Source-level `week_start:`
3. Database default (no Malloy setting)

Query-level always overrides source-level, following the same pattern as `timezone:`.

## Edge Cases

### No Week Start Specified

Defaults to `'sunday'` in dialect implementations:
```typescript
const weekStartDay = qi?.weekStartDay || 'sunday';
```

### Week Truncation Only

Week start **only affects** `DATE_TRUNC('week', ...)` operations. Other timeframes (day, month, year, quarter) are unaffected.

### Interaction with Timezone

`week_start` and `timezone:` are independent. Both can be set:
```typescript
source: data extend {
  timezone: 'America/New_York'
  week_start: monday
}
```

Week boundaries apply in the active timezone.

## Implementation Notes

### Why Calculate Offset from Monday?

Most databases default to Monday for ISO week standard. Calculating offset from Monday simplifies the math.

### Why Not Set Database Session Variables?

Different approaches for different databases:
- Some lack session-level week start configuration
- SQL-level transformation ensures portability
- Keeps connection state immutable

### Performance Impact

Minimal. The interval arithmetic compiles to simple date operations. BigQuery's native WEEK(WEEKDAY) has zero overhead.

