/*
 * Copyright 2023 Google LLC
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files
 * (the "Software"), to deal in the Software without restriction,
 * including without limitation the rights to use, copy, modify, merge,
 * publish, distribute, sublicense, and/or sell copies of the Software,
 * and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import type * as Malloy from '@malloydata/malloy-interfaces';
import type {Annotation, ModelDef} from '../model/malloy_types';
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
      connectionName: string | undefined;
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
interface NeededData extends NeedURLData, NeedSchemaData, NeedCompileSQL {}
export type DataRequestResponse = Partial<NeededData> & ResponseBase;
export function isNeedResponse(dr: DataRequestResponse): dr is NeededData {
  return !!dr && (dr.tables || dr.urls || dr.compileSQL) !== undefined;
}
export type ModelDataRequest = NeedCompileSQL | undefined;
interface ASTData
  extends ResponseBase,
    ProblemResponse,
    NeededData,
    FinalResponse {
  ast: MalloyElement;
}
export type ASTResponse = Partial<ASTData>;
interface Metadata
  extends ResponseBase,
    NeededData,
    ProblemResponse,
    FinalResponse {
  symbols: DocumentSymbol[];
}
export type MetadataResponse = Partial<Metadata>;
interface ModelAnnotationData
  extends ResponseBase,
    NeededData,
    ProblemResponse,
    FinalResponse {
  modelAnnotation: Annotation;
}
export type ModelAnnotationResponse = Partial<ModelAnnotationData>;
interface Completions
  extends ResponseBase,
    NeededData,
    ProblemResponse,
    FinalResponse {
  completions: DocumentCompletion[];
}
export type CompletionsResponse = Partial<Completions>;
interface HelpContext
  extends ResponseBase,
    NeededData,
    ProblemResponse,
    FinalResponse {
  helpContext: DocumentHelpContext | undefined;
}

export type HelpContextResponse = Partial<HelpContext>;
interface TranslatedResponseData
  extends ResponseBase,
    NeededData,
    ProblemResponse,
    FinalResponse {
  modelDef: ModelDef;
  fromSources: string[];
  modelWasModified: boolean;
}

interface TablePath
  extends ResponseBase,
    NeededData,
    ProblemResponse,
    FinalResponse {
  pathInfo: PathInfo[];
}
export type TablePathResponse = Partial<TablePath>;

export type TranslateResponse = Partial<TranslatedResponseData>;
