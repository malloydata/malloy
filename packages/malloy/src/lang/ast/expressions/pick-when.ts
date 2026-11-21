/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import * as TDU from '../typedesc-utils';
import type {BinaryMalloyOperator} from '../types/binary_operators';
import type {ExprValue} from '../types/expr-value';
import {ATNodeType, ExpressionDef} from '../types/expression-def';
import type {Misfit, Unsettled, ValueOrRange} from '../types/morphic-value';
import {choice, isMisfit, settle, startOf} from '../types/morphic-value';
import type {FieldSpace} from '../types/field-space';
import {MalloyElement} from '../types/malloy-element';
import {applyTest} from './apply-test';
import {booleanValueError, CHOICE_HINT} from './boolean-value';

export class Pick extends ExpressionDef {
  elementType = 'pick';
  constructor(
    readonly choices: PickWhen[],
    readonly elsePick?: ExpressionDef
  ) {
    super({choices});
    this.has({elsePick});
  }

  requestExpression(fs: FieldSpace): ExprValue | undefined {
    // pick statements are sometimes partials which must be applied
    // and sometimes have a value.
    if (this.elsePick === undefined) {
      return undefined;
    }
    for (const c of this.choices) {
      if (c.pick === undefined) {
        return undefined;
      }
      const whenResp = c.when.requestExpression(fs);
      if (whenResp === undefined || whenResp.type !== 'boolean') {
        // If when is not a boolean, we'll treat it like a partial compare
        return undefined;
      }
    }
    return this.getExpression(fs);
  }

  /**
   * The case expression for these conditions and the value each selects,
   * the last value being the one for when no condition holds.
   */
  private picked(
    fs: FieldSpace,
    whens: ExprValue[],
    picks: ValueOrRange[],
    alsoFrom: ExprValue[]
  ): ValueOrRange | Misfit {
    const picked = choice(
      picks,
      values => ({
        node: 'case',
        kids: {
          caseWhen: whens.map(w => w.value),
          caseThen: values.slice(0, -1),
          caseElse: values[values.length - 1],
        },
      }),
      [...whens, ...alsoFrom]
    );
    if (isMisfit(picked)) {
      return picked;
    }
    if (picked.type === 'filter expression') {
      return this.loggedErrorExpr(
        'filter-expression-error',
        'Pick statments cannot have filter expression values'
      );
    }
    return (
      booleanValueError(
        fs,
        picked,
        'as the result of a pick',
        this,
        CHOICE_HINT
      ) ?? picked
    );
  }

  /**
   * `?` applies a pick, an operator written in the source compares with the
   * value of a pick.
   */
  apply(
    fs: FieldSpace,
    op: BinaryMalloyOperator,
    expr: ExpressionDef,
    byApplyOperator = false
  ): Unsettled {
    if (!byApplyOperator) {
      return super.apply(fs, op, expr);
    }
    return startOf(this.applyValueOrRange(fs, expr));
  }

  /**
   * An applied pick, `x ? pick a when … else b`, as `?` computes it: the same
   * choice as a pick with ordinary conditions, so it is a range when its
   * alternatives are spans
   */
  applyValueOrRange(fs: FieldSpace, expr: ExpressionDef): ValueOrRange {
    const whens: ExprValue[] = [];
    for (const c of this.choices) {
      // Each `when` is read as it would be read alone after `?`
      const when = settle(startOf(applyTest(fs, expr, c.when, this)));
      if (when.type !== 'boolean' && when.type !== 'error') {
        return c.when.loggedErrorExpr('applied-is-not-a-test', {
          resultType: when.type,
        });
      }
      whens.push(when);
    }
    const applyTo = expr.getValueOrRange(fs);
    const picks = this.choices.map(c => c.pick?.getValueOrRange(fs) ?? applyTo);
    const elseVal = this.elsePick?.getValueOrRange(fs);
    const picked = this.picked(
      fs,
      whens,
      [...picks, elseVal ?? applyTo],
      elseVal ? [settle(startOf(applyTo))] : []
    );
    return isMisfit(picked)
      ? this.misfitError(picked, picks.length, this)
      : picked;
  }

  atNodeType(byApplyOperator = false): ATNodeType {
    return byApplyOperator ? ATNodeType.Applied : ATNodeType.Value;
  }

  /**
   * The error for an alternative whose type does not fit: a branch, the
   * else, or for an applied pick with no else, the value it is applied to
   */
  private misfitError(
    misfit: Misfit,
    branches: number,
    elseAt: ExpressionDef
  ): ExprValue {
    if (misfit.misfitAt < branches) {
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

  protected computeExpression(fs: FieldSpace): ValueOrRange {
    // The shapes which make this a pick to be applied are reported first, as
    // the way out of all of them is the same.
    for (const c of this.choices) {
      if (c.pick === undefined) {
        return this.loggedErrorExpr('pick-missing-value', {});
      }
      if (c.when.requestExpression(fs) === undefined) {
        return c.when.loggedErrorExpr('pick-illegal-partial', {});
      }
    }
    if (this.elsePick === undefined) {
      return this.loggedErrorExpr('pick-missing-else', {});
    }
    const whens: ExprValue[] = [];
    const picks: ValueOrRange[] = [];
    for (const c of this.choices) {
      if (c.pick === undefined) {
        throw this.internalError(
          'a pick with nothing to pick was already refused'
        );
      }
      picks.push(c.pick.getValueOrRange(fs));
      whens.push(c.when.getExpression(fs));
    }
    for (const when of whens) {
      if (!TDU.typeEq(when, TDU.boolT)) {
        return this.loggedErrorExpr('pick-when-must-be-boolean', {
          whenType: when.type,
        });
      }
    }
    const picked = this.picked(
      fs,
      whens,
      [...picks, this.elsePick.getValueOrRange(fs)],
      []
    );
    return isMisfit(picked)
      ? this.misfitError(picked, picks.length, this.elsePick)
      : picked;
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
