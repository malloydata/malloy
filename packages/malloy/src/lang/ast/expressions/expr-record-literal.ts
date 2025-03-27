/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type {RecordLiteralNode} from '../../../model';
import {TD, mkFieldDef} from '../../../model';
import type {ExprValue} from '../types/expr-value';
import {computedExprValue} from '../types/expr-value';
import {ExpressionDef} from '../types/expression-def';
import type {FieldSpace} from '../types/field-space';
import {MalloyElement} from '../types/malloy-element';
import * as TDU from '../typedesc-utils';
import type {ExprIdReference} from './expr-id-reference';

export type ElementDetails =
  | {path: ExprIdReference}
  | {key?: string; value: ExpressionDef};
export class RecordElement extends MalloyElement {
  elementType = 'record element';
  value: ExpressionDef;
  key?: string;
  constructor(val: ElementDetails) {
    super();
    if ('value' in val) {
      this.value = val.value;
      this.has({value: val.value});
      if (val.key) {
        this.key = val.key;
      }
    } else {
      this.has({path: val.path});
      this.value = val.path;
      const parts = val.path.fieldReference.path;
      this.key = parts[parts.length - 1];
    }
  }
}

export class RecordLiteral extends ExpressionDef {
  elementType = 'record literal';
  constructor(readonly pairs: RecordElement[]) {
    super();
    this.has({pairs});
  }

  getExpression(fs: FieldSpace): ExprValue {
    return this.getRecord(fs, []);
  }

  getRecord(fs: FieldSpace, kidNames: string[]): ExprValue {
    const recLit: RecordLiteralNode = {
      node: 'recordLiteral',
      kids: {},
      typeDef: {
        type: 'record',
        fields: [],
      },
    };
    const dependents: ExprValue[] = [];
    let kidIndex = 0;
    for (const el of this.pairs) {
      const key = el.key ?? kidNames[kidIndex];
      kidIndex += 1;
      if (key === undefined) {
        el.logError(
          'record-literal-needs-keys',
          'Anonymous record element not legal here'
        );
        continue;
      }
      const xVal = el.value.getExpression(fs);
      if (TD.isAtomic(xVal)) {
        dependents.push(xVal);
        recLit.kids[key] = xVal.value;
        recLit.typeDef.fields.push(mkFieldDef(TDU.atomicDef(xVal), key));
      } else {
        el.value.logError(
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

  getNextElement(fs: FieldSpace, headValue: ExprValue): ExprValue {
    const recLit = headValue.value;
    if (recLit.node === 'recordLiteral') {
      return this.getRecord(fs, Object.keys(recLit.kids));
    }
    return this.getRecord(fs, []);
  }
}
