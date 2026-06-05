/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type * as Malloy from '@malloydata/malloy-interfaces';
import type {ExprValue} from '../types/expr-value';
import {literalExprValue} from '../types/expr-value';
import type {FieldSpace} from '../types/field-space';
import {ExpressionDef} from '../types/expression-def';
import type {NumberTypeDef} from '../../../model';

export class ExprNumber extends ExpressionDef {
  elementType = 'numeric literal';
  constructor(readonly n: string) {
    super();
  }

  getExpression(fs: FieldSpace): ExprValue {
    const dialect = fs.dialectObj();
    const dataType =
      dialect?.literalNumberType(this.n) ?? this.defaultNumberType();

    return literalExprValue({
      dataType,
      value: {node: 'numberLiteral', literal: this.n},
    });
  }

  /**
   * Default number type when no dialect is available.
   * Integers default to bigint for safety, floats to float.
   */
  private defaultNumberType(): NumberTypeDef {
    const isInteger = /^-?\d+$/.test(this.n);
    return isInteger
      ? {type: 'number', numberType: 'bigint'}
      : {type: 'number', numberType: 'float'};
  }

  /**
   * For constants (no dialect context), always use bigint for integers
   * to ensure large values render correctly.
   */
  constantExpression(): ExprValue {
    return literalExprValue({
      dataType: this.defaultNumberType(),
      value: {node: 'numberLiteral', literal: this.n},
    });
  }

  getStableLiteral(): Malloy.LiteralValue {
    return {
      kind: 'number_literal',
      number_value: Number(this.n),
    };
  }
}
