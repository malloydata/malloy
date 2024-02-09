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
import {
  convertTypeToMatchesAdvancedOption,
  parseFilterExpression,
  summary,
  treeToList,
} from '../utils';
// import { i18nInit } from '../i18n'
import {dateExpressionTestItems} from './date_grammar_test_expressions';
import {GrammarTestItem} from './grammar_test_utils';
import {dateFilterToString} from '../utils/date/date_filter_to_string';

const testDateItem = (testItem: GrammarTestItem) => {
  test(`${testItem['expression']}`, () => {
    const {expression, type, describe, output, filterType = 'date'} = testItem;

    // test ast
    const ast = parseFilterExpression(filterType, expression);
    expect(ast).toMatchSnapshot();

    // test descriptions
    const description = summary({type: filterType, expression});
    expect(description).toBe(describe);

    // test item type
    const list = treeToList(ast);
    const item = list[0];
    if (type) {
      expect(item.type).toEqual(type);
    }

    // test serialized output
    // some filter types can't be represented by DateFilter,
    // we expect this to be parsed as `type` above,
    // but be converted to `matchesAdvanced`
    const dateComponentType = convertTypeToMatchesAdvancedOption(item);
    const dateOutput =
      dateComponentType === 'matchesAdvanced'
        ? expression
        : dateFilterToString(ast, filterType);
    expect(dateOutput).toBe(output);
  });
};

describe('Date grammar can parse', () => {
  dateExpressionTestItems['forEach'](testDateItem);
});

const basicDates = [
  'this day',
  'this day to second',
  'this year to second',
  'this year to day',
  '3 days',
  '3 days ago',
  '3 months ago for 2 days',
  'before 3 days ago',
  'before 2018-01-01 12:00:00',
  'after 2018-10-05',
  '2018-05-18 12:00:00 to 2018-05-18 14:00:00',
  '2018-01-01 12:00:00 for 3 days',
  'today',
  'yesterday',
  'tomorrow',
  'Monday',
  'next week',
  '3 days from now',
  '3 days from now for 2 weeks',
  '',
];

const testExpression = (expression: string) => {
  expect(parseFilterExpression('date', expression)).toMatchSnapshot();
};

describe('Date grammar can parse basic date', () => {
  it.each(basicDates)('%s', testExpression);
});

const absoluteDates = [
  '2018/05/29',
  '2018/05/10 for 3 days',
  'after 2018/05/10',
  'before 2018/05/10',
  '2018/05',
  '2018/05 for 2 months',
  '2018/05/10 05:00 for 5 hours',
  '2018/05/10 for 5 months',
  '2018',
  'FY2018',
  'FY2018-Q1',
];

describe('Date grammar can parse absolute date', () => {
  it.each(absoluteDates)('%s', testExpression);
});

const seconds = ['1 second', '60 seconds', '60 seconds ago for 1 second'];
describe('Date grammar can parse seconds', () => {
  it.each(seconds)('%s', testExpression);
});

const minutes = ['1 minute', '60 minutes', '60 minutes ago for 1 minute'];
describe('Date grammar can parse minutes', () => {
  it.each(minutes)('%s', testExpression);
});

const hours = ['1 hour', '24 hours', '24 hours ago for 1 hour'];

describe('Date grammar can parse hours', () => {
  it.each(hours)('%s', testExpression);
});
const days = [
  'today',
  '2 days',
  '1 day ago',
  '7 days ago for 7 days',
  'today for 7 days',
  'last 3 days',
  '7 days from now',
];
describe('Date grammar can parse days', () => {
  it.each(days)('%s', testExpression);
});

const weeks = [
  '1 week',
  'this week',
  'before this week',
  'after this week',
  'next week',
  '2 weeks',
  '2 weeks ago for 2 weeks',
  'last week',
  '1 week ago',
];
describe('Date grammar can parse weeks', () => {
  it.each(weeks)('%s', testExpression);
});

const months = [
  '1 month',
  'this month',
  '2 months',
  'last month',
  '2 months ago',
  '2 months ago for 2 months',
  'before 2 months ago',
  'before 2 months',
  'before 2 months from now',
  'next month',
  '2 months from now',
  '6 months from now for 3 months',
];

describe('Date grammar can parse months', () => {
  it.each(months)('%s', testExpression);
});

const quarters = [
  '1 quarter',
  'this quarter',
  '2 quarters',
  'last quarter',
  '2 quarters ago',
  'before 2 quarters ago',
  'next quarter',
  '2018-07-01 for 1 quarter',
  '2018-Q4',
];

describe('Date grammar can parse quarters', () => {
  it.each(quarters)('%s', testExpression);
});

const years = [
  '1 year',
  'this year',
  'next year',
  '2 years',
  '2 years ago for 2 years',
  'last year',
  '2 years ago',
  'before 2 years ago',
];

describe('Date grammar can parse years', () => {
  it.each(years)('%s', testExpression);
});

describe('Date grammar with multiple clauses', () => {
  it('parse correctly', () =>
    expect(testExpression('1 year ago, 1 month ago')).toMatchSnapshot());
});

const invalidDates = ['-1', 'not a valid date'];

describe('Date grammar invalid dates show as matches advanced type', () => {
  it.each(invalidDates)('%s', testExpression);
});
