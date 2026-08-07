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

class TypeMismatch extends Error {}

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
    v.morphic,
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

/** Node types in an alternation tree */
export enum ATNodeType {
  And,
  Or,
  Value,
  Partial,
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
   * Returns the "translation" or Expr tree for SQL generation. When asking
   * for a translation you may pass the types you can accept, allowing
   * the translation code a chance to convert to match your expectations
   * @param space Namespace for looking up field references
   *
   * THE RETURNED ExprValue IS SHARED -- TREAT IT AS IMMUTABLE. Asking twice
   * yields the same object, so to derive a value from one, build a new one:
   * `{...operand, type: 'boolean'}` or `computedExprValue({…, from: [operand]})`.
   *
   * DO NOT OVERRIDE THIS. Nodes implement `computeExpression`; an override
   * here bypasses the memo, which for `+`/`-` chains is the difference
   * between linear and exponential compile time.
   */
  getExpression(fs: FieldSpace): ExprValue {
    const initialGeneration = fs.generation();
    if (
      this.memoValue !== undefined &&
      this.memoFs === fs &&
      this.memoGen === initialGeneration
    ) {
      return this.memoValue;
    }

    // If we get here and memoFs is set and memoGen is not set, then somewhere
    // inside this expression is a recursive call asking this node for the
    // value it is in the middle of computing. There is nothing to return and
    // computing one would recurse again, so throw. An abandoned computation
    // does not look like this -- see the finally below.

    if (this.memoFs !== undefined && this.memoGen === undefined) {
      throw this.internalError(
        `ExpressionDef.getExpression memoization failure on ${this.elementType}`
      );
    }

    this.memoFs = fs;
    this.memoGen = undefined;
    try {
      const value = this.computeExpression(fs);
      if (initialGeneration === fs.generation()) {
        this.memoGen = initialGeneration;
        this.memoValue = shareable(value);
      }
      return value;
    } finally {
      if (this.memoGen === undefined) {
        // Threw, or a name was rebound while we ran. Leave no stamp: a caller
        // which recovers must get a fresh computation, not our remains.
        this.memoFs = undefined;
      }
    }
  }

  /**
   * The last value this node computed, and what it was computed against.
   * Three states, distinguished by memoGen:
   *
   *   memoFs undefined              -- nothing computed, or abandoned
   *   memoFs set, memoGen undefined -- computing right now, and only that,
   *                                    since abandoning clears memoFs
   *   memoFs set, memoGen set       -- memoValue is that computation's result
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
  private memoValue?: ExprValue;

  /**
   * Evaluate this node. Implemented by every expression node; called only
   * by `getExpression` above, never directly.
   */
  protected abstract computeExpression(fs: FieldSpace): ExprValue;
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
   * @return The translated expression
   */
  apply(
    fs: FieldSpace,
    op: BinaryMalloyOperator,
    left: ExpressionDef,
    _warnOnComplexTree = false
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

  atNodeType(): ATNodeType {
    return ATNodeType.Value;
  }

  atExpr(): ExpressionDef {
    return this;
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

function willMorphTo(ev: ExprValue, t: MorphicType): Expr | undefined {
  if (ev.type === t || (t === 'timestamp' && ev.type === 'timestamptz')) {
    return ev.value;
  }
  return ev.morphic && ev.morphic[t];
}

export type MorphicType = 'date' | 'timestamp';
export function getMorphicValue(
  mv: ExprValue,
  mt: MorphicType
): ExprValue | undefined {
  if (mv.type === mt) {
    return mv;
  }
  if (mv.morphic && mv.morphic[mt]) {
    return computedExprValue({
      dataType: {type: mt},
      value: mv.morphic[mt],
      from: [mv],
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
  if (leftIsTime && rightIsTime) {
    if (lhs.type !== rhs.type) {
      const lval = willMorphTo(lhs, 'timestamp');
      const rval = willMorphTo(rhs, 'timestamp');
      if (lval && rval) {
        return {node, kids: {left: lval, right: rval}};
      }
    } else {
      return {node, kids: {left: lhs.value, right: rhs.value}};
    }
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

function equality(
  fs: FieldSpace,
  left: ExpressionDef,
  op: EqualityMalloyOperator,
  right: ExpressionDef
): ExprValue {
  const lhs = left.getExpression(fs);
  const rhs = right.getExpression(fs);
  const node = getExprNode(op);

  const err = errorCascade('boolean', lhs, rhs);
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
      if (op === '!~') {
        filterMatch.notMatch = true;
      }
      value = filterMatch;
    } else {
      return left.loggedErrorExpr(
        'filter-expression-type',
        `Cannot use filter expressions with type '${lhs.type}'`
      );
    }
  } else {
    value = timeCompare(left, lhs, op, rhs) || {
      node,
      kids: {left: lhs.value, right: rhs.value},
    };

    if (
      lhs.type !== 'error' &&
      rhs.type !== 'error' &&
      (op === '~' || op === '!~')
    ) {
      if (lhs.type !== 'string' || rhs.type !== 'string') {
        let regexCmp = regexEqual(lhs, rhs);
        if (regexCmp) {
          if (op[0] === '!') {
            regexCmp = {node: 'not', e: {...regexCmp}};
          }
        } else {
          throw new TypeMismatch("Incompatible types for match('~') operator");
        }
        value = regexCmp;
      }
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
  const lhs = left.getExpression(fs);
  const rhs = right.getExpression(fs);

  const err = errorCascade('boolean', lhs, rhs);
  if (err) return err;

  const noCompare = unsupportError(left, lhs, right, rhs);
  if (noCompare) {
    return {...noCompare, type: 'boolean'};
  }
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
    if (rhs.type !== 'duration') {
      if (isGranularResult(lhs)) {
        duration = new ExprDuration(right, lhs.timeframe);
      } else if (lhs.type === 'date') {
        duration = new ExprDuration(right, 'day');
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
