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

import {getDialect} from '../../../dialect';
import type {
  Annotation,
  DocumentLocation,
  DocumentReference,
  ModelDef,
  ModelAnnotation,
  Query,
  StructDef,
} from '../../../model/malloy_types';
import {isSourceDef} from '../../../model/malloy_types';
import {Tag} from '@malloydata/malloy-tag';
import type {
  LogMessageOptions,
  MessageLogger,
  MessageParameterType,
  MessageCode,
} from '../../parse-log';
import {makeLogMessage} from '../../parse-log';
import type {MalloyTranslation} from '../../parse-malloy';
import type {ModelDataRequest} from '../../translate-response';
import {errorFor} from '../ast-utils';
import {DialectNameSpace} from './dialect-name-space';
import type {DocumentCompileResult} from './document-compile-result';
import type {ExprValue} from './expr-value';
import {GlobalScope} from './global-namespace';
import type {ModelEntry} from './model-entry';
import type {NameSpace} from './name-space';
import type {Noteable} from './noteable';
import {isNoteable, extendNoteMethod} from './noteable';
import {v5 as uuidv5} from 'uuid';
import {BaseScope} from './scope';
import type {Binding} from './bindings';
import {makeSymbolFromNamedModelObject} from './bindings';

export abstract class MalloyElement {
  abstract elementType: string;
  codeLocation?: DocumentLocation;
  children: ElementChildren = {};
  parent: MalloyElement | null = null;

  /**
   * @param kids All children passed to the constructor are not optional
   */
  constructor(kids?: ElementChildren) {
    if (kids) {
      this.has(kids);
    }
  }

  /**
   * Record all elements as children of this element, and mark this
   * element as their parent.
   * @param kids Some of these might be undefined, in which case they are ignored
   */
  has(kids: Record<string, ChildBody | undefined>): void {
    for (const kidName in kids) {
      const kidValue = kids[kidName];
      if (kidValue !== undefined) {
        this.children[kidName] = kidValue;
        if (kidValue instanceof MalloyElement) {
          kidValue.parent = this;
        } else {
          for (const oneKid of kidValue) {
            oneKid.parent = this;
          }
        }
      }
    }
  }

  get location(): DocumentLocation {
    if (this.codeLocation) {
      return this.codeLocation;
    }
    if (this.parent) {
      return this.parent.location;
    }
    return {
      url: this.sourceURL,
      range: {
        start: {line: 0, character: 0},
        end: {line: 0, character: 0},
      },
    };
  }

  set location(loc: DocumentLocation | undefined) {
    this.codeLocation = loc;
  }

  get code() {
    return this.translator()?.codeAtLocation(this.location) ?? '';
  }

  protected document(): Document | undefined {
    if (this instanceof Document) {
      return this;
    }
    return this.parent?.document();
  }

  // TODO: Rename this symbol to Scope, or modelScope, as appropriate
  protected scope(): BaseScope | undefined {
    if (this instanceof Document) {
      return this.modelScope;
    } else if (this.parent) {
      return this.parent.scope();
    }
    throw new Error('INTERNAL ERROR: Translation without document scope');
  }

  getDialectNamespace(dialectName: string): NameSpace | undefined {
    return this.document()?.getDialectNamespace(dialectName);
  }

  // TODO: This appears to be replicating the behavior of the Scope.
  // It is unclear if this can be fully handed off the to Scope.
  // Figure that out and simplify if and only if it can be done without
  // regressions
  lookupSymbol(reference: string | ModelEntryReference): Binding | undefined {
    const key =
      reference instanceof ModelEntryReference ? reference.name : reference;
    const result = this.scope()?.getEntry(key);
    if (reference instanceof ModelEntryReference) {
      if (result?.isQuery()) {
        this.addReference({
          type: 'queryReference',
          text: key,
          definition: result.getNamedQuery(),
          location: reference.location,
        });
      } else if (result && result.isSource()) {
        this.addReference({
          type: 'exploreReference',
          text: key,
          definition: result.getSourceDef(),
          location: reference.location,
        });
      }
    }
    return result;
  }

  private xlate?: MalloyTranslation;

  /**
   * @returns The eldest of them all
   */
  kupuna(): MalloyElement {
    return this.parent?.kupuna() || this;
  }

  translator(): MalloyTranslation | undefined {
    if (this.xlate) {
      return this.xlate;
    }
    if (this.parent) {
      return this.parent.translator();
    }
    return undefined;
  }

  setTranslator(x: MalloyTranslation): void {
    this.xlate = x;
  }

  // TODO: What exactly are these references doing? Should this relate
  // more closely to the Scope system?
  addReference(reference: DocumentReference): void {
    this.translator()?.addReference(reference);
  }

  private get sourceURL() {
    const trans = this.translator();
    return trans?.sourceURL || '(missing)';
  }

  private readonly logged = new Set<string>();
  private log<T extends MessageCode>(
    code: T,
    parameters: MessageParameterType<T>,
    options?: LogMessageOptions
  ): T {
    const log = makeLogMessage(code, parameters, {
      at: this.location,
      ...options,
    });
    if (this.codeLocation) {
      /*
       * If this element has a location, then don't report the same
       * error message at the same location more than once
       */
      if (this.logged.has(log.message)) {
        return code;
      }
      this.logged.add(log.message);
    }
    this.logger.log(log);
    return code;
  }

  logError<T extends MessageCode>(
    code: T,
    parameters: MessageParameterType<T>,
    options?: Omit<LogMessageOptions, 'severity'>
  ): T {
    return this.log(code, parameters, {severity: 'error', ...options});
  }

  logWarning<T extends MessageCode>(
    code: T,
    parameters: MessageParameterType<T>,
    options?: Omit<LogMessageOptions, 'severity'>
  ): T {
    return this.log(code, parameters, {severity: 'warn', ...options});
  }

  loggedErrorExpr<T extends MessageCode>(
    code: T,
    parameters: MessageParameterType<T>,
    options?: LogMessageOptions
  ): ExprValue {
    return errorFor(this.logError(code, parameters, options));
  }

  get logger(): MessageLogger {
    const logger = this.translator()?.root.logger;
    if (logger === undefined) {
      throw new Error('Attempted to access logger without a translator');
    }
    return logger;
  }

  /**
   * Mostly for debugging / testing. A string-y version of this object which
   * is used to ask "are these two AST segments equal". Formatted so that
   * errors would be human readable.
   * @param indent only used for recursion
   */
  toString(): string {
    return this.stringify('', 0);
  }

  private stringify(prefix: string, indent: number): string {
    const left = ' '.repeat(indent);
    let asString = `${left}${prefix}<${this.elementType}>${this.varInfo()}`;
    for (const kidLabel of Object.keys(this.children)) {
      const kiddle = this.children[kidLabel];
      if (kiddle instanceof MalloyElement) {
        asString += '\n' + kiddle.stringify(`${kidLabel}: `, indent + 2);
      } else {
        asString += `\n${left}  ${kidLabel}: [`;
        if (kiddle.length > 0) {
          asString +=
            '\n' +
            kiddle.map(k => k.stringify('', indent + 4)).join('\n') +
            `\n${left}  `;
        }
        asString += ']';
      }
    }
    return asString;
  }

  *walk(): Generator<MalloyElement> {
    for (const kidLabel of Object.keys(this.children)) {
      const kiddle = this.children[kidLabel];
      if (kiddle instanceof MalloyElement) {
        yield kiddle;
      } else {
        for (const k of kiddle) {
          yield k;
        }
      }
    }
  }

  private varInfo(): string {
    let extra = '';
    for (const [key, value] of Object.entries(this)) {
      if (key !== 'elementType') {
        if (typeof value === 'boolean') {
          extra += value ? ` ${key}` : ` !${key}`;
        } else if (typeof value === 'string' || typeof value === 'number') {
          extra += ` ${key}=${value}`;
        }
      }
    }
    return extra;
  }

  protected internalError(msg: string): Error {
    return new Error(`INTERNAL ERROR IN TRANSLATION: ${msg}`);
  }

  needs(scope: BaseScope): ModelDataRequest | undefined {
    for (const child of this.walk()) {
      const childNeeds = child.needs(scope);
      if (childNeeds) return childNeeds;
    }
  }

  inExperiment(experimentId: string, silent = false) {
    const experimental = this.translator()?.compilerFlags.tag('experimental');
    const enabled =
      experimental && (experimental.bare() || experimental.has(experimentId));
    if (enabled) {
      return true;
    }
    if (!silent) {
      this.logError('experiment-not-enabled', {experimentId});
    }
    return false;
  }
}

export class Unimplemented extends MalloyElement {
  elementType = 'unimplemented';
  reported = false;
}

type ChildBody = MalloyElement | MalloyElement[];
type ElementChildren = Record<string, ChildBody>;

export class ModelEntryReference extends MalloyElement {
  elementType = 'modelEntryReference';

  constructor(readonly name: string) {
    super();
  }

  get refString(): string {
    return this.name;
  }

  toString(): string {
    return this.refString;
  }

  getNamed(): Binding | undefined {
    return this.lookupSymbol(this);
  }
}

export interface DocStatement extends MalloyElement {
  execute(doc: Document, scope: BaseScope): void;
}

export class ExperimentalExperiment
  extends MalloyElement
  implements DocStatement
{
  elementType = 'experimentalExperiment';
  constructor(readonly id: string) {
    super();
  }

  execute(_doc: Document, _scope: BaseScope) {
    this.inExperiment(this.id);
  }
}

export function isDocStatement(e: MalloyElement): e is DocStatement {
  return (e as DocStatement).execute !== undefined;
}

export function isDocStatementOrDocStatementList(
  el: MalloyElement
): el is DocStatement | DocStatementList {
  return el instanceof DocStatementList || isDocStatement(el);
}

export abstract class ListOf<ET extends MalloyElement> extends MalloyElement {
  constructor(protected elements: ET[]) {
    super();
    this.newContents();
  }

  protected newContents(): void {
    this.has({listOf: this.elements});
  }

  get list(): ET[] {
    return this.elements;
  }

  empty(): boolean {
    return this.elements.length === 0;
  }

  notEmpty(): boolean {
    return this.elements.length > 0;
  }

  push(...el: ET[]): ET[] {
    this.elements.push(...el);
    this.newContents();
    return this.elements;
  }

  needs(scope: BaseScope): ModelDataRequest | undefined {
    for (const element of this.elements) {
      const elementNeeds = element.needs(scope);
      if (elementNeeds) return elementNeeds;
    }
  }
}

export class DocStatementList
  extends ListOf<DocStatement | DocStatementList>
  implements Noteable
{
  elementType = 'topLevelStatements';
  execCursor = 0;
  readonly isNoteableObj = true;
  extendNote = extendNoteMethod;
  note?: Annotation;
  noteCursor = 0;
  executeList(doc: Document, scope: BaseScope): ModelDataRequest {
    while (this.execCursor < this.elements.length) {
      const el = this.elements[this.execCursor];
      if (this.noteCursor === this.execCursor) {
        // We only want to set the note on each element once,
        // but we might execute a element multiple times
        if (this.note && isNoteable(el)) {
          el.extendNote(this.note);
        }
        this.noteCursor += 1;
      }
      // For DocStatementLists, we want to incrementally execute
      // the list, returning needs only when individual statements
      // report needs, not when the whole list has needs (because
      // the needs of one statement in a list may depend on those
      // of another statement earlier in the list). For regular
      // DocStatements, we first check their needs and return them
      // if there are any; otherwise we execute the statement.
      if (el instanceof DocStatementList) {
        const needs = el.executeList(doc, scope);
        if (needs) return needs;
      } else {
        const needs = el.needs(scope);
        if (needs) return needs;
        el.execute(doc, scope);
      }
      this.execCursor += 1;
    }
    return undefined;
  }
}

const docAnnotationNameSpace = '5a79a191-06bc-43cf-9b12-58741cd82970';

function annotationNotes(an: Annotation): string[] {
  const ret = an.inherits ? annotationNotes(an.inherits) : [];
  if (an.blockNotes) {
    ret.push(...an.blockNotes.map(n => n.text));
  }
  if (an.notes) {
    ret.push(...an.notes.map(n => n.text));
  }
  return ret;
}

function annotationID(a: Annotation): string {
  const allStrs = annotationNotes(a).join('');
  return uuidv5(allStrs, docAnnotationNameSpace);
}

/**
 * The Document class is a little weird because we might need to bounce back
 * to the requestor, which might be on the other side of a wire, to get
 * back some schema information. The intended translation of a Document
 * is to call initModelDef(), and then to call modelDataRequest() until it
 * returns undefined. At any time you can call modelDef to get the model
 * as it exists so far, but the translation is not complete until
 * modelDataRequest() returns undefined;
 *
 * TODO probably modelRequest should be the method and you call it
 * until it returns a model with no additional data needed ...
 * that can be tomorrow
 */

export class Document extends MalloyElement {
  elementType = 'document';
  globalScope: BaseScope = new GlobalScope();
  modelScope: BaseScope = new BaseScope(this.globalScope);
  REPLACE_ME_WITH_NAMESPACE: Record<string, ModelEntry> = {};
  queryList: Query[] = [];
  statements: DocStatementList;
  didInitModel = false;
  annotation: Annotation = {};
  experiments = new Tag({});

  constructor(statements: (DocStatement | DocStatementList)[]) {
    super();
    this.statements = new DocStatementList(statements);
    this.has({statements: statements});
  }

  initModelDef(extendingModelDef: ModelDef | undefined): void {
    if (this.didInitModel) {
      return;
    }
    this.REPLACE_ME_WITH_NAMESPACE = {};
    this.queryList = [];
    if (extendingModelDef) {
      if (extendingModelDef.annotation) {
        this.annotation.inherits = extendingModelDef.annotation;
      }
      for (const [name, originalModelObject] of Object.entries(
        extendingModelDef.contents
      )) {
        const modelObject = structuredClone(originalModelObject);
        if (
          isSourceDef(modelObject) ||
          modelObject.type === 'query' ||
          modelObject.type === 'function'
        ) {
          const isExported = extendingModelDef.exports.includes(name);
          const symbol = makeSymbolFromNamedModelObject(modelObject);
          if (!symbol) {
            // TODO: Is it appropriate to simply throw an error here?
            throw new Error('Failed to convert modelObject into Symbol');
          }
          symbol.setIsExported(isExported);
          this.setEntry(name, symbol);
        }
      }
    }
    this.didInitModel = true;
  }

  compile(): DocumentCompileResult {
    const modelScope = new BaseScope(this.globalScope);
    const needs = this.statements.executeList(this, modelScope);
    const modelDef = this.modelDef();
    if (needs === undefined) {
      for (const q of this.queryList) {
        if (q.modelAnnotation === undefined && modelDef.annotation) {
          q.modelAnnotation = modelDef.annotation;
        }
      }
    }
    if (modelDef.annotation) {
      for (const sd of this.modelAnnotationTodoList) {
        sd.modelAnnotation ||= modelDef.annotation;
      }
    }
    const ret: DocumentCompileResult = {
      modelDef: {
        ...modelDef,
        queryList: this.queryList,
      },
      needs,
    };
    return ret;
  }

  private modelAnnotationTodoList: StructDef[] = [];
  rememberToAddModelAnnotations(sd: StructDef) {
    this.modelAnnotationTodoList.push(sd);
  }

  hasAnnotation(): boolean {
    return (
      (this.annotation.notes && this.annotation.notes.length > 0) ||
      this.annotation.inherits !== undefined
    );
  }

  currentModelAnnotation(): ModelAnnotation | undefined {
    if (this.hasAnnotation()) {
      const ret = {...this.annotation, id: ''};
      ret.id = annotationID(ret);
      return ret;
    }
  }

  modelDef(): ModelDef {
    const def: ModelDef = {
      name: '',
      exports: [],
      contents: {},
      queryList: [],
      dependencies: {},
    };
    if (this.hasAnnotation()) {
      def.annotation = this.currentModelAnnotation();
    }
    for (const entry in this.REPLACE_ME_WITH_NAMESPACE) {
      const entryDef = this.REPLACE_ME_WITH_NAMESPACE[entry].entry;
      if (isSourceDef(entryDef) || entryDef.type === 'query') {
        if (this.REPLACE_ME_WITH_NAMESPACE[entry].exported) {
          def.exports.push(entry);
        }
        const newEntry = structuredClone(entryDef);
        if (newEntry.modelAnnotation === undefined && def.annotation) {
          newEntry.modelAnnotation = def.annotation;
        }
        def.contents[entry] = newEntry;
      }
    }
    return def;
  }

  // TODO: This function is really doing a lookup, not a getEntry. Should the document
  // consider the global namespace as being in an identical namespace? I think not.
  // But this function shouldn't even exist, as it will defer to the modelScope
  // getEntry(str: string): ModelEntry {
  // return this.globalNamespace.getEntry(str) ?? this.REPLACE_ME_WITH_NAMESPACE[str];
  // return this.
  // }

  setEntry(str: string, entry: Binding): void {
    // TODO this error message is going to be in the wrong place everywhere...
    if (this.globalScope.getEntry(str) !== undefined) {
      this.logError(
        'name-conflict-with-global',
        `Cannot redefine '${str}', which is in global namespace`
      );
    }
    if (entry.isSource()) {
      this.checkExperimentalDialect(this, entry.getSourceDef().dialect);
    }

    this.modelScope.setEntry(str, entry);
  }

  /**
   * Return an error message if this dialect is the first reference to this particular
   * dialect, and the dialect is marked as experimental, and we are not running tests.
   * @param dialect The dialect name
   * @returns The error message or undefined
   */
  checkExperimentalDialect(me: MalloyElement, dialect: string): void {
    const t = this.translator();
    if (
      t &&
      t.firstReferenceToDialect(dialect) &&
      getDialect(dialect).experimental &&
      !t.experimentalDialectEnabled(dialect)
    ) {
      me.logError('experimental-dialect-not-enabled', {dialect});
    }
  }

  private readonly dialectNameSpaces = new Map<string, NameSpace>();
  getDialectNamespace(dialectName: string): NameSpace | undefined {
    if (this.dialectNameSpaces.has(dialectName)) {
      return this.dialectNameSpaces.get(dialectName);
    }
    const dialect = getDialect(dialectName);
    const ns = new DialectNameSpace(dialect);
    this.dialectNameSpaces.set(dialectName, ns);
    return ns;
  }
}
