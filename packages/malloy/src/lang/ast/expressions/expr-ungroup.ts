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

import {
  expressionIsAggregate,
  expressionIsUngroupedAggregate,
  FieldValueType,
  UngroupFragment,
} from '../../../model/malloy_types';

import {errorFor} from '../ast-utils';
import {QueryInputSpace} from '../field-space/query-input-space';
import {QuerySpace} from '../field-space/query-spaces';
import {FT} from '../fragtype-utils';
import {ExprValue} from '../types/expr-value';
import {ExpressionDef} from '../types/expression-def';
import {FieldName, FieldSpace} from '../types/field-space';

export class ExprUngroup extends ExpressionDef {
  legalChildTypes = FT.anyAtomicT;
  elementType = 'ungroup';
  constructor(
    readonly control: 'all' | 'exclude',
    readonly expr: ExpressionDef,
    readonly fields: FieldName[]
  ) {
    super({expr: expr, fields: fields});
  }

  returns(_forExpression: ExprValue): FieldValueType {
    return 'number';
  }

  getExpression(fs: FieldSpace): ExprValue {
    const isQuery = fs instanceof QuerySpace || fs instanceof QueryInputSpace;
    if (!isQuery) {
      this.expr.log(`${this.control}() only legal in a query`);
      return errorFor('ungroup non query');
    }
    const exprVal = this.expr.getExpression(fs);
    if (!expressionIsAggregate(exprVal.expressionType)) {
      this.expr.log(`${this.control}() expression must be an aggregate`);
      return errorFor('ungrouped scalar');
    }
    if (expressionIsUngroupedAggregate(exprVal.expressionType)) {
      this.expr.log(
        `${this.control}() expression must not already be ungrouped`
      );
      return errorFor('doubly-ungrouped aggregate');
    }
    const ungroup: UngroupFragment = {
      type: this.control,
      e: exprVal.value,
    };
    if (this.typeCheck(this.expr, {...exprVal, expressionType: 'scalar'})) {
      if (this.fields.length > 0) {
        const dstFields: string[] = [];
        const isExclude = this.control === 'exclude';
        // Now every mentioned field must be in the output space of one of the queries
        // of the nest tree leading to this query. This was originally deferred to
        // completion time, which may or may not be neccessary
        const ofs = fs.outputSpace();
        if (ofs instanceof QuerySpace) {
          for (const mentionedField of this.fields) {
            ofs.whenComplete(() => {
              ofs.checkUngroup(mentionedField, isExclude);
            });
            dstFields.push(mentionedField.refString);
          }
        }
        ungroup.fields = dstFields;
      }
      return {
        dataType: this.returns(exprVal),
        expressionType: 'ungrouped_aggregate',
        value: [ungroup],
        evalSpace: 'output',
      };
    }
    this.log(`${this.control}() incompatible type`);
    return errorFor('ungrouped type check');
  }
}
