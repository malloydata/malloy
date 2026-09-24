/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {FieldDef} from '@malloydata/malloy';
import {resultRowToQueryRecord} from './result-to-querydata';

const identity = (data: unknown) => data as unknown[];

describe('resultRowToQueryRecord', () => {
  it('hands a sql native value on as the driver decoded it', () => {
    const columns: FieldDef[] = [
      {name: 'm', type: 'sql native', rawType: 'map(varchar, integer)'},
      {name: 'j', type: 'sql native', rawType: 'json'},
    ];
    expect(
      resultRowToQueryRecord(columns, [{k: 1}, [1, null]], identity)
    ).toEqual({m: {k: 1}, j: [1, null]});
  });

  it('keeps null a null for every type', () => {
    const columns: FieldDef[] = [
      {name: 'm', type: 'sql native', rawType: 'map(varchar, integer)'},
      {name: 'n', type: 'number', numberType: 'integer'},
      {name: 't', type: 'timestamp'},
    ];
    expect(
      resultRowToQueryRecord(columns, [null, null, null], identity)
    ).toEqual({
      m: null,
      n: null,
      t: null,
    });
  });

  it('still reads a decimal string as a number and a timestamp string as UTC', () => {
    const columns: FieldDef[] = [
      {name: 'd', type: 'number', numberType: 'float'},
      {name: 't', type: 'timestamp'},
    ];
    expect(
      resultRowToQueryRecord(
        columns,
        ['1.50', '2024-01-02 03:04:05.678'],
        identity
      )
    ).toEqual({d: 1.5, t: new Date('2024-01-02T03:04:05.678Z')});
  });
});
