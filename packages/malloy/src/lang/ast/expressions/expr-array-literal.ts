/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {ArrayLiteralNode, arrayEachFields, ArrayTypeDef} from '../../../model';
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
    const values = this.elements.map(v => v.getExpression(fs));
    const type = values[0];
    const checkedValues = [values[0].value];
    for (const newType of values.slice(1)) {
      if (TDU.typeEq(type, newType)) {
        checkedValues.push(newType.value);
      } else {
        throw new Error('mtoy todo array elements should be same type');
      }
    }
    const elementTypeDef = TDU.atomicDef(values[0]);
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
      kids: {values: checkedValues},
      typeDef,
    };
    return computedExprValue({
      dataType: typeDef,
      value: aLit,
      from: values,
    });
  }
}
