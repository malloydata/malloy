/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type * as Malloy from '@malloydata/malloy-interfaces';
import type {ModelDef} from '../model/malloy_types';
import type {MalloyElement} from './ast';
import type {LogMessage} from './parse-log';
import type {DocumentSymbol} from './parse-tree-walkers/document-symbol-walker';
import type {DocumentCompletion} from './parse-tree-walkers/document-completion-walker';
import type {DocumentHelpContext} from './parse-tree-walkers/document-help-context-walker';
import type {PathInfo} from './parse-tree-walkers/find-table-path-walker';

export interface ResponseBase {
  timingInfo?: Malloy.TimingInfo;
}

/**
 * The translation interface is essentially a request/response protocol, and
 * this is the list of all the "protocol" messages.
 */
export interface FinalResponse {
  final: true; // When final, there is no need to reply, translation is over
}
export interface ProblemResponse {
  problems: LogMessage[];
}
export type FatalResponse = FinalResponse & ProblemResponse;

export interface NeedSchemaData {
  tables: Record<
    string,
    {
      connectionName: string;
      tablePath: string;
    }
  >;
}

export interface NeedURLData {
  urls: string[];
}

export interface SQLSourceRequest {
  connection: string;
  selectStr: string;
}

export interface NeedCompileSQL {
  compileSQL: SQLSourceRequest;
}

export interface NeedConnectionDialects {
  connectionDialects: Record<string, {connectionName: string}>;
}

interface NeededData
  extends NeedURLData, NeedSchemaData, NeedCompileSQL, NeedConnectionDialects {}
export type DataRequestResponse = Partial<NeededData> & ResponseBase;
export function isNeedResponse(dr: DataRequestResponse): dr is NeededData {
  return (
    !!dr &&
    (dr.tables || dr.urls || dr.compileSQL || dr.connectionDialects) !==
      undefined
  );
}
export type ModelDataRequest = NeedCompileSQL | undefined;
interface ASTData
  extends ResponseBase, ProblemResponse, NeededData, FinalResponse {
  ast: MalloyElement;
}
export type ASTResponse = Partial<ASTData>;
interface Metadata
  extends ResponseBase, NeededData, ProblemResponse, FinalResponse {
  symbols: DocumentSymbol[];
}
export type MetadataResponse = Partial<Metadata>;
interface Completions
  extends ResponseBase, NeededData, ProblemResponse, FinalResponse {
  completions: DocumentCompletion[];
}
export type CompletionsResponse = Partial<Completions>;
interface HelpContext
  extends ResponseBase, NeededData, ProblemResponse, FinalResponse {
  helpContext: DocumentHelpContext | undefined;
}

export type HelpContextResponse = Partial<HelpContext>;
interface TranslatedResponseData
  extends ResponseBase, NeededData, ProblemResponse, FinalResponse {
  modelDef: ModelDef;
  fromSources: string[];
  modelWasModified: boolean;
}

interface TablePath
  extends ResponseBase, NeededData, ProblemResponse, FinalResponse {
  pathInfo: PathInfo[];
}
export type TablePathResponse = Partial<TablePath>;

export type TranslateResponse = Partial<TranslatedResponseData>;
