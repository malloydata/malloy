/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {QueryMaterializer, LogMessage, Dialect} from '..';
import {API, MalloyError} from '..';
import type {Tag} from '@malloydata/malloy-tag';
import type * as Malloy from '@malloydata/malloy-interfaces';
import {inspect} from 'util';
import {cellsToObjects} from './cellsToObject';
import type {TestModel} from './test-models';

/** Expected row shape for result matching */
export type ExpectedRow = Record<string, unknown>;

/** Options for result matchers */
export interface MatcherOptions {
  debug?: boolean;
}

/** Match mode: partial allows extra fields, exact requires exact fields */
type MatchMode = 'partial' | 'exact';

type JestMatcherResult = {
  pass: boolean;
  message: () => string;
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface Matchers<R> {
      /**
       * Partial matching - extra fields and rows allowed.
       *
       * @example
       * await expect(query).toMatchResult(tm, {name: 'alice'});
       * await expect(query).toMatchResult(tm, {name: 'alice'}, {name: 'bob'});
       */
      toMatchResult(
        tm: TestModel,
        ...rowsOrOptions: (ExpectedRow | MatcherOptions)[]
      ): Promise<R>;

      /**
       * Exact matching - exact fields and exact row count.
       *
       * @example
       * await expect(query).toEqualResult(tm, [{name: 'alice'}]);
       */
      toEqualResult(
        tm: TestModel,
        rows: ExpectedRow[],
        options?: MatcherOptions
      ): Promise<R>;

      /**
       * Partial fields but exact row count.
       *
       * @example
       * await expect(query).toMatchRows(tm, [{name: 'alice'}, {name: 'bob'}]);
       */
      toMatchRows(
        tm: TestModel,
        rows: ExpectedRow[],
        options?: MatcherOptions
      ): Promise<R>;

      /**
       * Check nested values via dotted paths. Takes first element at each array level.
       *
       * @example
       * expect(result.data[0]).toHavePath({'by_state.state': 'TX'});
       */
      toHavePath(paths: Record<string, unknown>): R;
    }
  }
}

interface QueryRunResult {
  fail: JestMatcherResult;
  data: Malloy.Data;
  schema: Malloy.Schema;
  dataObjects: Record<string, unknown>[];
  query: QueryMaterializer;
  queryTestTag: Tag;
}

function errInfo(e: {message?: string; stack?: string}) {
  let err = '';
  const trace = e.stack ?? '';
  if (e.message && !trace.includes(e.message)) {
    err = `ERROR: ${e.message}\n`;
  }
  if (e.stack) {
    err += `STACK: ${e.stack}\n`;
  }
  return err;
}

function errorLogToString(src: string, msgs: LogMessage[]) {
  let lovely = '';
  let lineNo = 0;
  for (const line of src.split('\n')) {
    lovely += `    | ${line}\n`;
    for (const entry of msgs) {
      if (entry.at) {
        if (entry.at.range.start.line === lineNo) {
          const charFrom = entry.at.range.start.character;
          lovely += `!!!!! ${' '.repeat(charFrom)}^ ${entry.message}\n`;
        }
      }
    }
    lineNo += 1;
  }
  return lovely;
}

function looseEqual(a: unknown, b: unknown): boolean {
  if (a === b) {
    return true;
  }
  if (typeof a === 'number' && typeof b === 'bigint') {
    try {
      return BigInt(a) === b;
    } catch {
      return false;
    }
  }
  if (typeof a === 'bigint' && typeof b === 'number') {
    try {
      return a === BigInt(b);
    } catch {
      return false;
    }
  }
  return false;
}

async function runQueryInternal(
  tm: TestModel,
  src: string
): Promise<Partial<QueryRunResult>> {
  let query: QueryMaterializer;
  let queryTestTag: Tag | undefined = undefined;
  try {
    query = tm.model.loadQuery(src);
    const queryTags = (await query.getPreparedQuery()).tagParse().tag;
    queryTestTag = queryTags.tag('test');
  } catch (e) {
    // Add line numbers, helpful if failure is a compiler error
    const queryText = src
      .split('\n')
      .map((line, index) => `${(index + 1).toString().padStart(4)}: ${line}`)
      .join('\n');
    return {
      fail: {
        pass: false,
        message: () =>
          `Could not prepare query to run:\n${queryText}\n\n${errInfo(e)}`,
      },
    };
  }

  try {
    const result = await query.run();
    // Use wrapResult to normalize data across all databases
    // This handles BigQuery timestamp wrappers, MySQL boolean 0/1, etc.
    const malloyResult = API.util.wrapResult(result);
    if (!malloyResult.data) {
      return {
        fail: {pass: false, message: () => 'Query returned no data'},
        query,
      };
    }
    // Return both raw cells+schema (for schema-aware matching) and converted objects (for debug output)
    const dataObjects = cellsToObjects(malloyResult.data, malloyResult.schema);
    return {
      data: malloyResult.data,
      schema: malloyResult.schema,
      dataObjects,
      queryTestTag,
      query,
    };
  } catch (e) {
    const cleanSrc = src.replace(/^\n+/m, '').trimEnd();
    let failMsg = `QUERY RUN FAILED:\n${cleanSrc}`;
    if (e instanceof MalloyError) {
      failMsg = `Error in query compilation\n${errorLogToString(src, e.problems)}`;
    } else {
      try {
        failMsg += `\nSQL: ${await query.getSQL()}\n`;
      } catch {
        failMsg += '\nSQL FOR QUERY COULD NOT BE COMPUTED\n';
      }
      failMsg += errInfo(e);
    }
    return {fail: {pass: false, message: () => failMsg}, query};
  }
}

function humanReadable(thing: unknown): string {
  return inspect(thing, {breakLength: 72, depth: Infinity});
}

/** Structured match result for color-coded error formatting */
interface MatchResult {
  pass: boolean;
  path?: string;
  expected?: string;
  actual?: string;
}

function matchFail(
  path: string,
  expected: unknown,
  actual: unknown
): MatchResult {
  return {
    pass: false,
    path,
    expected: humanReadable(expected),
    actual: humanReadable(actual),
  };
}

function matchFailStr(
  path: string,
  expected: string,
  actual: string
): MatchResult {
  return {pass: false, path, expected, actual};
}

/**
 * Get the type kind from a FieldInfo.
 * Returns undefined for joins and views (which have schemas, not types).
 */
function getTypeKind(
  fieldInfo: Malloy.FieldInfo
): Malloy.AtomicType['kind'] | undefined {
  if (fieldInfo.kind === 'join' || fieldInfo.kind === 'view') {
    return undefined;
  }
  return fieldInfo.type.kind;
}

/**
 * Convert a cell to a plain JS value for error messages.
 */
function cellToValue(cell: Malloy.Cell): unknown {
  switch (cell.kind) {
    case 'null_cell':
      return null;
    case 'string_cell':
      return cell.string_value;
    case 'number_cell':
      return cell.number_value;
    case 'big_number_cell':
      return BigInt(cell.number_value);
    case 'boolean_cell':
      return cell.boolean_value;
    case 'date_cell':
      return cell.date_value;
    case 'timestamp_cell':
      return cell.timestamp_value;
    case 'json_cell':
      return JSON.parse(cell.json_value);
    case 'sql_native_cell':
      return JSON.parse(cell.sql_native_value);
    case 'array_cell':
      return cell.array_value.map(cellToValue);
    case 'record_cell':
      return cell.record_value.map(cellToValue);
    default:
      return `<unknown cell: ${(cell as Malloy.Cell).kind}>`;
  }
}

/**
 * Compare a cell against an expected value.
 * Uses schema type info for intelligent date/timestamp comparison.
 * @param mode - 'partial' allows extra fields in records, 'exact' requires exact match
 */
function matchCell(
  cell: Malloy.Cell,
  fieldInfo: Malloy.FieldInfo,
  expected: unknown,
  path: string,
  dialect: Dialect,
  mode: MatchMode
): MatchResult {
  // Handle null
  if (cell.kind === 'null_cell') {
    if (expected === null) {
      return {pass: true};
    }
    return matchFail(path, expected, null);
  }

  // If expected is null but cell is not null
  if (expected === null) {
    return matchFail(path, null, cellToValue(cell));
  }

  const typeKind = getTypeKind(fieldInfo);

  // Handle date fields with schema-aware comparison
  if (cell.kind === 'date_cell' && typeKind === 'date_type') {
    const actualDateStr = cell.date_value;
    // Extract just the date portion (YYYY-MM-DD) from ISO string
    const actualDate = actualDateStr.split('T')[0];

    if (typeof expected === 'string') {
      // If expected is a date string like 'YYYY-MM-DD', compare directly
      if (/^\d{4}-\d{2}-\d{2}$/.test(expected)) {
        if (actualDate === expected) {
          return {pass: true};
        }
        return matchFailStr(path, expected, actualDate);
      }
      // If expected is a full ISO string, compare as-is
      if (actualDateStr === expected) {
        return {pass: true};
      }
      return matchFailStr(path, expected, actualDateStr);
    }

    if (expected instanceof Date) {
      const actualDateObj = new Date(actualDateStr);
      if (expected.getTime() === actualDateObj.getTime()) {
        return {pass: true};
      }
      return matchFailStr(
        path,
        expected.toISOString(),
        actualDateObj.toISOString()
      );
    }

    return matchFail(path, expected, actualDate);
  }

  // Handle timestamp fields with schema-aware comparison
  if (
    cell.kind === 'timestamp_cell' &&
    (typeKind === 'timestamp_type' || typeKind === 'timestamptz_type')
  ) {
    const actualTsStr = cell.timestamp_value;

    if (typeof expected === 'string') {
      // Compare as timestamps (parse both and compare times)
      const actualDate = new Date(actualTsStr);
      const expectedDate = new Date(expected);
      if (!isNaN(expectedDate.getTime())) {
        if (actualDate.getTime() === expectedDate.getTime()) {
          return {pass: true};
        }
        return matchFailStr(
          path,
          expectedDate.toISOString(),
          actualDate.toISOString()
        );
      }
      // If expected is not a valid date string, compare as strings
      if (actualTsStr === expected) {
        return {pass: true};
      }
      return matchFailStr(path, expected, actualTsStr);
    }

    if (expected instanceof Date) {
      const actualDate = new Date(actualTsStr);
      if (expected.getTime() === actualDate.getTime()) {
        return {pass: true};
      }
      return matchFailStr(
        path,
        expected.toISOString(),
        actualDate.toISOString()
      );
    }

    return matchFail(path, expected, actualTsStr);
  }

  // Handle boolean cells
  if (cell.kind === 'boolean_cell') {
    const actual = cell.boolean_value;
    if (typeof expected === 'boolean') {
      if (actual === expected) {
        return {pass: true};
      }
      return matchFail(path, expected, actual);
    }
    return matchFail(path, expected, actual);
  }

  // Handle string cells
  if (cell.kind === 'string_cell') {
    const actual = cell.string_value;
    if (actual === expected) {
      return {pass: true};
    }
    return matchFail(path, expected, actual);
  }

  // Handle number cells
  if (cell.kind === 'number_cell') {
    let actual: unknown = cell.number_value;
    // Handle simulated booleans (MySQL returns 1/0 for booleans)
    if (
      typeof expected === 'boolean' &&
      dialect.booleanType === 'simulated' &&
      typeof actual === 'number'
    ) {
      actual = actual !== 0;
    }
    if (looseEqual(actual, expected)) {
      return {pass: true};
    }
    return matchFail(path, expected, actual);
  }

  // Handle big number cells
  if (cell.kind === 'big_number_cell') {
    const actual = BigInt(cell.number_value);
    if (looseEqual(actual, expected)) {
      return {pass: true};
    }
    // Also allow matching against string representation of the number
    if (typeof expected === 'string' && expected === cell.number_value) {
      return {pass: true};
    }
    return matchFail(path, expected, actual);
  }

  // Handle JSON cells
  if (cell.kind === 'json_cell') {
    const actual = JSON.parse(cell.json_value);
    return matchValue(actual, expected, path, dialect, mode);
  }

  // Handle SQL native cells
  if (cell.kind === 'sql_native_cell') {
    const actual = JSON.parse(cell.sql_native_value);
    return matchValue(actual, expected, path, dialect, mode);
  }

  // Handle array cells
  if (cell.kind === 'array_cell') {
    if (!Array.isArray(expected)) {
      return matchFailStr(
        path,
        'array',
        `expected non-array: ${humanReadable(expected)}`
      );
    }

    const actualArray = cell.array_value;
    if (actualArray.length !== expected.length) {
      return matchFailStr(
        path,
        `${expected.length} elements`,
        `${actualArray.length} elements`
      );
    }

    // Get element type info
    let elementFieldInfo: Malloy.FieldInfo;
    if (fieldInfo.kind === 'join') {
      // For joins, the schema describes the element type
      elementFieldInfo = fieldInfo;
    } else if (fieldInfo.kind === 'view') {
      // Views have schema but no type
      return matchFailStr(path, 'array type', 'view fieldInfo');
    } else if (fieldInfo.type.kind === 'array_type') {
      elementFieldInfo = {
        kind: 'dimension',
        name: 'element',
        type: fieldInfo.type.element_type,
      };
    } else {
      return matchFailStr(
        path,
        'array type',
        `unexpected type: ${fieldInfo.type.kind}`
      );
    }

    for (let i = 0; i < expected.length; i++) {
      const result = matchCell(
        actualArray[i],
        elementFieldInfo,
        expected[i],
        `${path}[${i}]`,
        dialect,
        mode
      );
      if (!result.pass) {
        return result;
      }
    }
    return {pass: true};
  }

  // Handle record cells (from joins or nested queries)
  if (cell.kind === 'record_cell') {
    if (typeof expected !== 'object' || expected === null) {
      return matchFailStr(
        path,
        'object',
        `expected non-object: ${humanReadable(expected)}`
      );
    }

    // Get field schema based on fieldInfo type
    let fields: readonly {name: string}[];
    let getChildFieldInfo: (i: number) => Malloy.FieldInfo;

    if (fieldInfo.kind === 'join') {
      fields = fieldInfo.schema.fields;
      getChildFieldInfo = i => fieldInfo.schema.fields[i];
    } else if (
      fieldInfo.kind === 'dimension' &&
      fieldInfo.type.kind === 'record_type'
    ) {
      const recordType = fieldInfo.type;
      fields = recordType.fields;
      getChildFieldInfo = i => ({
        kind: 'dimension' as const,
        name: recordType.fields[i].name,
        type: recordType.fields[i].type,
      });
    } else {
      return matchFailStr(
        path,
        'record type',
        `unexpected fieldInfo: ${fieldInfo.kind}`
      );
    }

    // Build a map of field names to indices
    const fieldIndexMap = new Map<string, number>();
    for (let i = 0; i < fields.length; i++) {
      fieldIndexMap.set(fields[i].name, i);
    }

    const expectedObj = expected as Record<string, unknown>;

    // For exact mode, check that keys match exactly
    if (mode === 'exact') {
      const expectedKeys = Object.keys(expectedObj).sort();
      const actualKeys = fields.map(f => f.name).sort();

      for (const key of actualKeys) {
        if (!expectedKeys.includes(key)) {
          return matchFailStr(
            path,
            `no field '${key}'`,
            `unexpected field '${key}'`
          );
        }
      }
      for (const key of expectedKeys) {
        if (!actualKeys.includes(key)) {
          return matchFailStr(path, `field '${key}'`, `missing field '${key}'`);
        }
      }
    }

    // Check expected keys
    for (const [key, expectedValue] of Object.entries(expectedObj)) {
      const fieldIndex = fieldIndexMap.get(key);
      if (fieldIndex === undefined) {
        return matchFailStr(
          path,
          `field '${key}'`,
          'field not found in schema'
        );
      }
      const childCell = cell.record_value[fieldIndex];
      const childFieldInfo = getChildFieldInfo(fieldIndex);
      const result = matchCell(
        childCell,
        childFieldInfo,
        expectedValue,
        `${path}.${key}`,
        dialect,
        mode
      );
      if (!result.pass) {
        return result;
      }
    }
    return {pass: true};
  }

  // Fallback for unknown cell types
  return matchFailStr(
    path,
    humanReadable(expected),
    `unknown cell kind: ${cell.kind}`
  );
}

/**
 * Compare two plain values.
 * Used for JSON/SQL native values that have already been parsed.
 * @param mode - 'partial' allows extra fields in objects, 'exact' requires exact match
 */
function matchValue(
  actual: unknown,
  expected: unknown,
  path: string,
  dialect: Dialect,
  mode: MatchMode
): MatchResult {
  // Handle null
  if (expected === null) {
    if (actual === null) {
      return {pass: true};
    }
    return matchFail(path, null, actual);
  }

  // Handle primitives
  if (
    typeof expected === 'string' ||
    typeof expected === 'number' ||
    typeof expected === 'boolean' ||
    typeof expected === 'bigint'
  ) {
    if (looseEqual(actual, expected)) {
      return {pass: true};
    }
    return matchFail(path, expected, actual);
  }

  // Handle Date objects
  if (expected instanceof Date) {
    if (actual === null) {
      return matchFailStr(path, expected.toISOString(), 'null');
    }
    let actualDate: Date;
    if (actual instanceof Date) {
      actualDate = actual;
    } else if (typeof actual === 'string') {
      actualDate = new Date(actual);
      if (isNaN(actualDate.getTime())) {
        return matchFailStr(
          path,
          expected.toISOString(),
          `'${actual}' (not a valid date)`
        );
      }
    } else {
      return matchFailStr(path, expected.toISOString(), humanReadable(actual));
    }
    if (expected.getTime() === actualDate.getTime()) {
      return {pass: true};
    }
    return matchFailStr(path, expected.toISOString(), actualDate.toISOString());
  }

  // Handle arrays
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual)) {
      return matchFailStr(
        path,
        `array with ${expected.length} elements`,
        `${typeof actual}`
      );
    }
    if (actual.length !== expected.length) {
      return matchFailStr(
        path,
        `${expected.length} elements`,
        `${actual.length} elements`
      );
    }
    for (let i = 0; i < expected.length; i++) {
      const result = matchValue(
        actual[i],
        expected[i],
        `${path}[${i}]`,
        dialect,
        mode
      );
      if (!result.pass) {
        return result;
      }
    }
    return {pass: true};
  }

  // Handle objects
  if (typeof expected === 'object') {
    if (
      typeof actual !== 'object' ||
      actual === null ||
      Array.isArray(actual)
    ) {
      return matchFailStr(path, 'object', humanReadable(actual));
    }

    const expectedKeys = Object.keys(expected).sort();
    const actualKeys = Object.keys(actual as Record<string, unknown>).sort();

    // For exact mode, check that keys match exactly
    if (mode === 'exact') {
      for (const key of actualKeys) {
        if (!expectedKeys.includes(key)) {
          return matchFailStr(
            path,
            `no field '${key}'`,
            `unexpected field '${key}'`
          );
        }
      }
      for (const key of expectedKeys) {
        if (!actualKeys.includes(key)) {
          return matchFailStr(path, `field '${key}'`, `missing field '${key}'`);
        }
      }
    }

    for (const [key, value] of Object.entries(expected)) {
      const actualValue = (actual as Record<string, unknown>)[key];
      const result = matchValue(
        actualValue,
        value,
        `${path}.${key}`,
        dialect,
        mode
      );
      if (!result.pass) {
        return result;
      }
    }
    return {pass: true};
  }

  return matchFailStr(
    path,
    'supported type',
    `unsupported: ${typeof expected}`
  );
}

/**
 * Check if last argument is an options object.
 */
function isOptions(arg: unknown): arg is MatcherOptions {
  if (typeof arg !== 'object' || arg === null) {
    return false;
  }
  const keys = Object.keys(arg);
  // Options object only has 'debug' key
  return keys.length === 1 && keys[0] === 'debug';
}

/**
 * Shared implementation for all result matching.
 * @param mode - 'partial' for toMatchResult/toMatchRows, 'exact' for toEqualResult
 * @param strictRowCount - If true, requires exact row count match
 */
async function matchImpl(
  querySrc: string,
  tm: TestModel,
  expectedRows: ExpectedRow[],
  options: MatcherOptions,
  mode: MatchMode,
  strictRowCount: boolean,
  jestUtils: {
    EXPECTED_COLOR: (s: string) => string;
    RECEIVED_COLOR: (s: string) => string;
  }
): Promise<JestMatcherResult> {
  querySrc = querySrc.trimEnd().replace(/^\n*/, '');
  const {fail, data, schema, dataObjects, queryTestTag, query} =
    await runQueryInternal(tm, querySrc);
  if (fail) return fail;
  if (!data || !schema || !dataObjects) {
    return {
      pass: false,
      message: () => 'runQuery returned no data and no errors',
    };
  }

  const fails: string[] = [];
  const debug = options.debug || queryTestTag?.has('debug');

  // Data is an array_cell containing record_cells
  if (data.kind !== 'array_cell') {
    return {
      pass: false,
      message: () => `Expected array_cell at root, got ${data.kind}`,
    };
  }

  const rows = data.array_value;

  // Create root fieldInfo for schema navigation
  const rootFieldInfo: Malloy.FieldInfoWithJoin = {
    kind: 'join',
    name: 'root',
    relationship: 'one',
    schema,
  };

  // Collect row-level issues for unified output
  const rowCountMismatch =
    strictRowCount && rows.length !== expectedRows.length
      ? `Expected ${expectedRows.length} rows, got ${rows.length}`
      : !strictRowCount &&
          expectedRows.length > 0 &&
          rows.length < expectedRows.length
        ? `Expected at least ${expectedRows.length} rows, got ${rows.length}`
        : null;

  // Track per-row mismatches: row index -> list of field issues
  const rowIssues: Map<number, string[]> = new Map();

  // Check empty match {} means "at least one row"
  if (
    mode === 'partial' &&
    expectedRows.length === 1 &&
    Object.keys(expectedRows[0]).length === 0
  ) {
    if (rows.length === 0) {
      fails.push('Expected at least one row, got 0');
    }
  } else {
    // Compare each expected row using schema-aware cell matching
    const rowsToCheck = Math.min(rows.length, expectedRows.length);
    for (let i = 0; i < rowsToCheck; i++) {
      const matchResult = matchCell(
        rows[i],
        rootFieldInfo,
        expectedRows[i],
        `Row ${i}`,
        tm.dialect,
        mode
      );
      if (!matchResult.pass) {
        // Extract field name from path like "Row 0.fieldname" or "Row 0.nested.field"
        const pathMatch = matchResult.path?.match(/^Row \d+\.(.+)$/);
        const fieldPath = pathMatch ? pathMatch[1] : matchResult.path;
        const issue = jestUtils.EXPECTED_COLOR(
          `    Expected ${fieldPath}: ${matchResult.expected}`
        );
        if (!rowIssues.has(i)) {
          rowIssues.set(i, []);
        }
        rowIssues.get(i)!.push(issue);
      }
    }
  }

  // Build DATA DIFFERENCES section if there are any issues
  if (rowCountMismatch || rowIssues.size > 0) {
    const diffLines: string[] = ['DATA DIFFERENCES'];
    if (rowCountMismatch) {
      diffLines.push(`  ${rowCountMismatch}`);
    }
    // Show each row with its issues
    const maxRowToShow = Math.max(rows.length, expectedRows.length);
    for (let i = 0; i < maxRowToShow; i++) {
      if (i < rows.length) {
        const rowData = humanReadable(dataObjects[i]);
        const issues = rowIssues.get(i);
        const isExtra = i >= expectedRows.length;
        if (issues || isExtra) {
          // Red if there are issues or it's an extra row (use ! for non-colored output)
          diffLines.push(jestUtils.RECEIVED_COLOR(`  ${i}! ${rowData}`));
          if (issues) {
            for (const issue of issues) {
              diffLines.push(issue);
            }
          }
        } else {
          // Row matched - green
          diffLines.push(jestUtils.EXPECTED_COLOR(`  ${i}: ${rowData}`));
        }
      } else {
        // Missing row - show what was expected (use ! for non-colored output)
        diffLines.push(jestUtils.RECEIVED_COLOR(`  ${i}! (missing)`));
        if (i < expectedRows.length) {
          diffLines.push(
            jestUtils.EXPECTED_COLOR(
              `    Expected: ${humanReadable(expectedRows[i])}`
            )
          );
        }
      }
    }
    fails.push(diffLines.join('\n'));
  }

  if (debug && fails.length === 0) {
    fails.push('Test forced failure (# test.debug)');
    fails.push(
      jestUtils.RECEIVED_COLOR(`Result: ${humanReadable(dataObjects)}`)
    );
  }

  if (fails.length > 0) {
    if (debug) {
      fails.unshift(`Result Data: ${humanReadable(dataObjects)}`);
    }
    const fromSQL = query
      ? 'SQL Generated:\n  ' + (await query.getSQL()).split('\n').join('\n  ')
      : 'SQL Missing';
    const failMsg = `QUERY:\n${querySrc}\n\n${fromSQL}\n\n${fails.join('\n')}`;
    return {pass: false, message: () => failMsg};
  }

  return {
    pass: true,
    message: () =>
      mode === 'exact'
        ? 'All rows matched expected results exactly'
        : 'All rows matched expected results',
  };
}

expect.extend({
  async toMatchResult(
    querySrc: string,
    tm: TestModel,
    ...rowsOrOptions: (ExpectedRow | MatcherOptions)[]
  ): Promise<JestMatcherResult> {
    // Parse args - last might be options
    let options: MatcherOptions = {};
    let expectedRows: ExpectedRow[];

    if (
      rowsOrOptions.length > 0 &&
      isOptions(rowsOrOptions[rowsOrOptions.length - 1])
    ) {
      options = rowsOrOptions[rowsOrOptions.length - 1] as MatcherOptions;
      expectedRows = rowsOrOptions.slice(0, -1) as ExpectedRow[];
    } else {
      expectedRows = rowsOrOptions as ExpectedRow[];
    }

    return matchImpl(
      querySrc,
      tm,
      expectedRows,
      options,
      'partial',
      false,
      this.utils
    );
  },

  async toMatchRows(
    querySrc: string,
    tm: TestModel,
    expectedRows: ExpectedRow[],
    options: MatcherOptions = {}
  ): Promise<JestMatcherResult> {
    return matchImpl(
      querySrc,
      tm,
      expectedRows,
      options,
      'partial',
      true,
      this.utils
    );
  },

  async toEqualResult(
    querySrc: string,
    tm: TestModel,
    expectedRows: ExpectedRow[],
    options: MatcherOptions = {}
  ): Promise<JestMatcherResult> {
    return matchImpl(
      querySrc,
      tm,
      expectedRows,
      options,
      'exact',
      true,
      this.utils
    );
  },

  /**
   * Navigate a dotted path through an object, taking the first element of arrays.
   * For path 'a.b.c', navigates: obj -> obj.a (or obj.a[0] if array) -> .b -> .c
   */
  toHavePath(
    received: Record<string, unknown>,
    paths: Record<string, unknown>
  ): JestMatcherResult {
    const fails: string[] = [];

    for (const [path, expected] of Object.entries(paths)) {
      const segments = path.split('.');
      let current: unknown = received;

      for (const segment of segments) {
        if (current === null || current === undefined) {
          fails.push(`Path '${path}': cannot navigate through null/undefined`);
          break;
        }
        // If current is an array, take first element then access property
        if (Array.isArray(current)) {
          if (current.length === 0) {
            fails.push(`Path '${path}': empty array at '${segment}'`);
            current = undefined;
            break;
          }
          current = current[0];
        }
        if (typeof current === 'object' && current !== null) {
          current = (current as Record<string, unknown>)[segment];
        } else {
          fails.push(
            `Path '${path}': cannot access '${segment}' on ${typeof current}`
          );
          current = undefined;
          break;
        }
      }

      // Final value might be in an array too
      if (Array.isArray(current) && current.length > 0) {
        current = current[0];
      }

      if (!looseEqual(current, expected)) {
        fails.push(`Path '${path}':`);
        fails.push(
          this.utils.EXPECTED_COLOR(`  Expected: ${humanReadable(expected)}`)
        );
        fails.push(
          this.utils.RECEIVED_COLOR(`  Received: ${humanReadable(current)}`)
        );
      }
    }

    if (fails.length > 0) {
      return {
        pass: false,
        message: () => fails.join('\n'),
      };
    }

    return {
      pass: true,
      message: () => 'All paths matched expected values',
    };
  },
});
