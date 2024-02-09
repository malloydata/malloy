/**
 * Copyright (c) 2023 Google LLC
 * SPDX-License-Identifier: MIT
 */
import {generate, Parser} from 'peggy';
import {FilterASTNode, FilterExpressionType, TransformFunction} from '../types';
import {getNumberFromString} from './number/get_number_from_string';
import {getMatchesAdvancedNode} from './get_matches_advanced_node';
import {transformAST} from './transform/transform_ast';
import {typeToGrammar} from './type_to_grammar';

/**
 * Generates a parser from a PEGjs grammar and caches the result
 */
const generateParser = (() => {
  const parserCache: {[key: string]: Parser} = {};
  return (type: string, grammar: string) => {
    if (!parserCache[type]) {
      parserCache[type] = generate(grammar);
    }
    return parserCache[type];
  };
})();

/**
 * Variables used inside grammars
 */
export const parserOptions = {Object, getNumberFromString};

/**
 * A functions that uses a grammar of type type to parse an expression and returns an AST
 */
export const parseFilterExpression = (
  type: FilterExpressionType,
  expression: string
): FilterASTNode => {
  const {
    grammar,
    anyvalue,
    transform = (root: FilterASTNode) => root,
  } = typeToGrammar(type);
  if (expression === '') {
    return anyvalue;
  }
  try {
    const parser = generateParser(type, grammar);
    const transforms: TransformFunction[] = [transform];
    return transformAST(parser.parse(expression, parserOptions), transforms);
  } catch (error) {
    return getMatchesAdvancedNode(expression);
  }
};
