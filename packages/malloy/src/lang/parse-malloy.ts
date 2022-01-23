/*
 * Copyright 2021 Google LLC
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * version 2 as published by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 */

/* eslint-disable no-useless-constructor */
import { URL } from "url";
import {
  ANTLRErrorListener,
  Token,
  CharStreams,
  CommonTokenStream,
} from "antlr4ts";
import type { ParseTree } from "antlr4ts/tree";
import {
  Query,
  NamedStructDefs,
  StructDef,
  ModelDef,
} from "../model/malloy_types";
import { MalloyLexer } from "./lib/Malloy/MalloyLexer";
import { MalloyParser } from "./lib/Malloy/MalloyParser";
import * as ast from "./ast";
import { MalloyToAST } from "./parse-to-ast";
import { MessageLogger, LogMessage, MessageLog } from "./parse-log";
import { findReferences } from "./parse-tree-walkers/find-external-references";
import { Zone, ZoneData } from "./zone";
import {
  DocumentSymbol,
  walkForDocumentSymbols,
} from "./parse-tree-walkers/document-symbol-walker";

import {
  DocumentHighlight,
  walkForDocumentHighlights,
  passForHighlights,
  sortHighlights,
} from "./parse-tree-walkers/document-highlight-walker";

class ParseErrorHandler implements ANTLRErrorListener<Token> {
  constructor(readonly sourceURL: string, readonly messages: MessageLogger) {}

  syntaxError(
    recognizer: unknown,
    offendingSymbol: Token | undefined,
    line: number,
    charPositionInLine: number,
    msg: string,
    _e: unknown
  ) {
    const error: LogMessage = {
      sourceURL: this.sourceURL,
      message: msg,
      begin: {
        line: line,
        char: charPositionInLine,
      },
    };
    // TODO Don't know how to translate stopIndex into a char/line
    // if (offendingSymbol && offendingSymbol.stopIndex != -1) {
    //   error.end = {
    //     line: offendingSymbol.tokenSource.inputStream.
    //     char: offendingSymbol.tokenSource.charPositionInLine,
    //   };
    // }
    this.messages.log(error);
  }
}

export interface ParseMalloy {
  sourceURL: string;
  root: ParseTree;
  tokens: CommonTokenStream;
  malloyVersion: string;
}

function runParser(
  source: string,
  sourceURL: string,
  messages: MessageLogger,
  parseRule: string
): ParseMalloy {
  const inputStream = CharStreams.fromString(source);
  const lexer = new MalloyLexer(inputStream);
  const tokenStream = new CommonTokenStream(lexer);
  const malloyParser = new MalloyParser(tokenStream);
  malloyParser.removeErrorListeners();
  malloyParser.addErrorListener(new ParseErrorHandler(sourceURL, messages));

  // Admitted code smell here, testing likes to parse from an arbitrary
  // node and this is the simplest way to allow that.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parseFunc = (malloyParser as any)[parseRule];
  if (!parseFunc) {
    throw new Error(`No such parse rule as ${parseRule}`);
  }

  return {
    sourceURL: sourceURL,
    root: parseFunc.call(malloyParser) as ParseTree,
    tokens: tokenStream,
    malloyVersion: "0.2.0-beta",
  };
}

/**
 * The translation interface is essentially a request/respone protocol, and
 * this is the list of all the "protocol" messages.
 */
interface FinalResponse {
  final: true;
}
interface ErrorResponse {
  errors: LogMessage[];
}
interface FatalResponse extends FinalResponse, ErrorResponse {}
export interface NeedURLData {
  urls: string[];
}
export interface NeedSchemaData {
  tables: string[];
}

interface ParseData extends ErrorResponse, NeedURLData, FinalResponse {
  parse: ParseMalloy;
}
type ParseResponse = Partial<ParseData>;

interface NeededData extends NeedURLData, NeedSchemaData {}
export type DataRequestResponse = Partial<NeededData> | null;
function isNeedResponse(dr: DataRequestResponse): dr is NeededData {
  return !!(dr?.tables || dr?.urls);
}

interface TranslatedResponse extends NeededData, ErrorResponse, FinalResponse {
  translated: {
    modelDef: ModelDef;
    queryList: Query[];
  };
}
export type TranslateResponse = Partial<TranslatedResponse>;

interface ASTData extends ErrorResponse, NeededData, FinalResponse {
  ast: ast.MalloyElement;
}
type ASTResponse = Partial<ASTData>;

interface Metadata extends NeededData, ErrorResponse, FinalResponse {
  symbols: DocumentSymbol[];
  highlights: DocumentHighlight[];
}
type MetadataResponse = Partial<Metadata>;

export abstract class MalloyTranslation {
  abstract root: MalloyTranslator;
  private parse?: ParseMalloy;
  private parseResponse?: ParseResponse;
  private astResponse?: ASTResponse;
  protected translateResponse?: TranslateResponse;
  private metadataResponse?: MetadataResponse;
  private childTranslators: Map<string, MalloyTranslation>;
  private urlIsFullPath?: boolean;
  private queryList: Query[] = [];
  private findReferences = true;
  protected modelDef: ModelDef;

  constructor(
    readonly sourceURL: string,
    protected grammarRule = "malloyDocument"
  ) {
    this.childTranslators = new Map<string, MalloyTranslation>();
    this.modelDef = {
      name: sourceURL,
      exports: [],
      contents: {},
    };
  }

  private addChild(url: string): void {
    if (!this.childTranslators.get(url)) {
      this.childTranslators.set(url, new MalloyChildTranslator(url, this.root));
    }
  }

  private fatalErrors(): FatalResponse {
    return {
      final: true,
      errors: [...this.root.logger.getLog()],
    };
  }

  getParseResponse(): ParseResponse {
    if (this.parseResponse) {
      return this.parseResponse;
    }

    if (this.urlIsFullPath === undefined) {
      try {
        const _checkFull = new URL(this.sourceURL);
        this.urlIsFullPath = true;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        this.urlIsFullPath = false;
        this.root.logger.log({
          message: `Could not compute full path URL: ${msg}`,
          sourceURL: this.sourceURL,
        });
      }
    }
    if (!this.urlIsFullPath) {
      return this.fatalErrors();
    }

    const srcEnt = this.root.importZone.getEntry(this.sourceURL);
    if (srcEnt.status !== "present") {
      if (srcEnt.status === "error") {
        const message = srcEnt.message.includes(this.sourceURL)
          ? `Source missing: ${srcEnt.message}`
          : `Source for '${this.sourceURL}' missing: ${srcEnt.message}`;
        let errMsg: LogMessage = { sourceURL: this.sourceURL, message };
        if (srcEnt.firstReference) {
          errMsg = { ...errMsg, ...srcEnt.firstReference };
        }
        this.root.logger.log(errMsg);
        this.parseResponse = this.fatalErrors();
        return this.parseResponse;
      }
    }
    const source = this.root.importZone.get(this.sourceURL);
    if (!source) {
      return { urls: [this.sourceURL] };
    }

    const parse = runParser(
      source,
      this.sourceURL,
      this.root.logger,
      this.grammarRule
    );

    if (this.root.logger.hasErrors()) {
      this.parseResponse = {
        parse,
        ...this.fatalErrors(),
      };
    } else {
      this.parseResponse = { parse };
    }
    return this.parseResponse;
  }

  unresolved(): DataRequestResponse {
    const parseReq = this.getParseResponse();
    if (parseReq.errors || !parseReq.parse) {
      return null;
    }

    if (this.findReferences) {
      this.findReferences = false;
      const parseRefs = findReferences(
        parseReq.parse.tokens,
        parseReq.parse.root
      );

      if (parseRefs?.tables) {
        for (const ref in parseRefs.tables) {
          this.root.schemaZone.reference(ref, parseRefs.tables[ref]);
        }
      }

      if (parseRefs?.urls) {
        for (const relativeRef in parseRefs.urls) {
          const firstRef = parseRefs.urls[relativeRef];
          try {
            const ref = new URL(relativeRef, this.sourceURL).toString();
            this.addChild(ref);
            this.root.importZone.reference(ref, firstRef);
          } catch (err) {
            // This import spec is so bad the URL library threw up, this
            // may be impossible, because it will append any garbage
            // to the known good rootURL assuming it is relative
            this.root.logger.log({
              sourceURL: this.sourceURL,
              message: `Malformed URL '${relativeRef}'"`,
              ...firstRef,
            });
          }
        }
      }
    }

    if (this.root.logger.hasErrors()) {
      // Since we knew we parsed without errors, this would only be from
      // having a malformed URL on an import reference.
      return null;
    }

    let allMissing: DataRequestResponse = {};
    const missingTables = this.root.schemaZone.getUndefined();
    if (missingTables) {
      allMissing = { tables: missingTables };
    }

    const missingImports = this.root.importZone.getUndefined();
    if (missingImports) {
      allMissing = { ...allMissing, urls: missingImports };
    }

    if (isNeedResponse(allMissing)) {
      return allMissing;
    }

    for (const child of this.childTranslators.values()) {
      const kidNeeds = child.unresolved();
      if (isNeedResponse(kidNeeds)) {
        return kidNeeds;
      }
    }

    return null;
  }

  /**
   * The error log can grow as progressively deeper questions are asked.
   * When returning "errors so far", make a snapshot.
   */
  errors(): ErrorResponse {
    const errors = this.root.logger.getLog();
    return { errors: [...errors] };
  }

  prettyErrors(): string {
    let lovely = "";
    let inFile = "";
    const lineMap: Record<string, string[]> = {};
    for (const entry of this.root.logger.getLog()) {
      let cooked = entry.message;
      if (entry.begin && entry.begin.line) {
        const lineNo = entry.begin.line;
        if (this.sourceURL) {
          if (lineMap[this.sourceURL] === undefined) {
            const sourceFile = this.root.importZone.get(this.sourceURL);
            if (sourceFile) {
              lineMap[this.sourceURL] = sourceFile.split("\n");
            }
          }
          if (lineMap[this.sourceURL]) {
            const errorLine = lineMap[this.sourceURL][lineNo - 1];
            cooked = `line ${lineNo}: ${entry.message}\n  | ${errorLine}`;
            if (entry.begin.char !== undefined && entry.begin.char >= 0) {
              cooked = cooked + `\n  | ${" ".repeat(entry.begin.char)}^`;
            }
          } else {
            cooked =
              `line ${lineNo}` +
              `:char ${entry.begin?.char || "?"}` +
              `:${entry.message}`;
          }
        }
      }
      if (inFile !== this.sourceURL) {
        cooked = `FILE: ${this.sourceURL}\n` + cooked;
        inFile = this.sourceURL;
      }
      if (lovely !== "") {
        lovely = `${lovely}\n${cooked}`;
      } else {
        lovely = cooked;
      }
    }
    return lovely;
  }

  getASTResponse(): ASTResponse {
    if (this.astResponse) {
      return this.astResponse;
    }

    const mustResolve = this.unresolved();
    if (mustResolve) {
      return mustResolve;
    }
    const parseResponse = this.getParseResponse();
    // Errors in self or children will show up here ..
    if (this.root.logger.hasErrors()) {
      this.astResponse = this.fatalErrors();
      return this.astResponse;
    }

    const parse = parseResponse.parse;
    if (!parse) {
      throw new Error(
        "TRANSLATOR INTERNAL ERROR: Translator parse response had no errors, but also no parser"
      );
    }
    const secondPass = new MalloyToAST(parse, this.root.logger);
    const ast = secondPass.visit(parse.root);
    if (this.root.logger.hasErrors()) {
      this.astResponse = this.fatalErrors();
      return this.astResponse;
    }

    if (ast.elementType === "unimplemented") {
      throw new Error("TRANSLATOR INTERNAL ERROR: Unimplemented AST node");
    }

    ast.setTranslator(this);
    this.astResponse = {
      ...this.errors(), // these errors will by definition all be warnings
      ast,
      final: true,
    };
    return this.astResponse;
  }

  getChildExports(importURL: string): NamedStructDefs {
    const childURL = new URL(importURL, this.sourceURL).toString();
    const child = this.childTranslators.get(childURL);
    if (child) {
      child.translate();
      const exports: NamedStructDefs = {};
      for (const fromChild of child.modelDef.exports) {
        const modelEntry = child.modelDef.contents[fromChild];
        if (modelEntry.type === "struct") {
          exports[fromChild] = modelEntry;
        }
      }
      return exports;
    }
    return {};
  }

  metadata(): MetadataResponse {
    if (!this.metadataResponse) {
      const tryParse = this.getParseResponse();
      if (!tryParse.parse) {
        this.metadataResponse = tryParse;
      } else {
        // Wrap the parse tree walker in a try block -- if the parse is bad, this walk
        // could result in unexpected errors due to the parse tree not looking as expected.
        // We still want to attempt to walk the tree, to preserve document symbols even
        // when there's a bad parse, but we also want to be safe about it.
        let symbols;
        try {
          symbols = walkForDocumentSymbols(
            tryParse.parse.tokens,
            tryParse.parse.root
          );
        } catch {
          // Do nothing, symbols already `undefined`
        }
        let walkHighlights: DocumentHighlight[];
        try {
          walkHighlights = walkForDocumentHighlights(
            tryParse.parse.tokens,
            tryParse.parse.root
          );
        } catch {
          walkHighlights = [];
        }
        this.metadataResponse = {
          symbols,
          highlights: sortHighlights([
            ...passForHighlights(tryParse.parse.tokens),
            ...walkHighlights,
          ]),
          final: true,
        };
      }
    }
    return this.metadataResponse;
  }

  translate(extendingModel?: ModelDef): TranslateResponse {
    if (this.translateResponse) {
      return this.translateResponse;
    }

    const astResponse = this.getASTResponse();
    if (isNeedResponse(astResponse)) {
      return astResponse;
    }
    if (!astResponse.ast) {
      this.translateResponse = astResponse;
      return this.translateResponse;
    }

    astResponse.ast.setTranslator(this);
    if (this.grammarRule === "malloyDocument") {
      if (astResponse.ast instanceof ast.Document) {
        const doc = astResponse.ast;
        this.modelDef = doc.getModelDef(extendingModel);
        this.queryList = doc.queryList;
      } else {
        this.root.logger.log({
          sourceURL: this.sourceURL,
          message: `'${this.sourceURL}' did not parse to malloy document`,
        });
      }
    }

    if (this.root.logger.hasErrors()) {
      this.translateResponse = this.fatalErrors();
    } else {
      this.translateResponse = {
        translated: {
          modelDef: this.modelDef,
          queryList: this.queryList,
        },
        ...this.errors(),
        final: true,
      };
    }
    return this.translateResponse;
  }
}

class MalloyChildTranslator extends MalloyTranslation {
  constructor(rootURL: string, readonly root: MalloyTranslator) {
    super(rootURL);
  }
}

/**
 * The main interface to Malloy tranlsation. It has a call pattern
 * similar to a server. Once a translator is instantiated
 * you can request tralnsations repeatedly. Responses to that request
 * will either be "NeedResponse" or "TranslateResponse" objects. The
 * correct pattern is to call "translation" in a loop, calling
 * "update" in response to each "NeedResponse" until a "TranslateResponse"
 * is returned.
 */
export class MalloyTranslator extends MalloyTranslation {
  schemaZone = new Zone<StructDef>();
  importZone = new Zone<string>();
  logger = new MessageLog();
  readonly root: MalloyTranslator;
  constructor(rootURL: string, preload: ParseUpdate | null = null) {
    super(rootURL);
    this.root = this;
    if (preload) {
      this.update(preload);
    }
  }

  update(dd: ParseUpdate): void {
    this.schemaZone.updateFrom(dd.tables, dd.errors?.tables);
    this.importZone.updateFrom(dd.urls, dd.errors?.urls);
  }
}

interface ErrorData {
  tables: Record<string, string>;
  urls: Record<string, string>;
}

export interface URLData {
  urls: ZoneData<string>;
}
export interface SchemaData {
  tables: ZoneData<StructDef>;
}
export interface UpdateData extends URLData, SchemaData {
  errors: Partial<ErrorData>;
}
export type ParseUpdate = Partial<UpdateData>;
