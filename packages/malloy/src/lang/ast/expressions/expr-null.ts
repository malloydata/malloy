/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {BinaryMalloyOperator, FieldSpace} from '..';
import type {ExprValue} from '../types/expr-value';
import {computedExprValue, literalExprValue} from '../types/expr-value';
import {ATNodeType, ExpressionDef} from '../types/expression-def';

function doIsNull(fs: FieldSpace, op: string, expr: ExpressionDef): ExprValue {
  // Build a new value rather than retyping the operand's in place: what
  // getExpression hands back is shared, and the operand is usually asked for
  // its value again after this.
  const nullCmp = expr.getExpression(fs);
  return computedExprValue({
    dataType: {type: 'boolean'},
    value: {
      node: op === '=' ? 'is-null' : 'is-not-null',
      e: nullCmp.value,
    },
    from: [nullCmp],
  });
}

export class ExprNULL extends ExpressionDef {
  elementType = 'NULL';

  protected computeExpression(): ExprValue {
    return literalExprValue({
      dataType: {type: 'null'},
      value: {node: 'null'},
    });
  }

  apply(
    fs: FieldSpace,
    op: BinaryMalloyOperator,
    left: ExpressionDef
  ): ExprValue {
    if (op === '!=' || op === '=') {
      return doIsNull(fs, op, left);
    }
    return super.apply(fs, op, left, true);
  }
}

export class PartialIsNull extends ExpressionDef {
  elementType = '<=> NULL';
  constructor(readonly op: '=' | '!=') {
    super();
  }

  apply(fs: FieldSpace, op: string, expr: ExpressionDef): ExprValue {
    return doIsNull(fs, this.op, expr);
  }

  requestExpression(_fs: FieldSpace): ExprValue | undefined {
    return undefined;
  }

  protected computeExpression(_fs: FieldSpace): ExprValue {
    return this.loggedErrorExpr(
      'partial-as-value',
      'Partial null check does not have a value'
    );
  }

  atNodeType(): ATNodeType {
    return ATNodeType.Partial;
  }
}

export class ExprIsNull extends ExpressionDef {
  elementType = 'is null';
  constructor(
    readonly expr: ExpressionDef,
    readonly op: '=' | '!='
  ) {
    super();
    this.has({expr});
  }

  protected computeExpression(fs: FieldSpace): ExprValue {
    return doIsNull(fs, this.op, this.expr);
  }
}
