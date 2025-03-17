/*
 * Copyright 2023 Google LLC
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files
 * (the "Software"), to deal in the Software without restriction,
 * including without limitation the rights to use, copy, modify, merge,
 * publish, distribute, sublicense, and/or sell copies of the Software,
 * and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import type {
  Expr,
  TimestampUnit,
  LeafExpressionType,
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

class TypeMismatch extends Error {}

/** Node types in an alternation tree */
export enum ATNodeType {
  And,
  Or,
  Value,
  Partial,
}

/**
 * Root node for any element in an expression. These essentially
 * create a sub-tree in the larger AST. Expression nodes know
 * how to write themselves as SQL (or rather, generate the
 * template for SQL required by the query writer)
 */
export abstract class ExpressionDef extends MalloyElement {
  abstract elementType: string;
  granular(): boolean {
    return false;
  }

  /**
   * Returns the "translation" or template for SQL generation. When asking
   * for a translation you may pass the types you can accept, allowing
   * the translation code a chance to convert to match your expectations
   * @param space Namespace for looking up field references
   */
  abstract getExpression(fs: FieldSpace): ExprValue;
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

  /**
   * This is the operation which makes partial comparison and value trees work
   * The default implementation merely constructs LEFT OP RIGHT, but specialized
   * nodes like alternation trees or or partial comparison can control how
   * the appplication gets generated
   * @param fs The symbol table
   * @param op The operator being applied
   * @param expr The "other" (besdies 'this') value
   * @return The translated expression
   */
  apply(
    fs: FieldSpace,
    op: BinaryMalloyOperator,
    left: ExpressionDef,
    _warnOnComplexTree = false
  ): ExprValue {
    return applyBinary(fs, left, op, this);
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
  legalChildTypes = [TDU.timestampT, TDU.dateT];
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

  getExpression(fs: FieldSpace): ExprValue {
    const num = this.n.getExpression(fs);
    return computedErrorExprValue({
      dataType: {type: 'duration'},
      error: 'Duration is not a value',
      from: [num],
    });
  }
}

function willMorphTo(ev: ExprValue, t: MorphicType): Expr | undefined {
  if (ev.type === t) {
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
        return {node, kids: {left: lval, right: lval}};
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
  let value = timeCompare(left, lhs, op, rhs) || {
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
      dataType: {type: 'number'},
      value: {node: op, kids: {left: lhs.value, right: rhs.value}},
      from: [lhs, rhs],
    });
  }
  return errorFor('numbers required');
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

/**
 * All of the magic of malloy expressions eventually flows to here,
 * where an operator is applied to two values. Depending on the
 * operator and value types this may involve transformations of
 * the values or even the operator.
 * @param fs FieldSpace for the symbols
 * @param left Left value
 * @param op The operator
 * @param right Right Value
 * @return ExprValue of the expression
 */
export function applyBinary(
  fs: FieldSpace,
  left: ExpressionDef,
  op: BinaryMalloyOperator,
  right: ExpressionDef
): ExprValue {
  if (isEquality(op)) {
    return equality(fs, left, op, right);
  }
  if (isComparison(op)) {
    return compare(fs, left, op, right);
  }
  if (op === '+' || op === '-') {
    return delta(fs, left, op, right);
  }
  if (op === '*') {
    return numeric(fs, left, op, right);
  }
  if (op === '/' || op === '%') {
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
      const divmod: Expr = {
        node: op,
        kids: {left: num.value, right: denom.value},
      };
      return computedExprValue({
        dataType: {type: 'number'},
        value: divmod,
        from: [num, denom],
      });
    }
    return errorFor('divide type mismatch');
  }
  return left.loggedErrorExpr(
    'unexpected-binary-operator',
    `Cannot use ${op} operator here`
  );
}

function errorCascade(
  type: LeafExpressionType,
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
