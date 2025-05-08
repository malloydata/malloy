import type {NamespaceEntry} from './namespace-entry';

export interface Namespace {
  getEntries(): NamespaceEntry;
  getEntry(name: string): NamespaceEntry;
}
