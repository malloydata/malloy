/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as Malloy from '@malloydata/malloy-interfaces';
import {
  FieldDef,
  isLeafAtomic,
  isSourceDef,
  ModelDef,
  SourceDef,
} from './model';

export function extractSourceDependenciesFromModel(
  model: ModelDef,
  sourceName: string
): Array<SQLSource> {
  const source = model.contents[sourceName];
  if (source && isSourceDef(source)) {
    return extractSourceDependenciesImpl(source).dependencies;
  }

  return [];
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
      return parseMinimalColumnSetSQLSource(source);
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

// why not just look at the table/query? bc of 'except'(s)
function parseMinimalColumnSetSQLSource(source: SourceDef): Array<Column> {
  const columns: Array<Column> = [];

  for (const field of source.fields) {
    if (!isLeafAtomic(field)) {
      // filters JoinFieldDef | TurtleDef -> TODO handle Turtle?
      continue;
    }
    if ('e' in field) {
      // component fields in expressions are surfaced on their own
      continue;
    }

    columns.push({name: field.name});
  }

  return columns;
}

function parseMinimalColumnSetQuerySource(source: SourceDef): Array<Column> {
  // first, parse as if a sql source
  // second, parse pipeline stages

  return [];
}
function parseMinimalColumnSetComposite(_source: SourceDef): Array<Column> {
  throw new Error('not implemented');
}

// fields are always handled the same way and can result in more parsing if there
// are joins
function parseJoins(fields: Array<FieldDef>): Array<SourceDef> {
  const sources: Array<SourceDef> = [];

  for (const field of fields) {
    switch (field.type) {
      case 'table':
        sources.push(field);
        break;
      case 'sql_select':
        sources.push(field);
        break;
      case 'query_source':
        sources.push(field);
        break;
      default:
        break;
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
