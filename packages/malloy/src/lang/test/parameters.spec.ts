/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {markSource} from './test-translator';
import './parse-expects';

describe('parameters', () => {
  test('can declare parameter', () => {
    expect(`
      source: ab_new(param::number) is ab
    `).toTranslate();
  });
  test('can use declared parameter', () => {
    expect(`
      source: ab_new(param::number) is ab extend {
        dimension: param_plus_one is param + 1
      }
    `).toTranslate();
  });
  test('can pass argument for param', () => {
    expect(`
      source: ab_new(param::number) is ab
      run: ab_new(param is 1) -> { select: * }
    `).toTranslate();
  });
  test('can pass non-literal argument for param', () => {
    expect(`
      source: ab_new(param::number) is ab
      run: ab_new(param is 1 + 1) -> { select: * }
    `).toTranslate();
  });
  test('can reference renamed param in query against source', () => {
    expect(`
      source: ab_new(param::number) is ab
      run: ab_new(param is 1) -> { select: p is param }
    `).toTranslate();
  });
  test('can reference param in query against source', () => {
    expect(`
      source: ab_new(param::number) is ab
      run: ab_new(param is 1) -> { select: param }
    `).toTranslate();
  });
  test('error when passing param with no name', () => {
    expect(
      markSource`
        source: ab_new(param::number) is ab
        run: ab_new(${'1'}) -> { select: * }
      `
    ).translationToFailWith(
      'Parameterized source arguments must be named with `parameter_name is`',
      'Argument not provided for required parameter `param`'
    );
  });
  test('error when passing param with incorrect name', () => {
    expect(
      markSource`
        source: ab_new(param::number) is ab
        run: ab_new(${'wrong_name'} is 1, param is 2) -> { select: * }
      `
    ).translationToFailWith(
      '`ab_new` has no declared parameter named `wrong_name`'
    );
  });
  test('error when passing param multiple times', () => {
    expect(
      markSource`
        source: ab_new(param::number) is ab
        run: ab_new(param is 1, ${'param is 2'}) -> { select: * }
      `
    ).translationToFailWith('Cannot pass argument for `param` more than once');
  });
  test('error when not specifying argument for param with parentheses', () => {
    expect(
      markSource`
        source: ab_new(param::number) is ab
        run: ${'ab_new'}() -> { select: * }
      `
    ).translationToFailWith(
      'Argument not provided for required parameter `param`'
    );
  });
  test('error when not specifying argument for param without parentheses', () => {
    expect(
      markSource`
        source: ab_new(param::number) is ab
        run: ${'ab_new'} -> { select: * }
      `
    ).translationToFailWith(
      'Argument not provided for required parameter `param`'
    );
  });
  test('error when not specifying argument for param second time', () => {
    expect(
      markSource`
        source: ab_new(param::number) is ab
        run: ab_new(param is 1) -> { select: * }
        run: ${'ab_new'} -> { select: * }
      `
    ).translationToFailWith(
      'Argument not provided for required parameter `param`'
    );
  });
});
