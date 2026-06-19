/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type * as Malloy from '@malloydata/malloy-interfaces';
import type {FilterCondition} from '../../../model/malloy_types';
import {
  expressionIsAggregate,
  expressionIsAnalytic,
} from '../../../model/malloy_types';
import {isNotUndefined} from '../../utils';
import {ExprCompare, ExprEquality} from '../expressions/expr-compare';
import {ExprIdReference} from '../expressions/expr-id-reference';
import type {FieldReference} from '../query-items/field-references';

import type {ExpressionDef} from '../types/expression-def';
import type {FieldSpace} from '../types/field-space';
import {isLiteral, type Literal} from '../types/literal';
import {ListOf, MalloyElement} from '../types/malloy-element';
import type {QueryBuilder} from '../types/query-builder';
import type {QueryPropertyInterface} from '../types/query-property-interface';
import {LegalRefinementStage} from '../types/query-property-interface';
import {ExprFilterExpression} from '../expressions/expr-filter-expr';

export class FilterElement extends MalloyElement {
  elementType = 'filterElement';
  constructor(
    readonly expr: ExpressionDef,
    readonly exprSrc: string
  ) {
    super({expr: expr});
  }

  private getStableFilter(): Malloy.Filter | undefined {
    if (
      this.expr instanceof ExprEquality &&
      this.expr.op === '=' &&
      isLiteral(this.expr.right)
    ) {
      const lhs = this.expr.left.drillExpression();
      if (lhs === undefined) return undefined;
      return {
        kind: 'literal_equality',
        expression: lhs,
        value: this.expr.right.getStableLiteral(),
      };
    } else if (
      this.expr instanceof ExprCompare &&
      this.expr.op === '~' &&
      this.expr.right instanceof ExprFilterExpression
    ) {
      const lhs = this.expr.left.drillExpression();
      if (lhs === undefined) return undefined;
      return {
        kind: 'filter_string',
        expression: lhs,
        filter: this.expr.right.filterText,
      };
    }
    return undefined;
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
        refSummary: exprVal.refSummary,
        isSourceFilter: false,
      };
    }
    const stableFilter = this.getStableFilter();
    const exprCond: FilterCondition = {
      node: 'filterCondition',
      code: this.exprSrc,
      e: exprVal.value,
      expressionType: exprVal.expressionType,
      refSummary: exprVal.refSummary,
      stableFilter,
      isSourceFilter: false,
    };
    return exprCond;
  }

  filterExpressionFilter():
    | {
        reference: FieldReference;
        filterExpression: string;
      }
    | undefined {
    if (
      this.expr instanceof ExprCompare &&
      this.expr.op === '~' &&
      this.expr.left instanceof ExprIdReference &&
      this.expr.right instanceof ExprFilterExpression
    ) {
      return {
        reference: this.expr.left.fieldReference,
        filterExpression: this.expr.right.filterText,
      };
    }
    return undefined;
  }

  drillFilter():
    | {
        reference: FieldReference;
        value: Literal;
      }
    | undefined {
    if (
      this.expr instanceof ExprEquality &&
      this.expr.op === '=' &&
      this.expr.left instanceof ExprIdReference &&
      isLiteral(this.expr.right)
    ) {
      return {
        reference: this.expr.left.fieldReference,
        value: this.expr.right as Literal,
      };
    }
    return undefined;
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
        executeFor.resultFS.addFieldUserFromFilter(fExpr);
      }
    }
  }
}
