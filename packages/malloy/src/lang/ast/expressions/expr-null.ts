/*
 * Copyright 2023 Google LLC
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files
 * (the "Software"), to deal in the Software without restriction,
 * including without limitation the rights to use, copy, modify, merge,
 * publish, distribute, sublicense, and/or sell copies of the Software,
 * and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
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
