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
import {ExpressionDef} from '../types/expression-def';
import {readingPair} from '../types/forms';
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

  protected computeExpression(fs: FieldSpace): ExprValue {
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
        const [firstReading, lastReading] = readingPair(
          from.first.getForms(fs),
          from.last.getForms(fs)
        );
        const first = firstReading.moment;
        const last = lastReading.moment;
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
          // Two instants measure against each other whatever their types
          if (!(TD.isAnyTimestamp(first) && TD.isAnyTimestamp(last))) {
            return from.first.loggedErrorExpr(
              'invalid-types-for-time-measurement',
              `Cannot measure from ${first.type} to ${last.type}`
            );
          }
          valueType = 'timestamp';
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
