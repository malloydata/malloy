/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

// Main public API
export {createServer} from './create_server';
export type {CreateServerOptions} from './create_server';
export {TranslateCache} from './translate_cache';
export type {
  TranslateCacheLogger,
  CellDataProvider,
  WorkspaceFolderProvider,
} from './translate_cache';
export {CommonConnectionManager} from './common/connection_manager';
export type {HostAdapter, SecretResolver} from './common/connection_manager';
export type {ConnectionFactory} from './common/connections/types';
export {NodeURLReader} from './node_url_reader';
export {check} from './check';

// Re-export handler functions for direct use
export {
  getMalloyDiagnostics,
  aggregateNotebookDiagnostics,
} from './diagnostics';
export {getMalloySymbols} from './symbols';
export {getMalloyLenses} from './lenses';
export {
  getCompletionItems,
  resolveCompletionItem,
} from './completions/completions';
export {getHover} from './hover/hover';
export {getMalloyDefinitionReference} from './definitions/definitions';
export {getMalloyCodeAction} from './code_actions/code_actions';

// Re-export types
export type {
  ConnectionManager,
  UnresolvedConnectionConfigEntry,
} from './common/types/connection_manager_types';
