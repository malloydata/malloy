/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {QueryField, QueryStruct} from './query_node';
import {QueryFieldBoolean, QueryFieldStruct} from './query_node';
import {exprWalk, getDialectFieldList} from './utils';
import type {
  Expr,
  JoinRelationship,
  UniqueKeyRequirement,
} from './malloy_types';

import {
  hasExpression,
  isBasicArray,
  isSourceDef,
  isJoined,
  isJoinedSource,
} from './malloy_types';
import type {DialectFieldList} from '../dialect';

/**
 * The name an unnest's row number is carried out of a subquery under, when
 * the unnest is a join below one.  The row number is not a field of the
 * unnested data, and each dialect names it its own way inside the subquery,
 * so outside it the row number is read under this one name instead: as a
 * field of the packed struct, or as a column of its own beside a bare value
 * (see `JoinInstance.packsAsValue`).
 */
export const PACKED_ROW_ID = '__packed_row_id';

export class JoinInstance {
  uniqueKeyRequirement?: UniqueKeyRequirement;
  makeUniqueKey = false;
  leafiest = false;
  joinFilterConditions?: QueryFieldBoolean[];
  children: JoinInstance[] = [];
  private reachesNested?: boolean;
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
    if (isSourceDef(sd) && sd.filterList && sd.filterList.length > 0) {
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

  /**
   * Whether this join's on clause names something inside an array or
   * repeated record of the joined source, which the join's unnest of it
   * defines.  That unnest is joined after this join's ON is written, so the
   * ON would name an alias which does not exist yet; inside a subquery the
   * unnest has already happened.  A computed field reached through the join
   * counts for what its expression reads.  A path which ends at the array
   * itself names the whole array, a column of the join, and needs no unnest.
   */
  private onReachesNested(): boolean {
    if (this.reachesNested === undefined) {
      const sd = this.queryStruct.structDef;
      const parent = this.queryStruct.parent;
      const visited = new Set<QueryField>();
      const reads = (e: Expr, from: QueryStruct, inside: boolean): boolean => {
        for (const node of exprWalk(e)) {
          if (node.node === 'field' && reaches(from, node.path, inside)) {
            return true;
          }
        }
        return false;
      };
      const reaches = (
        from: QueryStruct,
        path: string[],
        inside: boolean
      ): boolean => {
        const fields = from.getFieldsAlongPath(path) ?? [];
        for (const [i, field] of fields.entries()) {
          if (field instanceof QueryFieldStruct) {
            const struct = field.queryStruct;
            if (struct === this.queryStruct) {
              inside = true;
            } else if (
              inside &&
              struct.structDef.type === 'array' &&
              i < fields.length - 1
            ) {
              return true;
            }
          } else if (
            inside &&
            hasExpression(field.fieldDef) &&
            !visited.has(field)
          ) {
            visited.add(field);
            return reads(field.fieldDef.e, field.parent, true);
          }
        }
        return false;
      };
      this.reachesNested =
        parent !== undefined &&
        isJoinedSource(sd) &&
        sd.onExpression !== undefined &&
        reads(sd.onExpression, parent, false);
    }
    return this.reachesNested;
  }

  /**
   * Whether this join is written inside the subquery of a join above it, so
   * that outside that subquery its columns are read from what the subquery
   * projected for it.
   */
  isPackedInSubquery(): boolean {
    for (let j = this.parent; j !== undefined; j = j.parent) {
      if (j.isSubquery()) return true;
    }
    return false;
  }

  /**
   * Whether this unnest, below a subquery, is carried out of it as its bare
   * element value rather than as a struct of its fields.  A dialect which
   * names an unnested scalar by the unnest's alias alone has to be handed the
   * value under that alias, or the same reference outside the subquery would
   * read a struct.  The answer is read from the dialect's own reference, so
   * it cannot drift from it.
   */
  packsAsValue(): boolean {
    return (
      isBasicArray(this.queryStruct.structDef) &&
      this.queryStruct.dialect.sqlFieldReference(
        this.alias,
        'array[scalar]',
        'value',
        this.queryStruct.structDef.elementTypeDef.type
      ) === this.alias
    );
  }

  /** The column a bare value's row number is carried out of a subquery in. */
  packedRowIdColumn(): string {
    return `${this.alias}${PACKED_ROW_ID}`;
  }

  /** SQL for this unnest's row number where the unnest itself is in scope. */
  innerRowIdSQL(): string {
    return this.queryStruct.dialect.sqlFieldReference(
      this.alias,
      'table',
      '__row_id',
      'number'
    );
  }

  /**
   * SQL for this unnest's row number, which its distinct key and a dialect's
   * row ordering are made of, written outside any subquery the unnest is in.
   * There it is read from what the subquery carried out for the unnest.
   */
  rowIdSQL(): string {
    if (!this.isPackedInSubquery()) {
      return this.innerRowIdSQL();
    }
    const dialect = this.queryStruct.dialect;
    if (this.packsAsValue()) {
      return dialect.sqlQuoteIdentifier(this.packedRowIdColumn());
    }
    return dialect.sqlFieldReference(
      this.alias,
      'record',
      PACKED_ROW_ID,
      'number'
    );
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
