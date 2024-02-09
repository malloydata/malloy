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
import {GrammarTestItem} from './grammar_test_utils';

// prettier-ignore
export const dateExpressionTestItems: GrammarTestItem = [
  { expression: '3 days', output: '3 day', describe: 'is in the last 3 days' },
  { expression: '3 days ago', output: '3 days ago', describe: 'is 3 days ago', type: 'pastAgo' },
  { expression: '7 year ago', output: '7 year ago', describe: 'is 7 years ago', type: 'pastAgo' },
  { expression: '3 months ago for 2 days', output: '3 month ago for 2 day', describe: 'is 3 months ago for 2 days' },
  { expression: 'before 3 days ago', output: 'before 3 day ago', describe: 'is before 3 days ago' },
  { expression: 'before 2018-01-01 12:00:00', output: 'before 2018/01/01', describe: 'is before 2018/01/01' },
  { expression: 'after 2018-10-05', output: 'after 2018/10/05', describe: 'is on or after 2018/10/05' },
  { expression: '2018-05-18 12:00:00 to 2018-05-18 14:00:00', output: '2018/05/18 to 2018/05/18', describe: 'is from 2018/05/18 until 2018/05/18' },
  { expression: 'next week', output: 'next week', describe: 'is next week' },
  { expression: 'last week', output: 'last week', describe: 'is previous week' },
  { expression: 'not null', output: 'not null', describe: 'is not null'},
  { expression: 'null', output: 'null', describe: 'is null'},
  { expression: '2018-05-18', output: '2018/05/18', describe: 'is on 2018/05/18' },
  { expression: '', output: '', describe: 'is any time' },
  { expression: '2018', output: '2018', describe: 'is in the year 2018'},
  { expression: '2018/01', output: '2018-01', describe: 'is in January 2018' },
  { expression: 'monday', output: 'monday', describe: 'is monday' },
  { expression: 'before 2 months from now', output: 'before 2 month from now', describe: 'is before 2 months from now' },
  { expression: 'after 2 weeks from now', output: 'after 2 week from now', describe: 'is on or after 2 weeks from now' },
  { expression: 'after 1 month ago', output: 'after 1 month ago', describe: 'is on or after 1 month ago' },
  { expression: 'this year to second', output: 'this year to second', describe: 'this year to second', type: 'thisRange' },
  { expression: 'this year to day', output: 'this year to day', describe: 'this year to day', type: 'thisRange' },

  // this
  { expression: 'this day', output: 'this day', describe: 'is this day', type: 'this'},
  { expression: 'this week', output: 'this week', describe: 'is this week', type: 'this'},
  { expression: 'this month', output: 'this month', describe: 'is this month', type: 'this'},
  { expression: 'this quarter', output: 'this quarter', describe: 'is this quarter', type: 'this'},
  { expression: 'this fiscal quarter', output: 'this fiscal quarter', describe: 'is this fiscal quarter', type: 'this'},
  { expression: 'this year', output: 'this year', describe: 'is this year', type: 'this'},
  { expression: 'this fiscal year', output: 'this fiscal year', describe: 'is this fiscal year', type: 'this'},

  // next
  { expression: 'next day', output: 'next day', describe: 'is next day', type: 'next'},
  { expression: 'next week', output: 'next week', describe: 'is next week', type: 'next'},
  { expression: 'next month', output: 'next month', describe: 'is next month', type: 'next'},
  { expression: 'next quarter', output: 'next quarter', describe: 'is next quarter', type: 'next'},
  { expression: 'next fiscal quarter', output: 'next fiscal quarter', describe: 'is next fiscal quarter', type: 'next'},
  { expression: 'next year', output: 'next year', describe: 'is next year', type: 'next'},
  { expression: 'next fiscal year', output: 'next fiscal year', describe: 'is next fiscal year', type: 'next'},

  // last
  { expression: 'last second', output: 'last second', describe: 'is previous second', type: 'last'},
  { expression: 'last minute', output: 'last minute', describe: 'is previous minute', type: 'last'},
  { expression: 'last hour', output: 'last hour', describe: 'is previous hour', type: 'last'},
  { expression: 'last day', output: 'last day', describe: 'is previous day', type: 'last'},
  { expression: 'last week', output: 'last week', describe: 'is previous week', type: 'last'},
  { expression: 'last month', output: 'last month', describe: 'is previous month', type: 'last'},
  { expression: 'last quarter', output: 'last quarter', describe: 'is previous quarter', type: 'last'},
  { expression: 'last fiscal quarter', output: 'last fiscal quarter', describe: 'is previous fiscal quarter', type: 'last'},
  { expression: 'last year', output: 'last year', describe: 'is previous year', type: 'last'},
  { expression: 'last fiscal year', output: 'last fiscal year', describe: 'is previous fiscal year', type: 'last'},

  // before this/next/last
  { expression: 'before this day', output: 'before this day', describe: 'before this day', type: 'before_this'},
  { expression: 'before this week', output: 'before this week', describe: 'before this week', type: 'before_this'},
  { expression: 'before this month', output: 'before this month', describe: 'before this month', type: 'before_this'},

  { expression: 'before next day', output: 'before next day', describe: 'before next day', type: 'before_next'},
  { expression: 'before next quarter', output: 'before next quarter', describe: 'before next quarter', type: 'before_next'},
  { expression: 'before next year', output: 'before next year', describe: 'before next year', type: 'before_next'},

  { expression: 'before last day', output: 'before last day', describe: 'before last day', type: 'before_last'},
  { expression: 'before last week', output: 'before last week', describe: 'before last week', type: 'before_last'},
  { expression: 'before last month', output: 'before last month', describe: 'before last month', type: 'before_last'},

  // after this/next/last
  { expression: 'after this day', output: 'after this day', describe: 'after this day', type: 'after_this'},
  { expression: 'after this week', output: 'after this week', describe: 'after this week', type: 'after_this'},
  { expression: 'after this month', output: 'after this month', describe: 'after this month', type: 'after_this'},

  { expression: 'after next day', output: 'after next day', describe: 'after next day', type: 'after_next'},
  { expression: 'after next week', output: 'after next week', describe: 'after next week', type: 'after_next'},
  { expression: 'after next month', output: 'after next month', describe: 'after next month', type: 'after_next'},

  { expression: 'after last day', output: 'after last day', describe: 'after last day', type: 'after_last'},
  { expression: 'after last quarter', output: 'after last quarter', describe: 'after last quarter', type: 'after_last'},
  { expression: 'after last year', output: 'after last year', describe: 'after last year', type: 'after_last'},
]
