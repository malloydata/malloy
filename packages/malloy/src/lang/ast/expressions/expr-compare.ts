/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {InGivenExpr} from '../../../model/malloy_types';
import {isRepeatedRecord, TD} from '../../../model/malloy_types';
import {typeDefToString} from '../../../model/utils';
import * as TDU from '../typedesc-utils';
import {computedErrorExprValue} from '../types/expr-value';
import type {
  BinaryMalloyOperator,
  CompareMalloyOperator,
  EqualityMalloyOperator,
} from '../types/binary_operators';
import type {ExprValue} from '../types/expr-value';
import {computedExprValue} from '../types/expr-value';
import {ExpressionDef} from '../types/expression-def';
import type {FieldSpace} from '../types/field-space';
import {BinaryBoolean} from './binary-boolean';
import type {GivenReference} from './expr-given';

const compareTypes = {
  '~': [TDU.stringT],
  '!~': [TDU.stringT],
  '<': [TDU.numberT, TDU.stringT, TDU.dateT, TDU.timestampT],
  '<=': [TDU.numberT, TDU.stringT, TDU.dateT, TDU.timestampT],
  '=': [TDU.numberT, TDU.stringT, TDU.dateT, TDU.timestampT],
  '!=': [TDU.numberT, TDU.stringT, TDU.dateT, TDU.timestampT],
  '>=': [TDU.numberT, TDU.stringT, TDU.dateT, TDU.timestampT],
  '>': [TDU.numberT, TDU.stringT, TDU.dateT, TDU.timestampT],
};

export class ExprCompare extends BinaryBoolean<CompareMalloyOperator> {
  elementType = 'a<=>b';
  constructor(
    left: ExpressionDef,
    op: CompareMalloyOperator,
    right: ExpressionDef
  ) {
    super(left, op, right);
    this.legalChildTypes = compareTypes[op];
  }

  getExpression(fs: FieldSpace): ExprValue {
    return this.right.apply(fs, this.op, this.left);
  }
}

/**
 * The parser makes equality nodes, an application of ?
 * makes an ExprCompare node with operator =. This is how
 * the special rules for how apply works for equality
 * nodes gets implemented.
 */
export class ExprEquality extends ExprCompare {
  elementType = 'a~=b';
  constructor(
    left: ExpressionDef,
    op: EqualityMalloyOperator,
    right: ExpressionDef
  ) {
    super(left, op, right);
  }

  getExpression(fs: FieldSpace): ExprValue {
    return this.right.apply(fs, this.op, this.left, true);
  }

  apply(
    fs: FieldSpace,
    op: BinaryMalloyOperator,
    left: ExpressionDef
  ): ExprValue {
    return super.apply(fs, op, left, true);
  }
}

export class ExprLegacyIn extends ExpressionDef {
  elementType = 'in';
  constructor(
    readonly expr: ExpressionDef,
    readonly notIn: boolean,
    readonly choices: ExpressionDef[]
  ) {
    super();
    this.has({expr, choices});
  }

  getExpression(fs: FieldSpace): ExprValue {
    const lookFor = this.expr.getExpression(fs);
    const oneOf = this.choices.map(e => e.getExpression(fs));
    return computedExprValue({
      dataType: {type: 'boolean'},
      value: {
        node: 'in',
        not: this.notIn,
        kids: {e: lookFor.value, oneOf: oneOf.map(v => v.value)},
      },
      from: [lookFor, ...oneOf],
    });
  }
}

/**
 * `expr in $ARRAY_GIVEN` — runtime test of a basic-typed expression
 * against the elements of a runtime-bound array given. The translator
 * verifies the given is `T[]` and the LHS is the same basic `T`; SQL
 * emission expands the bound array's elements at compile time.
 */
export class ExprInGiven extends ExpressionDef {
  elementType = 'inGiven';
  constructor(
    readonly expr: ExpressionDef,
    readonly notIn: boolean,
    readonly givenRef: GivenReference
  ) {
    super();
    this.has({expr, givenRef});
  }

  getExpression(fs: FieldSpace): ExprValue {
    const lookFor = this.expr.getExpression(fs);
    const givenVal = this.givenRef.getExpression(fs);

    // `in` is logically a boolean — every error path returns a
    // boolean-typed error so a `where:` clause around us doesn't pile a
    // "filter must be boolean" complaint on top of our own diagnostic.
    const boolError = (): ExprValue =>
      computedErrorExprValue({
        dataType: {type: 'boolean'},
        error: 'in-given type error',
        from: [lookFor, givenVal],
      });

    if (lookFor.type === 'error' || givenVal.type === 'error') {
      return boolError();
    }

    // GivenReference only ever returns a `given` ExprValue on the
    // success path; the error branch is filtered above. No other case
    // is reachable here.
    const givenNode = givenVal.value;
    if (givenNode.node !== 'given') {
      throw this.internalError(
        `expected GivenReference to produce a 'given' node, got '${givenNode.node}'`
      );
    }

    if (!TD.isAtomic(givenVal) || givenVal.type !== 'array') {
      this.logError('in-given-rhs-not-array', {
        givenName: this.givenRef.name,
        actualType: TD.isAtomic(givenVal)
          ? typeDefToString(givenVal)
          : givenVal.type,
      });
      return boolError();
    }
    if (isRepeatedRecord(givenVal)) {
      this.logError('in-given-rhs-not-basic-array', {
        givenName: this.givenRef.name,
        elementType: typeDefToString(givenVal),
      });
      return boolError();
    }
    // givenVal is BasicArrayTypeDef-shaped — the union for array
    // AtomicTypeDefs is BasicArray | RepeatedRecord, and the
    // RepeatedRecord branch returned above.
    const elemType = givenVal.elementTypeDef;

    if (!TD.isBasicAtomic(lookFor) || lookFor.type !== elemType.type) {
      this.logError('in-given-type-mismatch', {
        lhsType: TD.isAtomic(lookFor) ? typeDefToString(lookFor) : lookFor.type,
        elementType: typeDefToString(elemType),
      });
      return boolError();
    }

    const inGivenNode: InGivenExpr = {
      node: 'inGiven',
      not: this.notIn,
      givenRef: givenNode,
      e: lookFor.value,
    };
    return computedExprValue({
      dataType: {type: 'boolean'},
      value: inGivenNode,
      from: [lookFor, givenVal],
    });
  }
}
