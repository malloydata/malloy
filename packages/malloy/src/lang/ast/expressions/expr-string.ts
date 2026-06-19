/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type * as Malloy from '@malloydata/malloy-interfaces';

import {ExpressionDef} from '../types/expression-def';
import type {FieldSpace} from '../types/field-space';
import type {ExprValue} from '../types/expr-value';
import {literalExprValue} from '../types/expr-value';

export class ExprString extends ExpressionDef {
  elementType = 'string literal';
  value: string;
  constructor(src: string) {
    super();
    this.value = src;
  }

  getExpression(_fs: FieldSpace): ExprValue {
    return literalExprValue({
      dataType: {type: 'string'},
      value: {node: 'stringLiteral', literal: this.value},
    });
  }

  getStableLiteral(): Malloy.LiteralValue {
    return {
      kind: 'string_literal',
      string_value: this.value,
    };
  }
}
