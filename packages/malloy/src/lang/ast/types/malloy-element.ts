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
import cloneDeep from 'lodash/cloneDeep';

import {
  Annotation,
  DocumentLocation,
  DocumentReference,
  isSQLBlockStruct,
  ModelDef,
  ModelAnnotation,
  NamedModelObject,
  Note,
  Query,
  SQLBlockStructDef,
  StructDef,
} from '../../../model/malloy_types';
import {Tag} from '../../../tags';
import {LogSeverity, MessageLogger} from '../../parse-log';
import {MalloyTranslation} from '../../parse-malloy';
import {ModelDataRequest} from '../../translate-response';
import {DocumentCompileResult} from './document-compile-result';
import {GlobalNameSpace} from './global-name-space';
import {ModelEntry} from './model-entry';
import {NameSpace} from './name-space';
import {Noteable, isNoteable, extendNoteMethod} from './noteable';
import {v5 as uuidv5} from 'uuid';

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

  protected namespace(): NameSpace | undefined {
    if (this instanceof Document) {
      return this;
    } else if (this.parent) {
      return this.parent.namespace();
    }
    throw new Error('INTERNAL ERROR: Translation without document scope');
  }

  modelEntry(reference: string | ModelEntryReference): ModelEntry | undefined {
    const key =
      reference instanceof ModelEntryReference ? reference.name : reference;
    const result = this.namespace()?.getEntry(key);
    if (reference instanceof ModelEntryReference) {
      if (result?.entry.type === 'query') {
        this.addReference({
          type: 'queryReference',
          text: key,
          definition: result.entry,
          location: reference.location,
        });
      } else if (result?.entry.type === 'struct') {
        if (isSQLBlockStruct(result.entry) && result.entry.declaredSQLBlock) {
          this.addReference({
            type: 'sqlBlockReference',
            text: key,
            definition: result.entry,
            location: reference.location,
          });
        } else {
          this.addReference({
            type: 'exploreReference',
            text: key,
            definition: result.entry,
            location: reference.location,
          });
        }
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

  addReference(reference: DocumentReference): void {
    this.translator()?.addReference(reference);
  }

  private get sourceURL() {
    const trans = this.translator();
    return trans?.sourceURL || '(missing)';
  }

  errorsExist(): boolean {
    const logger = this.logger();
    if (logger) {
      return logger.hasErrors();
    }
    return false;
  }

  private readonly logged = new Set<string>();
  log(message: string, severity: LogSeverity = 'error'): void {
    if (this.codeLocation) {
      /*
       * If this element has a location, then don't report the same
       * error message at the same location more than once
       */
      if (this.logged.has(message)) {
        return;
      }
      this.logged.add(message);
    }
    const msg = {at: this.location, message, severity};
    const logTo = this.logger();
    if (logTo) {
      logTo.log(msg);
      return;
    }
    throw new Error(
      `Translation error (without error reporter):\n${JSON.stringify(
        msg,
        null,
        2
      )}`
    );
  }

  logger(): MessageLogger | undefined {
    return this.translator()?.root.logger;
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
    this.log(`INTERNAL ERROR IN TRANSLATION: ${msg}`);
    return new Error(msg);
  }

  needs(doc: Document): ModelDataRequest | undefined {
    for (const child of this.walk()) {
      const childNeeds = child.needs(doc);
      if (childNeeds) return childNeeds;
    }
  }

  inExperiment(experimentID: string, silent = false) {
    const experimental = this.translator()?.compilerFlags.tag('experimental');
    const enabled =
      experimental && (experimental.bare() || experimental.has(experimentID));
    if (enabled) {
      return true;
    }
    if (!silent) {
      this.log(
        `Experimental flag '${experimentID}' is not set, feature not available`
      );
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

  getNamed(): NamedModelObject | undefined {
    return this.modelEntry(this)?.entry;
  }
}

export interface DocStatement extends MalloyElement {
  execute(doc: Document): void;
}

export class ExperimentalExperiment
  extends MalloyElement
  implements DocStatement
{
  elementType = 'experimentalExperiment';
  constructor(readonly id: string) {
    super();
  }

  execute(_doc: Document) {
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

  needs(doc: Document): ModelDataRequest | undefined {
    for (const element of this.elements) {
      const elementNeeds = element.needs(doc);
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
  executeList(doc: Document): ModelDataRequest {
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
        const needs = el.executeList(doc);
        if (needs) return needs;
      } else {
        const needs = el.needs(doc);
        if (needs) return needs;
        el.execute(doc);
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

export class Document extends MalloyElement implements NameSpace {
  elementType = 'document';
  globalNameSpace: NameSpace = new GlobalNameSpace();
  documentModel: Record<string, ModelEntry> = {};
  queryList: Query[] = [];
  sqlBlocks: SQLBlockStructDef[] = [];
  statements: DocStatementList;
  didInitModel = false;
  notes: Note[] = [];
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
    this.documentModel = {};
    this.queryList = [];
    this.sqlBlocks = [];
    if (extendingModelDef) {
      for (const [nm, orig] of Object.entries(extendingModelDef.contents)) {
        const entry = cloneDeep(orig);
        if (
          entry.type === 'struct' ||
          entry.type === 'query' ||
          entry.type === 'function'
        ) {
          const exported = extendingModelDef.exports.includes(nm);
          this.setEntry(nm, {entry, exported});
        }
      }
    }
    this.didInitModel = true;
  }

  compile(): DocumentCompileResult {
    const needs = this.statements.executeList(this);
    const modelDef = this.modelDef();
    if (needs === undefined) {
      for (const q of this.queryList) {
        if (q.modelAnnotation === undefined && modelDef.annotation) {
          q.modelAnnotation = modelDef.annotation;
        }
      }
      for (const q of this.sqlBlocks) {
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
      modelDef,
      queryList: this.queryList,
      sqlBlocks: this.sqlBlocks,
      needs,
    };
    return ret;
  }

  private modelAnnotationTodoList: StructDef[] = [];
  rememberToAddModelAnnotations(sd: StructDef) {
    this.modelAnnotationTodoList.push(sd);
  }

  currentModelAnnotation(): ModelAnnotation | undefined {
    if (this.notes.length > 0) {
      const ret = {id: '', notes: this.notes};
      ret.id = annotationID(ret);
      return ret;
    }
  }

  modelDef(): ModelDef {
    const def: ModelDef = {name: '', exports: [], contents: {}};
    if (this.notes.length > 0) {
      def.annotation = this.currentModelAnnotation();
    }
    for (const entry in this.documentModel) {
      const entryDef = this.documentModel[entry].entry;
      if (entryDef.type === 'struct' || entryDef.type === 'query') {
        if (this.documentModel[entry].exported) {
          def.exports.push(entry);
        }
        const newEntry = cloneDeep(entryDef);
        if (newEntry.modelAnnotation === undefined && def.annotation) {
          newEntry.modelAnnotation = def.annotation;
        }
        def.contents[entry] = newEntry;
      }
    }
    return def;
  }

  defineSQL(sql: SQLBlockStructDef, name?: string): boolean {
    const ret = {
      ...sql,
      as: `$${this.sqlBlocks.length}`,
      declaredSQLBlock: true,
    };
    if (name) {
      if (this.getEntry(name)) {
        return false;
      }
      ret.as = name;
      this.setEntry(name, {entry: ret});
    }
    this.sqlBlocks.push(ret);
    return true;
  }

  getEntry(str: string): ModelEntry {
    return this.globalNameSpace.getEntry(str) ?? this.documentModel[str];
  }

  setEntry(str: string, ent: ModelEntry): void {
    // TODO this error message is going to be in the wrong place everywhere...
    if (this.globalNameSpace.getEntry(str) !== undefined) {
      this.log(`Cannot redefine '${str}', which is in global namespace`);
    }
    this.documentModel[str] = ent;
  }
}
