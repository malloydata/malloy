/**
 * Copyright (c) 2023 Google LLC
 * SPDX-License-Identifier: MIT
 */
import {GrammarTestItem} from './grammar_test_utils';

// prettier-ignore
export const numberExpressionTestItems: GrammarTestItem[] = [
  { expression: '5', type: '=', describe: 'is 5', output: '5'},
  { expression: 'not 5', type: '!=', describe: 'is not 5', output: 'not 5'},
  { expression: '<> 5', type: '!=', describe: 'is not 5', output: 'not 5'},
  { expression: '1, 3, 5, 7', type: '=', describe: 'is 1 or 3 or 5 or 7', output: '1,3,5,7'},
  { expression: 'not 66, 99, 4', type: '!=', describe: 'is not 66 or 99 or 4', output: 'not 66,not 99,not 4'},
  { expression: '5.5 to 10', type: 'between', describe: 'is in range [5.5, 10]', output: '[5.5,10]'},
  { expression: 'not 3 to 80.44', type: '!between', describe: 'is not in range [3, 80.44]', output: 'not [3,80.44]'},
  { expression: '1 to', type: '>=', describe: 'is >= 1', output: '>=1'},
  { expression: 'to 100', type: '<=', describe: 'is <= 100', output: '<=100'},
  { expression: '>= 5.5 AND <=10', type: 'between', describe: 'is in range [5.5, 10]', output: '[5.5,10]'},
  { expression: '<3 OR >80.44', type: '!between', describe: 'is not in range (3, 80.44)', output: 'not (3,80.44)'},
  { expression: '>10 AND <=20 OR 90', type: 'between', describe: 'is in range (10, 20] or is 90', output: '(10,20],90'},
  { expression: '>=50 AND <=100 OR >=500 AND <=1000', type: 'between', describe: 'is in range [50, 100] or is in range [500, 1000]', output: '[50,100],[500,1000]'},
  { expression: 'NULL', type: 'null', describe: 'is null', output: 'null'},
  { expression: 'NOT NULL', type: '!null', describe: 'is not null', output: 'not null'},
  { expression: '(1,100)', type: 'between', describe: 'is in range (1, 100)', output: '(1,100)'},
  { expression: '(1,100]', type: 'between', describe: 'is in range (1, 100]', output: '(1,100]'},
  { expression: '[1,100)', type: 'between', describe: 'is in range [1, 100)', output: '[1,100)'},
  { expression: '[1,100]', type: 'between', describe: 'is in range [1, 100]', output: '[1,100]'},
  { expression: '[0,9],[20,29]', type: 'between', describe: 'is in range [0, 9] or is in range [20, 29]', output: '[0,9],[20,29]'},
  { expression: '[0,10],20', type: 'between', describe: 'is in range [0, 10] or is 20', output: '[0,10],20'},
  { expression: 'NOT 10,[1,5)', type: 'between', describe: 'is in range [1, 5), and is not 10', output: '[1,5),not 10'},
  { expression: '(1,100],500,600,(800,900],[2000,)', type: 'between', describe: 'is in range (1, 100] or is 500 or 600 or is in range (800, 900] or is >= 2000', output: '(1,100],500,600,(800,900],>=2000'},
  { expression: '(1, inf)', type: '>', describe: 'is > 1', output: '>1'},
  { expression: '(1,)', type: '>', describe: 'is > 1', output: '>1'},
  { expression: '(-inf,100]', type: '<=', describe: 'is <= 100', output: '<=100'},
  { expression: '(,100)', type: '<', describe: 'is < 100', output: '<100'},
  { expression: '[,10]', type: '<=', describe: 'is <= 10', output: '<=10' },
  { expression: '>5', type: '>', describe: 'is > 5', output: '>5'},
  { expression: '23, not 42, not 42', type:'=', describe: 'is 23, and is not 42', output: '23,not 42,not 42'},
  { expression: '23, not 42, 43', type:'!=', describe: 'is not 23 or 42 or 43', output: 'not 23,not 42,not 43'},
  { expression: '23, not 42, not 43', type:'=', describe: 'is 23, and is not 42 or 43', output: '23,not 42,not 43'},
  { expression: '23,NOT [30,40]', type: '=', describe: 'is 23, and is not in range [30, 40]', output: '23,not [30,40],not [30,40]'},
  { expression: '23,NOT NULL', type: '=', describe: 'is 23, and is not null', output: '23,not null,not null'},
  { expression: '23,NOT NULL,NOT NULL', type: '=', describe: 'is 23, and is not null', output: '23,not null,not null'},
]
