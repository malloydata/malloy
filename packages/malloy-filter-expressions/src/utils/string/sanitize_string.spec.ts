/**
 * Copyright (c) 2023 Google LLC
 * SPDX-License-Identifier: MIT
 */
import {FilterModel} from '../../types';
import {parseFilterExpression} from '../parse_filter_expression';
import {sanitizeString} from './sanitize_string';

describe('Sanitize String tests', () => {
  it('works when switching to startsWith', () => {
    const expression = 'foo';
    const ast = parseFilterExpression('string', expression);
    const item = sanitizeString({...ast, type: 'startsWith'} as FilterModel);
    expect(item.value).toMatchObject(['foo']);
    expect(item.type).toBe('startsWith');
  });

  it('works when switching to match', () => {
    const expression = 'foo';
    const ast = parseFilterExpression('string', expression);
    const item = sanitizeString({...ast, type: 'match'} as FilterModel);
    expect(item.value).toMatchObject(['foo']);
    expect(item.type).toBe('match');
  });
});
