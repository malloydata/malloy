/*
 * Copyright 2023 Google LLC
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files
 * (the "Software"), to deal in the Software without restriction,
 * including without limitation the rights to use, copy, modify, merge,
 * publish, distribute, sublicense, and/or sell copies of the Software,
 * and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import './parse-expects';
import {parseString} from '../string-parser';

describe('test internal string parsing', () => {
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
