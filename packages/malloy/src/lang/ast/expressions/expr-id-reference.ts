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
  isConditionParameter,
  mergeEvalSpaces,
} from '../../../model/malloy_types';
import {errorFor} from '../ast-utils';
import {ExprValue} from '../types/expr-value';
import {FieldReference} from '../query-items/field-references';
import {FieldSpace} from '../types/field-space';
import {SpaceParam} from '../types/space-param';
import {ExpressionDef} from '../types/expression-def';

export class ExprIdReference extends ExpressionDef {
  elementType = 'ExpressionIdReference';
  constructor(readonly fieldReference: FieldReference) {
    super();
    this.has({fieldPath: fieldReference});
  }

  get refString(): string {
    return this.fieldReference.refString;
  }

  getExpression(fs: FieldSpace): ExprValue {
    const def = this.fieldReference.getField(fs);
    if (def.found) {
      const td = def.found.typeDesc();
      if (def.isOutputField) {
        return {
          ...td,
          evalSpace: td.evalSpace === 'constant' ? 'constant' : 'output',
          value: [{type: 'outputField', name: this.refString}],
        };
      }
      const value = [{type: def.found.refType, path: this.fieldReference.path}];
      // We think that aggregates are more 'output' like, but maybe we will reconsider that...
      const evalSpace = expressionIsAggregate(td.expressionType)
        ? 'output'
        : td.evalSpace;
      return {...td, value, evalSpace};
    }
    this.log(def.error);
    return errorFor(def.error);
  }

  apply(fs: FieldSpace, op: string, expr: ExpressionDef): ExprValue {
    const entry = this.fieldReference.getField(fs).found;
    if (entry instanceof SpaceParam) {
      const cParam = entry.parameter();
      if (isConditionParameter(cParam)) {
        const lval = expr.getExpression(fs);
        return {
          dataType: 'boolean',
          expressionType: lval.expressionType,
          // TODO not sure about the input-ness of parameters
          evalSpace: mergeEvalSpaces(lval.evalSpace, 'input'),
          value: [
            {
              type: 'apply',
              value: lval.value,
              to: [{type: 'parameter', path: this.fieldReference.path}],
            },
          ],
        };
      }
    }
    return super.apply(fs, op, expr);
  }
}
