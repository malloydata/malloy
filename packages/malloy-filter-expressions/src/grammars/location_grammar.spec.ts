/**
 * Copyright (c) 2023 Google LLC
 * SPDX-License-Identifier: MIT
 */
import {parseFilterExpression, summary} from '../utils';

const location = [
  ['36.97, -122.03', '36.97, -122.03'],
  ['-36.97, 122.03', '-36.97, 122.03'],
  ['-36.97, -122.03', '-36.97, -122.03'],
  ['40 miles from -36.97, -122.03', '40 miles from -36.97, -122.03'],
  ['40 miles from 36.97, -122.03', '40 miles from 36.97, -122.03'],
  ['100 miles from 36.97, -122.03', '100 miles from 36.97, -122.03'],
  [
    'inside box from 72.33, -173.14 to 14.39, -61.70',
    '72.3°N, 173.1°W to 14.4°N, 61.7°W',
  ],
  ['', 'is anywhere'],
  ['NOT NULL', 'is not null'],
  ['-NULL', 'is not null'],
  ['NULL', 'is null'],
];

describe('Location grammar can parse expressions', () => {
  it.each(location)('%s', (expression, result) => {
    expect(parseFilterExpression('location', expression)).toMatchSnapshot();
    expect(summary({type: 'location', expression})).toBe(result);
  });
});
