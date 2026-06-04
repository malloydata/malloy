/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {maxExpressionType, mergeEvalSpaces} from '../../../model';
import {mergeRefSummaries} from '../../composite-source-utils';
import * as TDU from '../typedesc-utils';
import type {ExprValue} from '../types/expr-value';
import {ExpressionDef} from '../types/expression-def';
import type {FieldSpace} from '../types/field-space';

export class ExprCoalesce extends ExpressionDef {
  elementType = 'coalesce expression';
  legalChildTypes = TDU.anyAtomicT;
  constructor(
    readonly expr: ExpressionDef,
    readonly altExpr: ExpressionDef
  ) {
    super({expr, altExpr});
  }

  getExpression(fs: FieldSpace): ExprValue {
    const maybeNull = this.expr.getExpression(fs);
    const whenNull = this.altExpr.getExpression(fs);
    if (maybeNull.type === 'null') {
      return whenNull;
    }
    /**
     * Could maybe walk altExpr to combine all the times that altExpr
     * is also an ExprCoalesce into a single fragment. Not doing that now.
     *
     * Also this should maybe generate a dialect fragment and not write
     * SQL, but I decided that is will happen when the "expressions are true
     * trees" rewrite happens.
     */
    if (!TDU.typeEq(maybeNull, whenNull)) {
      this.logError(
        'mismatched-coalesce-types',
        `Mismatched types for coalesce (${maybeNull.type}, ${whenNull.type})`
      );
    }
    const srcForType = maybeNull.type === 'error' ? whenNull : maybeNull;
    // If both are numbers but subtypes differ, strip the subtype
    const stripNumberType =
      srcForType.type === 'number' &&
      maybeNull.type === 'number' &&
      whenNull.type === 'number' &&
      maybeNull.numberType !== whenNull.numberType;
    return {
      ...srcForType,
      ...(stripNumberType ? {numberType: undefined} : {}),
      expressionType: maxExpressionType(
        maybeNull.expressionType,
        whenNull.expressionType
      ),
      value: {
        node: 'coalesce',
        kids: {left: maybeNull.value, right: whenNull.value},
      },
      evalSpace: mergeEvalSpaces(maybeNull.evalSpace, whenNull.evalSpace),
      refSummary: mergeRefSummaries(maybeNull.refSummary, whenNull.refSummary),
    };
  }
}
