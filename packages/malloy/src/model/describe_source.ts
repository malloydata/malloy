/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type * as Malloy from '@malloydata/malloy-interfaces';
import {getDialect, type Dialect} from '../dialect';
import type {
  Expr,
  FilterCondition,
  QuerySourceDef,
  SQLSourceDef,
  TableSourceDef,
} from './malloy_types';
import {
  exprHasE,
  exprHasKids,
  hasExpression,
  isAtomic,
  isSourceDef,
  type FieldDef,
  type SourceDef,
} from './malloy_types';

export default class SourceDescriber {
  dialect: Dialect;

  constructor(private source: SourceDef) {
    this.source = source;
    this.dialect = getDialect(source.dialect);
  }

  describe(): SQLArtifact[] {
    return this.describeImpl(this.source);
  }

  private describeImpl(s: SourceDef): SQLArtifact[] {
    const sourceSQLArtifact = this.getCurrentSQLArtifact(s);
    sourceSQLArtifact.filters = this.getFilterSet(s);
    sourceSQLArtifact.columns = this.getColumnSet(s);

    const artifactsAcc: SQLArtifact[] = [sourceSQLArtifact as SQLArtifact];

    const joined = this.getJoins(s.fields);
    for (const j of joined) {
      artifactsAcc.push(...this.describeImpl(j));
    }

    return artifactsAcc;
  }

  private getJoins(fields: FieldDef[]): SourceDef[] {
    const sources: SourceDef[] = [];

    for (const field of fields) {
      if (isSourceDef(field)) {
        sources.push(field);
      }
    }

    return sources;
  }

  private getColumnSet(s: SourceDef): Column[] {
    switch (s.type) {
      case 'table':
      case 'sql_select':
        return this.getColumnSetSQLSource(s);
      case 'query_source':
        return this.getColumnSetQuerySource(s);
      case 'composite':
      default:
        return [];
    }
  }

  getColumnSetSQLSource(s: SourceDef): Column[] {
    const cols: Column[] = [];
    // 'except'ed fields won't appear in this list
    for (const field of s.fields) {
      if (!isAtomic(field) || 'e' in field) {
        // expressions ref other fields which will be independently collected
        continue;
      }
      cols.push({name: field.code ?? field.name});
    }
    return cols;
  }

  /**
   * Only check the first segment of the first pipeline; this will be
   * included in the generated SQL as a CTE, so all cols must be included
   * even if unreachable in a descendant source
   */
  getColumnSetQuerySource(s: QuerySourceDef): Column[] {
    // 1. get the first query source after the root source
    if (
      typeof s.query.structRef !== 'string' &&
      s.query.structRef.type === 'query_source'
    ) {
      return this.getColumnSetQuerySource(s.query.structRef);
    }

    const firstSeg = s.query.pipeline[0];
    if (firstSeg.type !== 'project' && firstSeg.type !== 'reduce') {
      throw new Error(`Pipeline stage type ${firstSeg.type} not supported`);
    }

    // 2. pull fields from first segment of query
    const segmentFieldNameAcc: string[] = [];
    for (const f of firstSeg.fieldUsage ?? []) {
      segmentFieldNameAcc.push(f.path[0]);
    }

    // 3. map fields from query to column names using the root source
    const parent = s.query.structRef;
    if (typeof parent === 'string') {
      throw new Error('Could not parse columns.');
    }

    const colAcc: Column[] = [];
    for (const sf of segmentFieldNameAcc) {
      colAcc.push({name: this.getColumnNameFromNamedField(sf, parent)});
    }

    // 4. include root filter columns in column list (all other columns are)
    // in the query segment or unreachable)
    for (const f of parent.filterList ?? []) {
      colAcc.push(
        ...this.parseFieldNamesFromExpr(f.e).map(n => ({
          name: n,
        }))
      );
    }

    return [...new Map(colAcc.map(f => [f.name, f])).values()];
  }

  parseFieldNamesFromExpr(e: Expr): string[] {
    const acc: string[] = [];
    if (e.node === 'field') {
      // what is 'path'?
      e.path[0] && acc.push(e.path[0]);
      return acc;
    }

    if (exprHasE(e)) {
      acc.push(...this.parseFieldNamesFromExpr(e.e));
    }

    if (exprHasKids(e)) {
      for (const kid of Object.values(e.kids)) {
        if (kid instanceof Array) {
          for (const kidE of kid) {
            acc.push(...this.parseFieldNamesFromExpr(kidE));
          }
        } else {
          acc.push(...this.parseFieldNamesFromExpr(kid));
        }
      }
    }

    return acc;
  }

  private getCurrentSQLArtifact(s: SourceDef): Partial<SQLArtifact> {
    switch (s.type) {
      case 'table':
        return {name: s.tablePath};
      case 'sql_select':
        return {sql: s.selectStr};
      case 'query_source': {
        const sqlSource = s.query.structRef;

        if (typeof sqlSource === 'string') {
          throw new Error('Unsupported source type');
        }

        return this.getCurrentSQLArtifact(sqlSource);
      }
      case 'composite':
      default:
        throw new Error();
    }
  }

  private getFilterSet(s: SourceDef): Filter[] {
    switch (s.type) {
      case 'table':
      case 'sql_select':
        return this.getFilterSetSQLSource(s);
      case 'query_source':
        return this.getFilterSetQuerySource(s);
      default:
        return [];
    }
  }

  private getFilterSetSQLSource(s: TableSourceDef | SQLSourceDef): Filter[] {
    return this.getFilterListFilterSet(s.filterList ?? [], s);
  }

  /**
   * Reasoning: both a projection & reduction can change the shape of
   * data (projection via window function, for example), so filters
   * on post-query data are not commutative & cannot be applied
   */
  getFilterSetQuerySource(s: QuerySourceDef): Filter[] {
    if (
      typeof s.query.structRef !== 'string' &&
      s.query.structRef.type === 'query_source'
    ) {
      return this.getFilterSetQuerySource(s.query.structRef);
    }

    // first stage in the pipeline
    const firstSeg = s.query.pipeline[0];
    if (firstSeg.type !== 'project' && firstSeg.type !== 'reduce') {
      throw new Error(`Pipeline stage type ${firstSeg.type} not supported`);
    }

    const parent = s.query.structRef;
    if (typeof parent === 'string') {
      throw new Error('Could not parse fields.');
    }
    const acc: Filter[] = [];
    // safe to use the root source for pulling column names from fields
    // in the pipeline query?
    acc.push(...this.getFilterListFilterSet(firstSeg.filterList ?? [], parent));

    // get filters on parent
    acc.push(...this.getFilterListFilterSet(parent.filterList ?? [], parent));

    return acc;
  }

  private getFilterListFilterSet(
    filterList: FilterCondition[],
    s: SourceDef
  ): Filter[] {
    const acc: Filter[] = [];
    for (const fc of filterList ?? []) {
      try {
        const sql = this.exprToSQL(fc, s);
        acc.push({sql});
      } catch (_e: unknown) {
        continue;
      }
    }
    return acc;
  }

  // largely copied (filters only) from malloy_query.ts -> QueryField.exprToSQL
  private exprToSQL(exprToTranslate: Expr, s: SourceDef): string {
    const subExpr = function (sd: SourceDescriber, e: Expr) {
      const sql = sd.exprToSQL(e, s);
      if (exprHasKids(e)) {
        return `(${sql})`;
      }
      return sql;
    };

    let expr = exprToTranslate;
    if (exprHasE(exprToTranslate)) {
      expr = {...exprToTranslate};
      const eSql = subExpr(this, expr.e);
      expr.e = {...expr.e, sql: eSql};
    } else if (exprHasKids(exprToTranslate)) {
      expr = {...exprToTranslate};
      const oldKids = exprToTranslate.kids;
      for (const [name, kidExpr] of Object.entries(oldKids)) {
        if (kidExpr === null) continue;
        if (Array.isArray(kidExpr)) {
          expr.kids[name] = kidExpr.map(e => {
            return {...e, sql: subExpr(this, e)};
          });
        } else {
          expr.kids[name] = {...oldKids[name], sql: subExpr(this, kidExpr)};
        }
      }
    }

    const dialectSQL = this.dialect.exprToSQL({}, expr);
    if (dialectSQL) {
      return dialectSQL;
    }

    switch (expr.node) {
      case 'field':
        // ignoring path (oops?)
        // need to go through 'fieldUsage'?
        return this.getColumnNameFromNamedField(expr.path[0], s);
      case 'parameter':
        return '1=1'; // parameters not supported - use ineffectual clause
      case '>':
      case '<':
      case '>=':
      case '<=':
      case '=':
        return `${expr.kids.left.sql}${expr.node}${expr.kids.right.sql}`;
      case '!=': {
        const notEqual = `${expr.kids.left.sql}!=${expr.kids.right.sql}`;
        return `COALESCE(${notEqual},true)`;
      }
      case 'and':
      case 'or':
        return `${expr.kids.left.sql} ${expr.node} ${expr.kids.right.sql}`;
      case 'coalesce':
        return `COALESCE(${expr.kids.left.sql},${expr.kids.right.sql})`;
      case 'in': {
        const oneOf = expr.kids.oneOf.map(o => o.sql).join(',');
        return `${expr.kids.e.sql} ${expr.not ? 'NOT IN' : 'IN'} (${oneOf})`;
      }
      case 'like':
      case '!like': {
        const likeIt = expr.node === 'like' ? 'LIKE' : 'NOT LIKE';
        const compare =
          expr.kids.right.node === 'stringLiteral'
            ? this.dialect.sqlLike(
                likeIt,
                expr.kids.left.sql ?? '',
                expr.kids.right.literal
              )
            : `${expr.kids.left.sql} ${likeIt} ${expr.kids.right.sql}`;
        return expr.node === 'like' ? compare : `COALESCE(${compare},true)`;
      }
      case '()':
        return `(${expr.e.sql})`;
      case 'not':
        return `COALESCE(NOT ${expr.e.sql},TRUE)`;
      case 'unary-':
        return `-${expr.e.sql}`;
      case 'is-null':
        return `${expr.e.sql} IS NULL`;
      case 'is-not-null':
        return `${expr.e.sql} IS NOT NULL`;
      case 'true':
      case 'false':
        return expr.node;
      case 'null':
        return 'NULL';
      case '':
        return '';
      case 'filterCondition':
        if (expr.e.sql) {
          expr.sql = expr.e.sql;
          return expr.sql;
        }
        return '';
      case 'filterMatch':
      default:
        throw new Error('Could not parse filters from source');
    }
  }

  private getColumnNameFromNamedField(fName: string, s: SourceDef) {
    const fDef: FieldDef | undefined = s.fields.find(f => f.name === fName);

    if (!fDef) {
      const fAlias: FieldDef | undefined = s.fields.find(f => f.as === fName);
      if (fAlias) {
        return fAlias.name;
      }
      throw new Error('Could not find field definition');
    }

    if (hasExpression(fDef)) {
      return this.exprToSQL(fDef.e, s);
    } else {
      return fDef.name;
    }
  }
}

// for API:
export type DescribeSourceRequest = {
  model_url: string;
  source_name: string;
  extend_model_url?: string;
  compiler_needs?: Malloy.CompilerNeeds;
};
export type DescribeSourceResponse = {
  sql_artifacts?: Array<SQLArtifact>;
  logs?: Array<Malloy.LogMessage>;
  compiler_needs?: Malloy.CompilerNeeds;
};

export type SQLArtifact = SQLTable | SQLQuery;
export type Filter = {
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
  filters: Filter[];
  columns: Column[];
}
