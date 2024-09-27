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
  By as ModelBy,
  expressionIsAggregate,
  expressionIsAnalytic,
} from '../../../model/malloy_types';

import {ExpressionDef} from '../types/expression-def';
import {FieldName, FieldSpace} from '../types/field-space';
import {MalloyElement} from '../types/malloy-element';
import {
  LegalRefinementStage,
  QueryPropertyInterface,
} from '../types/query-property-interface';

type TopInit = FieldName | ExpressionDef;

export class Top extends MalloyElement implements QueryPropertyInterface {
  elementType = 'top';
  queryRefinementStage = LegalRefinementStage.Tail;
  forceQueryClass = undefined;

  constructor(
    readonly limit: number,
    readonly by?: TopInit
  ) {
    super();
    this.has({by: by});
  }

  getBy(fs: FieldSpace): ModelBy | undefined {
    if (this.by) {
      if (this.by instanceof FieldName) {
        if (fs.isQueryFieldSpace()) {
          // TODO jump-to-definition now that we can lookup fields in the output space,
          // we need to actually add the reference when we do so.
          const output = fs.outputSpace();
          const entry = this.by.getField(output);
          if (entry.error) {
            this.by.logError(entry.error.code, entry.error.message);
          }
          if (!entry.found || !entry.isOutputField) {
            this.by.logError(
              'top-by-not-found-in-output',
              `Unknown field ${this.by.refString} in output space`
            );
          }
          if (expressionIsAnalytic(entry.found?.typeDesc().expressionType)) {
            this.by.logError(
              'top-by-analytic',
              `Illegal order by of analytic field ${this.by.refString}`
            );
          }
        }
        return {by: 'name', name: this.by.refString};
      } else {
        const byExpr = this.by.getExpression(fs);
        if (expressionIsAggregate(byExpr.expressionType)) {
          this.by.logError(
            'top-by-aggregate',
            'top by expression must not be an aggregate'
          );
        }
        if (byExpr.evalSpace === 'output') {
          this.by.logError(
            'top-by-not-in-output',
            'top by expression must be an output expression'
          );
        }
        return {by: 'expression', e: byExpr.value};
      }
    }
    return undefined;
  }
}
