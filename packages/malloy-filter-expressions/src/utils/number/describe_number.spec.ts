/**
 * Copyright (c) 2023 Google LLC
 * SPDX-License-Identifier: MIT
 */
import {numberExpressionTestItems, GrammarTestItem} from '../../grammars';
import {summary} from '../summary/summary';
import {FilterModel} from '../../types';
import {describeNumber} from './describe_number';

describe('Summary', () => {
  numberExpressionTestItems.forEach((testItem: GrammarTestItem) => {
    const {expression, describe} = testItem;

    it('works for number expression ' + expression, () => {
      const description = summary({type: 'number', expression});
      expect(description).toBe(describe);
    });
  });

  it('is empty for an undefined value', () => {
    const item: FilterModel = {'id': '0', 'is': true, 'type': 'other'};
    const description = describeNumber(item);
    expect(description).toBe('');
  });
});
