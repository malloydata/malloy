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

import {expressionIsCalculation} from '../../../model/malloy_types';

import {errorFor} from '../ast-utils';
import {FT} from '../fragtype-utils';
import {Filter} from '../query-properties/filters';
import {Limit} from '../query-properties/limit';
import {Ordering} from '../query-properties/ordering';
import {PartitionBy} from '../query-properties/partition_by';
import {ExprValue} from '../types/expr-value';
import {ExpressionDef} from '../types/expression-def';
import {FieldPropStatement} from '../types/field-prop-statement';
import {FieldSpace} from '../types/field-space';
import {ExprFunc} from './expr-func';

export class ExprProps extends ExpressionDef {
  elementType = 'expression with props';
  legalChildTypes = FT.anyAtomicT;
  constructor(
    readonly expr: ExpressionDef,
    readonly statements: FieldPropStatement[]
  ) {
    super({expr, statements});
  }

  private getFilteredExpression(
    fs: FieldSpace,
    expr: ExprValue,
    where: Filter | undefined
  ): ExprValue {
    if (where) {
      if (!this.expr.supportsWhere(expr)) {
        this.expr.log('Filtered expression requires an aggregate computation');
        return expr;
      }
      const testList = where.getFilterList(fs);
      if (testList.find(cond => expressionIsCalculation(cond.expressionType))) {
        where.log(
          'Cannot filter an expresion with an aggregate or analytical computation'
        );
        return expr;
      }
      if (this.typeCheck(this.expr, {...expr, expressionType: 'scalar'})) {
        return {
          ...expr,
          value: [
            {
              type: 'filterExpression',
              e: expr.value,
              filterList: testList,
            },
          ],
        };
      }
      this.expr.log(`Cannot filter '${expr.dataType}' data`);
      return errorFor('cannot filter type');
    }
    return expr;
  }

  getExpression(fs: FieldSpace): ExprValue {
    let partitionBy: PartitionBy | undefined;
    let limit: Limit | undefined;
    let orderBy: Ordering | undefined;
    let where: Filter | undefined;
    for (const statement of this.statements) {
      if (statement instanceof PartitionBy) {
        if (partitionBy) {
          statement.log('partition_by already specified');
        } else {
          partitionBy = statement;
        }
      } else if (statement instanceof Limit) {
        if (limit) {
          statement.log('limit already specified');
        } else {
          limit = statement;
        }
      } else if (statement instanceof Ordering) {
        if (orderBy) {
          statement.log('ordering already specified');
        } else {
          orderBy = statement;
        }
      } else {
        if (where) {
          // TODO support multiple wheres
          statement.log('filter alredy specified');
        } else {
          where = statement;
        }
      }
    }
    const resultExpr =
      this.expr instanceof ExprFunc
        ? this.expr.getPropsExpression(fs, {
            partitionBy,
            limit,
            orderBy,
          })
        : this.expr.getExpression(fs);
    return this.getFilteredExpression(fs, resultExpr, where);
  }
}
