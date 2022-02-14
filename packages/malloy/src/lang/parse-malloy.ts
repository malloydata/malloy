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
  SQLBlock,
  DocumentRange,
  DocumentReference,
  DocumentPosition,
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
import {
  DocumentCompletion,
  walkForDocumentCompletions,
} from "./parse-tree-walkers/document-completion-walker";
import { ReferenceList } from "./reference-list";

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

/**
 * The translation interface is essentially a request/respone protocol, and
 * this is the list of all the "protocol" messages.
 */
interface FinalResponse {
  final: true; // When final, there is no need to reply, translation is over
}
interface ErrorResponse {
  errors: LogMessage[];
}
type FatalResponse = FinalResponse & ErrorResponse;

export interface NeedSchemaData {
  tables: string[];
}

export interface NeedURLData {
  urls: string[];
}

/**
 * An SQL Block contains a unique key inside it, and we use that to
 * reference and define blocks, since Zone really wants keys to be strings.
 *
 * If I had SQLBlocks when Zones were defined, this would not be
 * a one off class, it would be Zone<keyType,valueType>
 */
export class SQLExploreZone extends Zone<StructDef> {
  keyed: Record<string, SQLBlock> = {};

  referenceBlock(from: ast.SQLStatement, at: DocumentRange): void {
    const sql = from.sqlBlock();
    this.reference(sql.name, at);
    this.keyed[sql.name] = sql;
  }

  getUndefinedBlocks(): SQLBlock[] | undefined {
    const blockRefs = this.getUndefined();
    if (blockRefs) {
      return blockRefs.map((ref) => this.keyed[ref]);
    }
    return undefined;
  }
}

export interface NeedSQLStruct {
  sqlStructs: SQLBlock[];
}

interface NeededData extends NeedURLData, NeedSchemaData, NeedSQLStruct {}
export type DataRequestResponse = Partial<NeededData> | null;
function isNeedResponse(dr: DataRequestResponse): dr is NeededData {
  return !!dr && (dr.tables || dr.urls || dr.sqlStructs) != undefined;
}

interface ASTData extends ErrorResponse, NeededData, FinalResponse {
  ast: ast.MalloyElement;
}
type ASTResponse = Partial<ASTData>;

interface Metadata extends NeededData, ErrorResponse, FinalResponse {
  symbols: DocumentSymbol[];
  highlights: DocumentHighlight[];
}
type MetadataResponse = Partial<Metadata>;

interface Completions extends NeededData, ErrorResponse, FinalResponse {
  completions: DocumentCompletion[];
}
type CompletionsResponse = Partial<Completions>;

interface TranslatedResponseData
  extends NeededData,
    ErrorResponse,
    FinalResponse {
  translated: {
    modelDef: ModelDef;
    queryList: Query[];
    sqlBlocks: SQLBlock[];
  };
}

export type TranslateResponse = Partial<TranslatedResponseData>;

type StepResponses =
  | DataRequestResponse
  | ASTResponse
  | TranslateResponse
  | ParseResponse
  | MetadataResponse;

/**
 * A Translation is a series of translation steps. Each step can depend
 * on other steps, in which case the preceeding steps will be passed
 * to the constructor. The translator methods will then ask the final
 * step for the answer, and it will call up the chain asking all the
 * steps that it depends on for their answers.
 *
 * Any step can return a result which will be ...
 *   "I had errors, go no further"
 *   "I hit a spot where I need more data before I can continue"
 *   "I am done, here is the result of this step"
 */
interface TranslationStep {
  step(that: MalloyTranslation): StepResponses;
}

export interface MalloyParseRoot {
  sourceURL: string;
  root: ParseTree;
  tokens: CommonTokenStream;
  malloyVersion: string;
}

interface ParseData extends ErrorResponse, NeedURLData, FinalResponse {
  parse: MalloyParseRoot;
}
type ParseResponse = Partial<ParseData>;

/**
 * ParseStep -- Parse the source URL
 */
class ParseStep implements TranslationStep {
  response?: ParseResponse;

  step(that: MalloyTranslation): ParseResponse {
    if (this.response) {
      return this.response;
    }

    if (that.urlIsFullPath === undefined) {
      try {
        const _checkFull = new URL(that.sourceURL);
        that.urlIsFullPath = true;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        that.urlIsFullPath = false;
        that.root.logger.log({
          message: `Could not compute full path URL: ${msg}`,
          sourceURL: that.sourceURL,
        });
      }
    }
    if (!that.urlIsFullPath) {
      return that.fatalErrors();
    }

    const srcEnt = that.root.importZone.getEntry(that.sourceURL);
    if (srcEnt.status !== "present") {
      if (srcEnt.status === "error") {
        const message = srcEnt.message.includes(that.sourceURL)
          ? `Source missing: ${srcEnt.message}`
          : `Source for '${that.sourceURL}' missing: ${srcEnt.message}`;
        let errMsg: LogMessage = { sourceURL: that.sourceURL, message };
        if (srcEnt.firstReference) {
          errMsg = { ...errMsg, ...srcEnt.firstReference };
        }
        that.root.logger.log(errMsg);
        this.response = that.fatalErrors();
        return this.response;
      }
      return { urls: [that.sourceURL] };
    }
    const source = srcEnt.value == "" ? "\n" : srcEnt.value;

    const parse = this.runParser(
      source,
      that.sourceURL,
      that.root.logger,
      that.grammarRule
    );

    if (that.root.logger.hasErrors()) {
      this.response = {
        parse,
        ...that.fatalErrors(),
      };
    } else {
      this.response = { parse };
    }
    return this.response;
  }

  private runParser(
    source: string,
    sourceURL: string,
    messages: MessageLogger,
    parseRule: string
  ): MalloyParseRoot {
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
      // TODO put the real version here
      malloyVersion: "?.?.?-????",
    };
  }
}

class ImportsAndTablesStep implements TranslationStep {
  private alreadyLooked = false;
  constructor(readonly parseStep: ParseStep) {}

  step(that: MalloyTranslation): DataRequestResponse | ParseResponse {
    const parseReq = this.parseStep.step(that);
    if (parseReq.parse == undefined) {
      return parseReq;
    }

    if (!this.alreadyLooked) {
      this.alreadyLooked = true;
      const parseRefs = findReferences(
        parseReq.parse.tokens,
        parseReq.parse.root
      );

      if (parseRefs?.tables) {
        for (const ref in parseRefs.tables) {
          that.root.schemaZone.reference(ref, parseRefs.tables[ref]);
        }
      }

      if (parseRefs?.urls) {
        for (const relativeRef in parseRefs.urls) {
          const firstRef = parseRefs.urls[relativeRef];
          try {
            const ref = new URL(relativeRef, that.sourceURL).toString();
            that.addChild(ref);
            that.root.importZone.reference(ref, firstRef);
          } catch (err) {
            // This import spec is so bad the URL library threw up, this
            // may be impossible, because it will append any garbage
            // to the known good rootURL assuming it is relative
            that.root.logger.log({
              sourceURL: that.sourceURL,
              message: `Malformed URL '${relativeRef}'"`,
              ...firstRef,
            });
          }
        }
      }
    }

    if (that.root.logger.hasErrors()) {
      // Since we knew we parsed without errors, this would only be from
      // having a malformed URL on an import reference.
      return null;
    }

    let allMissing: DataRequestResponse = {};
    const missingTables = that.root.schemaZone.getUndefined();
    if (missingTables) {
      allMissing = { tables: missingTables };
    }

    const missingImports = that.root.importZone.getUndefined();
    if (missingImports) {
      allMissing = { ...allMissing, urls: missingImports };
    }

    if (isNeedResponse(allMissing)) {
      return allMissing;
    }

    for (const child of that.childTranslators.values()) {
      const kidNeeds = child.importsAndTablesStep.step(child);
      if (isNeedResponse(kidNeeds)) {
        return kidNeeds;
      }
    }

    return null;
  }
}

interface SQLExploreRef {
  ref?: ast.SQLSource;
  def?: ast.SQLStatement;
}

class ASTStep implements TranslationStep {
  response?: ASTResponse;
  private walked = false;
  constructor(readonly importStep: ImportsAndTablesStep) {}

  step(that: MalloyTranslation): ASTResponse {
    if (this.response) {
      return this.response;
    }

    const mustResolve = this.importStep.step(that);
    if (mustResolve) {
      return mustResolve;
    }
    const parseResponse = that.parseStep.response;
    // Errors in self or children will show up here ..
    if (that.root.logger.hasErrors()) {
      this.response = that.fatalErrors();
      return this.response;
    }

    const parse = parseResponse?.parse;
    if (!parse) {
      throw new Error(
        "TRANSLATOR INTERNAL ERROR: Translator parse response had no errors, but also no parser"
      );
    }
    const secondPass = new MalloyToAST(parse, that.root.logger);
    const newAst = secondPass.visit(parse.root);
    if (that.root.logger.hasErrors()) {
      this.response = that.fatalErrors();
      return this.response;
    }

    if (newAst.elementType === "unimplemented") {
      throw new Error("TRANSLATOR INTERNAL ERROR: Unimplemented AST node");
    }

    // I kind of think table refs should probably also be collected here
    // instead of in the parse step. Note to myself, do that someday.
    const sqlExplores: Record<string, SQLExploreRef> = {};
    if (!this.walked) {
      newAst.walk((walkedTo: ast.MalloyElement): void => {
        if (walkedTo instanceof ast.SQLSource) {
          if (!sqlExplores[walkedTo.refName]) {
            sqlExplores[walkedTo.refName] = {};
          }
          sqlExplores[walkedTo.refName].ref = walkedTo;
        } else if (walkedTo instanceof ast.SQLStatement && walkedTo.is) {
          if (!sqlExplores[walkedTo.is]) {
            sqlExplores[walkedTo.is] = {};
          }
          sqlExplores[walkedTo.is].def = walkedTo;
        } else if (walkedTo instanceof ast.Unimplemented) {
          walkedTo.log("INTERNAL COMPILER ERROR: Untranslated parse node");
        }
      });
      this.walked = true;
    }
    // If there is a partial ast ...
    if (that.root.logger.hasErrors()) {
      this.response = that.fatalErrors();
      return this.response;
    }

    // Make sure there is a request/reference for all explored-sql entities
    const sqlZone = that.root.sqlQueryZone;
    for (const sqlExploreRef in sqlExplores) {
      const sqlExplore = sqlExplores[sqlExploreRef];
      if (sqlExplore.ref && sqlExplore.def) {
        that.root.sqlQueryZone.referenceBlock(
          sqlExplore.def,
          sqlExplore.def.location.range
        );
      }
    }

    // TODO report errors from here!
    const missingSqlStructs = sqlZone.getUndefinedBlocks();
    if (missingSqlStructs) {
      return { sqlStructs: missingSqlStructs };
    }

    newAst.setTranslator(that);
    this.response = {
      ...that.errors(), // these errors will by definition all be warnings
      ast: newAst,
      final: true,
    };
    return this.response;
  }
}

class MetadataStep implements TranslationStep {
  response?: MetadataResponse;
  constructor(readonly parseStep: ParseStep) {}

  step(that: MalloyTranslation): MetadataResponse {
    if (!this.response) {
      const tryParse = this.parseStep.step(that);
      if (!tryParse.parse) {
        return tryParse;
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
        this.response = {
          symbols,
          highlights: sortHighlights([
            ...passForHighlights(tryParse.parse.tokens),
            ...walkHighlights,
          ]),
          final: true,
        };
      }
    }
    return this.response;
  }
}

class CompletionsStep implements TranslationStep {
  constructor(readonly parseStep: ParseStep) {}

  step(
    that: MalloyTranslation,
    position?: { line: number; character: number }
  ): CompletionsResponse {
    const tryParse = this.parseStep.step(that);
    if (!tryParse.parse) {
      return tryParse;
    } else {
      let completions: DocumentCompletion[] = [];
      if (position !== undefined) {
        try {
          completions = walkForDocumentCompletions(
            tryParse.parse.tokens,
            tryParse.parse.root,
            position
          );
        } catch {
          /* Do nothing */
        }
      }
      return {
        ...tryParse,
        completions,
      };
    }
  }
}

class TranslateStep implements TranslationStep {
  response?: TranslateResponse;
  constructor(readonly astStep: ASTStep) {}

  step(that: MalloyTranslation, extendingModel?: ModelDef): TranslateResponse {
    if (this.response) {
      return this.response;
    }

    const astResponse = this.astStep.step(that);
    if (isNeedResponse(astResponse)) {
      return astResponse;
    }
    if (!astResponse.ast) {
      this.response = astResponse;
      return this.response;
    }

    if (that.grammarRule === "malloyDocument") {
      if (astResponse.ast instanceof ast.Document) {
        const doc = astResponse.ast;
        that.modelDef = doc.getModelDef(extendingModel);
        that.queryList = doc.queryList;
        that.sqlBlocks = doc.sqlBlocks;
      } else {
        that.root.logger.log({
          sourceURL: that.sourceURL,
          message: `'${that.sourceURL}' did not parse to malloy document`,
        });
      }
    }

    if (that.root.logger.hasErrors()) {
      this.response = that.fatalErrors();
    } else {
      this.response = {
        translated: {
          modelDef: that.modelDef,
          queryList: that.queryList,
          sqlBlocks: that.sqlBlocks,
        },
        ...that.errors(),
        final: true,
      };
    }
    return this.response;
  }
}

export abstract class MalloyTranslation {
  abstract root: MalloyTranslator;
  childTranslators: Map<string, MalloyTranslation>;
  urlIsFullPath?: boolean;
  queryList: Query[] = [];
  sqlBlocks: SQLBlock[] = [];
  modelDef: ModelDef;

  readonly parseStep: ParseStep;
  readonly importsAndTablesStep: ImportsAndTablesStep;
  readonly astStep: ASTStep;
  readonly metadataStep: MetadataStep;
  readonly completionsStep: CompletionsStep;
  readonly translateStep: TranslateStep;

  readonly references: ReferenceList;

  constructor(
    readonly sourceURL: string,
    public grammarRule = "malloyDocument"
  ) {
    this.childTranslators = new Map<string, MalloyTranslation>();
    this.modelDef = {
      name: sourceURL,
      exports: [],
      contents: {},
    };
    /**
     * This is sort of the makefile for the translation, all the steps
     * and the dependencies of the steps are declared here. Then when
     * a translator method is called which needs the result of a step,
     * it asks the step what it needs to complete, and all the right
     * things will happen automatically.
     */
    this.parseStep = new ParseStep();
    this.metadataStep = new MetadataStep(this.parseStep);
    this.completionsStep = new CompletionsStep(this.parseStep);
    this.importsAndTablesStep = new ImportsAndTablesStep(this.parseStep);
    this.astStep = new ASTStep(this.importsAndTablesStep);
    this.translateStep = new TranslateStep(this.astStep);
    this.references = new ReferenceList(sourceURL);
  }

  addChild(url: string): void {
    if (!this.childTranslators.get(url)) {
      this.childTranslators.set(url, new MalloyChildTranslator(url, this.root));
    }
  }

  addReference(reference: DocumentReference): void {
    this.references.add(reference);
  }

  referenceAt(
    // url: string,
    position: DocumentPosition
  ): DocumentReference | undefined {
    return this.references.find(position);
  }

  fatalErrors(): FatalResponse {
    return {
      final: true,
      errors: [...this.root.logger.getLog()],
    };
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

  translate(extendingModel?: ModelDef): TranslateResponse {
    return this.translateStep.step(this, extendingModel);
  }

  metadata(): MetadataResponse {
    return this.metadataStep.step(this);
  }

  completions(position: {
    line: number;
    character: number;
  }): CompletionsResponse {
    return this.completionsStep.step(this, position);
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
 * is returned. If you get a response with "final:true", there is
 * no need to call again, the translation is finished or error'd.
 */
export class MalloyTranslator extends MalloyTranslation {
  schemaZone = new Zone<StructDef>();
  importZone = new Zone<string>();
  sqlQueryZone = new SQLExploreZone();
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
    this.sqlQueryZone.updateFrom(dd.sqlStructs, dd.errors?.sqlStructs);
  }
}

interface ErrorData {
  tables: Record<string, string>;
  urls: Record<string, string>;
  sqlStructs: Record<string, string>;
}

export interface URLData {
  urls: ZoneData<string>;
}
export interface SchemaData {
  tables: ZoneData<StructDef>;
}
export interface SQLStructData {
  sqlStructs: ZoneData<StructDef>;
}
export interface UpdateData extends URLData, SchemaData, SQLStructData {
  errors: Partial<ErrorData>;
}
export type ParseUpdate = Partial<UpdateData>;
