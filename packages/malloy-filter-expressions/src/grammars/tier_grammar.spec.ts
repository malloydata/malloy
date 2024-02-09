/**
 * Copyright (c) 2023 Google LLC
 * SPDX-License-Identifier: MIT
 */
import {GrammarTestItem} from '.';
import {
  convertTypeToOption,
  parseFilterExpression,
  summary,
  treeToList,
} from '../utils';
import {tierFilterToString} from '../utils/tier/tier_filter_to_string';
import {tierGrammarTestItems} from './tier_grammar_test_expressions';

const filterType = 'tier';
const testStringItem = (testItem: GrammarTestItem) => {
  test(`${testItem['expression']}`, () => {
    const {expression, type, describe, output} = testItem;
    const ast = parseFilterExpression(filterType, expression);
    const description = summary({type: filterType, expression});
    expect(ast).toMatchSnapshot();
    const list = treeToList(ast);
    const item = list[0];

    const itemType =
      type === 'matchesAdvanced' ? item.type : convertTypeToOption(item);
    expect(itemType).toEqual(type);

    // test descriptions
    expect(description).toBe(describe);

    // test output
    const stringOutput =
      type === 'matchesAdvanced'
        ? expression
        : tierFilterToString(ast, filterType);
    expect(stringOutput).toBe(output);
  });
};

describe('Tier grammar can parse', () => {
  tierGrammarTestItems['forEach'](testStringItem);
});
