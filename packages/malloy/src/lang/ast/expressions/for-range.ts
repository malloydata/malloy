/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {errorFor} from '../ast-utils';
import * as TDU from '../typedesc-utils';
import {castTo, resolution, timeOffset} from '../time-utils';
import type {BinaryMalloyOperator} from '../types/binary_operators';
import {isComparison} from '../types/binary_operators';
import type {ExprValue} from '../types/expr-value';
import {computedErrorExprValue} from '../types/expr-value';
import {ATNodeType, ExpressionDef} from '../types/expression-def';
import type {Unsettled} from '../types/morphic-value';
import {settle} from '../types/morphic-value';
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
  ): Unsettled {
    if (!isComparison(op)) {
      return super.apply(fs, op, expr);
    }
    const start = this.from.getUnsettled(fs);
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
        from: [settle(start), checkV],
      });
    }
    const units = this.timeframe.text;

    // If the duration resolution is smaller than date, we have
    // to do the computaion with timestamps.
    let rangeType = resolution(units);

    // Next, if the beginning of the range is a timestamp or timestamptz, then we
    // also have to do the computation as a timestamp (or timestamptz)
    const startType = settle(start).type;
    if (startType === 'timestamp' || startType === 'timestamptz') {
      rangeType = startType;
    }

    // A morphic start is a date only when everything is dates
    const allDates = checkV.type === 'date' && rangeType === 'date';
    const startV = settle(start, allDates ? 'date' : 'timestamp');

    // everything is dates, do date math
    if (allDates) {
      const rangeStart = this.from;
      const rangeEndV = timeOffset('date', startV.value, '+', nV.value, units);
      const rangeEnd = ExprTime.of('date', rangeEndV);
      return inTree(new Range(rangeStart, rangeEnd), this).apply(fs, op, expr);
    }

    // Now it doesn't matter if the range is a date or a timestamp,
    // the comparison will be in timestamp space,
    const applyTo = inTree(ExprTime.fromValue('timestamp', checkV), this);

    let rangeStart = this.from;
    let from = startV.value;
    if (startV.type === 'date') {
      from = castTo({type: 'timestamp'}, from, 'date');
      rangeStart = ExprTime.of('timestamp', from, [startV]);
    }
    const to = timeOffset('timestamp', from, '+', nV.value, units);
    const rangeEnd = ExprTime.of('timestamp', to, [startV, nV]);

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
