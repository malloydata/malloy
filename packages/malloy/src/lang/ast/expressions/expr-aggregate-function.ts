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
  AggregateFragment,
  expressionIsAggregate,
  FieldValueType,
  isAtomicFieldType,
} from '../../../model/malloy_types';

import {errorFor} from '../ast-utils';
import {OutputSpaceEntry} from '../field-space/query-spaces';
import {ReferenceField} from '../field-space/reference-field';
import {StructSpaceFieldBase} from '../field-space/struct-space-field-base';
import {FT} from '../fragtype-utils';
import {FieldReference} from '../query-items/field-references';
import {ExprValue} from '../types/expr-value';
import {ExpressionDef} from '../types/expression-def';
import {FieldSpace} from '../types/field-space';

export abstract class ExprAggregateFunction extends ExpressionDef {
  elementType: string;
  source?: FieldReference;
  expr?: ExpressionDef;
  legalChildTypes = [FT.numberT];
  constructor(readonly func: string, expr?: ExpressionDef) {
    super();
    this.elementType = func;
    if (expr) {
      this.expr = expr;
      this.has({expr: expr});
    }
  }

  returns(_forExpression: ExprValue): FieldValueType {
    return 'number';
  }

  getExpression(fs: FieldSpace): ExprValue {
    let exprVal = this.expr?.getExpression(fs);
    let structPath = this.source?.refString;
    if (this.source) {
      const sourceFoot = this.source.getField(fs).found;
      if (sourceFoot) {
        const footType = sourceFoot.typeDesc();
        if (isAtomicFieldType(footType.dataType)) {
          exprVal = {
            dataType: footType.dataType,
            expressionType: footType.expressionType,
            value: [
              footType.evalSpace === 'output'
                ? {
                    type: 'outputField',
                    name: this.source.refString,
                  }
                : {
                    type: 'field',
                    path: this.source.refString,
                  },
            ],
            evalSpace: footType.evalSpace,
          };
          // If you reference an output field as the foot, then we need to get the
          // source from that field, rather than using the default source.
          if (
            sourceFoot instanceof OutputSpaceEntry &&
            sourceFoot.inputSpaceEntry instanceof ReferenceField
          ) {
            structPath = sourceFoot.inputSpaceEntry.fieldRef.sourceString;
          } else {
            structPath = this.source.sourceString;
          }
        } else {
          if (!(sourceFoot instanceof StructSpaceFieldBase)) {
            this.log(`Aggregate source cannot be a ${footType.dataType}`);
            return errorFor(
              `Aggregate source cannot be a ${footType.dataType}`
            );
          }
        }
      } else {
        this.log(`Reference to undefined value ${this.source.refString}`);
        return errorFor(
          `Reference to undefined value ${this.source.refString}`
        );
      }
    }
    if (exprVal === undefined) {
      this.log('Missing expression for aggregate function');
      return errorFor('agggregate without expression');
    }
    if (expressionIsAggregate(exprVal.expressionType)) {
      this.log('Aggregate expression cannot be aggregate');
      return errorFor('reagggregate');
    }
    if (
      this.typeCheck(this.expr || this, {
        ...exprVal,
        expressionType: 'scalar',
      })
    ) {
      const f: AggregateFragment = {
        type: 'aggregate',
        function: this.func,
        e: exprVal.value,
      };
      if (structPath) {
        f.structPath = structPath;
      }
      return {
        dataType: this.returns(exprVal),
        expressionType: 'aggregate',
        value: [f],
        evalSpace: 'output',
      };
    }
    return errorFor('aggregate type check');
  }
}
