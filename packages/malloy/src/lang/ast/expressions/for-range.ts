/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {errorFor} from '../ast-utils';
import * as TDU from '../typedesc-utils';
import {asTimeType, resolution, timeOffset} from '../time-utils';
import type {TimeExpr} from '../../../model/malloy_types';
import {TD} from '../../../model/malloy_types';
import type {BinaryMalloyOperator} from '../types/binary_operators';
import {isComparison} from '../types/binary_operators';
import type {ExprValue} from '../types/expr-value';
import {computedErrorExprValue} from '../types/expr-value';
import {ATNodeType, ExpressionDef} from '../types/expression-def';
import type {FieldSpace} from '../types/field-space';
import {inTree} from '../types/malloy-element';
import {ExprTime} from './expr-time';
import {Range} from './range';
import type {Timeframe} from './time-frame';

export class ForRange extends ExpressionDef {
  elementType = 'forRange';
  legalChildTypes = [TDU.timestampT, TDU.timestamptzT, TDU.dateT];
  constructor(
    readonly from: ExpressionDef,
    readonly duration: ExpressionDef,
    readonly timeframe: Timeframe
  ) {
    super({from: from, duration: duration, timeframe: timeframe});
  }

  apply(
    fs: FieldSpace,
    op: BinaryMalloyOperator,
    expr: ExpressionDef
  ): ExprValue {
    if (!isComparison(op)) {
      return super.apply(fs, op, expr);
    }
    const startV = this.from.getExpression(fs);
    const checkV = expr.getExpression(fs);
    if (!this.typeCheck(expr, checkV)) {
      return errorFor('no time for range');
    }
    const nV = this.duration.getExpression(fs);
    if (nV.type !== 'number') {
      if (nV.type !== 'error') {
        this.logError(
          'invalid-duration-quantity',
          `FOR duration count must be a number, not '${nV.type}'`
        );
      }
      return computedErrorExprValue({
        dataType: {type: 'boolean'},
        error: 'for not number',
        from: [startV, checkV],
      });
    }
    const units = this.timeframe.text;

    // If the duration resolution is smaller than date, we have
    // to do the computaion with timestamps.
    let rangeType = resolution(units);

    if (TD.isAnyTimestamp(startV)) {
      rangeType = 'timestamp';
    }

    // everything is dates, do date math
    if (checkV.type === 'date' && rangeType === 'date') {
      const rangeStart = this.from;
      const rangeEndV = timeOffset('date', startV.value, '+', nV.value, units);
      const rangeEnd = new ExprTime('date', rangeEndV);
      return inTree(new Range(rangeStart, rangeEnd), this).apply(fs, op, expr);
    }

    // Now it doesn't matter if the range is a date or a timestamp,
    // the comparison will be in timestamp space,
    const applyTo = inTree(ExprTime.fromValue('timestamp', checkV), this);

    let rangeStart = this.from;
    let from: TimeExpr;
    if (startV.type === 'date') {
      const asTimestamp = this.from
        .getForms(fs)
        .readings.find(r => r.moment.type === 'timestamp');
      from = asTimeType('timestamp', asTimestamp?.moment ?? startV);
      rangeStart = new ExprTime('timestamp', from, [startV]);
    } else {
      from = asTimeType('timestamp', startV);
    }
    const to = timeOffset('timestamp', from, '+', nV.value, units);
    const rangeEnd = new ExprTime('timestamp', to, [startV, nV]);

    return inTree(new Range(rangeStart, rangeEnd), this).apply(fs, op, applyTo);
  }

  requestExpression(_fs: FieldSpace): undefined {
    return undefined;
  }

  atNodeType(): ATNodeType {
    return ATNodeType.Applied;
  }

  protected computeExpression(_fs: FieldSpace): ExprValue {
    return this.loggedErrorExpr('range-as-value', 'A Range is not a value');
  }
}
