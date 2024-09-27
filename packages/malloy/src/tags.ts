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

import {AbstractParseTreeVisitor} from 'antlr4ts/tree';
import {MalloyTagLexer} from './lang/lib/Malloy/MalloyTagLexer';
import {
  ArrayElementContext,
  ArrayValueContext,
  MalloyTagParser,
  PropNameContext,
  PropertiesContext,
  ReferenceContext,
  StringContext,
  TagDefContext,
  TagEqContext,
  TagLineContext,
  TagReplacePropertiesContext,
  TagSpecContext,
  TagUpdatePropertiesContext,
} from './lang/lib/Malloy/MalloyTagParser';
import {MalloyTagVisitor} from './lang/lib/Malloy/MalloyTagVisitor';
import {
  ANTLRErrorListener,
  CharStreams,
  CommonTokenStream,
  ParserRuleContext,
  Token,
} from 'antlr4ts';
import {parseString} from './lang/parse-utils';
import {LogMessage} from './lang';
import {Annotation, Note} from './model';

// The distinction between the interface and the Tag class exists solely to
// make it possible to write tests and specify expected results This
// is why only TagDict interface is exported.
export type TagDict = Record<string, TagInterface>;

type TagValue = string | TagInterface[];

export interface TagInterface {
  eq?: TagValue;
  properties?: TagDict;
}

export interface TagParse {
  tag: Tag;
  log: LogMessage[];
}

export interface TagParseSpec {
  prefix?: RegExp;
  extending?: Tag;
  scopes?: Tag[];
}

export interface Taggable {
  tagParse: (spec?: TagParseSpec) => TagParse;
  getTaglines: (prefix?: RegExp) => string[];
}

/**
 * Class for interacting with the parsed output of an annotation
 * containing the Malloy tag language. Used by the parser to
 * generate parsed data, and as an API to that data.
 * ```
 * tag.text(p?)         => string value of tag.p or undefined
 * tag.array(p?)        => Tag[] value of tag.p or undefined
 * tag.numeric(p?)      => numeric value of tag.p or undefined
 * tag.textArray(p ?)   => string[] value of elements in tag.p or undefined
 * tag.numericArray(p?) => string[] value of elements in tag.p or undefined
 * tag.tag(p?)           => Tag value of tag.p
 * tag.has(p?)           => boolean "tag contains tag.p"
 * tag.bare(p?)          => tag.p exists and has no properties
 * tag.dict             => Record<string,Tag> of tag properties
 * ```
 */
export class Tag implements TagInterface {
  eq?: TagValue;
  properties?: TagDict;

  static tagFrom(from: TagInterface = {}) {
    if (from instanceof Tag) {
      return from;
    }
    return new Tag(from);
  }

  // --- Just for debugging ---
  static ids = new Map<Tag, number>();
  static nextTagId = 1000;
  static id(t: Tag): number {
    let thisTagId = Tag.ids.get(t);
    if (thisTagId === undefined) {
      thisTagId = Tag.nextTagId;
      Tag.ids.set(t, thisTagId);
      Tag.nextTagId += 1;
    }
    return thisTagId;
  }
  peek(indent = 0): string {
    const spaces = ' '.repeat(indent);
    let str = `#${Tag.id(this)}`;
    if (
      this.properties === undefined &&
      this.eq &&
      typeof this.eq === 'string'
    ) {
      return str + `=${this.eq}`;
    }
    str += ' {';
    if (this.eq) {
      if (typeof this.eq === 'string') {
        str += `\n${spaces}  =: ${this.eq}`;
      } else {
        str += `\n${spaces}  =: [\n${spaces}    ${this.eq
          .map(el => Tag.tagFrom(el).peek(indent + 4))
          .join(`\n${spaces}    `)}\n${spaces}  ]`;
      }
    }

    if (this.properties) {
      for (const k in this.properties) {
        const val = Tag.tagFrom(this.properties[k]);
        str += `\n${spaces}  ${k}: ${val.peek(indent + 2)}`;
      }
    }
    str += `\n${spaces}}`;
    return str;
  }

  /**
   * Parse a line of Malloy tag language into a Tag which can be queried
   * @param source -- The source line to be parsed. If the string starts with #, then it skips
   *   all characters up to the first space.
   * @param extending A tag which this line will be extending
   * @param importing Outer "scopes" for $() references
   * @returns Something shaped like { tag: Tag  , log: ParseErrors[] }
   */
  static fromTagline(
    str: string,
    extending: Tag | undefined,
    ...importing: Tag[]
  ): TagParse {
    // TODO -- Figure out the right thing about the URL
    const url = `internal://tag-parse/from-tag-line?${encodeURIComponent(str)}`;
    return parseTagline(str, extending, importing, url, 0, 0);
  }

  static addModelScope(
    spec: TagParseSpec | undefined,
    modelScope: Tag
  ): TagParseSpec {
    const useSpec = spec ? {...spec} : {};
    if (useSpec.scopes) {
      useSpec.scopes = useSpec.scopes.concat(modelScope);
    } else {
      useSpec.scopes = [modelScope];
    }
    return useSpec;
  }

  static annotationToTaglines(
    annote: Annotation | undefined,
    prefix?: RegExp
  ): string[] {
    annote ||= {};
    const tagLines = annote.inherits
      ? Tag.annotationToTaglines(annote.inherits, prefix)
      : [];
    function prefixed(na: Note[] | undefined): string[] {
      const ret: string[] = [];
      for (const n of na || []) {
        if (prefix === undefined || n.text.match(prefix)) {
          ret.push(n.text);
        }
      }
      return ret;
    }
    return tagLines.concat(prefixed(annote.blockNotes), prefixed(annote.notes));
  }

  static annotationToTag(
    annote: Annotation | undefined,
    spec: TagParseSpec = {}
  ): TagParse {
    let extending = spec.extending || new Tag();
    const prefix = spec.prefix || /^##? /;
    annote ||= {};
    const allErrs: LogMessage[] = [];
    if (annote.inherits) {
      const inherits = Tag.annotationToTag(annote.inherits, spec);
      allErrs.push(...inherits.log);
      extending = inherits.tag;
    }
    const allNotes: Note[] = [];
    if (annote.blockNotes) {
      allNotes.push(...annote.blockNotes);
    }
    if (annote.notes) {
      allNotes.push(...annote.notes);
    }
    for (const note of allNotes) {
      if (note.text.match(prefix)) {
        const noteParse = parseTagline(
          note.text,
          extending,
          spec.scopes || [],
          note.at.url,
          note.at.range.start.line,
          note.at.range.start.character
        );
        extending = noteParse.tag;
        allErrs.push(...noteParse.log);
      }
    }
    return {tag: extending, log: allErrs};
  }

  constructor(from: TagInterface = {}) {
    if (from.eq) {
      this.eq = from.eq;
    }
    if (from.properties) {
      this.properties = from.properties;
    }
  }

  private find(at: string[]): Tag | undefined {
    let lookAt = Tag.tagFrom(this);
    for (const seg of at) {
      const lookup = lookAt.properties && lookAt.properties[seg];
      if (!lookup) {
        return;
      }
      lookAt = Tag.tagFrom(lookup);
    }
    return lookAt;
  }

  tag(...at: string[]): Tag | undefined {
    return this.find(at);
  }

  has(...at: string[]): boolean {
    return this.find(at) !== undefined;
  }

  text(...at: string[]): string | undefined {
    const str = this.find(at)?.eq;
    if (typeof str === 'string') {
      return str;
    }
  }

  numeric(...at: string[]): number | undefined {
    const str = this.find(at)?.eq;
    if (typeof str === 'string') {
      const num = Number.parseFloat(str);
      if (!Number.isNaN(num)) {
        return num;
      }
    }
  }

  bare(...at: string[]): boolean | undefined {
    const p = this.find(at);
    if (p === undefined) {
      return;
    }
    return (
      p.properties === undefined || Object.entries(p.properties).length === 0
    );
  }

  get dict(): Record<string, Tag> {
    const newDict: Record<string, Tag> = {};
    if (this.properties) {
      for (const key in this.properties) {
        newDict[key] = Tag.tagFrom(this.properties[key]);
      }
    }
    return newDict;
  }

  array(...at: string[]): Tag[] | undefined {
    const array = this.find(at)?.eq;
    if (array === undefined || typeof array === 'string') {
      return undefined;
    }
    return array.map(el =>
      typeof el === 'string' ? new Tag({eq: el}) : Tag.tagFrom(el)
    );
  }

  textArray(...at: string[]): string[] | undefined {
    const array = this.find(at)?.eq;
    if (array === undefined || typeof array === 'string') {
      return undefined;
    }
    return array.reduce<string[]>(
      (allStrs, el) =>
        typeof el.eq === 'string' ? allStrs.concat(el.eq) : allStrs,
      []
    );
  }

  numericArray(...at: string[]): number[] | undefined {
    const array = this.find(at)?.eq;
    if (array === undefined || typeof array === 'string') {
      return undefined;
    }
    return array.reduce<number[]>((allNums, el) => {
      if (typeof el.eq === 'string') {
        const num = Number.parseFloat(el.eq);
        if (!Number.isNaN(num)) {
          return allNums.concat(num);
        }
      }
      return allNums;
    }, []);
  }

  // Has the sometimes desireable side effect of initalizing properties
  getProperties(): TagDict {
    if (this.properties === undefined) {
      this.properties = {};
    }
    return this.properties;
  }

  clone(): Tag {
    return new Tag(structuredClone(this));
  }
}

class TagErrorListener implements ANTLRErrorListener<Token> {
  log: LogMessage[] = [];
  constructor(
    readonly sourceURL: string,
    readonly atLine: number,
    readonly fromChar: number
  ) {}

  syntaxError(
    recognizer: unknown,
    offendingSymbol: Token | undefined,
    line: number,
    charPositionInLine: number,
    msg: string,
    _e: unknown
  ): void {
    const errAt = {
      line: this.atLine,
      character: this.fromChar + charPositionInLine,
    };
    const range = {start: errAt, end: errAt};
    const logMsg: LogMessage = {
      code: 'tag-parse-syntax-error',
      message: msg,
      at: {url: this.sourceURL, range},
      severity: 'error',
    };
    this.log.push(logMsg);
  }

  semanticError(cx: ParserRuleContext, code: string, msg: string): void {
    const errAt = {
      line: this.atLine,
      // mtoy TODO get this right
      character: 0,
    };
    const range = {start: errAt, end: errAt};
    const logMsg: LogMessage = {
      code,
      message: msg,
      at: {url: this.sourceURL, range},
      severity: 'error',
    };
    this.log.push(logMsg);
  }
}

function getBuildOn(ctx: ParserRuleContext): Tag {
  const buildOn = ctx['buildOn'];
  if (buildOn instanceof Tag) {
    return buildOn;
  }
  return new Tag();
}

/**
 * When chasing a path reference, the two interesting gestures are to
 * find the path-ed tag so it can be extended, or to find the path tag
 * so it can be deleted. This returns the parent and the final tag
 * so that the caller can delete the tag with delete parent.tagName
 * or assign to it with parent[tagName] = new_value
 */
function buildAccessPath(buildOn: Tag, path: string[]): [string, TagDict] {
  let parentPropertyObject = buildOn.getProperties();
  for (const p of path.slice(0, path.length - 1)) {
    let next: Tag;
    if (parentPropertyObject[p] === undefined) {
      next = new Tag({});
      parentPropertyObject[p] = next;
    } else {
      // The access that we are performing requires that `.properties` be the
      // same JS object (not equal, but identical), and `Tag.tagFrom` only copies
      // the exact object in if it is actually present.
      parentPropertyObject[p].properties ??= {};
      next = Tag.tagFrom(parentPropertyObject[p]);
    }
    parentPropertyObject = next.getProperties();
  }
  return [path[path.length - 1], parentPropertyObject];
}

function getString(ctx: StringContext) {
  if (ctx.SQ_STRING() || ctx.DQ_STRING()) {
    return parseString(ctx.text, ctx.text[0]);
  }
  return ctx.text;
}

function parseTagline(
  source: string,
  extending: Tag | undefined,
  outerScope: Tag[],
  sourceURL: string,
  onLine: number,
  atChar: number
): TagParse {
  if (source[0] === '#') {
    const skipTo = source.indexOf(' ');
    if (skipTo > 0) {
      source = source.slice(skipTo);
    } else {
      source = '';
    }
  }
  const inputStream = CharStreams.fromString(source);
  const lexer = new MalloyTagLexer(inputStream);
  const tokenStream = new CommonTokenStream(lexer);
  const pLog = new TagErrorListener(sourceURL, onLine, atChar);
  const taglineParser = new MalloyTagParser(tokenStream);
  taglineParser.removeErrorListeners();
  taglineParser.addErrorListener(pLog);
  const tagTree = taglineParser.tagLine();
  const treeWalker = new TaglineParser(outerScope, pLog);
  const tag = treeWalker.tagLineToTag(tagTree, extending);
  return {tag, log: pLog.log};
}

class TaglineParser
  extends AbstractParseTreeVisitor<Tag>
  implements MalloyTagVisitor<Tag>
{
  scopes: Tag[] = [];
  msgLog: TagErrorListener;
  constructor(outerScopes: Tag[] = [], msgLog: TagErrorListener) {
    super();
    this.msgLog = msgLog;
    this.scopes.unshift(...outerScopes);
  }

  defaultResult() {
    return new Tag();
  }

  visitString(ctx: StringContext): Tag {
    return new Tag({eq: getString(ctx)});
  }

  protected getPropName(ctx: PropNameContext): string[] {
    return ctx
      .identifier()
      .map(cx =>
        cx.BARE_STRING() ? cx.text : parseString(cx.text, cx.text[0])
      );
  }

  getTags(tags: TagSpecContext[], tagLine: Tag): Tag {
    for (const tagSpec of tags) {
      // Stash the current state of this tag in the context and then visit it
      // visit functions should alter the tagLine
      tagSpec['buildOn'] = tagLine;
      this.visit(tagSpec);
    }
    return tagLine;
  }

  tagLineToTag(ctx: TagLineContext, extending: Tag | undefined): Tag {
    extending = extending?.clone() || new Tag({});
    this.scopes.unshift(extending);
    this.getTags(ctx.tagSpec(), extending);
    return extending;
  }

  visitTagLine(_ctx: TagLineContext): Tag {
    throw new Error('INTERNAL: ERROR: Call tagLineToTag, not vistTagLine');
    return this.defaultResult();
  }

  visitProperties(ctx: PropertiesContext): Tag {
    return this.getTags(ctx.tagSpec(), getBuildOn(ctx));
  }

  visitArrayValue(ctx: ArrayValueContext): Tag {
    return new Tag({eq: this.getArray(ctx)});
  }

  getArray(ctx: ArrayValueContext): Tag[] {
    return ctx.arrayElement().map(v => this.visit(v));
  }

  visitArrayElement(ctx: ArrayElementContext): Tag {
    const propCx = ctx.properties();
    const properties = propCx ? this.visitProperties(propCx) : undefined;
    const strCx = ctx.string();
    let value: TagValue | undefined = strCx ? getString(strCx) : undefined;

    const arrayCx = ctx.arrayValue();
    if (arrayCx) {
      value = this.getArray(arrayCx);
    }

    if (properties) {
      if (value) {
        properties.eq = value;
      }
      return properties;
    }

    const refCx = ctx.reference();
    if (refCx) {
      return this.visitReference(refCx);
    }
    return new Tag({eq: value});
  }

  visitReference(ctx: ReferenceContext): Tag {
    const path = this.getPropName(ctx.propName());
    for (const scope of this.scopes) {
      // first scope which has the first component gets to resolve the whole path
      if (scope.has(path[0])) {
        const refTo = scope.tag(...path);
        if (refTo) {
          return refTo.clone();
        }
        break;
      }
    }
    this.msgLog.semanticError(
      ctx,
      'tag-property-not-found',
      `Reference to undefined property ${path.join('.')}`
    );
    return this.defaultResult();
  }

  visitTagEq(ctx: TagEqContext): Tag {
    const buildOn = getBuildOn(ctx);
    const name = this.getPropName(ctx.propName());
    const [writeKey, writeInto] = buildAccessPath(buildOn, name);
    const eq = this.visit(ctx.eqValue());
    const propCx = ctx.properties();
    if (propCx) {
      // a.b.c { -y } means i want to do -y on
      if (propCx.DOTTY() === undefined) {
        const properties = this.visitProperties(propCx).dict;
        // Add new properties old value
        writeInto[writeKey] = {...eq, properties};
      } else {
        // preserve old properties, add new value
        writeInto[writeKey] = {...writeInto[writeKey], ...eq};
      }
    } else {
      writeInto[writeKey] = eq;
    }
    return buildOn;
  }

  visitTagReplaceProperties(ctx: TagReplacePropertiesContext): Tag {
    const buildOn = getBuildOn(ctx);
    const name = this.getPropName(ctx.propName());
    const [writeKey, writeInto] = buildAccessPath(buildOn, name);
    const propCx = ctx.properties();
    const props = this.visitProperties(propCx);
    if (ctx.DOTTY() === undefined) {
      // No dots, thropw away the value
      writeInto[writeKey] = {properties: props.dict};
    } else {
      /// DOTS, just update the properties
      writeInto[writeKey].properties = props.dict;
    }
    return buildOn;
  }

  visitTagUpdateProperties(ctx: TagUpdatePropertiesContext): Tag {
    const buildOn = getBuildOn(ctx);
    const name = this.getPropName(ctx.propName());
    const [writeKey, writeInto] = buildAccessPath(buildOn, name);
    const propCx = ctx.properties();
    propCx['buildOn'] = Tag.tagFrom(writeInto[writeKey]);
    const props = this.visitProperties(propCx);
    const thisObj = writeInto[writeKey] || new Tag({});
    const properties = {...thisObj.properties, ...props.dict};
    writeInto[writeKey] = {...thisObj, properties};
    return buildOn;
  }

  visitTagDef(ctx: TagDefContext): Tag {
    const buildOn = getBuildOn(ctx);
    const path = this.getPropName(ctx.propName());
    const [writeKey, writeInto] = buildAccessPath(buildOn, path);
    if (ctx.MINUS()) {
      delete writeInto[writeKey];
    } else {
      writeInto[writeKey] = new Tag({});
    }
    return buildOn;
  }
}
