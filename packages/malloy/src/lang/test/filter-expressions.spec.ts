/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {expr, errorMessage, error} from './test-translator';
import './parse-expects';
import {ExprFilterExpression, ExprLogicalOp} from '../ast';

describe('Filter Expressions In Source', () => {
  test('single quote literal parses correctly', () => {
    const fstr = expr`f'z'`;
    const node = fstr.translator.ast();
    expect(node).toBeInstanceOf(ExprFilterExpression);
    if (node instanceof ExprFilterExpression) {
      expect(node.filterText).toEqual('z');
    }
  });
  test('backslash quote of single quote in single quote string', () => {
    const fstr = expr`f'\\''`;
    const node = fstr.translator.ast();
    expect(node).toBeInstanceOf(ExprFilterExpression);
    if (node instanceof ExprFilterExpression) {
      expect(node.filterText).toEqual("\\'");
    }
  });
  test('single quote literal parses minimal match', () => {
    const fstr = expr`f'z' or f'x'`;
    const orExpr = fstr.translator.ast();
    expect(orExpr).toBeInstanceOf(ExprLogicalOp);
    const node = orExpr?.children['left'];
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
  test('triple single literal parses slash four tick ending', () => {
    const fstr = expr`f'''z\\''''`;
    const node = fstr.translator.ast();
    expect(node).toBeInstanceOf(ExprFilterExpression);
    if (node instanceof ExprFilterExpression) {
      expect(node.filterText).toEqual("z\\'");
    }
  });
  test('triple single literal parses minimal match', () => {
    const fstr = expr`f'''z''' or f'''x'''`;
    const orExpr = fstr.translator.ast();
    expect(orExpr).toBeInstanceOf(ExprLogicalOp);
    const node = orExpr?.children['left'];
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
  test('triple back literal parses correctly', () => {
    const fstr = expr`f\`\`\`z\`\`\``;
    const node = fstr.translator.ast();
    expect(node).toBeInstanceOf(ExprFilterExpression);
    if (node instanceof ExprFilterExpression) {
      expect(node.filterText).toEqual('z');
    }
  });
  test('Use of = and filters is rejected', () => {
    expect(expr`astr = f'z'`).toLogAtLeast(
      errorMessage("Cannot use the '=' operator with a filter expression")
    );
  });
  test('Use of ? and filters is rejected', () => {
    expect(expr`astr ? f'z'`).toLogAtLeast(
      errorMessage('Filter expression illegal here')
    );
  });
  test('pick statements cannot have filter expression values', () => {
    expect(expr`pick f'yes' when true else f'no'`).toLogAtLeast(
      errorMessage('Filter expression illegal here')
    );
  });
  test('simple numeric filter', () => {
    expect("ai ~ f'5'").compilesTo('{filterNumber ai | 5}');
  });
  test('simple string filter', () => {
    expect("astr ~ f'5'").compilesTo('{filterString astr | 5}');
  });
  test('simple boolean filter', () => {
    expect("abool ~ f'true'").compilesTo('{filterBoolean abool | true}');
  });
  test('simple date filter', () => {
    expect("ad ~ f'2001-02-03'").compilesTo('{filterDate ad | 2001-02-03}');
  });
  test('simple timestamp filter', () => {
    expect("ats ~ f'2001-02-03'").compilesTo(
      '{filterTimestamp ats | 2001-02-03}'
    );
  });
  test('is backslash', () => {
    expect('astr ~ f"\\\\"').compilesTo('{filterString astr | \\\\}');
  });
  test('backslash followed by close quote', () => {
    expect('astr ~ f"\\\\\\""').compilesTo('{filterString astr | \\\\"}');
  });
  test('contains percent', () => {
    expect('astr ~ f"%\\%%"').compilesTo('{filterString astr | %\\%%}');
  });
  test('get a syntax error', () => {
    expect(expr`ai ~ f'7 adn <10'`).toLog(error('filter-expression-error'));
  });
  test('empty string filter', () => {
    expect('astr ~ f""').compilesTo('{filterString astr | }');
  });
  test('empty boolean filter', () => {
    expect('abool ~ f""').compilesTo('{filterBoolean abool | }');
  });
  test('empty numeric filter', () => {
    expect('ai ~ f""').compilesTo('{filterNumber ai | }');
  });
  test('empty temporal filter', () => {
    expect('ats ~ f""').compilesTo('{filterTimestamp ats | }');
  });
});
