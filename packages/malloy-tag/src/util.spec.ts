/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
import {parseString} from './util';

describe('quote comprehension inside strings', () => {
  test('\\b', () => {
    expect(parseString('\\b')).toEqual('\b');
  });
  test('\\f', () => {
    expect(parseString('\\f')).toEqual('\f');
  });
  test('\\n', () => {
    expect(parseString('\\n')).toEqual('\n');
  });
  test('\\r', () => {
    expect(parseString('\\r')).toEqual('\r');
  });
  test('\\t', () => {
    expect(parseString('\\t')).toEqual('\t');
  });
  test('unicode ?', () => {
    expect(parseString('\\u003f')).toEqual('?');
    expect(parseString('\\u003F')).toEqual('?');
  });
  test('normal stuff', () => {
    expect(parseString('normal stuff')).toEqual('normal stuff');
  });
  test('stuff & nonsense', () => {
    expect(parseString('stuff \\u0026 nonsense')).toEqual('stuff & nonsense');
  });
  test('one thing\\nnext thing', () => {
    expect(parseString('one thing\\nnext thing')).toEqual(
      'one thing\nnext thing'
    );
  });
  test('quote stripping works', () => {
    expect(parseString('|42|', '|')).toEqual('42');
  });
});
