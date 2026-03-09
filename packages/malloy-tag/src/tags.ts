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

/**
 * Source location for a Tag node. Structurally compatible with
 * DocumentLocation from the malloy package.
 */
export interface TagLocation {
  url: string;
  range: {
    start: {line: number; character: number};
    end: {line: number; character: number};
  };
}

// TagInterface exists for tests and serialization only.
// Internally, Tag uses Tag instances for properties and array elements.
export type TagDict = Record<string, TagInterface>;

export type TagScalar = string | number | boolean | Date;
type TagValue = TagScalar | Tag[];

// Input format - for tests and constructors (no links)
export interface TagInterface {
  eq?: TagScalar | TagInterface[];
  properties?: TagDict;
  deleted?: boolean;
  prefix?: string;
}

export interface TagJSON {
  eq?: TagScalar | TagJSON[];
  properties?: Record<string, TagJSON>;
  deleted?: boolean;
  prefix?: string;
  location?: TagLocation;
}

export interface TagParse {
  tag: Tag;
  log: TagError[];
}

export type PathSegment = string | number;
export type Path = PathSegment[];

export type TagSetValue =
  | string
  | number
  | boolean
  | Date
  | string[]
  | number[]
  | Tag
  | null;

/**
 * Class for interacting with the parsed output of an annotation
 * containing the Malloy tag language. Used by the parser to
 * generate parsed data, and as an API to that data.
 * ```
 * tag.text(p?)         => string value of tag.p or undefined
 * tag.numeric(p?)      => numeric value of tag.p or undefined
 * tag.boolean(p?)      => boolean value of tag.p or undefined
 * tag.isTrue(p?)       => true if tag.p is boolean true
 * tag.isFalse(p?)      => true if tag.p is boolean false
 * tag.date(p?)         => Date value of tag.p or undefined
 * tag.array(p?)        => Tag[] value of tag.p or undefined
 * tag.textArray(p?)    => string[] value of elements in tag.p or undefined
 * tag.numericArray(p?) => number[] value of elements in tag.p or undefined
 * tag.tag(p?)          => Tag value of tag.p
 * tag.has(p?)          => boolean "tag contains tag.p"
 * tag.bare(p?)         => tag.p exists and has no properties
 * tag.dict             => Record<string,Tag> of tag properties
 * ```
 */
export class Tag {
  eq?: TagValue;
  properties?: Record<string, Tag>;
  prefix?: string;
  deleted?: boolean;
  location?: TagLocation;
  private _parent?: Tag;
  protected _read = false;
  protected _clonedFrom?: Tag;

  /**
   * Get the parent tag, if this tag is part of a tree.
   */
  get parent(): Tag | undefined {
    return this._parent;
  }

  /**
   * Get the root tag by traversing up the parent chain.
   * Returns this tag if it has no parent.
   */
  get root(): Tag {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    let current: Tag = this;
    while (current._parent !== undefined) {
      current = current._parent;
    }
    return current;
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
    if (this.eq !== undefined) {
      if (Array.isArray(this.eq)) {
        str += `\n${spaces}  =: [\n${spaces}    ${this.eq
          .map(el => el.peek(indent + 4))
          .join(`\n${spaces}    `)}\n${spaces}  ]`;
      } else {
        str += `\n${spaces}  =: ${this.eq}`;
      }
    }

    if (this.properties) {
      for (const k in this.properties) {
        str += `\n${spaces}  ${k}: ${this.properties[k].peek(indent + 2)}`;
      }
    }
    str += `\n${spaces}}`;
    return str;
  }

  constructor(from: TagInterface = {}, parent?: Tag) {
    if (parent !== undefined) {
      this._parent = parent;
    }
    if (from.eq !== undefined) {
      if (Array.isArray(from.eq)) {
        // Convert array elements to Tags
        this.eq = from.eq.map(el =>
          el instanceof Tag ? el : new Tag(el, this)
        );
      } else {
        this.eq = from.eq;
      }
    }
    if (from.properties) {
      // Convert property values to Tags
      this.properties = {};
      for (const [key, val] of Object.entries(from.properties)) {
        this.properties[key] = val instanceof Tag ? val : new Tag(val, this);
      }
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
    const val = this.find(at)?.getEq();
    if (val === undefined || Array.isArray(val)) {
      return undefined;
    }
    if (val instanceof Date) {
      return val.toISOString();
    }
    return String(val);
  }

  scalarType(
    ...at: Path
  ): 'string' | 'number' | 'boolean' | 'date' | undefined {
    const val = at.length > 0 ? this.find(at)?.getEq() : this.getEq();
    if (val === undefined || Array.isArray(val)) return undefined;
    if (val instanceof Date) return 'date';
    return typeof val as 'string' | 'number' | 'boolean';
  }

  numeric(...at: Path): number | undefined {
    const val = this.find(at)?.getEq();
    if (typeof val === 'number') {
      return val;
    }
    if (typeof val === 'string') {
      const num = Number.parseFloat(val);
      if (!Number.isNaN(num)) {
        return num;
      }
    }
    return undefined;
  }

  boolean(...at: Path): boolean | undefined {
    const val = this.find(at)?.getEq();
    if (typeof val === 'boolean') {
      return val;
    }
    return undefined;
  }

  isTrue(...at: Path): boolean {
    return this.find(at)?.getEq() === true;
  }

  isFalse(...at: Path): boolean {
    return this.find(at)?.getEq() === false;
  }

  date(...at: Path): Date | undefined {
    const val = this.find(at)?.getEq();
    if (val instanceof Date) {
      return val;
    }
    return undefined;
  }

  bare(...at: Path): boolean | undefined {
    const p = this.find(at);
    if (p === undefined) {
      return;
    }
    return !p.hasProperties();
  }

  getEq(): TagValue | undefined {
    return this.eq;
  }

  getProperty(name: string): Tag | undefined {
    return this.properties?.[name];
  }

  getArrayElement(index: number): Tag | undefined {
    if (Array.isArray(this.eq) && index < this.eq.length) {
      return this.eq[index];
    }
    return undefined;
  }

  get dict(): Record<string, Tag> {
    return this.properties ?? {};
  }

  /** Iterate over [name, Tag] pairs for each property */
  *entries(): Generator<[string, Tag]> {
    if (this.properties) {
      for (const key in this.properties) {
        yield [key, this.properties[key]];
      }
    }
  }

  /** Iterate over property names */
  *keys(): Generator<string> {
    if (this.properties) {
      for (const key in this.properties) {
        yield key;
      }
    }
  }

  /** Check if this tag has any properties */
  hasProperties(): boolean {
    return (
      this.properties !== undefined && Object.keys(this.properties).length > 0
    );
  }

  array(...at: Path): Tag[] | undefined {
    const found = this.find(at);
    if (found === undefined) {
      return undefined;
    }
    const arr = found.getEq();
    if (!Array.isArray(arr)) {
      return undefined;
    }
    return arr.map((_, i) => found.getArrayElement(i)!);
  }

  textArray(...at: Path): string[] | undefined {
    const found = this.find(at);
    if (found === undefined) {
      return undefined;
    }
    const arr = found.getEq();
    if (!Array.isArray(arr)) {
      return undefined;
    }
    return arr.reduce<string[]>((allStrs, _, i) => {
      const el = found.getArrayElement(i);
      const val = el?.getEq();
      if (val === undefined || Array.isArray(val)) {
        return allStrs;
      }
      if (val instanceof Date) {
        return allStrs.concat(val.toISOString());
      }
      return allStrs.concat(String(val));
    }, []);
  }

  numericArray(...at: Path): number[] | undefined {
    const found = this.find(at);
    if (found === undefined) {
      return undefined;
    }
    const arr = found.getEq();
    if (!Array.isArray(arr)) {
      return undefined;
    }
    return arr.reduce<number[]>((allNums, _, i) => {
      const el = found.getArrayElement(i);
      const val = el?.getEq();
      if (typeof val === 'number') {
        return allNums.concat(val);
      }
      if (typeof val === 'string') {
        const num = Number.parseFloat(val);
        if (!Number.isNaN(num)) {
          return allNums.concat(num);
        }
      }
      return allNums;
    }, []);
  }

  // Has the sometimes desirable side effect of initializing properties
  getProperties(): Record<string, Tag> {
    if (this.properties === undefined) {
      this.properties = {};
    }
    return this.properties;
  }

  clone(newParent?: Tag): Tag {
    // Mark the source as read — cloning consumes the original.
    this._read = true;
    const cloned = new Tag({}, newParent);
    cloned.prefix = this.prefix;
    cloned.deleted = this.deleted;
    cloned.location = this.location;
    cloned._clonedFrom = this;

    if (this.eq !== undefined) {
      if (Array.isArray(this.eq)) {
        cloned.eq = this.eq.map(el => el.clone(cloned));
      } else {
        // Scalar value - copy directly (Date needs special handling)
        cloned.eq = this.eq instanceof Date ? new Date(this.eq) : this.eq;
      }
    }

    if (this.properties) {
      cloned.properties = {};
      for (const [key, val] of Object.entries(this.properties)) {
        cloned.properties[key] = val.clone(cloned);
      }
    }

    return cloned;
  }

  /**
   * Custom JSON serialization that excludes _parent to avoid circular references.
   * This is called automatically by JSON.stringify().
   */
  toJSON(): TagJSON {
    const result: TagJSON = {};
    if (this.eq !== undefined) {
      if (Array.isArray(this.eq)) {
        result.eq = this.eq.map(el => el.toJSON());
      } else {
        result.eq = this.eq;
      }
    }
    if (this.properties !== undefined) {
      result.properties = {};
      for (const [key, val] of Object.entries(this.properties)) {
        result.properties[key] = val.toJSON();
      }
    }
    if (this.deleted) {
      result.deleted = true;
    }
    if (this.prefix) {
      result.prefix = this.prefix;
    }
    if (this.location) {
      result.location = this.location;
    }
    return result;
  }

  /**
   * Validate all references in this tag tree.
   * Returns an array of error messages for unresolved references.
   */
  validateReferences(): string[] {
    const errors: string[] = [];
    this.collectReferenceErrors(errors, []);
    return errors;
  }

  /**
   * Recursively collect reference errors.
   */
  collectReferenceErrors(errors: string[], path: string[]): void {
    if (this.properties) {
      for (const [key, prop] of Object.entries(this.properties)) {
        if (!prop.deleted) {
          prop.collectReferenceErrors(errors, [...path, key]);
        }
      }
    }
    if (Array.isArray(this.eq)) {
      this.eq.forEach((el, i) => {
        el.collectReferenceErrors(errors, [...path, `[${i}]`]);
      });
    }
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

  private static serializeScalar(val: TagScalar): string {
    if (typeof val === 'boolean') {
      return val ? '@true' : '@false';
    }
    if (val instanceof Date) {
      return `@${val.toISOString()}`;
    }
    if (typeof val === 'number') {
      return String(val);
    }
    return Tag.quoteAndEscape(val);
  }

  toString(): string {
    let annotation = this.prefix ?? '# ';
    function addChildren(tag: TagInterface) {
      const props = Object.keys(tag.properties ?? {});
      for (let i = 0; i < props.length; i++) {
        addChild(props[i], tag.properties![props[i]]);
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
          annotation += Tag.serializeScalar(child.eq);
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
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    let currentTag: Tag = this;
    for (const segment of path) {
      let next: Tag | undefined;
      if (typeof segment === 'number') {
        next = currentTag.getArrayElement(segment);
      } else {
        next = currentTag.getProperty(segment);
      }
      if (next === undefined) {
        return undefined;
      }
      next.markRead();
      currentTag = next;
    }
    return currentTag.deleted ? undefined : currentTag;
  }

  /**
   * Mark this tag as read, propagating to the original if this is a clone.
   * Only propagates one level (clone→original). This is sufficient because
   * set() is the only operation that creates clones, and it doesn't chain.
   */
  private markRead(): void {
    this._read = true;
    if (this._clonedFrom) {
      this._clonedFrom._read = true;
    }
  }

  /**
   * Returns true if this tag was accessed via find/has/text/etc.
   */
  get wasRead(): boolean {
    return this._read;
  }

  /**
   * Walk the tag tree, yielding each descendant tag with its path.
   * Covers named properties and array element values. Pre-order traversal.
   * Skips deleted properties.
   */
  *walk(prefix: string[] = []): Generator<{path: string[]; tag: Tag}> {
    if (this.properties) {
      for (const [key, prop] of Object.entries(this.properties)) {
        if (prop.deleted) continue;
        const path = [...prefix, key];
        yield {path, tag: prop};
        yield* prop.walk(path);
      }
    }
    if (Array.isArray(this.eq)) {
      for (let i = 0; i < this.eq.length; i++) {
        const path = [...prefix, i.toString()];
        yield {path, tag: this.eq[i]};
        yield* this.eq[i].walk(path);
      }
    }
  }

  /**
   * Recursively reset read tracking on this tag and all descendants.
   */
  resetReadTracking(): void {
    this._read = false;
    for (const {tag} of this.walk()) {
      tag._read = false;
    }
  }

  /**
   * Collect all unread, non-deleted property names in this tag tree.
   * Returns paths like ['viz', 'yy'] for nested unread properties.
   */
  getUnreadProperties(prefix: string[] = []): string[][] {
    const unread: string[][] = [];
    if (this.properties) {
      for (const [key, prop] of Object.entries(this.properties)) {
        if (prop.deleted) continue;
        const path = [...prefix, key];
        if (!prop._read) {
          unread.push(path);
        } else {
          // Recurse into read tags to find unread sub-properties
          unread.push(...prop.getUnreadProperties(path));
        }
      }
    }
    return unread;
  }

  has(...path: Path): boolean {
    return this.find(path) !== undefined;
  }

  set(path: Path, value: TagSetValue = null): Tag {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    let currentTag: Tag = this;
    let parentTag: Tag | undefined;
    let lastSegment: PathSegment | undefined;

    for (const segment of path) {
      parentTag = currentTag;
      lastSegment = segment;
      if (typeof segment === 'number') {
        if (currentTag.eq === undefined || !Array.isArray(currentTag.eq)) {
          currentTag.eq = Array.from({length: segment + 1}).map(
            () => new Tag({}, currentTag)
          );
        } else if (currentTag.eq.length <= segment) {
          const values = currentTag.eq;
          const newVal = Array.from({length: segment + 1}).map((_, i) =>
            i < values.length ? values[i] : new Tag({}, currentTag)
          );
          currentTag.eq = newVal;
        }
        currentTag = currentTag.eq[segment];
      } else {
        const properties = currentTag.properties;
        if (properties === undefined) {
          currentTag.properties = {[segment]: new Tag({}, currentTag)};
          currentTag = currentTag.properties[segment];
        } else if (segment in properties) {
          currentTag = properties[segment];
          if (currentTag.deleted) {
            currentTag.deleted = false;
          }
        } else {
          properties[segment] = new Tag({}, currentTag);
          currentTag = properties[segment];
        }
      }
    }

    if (value === null) {
      currentTag.eq = undefined;
    } else if (value instanceof Tag) {
      // Clone the tag with correct parent and replace in parent's slot
      const cloned = value.clone(parentTag);
      if (parentTag && lastSegment !== undefined) {
        if (typeof lastSegment === 'number' && Array.isArray(parentTag.eq)) {
          parentTag.eq[lastSegment] = cloned;
        } else if (typeof lastSegment === 'string' && parentTag.properties) {
          parentTag.properties[lastSegment] = cloned;
        }
      }
    } else if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      value instanceof Date
    ) {
      currentTag.eq = value;
    } else if (Array.isArray(value)) {
      currentTag.eq = value.map((v: string | number) => {
        return new Tag({eq: v}, currentTag);
      });
    }
    return this;
  }

  delete(...path: Path): Tag {
    return this.remove(path, false);
  }

  unset(...path: Path): Tag {
    return this.remove(path, true);
  }

  private remove(path: Path, hard = false): Tag {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    let currentTag: Tag = this;
    for (const segment of path.slice(0, path.length - 1)) {
      if (typeof segment === 'number') {
        if (currentTag.eq === undefined || !Array.isArray(currentTag.eq)) {
          if (!hard) return this;
          currentTag.eq = Array.from({length: segment}).map(
            () => new Tag({}, currentTag)
          );
        } else if (currentTag.eq.length <= segment) {
          if (!hard) return this;
          const values = currentTag.eq;
          const newVal = Array.from({length: segment}).map((_, i) =>
            i < values.length ? values[i] : new Tag({}, currentTag)
          );
          currentTag.eq = newVal;
        }
        currentTag = currentTag.eq[segment];
      } else {
        const properties = currentTag.properties;
        if (properties === undefined) {
          if (!hard) return this;
          currentTag.properties = {[segment]: new Tag({}, currentTag)};
          currentTag = currentTag.properties[segment];
        } else if (segment in properties) {
          currentTag = properties[segment];
        } else {
          if (!hard) return this;
          properties[segment] = new Tag({}, currentTag);
          currentTag = properties[segment];
        }
      }
    }
    const segment = path[path.length - 1];
    if (typeof segment === 'string') {
      if (currentTag.properties && segment in currentTag.properties) {
        delete currentTag.properties[segment];
      } else if (hard) {
        currentTag.properties ??= {};
        currentTag.properties[segment] = new Tag({deleted: true}, currentTag);
      }
    } else {
      if (Array.isArray(currentTag.eq)) {
        currentTag.eq.splice(segment, 1);
      }
    }
    return this;
  }
}

/**
 * Convert a Tag to a plain TagInterface without internal fields like _parent.
 * Useful for test comparisons.
 */
export function interfaceFromTag(tag: TagInterface): TagInterface {
  const result: TagInterface = {};

  if (tag.eq !== undefined) {
    if (Array.isArray(tag.eq)) {
      result.eq = tag.eq.map(el => interfaceFromTag(el));
    } else {
      result.eq = tag.eq;
    }
  }

  if (tag.properties !== undefined) {
    result.properties = interfaceFromDict(tag.properties);
  }

  if (tag.deleted) {
    result.deleted = true;
  }

  return result;
}

/**
 * Convert a TagDict to a plain TagDict without internal fields.
 */
export function interfaceFromDict(dict: TagDict): TagDict {
  const result: TagDict = {};
  for (const [key, val] of Object.entries(dict)) {
    result[key] = interfaceFromTag(val);
  }
  return result;
}
