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
  DocumentLocation,
  DocumentReference,
  isSQLBlock,
  ModelDef,
  Query,
  SQLBlockStructDef,
} from '../../../model/malloy_types';

import {MessageLogger} from '../../parse-log';
import {MalloyTranslation} from '../../parse-malloy';
import {ModelDataRequest} from '../../translate-response';
import {DocumentCompileResult} from './document-compile-result';
import {ModelEntry} from './model-entry';
import {NameSpace} from './name-space';

export abstract class MalloyElement {
  abstract elementType: string;
  codeLocation?: DocumentLocation;
  children: ElementChildren = {};
  parent: MalloyElement | null = null;
  private readonly logger?: MessageLogger;

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
        if (isSQLBlock(result.entry)) {
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
    const logger = this.translator()?.root.logger;
    if (logger) {
      return logger.hasErrors();
    }
    return true;
  }

  private readonly logged = new Set<string>();
  log(message: string): void {
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
    const trans = this.translator();
    const msg = {at: this.location, message};
    const logTo = trans?.root.logger;
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

  walk(callBack: (node: MalloyElement) => void): void {
    callBack(this);
    for (const kidLabel of Object.keys(this.children)) {
      const kiddle = this.children[kidLabel];
      if (kiddle instanceof MalloyElement) {
        kiddle.walk(callBack);
      } else {
        for (const k of kiddle) {
          k.walk(callBack);
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
}

export interface DocStatement extends MalloyElement {
  execute(doc: Document): ModelDataRequest;
}

export function isDocStatement(e: MalloyElement): e is DocStatement {
  return (e as DocStatement).execute !== undefined;
}

export class ListOf<ET extends MalloyElement> extends MalloyElement {
  elementType = 'genericElementList';
  constructor(listDesc: string, protected elements: ET[]) {
    super();
    if (this.elementType === 'genericElementList') {
      this.elementType = listDesc;
    }
    this.newContents();
  }

  private newContents(): void {
    this.has({[this.elementType]: this.elements});
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
}

export class RunList extends ListOf<DocStatement> {
  execCursor = 0;
  executeList(doc: Document): ModelDataRequest {
    while (this.execCursor < this.elements.length) {
      if (doc.errorsExist()) {
        // This stops cascading errors
        return;
      }
      const el = this.elements[this.execCursor];
      if (isDocStatement(el)) {
        const resp = el.execute(doc);
        if (resp) {
          return resp;
        }
        this.execCursor += 1;
      }
    }
    return undefined;
  }
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
  documentModel: Record<string, ModelEntry> = {};
  queryList: Query[] = [];
  sqlBlocks: SQLBlockStructDef[] = [];
  statements: RunList;
  didInitModel = false;

  constructor(statements: DocStatement[]) {
    super();
    this.statements = new RunList('topLevelStatements', statements);
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
      for (const inName in extendingModelDef.contents) {
        const struct = extendingModelDef.contents[inName];
        if (struct.type === 'struct') {
          const exported = extendingModelDef.exports.includes(inName);
          this.setEntry(inName, {entry: struct, exported});
        }
      }
    }
    this.didInitModel = true;
  }

  compile(): DocumentCompileResult {
    const needs = this.statements.executeList(this);
    const ret: DocumentCompileResult = {
      modelDef: this.modelDef(),
      queryList: this.queryList,
      sqlBlocks: this.sqlBlocks,
      needs,
    };
    return ret;
  }

  modelDef(): ModelDef {
    const def: ModelDef = {name: '', exports: [], contents: {}};
    for (const entry in this.documentModel) {
      const entryDef = this.documentModel[entry].entry;
      if (entryDef.type === 'struct' || entryDef.type === 'query') {
        if (this.documentModel[entry].exported) {
          def.exports.push(entry);
        }
        def.contents[entry] = cloneDeep(entryDef);
      }
    }
    return def;
  }

  defineSQL(sql: SQLBlockStructDef, name?: string): boolean {
    const ret = {...sql, as: `$${this.sqlBlocks.length}`};
    if (name) {
      if (this.getEntry(name)) {
        return false;
      }
      ret.as = name;
      this.setEntry(name, {entry: ret, sqlType: true});
    }
    this.sqlBlocks.push(ret);
    return true;
  }

  getEntry(str: string): ModelEntry {
    return this.documentModel[str];
  }

  setEntry(str: string, ent: ModelEntry): void {
    this.documentModel[str] = ent;
  }
}
