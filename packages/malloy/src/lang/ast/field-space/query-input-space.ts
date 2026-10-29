/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

/**
 * Unlike a source, which is a refinement of a namespace, a query
 * is creating a new unrelated namespace. The query starts with a
 * source, which it might modify. This set of fields used to resolve
 * expressions in the query is called the "input space". There is a
 * specialized QuerySpace for each type of query operation.
 */

import type {AccessModifierLabel, SourceDef} from '../../../model';
import type {AtomicFieldDeclaration} from '../query-items/field-declaration';
import {Join} from '../source-properties/join';
import type {QueryFieldSpace} from '../types/field-space';
import type {QueryOperationSpace} from './query-spaces';
import {RefinedSpace} from './refined-space';

export class QueryInputSpace extends RefinedSpace implements QueryFieldSpace {
  extendList: string[] = [];

  /**
   * Because of circularity concerns this constructor is not typed
   * properly ...
   * @param input The source which might be extended
   * @param queryOutput MUST BE A QuerySpace
   */
  constructor(
    input: SourceDef,
    private queryOutput: QueryOperationSpace,
    public readonly _accessProtectionLevel: AccessModifierLabel
  ) {
    super(input);
  }

  extendSource(extendField: Join | AtomicFieldDeclaration): void {
    this.pushFields(extendField);
    if (extendField instanceof Join) {
      this.extendList.push(extendField.name.refString);
    } else {
      this.extendList.push(extendField.defineName);
    }
  }

  isQueryFieldSpace(): this is QueryFieldSpace {
    return true;
  }

  outputSpace() {
    return this.queryOutput;
  }

  inputSpace() {
    return this;
  }

  accessProtectionLevel(): AccessModifierLabel {
    return this._accessProtectionLevel;
  }

  isQueryOutputSpace() {
    return false;
  }
}
