/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {QueryStruct} from './query_node';
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
 * the unnest is placed inside one (`JoinInstance.placedInSubquery`). Each
 * dialect names the row number its own way where the unnest is written, so
 * outside the subquery it is read under this one name instead: as a field of
 * the struct the subquery packs for the unnest, or as a column of its own
 * beside a bare value (`JoinInstance.packsAsValue`).
 */
export const PACKED_ROW_ID = '__packed_row_id';

/** An array an expression reads, and whether it reads through it. */
export interface ArrayRead {
  array: QueryStruct;
  /**
   * The path goes on past the array, to its elements, so the read needs the
   * array unnested. A path which ends at the array names the whole array, a
   * column of the struct holding it, as an array query (`items -> {...}`)
   * does.
   */
  through: boolean;
}

/**
 * Every array the expression `e`, written in `from`, reads, directly or
 * through a computed field.
 */
export function arraysReadBy(e: Expr, from: QueryStruct): ArrayRead[] {
  const found: ArrayRead[] = [];
  for (const node of exprWalk(e)) {
    if (node.node !== 'field') continue;
    let struct = from;
    for (const [i, name] of node.path.entries()) {
      const child = struct.getChildByName(name);
      if (child instanceof QueryFieldStruct) {
        struct = child.queryStruct;
        if (struct.structDef.type === 'array') {
          found.push({array: struct, through: i < node.path.length - 1});
        }
      } else {
        if (child !== undefined && hasExpression(child.fieldDef)) {
          found.push(...arraysReadBy(child.fieldDef.e, child.parent));
        }
        break;
      }
    }
  }
  return found;
}

export class JoinInstance {
  uniqueKeyRequirement?: UniqueKeyRequirement;
  makeUniqueKey = false;
  leafiest = false;
  // The joined result can have rows with no row from this source, as an
  // outer join writes where nothing matched. An inner join is not told
  // apart, which costs it a key test that is always true.
  canBeUnmatched = false;
  joinFilterConditions?: QueryFieldBoolean[];
  children: JoinInstance[] = [];
  /**
   * An array unnested inside the subquery of a join above it, because that
   * subquery reads it (`placeArraysBeneathSubqueries`). Outside the
   * subquery, its element and row number are read from what the subquery
   * carried out for it. Set once the query's join tree is complete.
   */
  placedInSubquery = false;
  private onReadsNestedCache?: boolean;
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

  /**
   * A join whose own joins go inside its subquery, so that the subquery has
   * to project them back out for anything outside to name them. That is a
   * filtered join, whose filter applies before it is joined, and a join
   * whose on clause reads into an array inside it (`onReadsNested`).
   */
  isSubquery(): boolean {
    return (
      this.children.length > 0 &&
      isJoinedSource(this.queryStruct.structDef) &&
      this.queryStruct.dialect.supportsComplexFilteredSources &&
      (this.joinFilterConditions !== undefined || this.onReadsNested())
    );
  }

  /**
   * Whether this join's on clause reads through an array inside the joined
   * source, as `join_many: orders on product_id = orders.items.product_id`
   * does. The unnest of that array is written after this join's ON, so
   * outside a subquery the ON would name an alias which does not exist yet.
   * Reading the whole array, as an array query does, needs no unnest.
   */
  onReadsNested(): boolean {
    if (this.onReadsNestedCache === undefined) {
      const sd = this.queryStruct.structDef;
      const parent = this.queryStruct.parent;
      this.onReadsNestedCache =
        parent !== undefined &&
        isJoinedSource(sd) &&
        sd.onExpression !== undefined &&
        arraysReadBy(sd.onExpression, parent).some(
          r => r.through && this.contains(r.array)
        );
    }
    return this.onReadsNestedCache;
  }

  /** Whether `struct` is inside the source this join joins. */
  private contains(struct: QueryStruct): boolean {
    for (let s = struct.parent; s !== undefined; s = s.parent) {
      if (s === this.queryStruct) return true;
    }
    return false;
  }

  /**
   * Whether this unnest, placed in a subquery, is carried out of it as its
   * bare element rather than as a struct of its fields. A dialect which names
   * an unnested scalar by the unnest's alias alone has to be handed the value
   * under that alias, or the same reference outside the subquery would read a
   * struct. The answer is read from the dialect's own reference, so that it
   * cannot drift from it.
   */
  packsAsValue(): boolean {
    const sd = this.queryStruct.structDef;
    return (
      isBasicArray(sd) &&
      this.queryStruct.dialect.sqlFieldReference(
        this.alias,
        'array[scalar]',
        'value',
        sd.elementTypeDef.type
      ) === this.alias
    );
  }

  /** The column a bare value's row number is carried out of a subquery in. */
  packedRowIdColumn(): string {
    return `${this.alias}${PACKED_ROW_ID}`;
  }

  /** This unnest's row number, where the unnest is written. */
  innerRowIdSQL(): string {
    return this.queryStruct.dialect.sqlFieldReference(
      this.alias,
      'table',
      '__row_id',
      'string'
    );
  }

  /**
   * This unnest's row number, which its distinct key is made of, as the
   * query outside any subquery reads it: from what the subquery carried out
   * when the unnest is placed inside one.
   */
  rowIdSQL(): string {
    if (!this.placedInSubquery) {
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
