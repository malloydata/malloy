/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {ArrayAggregate, ArraySelect, DialectFieldList} from './dialect';

/**
 * What differs between dialects whose higher-order functions are
 * `filter`, `transform`, `array_distinct`, `array_min`, `array_max`,
 * `array_sort` with a comparator and `slice` (Trino, Presto, Databricks),
 * for computing a query on an array in place.
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
  /** A record of `fields`, each valued by its `sqlExpression`. */
  record(fields: DialectFieldList): string;
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
      const integral =
        resultType?.type === 'number' &&
        (resultType.numberType === 'integer' ||
          resultType.numberType === 'bigint');
      const zero = `CAST(0 AS ${integral ? 'BIGINT' : 'DOUBLE'})`;
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

export function lambdaArraySelect(
  {
    source,
    element,
    fields,
    filter,
    orderBy = [],
    comparator,
    limit,
  }: ArraySelect,
  d: LambdaArrayDialect
): string | undefined {
  let elements = filter ? `filter(${source}, ${element} -> ${filter})` : source;
  if (orderBy.length > 0) {
    if (comparator === undefined) {
      return undefined;
    }
    const {left, right, keys} = comparator();
    // Each key in turn, nulls last either way; equal on every key is 0.
    let compare = '0';
    for (let i = orderBy.length - 1; i >= 0; i--) {
      const [before, after] =
        orderBy[i].dir === 'desc' ? ['1', '-1'] : ['-1', '1'];
      const l = `(${keys[i].left})`;
      const r = `(${keys[i].right})`;
      compare = `CASE WHEN ${l} IS NULL AND ${r} IS NULL THEN ${compare} WHEN ${l} IS NULL THEN 1 WHEN ${r} IS NULL THEN -1 WHEN ${l} < ${r} THEN ${before} WHEN ${l} > ${r} THEN ${after} ELSE ${compare} END`;
    }
    elements = `array_sort(${elements}, (${left}, ${right}) -> ${compare})`;
  }
  if (limit !== undefined) {
    // slice is 1-based; length n keeps the first n.
    elements = `slice(${elements}, 1, ${limit})`;
  }
  return `COALESCE(transform(${elements}, ${element} -> ${d.record(fields)}), ${d.emptyArray})`;
}
