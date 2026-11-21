/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import * as TDU from '../typedesc-utils';
import {ExpressionDef} from '../types/expression-def';
import type {FieldSpace} from '../types/field-space';
import type {ValueOrRange} from '../types/morphic-value';
import {choice, isMisfit, settle, startOf} from '../types/morphic-value';
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

  protected computeExpression(fs: FieldSpace): ValueOrRange {
    const maybeNull = this.expr.getValueOrRange(fs);
    const whenNull = this.altExpr.getValueOrRange(fs);
    const noCoalesce = booleanValueError(
      fs,
      maybeNull,
      'in ??',
      this,
      CONDITION_HINT
    );
    if (noCoalesce) return noCoalesce;
    if (maybeNull.type === 'null') {
      return whenNull;
    }
    const coalesced = choice([maybeNull, whenNull], ([left, right]) => ({
      node: 'coalesce',
      kids: {left, right},
    }));
    if (isMisfit(coalesced)) {
      return this.loggedErrorExpr(
        'mismatched-coalesce-types',
        `Mismatched types for coalesce (${coalesced.expected}, ${coalesced.found})`
      );
    }
    if (whenNull.type === 'null' && maybeNull.type !== 'error') {
      return this.loggedErrorExpr(
        'mismatched-coalesce-types',
        `Mismatched types for coalesce (${settle(startOf(maybeNull)).type}, null)`
      );
    }
    return coalesced;
  }
}
