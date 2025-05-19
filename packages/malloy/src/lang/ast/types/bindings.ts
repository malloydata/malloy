/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type {ConnectionDef, FieldDef, NamedQuery} from '../../../model';
import {
  isSourceDef,
  type FunctionDef,
  type NamedModelObject,
  type SourceDef,
  type TypeDesc,
} from '../../../model';
import type {MalloyElement} from './malloy-element';
import type {BaseScope} from './scope';

// Note: We removed 'parameter' from this
// TODO: Maybe 'view' and 'join' can have its own entry. Let's address that before we're done.
export type SymbolKind =
  | 'field'
  | 'source'
  | 'query'
  | 'connection'
  | 'function'
  | 'namespace';

// TODO: Do I need an 'exported' bool to sufficiently support global and model-level entries?
// or are those properties of one of the sub-interfaces?
// A scope binds identifiers to .
// Therefore, 'Symbol' is some entity in the system that has been bound
// to an identifier in some scope.
export interface Binding {
  // The name that this symbol is bound to in some scope.
  name: string;
  symbolKind: SymbolKind;

  // Points to the declaration of this symbol, if one exists. Certain types of symbols,
  // such as NamespaceSymbols may exist without an explicit declaration.
  declaration?: MalloyElement;

  // Represents whether this symbol is exported from its scope, and only applies to
  // certain types of symbols and scopes. For example: sources in a model.
  isExported?: boolean;
  setIsExported(isExported: boolean): void;

  isField(): this is FieldBinding;
  isSource(): this is SourceBinding;
  isQuery(): this is QueryBinding;
  isConnection(): this is ConnectionBinding;
  isFunction(): this is FunctionBinding;

  // TODO: Update this comment:
  // Returns true if this entry is a reference to another namespace (scope?)
  // rather than any other type of entity.
  // So a ScopeEntry is an entry that represents a scope, rather than
  // being 'an entry in a scope'.
  // A namespace is a named scope, such as 'parameters' or 'source'
  // which may be an entry in the lexical scope at some point.s
  isNamespace(): this is NamespaceBinding;

  // TODO: This is on the SpaceEntry, so I carried it forward...
  getTypeDesc(): TypeDesc;
}

// Forward declarations
export interface FieldBinding extends Binding {
  getTypeDesc(): TypeDesc;
  fieldDef(): FieldDef;
}

// TODO: Do I need structDef or SourceDef or both here?
export interface SourceBinding extends Binding {
  // structDef(): StructDef;
  getSourceDef(): SourceDef;
}

// This interface is intentionally empty for now
export interface QueryBinding extends Binding {
  getNamedQuery(): NamedQuery;
}

// This interface is intentionally empty for now
export interface ConnectionBinding extends Binding {
  getConnectionDef(): ConnectionDef;
}

// This interface is intentionally empty for now
export interface FunctionBinding extends Binding {
  getFunctionDef(): FunctionDef;
}

export interface NamespaceBinding extends Binding {
  getScope(): BaseScope;
}

export abstract class BaseBinding implements Binding {
  symbolKind!: SymbolKind; // Using definite assignment assertion instead of abstract
  name!: string;
  declaration!: MalloyElement;
  isExported!: boolean;

  getTypeDesc(): TypeDesc {
    throw new Error('Method not implemented.');
  }

  isField(): this is FieldBinding {
    return this.symbolKind === 'field';
  }
  isSource(): this is SourceBinding {
    return this.symbolKind === 'source';
  }
  isQuery(): this is QueryBinding {
    return this.symbolKind === 'query';
  }
  isConnection(): this is ConnectionBinding {
    return this.symbolKind === 'connection';
  }
  isFunction(): this is FunctionBinding {
    return this.symbolKind === 'function';
  }
  isNamespace(): this is NamespaceBinding {
    return this.symbolKind === 'namespace';
  }

  setIsExported(isExported: boolean): void {
    this.isExported = isExported;
  }
}

// TODO: I'm not sure that this class/interface hierarchy is necessary or
// even useful. Look into simplification before merging.
export class FunctionNamespaceEntryInstance
  extends BaseBinding
  implements FunctionBinding
{
  constructor(private functionDef: FunctionDef) {
    super();
  }
  getFunctionDef(): FunctionDef {
    return this.functionDef;
  }
}

// TODO: Populate the scope with a NamespaceSymbol whenever we need a particular scope
// to be addressable by name.
export class NamespaceSymbolInstance
  extends BaseBinding
  implements NamespaceBinding
{
  constructor(
    private scope: BaseScope,
    isExported
  ) {
    super();
    this.isExported = isExported;
  }

  public getScope(): BaseScope {
    return this.scope;
  }
}

export class FieldBindingInstance extends BaseBinding implements FieldBinding {
  constructor(private _fieldDef: FieldDef) {
    super();
  }
  fieldDef(): FieldDef {
    return this._fieldDef;
  }
}

export class SourceBindingInstance
  extends BaseBinding
  implements SourceBinding
{
  constructor(private sourceDef: SourceDef) {
    super();
  }

  public getSourceDef(): SourceDef {
    return this.sourceDef;
  }
}

export class QueryBindingInstance extends BaseBinding implements QueryBinding {
  // TODO: is 'queryDef' the right naming here for a namedQuery?
  constructor(private namedQuery: NamedQuery) {
    super();
  }

  public getNamedQuery(): NamedQuery {
    return this.namedQuery;
  }
}

export class FunctionBindingInstance
  extends BaseBinding
  implements FunctionBinding
{
  constructor(private functionDef: FunctionDef) {
    super();
  }
  public getFunctionDef() {
    return this.functionDef;
  }
}

export class ConnectionBindingInstance
  extends BaseBinding
  implements ConnectionBinding
{
  constructor(private connectionDef: ConnectionDef) {
    super();
  }
  public getConnectionDef() {
    return this.connectionDef;
  }
}

// TODO: Re-order the classes in this file to some reasonable system.

// This is a helper function to enable one particular use case in malloy-element.ts
export const makeSymbolFromNamedModelObject = (
  modelObject: NamedModelObject
): Binding | undefined => {
  if (isSourceDef(modelObject)) {
    return new SourceBindingInstance(modelObject);
  } else if (modelObject.type === 'query') {
    return new QueryBindingInstance(modelObject);
  } else if (modelObject.type === 'function') {
    return new FunctionBindingInstance(modelObject);
  } else if (modelObject.type === 'connection') {
    return new ConnectionBindingInstance(modelObject);
  }
  return undefined;
};
