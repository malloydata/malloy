import {
  Query,
  ModelDef,
  SQLBlockSource,
  SQLBlockStructDef,
} from "../model/malloy_types";
import { MalloyElement } from "./ast";
import { LogMessage } from "./parse-log";
import { DocumentSymbol } from "./parse-tree-walkers/document-symbol-walker";
import { DocumentHighlight } from "./parse-tree-walkers/document-highlight-walker";
import { DocumentCompletion } from "./parse-tree-walkers/document-completion-walker";
import { DocumentHelpContext } from "./parse-tree-walkers/document-help-context-walker";

/**
 * The translation interface is essentially a request/respone protocol, and
 * this is the list of all the "protocol" messages.
 */
export interface FinalResponse {
  final: true; // When final, there is no need to reply, translation is over
}
export interface ErrorResponse {
  errors: LogMessage[];
}
export type FatalResponse = FinalResponse & ErrorResponse;

export interface NeedSchemaData {
  tables: string[];
}

export interface NeedURLData {
  urls: string[];
}

export interface NeedCompileSQL {
  compileSQL: SQLBlockSource;
  partialModel: ModelDef | undefined;
}
interface NeededData extends NeedURLData, NeedSchemaData, NeedCompileSQL {}
export type DataRequestResponse = Partial<NeededData> | null;
export function isNeedResponse(dr: DataRequestResponse): dr is NeededData {
  return !!dr && (dr.tables || dr.urls || dr.compileSQL) != undefined;
}
export type ModelDataRequest = NeedCompileSQL | undefined;
interface ASTData extends ErrorResponse, NeededData, FinalResponse {
  ast: MalloyElement;
}
export type ASTResponse = Partial<ASTData>;
interface Metadata extends NeededData, ErrorResponse, FinalResponse {
  symbols: DocumentSymbol[];
  highlights: DocumentHighlight[];
}
export type MetadataResponse = Partial<Metadata>;
interface Completions extends NeededData, ErrorResponse, FinalResponse {
  completions: DocumentCompletion[];
}
export type CompletionsResponse = Partial<Completions>;
interface HelpContext extends NeededData, ErrorResponse, FinalResponse {
  helpContext: DocumentHelpContext | undefined;
}
export type HelpContextResponse = Partial<HelpContext>;
interface TranslatedResponseData
  extends NeededData,
    ErrorResponse,
    FinalResponse {
  translated: {
    modelDef: ModelDef;
    queryList: Query[];
    sqlBlocks: SQLBlockStructDef[];
  };
}

export type TranslateResponse = Partial<TranslatedResponseData>;
