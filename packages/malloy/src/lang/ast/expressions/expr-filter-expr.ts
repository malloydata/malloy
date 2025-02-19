/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {errorFor} from '../ast-utils';
import {BinaryMalloyOperator} from '../types/binary_operators';
import {ExprValue, computedExprValue} from '../types/expr-value';
import {ExpressionDef} from '../types/expression-def';
import {FieldSpace} from '../types/field-space';
import {FilterMatchExpr, isFilterExprType} from '../../../model';

export class ExprFilterExpression extends ExpressionDef {
  elementType = 'filter expression literal';
  constructor(readonly filterText: string) {
    super();
    // mtoy todo parse the filter and reflect errors into the error stream
  }

  getExpression(): ExprValue {
    this.logError(
      'filter-expression-type',
      "Missing application of '?' operator, expression cannot have a filter value"
    );
    return errorFor('illegal-filter-valued-expression');
  }

  apply(
    fs: FieldSpace,
    op: BinaryMalloyOperator,
    left: ExpressionDef,
    _warnOnComplexTree = false
  ): ExprValue {
    if (op === '~' || op === '!~') {
      const matchExpr = left.getExpression(fs);
      if (matchExpr.type === 'error') {
        return matchExpr;
      }
      if (isFilterExprType(matchExpr.type)) {
        const filterMatch: FilterMatchExpr = {
          node: 'filterMatch',
          dataType: matchExpr.type,
          filter: this.filterText,
          e: matchExpr.value,
        };
        if (op === '!~') {
          filterMatch.notMatch = true;
        }
        return computedExprValue({
          value: filterMatch,
          dataType: {type: 'boolean'},
          from: [matchExpr],
        });
      }
      left.logError(
        'filter-expression-type',
        `Cannot use filter expressions with type '${matchExpr.type}'`
      );
      return errorFor('cant-filter-type-' + matchExpr.type);
    }
    this.logError(
      'filter-expression-type',
      `Cannot use the '${op}' operator with a filter expression`
    );
    return errorFor('illegal-filter-valued-apply');
  }
}
