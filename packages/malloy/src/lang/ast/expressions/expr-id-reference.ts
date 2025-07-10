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

import type {FieldUsage} from '../../../model/malloy_types';
import {expressionIsAggregate} from '../../../model/malloy_types';
import type {ExprValue} from '../types/expr-value';
import type {FieldReference} from '../query-items/field-references';
import type {FieldSpace} from '../types/field-space';
import {ExpressionDef} from '../types/expression-def';
import type * as Malloy from '@malloydata/malloy-interfaces';

export class ExprIdReference extends ExpressionDef {
  elementType = 'ExpressionIdReference';
  constructor(readonly fieldReference: FieldReference) {
    super();
    this.has({fieldPath: fieldReference});
  }

  get refString(): string {
    return this.fieldReference.refString;
  }

  drillExpression(): Malloy.Expression | undefined {
    return {
      kind: 'field_reference',
      name: this.fieldReference.nameString,
      path: this.fieldReference.path.slice(0, -1),
    };
  }

  getExpression(fs: FieldSpace): ExprValue {
    const def = this.fieldReference.getField(fs);
    if (def.found) {
      // TODO Currently the join usage is always equivalent to the reference path here;
      // if/when we add namespaces, this will not be the case, and we will need to get the
      // join path from `getField` / `lookup`
      const fieldUsage: FieldUsage[] =
        def.found.refType === 'field'
          ? [
              {
                path: this.fieldReference.list.map(n => n.name),
                at: this.fieldReference.location,
              },
            ]
          : [];
      const td = def.found.typeDesc();
      if (def.isOutputField) {
        return {
          ...td,
          // TODO what about literal??
          evalSpace: td.evalSpace === 'constant' ? 'constant' : 'output',
          value: {node: 'outputField', name: this.refString},
          fieldUsage,
        };
      }
      const value = {
        node: def.found.refType,
        path: this.fieldReference.path,
        at: this.fieldReference.location,
      };
      // We think that aggregates are more 'output' like, but maybe we will reconsider that...
      const evalSpace = expressionIsAggregate(td.expressionType)
        ? 'output'
        : td.evalSpace;
      return {
        ...td,
        value,
        evalSpace,
        fieldUsage,
        requiresGroupBy: undefined,
      };
    }
    return this.loggedErrorExpr(def.error.code, def.error.message);
  }
}
