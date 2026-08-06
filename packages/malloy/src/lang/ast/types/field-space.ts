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
 * Some field spaces are static, some are dynamic. We are computing a very
 * conservative process wide "generation" which moves forward when any
 * dynamic field space changes. We can be very certain that if the field space
 * generation has not changed, computations depending on the contents of
 * field spaces are still valid.
 *
 * A more fine grained validity is hard to compute and possibly a fragile
 * computation. Spaces delegate to each other -- a passthrough wraps another
 * space, a query output space resolves names through its input space -- so a
 * per-space generation has to forward through every one of those paths, and a
 * path we missed is a stale cache we never notice. We think this simple
 * approach will be good enough for a long time, possibly forever.
 */
let bindingGeneration = 0;

export function currentGeneration(): number {
  return bindingGeneration;
}

/**
 * Called by every field space operation that binds, rebinds or unbinds a
 * name. Lazily materializing a space's entries from its StructDef is not
 * such an operation -- the bindings were already logically present, so
 * nothing a cache observed can have changed.
 */
export function noteRebinding(): void {
  bindingGeneration += 1;
}

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
  /**
   * A value which changes whenever any name binding changes. A result
   * computed by consulting this space may be reused only while this is
   * unchanged. See `noteRebinding` above.
   */
  generation(): number;
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
