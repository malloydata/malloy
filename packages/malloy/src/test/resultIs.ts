/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

/**
 * Result matcher for explicit type comparisons in test assertions.
 * Used when comparing result values that need special handling
 * (dates, booleans from MySQL 0/1, timestamps, bigints).
 */
export interface ResultMatcher {
  __resultMatcher: true;
  match(actual: unknown): {pass: boolean; expected: string; actual: string};
}

/**
 * Check if a value is a ResultMatcher.
 */
export function isResultMatcher(value: unknown): value is ResultMatcher {
  return (
    value !== null &&
    typeof value === 'object' &&
    '__resultMatcher' in value &&
    (value as ResultMatcher).__resultMatcher === true
  );
}

/**
 * Result type matchers for explicit type comparisons.
 * Use these when you need specific type handling in result assertions.
 *
 * @example
 * import { resultIs } from '@malloydata/malloy/test';
 *
 * await expect('run: users -> { select: created, active }')
 *   .toMatchResult(tm, {
 *     created: resultIs.date('2024-01-01'),
 *     active: resultIs.bool(true)  // handles MySQL 0/1
 *   });
 */
export const resultIs = {
  /**
   * Match a date value.
   * Compares as date strings (YYYY-MM-DD format).
   * Handles Date objects by extracting just the date portion.
   */
  date(expected: string | null): ResultMatcher {
    return {
      __resultMatcher: true,
      match(actual: unknown) {
        if (expected === null) {
          return {
            pass: actual === null,
            expected: 'null',
            actual: String(actual),
          };
        }

        let actualStr: string;
        if (actual instanceof Date) {
          // Extract date portion in UTC
          actualStr = actual.toISOString().split('T')[0];
        } else if (typeof actual === 'string') {
          // If it's already a string, use it directly
          actualStr = actual.split('T')[0];
        } else if (actual === null) {
          return {
            pass: false,
            expected: expected,
            actual: 'null',
          };
        } else {
          return {
            pass: false,
            expected: expected,
            actual: `non-date: ${String(actual)}`,
          };
        }

        return {
          pass: actualStr === expected,
          expected: expected,
          actual: actualStr,
        };
      },
    };
  },

  /**
   * Match a boolean value.
   * Handles MySQL's 0/1 representation of booleans.
   */
  bool(expected: boolean | null): ResultMatcher {
    return {
      __resultMatcher: true,
      match(actual: unknown) {
        if (expected === null) {
          return {
            pass: actual === null,
            expected: 'null',
            actual: String(actual),
          };
        }

        let actualBool: boolean;
        if (typeof actual === 'boolean') {
          actualBool = actual;
        } else if (typeof actual === 'number') {
          // MySQL returns 0/1 for booleans
          actualBool = actual !== 0;
        } else if (actual === null) {
          return {
            pass: false,
            expected: String(expected),
            actual: 'null',
          };
        } else {
          return {
            pass: false,
            expected: String(expected),
            actual: `non-boolean: ${String(actual)}`,
          };
        }

        return {
          pass: actualBool === expected,
          expected: String(expected),
          actual: String(actualBool),
        };
      },
    };
  },

  /**
   * Match a timestamp value.
   * Compares as timestamp strings or Date objects.
   */
  timestamp(expected: string | null): ResultMatcher {
    return {
      __resultMatcher: true,
      match(actual: unknown) {
        if (expected === null) {
          return {
            pass: actual === null,
            expected: 'null',
            actual: String(actual),
          };
        }

        if (actual === null) {
          return {
            pass: false,
            expected: expected,
            actual: 'null',
          };
        }

        // Parse expected into a Date for comparison
        const expectedDate = new Date(expected);
        let actualDate: Date;

        if (actual instanceof Date) {
          actualDate = actual;
        } else if (typeof actual === 'string') {
          actualDate = new Date(actual);
        } else {
          return {
            pass: false,
            expected: expected,
            actual: `non-timestamp: ${String(actual)}`,
          };
        }

        // Compare using getTime() for precise comparison
        const pass = expectedDate.getTime() === actualDate.getTime();
        return {
          pass,
          expected: expectedDate.toISOString(),
          actual: actualDate.toISOString(),
        };
      },
    };
  },

  /**
   * Match a bigint value.
   * Handles both bigint and number types.
   */
  bigint(expected: bigint | number | null): ResultMatcher {
    return {
      __resultMatcher: true,
      match(actual: unknown) {
        if (expected === null) {
          return {
            pass: actual === null,
            expected: 'null',
            actual: String(actual),
          };
        }

        if (actual === null) {
          return {
            pass: false,
            expected: String(expected),
            actual: 'null',
          };
        }

        const expectedBigInt =
          typeof expected === 'bigint' ? expected : BigInt(expected);

        let actualBigInt: bigint;
        if (typeof actual === 'bigint') {
          actualBigInt = actual;
        } else if (typeof actual === 'number') {
          actualBigInt = BigInt(actual);
        } else if (typeof actual === 'string') {
          try {
            actualBigInt = BigInt(actual);
          } catch {
            return {
              pass: false,
              expected: String(expectedBigInt),
              actual: `non-bigint: ${actual}`,
            };
          }
        } else {
          return {
            pass: false,
            expected: String(expectedBigInt),
            actual: `non-bigint: ${String(actual)}`,
          };
        }

        return {
          pass: actualBigInt === expectedBigInt,
          expected: String(expectedBigInt),
          actual: String(actualBigInt),
        };
      },
    };
  },
};
