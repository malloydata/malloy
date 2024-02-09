/*

 MIT License

 Copyright (c) 2022 Looker Data Sciences, Inc.

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights
 to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the Software is
 furnished to do so, subject to the following conditions:

 The above copyright notice and this permission notice shall be included in all
 copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 SOFTWARE.

 */
import {FilterModel} from '../../types';
import {stringFilterToString} from './string_filter_to_string';

describe('String filter to string', () => {
  it('returns empty string for a match item with empty value', () => {
    const item: FilterModel = {
      'is': true,
      'id': '1',
      'type': 'match',
      'value': null,
    };
    const result = stringFilterToString(item);
    expect(result).toBe('');
  });

  it('returns quoted empty when set as value for an is (match) node', () => {
    const item: FilterModel = {
      'is': true,
      'id': '1',
      'type': 'match',
      'value': ['empty'],
    };
    const result = stringFilterToString(item);
    expect(result).toBe('"empty"');
  });

  it('returns quoted null when set as value for an is (match) node', () => {
    const item: FilterModel = {
      'is': true,
      'id': '1',
      'type': 'match',
      'value': ['null'],
    };
    const result = stringFilterToString(item);
    expect(result).toBe('"null"');
  });

  describe('when type of filter is `other`', () => {
    describe('and is including', () => {
      it('returns values separated by a comma', () => {
        const item: FilterModel = {
          'is': true,
          'id': '1',
          'type': 'other',
          'value': ['value1', 'value2'],
        };
        const result = stringFilterToString(item);
        expect(result).toBe('value1,value2');
      });
    });

    describe('and is excluding', () => {
      it('returns values separated by a comma and negated', () => {
        const item: FilterModel = {
          'is': false,
          'id': '1',
          'type': 'other',
          'value': ['value1', 'value2'],
        };
        const result = stringFilterToString(item);
        expect(result).toBe('-value1,-value2');
      });
    });
  });
});
