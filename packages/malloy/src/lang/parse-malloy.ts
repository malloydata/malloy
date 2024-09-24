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

import {
  ANTLRErrorListener,
  CharStreams,
  CommonTokenStream,
  ParserRuleContext,
  Token,
} from 'antlr4ts';
import {ParseTree} from 'antlr4ts/tree';
import {
  DocumentLocation,
  DocumentPosition,
  DocumentRange,
  DocumentReference,
  ImportLocation,
  ModelDef,
  NamedModelObject,
  Query,
  SQLBlockStructDef,
  StructDef,
} from '../model/malloy_types';
import {MalloyLexer} from './lib/Malloy/MalloyLexer';
import {MalloyParser} from './lib/Malloy/MalloyParser';
import * as ast from './ast';
import {MalloyToAST} from './malloy-to-ast';
import {
  BaseMessageLogger,
  LogMessage,
  LogMessageOptions,
  MessageCode,
  MessageLogger,
  MessageParameterType,
  makeLogMessage,
} from './parse-log';
import {
  findReferences,
  FindReferencesData,
} from './parse-tree-walkers/find-external-references';
import {Zone, ZoneData} from './zone';
import {walkForDocumentSymbols} from './parse-tree-walkers/document-symbol-walker';
import {
  DocumentCompletion,
  walkForDocumentCompletions,
} from './parse-tree-walkers/document-completion-walker';
import {
  DocumentHelpContext,
  walkForDocumentHelpContext,
} from './parse-tree-walkers/document-help-context-walker';
import {ReferenceList} from './reference-list';
import {
  ASTResponse,
  CompletionsResponse,
  DataRequestResponse,
  ProblemResponse,
  FatalResponse,
  FinalResponse,
  HelpContextResponse,
  MetadataResponse,
  ModelDataRequest,
  NeedURLData,
  TranslateResponse,
  isNeedResponse,
  ModelAnnotationResponse,
  TablePathResponse,
} from './translate-response';
import {locationContainsPosition} from './utils';
import {Tag} from '../tags';
import {MalloyParseInfo} from './malloy-parse-info';
import {walkForModelAnnotation} from './parse-tree-walkers/model-annotation-walker';
import {walkForTablePath} from './parse-tree-walkers/find-table-path-walker';

export type StepResponses =
  | DataRequestResponse
  | ASTResponse
  | TranslateResponse
  | ParseResponse
  | MetadataResponse;

/**
 * This ignores a -> popMode when the mode stack is empty, which is a hack,
 * but it let's us parse }%
 */
class HandlesOverpoppingLexer extends MalloyLexer {
  popMode(): number {
    if (this._modeStack.isEmpty) {
      return this._mode;
    }
    return super.popMode();
  }
}

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

interface ParseData extends ProblemResponse, NeedURLData, FinalResponse {
  parse: MalloyParseInfo;
}
export type ParseResponse = Partial<ParseData>;

/**
 * ParseStep -- Parse the source URL
 */
interface SourceInfo {
  lines: string[];
  at: {begin: number; end: number}[];
  length: number;
}
class ParseStep implements TranslationStep {
  response?: ParseResponse;
  sourceInfo?: SourceInfo;

  step(that: MalloyTranslation): ParseResponse {
    if (this.response) {
      return this.response;
    }

    if (that.urlIsFullPath === undefined) {
      try {
        const _checkFull = new URL(that.sourceURL);
        that.urlIsFullPath = true;
      } catch (e) {
        const msg = e instanceof Error ? e.message : '';
        that.urlIsFullPath = false;
        that.root.logError(
          'failed-to-compute-absolute-import-url',
          `Could not compute full path URL: ${msg}`
        );
      }
    }
    if (!that.urlIsFullPath) {
      return that.fatalResponse();
    }

    const srcEnt = that.root.importZone.getEntry(that.sourceURL);
    if (srcEnt.status !== 'present') {
      if (srcEnt.status === 'error') {
        const at = srcEnt.firstReference || that.defaultLocation();
        that.root.logError(
          'import-error',
          {
            message: srcEnt.message,
            url: that.sourceURL,
          },
          {at}
        );
        this.response = that.fatalResponse();
        return this.response;
      }
      return {urls: [that.sourceURL]};
    }
    const source = srcEnt.value === '' ? '\n' : srcEnt.value;
    this.sourceInfo = this.getSourceInfo(source);

    let parse: MalloyParseInfo | undefined;
    try {
      parse = this.runParser(source, that);
    } catch (parseException) {
      that.root.logError('parse-exception', {message: parseException.message});
      parse = undefined;
    }

    if (that.root.logger.hasErrors()) {
      this.response = {
        parse,
        ...that.fatalResponse(),
      };
    } else {
      this.response = {parse};
    }
    return this.response;
  }

  /**
   * Split the source up into lines so we can correctly compute offset
   * to the line/char positions favored by LSP and VSCode.
   */
  private getSourceInfo(code: string): SourceInfo {
    const eolRegex = /\r?\n/;
    const info: SourceInfo = {
      at: [],
      lines: [],
      length: code.length,
    };
    let src = code;
    let lineStart = 0;
    while (src !== '') {
      const eol = src.match(eolRegex);
      if (eol && eol.index !== undefined) {
        // line text DOES NOT include the EOL
        info.lines.push(src.slice(0, eol.index));
        const lineLength = eol.index + eol[0].length;
        info.at.push({
          begin: lineStart,
          end: lineStart + lineLength,
        });
        lineStart += lineLength;
        src = src.slice(lineLength);
      } else {
        // last line, does not have a line end
        info.lines.push(src);
        info.at.push({begin: lineStart, end: lineStart + src.length});
        break;
      }
    }
    return info;
  }

  private runParser(source: string, that: MalloyTranslation): MalloyParseInfo {
    const inputStream = CharStreams.fromString(source);
    const lexer = new HandlesOverpoppingLexer(inputStream);
    const tokenStream = new CommonTokenStream(lexer);
    const malloyParser = new MalloyParser(tokenStream);
    malloyParser.removeErrorListeners();
    malloyParser.addErrorListener(
      new MalloyParserErrorHandler(that, that.root.logger)
    );

    // Admitted code smell here, testing likes to parse from an arbitrary
    // node and this is the simplest way to allow that.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parseFunc = (malloyParser as any)[that.grammarRule];
    if (!parseFunc) {
      throw new Error(`No such parse rule as ${that.grammarRule}`);
    }

    return {
      root: parseFunc.call(malloyParser) as ParseTree,
      tokenStream: tokenStream,
      sourceStream: inputStream,
      sourceURL: that.sourceURL,
      importBaseURL: that.importBaseURL || that.sourceURL,
      rangeFromContext: cx => that.rangeFromContext(cx),
      // TODO some way to not forget to update this
      malloyVersion: '4.0.0',
    };
  }
}

class ImportsAndTablesStep implements TranslationStep {
  private parseReferences: FindReferencesData | undefined = undefined;
  constructor(readonly parseStep: ParseStep) {}

  step(that: MalloyTranslation): DataRequestResponse | ParseResponse {
    const parseReq = this.parseStep.step(that);
    if (parseReq.parse === undefined) {
      return parseReq;
    }

    if (!this.parseReferences) {
      this.parseReferences = findReferences(
        that,
        parseReq.parse.tokenStream,
        parseReq.parse.root
      );

      for (const ref in this.parseReferences.tables) {
        that.root.schemaZone.reference(ref, {
          url: that.sourceURL,
          range: this.parseReferences.tables[ref].firstReference,
        });
      }

      for (const relativeRef in this.parseReferences.urls) {
        const firstRef = this.parseReferences.urls[relativeRef];
        try {
          const ref = decodeURI(
            new URL(
              relativeRef,
              that.importBaseURL || that.sourceURL
            ).toString()
          );
          that.addChild(ref);
          that.imports.push({
            importURL: ref,
            location: {url: that.sourceURL, range: firstRef},
          });
          that.root.importZone.reference(ref, {
            url: that.sourceURL,
            range: firstRef,
          });
        } catch (err) {
          // This import spec is so bad the URL library threw up, this
          // may be impossible, because it will append any garbage
          // to the known good rootURL assuming it is relative
          that.root.logError(
            'invalid-import-url',
            `Malformed URL '${relativeRef}'"`,
            {at: {url: that.sourceURL, range: firstRef}}
          );
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
      const tables = {};
      for (const key of missingTables) {
        const info = this.parseReferences.tables[key];
        tables[key] = {
          connectionName: info.connectionName,
          tablePath: info.tablePath,
        };
      }
      allMissing = {tables};
    }

    const missingImports = that.root.importZone.getUndefined();
    if (missingImports) {
      allMissing = {...allMissing, urls: missingImports};
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
      this.response = that.fatalResponse();
      return this.response;
    }

    const parse = parseResponse?.parse;
    if (!parse) {
      throw new Error(
        'TRANSLATOR INTERNAL ERROR: Translator parse response had no errors, but also no parser'
      );
    }
    const secondPass = new MalloyToAST(
      parse,
      that.root.logger,
      that.compilerFlags
    );
    const newAst = secondPass.visit(parse.root);
    that.compilerFlags = secondPass.compilerFlags;

    if (newAst.elementType === 'unimplemented') {
      newAst.logError(
        'untranslated-parse-node',
        'INTERNAL COMPILER ERROR: Untranslated parse node'
      );
    }

    if (!this.walked) {
      // The DocumentStatement.needs method has largely replaced the need to walk
      // the AST once it has been translated, this one check remains, though
      // it should probably never be hit
      for (const walkedTo of newAst.walk()) {
        if (walkedTo instanceof ast.Unimplemented) {
          walkedTo.logError(
            'untranslated-parse-node',
            'INTERNAL COMPILER ERROR: Untranslated parse node'
          );
        }
      }
      this.walked = true;
    }

    if (that.root.logger.hasErrors()) {
      this.response = that.fatalResponse();
      return this.response;
    }

    // Now make sure that every child has fully translated itself
    // before this tree is ready to also translate ...
    for (const child of that.childTranslators.values()) {
      const kidNeeds = child.astStep.step(child);
      if (isNeedResponse(kidNeeds)) {
        return kidNeeds;
      }
    }

    newAst.setTranslator(that);
    this.response = {
      ...that.problemResponse(), // these problems will by definition all be warnings
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
            that,
            tryParse.parse.tokenStream,
            tryParse.parse.root
          );
        } catch {
          // Do nothing, symbols already `undefined`
        }
        this.response = {
          symbols,
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
    position?: {line: number; character: number}
  ): CompletionsResponse {
    const tryParse = this.parseStep.step(that);
    if (!tryParse.parse) {
      return tryParse;
    } else {
      let completions: DocumentCompletion[] = [];
      if (position !== undefined) {
        try {
          completions = walkForDocumentCompletions(
            tryParse.parse.tokenStream,
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

class HelpContextStep implements TranslationStep {
  constructor(readonly parseStep: ParseStep) {}

  step(
    that: MalloyTranslation,
    position?: {line: number; character: number}
  ): HelpContextResponse {
    const tryParse = this.parseStep.step(that);
    if (!tryParse.parse) {
      return tryParse;
    } else {
      let helpContext: DocumentHelpContext | undefined;
      if (position !== undefined) {
        try {
          helpContext = walkForDocumentHelpContext(
            tryParse.parse.root,
            position
          );
        } catch {
          /* Do nothing */
        }
      }
      return {
        ...tryParse,
        helpContext,
      };
    }
  }
}

class ModelAnnotationStep implements TranslationStep {
  response?: ModelAnnotationResponse;
  constructor(readonly parseStep: ParseStep) {}

  step(
    that: MalloyTranslation,
    extendingModel?: ModelDef
  ): ModelAnnotationResponse {
    if (!this.response) {
      const tryParse = this.parseStep.step(that);
      if (!tryParse.parse || tryParse.final) {
        return tryParse;
      } else {
        const modelAnnotation = walkForModelAnnotation(
          that,
          tryParse.parse.tokenStream,
          tryParse.parse
        );
        this.response = {
          modelAnnotation: {
            ...modelAnnotation,
            inherits: extendingModel?.annotation,
          },
        };
      }
    }
    return this.response;
  }
}

class TablePathInfoStep implements TranslationStep {
  response?: TablePathResponse;
  constructor(readonly parseStep: ParseStep) {}

  step(that: MalloyTranslation): TablePathResponse {
    if (!this.response) {
      const tryParse = this.parseStep.step(that);
      if (!tryParse.parse) {
        return tryParse;
      } else {
        const tablePath = walkForTablePath(
          that,
          tryParse.parse.tokenStream,
          tryParse.parse
        );
        this.response = {
          pathInfo: tablePath,
        };
      }
    }
    return this.response;
  }
}

class TranslateStep implements TranslationStep {
  response?: TranslateResponse;
  importedAnnotations = false;
  constructor(readonly astStep: ASTStep) {}

  step(that: MalloyTranslation, extendingModel?: ModelDef): TranslateResponse {
    if (this.response) {
      return this.response;
    }

    // begin with the compiler flags of the model we are extending
    if (extendingModel && !this.importedAnnotations) {
      const tagParse = Tag.annotationToTag(extendingModel.annotation, {
        prefix: /^##! /,
      });
      that.compilerFlags = tagParse.tag;
      this.importedAnnotations = true;
    }

    const astResponse = this.astStep.step(that);
    if (isNeedResponse(astResponse)) {
      return astResponse;
    }
    if (!astResponse.ast) {
      this.response = astResponse;
      return this.response;
    }

    if (that.grammarRule === 'malloyDocument') {
      if (astResponse.ast instanceof ast.Document) {
        const doc = astResponse.ast;
        doc.initModelDef(extendingModel);
        for (;;) {
          const docCompile = doc.compile();
          if (docCompile.needs) {
            return docCompile.needs;
          } else {
            that.modelDef = docCompile.modelDef;
            that.queryList = docCompile.queryList;
            that.sqlBlocks = docCompile.sqlBlocks;
            break;
          }
        }
      } else {
        that.root.logError(
          'parsed-non-malloy-document',
          {url: that.sourceURL},
          {at: that.defaultLocation()}
        );
      }
    }

    if (that.root.logger.hasErrors()) {
      this.response = {
        fromSources: that.getDependencies(),
        ...that.fatalResponse(),
      };
    } else {
      this.response = {
        translated: {
          modelDef: that.modelDef,
          queryList: that.queryList,
          sqlBlocks: that.sqlBlocks,
        },
        fromSources: that.getDependencies(),
        ...that.problemResponse(),
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
  sqlBlocks: SQLBlockStructDef[] = [];
  modelDef: ModelDef;
  imports: ImportLocation[] = [];
  compilerFlags = new Tag();

  readonly parseStep: ParseStep;
  readonly modelAnnotationStep: ModelAnnotationStep;
  readonly importsAndTablesStep: ImportsAndTablesStep;
  readonly astStep: ASTStep;
  readonly metadataStep: MetadataStep;
  readonly completionsStep: CompletionsStep;
  readonly helpContextStep: HelpContextStep;
  readonly tablePathInfoStep: TablePathInfoStep;
  readonly translateStep: TranslateStep;

  readonly references: ReferenceList;

  constructor(
    readonly sourceURL: string,
    readonly importBaseURL: string | null = null,
    public grammarRule = 'malloyDocument'
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
    this.modelAnnotationStep = new ModelAnnotationStep(this.parseStep);
    this.metadataStep = new MetadataStep(this.parseStep);
    this.completionsStep = new CompletionsStep(this.parseStep);
    this.helpContextStep = new HelpContextStep(this.parseStep);
    this.importsAndTablesStep = new ImportsAndTablesStep(this.parseStep);
    this.astStep = new ASTStep(this.importsAndTablesStep);
    this.tablePathInfoStep = new TablePathInfoStep(this.parseStep);
    this.translateStep = new TranslateStep(this.astStep);
    this.references = new ReferenceList(sourceURL);
  }

  addChild(url: string): void {
    if (!this.childTranslators.get(url)) {
      this.childTranslators.set(url, new MalloyChildTranslator(url, this.root));
    }
  }

  getDependencies(): string[] {
    const dependencies = [this.sourceURL];
    for (const [_childURL, child] of this.childTranslators) {
      dependencies.push(...child.getDependencies());
    }
    return dependencies;
  }

  addReference(reference: DocumentReference): void {
    this.references.add(reference);
  }

  referenceAt(position: DocumentPosition): DocumentReference | undefined {
    return this.references.find(position);
  }

  /**
   * This returns a *final* response containing all problems, for when there are
   * errors and the translation needs to stop and report errors. When doing so,
   * it also reports warnings.
   */
  fatalResponse(): FatalResponse {
    return {
      final: true,
      ...this.problemResponse(),
    };
  }

  /**
   * The problem log can grow as progressively deeper questions are asked.
   * When returning "problems so far", make a snapshot.
   */
  problemResponse(): ProblemResponse {
    return {problems: this.problems()};
  }

  problems(): LogMessage[] {
    return [...this.root.logger.getLog()];
  }

  getLineMap(url: string): string[] | undefined {
    if (url === this.sourceURL) {
      return this.parseStep.sourceInfo?.lines;
    }
    const theChild = this.childTranslators.get(url);
    if (theChild) {
      return theChild.parseStep.sourceInfo?.lines;
    }
  }

  codeAtLocation(location: DocumentLocation) {
    const lines = this.getLineMap(location.url) || [];
    if (location.range.start.line === location.range.end.line) {
      return lines[location.range.start.line].slice(
        location.range.start.character,
        location.range.end.character
      );
    }
    let result = '';
    result += lines[location.range.start.line].slice(
      location.range.start.character
    );
    for (
      let lineNumber = location.range.start.line + 1;
      lineNumber < location.range.end.line;
      lineNumber++
    ) {
      result += lines[lineNumber];
    }
    result += lines[location.range.end.line].slice(
      0,
      location.range.end.character
    );
    return result;
  }

  prettyErrors(): string {
    let lovely = '';
    let inFile = '';
    for (const entry of this.root.logger.getLog()) {
      let cooked = entry.message;
      let errorURL = this.sourceURL;
      if (entry.at) {
        errorURL = entry.at.url;
        const lineNo = entry.at.range.start.line;
        const charFrom = entry.at.range.start.character;
        const lines = this.getLineMap(entry.at.url);
        if (lines) {
          const errorLine = lines[lineNo];
          cooked = `line ${lineNo + 1}: ${entry.message}\n  | ${errorLine}`;
          if (charFrom > 0) {
            cooked = cooked + `\n  | ${' '.repeat(charFrom)}^`;
          }
        } else {
          cooked = `line ${lineNo + 1}: char ${charFrom}: ${entry.message}`;
        }
      }
      if (inFile !== errorURL) {
        cooked = `FILE: ${errorURL}\n` + cooked;
        inFile = errorURL;
      }
      if (lovely !== '') {
        lovely = `${lovely}\n${cooked}`;
      } else {
        lovely = cooked;
      }
    }
    return lovely;
  }

  childRequest(importURL: string): ModelDataRequest {
    const childURL = decodeURI(new URL(importURL, this.sourceURL).toString());
    const ret = this.childTranslators.get(childURL)?.translate();
    if (ret?.compileSQL) {
      return {
        compileSQL: ret.compileSQL,
        partialModel: ret.partialModel,
      };
    }
  }

  getChildExports(importURL: string): Record<string, NamedModelObject> {
    const exports: Record<string, NamedModelObject> = {};
    const childURL = decodeURI(new URL(importURL, this.sourceURL).toString());
    const child = this.childTranslators.get(childURL);
    if (child) {
      const did = child.translate();
      if (did.translated) {
        for (const fromChild of child.modelDef.exports) {
          const modelEntry = child.modelDef.contents[fromChild];
          if (modelEntry.type === 'struct' || modelEntry.type === 'query') {
            exports[fromChild] = modelEntry;
          }
        }
      }
      // else nothing, assuming there are already errors in the log
    }
    return exports;
  }

  private finalAnswer?: TranslateResponse;
  translate(extendingModel?: ModelDef): TranslateResponse {
    if (this.finalAnswer) {
      return this.finalAnswer;
    }
    const attempt = this.translateStep.step(this, extendingModel);
    if (attempt.final) {
      this.finalAnswer = attempt;
    }
    return attempt;
  }

  importAt(position: DocumentPosition): ImportLocation | undefined {
    // Here we assume that imports DO NOT overlap. And then we do a linear
    // search to find the one we're looking for.
    for (let index = 0; index < this.imports.length; index++) {
      const imp = this.imports[index];
      if (locationContainsPosition(imp.location, position)) {
        return imp;
      }
    }
    return undefined;
  }

  metadata(): MetadataResponse {
    return this.metadataStep.step(this);
  }

  modelAnnotation(extendingModel?: ModelDef): ModelAnnotationResponse {
    return this.modelAnnotationStep.step(this, extendingModel);
  }

  tablePathInfo(): TablePathResponse {
    return this.tablePathInfoStep.step(this);
  }

  completions(position: {
    line: number;
    character: number;
  }): CompletionsResponse {
    return this.completionsStep.step(this, position);
  }

  helpContext(position: {
    line: number;
    character: number;
  }): HelpContextResponse {
    return this.helpContextStep.step(this, position);
  }

  defaultLocation(): DocumentLocation {
    return {
      url: this.sourceURL,
      range: {
        start: {line: 0, character: 0},
        end: {line: 0, character: 0},
      },
    };
  }

  rangeFromContext(pcx: ParserRuleContext): DocumentRange {
    return this.rangeFromTokens(pcx.start, pcx.stop || pcx.start);
  }

  rangeFromTokens(startToken: Token, stopToken: Token): DocumentRange {
    const start = {
      line: startToken.line - 1,
      character: startToken.charPositionInLine,
    };
    if (this.parseStep.sourceInfo && stopToken.stopIndex !== -1) {
      // Find the line which contains the stopIndex
      const lastLine = this.parseStep.sourceInfo.lines.length - 1;
      for (let lineNo = startToken.line - 1; lineNo <= lastLine; lineNo++) {
        const at = this.parseStep.sourceInfo.at[lineNo];
        if (stopToken.stopIndex >= at.begin && stopToken.stopIndex <= at.end) {
          return {
            start,
            end: {
              line: lineNo,
              character: stopToken.stopIndex - at.begin + 1,
            },
          };
        }
      }
      // Should be impossible to get here, but if we do ... return the last
      // character of the last line of the file
      return {
        start,
        end: {
          line: lastLine,
          character: this.parseStep.sourceInfo.lines[lastLine].length,
        },
      };
    }
    return {start, end: start};
  }

  rangeFromToken(token: Token): DocumentRange {
    return this.rangeFromTokens(token, token);
  }

  /*
   Experimental dialect support, not confident this is how this should work.

   To prevent cascading errors, each translator will only warn once about use of an experimental dialect.

   To enable tests to run without having to enabled experimental dialects, there is a hook here for
   the owner of a Translator object to decide if we check the experimental flag.

   Not sure where the logic for this needs to go, this is just my first guess
   */

  private dialectAlreadyChecked: Record<string, boolean> = {};
  firstReferenceToDialect(dialect: string): boolean {
    if (this.dialectAlreadyChecked[dialect]) {
      return false;
    }
    this.dialectAlreadyChecked[dialect] = true;
    return true;
  }

  allDialectsEnabled = false;
  experimentalDialectEnabled(dialect: string): boolean {
    if (this.allDialectsEnabled) {
      return true;
    }
    const experimental = this.compilerFlags.tag('experimental');
    return (
      experimental !== undefined &&
      (experimental.bare() || experimental.has('dialect', dialect))
    );
  }
}

export class MalloyChildTranslator extends MalloyTranslation {
  constructor(
    rootURL: string,
    readonly root: MalloyTranslator
  ) {
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
  sqlQueryZone = new Zone<SQLBlockStructDef>();
  logger = new BaseMessageLogger();
  readonly root: MalloyTranslator;
  constructor(
    rootURL: string,
    importURL: string | null = null,
    preload: ParseUpdate | null = null
  ) {
    super(rootURL, importURL);
    this.root = this;
    if (preload) {
      this.update(preload);
    }
  }

  update(dd: ParseUpdate): void {
    this.schemaZone.updateFrom(dd.tables, dd.errors?.tables);
    this.importZone.updateFrom(dd.urls, dd.errors?.urls);
    this.sqlQueryZone.updateFrom(dd.compileSQL, dd.errors?.compileSQL);
  }

  logError<T extends MessageCode>(
    code: T,
    parameters: MessageParameterType<T>,
    options?: Omit<LogMessageOptions, 'severity'>
  ): T {
    this.logger.log(
      makeLogMessage(code, parameters, {severity: 'error', ...options})
    );
    return code;
  }
}

interface ErrorData {
  tables: Record<string, string>;
  urls: Record<string, string>;
  compileSQL: Record<string, string>;
}

export interface URLData {
  urls: ZoneData<string>;
}
export interface SchemaData {
  tables: ZoneData<StructDef>;
}
export interface SQLBlockData {
  compileSQL: ZoneData<SQLBlockStructDef>;
}
export interface UpdateData extends URLData, SchemaData, SQLBlockData {
  errors: Partial<ErrorData>;
}
export type ParseUpdate = Partial<UpdateData>;

export class MalloyParserErrorHandler implements ANTLRErrorListener<Token> {
  constructor(
    readonly translator: MalloyTranslation,
    readonly messages: MessageLogger
  ) {}

  logError<T extends MessageCode>(
    code: T,
    parameters: MessageParameterType<T>,
    options?: Omit<LogMessageOptions, 'severity'>
  ): T {
    this.messages.log(
      makeLogMessage(code, parameters, {severity: 'error', ...options})
    );
    return code;
  }

  syntaxError(
    recognizer: unknown,
    offendingSymbol: Token | undefined,
    line: number,
    charPositionInLine: number,
    message: string,
    _e: unknown
  ): void {
    const errAt = {line: line - 1, character: charPositionInLine};
    const range = offendingSymbol
      ? this.translator.rangeFromToken(offendingSymbol)
      : {start: errAt, end: errAt};
    this.logError(
      'syntax-error',
      {message},
      {
        at: {url: this.translator.sourceURL, range},
      }
    );
  }
}
