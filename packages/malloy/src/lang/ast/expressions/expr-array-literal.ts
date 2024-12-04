/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  ArrayLiteralNode,
  arrayEachFields,
  ArrayTypeDef,
  Expr,
} from '../../../model';
import {ExprValue, computedExprValue} from '../types/expr-value';
import {ExpressionDef} from '../types/expression-def';
import {FieldSpace} from '../types/field-space';
import * as TDU from '../typedesc-utils';

export class ArrayLiteral extends ExpressionDef {
  elementType = 'array literal';
  constructor(readonly elements: ExpressionDef[]) {
    super();
    this.has({elements});
  }

  getExpression(fs: FieldSpace): ExprValue {
    const values: Expr[] = [];
    const fromValues: ExprValue[] = [];
    let firstValue: ExprValue | undefined = undefined;
    if (this.elements.length > 0) {
      for (const nextElement of this.elements) {
        const v = nextElement.getExpression(fs);
        fromValues.push(v);
        if (v.type === 'error') {
          continue;
        }
        if (firstValue) {
          if (!TDU.typeEq(firstValue, v)) {
            nextElement.logError(
              'array-values-incompatible',
              'All array elements must be same type'
            );
            continue;
          }
        } else {
          firstValue = v;
        }
        values.push(v.value);
      }
    }
    const elementTypeDef = TDU.atomicDef(firstValue || {type: 'number'});
    const typeDef: ArrayTypeDef = {
      type: 'array',
      join: 'many',
      name: '',
      dialect: fs.dialectName(),
      elementTypeDef:
        elementTypeDef.type !== 'record'
          ? elementTypeDef
          : {type: 'record_element'},
      fields:
        elementTypeDef.type === 'record'
          ? elementTypeDef.fields
          : arrayEachFields(elementTypeDef),
    };
    const aLit: ArrayLiteralNode = {
      node: 'arrayLiteral',
      kids: {values},
      typeDef,
    };
    return computedExprValue({
      dataType: typeDef,
      value: aLit,
      from: fromValues,
    });
  }
}
