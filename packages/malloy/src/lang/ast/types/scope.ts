import type {Dialect} from '../../../dialect';
import type {SourceDef, StructDef} from '../../../model';
import type {FieldName} from './field-space';
import type {Scope} from './namespace';
import type {
  NamespaceLookupFound,
  NamespaceLookupResult,
} from './namespace-lookup-result';
import type {Binding} from './bindings';
import type {MalloyElement} from './malloy-element';
import type {QueryInputSpace} from '../field-space/query-input-space';
import type {QueryOperationSpace} from '../field-space/query-spaces';

/**
 * A Scope represents an ordered list of Namespaces available at a given point in
 * the AST of a Malloy model. It can be used to resolve symbol names to their internal
 * representations.
 */
export class BaseScope implements Scope {
  // Although slightly verbose, 'enclosingScope' is the closest I could
  // find to a canonical term to define the relationship of an outer scope
  // to one of the nested scopes within.
  private enclosingScope: BaseScope | undefined;

  private bindings: Map<string, Binding>;

  // TODO: Should we populate this? Is it useful? Is this info even available
  // in the scope where the Namespace is implemented? Is it already available
  // on the data?
  // Points back to the closest AST node which owns this scope.
  private astNode: MalloyElement | undefined;

  // TODO: Is this better represented as a single Scope stack per instance,
  // or perhaps I should think of scope stacks instead as Namespaces with
  // pointers to parent namespaces, which reduces the duplication dramatically...
  constructor(
    enclosingScope?: BaseScope,
    bindings = new Map<string, Binding>(),
    astNode?: MalloyElement
  ) {
    this.bindings = bindings;
    this.enclosingScope = enclosingScope;
    this.astNode = astNode;
  }

  // Look up an entry from a single identifier part from the innermost scope only.
  getEntry(name: string): Binding | undefined {
    return this.bindings.get(name);
  }

  /**
   * Sets an entry in the current scope. Writes to the namespace at the top of the stack.
   */
  setEntry(name: string, entry: Binding): void {
    if (this.bindings.has(name)) {
      // TODO: Determine which cases allow re-defining and which do not!
      throw new Error(`Cannot redefine '${name}' in the same scope`);
    }

    this.bindings.set(name, entry);
  }

  // Looks up an entry by full symbol path from the full namespace stack,
  // walking up the stack until the entry is found, or returns
  // a LookupError if nothing is found.
  lookup(symbol: FieldName[]): NamespaceLookupResult {
    if (symbol.length === 0) {
      // TODO: what is the correct inputs to the NamespaceLookupError
      return {
        found: undefined,
        // TODO: This may be trying to look up something that is not a field.
        error: {
          message: 'Cannot lookup symbol with no text',
          code: 'field-not-found',
        },
      };
    }

    const firstPart = symbol[0];
    const remainder = symbol.slice(1);
    const entry = this.getEntry(firstPart.name);
    if (!entry) {
      return {
        found: undefined,
        error: {
          message: `Could not find symbol ${firstPart.name}.`,
          code: 'field-not-found',
        },
      };
    }
    if (remainder.length === 0) {
      return {
        found: entry,
        scope: this,
        error: undefined,
      } as NamespaceLookupFound;
    }
    // TODO: Look up the symbol identified by remainder on the
    // entry
    if (entry.isNamespace()) {
      return entry.getScope().lookup(remainder);
    }

    return {
      found: undefined,
      error: {
        message: `Could not find symbol ${symbol.map(s => s.name).join('.')}.`,
        code: 'field-not-found',
      },
    };
  }

  // Converts a map into an array of entries
  entries(): [string, Binding][] {
    return Array.from(this.bindings);
  }

  dialectObj(): Dialect | undefined {
    throw new Error('Method not implemented.');
  }

  isQueryFieldSpace(): boolean {
    throw new Error('Method not implemented.');
  }

  outputSpace(): BaseScope {
    throw new Error('Method not implemented.');
  }

  dialectName(): string | undefined {
    throw new Error('Method not implemented.');
  }

  emptyStructDef(): StructDef {
    throw new Error('Method not implemented.');
  }
  structDef(): StructDef {
    throw new Error('Method not implemented.');
  }

  isProtectedAccessSpace(): boolean {
    throw new Error('Method not implemented.');
  }
}

export class SourceScope extends BaseScope {
  constructor(
    private _sourceDef,
    private _isProtectedAccessSpace: boolean
  ) {
    super();
  }

  // TODO: Should this use of the term Space also become Scope?
  public isProtectedAccessSpace(): boolean {
    return this._isProtectedAccessSpace;
  }

  // A SourceDef is a specific type of StructDef.
  structDef(): SourceDef {
    return this._sourceDef;
  }
  // TODO: Copied from static-source-def. Is that the right analogue?
  emptyStructDef(): SourceDef {
    const ret = {...this._sourceDef};
    ret.parameters = {};
    ret.fields = [];
    return ret;
  }
}

export interface QueryScope extends Scope {
  inputSpace(): QueryInputSpace;
  outputSpace(): QueryOperationSpace;

  // TODO: This was the original entry, and I don't know where it came from,
  // but the above QueryInputSpace type works with the existing system better.
  //inputSpace(): SourceFieldSpace;
}
