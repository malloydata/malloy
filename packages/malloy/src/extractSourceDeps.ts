/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as Malloy from '@malloydata/malloy-interfaces';
import {
  Expr,
  exprHasE,
  exprHasKids,
  FieldDef,
  isLeafAtomic,
  isQuerySegment,
  isSourceDef,
  ModelDef,
  PipeSegment,
  QueryFieldDef,
  QuerySourceDef,
  SourceDef,
} from './model';

export function extractSourceDependenciesFromModel(
  model: ModelDef,
  sourceName: string
): Array<SQLSource> {
  const source = model.contents[sourceName];
  if (!source || !isSourceDef(source)) {
    throw new Error('Cannot extract source dependencies without a source');
  }

  return extractSourceDependenciesImpl(source).dependencies;
}

function extractSourceDependenciesImpl(source: SourceDef): ParseSourceResult {
  // the following could probably be unified
  const sourceSQLArtifact = parseSourceSQLArtifact(source);
  sourceSQLArtifact.columns = parseMinimalColumnSet(source);
  sourceSQLArtifact.filters = parseMinimalFilterSet(source);

  const resolvedDeps: Array<ParseSourceResult> = [
    {dependencies: [sourceSQLArtifact as SQLSource]},
  ];

  // need to push down filters in this source
  const joinedSources = parseJoins(source.fields);

  for (const join of joinedSources) {
    resolvedDeps.push(extractSourceDependenciesImpl(join));
  }

  return collateJoinResults(resolvedDeps);
}

function parseSourceSQLArtifact(source: SourceDef): Partial<SQLSource> {
  switch (source.type) {
    case 'table':
      return {name: source.tablePath};
    case 'sql_select':
      return {sql: source.selectStr};
    case 'query_source': {
      const sqlSource = source.query.structRef;

      if (typeof sqlSource === 'string') {
        throw new Error('Unsupported source type');
      }

      return parseSourceSQLArtifact(sqlSource);
    }
    case 'composite':
    default:
      throw new Error();
  }
}

function parseMinimalColumnSet(source: SourceDef): Array<Column> {
  switch (source.type) {
    case 'table':
    case 'sql_select':
      return parseMinimalColumnSetSQLSource(source);
    case 'query_source':
      return parseMinimalColumnSetQuerySource(source);
    case 'composite':
      return parseMinimalColumnSetComposite(source);
    default:
      return [];
  }
}

type IntermediateQueryField = {
  name: string;
  mappedFrom?: string;
};

// why not just look at the table/query? bc of 'except'(s)
function parseMinimalColumnSetSQLSource(
  source: SourceDef
  // upstream?: Array<IntermediateQueryField>
): Array<Column> {
  const columns: Array<Column> = [];
  // const filters: Array<IntermediateQueryField> = [];

  for (const field of source.fields) {
    if (!isLeafAtomic(field)) {
      // filters JoinFieldDef | TurtleDef -> TODO handle Turtle?
      continue;
    }
    if ('e' in field) {
      continue;
    }

    columns.push({name: field.code ?? field.name});
  }

  return columns;
}

function parseMinimalColumnSetQuerySource(
  source: QuerySourceDef
): Array<Column> {
  // first, parse as if a sql source
  const topLevelColumns = parseMinimalColumnSetSQLSource(source);
  let downstreamReqFields: Array<IntermediateQueryField> = topLevelColumns.map(
    c => ({
      name: c.name,
    })
  );
  const pipeline = source.query.pipeline;

  for (const stage of pipeline.reverse()) {
    switch (stage.type) {
      case 'project':
        downstreamReqFields = parseMinimalColumnSetQueryProjectStage(
          stage,
          downstreamReqFields
        );
        break;
      case 'reduce':
        downstreamReqFields = parseMinimalColumnSetQueryReduceStage(stage);
        break;
      default:
        throw new Error(`Pipeline stage type ${stage.type} not supported`);
    }
  }

  // todo: need to extract any filters out of the upstream source (outside of the pipeline, too)

  return downstreamReqFields.map(f => ({name: f.name}));
}

function parseMinimalColumnSetQueryReduceStage(
  pipeSegment: PipeSegment
): Array<IntermediateQueryField> {
  //  these are easy: just discard everything not in a
  //  group_by or filter (incl fields from parent), continue
  throw new Error('not implemented');
}

/**
 * Only fields that appear in the parent or are
 * used for filtering are relevant to the final stage
 */
function parseMinimalColumnSetQueryProjectStage(
  pipeSegment: PipeSegment,
  parentDeps: Array<IntermediateQueryField>
): Array<IntermediateQueryField> {
  if (!isQuerySegment(pipeSegment)) {
    throw new Error(`PipeSegment type '${pipeSegment.type}' not supported.`);
  }

  const fieldAcc: Array<IntermediateQueryField> = [];
  for (const f of pipeSegment.queryFields ?? []) {
    if (isLeafAtomic(f)) {
      // using 'code' for name if mapped - is this valid?
      if (f.code) {
        fieldAcc.push({name: f.code, mappedFrom: f.name});
      } else {
        fieldAcc.push({name: f.name});
      }
    } else if (f.type === 'fieldref') {
      // what is 'path'?
      f.path[0] && fieldAcc.push({name: f.path[0]});
    } else {
      throw new Error(`QueryFieldDef type '${f.type}' not supported.`);
    }
  }

  const reqFields = fieldAcc.filter(childF =>
    parentDeps.some(
      parentF =>
        childF.name === parentF.name || childF.mappedFrom === parentF.name
    )
  );

  for (const f of pipeSegment.filterList ?? []) {
    reqFields.push(...parseFieldsFromExpr(f.e));
  }

  // filter fields that appear as fields and filters
  const uniqueReqFields = [
    ...new Map(reqFields.map(f => [f.name, f])).values(),
  ];

  return uniqueReqFields;
}

function parseMinimalColumnSetQueryReduceStage(
  parentDeps: Array<QueryFieldDef>
): Array<Column> {
  return [];
}

function parseMinimalColumnSetComposite(_source: SourceDef): Array<Column> {
  throw new Error('not implemented');
}

// TODO: test
function parseFieldsFromExpr(e: Expr): Array<IntermediateQueryField> {
  const acc: Array<IntermediateQueryField> = [];
  if (e.node === 'field') {
    // what is 'path'?
    e.path[0] && acc.push({name: e.path[0]});
    return acc;
  }

  if (exprHasE(e)) {
    acc.push(...parseFieldsFromExpr(e.e));
  }

  if (exprHasKids(e)) {
    for (const kid of Object.values(e.kids)) {
      if (kid instanceof Array) {
        for (const kidE of kid) {
          acc.push(...parseFieldsFromExpr(kidE));
        }
      } else {
        acc.push(...parseFieldsFromExpr(kid));
      }
    }
  }

  return acc;
}

// fields are always handled the same way and can result in more parsing if there
// are joins
function parseJoins(fields: Array<FieldDef>): Array<SourceDef> {
  const sources: Array<SourceDef> = [];

  for (const field of fields) {
    if (isSourceDef(field)) {
      sources.push(field);
    }
  }

  return sources;
}

function parseMinimalFilterSet(_source: SourceDef): Array<RowFilter> {
  return [];
}

function collateJoinResults(
  joinResults: Array<ParseSourceResult>
): ParseSourceResult {
  if (joinResults.length === 0) {
    return {dependencies: []};
  }

  // TODO: need more than just a combining function
  // we should be deduping & taking filter intersection

  return joinResults.reduce(
    (acc, curr) => {
      acc.dependencies.push(...curr.dependencies);
      return acc;
    },
    {dependencies: []}
  );
}

function unionRowFilters(_filters: Array<RowFilter>): Array<RowFilter> {
  return [];
}

function unionColumns(_columns: Array<Column>): Array<Column> {
  return [];
}

// TODO also return union? for later surfacing?
function intersectionRowFilters(_filters: Array<RowFilter>): Array<RowFilter> {
  return [];
}

function intersectionColumns(_columns: Array<Column>): Array<Column> {
  return [];
}

// this might also require some mapping of column names to the original table/query
type ParseSourceResult = {
  dependencies: Array<SQLSource>;
};

// AR: need to put types in the right spot
export type ExtractSourceDependenciesRequest = {
  model_url: string;
  source_name: string;
  extend_model_url?: string;
  compiler_needs?: Malloy.CompilerNeeds;
};
export type ExtractSourceDependenciesResponse = {
  sql_sources?: Array<SQLSource>;
  logs?: Array<Malloy.LogMessage>;
  compiler_needs?: Malloy.CompilerNeeds;
};

// add connection? for ns
export type SQLSource = SQLTable | SQLQuery;
export type RowFilter = {
  sql: string;
};
export type Column = {
  name: string;
};
export interface SQLQuery extends ConstrainedSQLArtifact {
  sql: string;
}
export interface SQLTable extends ConstrainedSQLArtifact {
  name: string;
}

export interface ConstrainedSQLArtifact {
  filters: Array<RowFilter>;
  columns: Array<Column>;
}
