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

import {
  ExtractUnit,
  isExtractUnit,
  isTimeFieldType,
  isTimestampUnit,
  maxExpressionType,
} from '../../../model/malloy_types';

import {errorFor} from '../ast-utils';
import {ExprValue} from '../types/expr-value';
import {ExpressionDef} from '../types/expression-def';
import {FieldSpace} from '../types/field-space';
import {Range} from './range';

export class ExprTimeExtract extends ExpressionDef {
  elementType = 'timeExtract';
  static pluralMap: Record<string, ExtractUnit> = {
    years: 'year',
    quarters: 'quarter',
    months: 'month',
    weeks: 'week',
    days: 'day',
    hours: 'hour',
    minutes: 'minute',
    seconds: 'second',
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

  constructor(readonly extractText: string, readonly args: ExpressionDef[]) {
    super({args: args});
  }

  getExpression(fs: FieldSpace): ExprValue {
    const extractTo = ExprTimeExtract.extractor(this.extractText);
    if (extractTo) {
      if (this.args.length !== 1) {
        this.log(`Extraction function ${extractTo} requires one argument`);
        return errorFor('{this.name} arg count');
      }
      const from = this.args[0];
      if (from instanceof Range) {
        const first = from.first.getExpression(fs);
        const last = from.last.getExpression(fs);
        if (!isTimeFieldType(first.dataType)) {
          from.first.log(`Can't extract ${extractTo} from '${first.dataType}'`);
          return errorFor(`${extractTo} bad type ${first.dataType}`);
        }
        if (!isTimeFieldType(last.dataType)) {
          from.last.log(`Cannot extract ${extractTo} from '${last.dataType}'`);
          return errorFor(`${extractTo} bad type ${last.dataType}`);
        }
        if (!isTimestampUnit(extractTo)) {
          this.log(`Cannot extract ${extractTo} from a range`);
          return errorFor(`${extractTo} bad extraction`);
        }
        return {
          dataType: 'number',
          expressionType: maxExpressionType(
            first.expressionType,
            last.expressionType
          ),
          value: [
            {
              type: 'dialect',
              function: 'timeDiff',
              units: extractTo,
              left: {valueType: first.dataType, value: first.value},
              right: {valueType: last.dataType, value: last.value},
            },
          ],
        };
      } else {
        const argV = from.getExpression(fs);
        if (isTimeFieldType(argV.dataType)) {
          return {
            dataType: 'number',
            expressionType: argV.expressionType,
            value: [
              {
                type: 'dialect',
                function: 'extract',
                expr: {value: argV.value, valueType: argV.dataType},
                units: extractTo,
              },
            ],
          };
        }
        this.log(
          `${this.extractText}() requires time type, not '${argV.dataType}'`
        );
        return errorFor(`${this.extractText} bad type ${argV.dataType}`);
      }
    }
    throw this.internalError(`Illegal extraction unit '${this.extractText}'`);
  }
}
