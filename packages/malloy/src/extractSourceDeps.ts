/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as Malloy from '@malloydata/malloy-interfaces';
import {FieldDef, isSourceDef, ModelDef, SourceDef} from './model';

export function extractSourceDependenciesFromModel(
  model: ModelDef,
  sourceName: string
): Array<SQLSource> {
  const source = model.contents[sourceName];

  if (source && isSourceDef(source))
    return extractSourceDependenciesImpl(source).dependencies;

  return [];
}

function extractSourceDependenciesImpl(source: SourceDef): ParseSourceResult {
  const rawDeps: Array<SourceDef> = [];

  const {rawSources, includeCols} = parseFields(source.fields);
  rawDeps.push(...rawSources);

  // handle special cases
  switch (source.type) {
    case 'query_source':
      {
        const stage = source.query.structRef;

        if (typeof stage !== 'string') {
          rawDeps.push(stage);
        }
      }
      break;
    default:
    // source not supported
  }

  const resolvedDeps: Array<ParseSourceResult> = [];

  for (const dep of rawDeps) {
    resolvedDeps.push(extractSourceDependenciesImpl(dep));
  }

  const childrenResult = collateChildResults(resolvedDeps);

  // TODO: this happens if:
  // - agg level changes
  // - there's a join (though might not be necessary - this might change)
  const isDerived = true;

  if (isDerived) {
    return childrenResult;
  }

  // TODO - parse filters from this stage
  const filters: Array<RowFilter> = [];

  return reconcileChildrenAndSelf(childrenResult, filters, includeCols);
}

function reconcileChildrenAndSelf(
  _children: ParseSourceResult,
  _rowFilters: Array<RowFilter>,
  _cols: Array<Column>
): ParseSourceResult {
  return {isDerivedView: true, dependencies: []};
}

function collateChildResults(_results: Array<ParseSourceResult>) {
  // combine/distill

  return {isDerivedView: true, dependencies: []};
}

// fields are always handled the same way and can result in more parsing if there
// are joins
function parseFields(_fields: Array<FieldDef>): {
  rawSources: Array<SourceDef>;
  includeCols: Array<Column>;
} {
  return {rawSources: [], includeCols: []};
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

export type SQLSource = SQLTable | SQLQuery;
export type RowFilter = {
  sql: string;
};
export type Column = {
  name: string;
};
export type SQLQuery = {
  sql: string;
  filters: Array<RowFilter>;
  columns: Array<Column>;
};
export type SQLTable = {
  name: string;
  filters: Array<RowFilter>;
  columns: Array<Column>;
};

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
