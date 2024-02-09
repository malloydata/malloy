/**
 * Copyright (c) 2023 Google LLC
 * SPDX-License-Identifier: MIT
 */
import {dateExpressionTestItems, GrammarTestItem} from '../../grammars';
import {FilterModel} from '../../types';
import {i18nInit} from '../i18n';
import {summary} from '../summary/summary';
import {describeDate} from './describe_date';

describe('Summary', () => {
  beforeEach(() =>
    i18nInit().catch(e => {
      throw new Error(e);
    })
  );

  dateExpressionTestItems.forEach((testItem: GrammarTestItem) => {
    const {expression, describe} = testItem;

    it('works for date expression ' + expression, () => {
      const description = summary({type: 'date', expression});
      expect(description).toBe(describe);
    });
  });

  it('is empty for an undefined value', () => {
    const item: FilterModel = {'id': '0', 'is': true, 'type': 'other'};
    const description = describeDate(item);
    expect(description).toBe('');
  });

  it('should not add time into description for "on date" filter without time', () => {
    const date = {day: 4, month: 11, year: 2017};
    const item: FilterModel = {date, 'id': '0', 'is': true, 'type': 'on'};
    const description = describeDate(item, 'date_time');
    expect(description).toBe('is on 2017/11/04');
  });
});
