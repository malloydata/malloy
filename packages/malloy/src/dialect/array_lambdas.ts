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
  /** `array`'s elements added to `zero`, with `acc` and `v` as names. */
  sum(array: string, zero: string, acc: string, v: string): string;
  /** A record of `fields`, each valued by its `sqlExpression`. */
  record(fields: DialectFieldList): string;
  /** An empty array, which a null array of records becomes. */
  emptyArray: string;
}

// array_max and array_min are null if any element is, on Trino, so null
// values are filtered out before any aggregate, as an aggregate ignores
// them.
export function lambdaArrayAggregate(
  {source, element, function: func, value, filter, resultType}: ArrayAggregate,
  d: LambdaArrayDialect
): string {
  const elements = filter
    ? `filter(${source}, ${element} -> ${filter})`
    : source;
  const values = value
    ? `transform(${elements}, ${element} -> ${value})`
    : elements;
  const v = `${element}_value`;
  const acc = `${element}_acc`;
  const nonNull = `filter(${values}, ${v} -> ${v} IS NOT NULL)`;
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
      return `COALESCE(${d.sum(nonNull, zero, acc, v)}, 0)`;
    }
    case 'avg':
      return `${d.sum(nonNull, 'CAST(0 AS DOUBLE)', acc, v)} / NULLIF(${d.size(nonNull)}, 0)`;
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
