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
  FilterASTNode,
  FilterItemToStringFunction,
  FilterModel,
  FilterExpressionType,
} from '../../types';
import {hasMatchesAdvancedNode} from '../has_matches_advanced_node';
import {parseFilterExpression} from '../parse_filter_expression';
import {inorderTraversal} from '../tree';
import {typeToGrammar} from '../type_to_grammar';

/**
 * Traverses ast and calls the describe function for every node
 * combines results using or / and labels
 */
const treeToSummary = (
  root: FilterASTNode,
  describe: FilterItemToStringFunction,
  filterType: FilterExpressionType
): string => {
  const orItems: string[] = [];
  const andItems: string[] = [];
  inorderTraversal(root, (node: FilterASTNode) => {
    const item = node as FilterModel;
    if (item.type !== ',') {
      (item.is ? orItems : andItems).push(describe(item, filterType));
    }
  });
  const resultOr = orItems ? orItems.join(' or ') : '';
  const resultAnd = andItems ? andItems.join(' and ') : '';
  let result = resultOr;
  result += resultOr && resultAnd ? ', and ' : '';
  result += resultAnd;

  return result;
};

interface ISummaryOptions {
  /** The type of filter expression - number, string, etc. */
  type: FilterExpressionType;
  /** The current value being filtered */
  expression?: string;
  /** Filter is required if true; required fields must have a value */
  required?: boolean;
}

type ISummary = (o: ISummaryOptions) => string;

/**
 * Builds a summary description for a filter expression
 */
export const summary: ISummary = props => {
  const {type, expression = '', required} = props as ISummaryOptions;

  if (required && !expression) {
    return 'Value required';
  }

  const {describe, subTypes} = typeToGrammar(type);
  const ast = parseFilterExpression(type, expression);

  const isMatchesAdvanced = hasMatchesAdvancedNode(subTypes)(ast);
  return isMatchesAdvanced ? expression : treeToSummary(ast, describe, type);
};
