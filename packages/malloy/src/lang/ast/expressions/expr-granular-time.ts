/*
 * Copyright 2023 Google LLC
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files
 * (the "Software"), to deal in the Software without restriction,
 * including without limitation the rights to use, copy, modify, merge,
 * publish, distribute, sublicense, and/or sell copies of the Software,
 * and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import type {Expr, TimestampUnit} from '../../../model/malloy_types';
import {isDateUnit, mkTemporal, TD} from '../../../model/malloy_types';

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
  legalChildTypes = [TDU.timestampT, TDU.dateT];
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
    if (TD.isTemporal(exprVal)) {
      const tsVal: GranularResult = {
        ...exprVal,
        timeframe: timeframe,
      };
      if (this.truncate) {
        tsVal.value = {
          node: 'trunc',
          e: mkTemporal(exprVal.value, exprVal.type),
          units: timeframe,
        };
      }
      return tsVal;
    }
    if (exprVal.type !== 'error') {
      this.logError(
        'unsupported-type-for-time-truncation',
        `Cannot do time truncation on type '${exprVal.type}'`
      );
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
    if (begin.type === 'timestamp') {
      const beginTS = ExprTime.fromValue('timestamp', begin);
      const endTS = new ExprTime(
        'timestamp',
        timeOffset('timestamp', begin.value, '+', one, this.units),
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
