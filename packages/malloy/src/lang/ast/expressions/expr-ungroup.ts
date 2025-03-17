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

import type {UngroupNode} from '../../../model/malloy_types';
import {
  expressionIsAggregate,
  expressionIsUngroupedAggregate,
} from '../../../model/malloy_types';

import {QuerySpace} from '../field-space/query-spaces';
import * as TDU from '../typedesc-utils';
import type {ExprValue} from '../types/expr-value';
import {ExpressionDef} from '../types/expression-def';
import type {FieldName, FieldSpace} from '../types/field-space';

export class ExprUngroup extends ExpressionDef {
  legalChildTypes = TDU.anyAtomicT;
  elementType = 'ungroup';
  constructor(
    readonly control: 'all' | 'exclude',
    readonly expr: ExpressionDef,
    readonly fields: FieldName[]
  ) {
    super({expr: expr, fields: fields});
  }

  getExpression(fs: FieldSpace): ExprValue {
    const exprVal = this.expr.getExpression(fs);
    if (!expressionIsAggregate(exprVal.expressionType)) {
      return this.expr.loggedErrorExpr(
        'ungroup-of-non-aggregate',
        `${this.control}() expression must be an aggregate`
      );
    }
    if (expressionIsUngroupedAggregate(exprVal.expressionType)) {
      return this.expr.loggedErrorExpr(
        'ungroup-of-ungrouped-aggregate',
        `${this.control}() expression must not already be ungrouped`
      );
    }
    const ungroup: UngroupNode = {
      node: this.control,
      e: exprVal.value,
    };
    if (this.typeCheck(this.expr, {...exprVal, expressionType: 'scalar'})) {
      // Now every mentioned field must be in the output space of one of the queries
      // of the nest tree leading to this query. If this is a source definition,
      // this is not checked until sql generation time.
      if (fs.isQueryFieldSpace() && this.fields.length > 0) {
        const dstFields: string[] = [];
        const isExclude = this.control === 'exclude';
        for (const mentionedField of this.fields) {
          let ofs: FieldSpace | undefined = fs.outputSpace();
          let notFound = true;
          while (ofs) {
            const entryInfo = ofs.lookup([mentionedField]);
            if (entryInfo.found && entryInfo.isOutputField) {
              dstFields.push(mentionedField.refString);
              notFound = false;
            } else if (ofs instanceof QuerySpace) {
              // should always be true, but don't have types right, thus the if
              ofs = ofs.nestParent;
              continue;
            }
            break;
          }
          if (notFound) {
            const uName = isExclude ? 'exclude()' : 'all()';
            mentionedField.logError(
              'ungroup-field-not-in-output',
              `${uName} '${mentionedField.refString}' is missing from query output`
            );
          }
        }
        ungroup.fields = dstFields;
      }
      return {
        ...TDU.atomicDef(exprVal),
        expressionType: 'ungrouped_aggregate',
        value: ungroup,
        evalSpace: 'output',
        compositeFieldUsage: exprVal.compositeFieldUsage,
      };
    }
    return this.loggedErrorExpr(
      'ungroup-with-non-scalar',
      `${this.control}() incompatible type`
    );
  }
}
