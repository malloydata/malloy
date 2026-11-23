/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {CaseExpr, Expr} from '../../../model/malloy_types';

import * as TDU from '../typedesc-utils';
import type {BinaryMalloyOperator} from '../types/binary_operators';
import type {ExprValue} from '../types/expr-value';
import {ATNodeType, ExpressionDef} from '../types/expression-def';
import type {FieldSpace} from '../types/field-space';
import type {Forms, Misfit} from '../types/forms';
import {choose, defaultMoment, formsOf, isMisfit} from '../types/forms';
import {MalloyElement} from '../types/malloy-element';
import {booleanValueError, CHOICE_HINT} from './boolean-value';

/** A `CASE` of these conditions, choosing among `parts`, the last the else */
function caseOf(whens: Expr[]): (parts: Expr[]) => CaseExpr {
  return parts => ({
    node: 'case',
    kids: {
      caseWhen: whens,
      caseThen: parts.slice(0, whens.length),
      caseElse: parts[whens.length],
    },
  });
}

export class Pick extends ExpressionDef {
  elementType = 'pick';
  constructor(
    readonly choices: PickWhen[],
    readonly elsePick?: ExpressionDef
  ) {
    super({choices});
    this.has({elsePick});
  }

  /**
   * A pick has a value when it has an `else`, a result in every arm, and a
   * condition in every `when`. Any other pick is waiting for a left side.
   */
  requestExpression(fs: FieldSpace): ExprValue | undefined {
    if (this.elsePick === undefined) {
      return undefined;
    }
    for (const c of this.choices) {
      if (c.pick === undefined) {
        return undefined;
      }
      const whenResp = c.when.requestExpression(fs);
      if (whenResp === undefined || whenResp.type !== 'boolean') {
        return undefined;
      }
    }
    return this.getExpression(fs);
  }

  /**
   * `?` applies a pick, except one with a value which has a range: the left
   * side is applied to each `when`. An operator written in the source
   * compares with the value of the pick.
   */
  apply(
    fs: FieldSpace,
    op: BinaryMalloyOperator,
    expr: ExpressionDef,
    byApplyOperator = false
  ): ExprValue {
    if (!byApplyOperator) {
      return super.apply(fs, op, expr);
    }
    return defaultMoment(this.applyForms(fs, expr));
  }

  /** The pick applied to `expr`: a choice like any other */
  applyForms(fs: FieldSpace, expr: ExpressionDef): Forms {
    const whens: ExprValue[] = [];
    for (const choice of this.choices) {
      const whenExpr = choice.when.apply(fs, '=', expr, true);
      if (whenExpr.type !== 'boolean' && whenExpr.type !== 'error') {
        return formsOf(
          choice.when.loggedErrorExpr('applied-is-not-a-test', {
            resultType: whenExpr.type,
          })
        );
      }
      whens.push(whenExpr);
    }
    const results = [
      ...this.choices.map(c => (c.pick ?? expr).getForms(fs)),
      (this.elsePick ?? expr).getForms(fs),
    ];
    const chosen = choose(results, caseOf(whens.map(w => w.value)), whens);
    if (isMisfit(chosen)) {
      return formsOf(this.logMisfit(chosen, this));
    }
    return this.checked(fs, chosen);
  }

  atNodeType(byApplyOperator = false): ATNodeType {
    return byApplyOperator ? ATNodeType.Applied : ATNodeType.Value;
  }

  protected computeExpression(fs: FieldSpace): ExprValue {
    return defaultMoment(this.computeForms(fs));
  }

  protected computeForms(fs: FieldSpace): Forms {
    // The shapes which make this a pick waiting for a left side are reported
    // first, as the way out of all of them is the same.
    for (const c of this.choices) {
      if (c.pick === undefined) {
        return formsOf(this.loggedErrorExpr('pick-missing-value', {}));
      }
      if (c.when.requestExpression(fs) === undefined) {
        return formsOf(c.when.loggedErrorExpr('pick-illegal-partial', {}));
      }
    }
    if (this.elsePick === undefined) {
      return formsOf(this.loggedErrorExpr('pick-missing-else', {}));
    }
    // Every arm is evaluated before any is checked, so an error inside a
    // result is reported along with a `when` of the wrong type
    const results: Forms[] = [];
    const whens: ExprValue[] = [];
    for (const c of this.choices) {
      if (c.pick === undefined) {
        throw this.internalError(
          'a pick with nothing to pick was already refused'
        );
      }
      results.push(c.pick.getForms(fs));
      whens.push(c.when.getExpression(fs));
    }
    results.push(this.elsePick.getForms(fs));
    for (const when of whens) {
      if (!TDU.typeEq(when, TDU.boolT)) {
        return formsOf(
          this.loggedErrorExpr('pick-when-must-be-boolean', {
            whenType: when.type,
          })
        );
      }
    }
    const chosen = choose(results, caseOf(whens.map(w => w.value)), whens);
    if (isMisfit(chosen)) {
      return formsOf(this.logMisfit(chosen, this.elsePick));
    }
    return this.checked(fs, chosen);
  }

  /**
   * The error for an arm whose type does not fit the arms before it; one
   * about the `else` is logged at `elseAt`.
   */
  private logMisfit(misfit: Misfit, elseAt: MalloyElement): ExprValue {
    if (misfit.misfitAt < this.choices.length) {
      return this.loggedErrorExpr('pick-type-does-not-match', {
        pickType: misfit.found,
        returnType: misfit.expected,
      });
    }
    if (this.elsePick) {
      return elseAt.loggedErrorExpr('pick-else-type-does-not-match', {
        elseType: misfit.found,
        returnType: misfit.expected,
      });
    }
    return this.loggedErrorExpr('pick-default-type-does-not-match', {
      defaultType: misfit.found,
      returnType: misfit.expected,
    });
  }

  /** The choice, or the error for a result a pick cannot have */
  private checked(fs: FieldSpace, chosen: Forms): Forms {
    const value = defaultMoment(chosen);
    if (value.type === 'filter expression') {
      return formsOf(
        this.loggedErrorExpr(
          'filter-expression-error',
          'Pick statments cannot have filter expression values'
        )
      );
    }
    const noPick = booleanValueError(
      fs,
      value,
      'as the result of a pick',
      this,
      CHOICE_HINT
    );
    return noPick ? formsOf(noPick) : chosen;
  }
}

export class PickWhen extends MalloyElement {
  elementType = 'caseWhen';
  constructor(
    readonly pick: ExpressionDef | undefined,
    readonly when: ExpressionDef
  ) {
    super({when: when});
    this.has({pick: pick});
  }
}
