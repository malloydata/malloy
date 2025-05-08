import type {Dialect} from '../../../dialect';
import type {StructDef} from '../../../model';
import type {FieldName} from './field-space';
import type {Namespace} from './namespace';
import type {LookupResult} from './lookup-result';
import type {NamespaceEntry} from './namespace-entry';
import type {SpaceEntry} from './space-entry';

/**
 * A Scope represents an ordered list of Namespaces available at a given point in
 * the AST of a Malloy model. It can be used to resolve symbol names to their internal
 * representations.
 */
export class Scope implements Namespace {
  private namespaces: Namespace[] = [];

  constructor(
    public namespace: Namespace,
    public parentScope?: Scope
  ) {
    // TODO: Instantiate
  }
  getEntries(): NamespaceEntry {
    throw new Error('Method not implemented.');
  }
  getEntry(_name: string): NamespaceEntry {
    throw new Error('Method not implemented.');
  }

  // Looks up an entry by full symbol path from the full namespace stack,
  // walking up the stack until the entry is found, or returns
  // a LookupError if nothing is found.
  lookup(_symbol: FieldName[]): LookupResult {
    throw new Error('Method not implemented.');
  }

  dialectObj(): Dialect | undefined {
    throw new Error('Method not implemented.');
  }

  isQueryFieldSpace(): boolean {
    throw new Error('Method not implemented.');
  }

  outputSpace(): Scope {
    throw new Error('Method not implemented.');
  }

  dialectName(): string | undefined {
    throw new Error('Method not implemented.');
  }

  // Look up an entry from a single symbol
  // TODO: Does this look up the stack, or is it restricted to only
  // looking at the top of the stack? If so, what differentiates this from
  // calling lookup with a length of 1?
  entry(_name: string): SpaceEntry | undefined {
    throw new Error('Method not implemented.');
  }

  emptyStructDef(): StructDef {
    throw new Error('Method not implemented.');
  }
  structDef(): StructDef {
    throw new Error('Method not implemented.');
  }
}
