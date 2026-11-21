/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {computedExprValue} from '../types/expr-value';
import type {ExpressionDef} from '../types/expression-def';
import type {FieldSpace} from '../types/field-space';
import {inTree} from '../types/malloy-element';
import type {RangeValue, ValueOrRange} from '../types/morphic-value';
import {rangeOf, settle} from '../types/morphic-value';
import {ExprGranularTime} from './expr-granular-time';
import {ExprTime} from './expr-time';
import {Range} from './range';

/**
 * `left ? right`. A right side which stands for a span of time is tested as
 * that span, an applied pick keeps the range its alternatives make, and
 * anything else is applied. `owner` is the node the test belongs to.
 */
export function applyTest(
  fs: FieldSpace,
  left: ExpressionDef,
  right: ExpressionDef,
  owner: ExpressionDef
): ValueOrRange {
  const span = spanOf(fs, right);
  if (span) {
    return testSpan(fs, left, span, owner);
  }
  return right.applyValueOrRange(fs, left);
}

/**
 * The span of time `?` tests for this right side: a truncation, or a value
 * which stands for a span, such as a pick of granular values. A granular
 * literal builds its own test and has none here.
 */
export function spanOf(
  fs: FieldSpace,
  right: ExpressionDef
): RangeValue | undefined {
  if (
    right instanceof ExprGranularTime ||
    (!right.granular() && right.requestExpression(fs))
  ) {
    return rangeOf(right.getValueOrRange(fs));
  }
  return undefined;
}

/**
 * `left` in the span. A span with single values among its alternatives also
 * holds a value equal to its start, since a single value is a span of no
 * width: `left >= start and (left < end or left = start)`.
 */
function testSpan(
  fs: FieldSpace,
  left: ExpressionDef,
  span: RangeValue,
  owner: ExpressionDef
): ValueOrRange {
  const start = inTree(new ExprTime(span.start), owner);
  const end = inTree(new ExprTime(span.end), owner);
  if (!span.withMoments) {
    return inTree(new Range(start, end), owner).apply(fs, '=', left);
  }
  const from = settle(start.apply(fs, '>=', left));
  const before = settle(end.apply(fs, '<', left));
  const at = settle(start.apply(fs, '=', left));
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
