/**
 * Copyright (c) 2023 Google LLC
 * SPDX-License-Identifier: MIT
 */

import {getNumberFromString} from './get_number_from_string';

test('it returns a regular number', () => {
  const num = getNumberFromString('1234567890');
  expect(typeof num).toBe('number');
});

test('it returns a bigint for 16 characters or more', () => {
  const bigNum = getNumberFromString('12345678901234567890');
  expect(typeof bigNum).toBe('bigint');
});

test('it returns a regular number if decimal is found', () => {
  const num = getNumberFromString('1234567890.1234567890');
  expect(typeof num).toBe('number');
});
