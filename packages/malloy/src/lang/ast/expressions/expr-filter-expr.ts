/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type {BinaryMalloyOperator} from '../types/binary_operators';
import type {ExprValue} from '../types/expr-value';
import {computedExprValue} from '../types/expr-value';
import {ExpressionDef} from '../types/expression-def';
import type {FieldSpace} from '../types/field-space';
import type {FilterMatchExpr} from '../../../model';
import type {FilterParserResponse, ClauseBase} from '@malloydata/malloy-filter';
import {
  StringFilterExpression,
  BooleanFilterExpression,
  NumberFilterExpression,
  TemporalFilterExpression,
} from '@malloydata/malloy-filter';

export class ExprFilterExpression extends ExpressionDef {
  elementType = 'filter expression literal';
  constructor(readonly filterText: string) {
    super();
    // mtoy todo parse the filter and reflect errors into the error stream
  }

  getExpression(): ExprValue {
    return this.loggedErrorExpr(
      'filter-expression-type',
      'Filter expression illegal here'
    );
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
      let fParse: FilterParserResponse<ClauseBase>;
      switch (matchExpr.type) {
        case 'string':
          fParse = StringFilterExpression.parse(this.filterText);
          break;
        case 'number':
          fParse = NumberFilterExpression.parse(this.filterText);
          break;
        case 'boolean':
          if (fs.dialectObj()?.booleanAsNumbers) {
            return this.loggedErrorExpr(
              'filter-expression-type',
              'Boolean filters not supported on this connection type'
            );
          }
          fParse = BooleanFilterExpression.parse(this.filterText);
          break;
        case 'date':
        case 'timestamp':
          fParse = TemporalFilterExpression.parse(this.filterText);
          break;
        default:
          return left.loggedErrorExpr(
            'filter-expression-type',
            `Cannot use filter expressions with type '${matchExpr.type}'`
          );
      }
      if (fParse.log.length > 0) {
        for (const _err of fParse.log) {
          // mtoy todo actuall get error and report correct position and error type
          return this.loggedErrorExpr(
            'filter-expression-type',
            `Filter parse error: ${fParse.log[0].message}`
          );
        }
      }
      if (!fParse.parsed) {
        return this.loggedErrorExpr(
          'filter-expression-type',
          'FJKLD:JDKSL: expression parsed to null'
        );
      }
      const filterMatch: FilterMatchExpr = {
        node: 'filterMatch',
        dataType: matchExpr.type,
        filter: fParse.parsed,
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
    return this.loggedErrorExpr(
      'filter-expression-type',
      `Cannot use the '${op}' operator with a filter expression`
    );
  }
}
