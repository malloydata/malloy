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

export interface TagError {
  message: string;
  line: number;
  offset: number;
  code: string;
}

export interface TagParse {
  tag: Tag;
  log: TagError[];
}

export type TagDict = Record<string, TagInterface>;

export type TagValue = string | TagInterface[];

export interface TagInterface {
  eq?: TagValue;
  properties?: TagDict;
  deleted?: boolean;
  prefix?: string;
}

type PathSegment = string | number;
type Path = PathSegment[];

export type TagSetValue = string | number | string[] | number[] | null;

/**
 * Class for interacting with the parsed output of an annotation
 * containing the Malloy tag language. You can turn text into tags with
 * ```
 * Tag.fromTagLine(...)  => creates a tag from a line of source
 * Tag.fromTagLines(...) => creates a tag from an array of source lines
 * ```
 *
 * and these are the methods for getting information from parsed tags
 *
 * ```
 * tag.text(p?)         => string value of tag.p or undefined
 * tag.array(p?)        => Tag[] value of tag.p or undefined
 * tag.numeric(p?)      => numeric value of tag.p or undefined
 * tag.textArray(p ?)   => string[] value of elements in tag.p or undefined
 * tag.numericArray(p?) => number[] value of elements in tag.p or undefined
 * tag.tag(p?)           => Tag value of tag.p
 * tag.has(p?)           => boolean "tag contains tag.p"
 * tag.bare(p?)          => tag.p exists and has no properties
 * tag.dict              => Record<string,Tag> of tag properties
 * ```
 */

export class Tag implements TagInterface {
  eq?: TagValue;
  properties?: TagDict;
  prefix?: string;
  deleted?: boolean;

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

  constructor(from: TagInterface = {}) {
    if (from.eq) {
      this.eq = from.eq;
    }
    if (from.properties) {
      this.properties = from.properties;
    }
    if (from.deleted) {
      this.deleted = from.deleted;
    }
    if (from.prefix) {
      this.prefix = from.prefix;
    }
  }

  static withPrefix(prefix: string) {
    return new Tag({prefix});
  }

  tag(...at: Path): Tag | undefined {
    return this.find(at);
  }

  text(...at: Path): string | undefined {
    const str = this.find(at)?.eq;
    if (typeof str === 'string') {
      return str;
    }
  }

  numeric(...at: Path): number | undefined {
    const str = this.find(at)?.eq;
    if (typeof str === 'string') {
      const num = Number.parseFloat(str);
      if (!Number.isNaN(num)) {
        return num;
      }
    }
  }

  bare(...at: Path): boolean | undefined {
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

  array(...at: Path): Tag[] | undefined {
    const array = this.find(at)?.eq;
    if (array === undefined || typeof array === 'string') {
      return undefined;
    }
    return array.map(el =>
      typeof el === 'string' ? new Tag({eq: el}) : Tag.tagFrom(el)
    );
  }

  textArray(...at: Path): string[] | undefined {
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

  numericArray(...at: Path): number[] | undefined {
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

  private static escapeString(str: string) {
    return str
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n');
  }

  private static escapeProp(str: string) {
    return str.replace(/\\/g, '\\\\').replace(/`/g, '\\`');
  }

  private static quoteAndEscape(str: string, isProp = false) {
    if (str.match(/^[0-9A-Za-z_]+$/)) return str;
    if (isProp) return `\`${Tag.escapeProp(str)}\``;
    // TODO consider choosing the quote character based on which quotes appear in the string
    return `"${Tag.escapeString(str)}"`;
  }

  toString(): string {
    let annotation = this.prefix ?? '# ';
    function addChildren(tag: TagInterface) {
      const tagP = tag.properties || {};
      const props = Object.keys(tagP);
      for (let i = 0; i < props.length; i++) {
        addChild(props[i], tagP[props[i]]);
        if (i < props.length - 1) {
          annotation += ' ';
        }
      }
    }
    function addTag(child: TagInterface, isArrayEl = false) {
      if (child.eq !== undefined) {
        if (!isArrayEl) annotation += ' = ';
        if (Array.isArray(child.eq)) {
          annotation += '[';
          for (let i = 0; i < child.eq.length; i++) {
            addTag(child.eq[i], true);
            if (i !== child.eq.length - 1) annotation += ', ';
          }
          annotation += ']';
        } else {
          annotation += Tag.quoteAndEscape(`${child.eq}`);
        }
      }
      if (child.properties) {
        const props = Object.keys(child.properties);
        if (
          !isArrayEl &&
          props.length === 1 &&
          !props.some(c => (child.properties ?? {})[c].deleted) &&
          child.eq === undefined
        ) {
          annotation += '.';
          addChildren(child);
        } else {
          if (!isArrayEl || child.eq !== undefined) annotation += ' ';
          annotation += '{ ';
          addChildren(child);
          annotation += ' }';
        }
      }
    }
    function addChild(prop: string, child: TagInterface) {
      if (child.deleted) {
        annotation += `-${Tag.quoteAndEscape(prop, true)}`;
        return;
      }
      annotation += Tag.quoteAndEscape(prop, true);
      addTag(child);
    }
    addChildren(this);
    annotation += '\n';
    return annotation;
  }

  find(path: Path): Tag | undefined {
    let currentTag: Tag = Tag.tagFrom(this);
    for (const segment of path) {
      if (typeof segment === 'number') {
        if (
          currentTag.eq === undefined ||
          !Array.isArray(currentTag.eq) ||
          currentTag.eq.length <= segment
        ) {
          return;
        }
        currentTag = Tag.tagFrom(currentTag.eq[segment]);
      } else {
        const properties = currentTag.properties ?? {};
        if (segment in properties) {
          currentTag = Tag.tagFrom(properties[segment]);
        } else {
          return;
        }
      }
    }
    return currentTag.deleted ? undefined : currentTag;
  }

  /**
   * Walk the path. Called from the tag parser.
   *
   * Returns the existing end of the path or new node, with the side effect of creating
   * missing nodes on the way to the end of the path.
   *
   * Similar to "find" except find can fail to find and walkTo doesn't have the
   * weird ability to use numbers to index the eq value.
   *
   */
  walkTo(path: string[]): Tag {
    let got_to = Tag.tagFrom(this); // got_to = this, no idea why Typescript hates that
    for (const segment of path) {
      const theProps = got_to.getProperties();
      const nextStep = theProps[segment] || {};
      if (!(nextStep instanceof Tag)) {
        got_to = new Tag(nextStep);
        theProps[segment] = got_to;
      } else {
        got_to = nextStep;
      }
    }
    return got_to;
  }

  has(...path: Path): boolean {
    return this.find(path) !== undefined;
  }

  set(path: Path, value: TagSetValue = null): Tag {
    const copy = Tag.tagFrom(this);
    let currentTag: TagInterface = copy;
    for (const segment of path) {
      if (typeof segment === 'number') {
        if (currentTag.eq === undefined || !Array.isArray(currentTag.eq)) {
          currentTag.eq = Array.from({length: segment + 1}).map(_ => ({}));
        } else if (currentTag.eq.length <= segment) {
          const values = currentTag.eq;
          const newVal = Array.from({length: segment + 1}).map((_, i) =>
            i < values.length ? values[i] : {}
          );
          currentTag.eq = newVal;
        }
        currentTag = currentTag.eq[segment];
      } else {
        const properties = currentTag.properties;
        if (properties === undefined) {
          currentTag.properties = {[segment]: {}};
          currentTag = currentTag.properties[segment];
        } else if (segment in properties) {
          currentTag = properties[segment];
          if (currentTag.deleted) {
            currentTag.deleted = false;
          }
        } else {
          properties[segment] = {};
          currentTag = properties[segment];
        }
      }
    }
    if (value === null) {
      currentTag.eq = undefined;
    } else if (typeof value === 'string') {
      currentTag.eq = value;
    } else if (typeof value === 'number') {
      currentTag.eq = value.toString(); // TODO big numbers?
    } else if (Array.isArray(value)) {
      currentTag.eq = value.map((v: string | number) => {
        return {eq: typeof v === 'string' ? v : v.toString()};
      });
    }
    return copy;
  }

  delete(...path: Path): Tag {
    return this.remove(path, false);
  }

  unset(...path: Path): Tag {
    return this.remove(path, true);
  }

  private remove(path: Path, hard = false): Tag {
    const origCopy = Tag.tagFrom(this);
    let currentTag: TagInterface = origCopy;
    for (const segment of path.slice(0, path.length - 1)) {
      if (typeof segment === 'number') {
        if (currentTag.eq === undefined || !Array.isArray(currentTag.eq)) {
          if (!hard) return origCopy;
          currentTag.eq = Array.from({length: segment}).map(_ => ({}));
        } else if (currentTag.eq.length <= segment) {
          if (!hard) return origCopy;
          const values = currentTag.eq;
          const newVal = Array.from({length: segment}).map((_, i) =>
            i < values.length ? values[i] : {}
          );
          currentTag.eq = newVal;
        }
        currentTag = currentTag.eq[segment];
      } else {
        const properties = currentTag.properties;
        if (properties === undefined) {
          if (!hard) return origCopy;
          currentTag.properties = {[segment]: {}};
          currentTag = currentTag.properties[segment];
        } else if (segment in properties) {
          currentTag = properties[segment];
        } else {
          if (!hard) return origCopy;
          properties[segment] = new Tag({});
          currentTag = properties[segment];
        }
      }
    }
    const segment = path[path.length - 1];
    if (typeof segment === 'string') {
      if (hard) {
        currentTag.properties ??= {};
        currentTag.properties[segment] = new Tag({deleted: true});
      } else if (currentTag.properties && segment in currentTag.properties) {
        delete currentTag.properties[segment];
      }
    } else {
      if (Array.isArray(currentTag.eq)) {
        currentTag.eq.splice(segment, 1);
      }
    }
    return this;
  }

  /**
   * Parse a line of Malloy tag language into a Tag which can be queried
   * @param source -- The source line to be parsed. If the string starts with #, then it skips
   *   all characters up to the first space.
   * @param lineNumber -- A line number to be associated with the parse errors.
   * @param extending A tag which this line will be extending
   * @param importing Outer "scopes" for $() references
   * @returns Something shaped like { tag: Tag, log: ParseErrors[] }
   */
  static fromTagLine(
    source: string,
    lineNumber = 0,
    extending?: Tag,
    ...importing: Tag[]
  ): TagParse {
    return parseTagLine(source, extending, importing, lineNumber);
  }

  /**
   * Parse multiple lines of Malloy tag language, merging them into a single Tag
   * @param lines -- The source line to be parsed. If the string starts with #, then it skips
   *   all characters up to the first space.
   * @param extending A tag which this line will be extending
   * @param importing Outer "scopes" for $() references
   * @returns Something shaped like { tag: Tag, log: ParseErrors[] }
   */
  static fromTagLines(lines: string[], extending?: Tag, ...importing: Tag[]) {
    const allErrs: TagError[] = [];
    let current: Tag | undefined = extending;
    for (let i = 0; i < lines.length; i++) {
      const text = lines[i];
      const noteParse = parseTagLine(text, current, importing, i);
      current = noteParse.tag;
      allErrs.push(...noteParse.log);
    }
    return {tag: current, log: allErrs};
  }
}

import * as nearley from 'nearley';
import grammar_spec from './lib/MalloyTagNew';
import * as ast from './new-tag-ast';

let tag_grammar: nearley.Grammar | undefined = undefined;

function parseTagLine(
  source: string,
  extending: Tag | undefined,
  _outerScope: Tag[], // mtoy TODO use this
  _onLine: number // mtoy TODO use this
): TagParse {
  if (source[0] === '#') {
    const skipTo = source.indexOf(' ');
    if (skipTo > 0) {
      source = source.slice(skipTo + 1);
    } else {
      source = '';
    }
  }
  tag_grammar ||= nearley.Grammar.fromCompiled(grammar_spec);
  const tag_parser = new nearley.Parser(tag_grammar);
  try {
    tag_parser.feed(source);
    const parsed = tag_parser.finish();
    // eslint-disable-next-line no-console
    if (parsed.length > 1) {
      return {
        tag: new Tag({}),
        log: [
          {
            message: 'GRAMMAR FAULT: ambiguous parse',
            line: 0,
            offset: 0,
            code: source,
          },
        ],
      };
    }
    const firstTree = parsed[0];
    if (ast.isAnyAstNode(firstTree)) {
      const into = extending?.clone() || new Tag();
      tagAstToTag(firstTree, into);
      return {
        tag: into,
        log: [],
      };
    }
    throw new Error(
      `IMPOSSIBLE: Tag Source: '${source}' parsed without errors but did not produce a known AST node`
    );
  } catch (e) {
    return {
      tag: new Tag({}),
      log: [
        {
          message: `Tag Parser Error:\n${e.message}`,
          line: 0,
          offset: 0,
          code: source,
        },
      ],
    };
  }
}

export function tagAstToTag(n: ast.AnyAstNode, into: Tag) {
  switch (n.type) {
    case 'TagSpec_MinusProp':
      {
        if (n.isNegated) {
          into.unset(...n.propName.value);
        } else {
          into.walkTo(n.propName.value);
        }
      }
      break;
    case 'TagLine': {
      for (const spec of n.tags) {
        tagAstToTag(spec, into);
      }
      break;
    }
    case 'TagSpec_EqValue': {
      const dest = into.walkTo(n.propName.value);
      const eq = n.value;
      if (eq.type === 'StringLiteral' || eq.type === 'NumberLiteral') {
        dest.eq = eq.value;
      } else if (eq.type === 'ArrayValue') {
        dest.eq = arrayValue(eq);
      }
      if (n.properties) {
        applyProps(dest, !n.properties.isDotty, n.properties);
      } else {
        dest.properties = undefined;
      }
      break;
    }
    case 'TagSpec_MinusDotty': {
      into.properties = {};
      break;
    }
    case 'TagSpec_PropOnly': {
      applyProps(into.walkTo(n.propName.value), false, n.properties);
      break;
    }
    case 'TagSpec_EqDotty': {
      const dest = into.walkTo(n.propName.value);
      if (!n.isDotty) {
        delete dest.eq;
      }
      applyProps(
        into.walkTo(n.propName.value),
        !n.properties.isDotty,
        n.properties
      );
      break;
    }
    default:
      throw new Error(`No handler for node ${n.type}`);
  }
}

function applyProps(t: Tag, replace: boolean, p: ast.Properties | undefined) {
  if (p) {
    if (replace) {
      t.properties = undefined;
    }
    for (const prop of p.tags) {
      tagAstToTag(prop, t);
    }
  }
}

function arrayValue(a: ast.ArrayValue): Tag[] {
  return a.elements.map(av => {
    switch (av.value.type) {
      case 'StringLiteral': {
        const v = new Tag({eq: av.value.value});
        if (av.properties) {
          applyProps(v, true, av.properties);
        }
        return v;
      }
      case 'NumberLiteral':
        return new Tag({eq: av.value.value});
      case 'Properties': {
        const el = new Tag({});
        applyProps(el, true, av.value);
        return el;
      }
      case 'ArrayValue': {
        const nestedArray = arrayValue(av.value);
        return new Tag({eq: nestedArray});
      }
    }
  });
}
