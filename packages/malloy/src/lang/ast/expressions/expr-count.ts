/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {AggregateExpr} from '../../../model/malloy_types';
import type {FieldReference} from '../query-items/field-references';
import type {ExprValue} from '../types/expr-value';
import type {FieldSpace} from '../types/field-space';
import {ExprAggregateFunction} from './expr-aggregate-function';

export class ExprCount extends ExprAggregateFunction {
  elementType = 'count';
  constructor(readonly source?: FieldReference) {
    super('count');
    this.has({source: source});
  }

  defaultFieldName(): string | undefined {
    if (this.source) {
      return 'count_' + this.source.nameString;
    }
    return undefined;
  }

  returns(ev: ExprValue): ExprValue {
    return {
      type: 'number',
      numberType: 'integer',
      evalSpace: ev.evalSpace,
      expressionType: 'aggregate',
      value: ev.value,
      refSummary: ev.refSummary,
    };
  }

  getExpression(_fs: FieldSpace): ExprValue {
    const ret: AggregateExpr = {
      node: 'aggregate',
      function: 'count',
      e: {node: ''},
      at: this.location,
    };
    if (this.source) {
      ret.structPath = this.source.path;
    }
    return {
      type: 'number',
      numberType: 'integer',
      expressionType: 'aggregate',
      value: ret,
      evalSpace: 'output',
      refSummary: {
        fieldUsage: [
          {path: ret.structPath || [], uniqueKeyRequirement: {isCount: true}},
        ],
      },
    };
  }
}
