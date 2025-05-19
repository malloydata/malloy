import type {FieldName} from './field-space';
import type {Binding} from './bindings';
import type {NamespaceLookupResult} from './namespace-lookup-result';

// TODO: I currently have a tangled mess of things named Namespace
// (and these are interfaces, mostly) and a general migration of
// things to use the Scope class. Except Scope is a class and not an
// interface and I'm not 100% sure I've figured out the ideal class
// relationships to represent the needs here.
export interface Scope {
  lookup(symbol: FieldName[]): NamespaceLookupResult;

  // Return the entries for this specific layer of scope,
  // without including anything from the outer or inner scopes.
  entries(): [string, Binding][];

  getEntry(name: string): Binding | undefined;

  // TODO: Commented this out because many of the FieldSpace implementations
  // have a 'protected' setEntry. I want to see if I can enable that
  // rather than forcing them to be public.
  // setEntry(name: string, value: Symbol): void;
}
