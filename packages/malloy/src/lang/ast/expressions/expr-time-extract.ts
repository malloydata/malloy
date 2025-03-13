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

import type {ExtractUnit} from '../../../model/malloy_types';
import {
  isExtractUnit,
  isTemporalType,
  isTimestampUnit,
  mkTemporal,
  TD,
} from '../../../model/malloy_types';

import type {ExprValue} from '../types/expr-value';
import {computedErrorExprValue, computedExprValue} from '../types/expr-value';
import {ExpressionDef, getMorphicValue} from '../types/expression-def';
import type {FieldSpace} from '../types/field-space';
import {Range} from './range';

export class ExprTimeExtract extends ExpressionDef {
  elementType = 'timeExtract';
  static pluralMap: Record<string, ExtractUnit> = {
    'years': 'year',
    'quarters': 'quarter',
    'months': 'month',
    'weeks': 'week',
    'days': 'day',
    'hours': 'hour',
    'minutes': 'minute',
    'seconds': 'second',
  };

  static extractor(funcName: string): ExtractUnit | undefined {
    const mappedName = ExprTimeExtract.pluralMap[funcName];
    if (mappedName) {
      return mappedName;
    }
    if (isExtractUnit(funcName)) {
      return funcName;
    }
  }

  constructor(
    readonly extractText: string,
    readonly args: ExpressionDef[]
  ) {
    super({args: args});
  }

  getExpression(fs: FieldSpace): ExprValue {
    const extractTo = ExprTimeExtract.extractor(this.extractText);
    if (extractTo) {
      if (this.args.length !== 1) {
        return this.loggedErrorExpr(
          'too-many-arguments-for-time-extraction',
          `Extraction function ${extractTo} requires one argument`
        );
      }
      const from = this.args[0];
      if (from instanceof Range) {
        let first = from.first.getExpression(fs);
        let last = from.last.getExpression(fs);
        if (first.type === 'error' || last.type === 'error') {
          return computedErrorExprValue({
            dataType: {type: 'number'},
            error: 'extract from error',
            from: [first, last],
          });
        }
        if (!isTemporalType(first.type)) {
          return from.first.loggedErrorExpr(
            'invalid-type-for-time-extraction',
            `Can't extract ${extractTo} from '${first.type}'`
          );
        }
        if (!isTemporalType(last.type)) {
          return from.last.loggedErrorExpr(
            'invalid-type-for-time-extraction',
            `Cannot extract ${extractTo} from '${last.type}'`
          );
        }
        let valueType = first.type;
        if (!TD.eq(first, last)) {
          let cannotMeasure = true;
          valueType = 'timestamp';
          if (first.type === 'date') {
            const newFirst = getMorphicValue(first, 'timestamp');
            if (newFirst) {
              first = newFirst;
              cannotMeasure = false;
            }
          } else {
            const newLast = getMorphicValue(last, 'timestamp');
            if (newLast) {
              last = newLast;
              cannotMeasure = false;
            }
          }
          if (cannotMeasure) {
            return from.first.loggedErrorExpr(
              'invalid-types-for-time-measurement',
              `Cannot measure from ${first.type} to ${last.type}`
            );
          }
        }
        if (['week', 'month', 'quarter', 'year'].includes(extractTo)) {
          return this.loggedErrorExpr(
            'invalid-timeframe-for-time-measurement',
            `Cannot measure interval using '${extractTo}'`
          );
        }
        if (!isTimestampUnit(extractTo)) {
          return this.loggedErrorExpr(
            'invalid-time-extraction-unit',
            `Cannot extract ${extractTo} from a range`
          );
        }
        return computedExprValue({
          dataType: {type: 'number', numberType: 'integer'},
          value: {
            node: 'timeDiff',
            units: extractTo,
            kids: {
              left: mkTemporal(first.value, valueType),
              right: mkTemporal(last.value, valueType),
            },
          },
          from: [first, last],
        });
      } else {
        const argV = from.getExpression(fs);
        if (isTemporalType(argV.type)) {
          return computedExprValue({
            dataType: {type: 'number', numberType: 'integer'},
            value: {
              node: 'extract',
              e: mkTemporal(argV.value, argV.type),
              units: extractTo,
            },
            from: [argV],
          });
        }
        if (argV.type !== 'error') {
          this.logError(
            'unsupported-type-for-time-extraction',
            `${this.extractText}() requires time type, not '${argV.type}'`
          );
        }
        return computedErrorExprValue({
          dataType: {type: 'number', numberType: 'integer'},
          error: `${this.extractText} bad type ${argV.type}`,
          from: [argV],
        });
      }
    }
    throw this.internalError(`Illegal extraction unit '${this.extractText}'`);
  }
}
