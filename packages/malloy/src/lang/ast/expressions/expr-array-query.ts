/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {
  ArrayQueryExpr,
  FieldDef,
  FieldUsage,
  NestSourceDef,
  PipeSegment,
  SourceDef,
} from '../../../model/malloy_types';
import {
  TD,
  arrayQueryOnlyAggregates,
  arrayQueryReturnsValue,
  fieldUsageFrom,
  isQuerySegment,
} from '../../../model/malloy_types';
import {
  getExpandedSegment,
  mergeRefSummaries,
} from '../../composite-source-utils';
import {ErrorFactory} from '../error-factory';
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
 * several fields, which would be a record, is refused.
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
    if (dialect !== undefined && dialect.arrayQueries === undefined) {
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
    const {pipeline: written, outputStruct} = this.view.pipelineComp(
      new StaticSourceSpace(elements, 'public')
    );
    // Each stage's usage is expanded, as a query's are, so that the query
    // on the elements knows which joins of its own (an array inside the
    // elements) it needs.
    const pipeline = expandedPipeline(elements, written);
    const value: ArrayQueryExpr = {
      node: 'arrayQuery',
      kids: {array: arrayValue.value},
      pipeline,
    };
    // What the query reads from the elements is read in place, through the
    // array, without fanning the row out.
    const reads = mergeRefSummaries(arrayValue.refSummary, {
      fieldUsage: readsThroughArray(
        this.array.fieldReference.path,
        arrayDef.fields,
        pipeline[0]
      ),
    });
    const from: ExprValue[] = [{...arrayValue, refSummary: reads}];

    // Computed in place, or as a correlated subquery, or refused.
    const routes = dialect?.arrayQueryRoutes(pipeline);
    if (
      dialect !== undefined &&
      routes?.inPlace !== undefined &&
      routes.subquery !== undefined
    ) {
      return this.loggedErrorExpr(
        'array-query-not-in-place',
        dialect.arrayQueryRefusal(routes)
      );
    }

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
        from,
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
        'A query on an array with only `aggregate:` must have one field'
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
      from,
    });
  }
}

/** The pipeline with each stage's usage expanded against its input. */
function expandedPipeline(
  elements: NestSourceDef,
  pipeline: PipeSegment[]
): PipeSegment[] {
  const expanded: PipeSegment[] = [];
  let input: SourceDef = elements;
  for (const segment of pipeline) {
    const stage = getExpandedSegment(segment, input);
    expanded.push(stage);
    input = stage.outputStruct ?? ErrorFactory.structDef;
  }
  return expanded;
}

/**
 * What the first stage of a query on an array reads from the elements, as
 * paths through the array, `arrayPath`. Each is a weak reference
 * (`inPlaceDepth`): it names the array and the element fields it reads, and
 * activates no join from the array down. What the query needs to compute
 * its own aggregates, over the elements, is not a need of the row's query,
 * so no entry carries a distinct-key requirement or a window function. A
 * later stage reads the stage before it, not the array, and a `having:` or
 * `calculate:` names the query's own output; neither is a read of the
 * elements.
 */
function readsThroughArray(
  arrayPath: string[],
  elementFields: FieldDef[],
  firstStage: PipeSegment | undefined
): FieldUsage {
  if (firstStage === undefined || firstStage.type === 'raw') return [];
  const inner =
    firstStage.expandedFieldUsage ?? fieldUsageFrom(firstStage.refSummary);
  const isElementField = (name: string) =>
    elementFields.some(f => (f.as ?? f.name) === name);
  return inner
    .filter(u => u.path.length > 0 && isElementField(u.path[0]))
    .map(u => ({
      path: [...arrayPath, ...u.path],
      ...(u.at && {at: u.at}),
      inPlaceDepth: 1 + u.path.length,
    }));
}
