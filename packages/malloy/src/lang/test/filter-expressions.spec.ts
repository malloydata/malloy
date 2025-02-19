/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {expr, errorMessage} from './test-translator';
import './parse-expects';
import {ExprFilterExpression} from '../ast';

describe('Malloy Filter Expressions', () => {
  test('single quote literal parses correctly', () => {
    const fstr = expr`f'z'`;
    const node = fstr.translator.ast();
    expect(node).toBeInstanceOf(ExprFilterExpression);
    if (node instanceof ExprFilterExpression) {
      expect(node.filterText).toEqual('z');
    }
  });
  test('double quote literal parses correctly', () => {
    const fstr = expr`f"z"`;
    const node = fstr.translator.ast();
    expect(node).toBeInstanceOf(ExprFilterExpression);
    if (node instanceof ExprFilterExpression) {
      expect(node.filterText).toEqual('z');
    }
  });
  test('back quote literal parses correctly', () => {
    const fstr = expr`f\`z\``;
    const node = fstr.translator.ast();
    expect(node).toBeInstanceOf(ExprFilterExpression);
    if (node instanceof ExprFilterExpression) {
      expect(node.filterText).toEqual('z');
    }
  });
  test('triple single literal parses correctly', () => {
    const fstr = expr`f'''z'''`;
    const node = fstr.translator.ast();
    expect(node).toBeInstanceOf(ExprFilterExpression);
    if (node instanceof ExprFilterExpression) {
      expect(node.filterText).toEqual('z');
    }
  });
  test('triple double literal parses correctly', () => {
    const fstr = expr`f"""z"""`;
    const node = fstr.translator.ast();
    expect(node).toBeInstanceOf(ExprFilterExpression);
    if (node instanceof ExprFilterExpression) {
      expect(node.filterText).toEqual('z');
    }
  });
  test('triple double literal parses correctly', () => {
    const fstr = expr`f\`\`\`z\`\`\``;
    const node = fstr.translator.ast();
    expect(node).toBeInstanceOf(ExprFilterExpression);
    if (node instanceof ExprFilterExpression) {
      expect(node.filterText).toEqual('z');
    }
  });
  test('Use of = and filters is rejected', () => {
    expect(expr`astr = f'z'`).toLog(
      errorMessage("Cannot use the '=' operator with a filter expression")
    );
  });
  test('Use of ? and filters is rejected', () => {
    expect(expr`astr ? f'z'`).toLog(
      errorMessage("Cannot use the '?' operator with a filter expression")
    );
  });
  test('pick statements cannot have filter expression values', () => {
    expect(expr`astr ? ( pick f'yes' when true else f'no' )`).toLog(
      errorMessage('zzzz')
    );
  });
});
