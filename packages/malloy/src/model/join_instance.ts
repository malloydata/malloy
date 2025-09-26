/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {QueryStruct} from './query_node';
import {QueryFieldBoolean} from './query_node';
import {getDialectFieldList} from './utils';
import type {JoinRelationship, UniqueKeyRequirement} from './malloy_types';

import {isSourceDef, isJoined} from './malloy_types';
import type {DialectFieldList} from '../dialect';

export class JoinInstance {
  uniqueKeyRequirement?: UniqueKeyRequirement;
  makeUniqueKey = false;
  leafiest = false;
  // [REVIEW] Flag indicating this join's ON expression references nested joins
  // Used by SQL generation to determine when to rewrite ON conditions
  onReferencesChildren?: boolean;
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
    return getDialectFieldList(this.queryStruct.structDef);
  }
}
