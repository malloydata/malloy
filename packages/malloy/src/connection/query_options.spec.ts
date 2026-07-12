/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {
  DEFAULT_ROW_LIMIT,
  queryOptionsFromConnectionConfig,
  resolveRunSQLOptions,
  ROW_LIMIT_CONNECTION_PROPERTY,
} from './query_options';

describe('connection query options', () => {
  it('declares the shared rowLimit config property', () => {
    expect(ROW_LIMIT_CONNECTION_PROPERTY).toEqual({
      name: 'rowLimit',
      displayName: 'Default Row Limit',
      type: 'number',
      optional: true,
      advanced: true,
      default: DEFAULT_ROW_LIMIT,
      description:
        'Maximum number of rows returned by this connection unless overridden for an individual query run.',
    });
  });

  it('uses the shared default when connection config omits rowLimit', () => {
    expect(queryOptionsFromConnectionConfig({name: 'test'})).toEqual({
      rowLimit: DEFAULT_ROW_LIMIT,
    });
  });

  it.each([0, 25])('reads connection rowLimit %s', rowLimit => {
    expect(queryOptionsFromConnectionConfig({name: 'test', rowLimit})).toEqual({
      rowLimit,
    });
  });

  it.each(['5', null])(
    'rejects a non-number connection rowLimit %s',
    rowLimit => {
      expect(() =>
        queryOptionsFromConnectionConfig({name: 'test', rowLimit})
      ).toThrow(TypeError);
    }
  );

  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid connection rowLimit %s',
    rowLimit => {
      expect(() =>
        queryOptionsFromConnectionConfig({name: 'test', rowLimit})
      ).toThrow(RangeError);
    }
  );

  it('uses per-run options over configured options', () => {
    expect(resolveRunSQLOptions({rowLimit: 25}, {rowLimit: 5})).toMatchObject({
      rowLimit: 5,
    });
  });

  it('preserves a zero per-run limit', () => {
    expect(resolveRunSQLOptions({rowLimit: 25}, {rowLimit: 0})).toMatchObject({
      rowLimit: 0,
    });
  });

  it('reads a dynamic connection option once per resolution', () => {
    const reader = jest.fn(() => ({rowLimit: 25}));
    expect(resolveRunSQLOptions(reader).rowLimit).toBe(25);
    expect(reader).toHaveBeenCalledTimes(1);
  });

  it('uses the per-run abort signal over the configured signal', () => {
    const configured = new AbortController();
    const perRun = new AbortController();
    expect(
      resolveRunSQLOptions(
        {rowLimit: 25, abortSignal: configured.signal},
        {abortSignal: perRun.signal}
      ).abortSignal
    ).toBe(perRun.signal);
  });

  it.each([
    ['configured', () => resolveRunSQLOptions({rowLimit: '5' as never})],
    [
      'per-run',
      () => resolveRunSQLOptions({rowLimit: 25}, {rowLimit: '5' as never}),
    ],
  ])('rejects a non-number %s rowLimit', (_source, resolve) => {
    expect(resolve).toThrow(TypeError);
  });

  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid configured rowLimit %s',
    rowLimit => {
      expect(() => resolveRunSQLOptions({rowLimit})).toThrow(RangeError);
    }
  );

  it('does not hide an invalid configured value behind a per-run override', () => {
    expect(() => resolveRunSQLOptions({rowLimit: -1}, {rowLimit: 5})).toThrow(
      RangeError
    );
  });
});
