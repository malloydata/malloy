/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {ArrayQueryExpr, NestSourceDef} from '../../../model/malloy_types';
import {TD, expressionIsAggregate} from '../../../model/malloy_types';
import {StaticSourceSpace} from '../field-space/static-space';
import {StructSpaceFieldBase} from '../field-space/struct-space-field-base';
import type {ExprValue} from '../types/expr-value';
import {computedExprValue} from '../types/expr-value';
import type {FieldSpace} from '../types/field-space';
import {ExpressionDef} from '../types/expression-def';
import type {View} from '../view-elements/view';
import type {ExprIdReference} from './expr-id-reference';

/**
 * `items -> { aggregate: price.sum() }`: a query run on the elements of an
 * array of the current row, whose one result is a value of that row.
 *
 * The view runs with the array's elements as its source: a record's fields,
 * or `value` and `each` for an array of scalars. For now the query must be
 * one stage of `aggregate:` alone, with one field, and its value is that
 * field's; a query with rows of its own, which would be an array, is still
 * to come.
 */
export class ExprArrayQuery extends ExpressionDef {
  elementType = 'arrayQuery';

  constructor(
    readonly array: ExprIdReference,
    readonly view: View
  ) {
    super({array, view});
  }

  protected computeExpression(fs: FieldSpace): ExprValue {
    const dialect = fs.dialectObj();
    if (dialect !== undefined && !dialect.supportsArrayQueries) {
      return this.loggedErrorExpr(
        'array-query-not-supported',
        `The ${dialect.name} dialect cannot query an array with ->`
      );
    }
    const arrayValue = this.array.getExpression(fs);
    const entry = this.array.fieldReference.getField(fs).found;
    const arrayDef =
      entry instanceof StructSpaceFieldBase ? entry.fieldDef() : undefined;
    if (arrayDef?.type !== 'array') {
      return this.loggedErrorExpr(
        'array-query-not-array',
        `'${this.array.refString}' is not an array; only an array can be queried with ->`
      );
    }
    const elements: NestSourceDef = {
      type: 'nest_source',
      name: arrayDef.name,
      pipeSQL: '',
      fields: arrayDef.fields,
      connection: fs.connectionName(),
      dialect: fs.dialectName(),
    };
    const {pipeline, outputStruct} = this.view.pipelineComp(
      new StaticSourceSpace(elements, 'public')
    );
    const [segment, ...moreSegments] = pipeline;
    const [result, ...moreResults] = outputStruct.fields;
    // One stage of `aggregate:` alone returns exactly one row.
    const onlyAggregates =
      segment?.type === 'reduce' &&
      segment.queryFields.every(
        f =>
          f.type !== 'fieldref' &&
          f.type !== 'turtle' &&
          expressionIsAggregate(f.expressionType)
      );
    if (
      !onlyAggregates ||
      moreSegments.length > 0 ||
      result === undefined ||
      moreResults.length > 0 ||
      !TD.isAtomic(result)
    ) {
      return this.loggedErrorExpr(
        'array-query-not-scalar',
        'A query on an array must, for now, be one `aggregate:` with one field'
      );
    }
    const value: ArrayQueryExpr = {
      node: 'arrayQuery',
      kids: {array: arrayValue.value},
      pipeline,
    };
    return computedExprValue({
      value,
      dataType: TD.atomicDef(result),
      from: [arrayValue],
    });
  }
}
