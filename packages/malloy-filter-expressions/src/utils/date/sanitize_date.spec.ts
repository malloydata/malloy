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
import {parseFilterExpression} from '../parse_filter_expression';
import {FilterModel} from '../../types';
import {sanitizeDate} from './sanitize_date';

const type = 'date';

const parse = (expression: string) => parseFilterExpression(type, expression);

describe('Sanitize Date Test', () => {
  const expression = '2018/01/01';

  it('works when switching to year ' + expression, () => {
    const ast = parse(expression);
    const item = sanitizeDate({...ast, type: 'year'} as FilterModel);
    expect(item.type).toBe('year');
    expect(item.year).not.toBeNull();
  });

  it('works when switching to this ' + expression, () => {
    const ast = parse(expression);
    const item = sanitizeDate({...ast, type: 'this'} as FilterModel);

    expect(item.year).not.toBeNull();
    expect(item.type).toBe('this');
  });
  it('works when switching to past ' + expression, () => {
    const ast = parse(expression);
    const item = sanitizeDate({...ast, type: 'past'} as FilterModel);
    expect(item.type).toBe('past');
  });
  it('works when switching to before ' + expression, () => {
    const ast = parse(expression);
    const item = sanitizeDate({...ast, type: 'before'} as FilterModel);
    expect(item.type).toBe('before');
    expect(item.range).toBe('relative');
    expect(item.unit).toBe('month');
  });
  it('works when switching to range ' + expression, () => {
    const ast = parse(expression);
    const item = sanitizeDate({...ast, type: 'range'} as FilterModel);
    expect(item.type).toBe('range');
  });
  it('works when switching to null ' + expression, () => {
    const ast = parse(expression);
    const item = sanitizeDate({...ast, type: 'null'} as FilterModel);
    expect(item.type).toBe('null');
  });
  it('works when switching to anytime ' + expression, () => {
    const ast = parse(expression);
    const item = sanitizeDate({...ast, type: 'anytime'} as FilterModel);
    expect(item.type).toBe('anytime');
  });
  it('works when switching to month ' + expression, () => {
    const ast = parse(expression);
    const item = sanitizeDate({...ast, type: 'month'} as FilterModel);

    expect(item.year).not.toBeNull();

    expect(item.month).not.toBeNull();
    expect(item.type).toBe('month');
  });
  it('works when switching to on ' + expression, () => {
    const ast = parse(expression);
    const item = sanitizeDate({...ast, type: 'on'} as FilterModel);
    expect(item.type).toBe('on');
    expect(item.date).not.toBeNull();
  });
  it('works when switching to relative ' + expression, () => {
    const ast = parse(expression);
    const item = sanitizeDate({...ast, type: 'relative'} as FilterModel);
    expect(item.type).toBe('relative');
  });

  it('works when switching to thisRange ' + expression, () => {
    const ast = parse(expression);
    const item = sanitizeDate({...ast, type: 'thisRange'} as FilterModel);
    expect(item.type).toBe('thisRange');
  });

  it('works when switching to matchesAdvanced ' + expression, () => {
    const ast = parse(expression);
    const item = sanitizeDate({
      ...ast,
      type: 'matchesAdvanced',
    } as FilterModel);
    expect(item.type).toBe('matchesAdvanced');
  });
});
