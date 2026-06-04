/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {Dialect} from '../../../dialect/dialect';
import type {
  AccessModifierLabel,
  SourceDef,
  StructDef,
} from '../../../model/malloy_types';
import type {QueryOperationSpace} from '../field-space/query-spaces';
import type {LookupResult} from './lookup-result';
import {MalloyElement} from './malloy-element';
import type {SpaceEntry} from './space-entry';

/**
 * A FieldSpace is a hierarchy of namespaces, where the leaf nodes
 * are fields. A FieldSpace can lookup fields, and generate a StructDef
 */
export interface FieldSpace {
  type: 'fieldSpace';
  structDef(): StructDef;
  emptyStructDef(): StructDef;
  lookup(
    symbol: FieldName[],
    accessLevel?: AccessModifierLabel | undefined
  ): LookupResult;
  entry(symbol: string): SpaceEntry | undefined;
  entries(): [string, SpaceEntry][];
  dialectObj(): Dialect | undefined;
  dialectName(): string;
  connectionName(): string;
  isQueryFieldSpace(): this is QueryFieldSpace;
  accessProtectionLevel(): AccessModifierLabel;
}

export interface SourceFieldSpace extends FieldSpace {
  structDef(): SourceDef;
  emptyStructDef(): SourceDef;
}

export interface QueryFieldSpace extends SourceFieldSpace {
  outputSpace(): QueryOperationSpace;
  inputSpace(): SourceFieldSpace;
  isQueryOutputSpace(): boolean;
}

export class FieldName extends MalloyElement {
  elementType = 'fieldName';

  constructor(readonly name: string) {
    super();
  }

  get refString(): string {
    return this.name;
  }

  override toString(): string {
    return this.refString;
  }

  getField(fs: FieldSpace): LookupResult {
    return fs.lookup([this]);
  }
}
