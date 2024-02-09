/**
 * Copyright (c) 2023 Google LLC
 * SPDX-License-Identifier: MIT
 */
import {parseFilterExpression} from '../parse_filter_expression';
import {FilterModel} from '../../types';
import {sanitizeNumber} from './sanitize_number';

describe('Number To String', () => {
  const expression = '1,2,3';

  it('works when switching to > ' + expression, () => {
    const ast = parseFilterExpression('number', expression);
    const item = sanitizeNumber({...ast, type: '>'} as FilterModel);
    expect(item.value).toMatchObject([1]);
  });

  it('works when switching to null ' + expression, () => {
    const ast = parseFilterExpression('number', expression);
    const {id, is} = ast;
    const expected = {id, type: 'null', is};
    const item = sanitizeNumber({...ast, type: 'null'} as FilterModel);
    expect(item).toMatchObject(expected);
  });

  it('works when switching to between ' + expression, () => {
    const ast = parseFilterExpression('number', expression);
    const {id, is} = ast;
    const expected = {id, type: 'between', is, bounds: '[]', low: 1, high: 1};
    const item = sanitizeNumber({...ast, type: 'between'} as FilterModel);
    expect(item).toMatchObject(expected);
  });

  it('works when switching to matchesAdvanced ' + expression, () => {
    const ast = parseFilterExpression('number', expression);
    const {id, is} = ast;
    const expected = {id, type: 'matchesAdvanced', is, value: [1, 2, 3]};
    const item = sanitizeNumber({
      ...ast,
      type: 'matchesAdvanced',
    } as FilterModel);
    expect(item).toMatchObject(expected);
  });

  it('works when switching from between to = ' + expression, () => {
    const ast = parseFilterExpression('number', '(1,100)');
    const {id, is} = ast;
    const expected = {id, type: '=', is, value: []};
    const item = sanitizeNumber({...ast, type: '='} as FilterModel);
    expect(item).toMatchObject(expected);
  });

  it('works when switching from between types with value 0', () => {
    const ast = parseFilterExpression('number', '>0');
    const {id, is} = ast;
    const expected = {id, type: '<', is, value: [0]};
    const item = sanitizeNumber({...ast, type: '<'} as FilterModel);
    expect(item).toMatchObject(expected);
  });
});
