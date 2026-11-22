/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type * as Malloy from '@malloydata/malloy-interfaces';
import type {
  Expr,
  TimestampUnit,
  BasicExpressionType,
  FilterMatchExpr,
  NumberTypeDef,
  FilterExprType,
} from '../../../model/malloy_types';
import {
  isDateUnit,
  isTemporalType,
  expressionIsAggregate,
  TD,
} from '../../../model/malloy_types';
import * as TDU from '../typedesc-utils';
import {errorFor} from '../ast-utils';
import type {ExprValue} from './expr-value';
import {
  computedErrorExprValue,
  computedExprValue,
  computedTimeResult,
} from './expr-value';
import {timeOffset} from '../time-utils';
import type {FieldSpace} from './field-space';
import {isGranularResult} from './granular-result';
import type {Forms} from './forms';
import {defaultMoment, formsOf, readingPair} from './forms';
import {MalloyElement} from './malloy-element';
import type {
  ArithmeticMalloyOperator,
  BinaryMalloyOperator,
  CompareMalloyOperator,
  EqualityMalloyOperator,
} from './binary_operators';
import {getExprNode, isComparison, isEquality} from './binary_operators';
import {
  BooleanFilterExpression,
  NumberFilterExpression,
  StringFilterExpression,
  TemporalFilterExpression,
  isFilterable,
} from '@malloydata/malloy-filter';
import {booleanValueError, COMPARE_HINT} from '../expressions/boolean-value';

/**
 * Mark a value as belonging to everyone. Writing into a memoized value writes
 * into every other holder's copy and into whatever the IR already stored;
 * freezing turns that from a silent miscompile into a TypeError naming the
 * line which did it. Own fields only -- walking every Expr on every
 * evaluation would cost more than the memo saves.
 */
function shareable(v: ExprValue): ExprValue {
  Object.freeze(v);
  for (const share of [
    v.value,
    v.refSummary,
    v.refSummary?.fieldUsage,
    v.refSummary?.givenUsage,
    v.requiresGroupBy,
    v.ungroupings,
  ]) {
    if (share !== undefined) {
      Object.freeze(share);
    }
  }
  return v;
}

/** `shareable`, for every value a node's forms hold */
function shareableForms(f: Forms): Forms {
  for (const r of f.readings) {
    shareable(r.moment);
    if (r.range) {
      shareable(r.range.end);
      Object.freeze(r.range);
    }
    Object.freeze(r);
  }
  Object.freeze(f.readings);
  return Object.freeze(f);
}

/** What a node is as a choice in an alternation tree */
export enum ATNodeType {
  And,
  Or,
  /** A plain value, which an or-list of plain values lists in one IN */
  Value,
  /** A choice which is applied by itself and never listed in an IN */
  Applied,
}

/**
 * Root node for any element in an expression. These essentially
 * create a sub-tree in the larger AST. An ExpressionDef, when
 * given a FieldSpace, can be evaluated to produce an ExprValue
 * which is the IR for an Expr along with its type and other metadata.
 */
export abstract class ExpressionDef extends MalloyElement {
  abstract elementType: string;
  granular(): boolean {
    return false;
  }

  /**
   * The plain value of this node: its IR, its type and everything else
   * computed with it. This is what every place asks for which has no use for
   * another form of the value.
   *
   * THE RETURNED ExprValue IS SHARED -- TREAT IT AS IMMUTABLE. Asking twice
   * yields the same object, so to derive a value from one, build a new one:
   * `{...operand, type: 'boolean'}` or `computedExprValue({…, from: [operand]})`.
   */
  getExpression(fs: FieldSpace): ExprValue {
    return defaultMoment(this.getForms(fs));
  }

  /**
   * Every form of this node's value, for the few places which can use more
   * than the plain value: what `?`, a comparison, a choice, a function
   * overload or a declared type can choose among. The plain value is the
   * first reading's moment.
   *
   * DO NOT OVERRIDE THIS. Nodes implement `computeExpression`, or
   * `computeForms` when they have more than one form; an override here
   * bypasses the memo, which for `+`/`-` chains is the difference between
   * linear and exponential compile time.
   */
  getForms(fs: FieldSpace): Forms {
    const initialGeneration = fs.generation();
    if (
      this.memoForms !== undefined &&
      this.memoFs === fs &&
      this.memoGen === initialGeneration
    ) {
      return this.memoForms;
    }

    // If we get here and memoFs is set and memoGen is not set, then somewhere
    // inside this expression is a recursive call asking this node for the
    // value it is in the middle of computing. There is nothing to return and
    // computing one would recurse again, so throw. An abandoned computation
    // does not look like this -- see the finally below.

    if (this.memoFs !== undefined && this.memoGen === undefined) {
      throw this.internalError(
        `ExpressionDef.getForms memoization failure on ${this.elementType}`
      );
    }

    this.memoFs = fs;
    this.memoGen = undefined;
    try {
      const forms = this.computeForms(fs);
      if (initialGeneration === fs.generation()) {
        this.memoGen = initialGeneration;
        this.memoForms = shareableForms(forms);
      }
      return forms;
    } finally {
      if (this.memoGen === undefined) {
        // Threw, or a name was rebound while we ran. Leave no stamp: a caller
        // which recovers must get a fresh computation, not our remains.
        this.memoFs = undefined;
      }
    }
  }

  /**
   * The last forms this node computed, and what they were computed against.
   * Three states, distinguished by memoGen:
   *
   *   memoFs undefined              -- nothing computed, or abandoned
   *   memoFs set, memoGen undefined -- computing right now, and only that,
   *                                    since abandoning clears memoFs
   *   memoFs set, memoGen set       -- memoForms is that computation's result
   *
   * Both halves of the stamp are needed: a node can be evaluated under more
   * than one field space -- ConstantExpression evaluates its child against a
   * ConstantFieldSpace whatever it was handed -- and a field space can rebind
   * a name under us.
   *
   * One slot, not a map. A node which alternates between two field spaces
   * simply misses and recomputes, which costs time and never correctness.
   */
  private memoFs?: FieldSpace;
  private memoGen?: number;
  private memoForms?: Forms;

  /**
   * Evaluate this node to its plain value. Called only by `computeForms`
   * below, never directly.
   */
  protected abstract computeExpression(fs: FieldSpace): ExprValue;

  /**
   * Evaluate this node to every form of its value. Called only by
   * `getForms`. A node with only its plain value, and the range of its unit
   * when it has a granularity, need not override this.
   */
  protected computeForms(fs: FieldSpace): Forms {
    return formsOf(this.computeExpression(fs));
  }
  legalChildTypes = TDU.anyAtomicT;

  /**
   * Some operators want to give the right hand value a chance to
   * rewrite itself. This requests a translation for a rewrite,
   * or returns undefined if that request should be denied.
   * @param fs FieldSpace
   * @return Translated expression or undefined
   */
  requestExpression(fs: FieldSpace): ExprValue | undefined {
    return this.getExpression(fs);
  }

  defaultFieldName(): string | undefined {
    return undefined;
  }

  /**
   * Check an expression for type compatibility
   * @param _eNode currently unused, will be used to get error location
   * @param eVal ...list of expressions that must match legalChildTypes
   */
  typeCheck(eNode: ExpressionDef, eVal: ExprValue): boolean {
    if (eVal.type !== 'error' && !TDU.any(eVal, this.legalChildTypes)) {
      if (eVal.type === 'sql native') {
        eNode.logError('sql-native-not-allowed-in-expression', {
          rawType: eVal.rawType,
        });
      } else {
        eNode.logError(
          'expression-type-error',
          `'${this.elementType}' Can't use type ${TDU.inspect(eVal)}`
        );
      }
      return false;
    }
    return true;
  }

  drillExpression(): Malloy.Expression | undefined {
    return undefined;
  }

  /**
   * This is the operation which makes partial comparison and value trees work.
   * `this` is the RIGHT operand; the left arrives here as an argument. All of
   * the magic of malloy expressions eventually flows through here, where an
   * operator is applied to two values -- depending on the operator and the
   * value types that may transform the values or even the operator.
   *
   * Specialized nodes like alternation trees and partial comparisons override
   * this to control how the application gets generated. They are the reason
   * the right operand is in charge: a partial has no bound left operand, and
   * only learns it here.
   * @param fs The symbol table
   * @param op The operator being applied
   * @param left The "other" (besides 'this') value
   * @param _byApplyOperator True when `?` is doing the applying. `?` passes
   * `=` as its operator, and this is how a node which treats the two
   * differently tells them apart. A node which hands the application it was
   * given on to nodes it holds passes this on; a node which applies an
   * operator of its own does not.
   * @return The translated expression
   */
  apply(
    fs: FieldSpace,
    op: BinaryMalloyOperator,
    left: ExpressionDef,
    _byApplyOperator = false
  ): ExprValue {
    if (isEquality(op)) {
      return equality(fs, left, op, this);
    }
    if (isComparison(op)) {
      return compare(fs, left, op, this);
    }
    if (op === '+' || op === '-') {
      return delta(fs, left, op, this);
    }
    if (op === '*') {
      return numeric(fs, left, op, this);
    }
    if (op === '/' || op === '%') {
      return divmod(fs, left, op, this);
    }
    return left.loggedErrorExpr(
      'unexpected-binary-operator',
      `Cannot use ${op} operator here`
    );
  }

  /**
   * `left ? this`, when this node has a value and that value has no range:
   * an equality.
   */
  testEquality(fs: FieldSpace, left: ExpressionDef): ExprValue {
    return this.apply(fs, '=', left);
  }

  /**
   * `?` applying `left` to this node, in every form of the result. Only a
   * node whose applied result is a choice, and so can have more than one
   * form, overrides this.
   */
  applyForms(fs: FieldSpace, left: ExpressionDef): Forms {
    return formsOf(this.apply(fs, '=', left, true));
  }

  canSupportPartitionBy() {
    return false;
  }

  canSupportOrderBy() {
    return false;
  }

  canSupportLimit() {
    return false;
  }

  supportsWhere(expr: ExprValue) {
    return expressionIsAggregate(expr.expressionType);
  }

  /**
   * @param _byApplyOperator True when `?` is applying the tree, for a node
   * which is one kind of choice to `?` and another to a written operator
   */
  atNodeType(_byApplyOperator = false): ATNodeType {
    return ATNodeType.Value;
  }
}

export class ExprDuration extends ExpressionDef {
  elementType = 'duration';
  legalChildTypes = [TDU.timestampT, TDU.timestamptzT, TDU.dateT];
  constructor(
    readonly n: ExpressionDef,
    readonly timeframe: TimestampUnit
  ) {
    super({n: n});
  }

  apply(
    fs: FieldSpace,
    op: BinaryMalloyOperator,
    left: ExpressionDef
  ): ExprValue {
    const lhs = left.getExpression(fs);
    this.typeCheck(this, lhs);
    if (isTemporalType(lhs.type) && (op === '+' || op === '-')) {
      const num = this.n.getExpression(fs);
      if (!TDU.typeEq(num, TDU.numberT)) {
        this.logError(
          'invalid-duration-quantity',
          `Duration quantity needs number not '${num.type}`
        );
        return errorFor('illegal unit expression');
      }
      let resultGranularity: TimestampUnit | undefined;
      // Only allow the output of this to be granular if the
      // granularities match, this is still an area where
      // more thought is required.
      if (isGranularResult(lhs) && lhs.timeframe === this.timeframe) {
        resultGranularity = lhs.timeframe;
      }
      if (lhs.type === 'date' && !isDateUnit(this.timeframe)) {
        return this.loggedErrorExpr(
          'invalid-timeframe-for-time-offset',
          `Cannot offset date by ${this.timeframe}`
        );
      }
      return computedTimeResult({
        dataType: {type: lhs.type},
        value: timeOffset(lhs.type, lhs.value, op, num.value, this.timeframe),
        timeframe: resultGranularity,
        from: [lhs, num],
      });
    }
    return super.apply(fs, op, left);
  }

  protected computeExpression(fs: FieldSpace): ExprValue {
    const num = this.n.getExpression(fs);
    return computedErrorExprValue({
      dataType: {type: 'duration'},
      error: 'Duration is not a value',
      from: [num],
    });
  }
}

function timeCompare(
  left: ExpressionDef,
  lhs: ExprValue,
  op: CompareMalloyOperator,
  rhs: ExprValue
): Expr | undefined {
  const leftIsTime = isTemporalType(lhs.type);
  const rightIsTime = isTemporalType(rhs.type);
  const node = getExprNode(op);
  if (
    leftIsTime &&
    rightIsTime &&
    (lhs.type === rhs.type ||
      (TD.isAnyTimestamp(lhs) && TD.isAnyTimestamp(rhs)))
  ) {
    return {node, kids: {left: lhs.value, right: rhs.value}};
  }
  if (
    (leftIsTime || rightIsTime) &&
    lhs.type !== 'null' &&
    rhs.type !== 'null'
  ) {
    left.logError(
      'time-comparison-type-mismatch',
      `Cannot compare a ${lhs.type} to a ${rhs.type}`
    );
    return {node: 'false'};
  }
  return undefined;
}

function regexEqual(left: ExprValue, right: ExprValue): Expr | undefined {
  if (left.type === 'string') {
    if (right.type === 'regular expression') {
      return {
        node: 'regexpMatch',
        kids: {expr: left.value, regex: right.value},
      };
    }
  } else if (right.type === 'string') {
    if (left.type === 'regular expression') {
      return {
        node: 'regexpMatch',
        kids: {expr: right.value, regex: left.value},
      };
    }
  }
  return undefined;
}

function matchMismatchMessage(
  op: '~' | '!~',
  lhs: ExprValue,
  rhs: ExprValue
): string {
  if (rhs.type === 'null') {
    return `'${op}' cannot match null, use '${op === '~' ? 'is null' : 'is not null'}' instead`;
  }
  if (rhs.type === 'string' || rhs.type === 'regular expression') {
    return `'${op}' cannot match ${lhs.type} against a pattern, the left side of '${op}' must be a string`;
  }
  const eq = op === '~' ? '=' : '!=';
  if (lhs.type === rhs.type) {
    return `'${op}' does not compare two ${lhs.type} values, use '${eq}' instead`;
  }
  if (TD.isAnyTimestamp(lhs) && TD.isAnyTimestamp(rhs)) {
    return `'${op}' does not compare ${lhs.type} to ${rhs.type}, use '${eq}' instead`;
  }
  return `'${op}' cannot compare ${lhs.type} to ${rhs.type}`;
}

/**
 * A boolean can only be compared, with anything, on a dialect with boolean
 * values. Every comparison operator, applied plainly, as a partial, or
 * through an alternation, arrives here through equality() or compare().
 */
function booleanCompare(
  fs: FieldSpace,
  left: ExpressionDef,
  lhs: ExprValue,
  op: CompareMalloyOperator,
  right: ExpressionDef,
  rhs: ExprValue
): ExprValue | undefined {
  const [side, val] = lhs.type === 'boolean' ? [left, lhs] : [right, rhs];
  return booleanValueError(fs, val, `compared with ${op}`, side, COMPARE_HINT);
}

/**
 * A boolean and a string are never the same value, whatever a database is
 * willing to cast to make them comparable.
 */
export function booleanAgainstString(
  logAt: ExpressionDef,
  lhs: ExprValue,
  rhs: ExprValue
): ExprValue | undefined {
  const types = [lhs.type, rhs.type];
  if (types.includes('boolean') && types.includes('string')) {
    logAt.logError(
      'comparison-type-mismatch',
      `Cannot compare a ${lhs.type} to a ${rhs.type}`
    );
    return computedErrorExprValue({
      dataType: {type: 'boolean'},
      error: 'boolean compared with string',
      from: [lhs, rhs],
    });
  }
  return undefined;
}

/**
 * The two sides of a comparison, each read as the type of the other where it
 * can be: a date literal beside a timestamp is a timestamp.
 */
function comparedValues(
  fs: FieldSpace,
  left: ExpressionDef,
  right: ExpressionDef
): [ExprValue, ExprValue] {
  const [l, r] = readingPair(left.getForms(fs), right.getForms(fs));
  return [l.moment, r.moment];
}

function equality(
  fs: FieldSpace,
  left: ExpressionDef,
  op: EqualityMalloyOperator,
  right: ExpressionDef
): ExprValue {
  const [lhs, rhs] = comparedValues(fs, left, right);
  const node = getExprNode(op);

  const err =
    errorCascade('boolean', lhs, rhs) ||
    booleanCompare(fs, left, lhs, op, right, rhs);
  if (err) return err;

  // Unsupported types can be compare with null
  const lhRaw = TD.isSQL(lhs) ? lhs.rawType || 'typeless-left' : undefined;
  const rhRaw = TD.isSQL(rhs) ? rhs.rawType || 'typeless-right' : undefined;
  if (lhRaw || rhRaw) {
    const oneNull = lhs.type === 'null' || rhs.type === 'null';
    if (!(oneNull || lhRaw === rhRaw)) {
      const noGo = unsupportError(left, lhs, right, rhs);
      if (noGo) {
        return {...noGo, type: 'boolean'};
      }
    }
  }

  let value: Expr;

  if (rhs.type === 'filter expression') {
    if (op !== '~' && op !== '!~') {
      return right.loggedErrorExpr(
        'filter-expression-error',
        `Cannot use the '${op}' operator with a filter expression`
      );
    }
    const noMatch = booleanValueError(
      fs,
      lhs,
      'matched with a filter expression',
      left,
      'test the condition itself'
    );
    if (noMatch) return noMatch;
    if (isFilterable(lhs.type)) {
      let actualFilter = rhs.value;
      while (actualFilter.node === '()') {
        actualFilter = actualFilter.e;
      }
      if (actualFilter.node !== 'parameter' && actualFilter.node !== 'given') {
        // Parameter and given values are checked when supplied
        checkFilterExpression(right, lhs.type, actualFilter);
      }
      const filterMatch: FilterMatchExpr = {
        node: 'filterMatch',
        dataType: lhs.type,
        kids: {filterExpr: rhs.value, expr: lhs.value},
      };
      value = op === '!~' ? {node: 'not', e: filterMatch} : filterMatch;
    } else {
      return left.loggedErrorExpr(
        'filter-expression-type',
        `Cannot use filter expressions with type '${lhs.type}'`
      );
    }
  } else {
    const isMatch = op === '~' || op === '!~';
    if (isMatch && (lhs.type !== 'string' || rhs.type !== 'string')) {
      const regexCmp = regexEqual(lhs, rhs);
      if (regexCmp === undefined) {
        left.logError(
          'match-operator-type-mismatch',
          matchMismatchMessage(op, lhs, rhs)
        );
        return computedErrorExprValue({
          dataType: {type: 'boolean'},
          error: 'match operator type mismatch',
          from: [lhs, rhs],
        });
      }
      value = op === '!~' ? {node: 'not', e: regexCmp} : regexCmp;
    } else {
      const noCompare = booleanAgainstString(left, lhs, rhs);
      if (noCompare) return noCompare;
      value = timeCompare(left, lhs, op, rhs) || {
        node,
        kids: {left: lhs.value, right: rhs.value},
      };
    }
  }

  return computedExprValue({
    dataType: {type: 'boolean'},
    value,
    from: [lhs, rhs],
  });
}

function compare(
  fs: FieldSpace,
  left: ExpressionDef,
  op: CompareMalloyOperator,
  right: ExpressionDef
): ExprValue {
  const [lhs, rhs] = comparedValues(fs, left, right);

  const err =
    errorCascade('boolean', lhs, rhs) ||
    booleanCompare(fs, left, lhs, op, right, rhs);
  if (err) return err;

  const noCompare = unsupportError(left, lhs, right, rhs);
  if (noCompare) {
    return {...noCompare, type: 'boolean'};
  }
  const mismatch = booleanAgainstString(left, lhs, rhs);
  if (mismatch) return mismatch;
  const value = timeCompare(left, lhs, op, rhs) || {
    node: getExprNode(op),
    kids: {left: lhs.value, right: rhs.value},
  };

  return computedExprValue({
    dataType: {type: 'boolean'},
    value,
    from: [lhs, rhs],
  });
}

/**
 * Computes the result numberType for arithmetic operations.
 * - Division/modulo always return float
 * - Float wins over integer/bigint
 * - Bigint wins over integer
 * - Both integer = integer
 * - Unknown = no subtype
 */
function mergeNumberTypes(
  lhs: ExprValue,
  rhs: ExprValue,
  op: ArithmeticMalloyOperator
): NumberTypeDef {
  // Division and modulo always return float
  if (op === '/' || op === '%') {
    return {type: 'number', numberType: 'float'};
  }

  // Only applies if both are numbers
  if (lhs.type !== 'number' || rhs.type !== 'number') {
    return {type: 'number'};
  }

  const leftSubtype = lhs.numberType;
  const rightSubtype = rhs.numberType;

  // If either is float, result is float
  if (leftSubtype === 'float' || rightSubtype === 'float') {
    return {type: 'number', numberType: 'float'};
  }

  // If either is bigint, result is bigint
  if (leftSubtype === 'bigint' || rightSubtype === 'bigint') {
    return {type: 'number', numberType: 'bigint'};
  }

  // Both are integer, result is integer
  if (leftSubtype === 'integer' && rightSubtype === 'integer') {
    return {type: 'number', numberType: 'integer'};
  }

  // Unknown - no subtype
  return {type: 'number'};
}

function numeric(
  fs: FieldSpace,
  left: ExpressionDef,
  op: ArithmeticMalloyOperator,
  right: ExpressionDef
): ExprValue {
  const lhs = left.getExpression(fs);
  const rhs = right.getExpression(fs);

  const err = errorCascade('number', lhs, rhs);
  if (err) return err;

  const noGo = unsupportError(left, lhs, right, rhs);
  if (noGo) return noGo;

  if (lhs.type !== 'number') {
    left.logError(
      'arithmetic-operation-type-mismatch',
      `The '${op}' operator requires a number, not a '${lhs.type}'`
    );
  } else if (rhs.type !== 'number') {
    right.logError(
      'arithmetic-operation-type-mismatch',
      `The '${op}' operator requires a number, not a '${rhs.type}'`
    );
  } else {
    return computedExprValue({
      dataType: mergeNumberTypes(lhs, rhs, op),
      value: {node: op, kids: {left: lhs.value, right: rhs.value}},
      from: [lhs, rhs],
    });
  }
  return errorFor('numbers required');
}

function divmod(
  fs: FieldSpace,
  left: ExpressionDef,
  op: '/' | '%',
  right: ExpressionDef
): ExprValue {
  const num = left.getExpression(fs);
  const denom = right.getExpression(fs);
  const noGo = unsupportError(left, num, right, denom);
  if (noGo) return noGo;

  const err = errorCascade('number', num, denom);
  if (err) return err;

  if (num.type !== 'number') {
    left.logError(
      'arithmetic-operation-type-mismatch',
      'Numerator must be a number'
    );
  } else if (denom.type !== 'number') {
    right.logError(
      'arithmetic-operation-type-mismatch',
      'Denominator must be a number'
    );
  } else {
    return computedExprValue({
      dataType: mergeNumberTypes(num, denom, op),
      value: {node: op, kids: {left: num.value, right: denom.value}},
      from: [num, denom],
    });
  }
  return errorFor('divide type mismatch');
}

/**
 * A node made during translation has no parent, and a node without one
 * cannot log. This one takes the place in the tree of the node it is made
 * around.
 */
function durationAround(n: ExpressionDef, unit: TimestampUnit): ExprDuration {
  const inTree = n.parent;
  const duration = new ExprDuration(n, unit);
  duration.parent = inTree;
  return duration;
}

function delta(
  fs: FieldSpace,
  left: ExpressionDef,
  op: '+' | '-',
  right: ExpressionDef
): ExprValue {
  const lhs = left.getExpression(fs);
  const rhs = right.getExpression(fs);
  const noGo = unsupportError(left, lhs, right, rhs);
  if (noGo) {
    return noGo;
  }

  const timeLHS = isTemporalType(lhs.type);

  const err = errorCascade(timeLHS ? 'error' : 'number', lhs, rhs);
  if (err) return err;

  if (timeLHS) {
    let duration: ExpressionDef = right;
    if (rhs.type === 'duration' && !(right instanceof ExprDuration)) {
      // Only an ExprDuration knows its number and unit. Anything else with
      // a duration for a value would send the offset straight back here.
      return right.loggedErrorExpr(
        'time-offset-type-mismatch',
        'Can not offset time by a computed duration, write the number and unit of the duration here'
      );
    }
    if (rhs.type !== 'duration') {
      const byNumber = rhs.type === 'number';
      if (isGranularResult(lhs)) {
        duration = durationAround(right, lhs.timeframe);
      } else if (byNumber && left.getForms(fs).readings[0].range) {
        // A range with no granularity is a choice among different units
        return left.loggedErrorExpr(
          'time-offset-type-mismatch',
          "The choices have different granularities, so there is no unit to offset by; write the unit, as in '+ 1 month'"
        );
      } else if (lhs.type === 'date') {
        duration = durationAround(right, 'day');
      } else if (byNumber) {
        return left.loggedErrorExpr(
          'time-offset-type-mismatch',
          `A ${lhs.type} with no granularity has no unit to offset by; write the unit, as in '+ 1 day'`
        );
      } else {
        return left.loggedErrorExpr(
          'time-offset-type-mismatch',
          `Can not offset time by '${rhs.type}'`
        );
      }
    }
    return duration.apply(fs, op, left);
  }
  return numeric(fs, left, op, right);
}

function errorCascade(
  type: BasicExpressionType,
  ...es: ExprValue[]
): ExprValue | undefined {
  if (es.some(e => e.type === 'error')) {
    return computedExprValue({
      dataType: {type},
      value: {node: 'error', message: 'cascading error'},
      from: es,
    });
  }
}

/**
 * Return an error if a binary operation includes unsupported types.
 */
function unsupportError(
  l: ExpressionDef,
  lhs: ExprValue,
  r: ExpressionDef,
  rhs: ExprValue
): ExprValue | undefined {
  const ret = computedExprValue({
    dataType: lhs,
    value: {node: 'error', message: 'sql-native unsupported'},
    from: [lhs, rhs],
  });
  if (lhs.type === 'sql native') {
    l.logError('sql-native-not-allowed-in-expression', {rawType: lhs.rawType});
    ret.type = rhs.type;
    return ret;
  }
  if (rhs.type === 'sql native') {
    r.logError('sql-native-not-allowed-in-expression', {rawType: rhs.rawType});
    return ret;
  }
  return undefined;
}

export function checkFilterExpression(
  logTo: MalloyElement,
  ft: FilterExprType,
  fexpr: Expr
) {
  while (fexpr.node === '()') {
    fexpr = fexpr.e;
  }
  if (fexpr.node !== 'filterLiteral') {
    logTo.logError(
      'filter-expression-error',
      'Expected a filter expression literal here'
    );
    return;
  }
  const fsrc = fexpr.filterSrc;
  let err: string | undefined;
  if (isTemporalType(ft)) {
    err = TemporalFilterExpression.parse(fsrc).log[0]?.message;
  } else if (ft === 'string') {
    err = StringFilterExpression.parse(fsrc).log[0]?.message;
  } else if (ft === 'number') {
    err = NumberFilterExpression.parse(fsrc).log[0]?.message;
  } else if (ft === 'boolean') {
    err = BooleanFilterExpression.parse(fsrc).log[0]?.message;
  } else {
    logTo.logError(
      'filter-expression-type',
      `Cannot apply filter expression to type ${ft}`
    );
  }
  if (err !== undefined) {
    logTo.logError('filter-expression-error', `Filter syntax error: ${err}`);
  }
}
