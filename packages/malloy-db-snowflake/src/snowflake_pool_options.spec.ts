/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {buildPoolOptions} from './snowflake_pool_options';

describe('buildPoolOptions', () => {
  it('returns undefined when no pool fields are supplied', () => {
    expect(buildPoolOptions({})).toBeUndefined();
  });

  it('forwards a single supplied field and leaves others absent', () => {
    expect(buildPoolOptions({poolMax: 20})).toEqual({max: 20});
  });

  it('forwards all three fields when supplied', () => {
    expect(
      buildPoolOptions({poolMin: 2, poolMax: 20, poolTestOnBorrow: false})
    ).toEqual({min: 2, max: 20, testOnBorrow: false});
  });

  it('treats poolTestOnBorrow: false as a real value, not a default', () => {
    // false is falsy; guard against a `||` regression that would drop it.
    expect(buildPoolOptions({poolTestOnBorrow: false})).toEqual({
      testOnBorrow: false,
    });
  });

  it('treats poolMin: 0 as a real value, not a default', () => {
    // 0 is falsy; guard against a `||` regression that would drop it.
    expect(buildPoolOptions({poolMin: 0})).toEqual({min: 0});
  });

  it('drops fields with the wrong type rather than coercing them', () => {
    expect(
      buildPoolOptions({
        poolMin: '2',
        poolMax: null,
        poolTestOnBorrow: 'yes',
      })
    ).toBeUndefined();
  });

  it('keeps valid fields when other fields are wrong-typed', () => {
    expect(
      buildPoolOptions({
        poolMin: 2,
        poolMax: 'oops',
      })
    ).toEqual({min: 2});
  });
});
