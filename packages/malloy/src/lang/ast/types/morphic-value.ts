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

/**
 * One value computed in two or more forms, such as a date literal, which is
 * a date and, beside a timestamp, that date read in the query timezone. The
 * first form is the default.
 *
 * There is no `value`, so nothing can build SQL from a morphic value without
 * first choosing a form. `'morphic'` is not a type in `malloy_types`, so a
 * morphic value cannot be stored in an `ExprValue`, a field, or the IR.
 */
export interface MorphicValue {
  type: 'morphic';
  forms: ExprValue[];
}

/** A value which may still be morphic. */
export type Unsettled = ExprValue | MorphicValue;

/**
 * A span of time which `?` can test, from `start` up to but not including
 * `end`: a granular literal, or a choice among spans. To anything which does
 * not ask for a range it is its `start`.
 *
 * A choice may mix spans with single values. A single value is a span of no
 * width, with its end at its start, and `withMoments` says some alternative
 * is one, so `?` also matches a value equal to the start.
 *
 * There is no `value`, and `'range'` is not a type in `malloy_types`, so a
 * range never reaches a field or the IR.
 */
export interface RangeValue {
  type: 'range';
  start: Unsettled;
  end: Unsettled;
  withMoments?: true;
}

/** What a node computes: a value, or a span of time for `?` to test */
export type ValueOrRange = Unsettled | RangeValue;

/** The value of something which may be a range: a range is its start */
export function startOf(v: ValueOrRange): Unsettled {
  return v.type === 'range' ? v.start : v;
}

/**
 * Choose a form: the one whose type is `as`, otherwise the default. A value
 * which is not morphic is returned as it is.
 */
export function settle(v: Unsettled, as?: ExpressionValueType): ExprValue {
  if (v.type !== 'morphic') {
    return v;
  }
  return v.forms.find(f => f.type === as) ?? v.forms[0];
}

/**
 * Settle a value for comparison with another: the form with the other's
 * type, the timestamp form beside a `timestamptz`, otherwise the default.
 * Two morphic values meet in the first form of this one the other also has.
 */
export function settleAgainst(v: Unsettled, other: Unsettled): ExprValue {
  if (other.type === 'morphic') {
    const shared =
      v.type === 'morphic'
        ? v.forms.find(f => other.forms.some(o => o.type === f.type))
        : undefined;
    return shared ?? settle(v);
  }
  return settle(v, other.type === 'timestamptz' ? 'timestamp' : other.type);
}

/** Settle the two sides of a comparison, each against the other. */
export function settlePair(a: Unsettled, b: Unsettled): [ExprValue, ExprValue] {
  return [settleAgainst(a, b), settleAgainst(b, a)];
}

/**
 * Compute a value from operands, keeping it morphic if any operand is: the
 * computation runs once for each form the morphic operands share. It must
 * not log, or a morphic operand logs once per form.
 */
export function inEachForm(
  operands: Unsettled[],
  compute: (settled: ExprValue[]) => ExprValue
): Unsettled {
  const forms = sharedForms(operands.map(typeOf));
  if (forms === undefined) {
    return compute(operands.map(o => settle(o)));
  }
  return morphic(forms.map(f => compute(operands.map(o => settle(o, f.type)))));
}

/** A morphic value of these forms, or the one value if there is only one */
function morphic(forms: ExprValue[]): Unsettled {
  return forms.length === 1 ? forms[0] : {type: 'morphic', forms};
}

/**
 * The span `?` tests: a range itself, or a value with a granularity read as
 * one unit of it. Undefined for a value with no granularity.
 */
export function rangeOf(v: ValueOrRange): RangeValue | undefined {
  if (v.type === 'range') {
    return v;
  }
  const units = granularityOf(typeOf(v));
  if (units === undefined) {
    return undefined;
  }
  const one: Expr = {node: 'numberLiteral', literal: '1'};
  const end = inEachForm([v], ([at]) =>
    TD.isTemporal(at)
      ? computedExprValue({
          dataType: {type: at.type},
          value: timeOffset(at.type, at.value, '+', one, units),
          from: [at],
        })
      : at
  );
  return {type: 'range', start: v, end};
}

type MorphicTypeDef = {type: 'morphic'; forms: ExpressionValueTypeDef[]};
export type UnsettledTypeDef = ExpressionValueTypeDef | MorphicTypeDef;

/** The type of a value as a clean type definition */
export function typeOf(v: Unsettled): UnsettledTypeDef {
  if (v.type === 'morphic') {
    return {type: 'morphic', forms: v.forms.map(typeDefOf)};
  }
  return typeDefOf(v);
}

/**
 * The type of a value as a clean type definition: its type and granularity,
 * and nothing else which belongs to the value.
 */
export function typeDefOf(v: ExpressionValueTypeDef): ExpressionValueTypeDef {
  if (TD.isAtomic(v)) {
    const def = TD.atomicDef(v);
    return TD.isTemporal(v) ? withGranularity(def, v.timeframe) : def;
  }
  if (v.type === 'turtle') {
    return {type: 'turtle', pipeline: v.pipeline};
  }
  return {type: v.type};
}

function granularityOf(t: UnsettledTypeDef): TimestampUnit | undefined {
  if (t.type === 'morphic') {
    return t.forms.length > 0 ? granularityOf(t.forms[0]) : undefined;
  }
  return TD.isTemporal(t) ? t.timeframe : undefined;
}

export function withoutGranularity(
  t: ExpressionValueTypeDef
): ExpressionValueTypeDef {
  return withGranularity(t, undefined);
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

/** The forms every morphic type has, in the first one's order. */
function sharedForms(
  types: UnsettledTypeDef[]
): ExpressionValueTypeDef[] | undefined {
  let shared: ExpressionValueTypeDef[] | undefined;
  for (const t of types) {
    if (t.type === 'morphic') {
      shared = shared
        ? shared.filter(s => t.forms.some(f => f.type === s.type))
        : t.forms;
    }
  }
  return shared;
}

/**
 * The type of a value which is one of two alternatives, or undefined when
 * they cannot be alternatives of one value.
 */
export function commonType(
  a: UnsettledTypeDef,
  b: UnsettledTypeDef
): UnsettledTypeDef | undefined {
  // An error or a null takes the type of the other alternative
  if (a.type === 'error' || a.type === 'null') return b;
  if (b.type === 'error' || b.type === 'null') return a;
  // Granularity survives only when the alternatives share it
  const units =
    granularityOf(a) === granularityOf(b) ? granularityOf(a) : undefined;
  const common = commonUngranularType(a, b);
  if (common === undefined) {
    return undefined;
  }
  if (common.type === 'morphic') {
    return {
      type: 'morphic',
      forms: common.forms.map(f => withGranularity(f, units)),
    };
  }
  return withGranularity(common, units);
}

function commonUngranularType(
  a: UnsettledTypeDef,
  b: UnsettledTypeDef
): UnsettledTypeDef | undefined {
  if (a.type === 'morphic' || b.type === 'morphic') {
    const forms = sharedForms([a, b]) ?? [];
    const other = a.type === 'morphic' ? b : a;
    // Two morphic values share the forms they have in common
    if (other.type === 'morphic') {
      if (forms.length === 0) return undefined;
      return forms.length === 1 ? forms[0] : {type: 'morphic', forms};
    }
    // Beside a concrete type, a morphic value is that type, if it has it
    return forms.some(f => f.type === other.type) ? other : undefined;
  }
  if (!TD.eq(a, b)) {
    return undefined;
  }
  // Two kinds of number are a number of no particular kind
  if (a.type === 'number' && b.type === 'number') {
    return a.numberType === b.numberType ? a : {type: 'number'};
  }
  return a;
}

/** The first alternative which does not fit the ones before it */
export interface Misfit {
  misfitAt: number;
  found: ExpressionValueType;
  expected: ExpressionValueType;
}

export function isMisfit(v: ValueOrRange | Misfit): v is Misfit {
  return 'misfitAt' in v;
}

/**
 * The value of a choice among alternatives: the branches of a pick or a
 * case, the two sides of `??`. Each alternative is settled to the type they
 * have in common, and `build` is handed their expressions. `alsoFrom` is
 * what else the result is computed from, such as the conditions.
 *
 * A choice in which some alternative is a span of time is itself a range,
 * from the chosen start up to the chosen end, so each alternative keeps its
 * own width. A single value beside a span is a span of no width.
 */
export function choice(
  alternatives: ValueOrRange[],
  build: (alternatives: Expr[]) => Expr,
  alsoFrom: ExprValue[] = []
): ValueOrRange | Misfit {
  const value = chosen(alternatives.map(startOf), build, alsoFrom);
  if (isMisfit(value)) {
    return value;
  }
  const range = choiceRange(alternatives, build, alsoFrom);
  return range ? {...range, start: value} : value;
}

/** The choice as a value, in every form the alternatives share */
function chosen(
  alternatives: Unsettled[],
  build: (alternatives: Expr[]) => Expr,
  alsoFrom: ExprValue[]
): Unsettled | Misfit {
  // A morphic type is named by its default form; nobody sees "morphic"
  const name = (t: UnsettledTypeDef): ExpressionValueType =>
    t.type === 'morphic' ? t.forms[0].type : t.type;
  let type: UnsettledTypeDef = {type: 'null'};
  for (const [misfitAt, alternative] of alternatives.entries()) {
    const next = commonType(type, typeOf(alternative));
    if (next === undefined) {
      return {
        misfitAt,
        found: name(typeOf(alternative)),
        expected: name(type),
      };
    }
    type = next;
  }
  const inForm = (dataType: ExpressionValueTypeDef): ExprValue => {
    const parts = alternatives.map(a => settle(a, dataType.type));
    return computedExprValue({
      dataType,
      value: build(parts.map(p => p.value)),
      from: [...parts, ...alsoFrom],
    });
  };
  const forms = type.type === 'morphic' ? type.forms : [type];
  return morphic(forms.map(inForm));
}

/**
 * The range of a choice: the choice among the alternatives' ends, when some
 * alternative is a span. A null alternative is a null span, and a single
 * value is a span of no width, its end its start. The start is filled in by
 * `choice`.
 */
function choiceRange(
  alternatives: ValueOrRange[],
  build: (alternatives: Expr[]) => Expr,
  alsoFrom: ExprValue[]
): RangeValue | undefined {
  const ends: Unsettled[] = [];
  let spans = 0;
  let moments = 0;
  for (const a of alternatives) {
    const range = a.type === 'null' ? undefined : rangeOf(a);
    if (range) {
      spans += 1;
      if (range.withMoments) {
        moments += 1;
      }
    } else if (a.type !== 'null') {
      moments += 1;
    }
    ends.push(range ? range.end : startOf(a));
  }
  if (spans === 0) {
    return undefined;
  }
  const end = chosen(ends, build, alsoFrom);
  if (isMisfit(end)) {
    return undefined;
  }
  const range: RangeValue = {type: 'range', start: end, end};
  return moments > 0 ? {...range, withMoments: true} : range;
}
