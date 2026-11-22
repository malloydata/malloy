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
import {applyTest} from './apply-test';
import {Boolean} from './boolean';
import {booleanValueError, CHOICE_HINT} from './boolean-value';

/** Source text as one operand of `not`, `and` or `=` */
function operand(text: string): string {
  return /^[\w.$`]+$/.test(text) ? text : `(${text})`;
}

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
   * A complete pick has a value: an `else`, a result in every arm, and a
   * condition in every `when`. Any other pick is waiting for a left side.
   * The literal `true` or `false` is something to match against, not a
   * condition: a flag which a database holds as a number is not a boolean
   * here, and `flag ? pick 1 when true else 0` must still match it.
   */
  requestExpression(fs: FieldSpace): ExprValue | undefined {
    if (this.elsePick === undefined) {
      return undefined;
    }
    for (const c of this.choices) {
      if (c.pick === undefined || c.when instanceof Boolean) {
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
   * `?` reaches this only for a pick waiting for a left side: the left side
   * is applied to each `when`. An operator written in the source compares
   * with the value of the pick.
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

  /** The pick waiting for `expr`, applied to it: a choice like any other */
  applyForms(fs: FieldSpace, expr: ExpressionDef): Forms {
    const whens: ExprValue[] = [];
    for (const choice of this.choices) {
      const whenExpr = applyTest(fs, expr, choice.when, this);
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

  /**
   * A boolean `x` against a complete pick is compared with the value the
   * pick chooses. When that value is not a boolean, the author almost
   * certainly meant to match `x` against each `when`, so this is an error
   * which shows that pick written without `?`, even where a database would
   * compare the two. When it is a boolean, either reading is plausible, so
   * this is a warning which shows the spelling that matches.
   */
  testEquality(fs: FieldSpace, left: ExpressionDef): ExprValue {
    const x = left.getExpression(fs);
    const value = this.getExpression(fs);
    if (
      x.type === 'boolean' &&
      !['boolean', 'null', 'error'].includes(value.type)
    ) {
      return left.loggedErrorExpr(
        'comparison-type-mismatch',
        `\`${left.code}\` is compared with the value the pick chooses, which is a ${value.type}, not a boolean. To match \`${left.code}\` against each \`when\`, write \`${this.matchingSpelling(fs, left.code)}\``
      );
    }
    if (x.type === 'boolean' && value.type === 'boolean') {
      left.logWarning(
        'pick-boolean-compared-with-arm',
        `\`${left.code}\` is compared with the arm the pick chooses. To match \`${left.code}\` against each \`when\` instead, write \`${left.code} ? ${this.equalsSpelling()}\``
      );
    }
    return super.testEquality(fs, left);
  }

  /** This pick, with each `when` written as `when = w` */
  private equalsSpelling(): string {
    const arms = this.choices.map(
      c => `pick ${c.pick?.code ?? ''} when = ${c.when.code}`
    );
    const otherwise = this.elsePick ? ` else ${this.elsePick.code}` : '';
    return `${arms.join(' ')}${otherwise}`;
  }

  /** This pick, with each `when` matching `x` instead of testing a condition */
  private matchingSpelling(fs: FieldSpace, x: string): string {
    const noBooleans = fs.dialectObj()?.booleanType === 'none';
    const matches = (when: ExpressionDef): string => {
      const [a, b] = [operand(x), operand(when.code)];
      return noBooleans
        ? `(${a} and ${b}) or (not ${a} and not ${b})`
        : `(not ${a}) = (not ${b})`;
    };
    const arms = this.choices.map(
      c => `pick ${c.pick?.code ?? x} when ${matches(c.when)}`
    );
    const otherwise = this.elsePick ? ` else ${this.elsePick.code}` : '';
    return `${arms.join(' ')}${otherwise}`;
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
    const whens = this.choices.map(c => c.when.getExpression(fs));
    for (const when of whens) {
      if (!TDU.typeEq(when, TDU.boolT)) {
        return formsOf(
          this.loggedErrorExpr('pick-when-must-be-boolean', {
            whenType: when.type,
          })
        );
      }
    }
    const results: Forms[] = [];
    for (const c of this.choices) {
      if (c.pick === undefined) {
        throw this.internalError(
          'a pick with nothing to pick was already refused'
        );
      }
      results.push(c.pick.getForms(fs));
    }
    results.push(this.elsePick.getForms(fs));
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
