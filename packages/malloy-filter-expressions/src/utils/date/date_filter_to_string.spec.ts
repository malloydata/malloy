/**
 * Copyright (c) 2023 Google LLC
 * SPDX-License-Identifier: MIT
 */
import {convertTypeToMatchesAdvancedOption, treeToList} from '..';
import {GrammarTestItem, dateExpressionTestItems} from '../../grammars';
import {parseFilterExpression} from '../parse_filter_expression';
import {dateFilterToString} from './date_filter_to_string';

describe('Date To String', () => {
  dateExpressionTestItems.forEach((testItem: GrammarTestItem) => {
    const {expression, output} = testItem;

    it(
      'date filter output matches expected value for expression ' + expression,
      () => {
        const ast = parseFilterExpression('date', expression);
        // test item type
        const list = treeToList(ast);
        const item = list[0];
        // test output
        // some filter types can't be represented by DateFilter,
        // we expect this to be parsed as `type` above,
        // but be converted to `matchesAdvanced`
        const dateComponentType = convertTypeToMatchesAdvancedOption(item);
        const stringOutput =
          dateComponentType === 'matchesAdvanced'
            ? expression
            : dateFilterToString(ast, 'date');
        expect(stringOutput).toBe(output);
      }
    );
  });
});
