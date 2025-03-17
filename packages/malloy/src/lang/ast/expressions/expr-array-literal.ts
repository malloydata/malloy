/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type {ArrayLiteralNode, ArrayTypeDef, Expr} from '../../../model';
import type {ExprValue} from '../types/expr-value';
import {computedExprValue} from '../types/expr-value';
import {ExpressionDef} from '../types/expression-def';
import type {FieldSpace} from '../types/field-space';
import * as TDU from '../typedesc-utils';
import {RecordLiteral} from './expr-record-literal';

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
        const v =
          firstValue && nextElement instanceof RecordLiteral
            ? nextElement.getNextElement(fs, firstValue)
            : nextElement.getExpression(fs);
        fromValues.push(v);
        if (v.type === 'error') {
          continue;
        }
        if (firstValue) {
          if (v.type !== 'null' && !TDU.typeEq(firstValue, v)) {
            nextElement.logError(
              'array-values-incompatible',
              'All array elements must be same type'
            );
            continue;
          }
        } else if (v.type !== 'null') {
          firstValue = v;
        }
        values.push(v.value);
      }
    }
    const elementTypeDef = TDU.atomicDef(firstValue || {type: 'number'});
    const typeDef: ArrayTypeDef =
      elementTypeDef.type === 'record'
        ? {
            type: 'array',
            elementTypeDef: {type: 'record_element'},
            fields: elementTypeDef.fields,
          }
        : {
            type: 'array',
            elementTypeDef,
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
