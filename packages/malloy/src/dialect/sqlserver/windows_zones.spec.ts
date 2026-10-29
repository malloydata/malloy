/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {WINDOWS_TIME_ZONES} from './windows_zones';

// The table is generated from CLDR; these pin what a generation must keep.
describe('sqlserver Windows time zone table', () => {
  test('a canonical IANA name', () => {
    expect(WINDOWS_TIME_ZONES['America/Los_Angeles']).toBe(
      'Pacific Standard Time'
    );
  });

  test('a bcp47 alias maps with its canonical name', () => {
    expect(WINDOWS_TIME_ZONES['Asia/Kolkata']).toBe('India Standard Time');
    expect(WINDOWS_TIME_ZONES['Asia/Calcutta']).toBe('India Standard Time');
    expect(WINDOWS_TIME_ZONES['Europe/Kyiv']).toBe(
      WINDOWS_TIME_ZONES['Europe/Kiev']
    );
  });

  test('UTC and its spellings', () => {
    expect(WINDOWS_TIME_ZONES['UTC']).toBe('UTC');
    expect(WINDOWS_TIME_ZONES['Etc/UTC']).toBe('UTC');
  });

  test('no empty or unknown key', () => {
    expect(WINDOWS_TIME_ZONES['']).toBeUndefined();
    expect(WINDOWS_TIME_ZONES['Mars/Olympus_Mons']).toBeUndefined();
  });
});
