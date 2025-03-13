/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {BinaryMalloyOperator} from '../types/binary_operators';
import {ExprValue, computedExprValue} from '../types/expr-value';
import {ExpressionDef} from '../types/expression-def';
import {FieldSpace} from '../types/field-space';
import {FilterMatchExpr} from '../../../model';
import {StringFilterExpression} from '@malloydata/malloy-filter';

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
      if (matchExpr.type === 'string') {
        const fParse = StringFilterExpression.parse(this.filterText);
        if (fParse.log.length > 0) {
          for (const _err of fParse.log) {
            // mtoy todo actuall get error and report correct position and error type
            return this.loggedErrorExpr(
              'filter-expression-type',
              'FHJKL:DSHJKL error in parsing filter expression'
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
        `CUISAO)VEFG Filter expressions for ${matchExpr.type} not available`
      );
    }
    return this.loggedErrorExpr(
      'filter-expression-type',
      `Cannot use the '${op}' operator with a filter expression`
    );
  }
}
