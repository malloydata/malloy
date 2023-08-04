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

import {Annotation} from './model';

// The distinction between the interface and the class exists solely to
// make it possible to write tests and specify expected results This
// is why only TagDict is exported.
export type TagDict = Record<string, TagInterface>;

type TagValue = string | TagInterface[];

interface TagInterface {
  eq?: TagValue;
  properties?: TagDict;
}

/**
 * Class for interacting with the parsed outpout of an annotation
 * containing the malloy tag language. Used by the parser to
 * generate parsed data, and as an API to that data.
 * ```
 * tag.text(p?)        => string value of tag.p or ''
 * tag.array(p?)       => Tag[] value of tag.p or []
 * tag.numeric(p?)     => numeric value of tag.p or NaN
 * tag.dict            => Record<string, Tag> of tag properties
 * tag.tag(p)          => Tag value of tag.p
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
  peek(): string {
    let str = `#${Tag.id(this)}`;
    if (this.eq) {
      if (typeof this.eq === 'string') {
        str += `=${this.eq}`;
      } else {
        str += '=[]';
      }
    }
    if (this.properties) {
      const propStr = Object.keys(this.properties)
        .map(k => `${k}:`)
        .join(', ');
      str += `{${propStr}}`;
    }
    return str;
  }

  // mtoy todo pass in defaults as a tag or string?
  static fromTagline(str: string): TagParse {
    return parseTagline(str, undefined, undefined);
  }

  constructor(from: TagInterface = {}) {
    if (from.eq) {
      this.eq = from.eq;
    }
    if (from.properties) {
      this.properties = from.properties;
    }
  }

  tag(at: string[]): Tag | undefined {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    let findIn: Tag | undefined = this;
    for (const seg of at) {
      findIn = findIn.properties && Tag.tagFrom(findIn.properties[seg]);
      if (!findIn) {
        return undefined;
      }
    }
    return findIn;
  }

  text(at: string[] = []): string {
    const str = this.tag(at)?.eq;
    if (typeof str === 'string') {
      return str;
    }
    return '';
  }

  numeric(at: string[] = []): number {
    const str = this.tag(at)?.eq;
    if (typeof str === 'string') {
      return Number.parseFloat(str);
    }
    return NaN;
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

  array(at: string[] = []): Tag[] {
    const array = this.tag(at)?.eq;
    if (array === undefined || typeof array === 'string') {
      return [];
    }
    return array.map(el =>
      typeof el === 'string' ? new Tag({eq: el}) : Tag.tagFrom(el)
    );
  }

  // Has the sometimes desireable side effect of initalizing properties
  getProperties(): TagDict {
    if (this.properties === undefined) {
      this.properties = {};
    }
    return this.properties;
  }

  clone(): Tag {
    return new Tag(cloneDeep(this));
  }
}

export type MalloyTagProperties = Record<string, string | boolean>;
interface PropertyTag {
  properties: MalloyTagProperties;
}
interface DocTag {
  docString: string;
}
type MalloyTag = DocTag | PropertyTag;
function isDocTag(a: MalloyTag | undefined): a is DocTag {
  return (a as DocTag)?.docString !== undefined;
}

export interface MalloyTags extends PropertyTag {
  docStrings: string[];
}

export interface Taggable {
  getTags: () => Tags;
}

/**
 * Collection of useful functions for handing tag data ...
 */
export class Tags {
  private tags: Annotation | undefined;
  constructor(annotation: Annotation | undefined) {
    this.tags = annotation;
  }

  getMalloyTags(): MalloyTags {
    const ret: MalloyTags = {docStrings: [], properties: {}};
    for (const tagLine of tagList(this.tags)) {
      const tag = parseTag(tagLine, ret.properties);
      if (isDocTag(tag)) {
        ret.docStrings.push(tag.docString);
      }
    }
    return ret;
  }

  getTagList(): string[] {
    return tagList(this.tags);
  }
}

function tagList(tagNode: Annotation | undefined): string[] {
  if (!tagNode) {
    return [];
  }
  return [
    ...(tagNode.inherits ? tagList(tagNode.inherits) : []),
    ...(tagNode.blockNotes || []),
    ...(tagNode.notes || []),
  ];
}

/**
 * Lines which start '#"' are doc strings
 * Lines which start '# ' are property lines ... The property parser is
 * pretty simple, the langauge is:
 * Property can be
 *   name       -- set the value to "true"
 *   -name      -- delete a value from the property
 *   name=value -- assign value to the name
 * Name can be any sequence of non space characters, or a string
 * A value is any sequence of non space characters, or a string
 * A string is " enclosing and ending in " with \" allowed inside
 */
function parseTag(
  src: string,
  tagProp: MalloyTagProperties
): MalloyTag | undefined {
  const docMatch = src.match(/^##?" /);
  if (docMatch) {
    return {docString: src.slice(docMatch[0].length)};
  }
  const propMatch = src.match(/^##? /);
  if (!propMatch) {
    return;
  }
  const newProps = parseTagProperties(src.slice(propMatch[0].length), tagProp);
  if (newProps) {
    return {properties: newProps};
  }
}

export function parseTagProperties(
  src: string,
  tagProp: MalloyTagProperties
): MalloyTagProperties | undefined {
  /*
   * I went back and forth if the grammar for these annotations should be
   * in the parser or the lexer. Eventually the fact that the lexer ate
   * newlines meant I couldn't figure out how to do it in the parser.
   *
   * Seems wrong to be writing a parser though.
   */
  const tokens = tokenize(src);
  let tn = 0;
  const lastToken = tokens.length - 1;
  while (tn <= lastToken) {
    let token = tokens[tn];
    if (token === '=') {
      return undefined;
    }
    if (token[0] === '"') {
      token = token.slice(1, -1);
    }
    if (tn !== lastToken && tokens[tn + 1] === '=') {
      if (tn + 2 <= lastToken) {
        let value = tokens[tn + 2];
        if (value !== '=') {
          if (value[0] === '"') {
            value = value.slice(1, -1);
          }
          tagProp[token] = value;
          tn += 3;
          continue;
        }
      }
      return undefined;
    }
    if (token.startsWith('-')) {
      delete tagProp[token.slice(1)];
    } else {
      tagProp[token] = true;
    }
    tn += 1;
  }
  return tagProp;
}

function tokenize(src: string): string[] {
  const parts: string[] = [];
  src = src.trim();
  while (src) {
    const skipSpace = src.match(/^\s*(.+$)/);
    if (skipSpace === null) {
      break;
    }
    src = skipSpace[1];
    if (src[0] === '=') {
      parts.push('=');
      src = src.slice(1);
      continue;
    }
    if (src[0] === '"') {
      const matchString = src.match(/^"(\\.|[^"\\])*"/);
      if (!matchString) {
        break;
      }
      parts.push(matchString[0].replace(/\\/g, ''));
      src = src.slice(matchString[0].length);
      continue;
    }
    const token = src.match(/^[^\s "=]+/);
    if (token) {
      parts.push(token[0]);
      src = src.slice(token[0].length);
      continue;
    }
    break;
  }
  return parts;
}

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
import cloneDeep from 'lodash/cloneDeep';

class TagErrorListener implements ANTLRErrorListener<Token> {
  log: LogMessage[] = [];
  syntaxError(
    recognizer: unknown,
    offendingSymbol: Token | undefined,
    line: number,
    charPositionInLine: number,
    msg: string,
    _e: unknown
  ): void {
    const errAt = {line: 0, character: charPositionInLine};
    const range = {start: errAt, end: errAt};
    const logMsg: LogMessage = {
      message: msg,
      at: {url: '', range},
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

function parsePath(buildOn: Tag, path: string[]): [string, TagDict] {
  let writeInto = buildOn.getProperties();
  for (const p of path.slice(0, path.length - 1)) {
    let next: Tag;
    if (writeInto[p] === undefined) {
      next = new Tag({});
      writeInto[p] = next;
    } else {
      next = Tag.tagFrom(writeInto[p]);
    }
    writeInto = next.getProperties();
  }
  return [path[path.length - 1], writeInto];
}

function getString(ctx: StringContext) {
  return ctx.BARE_STRING() ? ctx.text : parseString(ctx.text, ctx.text[0]);
}

interface TagParse {
  tag: Tag;
  log: LogMessage[];
}

/**
 * If the string starts with #, then it skips all characters up to the first space
 * and parses the rest of the line, otherwise it parses the whole line.
 * @param source The source line to be parsed
 * @returns { tag: Parsed Properties, log: Parse Errors[] }
 */
export function parseTagline(
  source: string,
  extending: Tag | undefined,
  outerScope: Tag | undefined
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
  const taglineParser = new MalloyTagParser(tokenStream);
  taglineParser.removeErrorListeners();
  const pLog = new TagErrorListener();
  taglineParser.addErrorListener(pLog);
  const tagTree = taglineParser.tagLine();
  const treeWalker = new TaglineParser(outerScope);
  const tag = treeWalker.tagLineToTag(tagTree, extending);
  return {tag, log: pLog.log};
}

class TaglineParser
  extends AbstractParseTreeVisitor<Tag>
  implements MalloyTagVisitor<Tag>
{
  scopes: Tag[] = [];
  constructor(outerScope: Tag | undefined) {
    super();
    if (outerScope) {
      this.scopes.push(outerScope);
    }
  }

  defaultResult() {
    return new Tag();
  }

  visitString(ctx: StringContext): Tag {
    return new Tag({eq: getString(ctx)});
  }

  protected getPropName(ctx: PropNameContext): string[] {
    return ctx.string().map(cx => getString(cx));
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
      if (scope.tag([path[0]])) {
        const refTo = scope.tag(path);
        if (refTo) {
          return refTo.clone();
        }
        break;
      }
    }
    // MTOY TODO SYNTAX ERROR NOT FOUND
    return this.defaultResult();
  }

  visitTagEq(ctx: TagEqContext): Tag {
    const buildOn = getBuildOn(ctx);
    const name = this.getPropName(ctx.propName());
    const [writeKey, writeInto] = parsePath(buildOn, name);
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
    const [writeKey, writeInto] = parsePath(buildOn, name);
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
    const [writeKey, writeInto] = parsePath(buildOn, name);
    const propCx = ctx.properties();
    propCx['buildOn'] = Tag.tagFrom(writeInto[writeKey]);
    const props = this.visitProperties(propCx);
    const thisObj = writeInto[writeKey] || {};
    const properties = {...thisObj.properties, ...props.dict};
    writeInto[writeKey] = {...thisObj, properties};
    return buildOn;
  }

  visitTagDef(ctx: TagDefContext): Tag {
    const buildOn = getBuildOn(ctx);
    const path = this.getPropName(ctx.propName());
    const [writeKey, writeInto] = parsePath(buildOn, path);
    if (ctx.MINUS()) {
      delete writeInto[writeKey];
    } else {
      writeInto[writeKey] = {};
    }
    return buildOn;
  }
}
