/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

// The widest exact decimal of the engines this is written for.
const MAX_DIGITS = 38;
// Fractional digits of a value which the sum keeps.
const SCALE = 8;
// Databricks gives the difference of two decimals one more digit than the
// wider of them, and rounds a fractional digit away when that passes
// MAX_DIGITS. A value gets the whole digits that leaves.
const VALUE_WHOLE_DIGITS = MAX_DIGITS - SCALE - 1;

const VALUE_TYPE = `DECIMAL(${VALUE_WHOLE_DIGITS + SCALE},${SCALE})`;
const SHIFTED_TYPE = `DECIMAL(${MAX_DIGITS},0)`;
const SHIFT_UP = `CAST(1${'0'.repeat(SCALE)} AS DECIMAL(${SCALE + 1},0))`;

// SQL for 10^-digits, as a decimal with that many fractional digits.
function shiftDown(digits: number): string {
  return `CAST(0.${'0'.repeat(digits - 1)}1 AS DECIMAL(${digits},${digits}))`;
}

/**
 * The shifty sum: the sum of a value over the distinct rows of a fanned-out
 * join, on an engine whose widest exact number is a 38 digit decimal.
 *
 * The method. A join can repeat a row of the source being summed. SUM(value)
 * would count the repeats, and SUM(DISTINCT value) would also fold two
 * different rows which have the same value. Each row has a key, so its value
 * is added to a hash of that key, which makes the number unique to the row:
 *
 *     SUM(DISTINCT hash + value) - SUM(DISTINCT hash)
 *
 * DISTINCT folds exactly the repeats, which agree in both hash and value, and
 * the subtraction takes the hashes back out. That is right unless two rows
 * have the same hash, or have hashes which differ by exactly the difference
 * of their values. The hash is 92 bits of an MD5, so among n rows the chance
 * of either is about n^2 / 2^93.
 *
 * Why the value is shifted. The arithmetic must be exact, so it is done in
 * DECIMAL. A hash is below 2^92, about 5 * 10^27, and the hashes of 10^10
 * rows can sum to 5 * 10^37. The sum of the hashes needs all 38 digits as
 * whole digits, which leaves none for the fraction of a value. So a value is
 * multiplied by 10^8, which makes an integer of it and keeps 8 of its
 * fractional digits, everything is summed as DECIMAL(38,0), and the result
 * is multiplied by 10^-8.
 *
 * Why the shifts are written as they are. A value can have any numeric type,
 * so it is first cast to DECIMAL(37,8). Arithmetic before that cast would be
 * done in the type of the value, and a 32 bit integer times 10^8 overflows.
 *
 * After the cast, shifting takes decimal products, and these engines differ
 * in what they do with a product which could have more than 38 digits:
 *
 *  - Trino, Presto and Snowflake keep the fractional digits of the operands
 *    and fail when the result does not fit in the digits left over. A
 *    DECIMAL(38,8) value times 10^8 fails once the value reaches 10^22.
 *  - Databricks rounds the result to 6 fractional digits, with no error.
 *
 * Shifting up gives none of them such a product, by shifting the whole part
 * and the fraction of a value separately. The whole part times 10^8 is a
 * product of integers: it has no fractional digit to lose, and fails only
 * when it truly does not fit in 38 digits. The fraction is below 1, so its
 * product is narrow.
 *
 * Shifting down multiplies an integer by 10^-8. Trino, Presto and Snowflake
 * do that exactly. Databricks would round it to 6 fractional digits, so
 * there it is two products: by 10^-6, which has no more fractional digits
 * than Databricks keeps, and then by 10^-2, after a cast narrow enough that
 * the second product cannot pass 38 digits. That cast is what limits a sum
 * to 10^27 on Databricks.
 *
 * Limits.
 *
 *  - A value is rounded to 8 fractional digits, and must then be below 10^29
 *    in magnitude.
 *  - (the number of distinct rows * 2^92) + (the sum of the magnitudes of
 *    the values * 10^8) must be below 10^38. 10^10 rows whose values total
 *    10^29 fit.
 *  - Where `roundsWideProductsTo` is set, the sum must also be below 10^27
 *    in magnitude.
 *
 * Inside the limits the result is exact. Past them a cast or a sum fails
 * with an error, on Trino, Presto and Snowflake and on Databricks in ANSI
 * mode. Snowflake sums a little past 38 digits before it does.
 *
 * The result is an exact decimal with 8 fractional digits, or NULL when
 * there are no rows.
 *
 * @param hashedKey SQL for an integer in [0, 2^92) typed DECIMAL(38,0), the
 *   same for every repeat of a row and different for different rows
 * @param value SQL for a number of any type, or NULL, which counts as 0
 * @param roundsWideProductsTo set for an engine which rounds a decimal
 *   product too wide for 38 digits to this many fractional digits
 */
export function sqlShiftySumDistinct(
  hashedKey: string,
  value: string,
  roundsWideProductsTo?: 6
): string {
  const fixed = `CAST(COALESCE(${value},0) AS ${VALUE_TYPE})`;
  // Whatever sign an engine gives a remainder, the whole part is the value
  // less the fraction, so the two always add back to the value.
  const fraction = `(${fixed} % CAST(1 AS DECIMAL(1,0)))`;
  const whole = `CAST(${fixed} - ${fraction} AS DECIMAL(${VALUE_WHOLE_DIGITS},0))`;
  const shifted = `CAST(${whole} AS ${SHIFTED_TYPE})*${SHIFT_UP} + CAST(CAST(${fraction} AS DECIMAL(${SCALE + 1},${SCALE}))*${SHIFT_UP} AS ${SHIFTED_TYPE})`;
  const shiftedSum = `(SUM(DISTINCT ${hashedKey} + ${shifted}) - SUM(DISTINCT ${hashedKey}))`;
  if (roundsWideProductsTo === undefined) {
    return `CAST(${shiftedSum} * ${shiftDown(SCALE)} AS DECIMAL(${MAX_DIGITS},${SCALE}))`;
  }
  // A product has one more digit than its operands have together, and the
  // second product has to stay within MAX_DIGITS.
  const restOfScale = SCALE - roundsWideProductsTo;
  const partShiftedDigits = MAX_DIGITS - restOfScale - 1;
  const sumWholeDigits = partShiftedDigits - roundsWideProductsTo - restOfScale;
  const partShifted = `CAST(${shiftedSum} * ${shiftDown(roundsWideProductsTo)} AS DECIMAL(${partShiftedDigits},${roundsWideProductsTo}))`;
  return `CAST(${partShifted} * ${shiftDown(restOfScale)} AS DECIMAL(${sumWholeDigits + SCALE},${SCALE}))`;
}
