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
  expressionIsCalculation,
  FilterExpression,
} from '../../../model/malloy_types';

import {compressExpr} from '../expressions/utils';
import {ExpressionDef} from '../types/expression-def';
import {FieldSpace} from '../types/field-space';
import {ListOf, MalloyElement} from '../types/malloy-element';

export class FilterElement extends MalloyElement {
  elementType = 'filterElement';
  constructor(readonly expr: ExpressionDef, readonly exprSrc: string) {
    super({expr: expr});
  }

  filterExpression(fs: FieldSpace): FilterExpression {
    const exprVal = this.expr.getExpression(fs);
    if (exprVal.dataType !== 'boolean') {
      this.expr.log('Filter expression must have boolean value');
      return {
        code: this.exprSrc,
        expression: ['_FILTER_MUST_RETURN_BOOLEAN_'],
        expressionType: 'scalar',
      };
    }
    const exprCond: FilterExpression = {
      code: this.exprSrc,
      expression: compressExpr(exprVal.value),
      expressionType: exprVal.expressionType,
    };
    return exprCond;
  }
}

export class Filter extends ListOf<FilterElement> {
  elementType = 'filter';
  // TODO(maden): Check this field usage/need
  private readonly havingClause?: boolean;
  constructor(elements: FilterElement[] = []) {
    super('filterElements', elements);
  }

  set having(isHaving: boolean) {
    this.elementType = isHaving ? 'having' : 'where';
  }

  getFilterList(fs: FieldSpace): FilterExpression[] {
    const checked: FilterExpression[] = [];
    for (const oneElement of this.list) {
      const fExpr = oneElement.filterExpression(fs);
      // Aggregates are ALSO checked at SQL generation time, but checking
      // here allows better reflection of errors back to user.
      if (this.havingClause !== undefined) {
        if (this.havingClause) {
          // TODO I don't understand how this is working currently? This seems to imply
          // that a calculation is NOT allowed, but it is...? It appears maybe this code
          // just isn't being called.
          if (expressionIsCalculation(fExpr.expressionType)) {
            oneElement.log(
              'Aggregate or analytic expression expected in HAVING filter'
            );
            continue;
          }
        } else {
          if (expressionIsCalculation(fExpr.expressionType)) {
            oneElement.log(
              'Aggregate or analytic expressions not allowed in WHERE'
            );
            continue;
          }
        }
      }
      checked.push(fExpr);
    }
    return checked;
  }
}
