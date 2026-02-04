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

import type {
  DocumentLocation,
  DocumentPosition,
  DocumentReference,
  ImportLocation,
  ModelDef,
  SourceDef,
  SQLSourceDef,
  DependencyTree,
  DocumentRange,
} from '../model/malloy_types';
import {mkModelDef} from '../model/utils';
import * as ast from './ast';
import {MalloyToAST} from './malloy-to-ast';
import type {
  LogMessage,
  LogMessageOptions,
  MessageCode,
  MessageParameterType,
} from './parse-log';
import {BaseMessageLogger, makeLogMessage} from './parse-log';
import type {FindReferencesData} from './parse-tree-walkers/find-external-references';
import {findReferences} from './parse-tree-walkers/find-external-references';
import type {ZoneData} from './zone';
import {Zone} from './zone';
import {walkForDocumentSymbols} from './parse-tree-walkers/document-symbol-walker';
import type {DocumentCompletion} from './parse-tree-walkers/document-completion-walker';
import {walkForDocumentCompletions} from './parse-tree-walkers/document-completion-walker';
import type {DocumentHelpContext} from './parse-tree-walkers/document-help-context-walker';
import {walkForDocumentHelpContext} from './parse-tree-walkers/document-help-context-walker';
import {ReferenceList} from './reference-list';
import type {
  ResponseBase,
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
  ModelAnnotationResponse,
  TablePathResponse,
} from './translate-response';
import {isNeedResponse} from './translate-response';
import {
  getSourceInfo,
  locationContainsPosition,
  rangeFromContext,
} from './utils';
import {Tag} from '@malloydata/malloy-tag';
import type {MalloyParseInfo} from './malloy-parse-info';
import {walkForModelAnnotation} from './parse-tree-walkers/model-annotation-walker';
import {walkForTablePath} from './parse-tree-walkers/find-table-path-walker';
import type {EventStream} from '../runtime_types';
import {annotationToTag} from '../annotation';
import {runMalloyParser} from './run-malloy-parser';
import type {ParserRuleContext} from 'antlr4ts';
import {Timer} from '../timing';

export type StepResponses =
  | DataRequestResponse
  | ASTResponse
  | TranslateResponse
  | ParseResponse
  | MetadataResponse
  | PretranslatedResponse;

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

interface ParseData
  extends ResponseBase,
    ProblemResponse,
    NeedURLData,
    FinalResponse {
  parse: MalloyParseInfo;
}

export type ParseResponse = Partial<ParseData>;

interface PretranslatedData {
  translation: ModelDef;
}

export type PretranslatedResponse = PretranslatedData | null;

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
    const stepTimer = new Timer('parse_step');
    if (this.response) {
      return this.response;
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
    const parseModelTimer = new Timer('parse_malloy');
    const source = srcEnt.value === '' ? '\n' : srcEnt.value;
    this.sourceInfo = getSourceInfo(source);

    let parse: MalloyParseInfo | undefined;
    try {
      parse = this.runParser(source, this.sourceInfo, that);
    } catch (parseException) {
      that.root.logError('parse-exception', {message: parseException.message});
      parse = undefined;
    }

    stepTimer.contribute([parseModelTimer.stop()]);

    if (that.root.logger.hasErrors()) {
      this.response = {
        parse,
        ...that.fatalResponse(),
      };
    } else {
      this.response = {parse};
    }
    return {...this.response, timingInfo: stepTimer.stop()};
  }

  private runParser(
    source: string,
    sourceInfo: SourceInfo,
    that: MalloyTranslation
  ): MalloyParseInfo {
    const parse = runMalloyParser(
      source,
      that.sourceURL,
      sourceInfo,
      that.root.logger,
      that.grammarRule
    );

    return {
      ...parse,
      importBaseURL: that.importBaseURL || that.sourceURL,
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
      return {timingInfo: parseReq.timingInfo};
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

    const missingImports = (that.root.importZone.getUndefined() ?? []).filter(
      url => that.root.pretranslatedModels.get(url) === undefined
    );
    if (missingImports.length > 0) {
      allMissing = {
        ...allMissing,
        urls: missingImports,
      };
    }

    if (isNeedResponse(allMissing)) {
      return {...allMissing, timingInfo: parseReq.timingInfo};
    }

    for (const child of that.childTranslators.values()) {
      if (that.root.pretranslatedModels.get(child.sourceURL)) {
        continue;
      }
      const kidNeeds = child.importsAndTablesStep.step(child);
      if (isNeedResponse(kidNeeds)) {
        return kidNeeds;
      }
    }

    return {timingInfo: parseReq.timingInfo};
  }
}

class ASTStep implements TranslationStep {
  response?: ASTResponse;
  private walked = false;
  constructor(readonly importStep: ImportsAndTablesStep) {}

  step(that: MalloyTranslation): ASTResponse {
    const stepTimer = new Timer('ast_step');
    if (this.response) {
      return this.response;
    }

    const mustResolve = this.importStep.step(that);
    stepTimer.incorporate(mustResolve?.timingInfo);
    if (isNeedResponse(mustResolve)) {
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
    stepTimer.incorporate(parseResponse.timingInfo);
    const secondPass = new MalloyToAST(
      parse,
      that.root.logger,
      that.compilerFlags
    );
    const {ast: newAST, compilerFlags, timingInfo} = secondPass.run();
    stepTimer.contribute([timingInfo]);
    that.compilerFlags = compilerFlags;

    if (newAST.elementType === 'unimplemented') {
      newAST.logError(
        'untranslated-parse-node',
        'INTERNAL COMPILER ERROR: Untranslated parse node'
      );
    }

    if (!this.walked) {
      // The DocumentStatement.needs method has largely replaced the need to walk
      // the AST once it has been translated, this one check remains, though
      // it should probably never be hit
      for (const walkedTo of newAST.walk()) {
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
      if (that.root.pretranslatedModels.get(child.sourceURL)) {
        continue;
      }
      const kidNeeds = child.astStep.step(child);
      if (isNeedResponse(kidNeeds)) {
        return kidNeeds;
      }
    }

    newAST.setTranslator(that);
    this.response = {
      ...that.problemResponse(), // these problems will by definition all be warnings
      ast: newAST,
      final: true,
    };
    return {...this.response, timingInfo: stepTimer.stop()};
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
    const stepTimer = new Timer('translate_step');
    if (this.response) {
      return this.response;
    }

    const pretranslate = that.root.pretranslatedModels.get(that.sourceURL);
    if (pretranslate !== undefined) {
      that.modelDef = pretranslate;
      return {
        modelDef: pretranslate,
        final: true,
        fromSources: that.getDependencies(),
        modelWasModified: false,
      };
    }

    // begin with the compiler flags of the model we are extending
    if (extendingModel && !this.importedAnnotations) {
      const parseCompilerFlagsTimer = new Timer('parse_compiler_flags');
      const tagParse = annotationToTag(extendingModel.annotation, {
        prefix: /^##! /,
      });
      stepTimer.contribute([parseCompilerFlagsTimer.stop()]);
      that.compilerFlags = tagParse.tag;
      this.importedAnnotations = true;
    }

    const astResponse = this.astStep.step(that);
    stepTimer.incorporate(astResponse.timingInfo);
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
        const translateModelTimer = new Timer('compile_malloy');
        const docCompile = doc.compile();
        const translateTiming = translateModelTimer.stop();
        stepTimer.contribute([translateTiming]);
        if (docCompile.needs) {
          return {
            ...docCompile.needs,
            timingInfo: stepTimer.stop(),
          };
        } else {
          that.modelDef = docCompile.modelDef;
          that.modelWasModified = docCompile.modelWasModified;
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
        modelDef: {
          ...that.modelDef,
          dependencies: that.getDependencyTree(),
          references: that.references.toArray(),
          imports: [...that.imports],
        },
        fromSources: that.getDependencies(),
        modelWasModified: that.modelWasModified,
        ...that.problemResponse(),
        final: true,
      };
    }
    return {...this.response, timingInfo: stepTimer.stop()};
  }
}

export abstract class MalloyTranslation {
  abstract root: MalloyTranslator;
  childTranslators: Map<string, MalloyTranslation>;
  sqlSources: SQLSourceDef[] = [];
  modelDef: ModelDef;
  modelWasModified = false;
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
    this.modelDef = mkModelDef(sourceURL);
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

  _urlIsFullPath: boolean | undefined = undefined;
  get urlIsFullPath(): boolean {
    if (this._urlIsFullPath === undefined) {
      try {
        const _checkFull = new URL(this.sourceURL);
        this._urlIsFullPath = true;
      } catch (e) {
        const msg = e instanceof Error ? e.message : '';
        this._urlIsFullPath = false;
        this.root.logError(
          'failed-to-compute-absolute-import-url',
          `Could not compute full path URL: ${msg}`
        );
      }
    }
    return this._urlIsFullPath;
  }

  addChild(url: string): void {
    if (!this.childTranslators.get(url)) {
      this.childTranslators.set(url, new MalloyChildTranslator(url, this.root));
    }
  }

  getDependencies(): string[] {
    const dependencies = this.getDependencyTree();
    return [this.sourceURL, ...flattenDependencyTree(dependencies)];
  }

  getDependencyTree(): DependencyTree {
    const pretranslated = this.root.pretranslatedModels.get(this.sourceURL);
    if (pretranslated !== undefined) {
      return pretranslated.dependencies;
    }
    const dependencies: DependencyTree = {};
    for (const [_childURL, child] of this.childTranslators) {
      dependencies[_childURL] = child.getDependencyTree();
    }
    return dependencies;
  }

  newlyTranslatedDependencies(): {url: string; modelDef: ModelDef}[] {
    const pretranslated = this.root.pretranslatedModels.get(this.sourceURL);
    if (pretranslated !== undefined) {
      return [];
    }
    const newModels: {url: string; modelDef: ModelDef}[] = [];
    for (const [url, child] of this.childTranslators) {
      const pretranslated = this.root.pretranslatedModels.get(url);
      if (pretranslated !== undefined) {
        continue;
      }
      const result = child.translate();
      if (result.modelDef) {
        const modelDef = {
          ...result.modelDef,
          references: child.references.toArray(),
          imports: [...child.imports],
        };
        newModels.push({url, modelDef});
        newModels.push(...child.newlyTranslatedDependencies());
      }
    }
    return newModels;
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
      };
    }
  }

  importModelDef(importURL: string): ModelDef | undefined {
    const childURL = decodeURI(new URL(importURL, this.sourceURL).toString());
    const child = this.childTranslators.get(childURL);
    if (child) {
      const result = child.translate();
      return result.modelDef;
    }
    return undefined;
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

  translatorForDependency(url: string): MalloyTranslation | undefined {
    return this.childTranslators.get(url);
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
    return rangeFromContext(this.parseStep.sourceInfo, pcx);
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
 * The main interface to Malloy translation. It has a call pattern
 * similar to a server. Once a translator is instantiated
 * you can request translations repeatedly. Responses to that request
 * will either be "NeedResponse" or "TranslateResponse" objects. The
 * correct pattern is to call "translation" in a loop, calling
 * "update" in response to each "NeedResponse" until a "TranslateResponse"
 * is returned. If you get a response with "final:true", there is
 * no need to call again, the translation is finished or error'd.
 */
export class MalloyTranslator extends MalloyTranslation {
  schemaZone = new Zone<SourceDef>();
  importZone = new Zone<string>();
  pretranslatedModels = new Map<string, ModelDef>();
  sqlQueryZone = new Zone<SQLSourceDef>();
  logger: BaseMessageLogger;
  readonly root: MalloyTranslator;
  constructor(
    rootURL: string,
    importURL: string | null = null,
    preload: ParseUpdate | null = null,
    private readonly eventStream: EventStream | null = null
  ) {
    super(rootURL, importURL);
    this.root = this;
    this.logger = new BaseMessageLogger(eventStream);
    if (preload) {
      this.update(preload);
    }
  }

  update(dd: ParseUpdate): void {
    this.schemaZone.updateFrom(dd.tables, dd.errors?.tables);
    this.importZone.updateFrom(dd.urls, dd.errors?.urls);
    this.sqlQueryZone.updateFrom(dd.compileSQL, dd.errors?.compileSQL);
    for (const url in dd.translations) {
      this.pretranslatedModels.set(url, dd.translations[url]);
    }
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
  translations: Record<string, string>;
}

export interface URLData {
  urls: ZoneData<string>;
}
export interface ModelData {
  translations: ZoneData<ModelDef>;
}
export interface SchemaData {
  tables: ZoneData<SourceDef>;
}
export interface SQLSources {
  compileSQL: ZoneData<SQLSourceDef>;
}
export interface UpdateData extends URLData, SchemaData, SQLSources, ModelData {
  errors: Partial<ErrorData>;
}
export type ParseUpdate = Partial<UpdateData>;

function flattenDependencyTree(dependencies: DependencyTree) {
  return [
    ...Object.keys(dependencies),
    ...Object.keys(dependencies)
      .map(dependency => {
        return flattenDependencyTree(dependencies[dependency]);
      })
      .flat(),
  ];
}
