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

import {expressionIsAggregate} from '../../../model/malloy_types';
import {ExprValue} from '../types/expr-value';
import {FieldReference} from '../query-items/field-references';
import {FieldSpace} from '../types/field-space';
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
          value: {node: 'outputField', name: this.refString},
        };
      }
      const value = {node: def.found.refType, path: this.fieldReference.path};
      // We think that aggregates are more 'output' like, but maybe we will reconsider that...
      const evalSpace = expressionIsAggregate(td.expressionType)
        ? 'output'
        : td.evalSpace;
      return {...td, value, evalSpace};
    }
    return this.loggedErrorExpr(def.error.code, def.error.message);
  }
}
