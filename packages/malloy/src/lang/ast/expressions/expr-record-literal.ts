/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 *  LICENSE file in the root directory of this source tree.
 */

// import {
//   isAtomicFieldType,
//   TD,
//   RecordLiteralNode,
//   TypedExpr,
// } from '../../../model';
import {ExprValue} from '../types/expr-value';
import {ExpressionDef} from '../types/expression-def';
import {FieldSpace} from '../types/field-space';
import {MalloyElement} from '../types/malloy-element';

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

  getExpression(_fs: FieldSpace): ExprValue {
    throw new Error('get expression on record todo');
    // const recLit: RecordLiteralNode = {
    //   node: 'recordLiteral',
    //   kids: {},
    // };
    // const dependents: ExprValue[] = [];
    // for (const el of this.pairs) {
    //   const xVal = el.value.getExpression(fs);
    //   const expr: TypedExpr = {typeDef: {type: 'error'}, ...xVal.value};
    //   if (TD.isError(expr.typeDef) && isAtomicFieldType(xVal.dataType)) {
    //     expr.typeDef = xVal.dataType;
    //   }
    //   if (TD.isError(expr.typeDef) && xVal.dataType !== 'error') {
    //     this.logError(
    //       'illegal-record-property-type',
    //       `Type '${xVal.dataType}' not a legal record value`
    //     );
    //   }
    //   recLit.kids[el.key] = expr;
    //   dependents.push(xVal);
    // }
    // return computedExprValue({
    //   dataType: 'record',
    //   value: recLit,
    //   from: dependents,
    // });
  }
}
