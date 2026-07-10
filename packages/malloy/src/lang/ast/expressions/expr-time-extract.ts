/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
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
        if (
          ['week', 'month', 'quarter', 'year'].includes(extractTo) &&
          (first.type !== 'date' || last.type !== 'date')
        ) {
          return this.loggedErrorExpr(
            'invalid-timeframe-for-time-measurement',
            `Cannot measure interval using '${extractTo}' for '${first.type}' values; calendar interval measurement requires dates`
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
