/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {TD, RecordLiteralNode, mkFieldDef} from '../../../model';
import {ExprValue, computedExprValue} from '../types/expr-value';
import {ExpressionDef} from '../types/expression-def';
import {FieldSpace} from '../types/field-space';
import {MalloyElement} from '../types/malloy-element';
import * as TDU from '../typedesc-utils';

export class RecordElement extends MalloyElement {
  elementType = 'record element';
  constructor(
    readonly key: string,
    readonly value: ExpressionDef
  ) {
    super();
    this.has({value});
  }
}

export class RecordLiteral extends ExpressionDef {
  elementType = 'record literal';
  constructor(readonly pairs: RecordElement[]) {
    super();
    this.has({pairs});
  }

  getExpression(fs: FieldSpace): ExprValue {
    const recLit: RecordLiteralNode = {
      node: 'recordLiteral',
      kids: {},
      typeDef: {
        type: 'record',
        fields: [],
      },
    };
    const dependents: ExprValue[] = [];
    for (const el of this.pairs) {
      const xVal = el.value.getExpression(fs);
      if (TD.isAtomic(xVal)) {
        dependents.push(xVal);
        recLit.kids[el.key] = xVal.value;
        recLit.typeDef.fields.push(
          mkFieldDef(TDU.atomicDef(xVal), el.key, fs.dialectName())
        );
      } else {
        this.logError(
          'illegal-record-property-type',
          `Record property '${el.key} is type '${xVal.type}', which is not a legal property value type`
        );
      }
    }
    return computedExprValue({
      value: recLit,
      dataType: recLit.typeDef,
      from: dependents,
    });
  }
}
