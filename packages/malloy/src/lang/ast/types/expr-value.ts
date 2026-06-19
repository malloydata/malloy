/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {
  AggregateUngrouping,
  Expr,
  ExpressionValueTypeDef,
  RequiredGroupBy,
  TemporalTypeDef,
  TimestampUnit,
} from '../../../model';
import {maxOfExpressionTypes, mergeEvalSpaces} from '../../../model';
import {mergeRefSummaries} from '../../composite-source-utils';
import type {ExprResult} from './expr-result';
import type {TimeResult} from './time-result';

export type ExprValue = ExprResult | TimeResult;

export function computedExprValue({
  value,
  dataType,
  from,
}: {
  value: Expr;
  dataType: ExpressionValueTypeDef;
  from: ExprValue[];
}): ExprValue {
  return {
    ...dataType,
    value,
    expressionType: maxOfExpressionTypes(from.map(e => e.expressionType)),
    evalSpace: mergeEvalSpaces(...from.map(e => e.evalSpace)),
    refSummary: mergeRefSummaries(...from.map(e => e.refSummary)),
    ungroupings: mergeUngroupings(...from.map(e => e.ungroupings)),
    requiresGroupBy: mergeGroupedBys(...from.map(e => e.requiresGroupBy)),
  };
}

export function computedTimeResult({
  value,
  dataType,
  from,
  timeframe,
}: {
  value: Expr;
  dataType: TemporalTypeDef;
  timeframe?: TimestampUnit;
  from: ExprValue[];
}): TimeResult {
  const xv = computedExprValue({value, dataType, from});
  const y: TimeResult = {
    ...dataType,
    expressionType: xv.expressionType,
    evalSpace: xv.evalSpace,
    value: xv.value,
    refSummary: mergeRefSummaries(...from.map(e => e.refSummary)),
    ungroupings: mergeUngroupings(...from.map(e => e.ungroupings)),
    requiresGroupBy: mergeGroupedBys(...from.map(e => e.requiresGroupBy)),
  };
  if (timeframe) {
    y.timeframe = timeframe;
  }
  return y;
}

export function computedErrorExprValue({
  dataType,
  from,
  error,
}: {
  error: string;
  dataType?: ExpressionValueTypeDef;
  from: ExprValue[];
}): ExprValue {
  return computedExprValue({
    dataType: dataType ?? {type: 'error'},
    value: {node: 'error', message: error},
    from,
  });
}

export function literalExprValue(options: {
  value: Expr;
  dataType: ExpressionValueTypeDef;
}): ExprValue {
  // Makes literal, output, scalar because from is empty
  return computedExprValue({...options, from: []});
}

export function literalTimeResult({
  value,
  dataType,
  timeframe,
}: {
  value: Expr;
  dataType: TemporalTypeDef;
  timeframe?: TimestampUnit;
}): TimeResult {
  const xv = computedExprValue({value, dataType, from: []});
  const y: TimeResult = {
    ...dataType,
    expressionType: xv.expressionType,
    evalSpace: xv.evalSpace,
    value: xv.value,
  };
  if (timeframe) {
    y.timeframe = timeframe;
  }
  return y;
}

export function mergeGroupedBys(
  ...groupByses: (RequiredGroupBy[] | undefined)[]
): RequiredGroupBy[] | undefined {
  const result: RequiredGroupBy[] = [];
  for (const groupBys of groupByses) {
    if (groupBys !== undefined) {
      result.push(...groupBys);
    }
  }
  if (result.length === 0) return undefined;
  return result;
}

export function mergeUngroupings(
  ...usages: (AggregateUngrouping[] | undefined)[]
): AggregateUngrouping[] | undefined {
  const result: AggregateUngrouping[] = [];
  for (const usage of usages) {
    if (usage !== undefined) {
      result.push(...usage);
    }
  }
  if (result.length === 0) return undefined;
  return result;
}
