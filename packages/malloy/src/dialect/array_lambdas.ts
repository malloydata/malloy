/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {AtomicTypeDef} from '../model/malloy_types';
import type {ArrayAggregate} from './dialect';

/** Whether a sum of type `resultType` is of integers, and so stays exact. */
export function sumsIntegers(resultType: AtomicTypeDef | undefined): boolean {
  return (
    resultType?.type === 'number' &&
    (resultType.numberType === 'integer' || resultType.numberType === 'bigint')
  );
}

/**
 * What differs between dialects whose higher-order functions are
 * `filter`, `transform`, `flatten`, `array_distinct`, `array_min` and
 * `array_max` (Trino, Presto, Databricks), for computing an aggregate over
 * an array in place.
 */
export interface LambdaArrayDialect {
  /** The number of elements of `array`, 0 for a null array. */
  size(array: string): string;
  /**
   * A fold of `array` from `init`: `step` is the next state from the state
   * `acc` and the element `v`, and `finish` the result from the last state,
   * null for a null array.
   */
  reduce(
    array: string,
    init: string,
    acc: string,
    v: string,
    step: string,
    finish: string
  ): string;
  /**
   * A record of a DOUBLE sum and a BIGINT count, read as `.s` and `.n`: the
   * state of an average.
   */
  sumCount(s: string, n: string): string;
  /** An empty array, which a null array becomes. */
  emptyArray: string;
}

/**
 * An aggregate of an array inside the elements (`ArrayAggregate.nested`)
 * as an aggregate of one array, where a lambda inside a lambda can read the
 * outer one's parameter: the inner arrays of the chosen elements, filtered,
 * and their values taken inside the lambda where the outer element is in
 * scope, made one array, a null inner array taken as empty. The result is
 * aggregated as an array of values, with no `value` or `filter` of its own.
 * `fn` names the dialect's functions.
 */
export function flattenNested(
  {source, element, value, filter, nested}: ArrayAggregate,
  fn: {filter: string; transform: string; flatten: string; empty: string}
): {source: string; element: string} | undefined {
  if (nested === undefined) return undefined;
  const outer = filter
    ? `${fn.filter}(${source}, ${element} -> ${filter})`
    : source;
  const inner = nested.filter
    ? `${fn.filter}(${nested.array}, ${nested.element} -> ${nested.filter})`
    : nested.array;
  const innerValues = value
    ? `${fn.transform}(${inner}, ${nested.element} -> ${value})`
    : inner;
  return {
    source: `${fn.flatten}(${fn.transform}(${outer}, ${element} -> COALESCE(${innerValues}, ${fn.empty})))`,
    element: nested.element,
  };
}

// An aggregate ignores null values. A sum or average skips them as it
// folds, in one pass, so the array, which for an array inside the elements
// is the whole flattened expression, is written once. array_max and
// array_min are null if any element is, on Trino, so null values are
// filtered out before those, and before counting distinct values.
export function lambdaArrayAggregate(
  aggregate: ArrayAggregate,
  d: LambdaArrayDialect
): string {
  const {
    source,
    element,
    function: func,
    value,
    filter,
    resultType,
  } = aggregate;
  // flatten is null if any inner array is, on Databricks, so a null inner
  // array is made empty.
  const flat = flattenNested(aggregate, {
    filter: 'filter',
    transform: 'transform',
    flatten: 'flatten',
    empty: d.emptyArray,
  });
  if (flat) {
    return lambdaArrayAggregate({...flat, function: func, resultType}, d);
  }
  const elements = filter
    ? `filter(${source}, ${element} -> ${filter})`
    : source;
  const values = value
    ? `transform(${elements}, ${element} -> ${value})`
    : elements;
  const v = `${element}_value`;
  const acc = `${element}_acc`;
  const nonNull = `filter(${values}, ${v} -> ${v} IS NOT NULL)`;
  const skipNull = (next: string) =>
    `CASE WHEN ${v} IS NULL THEN ${acc} ELSE ${next} END`;
  switch (func) {
    case 'count':
      return d.size(elements);
    case 'distinct':
      return d.size(`array_distinct(${nonNull})`);
    case 'sum': {
      // A fold's state has one type, so a sum of integers is a BIGINT, and
      // any other sum a DOUBLE.
      const zero = `CAST(0 AS ${sumsIntegers(resultType) ? 'BIGINT' : 'DOUBLE'})`;
      const sum = d.reduce(
        values,
        zero,
        acc,
        v,
        skipNull(`${acc} + ${v}`),
        acc
      );
      return `COALESCE(${sum}, 0)`;
    }
    case 'avg':
      return d.reduce(
        values,
        d.sumCount('CAST(0 AS DOUBLE)', 'CAST(0 AS BIGINT)'),
        acc,
        v,
        skipNull(d.sumCount(`${acc}.s + ${v}`, `${acc}.n + 1`)),
        `${acc}.s / NULLIF(${acc}.n, 0)`
      );
    case 'min':
      return `array_min(${nonNull})`;
    case 'max':
      return `array_max(${nonNull})`;
  }
}
