/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {
  FieldUsage,
  FunctionOrderBy as ModelFunctionOrderBy,
} from '../../../model/malloy_types';
import {
  expressionIsAggregate,
  expressionIsScalar,
  fieldUsageFrom,
} from '../../../model/malloy_types';
import type {ExpressionDef} from '../types/expression-def';

import type {FieldSpace} from '../types/field-space';
import {ListOf, MalloyElement} from '../types/malloy-element';
import {ExprIdReference} from './expr-id-reference';
import {mergeFieldUsage} from '../../composite-source-utils';

type FieldUsageSummary = FieldUsage | undefined;

export class FunctionOrderBy extends MalloyElement {
  elementType = 'orderBy';
  constructor(
    readonly field?: ExpressionDef,
    readonly dir?: 'asc' | 'desc'
  ) {
    super();
    if (field) this.has({field});
  }

  computeAnalyticOrderBy(fs: FieldSpace): {
    modelFunctionOrderBy: ModelFunctionOrderBy;
    fieldUsage: FieldUsageSummary;
  } {
    let fieldUsage: FieldUsageSummary = undefined;
    if (!this.field) {
      this.logError(
        'analytic-order-by-missing-field',
        'analytic `order_by` must specify an aggregate expression or output field reference'
      );
      return {
        modelFunctionOrderBy: {
          node: 'functionOrderBy',
          e: {node: 'error'},
          dir: this.dir,
        },
        fieldUsage,
      };
    }
    const expr = this.field.getExpression(fs);
    fieldUsage = fieldUsageFrom(expr.refSummary);
    if (expressionIsAggregate(expr.expressionType)) {
      // Aggregates are okay
    } else if (expressionIsScalar(expr.expressionType)) {
      if (
        !(this.field instanceof ExprIdReference) ||
        expr.evalSpace === 'input'
      ) {
        this.field.logError(
          'analytic-order-by-not-output',
          'analytic `order_by` must be an aggregate or an output field reference'
        );
      }
    } else {
      this.field.logError(
        'analytic-order-by-not-aggregate-or-output',
        'analytic `order_by` must be scalar or aggregate'
      );
    }
    return {
      modelFunctionOrderBy: {
        node: 'functionOrderBy',
        e: expr.value,
        dir: this.dir,
      },
      fieldUsage,
    };
  }

  computeAggregateOrderByWithUsage(
    fs: FieldSpace,
    allowExpression: boolean
  ): {
    modelFunctionOrderBy: ModelFunctionOrderBy;
    fieldUsage: FieldUsageSummary;
  } {
    let fieldUsage: FieldUsageSummary = undefined;
    const dir = this.dir || 'asc';
    if (this.field) {
      const expr = this.field.getExpression(fs);
      fieldUsage = fieldUsageFrom(expr.refSummary);
      if (!expressionIsScalar(expr.expressionType)) {
        this.field.logError(
          'aggregate-order-by-not-scalar',
          'aggregate `order_by` must be scalar'
        );
      }
      if (!allowExpression) {
        this.field.logError(
          'aggregate-order-by-expression-not-allowed',
          '`order_by` must be only `asc` or `desc` with no expression'
        );
      }
      return {
        modelFunctionOrderBy: {
          node: 'functionOrderBy',
          e: expr.value,
          dir,
        },
        fieldUsage,
      };
    } else {
      if (this.dir === undefined) {
        // This error should technically never happen because it can't parse this way
        this.logError(
          'aggregate-order-by-without-field-or-direction',
          'field or order direction must be specified'
        );
      }
      return {
        modelFunctionOrderBy: {
          node: 'functionDefaultOrderBy',
          dir,
        },
        fieldUsage,
      };
    }
  }
}

export class FunctionOrdering extends ListOf<FunctionOrderBy> {
  elementType = 'function-ordering';

  constructor(list: FunctionOrderBy[]) {
    super(list);
  }

  getAnalyticOrderBy(fs: FieldSpace): {
    orderBy: ModelFunctionOrderBy[];
    fieldUsage: FieldUsageSummary;
  } {
    const ret: ModelFunctionOrderBy[] = [];
    const fieldUsage: FieldUsageSummary[] = [];
    for (const ob of this.list) {
      const computed = ob.computeAnalyticOrderBy(fs);
      ret.push(computed.modelFunctionOrderBy);
      fieldUsage.push(computed.fieldUsage);
    }
    return {
      orderBy: ret,
      fieldUsage: mergeFieldUsage(...fieldUsage),
    };
  }

  getAggregateOrderBy(
    fs: FieldSpace,
    allowExpression: boolean
  ): {
    orderBy: ModelFunctionOrderBy[];
    fieldUsage: FieldUsageSummary;
  } {
    const ret: ModelFunctionOrderBy[] = [];
    const fieldUsage: FieldUsageSummary[] = [];
    for (const ob of this.list) {
      const computed = ob.computeAggregateOrderByWithUsage(fs, allowExpression);
      ret.push(computed.modelFunctionOrderBy);
      fieldUsage.push(computed.fieldUsage);
    }
    return {
      orderBy: ret,
      fieldUsage: mergeFieldUsage(...fieldUsage),
    };
  }
}
