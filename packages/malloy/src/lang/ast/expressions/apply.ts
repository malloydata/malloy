/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {ExprCompare} from './expr-compare';
import type {ExpressionDef} from '../types/expression-def';
import type {ExprValue} from '../types/expr-value';
import type {FieldSpace} from '../types/field-space';
import {isGranularResult} from '../types/granular-result';
import {ExprGranularTime} from './expr-granular-time';

export class Apply extends ExprCompare {
  elementType = 'apply';
  constructor(
    readonly left: ExpressionDef,
    readonly right: ExpressionDef
  ) {
    super(left, '=', right);
  }

  getExpression(fs: FieldSpace): ExprValue {
    let right = this.right;
    if (!this.right.granular()) {
      const rhs = this.right.requestExpression(fs);
      if (rhs && isGranularResult(rhs)) {
        // Need to wrap granular computations to get granular behavior
        right = new ExprGranularTime(this.right, rhs.timeframe, false);
      }
    }
    if (right instanceof ExprGranularTime) {
      return right.toRange(fs).apply(fs, this.op, this.left);
    }
    return super.getExpression(fs);
  }
}
