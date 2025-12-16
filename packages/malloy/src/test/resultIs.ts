/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

/**
 * Result matcher for explicit type comparisons in test assertions.
 * Used when comparing result values that need special handling
 * (dates, booleans, timestamps, bigints).
 *
 * Note: With the new malloy-interfaces API, data is already normalized:
 * - Booleans are always boolean (not MySQL 0/1)
 * - Timestamps are ISO strings
 * - Dates are ISO strings (but we extract just the date portion for comparison)
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
 *     active: resultIs.bool(true)
 *   });
 */
export const resultIs = {
  /**
   * Match a date value.
   * Compares as date strings (YYYY-MM-DD format).
   * The actual value is an ISO string from which we extract just the date portion.
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

        if (actual === null) {
          return {
            pass: false,
            expected: expected,
            actual: 'null',
          };
        }

        if (typeof actual !== 'string') {
          return {
            pass: false,
            expected: expected,
            actual: `non-string: ${String(actual)}`,
          };
        }

        // Extract date portion from ISO string (e.g., "2024-01-01T00:00:00.000Z" -> "2024-01-01")
        const actualDate = actual.split('T')[0];

        return {
          pass: actualDate === expected,
          expected: expected,
          actual: actualDate,
        };
      },
    };
  },

  /**
   * Match a boolean value.
   * With the normalized API, booleans are always true boolean values.
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

        if (actual === null) {
          return {
            pass: false,
            expected: String(expected),
            actual: 'null',
          };
        }

        if (typeof actual !== 'boolean') {
          return {
            pass: false,
            expected: String(expected),
            actual: `non-boolean: ${String(actual)}`,
          };
        }

        return {
          pass: actual === expected,
          expected: String(expected),
          actual: String(actual),
        };
      },
    };
  },

  /**
   * Match a timestamp value.
   * With the normalized API, timestamps are ISO strings.
   * Accepts string or Date for expected value, allowing tests to express
   * expectations in their natural timezone.
   *
   * @example
   * // Express expected time in Mexico City timezone
   * const zone_2020 = DateTime.fromObject({year: 2020, month: 2, day: 20}, {zone: 'America/Mexico_City'});
   * await expect(query).toMatchResult(tm, {
   *   mex_220: resultIs.timestamp(zone_2020.toJSDate())
   * });
   */
  timestamp(expected: string | Date | null): ResultMatcher {
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
            expected:
              expected instanceof Date ? expected.toISOString() : expected,
            actual: 'null',
          };
        }

        if (typeof actual !== 'string') {
          return {
            pass: false,
            expected:
              expected instanceof Date ? expected.toISOString() : expected,
            actual: `non-string: ${String(actual)}`,
          };
        }

        // Parse both into Date objects for precise comparison
        const expectedDate =
          expected instanceof Date ? expected : new Date(expected);
        const actualDate = new Date(actual);

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
