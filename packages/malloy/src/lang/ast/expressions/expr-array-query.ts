/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {ArrayQueryExpr, NestSourceDef} from '../../../model/malloy_types';
import {
  TD,
  arrayQueryOnlyAggregates,
  arrayQueryReturnsValue,
  isQuerySegment,
} from '../../../model/malloy_types';
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
 * or `value` and `each` for an array of scalars. One stage of `aggregate:`
 * alone, with one field, returns that field's value; any other query
 * returns its rows, as an array of records. One stage of `aggregate:` with
 * several fields, which would be a record, is still to come.
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
    const value: ArrayQueryExpr = {
      node: 'arrayQuery',
      kids: {array: arrayValue.value},
      pipeline,
    };
    const [result, ...moreResults] = outputStruct.fields;
    if (arrayQueryReturnsValue(pipeline) && result !== undefined) {
      if (!TD.isAtomic(result)) {
        return this.loggedErrorExpr(
          'array-query-not-scalar',
          'The aggregate of a query on an array must be a value'
        );
      }
      return computedExprValue({
        value,
        dataType: TD.atomicDef(result),
        from: [arrayValue],
      });
    }
    // One stage of `aggregate:` alone with several fields returns one row,
    // which would be a record.
    const [segment, ...moreSegments] = pipeline;
    if (
      result === undefined ||
      (moreResults.length > 0 &&
        moreSegments.length === 0 &&
        isQuerySegment(segment) &&
        arrayQueryOnlyAggregates(segment))
    ) {
      return this.loggedErrorExpr(
        'array-query-not-scalar',
        'A query on an array with only `aggregate:` must, for now, have one field'
      );
    }
    // Any other query returns rows, which make an array of records.
    return computedExprValue({
      value,
      dataType: {
        type: 'array',
        elementTypeDef: {type: 'record_element'},
        fields: outputStruct.fields,
      },
      from: [arrayValue],
    });
  }
}
