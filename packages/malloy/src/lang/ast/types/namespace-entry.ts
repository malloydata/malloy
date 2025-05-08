/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type {StructDef, TypeDesc} from '../../../model';
import type {Namespace} from './field-space';

// Note: We removed 'parameter' from this
// TODO: Consider splitting out 'join' and 'view'
export type RefType = 'field' | 'source' | 'query' | 'connection' | 'function';

// Forward declarations
export interface FieldNamespaceEntry {
  typeDesc(): TypeDesc;
}

export interface SourceNamespaceEntry extends Namespace {
  structDef(): StructDef;
}

// This interface is intentionally empty for now
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface QueryNamespaceEntry {}

// This interface is intentionally empty for now
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface ConnectionNamespaceEntry {}

// This interface is intentionally empty for now
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface FunctionNamespaceEntry {}

export interface NamespaceEntry {
  // TODO: Maybe 'view' and 'join' can have its own entry. Let's address that before we're done.
  refType: RefType;
  isField(): this is FieldNamespaceEntry;
  isSource(): this is SourceNamespaceEntry;
  isQuery(): this is QueryNamespaceEntry;
  isConnection(): this is ConnectionNamespaceEntry;
  isFunction(): this is FunctionNamespaceEntry;
}

export abstract class NamespaceEntryBase implements NamespaceEntry {
  refType!: RefType; // Using definite assignment assertion instead of abstract
  isField(): this is FieldNamespaceEntry {
    return this.refType === 'field';
  }
  isSource(): this is SourceNamespaceEntry {
    return this.refType === 'source';
  }
  isQuery(): this is QueryNamespaceEntry {
    return this.refType === 'query';
  }
  isConnection(): this is ConnectionNamespaceEntry {
    return this.refType === 'connection';
  }
  isFunction(): this is FunctionNamespaceEntry {
    return this.refType === 'function';
  }
}
