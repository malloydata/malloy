/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {
  ArrayQueryExpr,
  FieldDef,
  NestSourceDef,
  PipeSegment,
  RefSummary,
  SourceDef,
} from '../../../model/malloy_types';
import {
  TD,
  arrayQueryOnlyAggregates,
  arrayQueryReturnsValue,
  activeName,
  arrayValueNotOneAggregate,
  isQuerySegment,
  mapFieldUsage,
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
 * returns its rows, as an array of records, where the dialect returns
 * arrays (`ArrayQuerySupport.arrays`). One stage of `aggregate:` with
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
    const support = dialect?.arrayQueries;
    if (dialect !== undefined && support === undefined) {
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
    const reads = mergeRefSummaries(
      arrayValue.refSummary,
      readsThroughArray(
        this.array.fieldReference.path,
        arrayDef.fields,
        written[0]
      )
    );
    const from: ExprValue[] = [{...arrayValue, refSummary: reads}];

    const [result, ...moreResults] = outputStruct.fields;
    const [segment, ...moreSegments] = pipeline;
    if (arrayQueryReturnsValue(pipeline) && result !== undefined) {
      if (!TD.isAtomic(result)) {
        return this.loggedErrorExpr(
          'array-query-not-scalar',
          'The aggregate of a query on an array must be a value'
        );
      }
      // Array functions take one aggregate; a dialect with a correlated
      // subquery runs anything else as that.
      const notOneAggregate =
        dialect !== undefined &&
        !dialect.arrayQueryHasSubquery() &&
        isQuerySegment(segment)
          ? arrayValueNotOneAggregate(segment)
          : undefined;
      if (notOneAggregate !== undefined) {
        return this.loggedErrorExpr(
          'array-query-not-in-place',
          `The ${dialect?.name} dialect cannot query this array: ${notOneAggregate}`
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
    if (dialect !== undefined && support?.arrays === false) {
      return this.loggedErrorExpr(
        'array-query-not-supported',
        `The ${dialect.name} dialect can only query an array for one value: one stage of \`aggregate:\` with one field`
      );
    }
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
 * the stage's own `refSummary` re-rooted through the array, `arrayPath`,
 * with its givens carried along. Each path is a weak reference
 * (`inPlaceDepth`): it names the array and the element fields it reads, and
 * activates no join from the array down. Expanding the row's query follows
 * a computed element field from there, keeping it weak.
 *
 * What the stage needs to compute its own aggregates, over the elements, is
 * not a need of the row's query, so no entry keeps a distinct-key
 * requirement or a window function; left in, they would unnest the array.
 * A later stage reads the stage before it, not the array. A `having:` or
 * `calculate:` names the stage's own output, which is not a read of the
 * elements; those entries are dropped here rather than left to resolve to
 * nothing.
 */
function readsThroughArray(
  arrayPath: string[],
  elementFields: FieldDef[],
  firstStage: PipeSegment | undefined
): RefSummary | undefined {
  if (firstStage === undefined || firstStage.type === 'raw') return undefined;
  const reads = mapFieldUsage(firstStage.refSummary, u => ({
    path: [...arrayPath, ...u.path],
    ...(u.at && {at: u.at}),
    inPlaceDepth: 1 + u.path.length,
  }));
  if (reads === undefined) return undefined;
  const isElementField = (name: string) =>
    elementFields.some(f => activeName(f) === name);
  return {
    ...reads,
    fieldUsage: reads.fieldUsage.filter(
      u =>
        u.path.length > arrayPath.length &&
        isElementField(u.path[arrayPath.length])
    ),
  };
}
