/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {isTemporalType} from '../../../model/malloy_types';
import type {ExprValue} from '../types/expr-value';
import {computedExprValue} from '../types/expr-value';
import type {ExpressionDef} from '../types/expression-def';
import type {FieldSpace} from '../types/field-space';
import type {Forms, Reading} from '../types/forms';
import {defaultMoment, formsOf, readingPair} from '../types/forms';
import {ExprTime} from './expr-time';
import {Range} from './range';
import {TimeLiteral} from './time-literal';

/**
 * `left ? right`, and each item of a `|` or `&` list, or `when` of a pick,
 * which `?` reaches. What `right` is decides what happens: something waiting
 * for a left side (a partial, an alternation, a range, a pick waiting for
 * `left`) has `left` applied to it, and anything with a value of its own is
 * tested against that value's range, or for equality when it has none.
 * `owner` is the node the test belongs to.
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
 * `applyTest`, in every form of the result. Applying `left` to a pick
 * waiting for it is a choice, which can be read more than one way.
 */
export function applyTestForms(
  fs: FieldSpace,
  left: ExpressionDef,
  right: ExpressionDef,
  owner: ExpressionDef
): Forms {
  // A time literal writes its own range test, with constant ends
  if (right instanceof TimeLiteral || !right.requestExpression(fs)) {
    return right.applyForms(fs, left);
  }
  const [, reading] = readingPair(left.getForms(fs), right.getForms(fs));
  if (reading.range === undefined) {
    return formsOf(right.testEquality(fs, left));
  }
  return formsOf(rangeTest(fs, left, reading, owner));
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

/**
 * A node made during translation has no parent, and a node without one
 * cannot log. This one belongs to `owner`.
 */
function inTree<T extends ExpressionDef>(made: T, owner: ExpressionDef): T {
  made.parent = owner;
  return made;
}
