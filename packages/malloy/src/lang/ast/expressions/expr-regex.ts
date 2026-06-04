/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {ExprValue} from '../types/expr-value';
import {literalExprValue} from '../types/expr-value';
import {ExpressionDef} from '../types/expression-def';

export class ExprRegEx extends ExpressionDef {
  elementType = 'regular expression literal';
  constructor(readonly regex: string) {
    super();
  }

  getExpression(): ExprValue {
    return literalExprValue({
      dataType: {type: 'regular expression'},
      value: {node: 'regexpLiteral', literal: this.regex},
    });
  }
}
