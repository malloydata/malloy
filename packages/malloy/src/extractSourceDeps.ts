/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as Malloy from '@malloydata/malloy-interfaces';
import {
  FieldDef,
  FilterCondition,
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
  const {sources: deps, columns} = parseFields(source.fields);
  const filters = parseFilters(source.filterList ?? []);

  const partial: ConstrainedSQLArtifact = {filters, columns};
  let currSQLSource: SQLSource | null = null;

  switch (source.type) {
    case 'table':
      {
        if ('tablePath' in source) {
          currSQLSource = {name: source.tablePath, ...partial};
        }
      }
      break;
    case 'sql_select':
      {
        if ('selectStr' in source) {
          currSQLSource = {sql: source.selectStr, ...partial};
        }
      }
      break;
    case 'query_source':
      {
        const stage = source.query.structRef;

        if (typeof stage !== 'string') {
          deps.push(stage);
        }
      }
      break;
    default:
      break;
  }

  const resolvedDeps: Array<ParseSourceResult> = [];
  for (const dep of deps) {
    resolvedDeps.push(extractSourceDependenciesImpl(dep));
  }

  const childrenResult = collateChildResults(resolvedDeps);

  return reconcileChildrenAndSelf(childrenResult, {
    isDerivedView: false,
    dependencies: currSQLSource ? [currSQLSource] : [],
  });
}

// fields are always handled the same way and can result in more parsing if there
// are joins
function parseFields(fields: Array<FieldDef>): {
  sources: Array<SourceDef>;
  columns: Array<Column>;
} {
  const sources: Array<SourceDef> = [];
  const columns: Array<Column> = [];

  for (const field of fields) {
    switch (field.type) {
      case 'table':
        sources.push(field);
        break;
      case 'sql_select':
        sources.push(field);
        break;
      case 'string':
        {
          if ('expressionType' in field) {
            break;
          }
          columns.push({name: field.name});
        }
        break;
      default:
        break;
    }
  }

  return {sources, columns};
}

function parseFilters(_filters: Array<FilterCondition>): Array<RowFilter> {
  return [];
}

// TODO: derived view happens if:
// - agg level changes
// - there's a join (though might not be necessary - this might change)

// also, need to handle special case where there's a table at this level and a join with
// a source with that table
// can't union filters in that case
function reconcileChildrenAndSelf(
  children: ParseSourceResult,
  self: ParseSourceResult | null
): ParseSourceResult {
  if (children.dependencies.length === 0) {
    return self ?? {isDerivedView: false, dependencies: []};
  }

  return {isDerivedView: true, dependencies: []};
}

// these are siblings; take intersection
// TODO: at some point, maybe keep discarded stuff for hints
function collateChildResults(results: Array<ParseSourceResult>) {
  if (results.length === 0) {
    return {isDerivedView: false, dependencies: []};
  }

  return {isDerivedView: true, dependencies: []};
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
  isDerivedView: boolean;
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

// thinking:

// on merging child branches while walking the tree:

// need to walk a model dfs. this will surface deps & can use these to combine filters
// at any point, the same table/query could have been referenced in separate branches
// need to reconcile (take union of) filters returned at each step
// should never get to a point where a column is referenced but already filtered

// on filters:

// row filters

// how to combine row-level filters when the same sql source is in two different sub-trees?
// need the _least_ restrictive set between group 1 and group 2 <- this is the intersection
// for child -> parent, need the _most_ restrictive set <- this is the union

// want to surface filters to model authors to
// prevent a scenario where a difference in filtering -> no filtering

// this would be the case when:
// --> source a:
// ------> based on 'table_one'
// ------> filters on ds > '<DATEID-1>'
// --> source b:
// ------> based on 'table_one'
// ------> filters on ds > '<DATEID-2>'

// we're not smart enough to know we could just apply the ds > '<DATEID-2>' filter
// {'<DATEID-1>'} ∩ {'<DATEID-2>'} = {}
// so no filter applied

// column filters

// same logic as row filters
// might be easier to do 'columns included' over 'excluded'
// --> this is also what Onyx expects

// I think I want to add 'derived' to SQL artifact, not source result
// after taking the intersection, maybe quit? or can I go back to taking union?

// some other thoughts ->
// when do columns get filtered?
// --> when the source is based on a query
// --> when there's an include/exclude clause

// based on this, if a node knows what its parent needs, it can know that it only needs
// what is necessary to create the parent
// how does it create the parent?
// --> measures + dimensions + filters
