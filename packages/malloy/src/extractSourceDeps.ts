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
  isSourceDef,
  ModelDef,
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

/** artifact parsing */

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

function parseJoins(fields: Array<FieldDef>): Array<SourceDef> {
  const sources: Array<SourceDef> = [];

  for (const field of fields) {
    if (isSourceDef(field)) {
      sources.push(field);
    }
  }

  return sources;
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

/** column parsing */

function parseMinimalColumnSet(source: SourceDef): Array<Column> {
  switch (source.type) {
    case 'table':
    case 'sql_select':
      return parseMinimalFieldSetSQLSource(source);
    case 'query_source':
      return parseMinimalFieldSetQuerySource(source);
    case 'composite':
      return parseMinimalFieldSetComposite(source);
    default:
      return [];
  }
}

// why not just look at the table/query? bc of 'except'(s)
function parseMinimalFieldSetSQLSource(source: SourceDef): Array<Field> {
  const fields: Array<Field> = [];

  for (const field of source.fields) {
    if (!isLeafAtomic(field) || 'e' in field) {
      // filters JoinFieldDef | TurtleDef -> TODO handle Turtle?
      // filters expressions (fields ref'd are in fields)
      continue;
    }

    fields.push({name: field.code ?? field.name});
  }

  return fields;
}

/**
 * We only check the first segment of the pipeline because
 * SQL generated includes every field in the CTE even if
 * not used elsewhere. Sadly, this leads to required inclusion
 * of columns that are unreachable in the final source.
 */
function parseMinimalFieldSetQuerySource(source: QuerySourceDef): Array<Field> {
  const firstSeg = source.query.pipeline[0];
  if (firstSeg.type !== 'project' && firstSeg.type !== 'reduce') {
    throw new Error(`Pipeline stage type ${firstSeg.type} not supported`);
  }

  const fieldAcc: Array<Field> = [];
  for (const f of firstSeg.queryFields ?? []) {
    if (isLeafAtomic(f)) {
      // using 'code' for name if mapped - is this valid?
      if (f.code) {
        fieldAcc.push({name: f.code});
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

  for (const f of firstSeg.filterList ?? []) {
    fieldAcc.push(...parseFieldsFromExpr(f.e));
  }

  // filter fields that appear as fields and filters
  const uniqueReqFields = [...new Map(fieldAcc.map(f => [f.name, f])).values()];

  const upstream = source.query.structRef;
  if (typeof upstream !== 'string' && upstream.filterList) {
    for (const f of upstream.filterList) {
      uniqueReqFields.push(...parseFieldsFromExpr(f.e));
    }

    return [...new Map(uniqueReqFields.map(f => [f.name, f])).values()];
  }

  return uniqueReqFields;
}

function parseMinimalFieldSetComposite(_source: SourceDef): Array<Field> {
  throw new Error('not implemented');
}

/** filter parsing */

function parseMinimalFilterSet(_source: SourceDef): Array<RowFilter> {
  return [];
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

/** expression parsing */

// TODO: test
function parseFieldsFromExpr(e: Expr): Array<Field> {
  const acc: Array<Field> = [];
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

/** types */

// this might also require some mapping of column names to the original table/query
type ParseSourceResult = {
  dependencies: Array<SQLSource>;
};

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

// add connection? for ns?
export type SQLSource = SQLTable | SQLQuery;
export type RowFilter = {
  sql: string;
};
export type Column = {
  name: string;
};
type Field = {
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

// notes:

// - Tests need to be moved (imo) - they're logically related to source parsing,
//   -> not the stateless api
// - Quite possibly a better place for types, too.
// - Pipelines/CTEs surface columns that might not be query-able from a source:
//   -> does this happen anywhere else?
// - I need to make a decision about when I convert rep (even though currently identical)
//   -> from a malloy 'field' to a sql 'column'
