/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {BinaryMalloyOperator, FieldSpace} from '..';
import type {ExprValue} from '../types/expr-value';
import {literalExprValue} from '../types/expr-value';
import {ATNodeType, ExpressionDef} from '../types/expression-def';

function doIsNull(fs: FieldSpace, op: string, expr: ExpressionDef): ExprValue {
  const nullCmp = expr.getExpression(fs);
  nullCmp.type = 'boolean';
  nullCmp.value = {
    node: op === '=' ? 'is-null' : 'is-not-null',
    e: nullCmp.value,
  };
  return nullCmp;
}

export class ExprNULL extends ExpressionDef {
  elementType = 'NULL';

  getExpression(): ExprValue {
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

  getExpression(_fs: FieldSpace): ExprValue {
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

  getExpression(fs: FieldSpace): ExprValue {
    return doIsNull(fs, this.op, this.expr);
  }
}
