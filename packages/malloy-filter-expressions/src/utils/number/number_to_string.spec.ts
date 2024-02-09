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
import {numberExpressionTestItems, GrammarTestItem} from '../../grammars';
import {parseFilterExpression} from '../parse_filter_expression';
import {numberToString} from './number_to_string';
import {addNode, treeToList} from '../tree';

describe('Number To String', () => {
  numberExpressionTestItems.forEach((testItem: GrammarTestItem) => {
    const {expression, output} = testItem;

    it('works for number expression ' + expression, () => {
      const ast = parseFilterExpression('number', expression);
      const stringOutput = numberToString(ast);
      expect(stringOutput).toBe(output);
    });
  });
});

describe('Invalid expression return any value expression', () => {
  it('return any value for invalid between filter item', () => {
    const ast = parseFilterExpression('number', '(1,10)');
    const item = {...ast, low: '', high: ''};
    const output = numberToString(item);
    expect(output).toEqual('');
  });

  it('return any value for invalid greater than item', () => {
    const ast = parseFilterExpression('number', '>1');
    const gtItem = {...ast, value: []};
    const output = numberToString(gtItem);
    expect(output).toEqual('');
  });

  it('return any value for invalid less than item', () => {
    const ast = parseFilterExpression('number', '<=10');
    const ltItem = {...ast, value: []};
    const output = numberToString(ltItem);
    expect(output).toEqual('');
  });
});

describe('Can properly serialize expressions with "is not" terms', () => {
  // defining ast nodes here
  const equals23 = {
    id: 1,
    is: true,
    left: undefined,
    right: undefined,
    type: '=',
    value: [23],
  };
  const not42 = {
    id: 3,
    is: false,
    left: undefined,
    right: undefined,
    type: '=',
    value: [42],
  };

  const notNull = {
    id: 5,
    is: false,
    left: undefined,
    right: undefined,
    type: 'null',
  };

  it('properly serializes duplicate not from two filter tree items', () => {
    // given two filter entries:
    // [= 23]
    // [!= 42]
    // build a filter expression that works with the duplicate not condition
    // and builds the expression '23,not 42,not 42

    // build ast from the two nodes
    const ast = addNode(equals23, not42);
    const output = numberToString(ast);
    expect(output).toEqual('23,not 42,not 42');
  });

  it('properly serializes duplicate not from three filter tree items', () => {
    // given three filter entries:
    // [= 23]
    // [!= 42]
    // [!= 43]
    // build a filter expression that works with the duplicate not condition
    // and builds the expression '23,not 42,not 43

    const not43 = {
      id: 5,
      is: false,
      left: undefined,
      right: undefined,
      type: '=',
      value: [43],
    };

    // build ast from the two nodes
    const ast = addNode(equals23, addNode(not42, not43));
    const output = numberToString(ast);
    expect(output).toEqual('23,not 42,not 43');
  });

  it('properly serializes duplicate not from two filter tree items with not null', () => {
    // given two filter entries:
    // [= 23]
    // [!null]
    // build a filter expression that works with the duplicate not condition
    // and builds the expression '23,not null,not null

    const not4243 = {
      id: 3,
      is: false,
      left: undefined,
      right: undefined,
      type: '=',
      value: [42, 43],
    };

    // build ast from the two nodes
    const ast = addNode(equals23, not4243);
    const output = numberToString(ast);
    expect(output).toEqual('23,not 42,not 43');
  });

  it('properly serializes an expression with not null', () => {
    const ast = addNode(equals23, notNull);
    const output = numberToString(ast);
    expect(output).toEqual('23,not null,not null');

    // the duplicate "not null" clause is removed so only two are present
    // when parsing back the ast
    const resultAST = parseFilterExpression('number', output);
    const list = treeToList(resultAST);
    expect(list).toHaveLength(2);
  });
});
