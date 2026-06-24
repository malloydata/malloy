/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {
  Expr,
  TemporalTypeDef,
  TimestampUnit,
} from '../../../model/malloy_types';
import {
  isBasicAtomicType,
  isDateUnit,
  mkTemporal,
  TD,
} from '../../../model/malloy_types';

import {errorFor} from '../ast-utils';
import * as TDU from '../typedesc-utils';
import {timeOffset} from '../time-utils';
import type {ExprValue} from '../types/expr-value';
import {ExpressionDef} from '../types/expression-def';
import type {FieldSpace} from '../types/field-space';
import type {GranularResult} from '../types/granular-result';
import {ExprTime} from './expr-time';
import {Range} from './range';
import type * as Malloy from '@malloydata/malloy-interfaces';

/**
 * GranularTime is a moment in time which ALSO has a "granularity"
 * commonly this are created by applying ".datePart" to an expression
 * 1) They have a value, which is the moment in time
 * 2) When used in a comparison, they act like a range, for the
 *    duration of 1 unit of granularity
 */

export class ExprGranularTime extends ExpressionDef {
  elementType = 'granularTime';
  legalChildTypes = [TDU.timestampT, TDU.timestamptzT, TDU.dateT];
  constructor(
    readonly expr: ExpressionDef,
    readonly units: TimestampUnit,
    readonly truncate: boolean
  ) {
    super({expr: expr});
  }

  granular(): boolean {
    return true;
  }

  drillExpression(): Malloy.Expression | undefined {
    const lhs = this.expr.drillExpression();
    if (lhs?.kind !== 'field_reference') return undefined;
    return {
      kind: 'time_truncation',
      field_reference: {
        name: lhs.name,
        path: lhs.path,
      },
      truncation: this.units,
    };
  }

  getExpression(fs: FieldSpace): ExprValue {
    const timeframe = this.units;
    const exprVal = this.expr.getExpression(fs);
    let timeType: TemporalTypeDef;
    let tsVal: GranularResult;
    if (TD.isTemporal(exprVal)) {
      if (exprVal.type === 'date') {
        if (!isDateUnit(timeframe)) {
          return this.loggedErrorExpr(
            'unsupported-type-for-time-truncation',
            `Cannot truncate date to timestamp unit '${timeframe}'`
          );
        }
        tsVal = {...exprVal, timeframe: timeframe};
        timeType = {type: 'date', timeframe};
      } else {
        // timestamp or timestamptz
        tsVal = {...exprVal, timeframe: timeframe};
        if (exprVal.type === 'timestamptz') {
          timeType = {type: 'timestamptz', timeframe};
        } else {
          timeType = {type: 'timestamp', timeframe};
        }
      }
      if (this.truncate) {
        tsVal.value = {
          node: 'trunc',
          e: mkTemporal(exprVal.value, timeType),
          units: timeframe,
        };
      } else {
        tsVal.value = exprVal.value;
      }
      return tsVal;
    }
    if (exprVal.type !== 'error') {
      if (!isBasicAtomicType(exprVal.type)) {
        // The truncation target has fields (a join/struct/record/array), so it
        // can't be a time value. The likely intent is a field whose name is a
        // time unit (e.g. `flight.year`); since `.year` parses as a truncation
        // and time units are reserved words, that field has to be quoted.
        const ref = this.expr.drillExpression();
        const lhs =
          ref?.kind === 'field_reference'
            ? [...(ref.path ?? []), ref.name].join('.')
            : undefined;
        const quoted = lhs ? `${lhs}.\`${timeframe}\`` : `\`${timeframe}\``;
        this.logError(
          'unsupported-type-for-time-truncation',
          `'.${timeframe}' is a time truncation, but ${
            lhs ? `'${lhs}'` : 'the left side'
          } is type '${exprVal.type}', not a time value. If '${timeframe}' is a field name it must be quoted, because it is a reserved word: ${quoted}`
        );
      } else {
        this.logError(
          'unsupported-type-for-time-truncation',
          `Cannot do time truncation on type '${exprVal.type}'`
        );
      }
    }
    const returnType = {...exprVal};
    if (exprVal.type === 'error') {
      (returnType as ExprValue).type = isDateUnit(timeframe)
        ? 'date'
        : 'timestamp';
    }
    return {
      ...returnType,
      value: errorFor('granularity typecheck').value,
      evalSpace: 'constant',
    };
  }

  // apply(fs: FieldSpace, op: string, left: ExpressionDef): ExprValue {
  //   return this.getRange(fs).apply(fs, op, left);

  //   /*
  //     write tests for each of these cases ....

  //     vt  rt  gt  use
  //     dt  dt  dt  dateRange
  //     dt  dt  ts  == or timeStampRange
  //     dt  ts  dt  timestampRange
  //     dt  ts  ts  timeStampRange

  //     ts  ts  ts  timestampRange
  //     ts  ts  dt  timestampRange
  //     ts  dt  ts  timestampRange
  //     ts  dt  dt  either

  //   */
  // }

  toRange(fs: FieldSpace): Range {
    const begin = this.getExpression(fs);
    const one: Expr = {node: 'numberLiteral', literal: '1'};
    if (TD.isAnyTimestamp(begin)) {
      const beginTS = ExprTime.fromValue(begin.type, begin);
      const endTS = new ExprTime(
        begin.type,
        timeOffset(begin.type, begin.value, '+', one, this.units),
        [begin]
      );
      return new Range(beginTS, endTS);
    }
    const beginDate = new ExprTime('date', begin.value, [begin]);
    const endAt = timeOffset('date', begin.value, '+', one, this.units);
    const endDate = new ExprTime('date', endAt, [begin]);
    return new Range(beginDate, endDate);
  }
}
