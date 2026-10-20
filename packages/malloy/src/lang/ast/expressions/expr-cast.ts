/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {AtomicTypeDef} from '../../../model/malloy_types';
import {castTo} from '../time-utils';
import type {ExprValue} from '../types/expr-value';
import {computedExprValue} from '../types/expr-value';
import {ExpressionDef} from '../types/expression-def';
import type {FieldSpace} from '../types/field-space';
import {booleanValueError} from './boolean-value';

export class ExprCast extends ExpressionDef {
  elementType = 'cast';
  constructor(
    readonly expr: ExpressionDef,
    readonly castType: AtomicTypeDef | {raw: string},
    readonly safe = false
  ) {
    super({expr: expr});
  }

  // TODO: Validate senseless casts (e.g. scalar to record) at translate time
  // for better error messages than what the dialect/database produces.
  protected computeExpression(fs: FieldSpace): ExprValue {
    const expr = this.expr.getExpression(fs);
    let dataType: AtomicTypeDef = {type: 'error'};
    if ('type' in this.castType) {
      dataType = this.castType;
    } else {
      const dialect = fs.dialectObj();
      if (dialect) {
        if (dialect.validateTypeName(this.castType.raw)) {
          dataType = dialect.sqlTypeToMalloyType(this.castType.raw);
        } else {
          this.logError(
            'invalid-sql-native-type',
            `Cast type \`${this.castType.raw}\` is invalid for ${dialect.name} dialect`
          );
        }
        if (this.safe && !dialect.supportsSafeCast) {
          this.logError(
            'dialect-cast-unsafe-only',
            `The SQL dialect '${fs.dialectName()}' does not supply a safe cast operator`
          );
        }
      }
    }
    const noCast =
      booleanValueError(
        fs,
        expr,
        'in a cast',
        this,
        'write the value, pick 1 when … else 0'
      ) ||
      booleanValueError(
        fs,
        dataType,
        'as the type of a cast',
        this,
        'write a comparison'
      );
    if (noCast) return noCast;
    return computedExprValue({
      dataType,
      value: castTo(this.castType, expr.value, expr.type, this.safe),
      from: [expr],
    });
  }
}
