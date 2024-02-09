/**
 * Copyright (c) 2023 Google LLC
 * SPDX-License-Identifier: MIT
 */
import {parseFilterExpression} from './parse_filter_expression';
import {getMatchesAdvancedNode} from './get_matches_advanced_node';

describe('getsMatchesAdvancedNode', () => {
  it('returns a matches advanced node from an ast', () => {
    const testExpression = '1';
    const ast = parseFilterExpression('string', testExpression);
    const {id, type, expression} = getMatchesAdvancedNode(testExpression, ast);
    expect(expression).toBe(testExpression);
    expect(id).toBe(ast.id);
    expect(type).toBe('matchesAdvanced');
  });

  it('returns a matches advanced node from an expression', () => {
    const testExpression = '1';
    const {id, type, expression} = getMatchesAdvancedNode(testExpression);
    expect(expression).toBe(testExpression);
    expect(id).toBe(1);
    expect(type).toBe('matchesAdvanced');
  });
});
