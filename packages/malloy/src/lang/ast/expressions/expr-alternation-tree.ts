/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {ExprValue} from '../types/expr-value';
import {computedExprValue} from '../types/expr-value';
import type {FieldSpace} from '../types/field-space';
import {
  ATNodeType,
  ExpressionDef,
  booleanAgainstString,
} from '../types/expression-def';
import type {
  BinaryMalloyOperator,
  CompareMalloyOperator,
  EqualityMalloyOperator,
} from '../types/binary_operators';
import {isComparison, isEquality} from '../types/binary_operators';
import {booleanValueError, COMPARE_HINT} from './boolean-value';
import type {Forms} from '../types/forms';
import {formsOf, readingFor} from '../types/forms';
import {applyTest} from './apply-test';

/**
 * Return a flattened version of an alternation tree, if the tree is
 * composed entirely values and "or"s.
 *
 * @param node Root of the tree
 * @param byApplyOperator True when `?` is applying the tree
 * @param itemsAlone True when each item is read as it would be alone after `?`
 * @returns Undefined if other nodes are found in the tree
 */
function flattenOrTree(
  fs: FieldSpace,
  node: ExpressionDef,
  byApplyOperator: boolean,
  itemsAlone: boolean
): ExpressionDef[] | undefined {
  switch (node.atNodeType(byApplyOperator)) {
    case ATNodeType.And:
    case ATNodeType.Applied:
      return undefined;
    case ATNodeType.Or: {
      if (node instanceof ExprAlternationTree) {
        const left = flattenOrTree(fs, node.left, byApplyOperator, itemsAlone);
        if (left) {
          const right = flattenOrTree(
            fs,
            node.right,
            byApplyOperator,
            itemsAlone
          );
          if (right) {
            return [...left, ...right];
          }
        }
      }
      return undefined;
    }
    default: {
      // Read alone after `?`, a value with a range is tested as that range
      const isRange =
        node.granular() ||
        (itemsAlone && node.getForms(fs).readings[0].range !== undefined);
      return isRange ? undefined : [node];
    }
  }
}

export class ExprAlternationTree extends ExpressionDef {
  elementType = 'alternation';
  constructor(
    readonly left: ExpressionDef,
    readonly op: '|' | '&',
    readonly right: ExpressionDef
  ) {
    super({left, right});
    this.elementType = `${op}alternation${op}`;
  }

  apply(
    fs: FieldSpace,
    applyOp: BinaryMalloyOperator,
    expr: ExpressionDef,
    byApplyOperator = false
  ): ExprValue {
    if (!isComparison(applyOp)) {
      return super.apply(fs, applyOp, expr);
    }
    return this.applyTree(fs, applyOp, expr, byApplyOperator, false, false);
  }

  /**
   * The list written directly after `?`: each item is read as it would be
   * read alone after `?`. A list in a pick's `when` is applied instead.
   */
  applyForms(fs: FieldSpace, left: ExpressionDef): Forms {
    return formsOf(this.applyTree(fs, '=', left, true, false, true));
  }

  /**
   * `apply`, plus the `or-choices-only` warning when the tree is more than a
   * list of values.
   */
  applyEquality(
    fs: FieldSpace,
    op: EqualityMalloyOperator,
    expr: ExpressionDef
  ): ExprValue {
    return this.applyTree(fs, op, expr, false, true, false);
  }

  private applyTree(
    fs: FieldSpace,
    applyOp: CompareMalloyOperator,
    expr: ExpressionDef,
    byApplyOperator: boolean,
    warnOnComplexTree: boolean,
    itemsAlone: boolean
  ): ExprValue {
    if (isEquality(applyOp)) {
      const inList = flattenOrTree(fs, this, byApplyOperator, itemsAlone) ?? [];
      if (inList.length > 0 && (applyOp === '=' || applyOp === '!=')) {
        const isIn = expr.getExpression(fs);
        const values = inList.map(
          v => readingFor(v.getForms(fs), isIn.type).moment
        );
        // A boolean on either side of the comparison, the tested value or
        // any of the choices, is a boolean compared with something.
        for (const [el, val] of [
          [expr, isIn] as const,
          ...inList.map((el, i) => [el, values[i]] as const),
        ]) {
          const noIn = booleanValueError(
            fs,
            val,
            `compared with ${applyOp}`,
            el,
            COMPARE_HINT
          );
          if (noIn) return noIn;
        }
        for (const [i, val] of values.entries()) {
          const noCompare = booleanAgainstString(inList[i], isIn, val);
          if (noCompare) return noCompare;
        }
        return computedExprValue({
          dataType: {type: 'boolean'},
          value: {
            node: 'in',
            not: applyOp === '!=',
            kids: {e: isIn.value, oneOf: values.map(v => v.value)},
          },
          from: [isIn, ...values],
        });
      }
      if (inList.length === 0 && warnOnComplexTree) {
        this.logWarning(
          'or-choices-only',
          `Only | seperated values are legal when used with ${applyOp} operator`
        );
      }
    }
    const [choice1, choice2] = [this.left, this.right].map(choice => {
      const applied = itemsAlone
        ? applyTest(fs, expr, choice, this)
        : choice.apply(fs, applyOp, expr, byApplyOperator);
      return applied.type === 'boolean' || applied.type === 'error'
        ? applied
        : choice.loggedErrorExpr('applied-is-not-a-test', {
            resultType: applied.type,
          });
    });
    return computedExprValue({
      dataType: {type: 'boolean'},
      value: {
        node: this.op === '&' ? 'and' : 'or',
        kids: {left: choice1.value, right: choice2.value},
      },
      from: [choice1, choice2],
    });
  }

  requestExpression(_fs: FieldSpace): ExprValue | undefined {
    return undefined;
  }

  protected computeExpression(_fs: FieldSpace): ExprValue {
    return this.loggedErrorExpr(
      'alternation-as-value',
      'Alternation tree has no value'
    );
  }

  atNodeType(): ATNodeType {
    return this.op === '|' ? ATNodeType.Or : ATNodeType.And;
  }
}
