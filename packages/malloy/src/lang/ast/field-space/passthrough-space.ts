/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type {Dialect} from '../../../dialect/dialect';
import type {StructDef, AccessModifierLabel} from '../../../model/malloy_types';

import type {
  FieldName,
  FieldSpace,
  QueryFieldSpace,
} from '../types/field-space';
import type {LookupResult} from '../types/lookup-result';
import type {SpaceEntry} from '../types/space-entry';

export class PassthroughSpace implements FieldSpace {
  readonly type = 'fieldSpace';
  constructor(readonly realFS: FieldSpace) {}

  structDef(): StructDef {
    return this.realFS.structDef();
  }

  emptyStructDef(): StructDef {
    return this.realFS.emptyStructDef();
  }

  entry(name: string): SpaceEntry | undefined {
    return this.realFS.entry(name);
  }

  lookup(symbol: FieldName[]): LookupResult {
    return this.realFS.lookup(symbol);
  }

  entries(): [string, SpaceEntry][] {
    return this.realFS.entries();
  }

  dialectName() {
    return this.realFS.dialectName();
  }

  dialectObj(): Dialect | undefined {
    return this.realFS.dialectObj();
  }

  isQueryFieldSpace(): this is QueryFieldSpace {
    return this.realFS.isQueryFieldSpace();
  }

  outputSpace() {
    if (this.realFS.isQueryFieldSpace()) {
      return this.realFS.outputSpace();
    }
    throw new Error('Not a query field space');
  }

  inputSpace() {
    if (this.realFS.isQueryFieldSpace()) {
      return this.realFS.inputSpace();
    }
    throw new Error('Not a query field space');
  }

  accessProtectionLevel(): AccessModifierLabel {
    return this.realFS.accessProtectionLevel();
  }
}
