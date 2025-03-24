/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type {ExprValue} from '../types/expr-value';
import {ExpressionDef} from '../types/expression-def';

export class ExprFilterExpression extends ExpressionDef {
  elementType = 'filter expression literal';
  constructor(readonly filterText: string) {
    super();
  }

  getExpression(): ExprValue {
    return {
      type: 'filter expression',
      value: {node: 'filterLiteral', filterSrc: this.filterText},
      expressionType: 'scalar',
      evalSpace: 'constant',
      fieldUsage: [],
    };
  }
}
