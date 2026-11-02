/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {QueryField, QueryStruct} from './query_node';
import {QueryFieldBoolean, QueryFieldStruct} from './query_node';
import {getDialectFieldList} from './utils';
import type {JoinRelationship, UniqueKeyRequirement} from './malloy_types';

import {
  fieldUsageFrom,
  hasExpression,
  isSourceDef,
  isJoined,
  isJoinedSource,
} from './malloy_types';
import type {DialectFieldList} from '../dialect';

/**
 * The name an unnest's row number is packed under when the unnest is a join
 * below a subquery.  The row number is not a field of the unnested data, and
 * each dialect names it its own way inside the subquery, so outside it the
 * row number is read from the packed struct under this one name instead.
 */
export const PACKED_ROW_ID = '__packed_row_id';

export class JoinInstance {
  uniqueKeyRequirement?: UniqueKeyRequirement;
  makeUniqueKey = false;
  leafiest = false;
  joinFilterConditions?: QueryFieldBoolean[];
  children: JoinInstance[] = [];
  constructor(
    public queryStruct: QueryStruct,
    public alias: string,
    public parent: JoinInstance | undefined
  ) {
    if (parent) {
      parent.children.push(this);
    }

    // convert the filter list into a list of boolean fields so we can
    //  generate dependancies and code for them.
    const sd = this.queryStruct.structDef;
    if (isSourceDef(sd) && sd.filterList) {
      this.joinFilterConditions = sd.filterList.map(
        filter =>
          new QueryFieldBoolean(
            {
              type: 'boolean',
              name: 'ignoreme',
              e: filter.e,
            },
            this.queryStruct
          )
      );
    }
  }

  // A join whose own joins go inside its subquery, so that the subquery has
  // to project them back out for anything outside to name them.  That is a
  // filtered join, whose filter has to apply before it is joined, and a join
  // whose on clause reaches into data nested inside it.
  isSubquery(): boolean {
    return (
      this.children.length > 0 &&
      isJoinedSource(this.queryStruct.structDef) &&
      this.queryStruct.dialect.supportsComplexFilteredSources &&
      (this.joinFilterConditions !== undefined || this.onReachesNested())
    );
  }

  private reachesNested?: boolean;

  /**
   * Whether this join's on clause names a field nested inside it, in an
   * array or repeated record the join unnests.  The unnest which names that
   * field is joined after this join's ON is written, so the ON would name an
   * alias which does not exist yet; inside a subquery the unnest has already
   * happened.  A computed field reached through the join counts for what it
   * reads.
   */
  onReachesNested(): boolean {
    if (this.reachesNested === undefined) {
      const sd = this.queryStruct.structDef;
      const parent = this.queryStruct.parent;
      const visited = new Set<QueryField>();
      const reaches = (
        from: QueryStruct,
        path: string[],
        inside: boolean
      ): boolean => {
        let struct = from;
        for (const name of path) {
          const child = struct.getChildByName(name);
          if (child === undefined) return false;
          if (child instanceof QueryFieldStruct) {
            struct = child.queryStruct;
            if (struct === this.queryStruct) {
              inside = true;
            } else if (inside && struct.structDef.type === 'array') {
              return true;
            }
            continue;
          }
          const fieldDef = child.fieldDef;
          if (inside && hasExpression(fieldDef) && !visited.has(child)) {
            visited.add(child);
            return fieldUsageFrom(fieldDef.refSummary).some(u =>
              reaches(child.parent, u.path, true)
            );
          }
          return false;
        }
        return false;
      };
      this.reachesNested =
        parent !== undefined &&
        isJoinedSource(sd) &&
        fieldUsageFrom(sd.refSummary).some(u => reaches(parent, u.path, false));
    }
    return this.reachesNested;
  }

  /**
   * Whether this join is written inside the subquery of a join above it, so
   * that outside that subquery its columns are read from a packed struct.
   */
  isPackedInSubquery(): boolean {
    for (let j = this.parent; j !== undefined; j = j.parent) {
      if (j.isSubquery()) return true;
    }
    return false;
  }

  parentRelationship(): 'root' | JoinRelationship {
    if (this.queryStruct.parent === undefined) {
      return 'root';
    }
    const thisStruct = this.queryStruct.structDef;
    if (isJoined(thisStruct)) {
      switch (thisStruct.join) {
        case 'one':
          return 'many_to_one';
        case 'cross':
          return 'many_to_many';
        case 'many':
          return 'one_to_many';
      }
    }
    throw new Error(
      `Internal error unknown relationship type to parent for ${this.queryStruct.structDef.name}`
    );
  }

  // For now, we force all symmetric calculations for full and right joins
  //  because we need distinct keys for COUNT(xx) operations.  Don't really need
  //  this for sums.  This will produce correct results and we can optimize this
  //  at some point..
  forceAllSymmetricCalculations(): boolean {
    if (this.queryStruct.parent === undefined) {
      return false;
    }
    const thisStruct = this.queryStruct.structDef;
    if (isJoined(thisStruct)) {
      return (
        thisStruct.matrixOperation === 'right' ||
        thisStruct.matrixOperation === 'full'
      );
    }
    return false;
  }

  // postgres unnest needs to know the names of the physical fields.
  getDialectFieldList(): DialectFieldList {
    return getDialectFieldList(
      this.queryStruct.structDef,
      this.queryStruct.dialect
    );
  }
}

/**
 * SQL for the row number of the unnest `struct`, which its distinct key is
 * made of.  A distinct key is written outside any subquery the unnest is in,
 * where the row number is read from the struct the unnest was packed into.
 */
export function unnestRowIdSQL(
  struct: QueryStruct,
  join: JoinInstance | undefined
): string {
  const dialect = struct.dialect;
  if (join?.isPackedInSubquery()) {
    return `${join.alias}.${dialect.sqlQuoteIdentifier(PACKED_ROW_ID)}`;
  }
  return dialect.sqlFieldReference(
    struct.getIdentifier(),
    'table',
    '__row_id',
    'string'
  );
}
