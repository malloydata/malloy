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

import {AtomicFieldType, CastType} from '../../../model';
import {castTo} from '../time-utils';
import {ExprValue, computedExprValue} from '../types/expr-value';
import {ExpressionDef} from '../types/expression-def';
import {FieldSpace} from '../types/field-space';

export class ExprCast extends ExpressionDef {
  elementType = 'cast';
  constructor(
    readonly expr: ExpressionDef,
    readonly castType: CastType | {raw: string},
    readonly safe = false
  ) {
    super({expr: expr});
  }

  getExpression(fs: FieldSpace): ExprValue {
    const expr = this.expr.getExpression(fs);
    let dataType: AtomicFieldType = 'error';
    if (typeof this.castType === 'string') {
      dataType = this.castType;
    } else {
      const dialect = fs.dialectObj();
      if (dialect) {
        if (dialect.validateTypeName(this.castType.raw)) {
          // TODO theoretically `sqlTypeToMalloyType` can get number subtypes,
          // but `TypeDesc` does not support them.
          dataType = dialect.sqlTypeToMalloyType(this.castType.raw).type;
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
    return computedExprValue({
      dataType,
      value: castTo(this.castType, expr.value, expr.dataType, this.safe),
      from: [expr],
    });
  }
}
