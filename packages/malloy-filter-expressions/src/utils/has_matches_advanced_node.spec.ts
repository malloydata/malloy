/**
 * Copyright (c) 2023 Google LLC
 * SPDX-License-Identifier: MIT
 */
import {parseFilterExpression} from './parse_filter_expression';
import {typeToGrammar} from './type_to_grammar';
import {getMatchesAdvancedNode} from './get_matches_advanced_node';
import {hasMatchesAdvancedNode} from './has_matches_advanced_node';

describe('hasMatchesAdvancedNode', () => {
  it('returns true for a matches advanced date item ', () => {
    const testExpression = 'before last week';
    const type = 'date';
    const {subTypes} = typeToGrammar(type);
    const ast = parseFilterExpression(type, testExpression);
    expect(hasMatchesAdvancedNode(subTypes)(ast)).toBe(true);
  });

  it('returns false for a past node item', () => {
    const testExpression = '3 months';
    const type = 'date';
    const {subTypes} = typeToGrammar(type);
    const ast = parseFilterExpression(type, testExpression);
    expect(hasMatchesAdvancedNode(subTypes)(ast)).toBe(false);
  });

  it('returns true for a matches advanced node', () => {
    const testExpression = '3 months';
    const type = 'date';
    const {subTypes} = typeToGrammar(type);
    const newAST = getMatchesAdvancedNode(testExpression);
    expect(hasMatchesAdvancedNode(subTypes)(newAST)).toBe(true);
  });
});
