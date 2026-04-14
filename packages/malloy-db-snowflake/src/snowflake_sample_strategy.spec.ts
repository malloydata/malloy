/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {pickSampleStrategy} from './snowflake_connection';

describe('pickSampleStrategy', () => {
  const threshold = 100_000_000;

  test('no probe → best-effort tablesample-then-limit', () => {
    expect(pickSampleStrategy(undefined, threshold)).toBe(
      'tablesample-then-limit'
    );
  });

  test('probe at or below threshold → full-scan-then-sample', () => {
    expect(pickSampleStrategy({bytes: 0, rowCount: 0}, threshold)).toBe(
      'full-scan-then-sample'
    );
    expect(pickSampleStrategy({bytes: threshold, rowCount: 1}, threshold)).toBe(
      'full-scan-then-sample'
    );
  });

  test('probe above threshold → tablesample-only (no unsafe LIMIT fallback)', () => {
    expect(
      pickSampleStrategy({bytes: threshold + 1, rowCount: 1}, threshold)
    ).toBe('tablesample-only');
    expect(
      pickSampleStrategy(
        {bytes: 10_000_000_000, rowCount: 1_000_000_000},
        threshold
      )
    ).toBe('tablesample-only');
  });

  test('threshold=0 forces every probed table into tablesample-only', () => {
    expect(pickSampleStrategy({bytes: 1, rowCount: 1}, 0)).toBe(
      'tablesample-only'
    );
  });
});
