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

import type {FilterCondition} from '../../../model/malloy_types';
import {
  expressionIsAggregate,
  expressionIsAnalytic,
} from '../../../model/malloy_types';
import {isNotUndefined} from '../../utils';

import type {ExpressionDef} from '../types/expression-def';
import type {FieldSpace} from '../types/field-space';
import {ListOf, MalloyElement} from '../types/malloy-element';
import type {QueryBuilder} from '../types/query-builder';
import type {QueryPropertyInterface} from '../types/query-property-interface';
import {LegalRefinementStage} from '../types/query-property-interface';

export class FilterElement extends MalloyElement {
  elementType = 'filterElement';
  constructor(
    readonly expr: ExpressionDef,
    readonly exprSrc: string
  ) {
    super({expr: expr});
  }

  filterCondition(fs: FieldSpace): FilterCondition {
    const exprVal = this.expr.getExpression(fs);
    if (exprVal.type !== 'boolean') {
      this.expr.logError(
        'non-boolean-filter',
        'Filter expression must have boolean value'
      );
      return {
        node: 'filterCondition',
        code: this.exprSrc,
        e: {node: 'false'},
        expressionType: 'scalar',
        compositeFieldUsage: exprVal.compositeFieldUsage,
      };
    }
    const exprCond: FilterCondition = {
      node: 'filterCondition',
      code: this.exprSrc,
      e: exprVal.value,
      expressionType: exprVal.expressionType,
      compositeFieldUsage: exprVal.compositeFieldUsage,
    };
    return exprCond;
  }
}

export class Filter
  extends ListOf<FilterElement>
  implements QueryPropertyInterface
{
  elementType = 'filter';
  havingClause?: boolean;
  forceQueryClass = undefined;
  queryRefinementStage = LegalRefinementStage.Head;

  set having(isHaving: boolean) {
    this.elementType = isHaving ? 'having' : 'where';
    this.havingClause = isHaving;
    this.queryRefinementStage = isHaving
      ? LegalRefinementStage.Tail
      : LegalRefinementStage.Head;
  }

  protected checkedFilterCondition(
    fs: FieldSpace,
    filter: FilterElement
  ): FilterCondition | undefined {
    const fExpr = filter.filterCondition(fs);

    // Aggregates are ALSO checked at SQL generation time, but checking
    // here allows better reflection of errors back to user.
    if (this.havingClause !== undefined) {
      const isAggregate = expressionIsAggregate(fExpr.expressionType);
      const isAnalytic = expressionIsAnalytic(fExpr.expressionType);
      if (this.havingClause) {
        if (isAnalytic) {
          filter.logError(
            'analytic-in-having',
            'Analytic expressions are not allowed in `having:`'
          );
          return;
        }
      } else {
        if (isAnalytic) {
          filter.logError(
            'analytic-in-where',
            'Analytic expressions are not allowed in `where:`'
          );
          return;
        } else if (isAggregate) {
          filter.logError(
            'aggregate-in-where',
            'Aggregate expressions are not allowed in `where:`; use `having:`'
          );
        }
      }
    }
    return fExpr;
  }

  getFilterList(fs: FieldSpace): FilterCondition[] {
    return this.list
      .map(filter => this.checkedFilterCondition(fs, filter))
      .filter(isNotUndefined);
  }

  queryExecute(executeFor: QueryBuilder) {
    const filterFS = this.havingClause
      ? executeFor.resultFS
      : executeFor.inputFS;
    for (const filter of this.list) {
      const fExpr = this.checkedFilterCondition(filterFS, filter);
      if (fExpr !== undefined) {
        executeFor.filters.push(fExpr);
        executeFor.resultFS.addCompositeFieldUserFromFilter(fExpr, filter);
      }
    }
  }
}
