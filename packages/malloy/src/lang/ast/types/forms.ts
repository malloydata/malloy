/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {
  Expr,
  ExpressionValueType,
  ExpressionValueTypeDef,
  TimestampUnit,
} from '../../../model/malloy_types';
import {isDateUnit, TD} from '../../../model/malloy_types';
import {timeOffset} from '../time-utils';
import type {ExprValue} from './expr-value';
import {computedExprValue} from './expr-value';
import {isGranularResult} from './granular-result';

/**
 * A value as the places which can use more than its plain value see it.
 * Nothing here is in `malloy_types`, so a form which was not asked for can
 * reach neither a field nor the IR.
 */
export interface Forms {
  /**
   * One reading per type the value can take, the default first. A date
   * literal, and a choice among them, has a date reading and a timestamp
   * reading; everything else has one.
   */
  readings: Reading[];
}

/** The value read as one type */
export interface Reading {
  /** The value. When there is a range, this is also where it starts. */
  moment: ExprValue;
  /** Present when the value is also a range. Every reading has one, or none. */
  range?: RangeEnd;
}

export interface RangeEnd {
  /** Where the range stops; the range does not include it. */
  end: ExprValue;
  /**
   * Some alternative of a choice is a plain value, a range of no width whose
   * end is its start, so `?` also matches a value equal to the moment.
   */
  noWidthAlternative?: true;
}

/**
 * The forms of a value which is only itself. One with a granularity is also
 * the range of its one unit.
 */
export function formsOf(v: ExprValue): Forms {
  if (isGranularResult(v)) {
    const one: Expr = {node: 'numberLiteral', literal: '1'};
    const end = computedExprValue({
      dataType: {type: v.type},
      value: timeOffset(v.type, v.value, '+', one, v.timeframe),
      from: [v],
    });
    return {readings: [{moment: v, range: {end}}]};
  }
  return {readings: [{moment: v}]};
}

/** The plain value: what `getExpression` returns */
export function defaultMoment(f: Forms): ExprValue {
  return f.readings[0].moment;
}

/**
 * The value as a declared type: the reading of that type, otherwise the
 * default, which the declaration then refuses.
 */
export function valueAs(f: Forms, type: string | undefined): ExprValue {
  return (f.readings.find(r => r.moment.type === type) ?? f.readings[0]).moment;
}

/**
 * The reading to use beside a value of type `other`: the reading of that
 * type, the timestamp reading beside a `timestamptz`, otherwise the default.
 */
export function readingFor(f: Forms, other: ExpressionValueType): Reading {
  return (
    f.readings.find(r => r.moment.type === other) ??
    (other === 'timestamptz'
      ? f.readings.find(r => r.moment.type === 'timestamp')
      : undefined) ??
    f.readings[0]
  );
}

/**
 * The readings of two values used together: the first type of `a` which `b`
 * also has, otherwise each read against the other's default.
 */
export function readingPair(a: Forms, b: Forms): [Reading, Reading] {
  for (const ra of a.readings) {
    const rb = b.readings.find(r => r.moment.type === ra.moment.type);
    if (rb) {
      return [ra, rb];
    }
  }
  return [
    readingFor(a, defaultMoment(b).type),
    readingFor(b, defaultMoment(a).type),
  ];
}

/** The first alternative which does not fit the ones before it */
export interface Misfit {
  misfitAt: number;
  found: ExpressionValueType;
  expected: ExpressionValueType;
}

export function isMisfit<T extends object>(v: T | Misfit): v is Misfit {
  return 'misfitAt' in v;
}

/**
 * The type of a value as a clean type definition: its type and nothing which
 * belongs to the value it was read from.
 */
function cleanType(v: ExpressionValueTypeDef): ExpressionValueTypeDef {
  if (TD.isAtomic(v)) {
    return TD.atomicDef(v);
  }
  if (v.type === 'turtle') {
    return {type: 'turtle', pipeline: v.pipeline};
  }
  return {type: v.type};
}

/** A temporal type with this granularity, or with none */
function withGranularity(
  t: ExpressionValueTypeDef,
  units: TimestampUnit | undefined
): ExpressionValueTypeDef {
  if (t.type === 'date') {
    return units && isDateUnit(units)
      ? {type: 'date', timeframe: units}
      : {type: 'date'};
  }
  if (t.type === 'timestamp' || t.type === 'timestamptz') {
    return units ? {type: t.type, timeframe: units} : {type: t.type};
  }
  return t;
}

/** The type of a value, with no granularity */
export function typeWithoutGranularity(
  v: ExpressionValueTypeDef
): ExpressionValueTypeDef {
  return withGranularity(cleanType(v), undefined);
}

function gives(v: ExprValue): boolean {
  return v.type === 'null' || v.type === 'error';
}

/**
 * The types a choice among these alternatives can be read as, in the order
 * of the first alternative's readings, or the first alternative which does
 * not fit the ones before it. A null or an error takes the type of the
 * others.
 */
function choiceTypes(alternatives: Forms[]): ExpressionValueTypeDef[] | Misfit {
  let types: ExpressionValueTypeDef[] | undefined;
  for (const [misfitAt, alt] of alternatives.entries()) {
    const altTypes = alt.readings.map(r => r.moment);
    if (gives(altTypes[0])) {
      continue;
    }
    if (types === undefined) {
      types = altTypes.map(cleanType);
      continue;
    }
    const fits: ExpressionValueTypeDef[] = [];
    for (const t of types) {
      const same = altTypes.find(a => TD.eq(t, a));
      if (same) {
        // Two kinds of number are a number of no particular kind
        fits.push(
          t.type === 'number' &&
            same.type === 'number' &&
            t.numberType !== same.numberType
            ? {type: 'number'}
            : t
        );
      }
    }
    if (fits.length === 0) {
      return {
        misfitAt,
        found: altTypes[0].type,
        expected: types[0].type,
      };
    }
    types = fits;
  }
  return types ?? [cleanType(alternatives[0].readings[0].moment)];
}

/**
 * The granularity every alternative which is not null shares, or none when
 * they differ. One alternative with a granularity beside one with none
 * differ.
 */
function sharedGranularity(alternatives: Forms[]): TimestampUnit | undefined {
  let shared: TimestampUnit | undefined;
  let first = true;
  for (const alt of alternatives) {
    const v = defaultMoment(alt);
    if (gives(v)) {
      continue;
    }
    const units = TD.isTemporal(v) ? v.timeframe : undefined;
    if (first) {
      shared = units;
      first = false;
    } else if (shared !== units) {
      return undefined;
    }
  }
  return shared;
}

/**
 * A choice among alternatives: the arms of a pick or a case, the two sides of
 * `??`. Its type is what the alternatives can all be read as, and `build` is
 * handed their expressions in that type. `alsoFrom` is what else the result
 * is computed from, such as the conditions.
 *
 * When some alternative has a range the choice has one, from the moment
 * chosen up to the end chosen, so each alternative keeps its own width. A
 * plain value is a range of no width, and a null alternative is a null range.
 */
export function choose(
  alternatives: Forms[],
  build: (parts: Expr[]) => Expr,
  alsoFrom: ExprValue[] = []
): Forms | Misfit {
  const types = choiceTypes(alternatives);
  if (isMisfit(types)) {
    return types;
  }
  const units = sharedGranularity(alternatives);
  const hasRange = alternatives.some(a => a.readings[0].range !== undefined);
  const noWidth = alternatives.some(a => {
    const r = a.readings[0];
    return r.range
      ? r.range.noWidthAlternative === true
      : !gives(r.moment) && hasRange;
  });
  const readings = types.map((t): Reading => {
    const parts = alternatives.map(a => readingFor(a, t.type));
    const moments = parts.map(p => p.moment);
    const moment = computedExprValue({
      dataType: withGranularity(t, units),
      value: build(moments.map(m => m.value)),
      from: [...moments, ...alsoFrom],
    });
    if (!hasRange) {
      return {moment};
    }
    const ends = parts.map(p => p.range?.end ?? p.moment);
    const end = computedExprValue({
      dataType: withGranularity(t, undefined),
      value: build(ends.map(e => e.value)),
      from: [...ends, ...alsoFrom],
    });
    return {
      moment,
      range: noWidth ? {end, noWidthAlternative: true} : {end},
    };
  });
  return {readings};
}
