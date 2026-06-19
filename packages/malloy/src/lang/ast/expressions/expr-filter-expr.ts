/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
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
    };
  }
}
