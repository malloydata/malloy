/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import * as TDU from '../typedesc-utils';
import type {ExprValue} from '../types/expr-value';
import {ExpressionDef} from '../types/expression-def';
import type {FieldSpace} from '../types/field-space';
import type {Forms} from '../types/forms';
import {choose, defaultMoment, formsOf, isMisfit} from '../types/forms';
import {booleanValueError, CONDITION_HINT} from './boolean-value';

export class ExprCoalesce extends ExpressionDef {
  elementType = 'coalesce expression';
  legalChildTypes = TDU.anyAtomicT;
  constructor(
    readonly expr: ExpressionDef,
    readonly altExpr: ExpressionDef
  ) {
    super({expr, altExpr});
  }

  protected computeExpression(fs: FieldSpace): ExprValue {
    return defaultMoment(this.computeForms(fs));
  }

  protected computeForms(fs: FieldSpace): Forms {
    const maybeNullForms = this.expr.getForms(fs);
    const whenNullForms = this.altExpr.getForms(fs);
    const maybeNull = defaultMoment(maybeNullForms);
    const whenNull = defaultMoment(whenNullForms);
    const noCoalesce = booleanValueError(
      fs,
      maybeNull,
      'in ??',
      this,
      CONDITION_HINT
    );
    if (noCoalesce) return formsOf(noCoalesce);
    if (maybeNull.type === 'null') {
      return whenNullForms;
    }
    /**
     * Could maybe walk altExpr to combine all the times that altExpr
     * is also an ExprCoalesce into a single fragment. Not doing that now.
     */
    const chosen = choose([maybeNullForms, whenNullForms], ([left, right]) => ({
      node: 'coalesce',
      kids: {left, right},
    }));
    // A null alternative fits any choice, but `??` with a null has nothing
    // to supply
    if (
      isMisfit(chosen) ||
      (whenNull.type === 'null' && maybeNull.type !== 'error')
    ) {
      this.logError(
        'mismatched-coalesce-types',
        `Mismatched types for coalesce (${maybeNull.type}, ${whenNull.type})`
      );
    }
    if (isMisfit(chosen)) {
      return formsOf(maybeNull.type === 'error' ? whenNull : maybeNull);
    }
    return chosen;
  }
}
