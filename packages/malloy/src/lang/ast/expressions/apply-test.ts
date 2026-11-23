/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {isTemporalType} from '../../../model/malloy_types';
import type {ExprValue} from '../types/expr-value';
import {computedExprValue} from '../types/expr-value';
import type {ExpressionDef} from '../types/expression-def';
import type {FieldSpace} from '../types/field-space';
import {inTree} from '../types/malloy-element';
import type {Forms, Reading} from '../types/forms';
import {defaultMoment, formsOf, readingPair} from '../types/forms';
import {ExprTime} from './expr-time';
import {Range} from './range';
import {TimeLiteral} from './time-literal';

/**
 * `left ? right`, and each item of a `|` or `&` list written directly after
 * `?`. Anything with a value which has a range is tested
 * against that range, in the reading paired with `left`; anything else has
 * `left` applied to it, which for a value is equality and for a partial, an
 * alternation, a range or a pick is that node's own application. `owner` is
 * the node the test belongs to.
 */
export function applyTest(
  fs: FieldSpace,
  left: ExpressionDef,
  right: ExpressionDef,
  owner: ExpressionDef
): ExprValue {
  return defaultMoment(applyTestForms(fs, left, right, owner));
}

/**
 * `applyTest`, in every form of the result. Applying `left` to a pick is a
 * choice, which can be read more than one way.
 */
export function applyTestForms(
  fs: FieldSpace,
  left: ExpressionDef,
  right: ExpressionDef,
  owner: ExpressionDef
): Forms {
  // A time literal writes its own range test, with constant ends
  if (!(right instanceof TimeLiteral) && right.requestExpression(fs)) {
    const tested = rangeTestOf(fs, left, right, owner);
    if (tested !== undefined) {
      return formsOf(tested);
    }
  }
  return right.applyForms(fs, left);
}

/**
 * `left` tested against the value of `right`: in its range when the value
 * has one, and otherwise equal to it.
 */
export function valueTest(
  fs: FieldSpace,
  left: ExpressionDef,
  right: ExpressionDef,
  owner: ExpressionDef
): ExprValue {
  return rangeTestOf(fs, left, right, owner) ?? right.apply(fs, '=', left);
}

function rangeTestOf(
  fs: FieldSpace,
  left: ExpressionDef,
  right: ExpressionDef,
  owner: ExpressionDef
): ExprValue | undefined {
  const [, reading] = readingPair(left.getForms(fs), right.getForms(fs));
  if (reading.range === undefined) {
    return undefined;
  }
  return rangeTest(fs, left, reading, owner);
}

/**
 * `left` in the range of `reading`. A range with a plain value among its
 * alternatives also holds a value equal to its start, since a plain value is
 * a range of no width: `left >= start and (left < end or left = start)`.
 * Every part is a comparison of values, never a condition inside a `CASE`.
 */
function rangeTest(
  fs: FieldSpace,
  left: ExpressionDef,
  reading: Reading,
  owner: ExpressionDef
): ExprValue {
  const {moment, range} = reading;
  if (range === undefined || !isTemporalType(moment.type)) {
    throw new Error('Internal error: a range test needs a range of time');
  }
  const start = inTree(
    new ExprTime(moment.type, moment.value, [moment]),
    owner
  );
  const end = inTree(
    new ExprTime(moment.type, range.end.value, [range.end]),
    owner
  );
  if (!range.noWidthAlternative) {
    return inTree(new Range(start, end), owner).apply(fs, '=', left);
  }
  const from = start.apply(fs, '>=', left);
  const before = end.apply(fs, '<', left);
  const at = start.apply(fs, '=', left);
  return computedExprValue({
    dataType: {type: 'boolean'},
    value: {
      node: 'and',
      kids: {
        left: from.value,
        right: {node: 'or', kids: {left: before.value, right: at.value}},
      },
    },
    from: [from, before, at],
  });
}
