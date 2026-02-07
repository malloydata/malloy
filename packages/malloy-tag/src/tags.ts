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

// The distinction between the interface and the Tag class exists solely to
// make it possible to write tests and specify expected results This
// is why only TagDict interface is exported.
export type TagDict = Record<string, TagInterface>;

export type TagScalar = string | number | boolean | Date;
type TagValue = TagScalar | TagInterface[];

export interface TagInterface {
  eq?: TagValue;
  properties?: TagDict;
  deleted?: boolean;
  prefix?: string;
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
 * tag.toObject()       => Plain JS object representation
 * ```
 */
export class Tag implements TagInterface {
  eq?: TagValue;
  properties?: TagDict;
  prefix?: string;
  deleted?: boolean;
  private _parent?: Tag;

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

  /**
   * Convert a TagInterface to a Tag, setting parent if provided.
   * If already a Tag, returns it directly (parent unchanged).
   */
  static tagFrom(from: TagInterface = {}, parent?: Tag) {
    if (from instanceof Tag) {
      return from;
    }
    return new Tag(from, parent);
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
          .map(el => Tag.tagFrom(el).peek(indent + 4))
          .join(`\n${spaces}    `)}\n${spaces}  ]`;
      } else {
        str += `\n${spaces}  =: ${this.eq}`;
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

  constructor(from: TagInterface = {}, parent?: Tag) {
    if (from.eq !== undefined) {
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
    if (parent !== undefined) {
      this._parent = parent;
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

  /** Virtual accessor for eq - overridden in RefTag to resolve */
  getEq(): TagValue | undefined {
    return this.eq;
  }

  /** Virtual accessor for a property - overridden in RefTag to resolve */
  getProperty(name: string): Tag | undefined {
    const props = this.properties;
    if (props && name in props) {
      return Tag.tagFrom(props[name], this);
    }
    return undefined;
  }

  /** Virtual accessor for an array element - overridden in RefTag to resolve */
  getArrayElement(index: number): Tag | undefined {
    if (Array.isArray(this.eq) && index < this.eq.length) {
      return Tag.tagFrom(this.eq[index], this);
    }
    return undefined;
  }

  get dict(): Record<string, Tag> {
    const newDict: Record<string, Tag> = {};
    if (this.properties) {
      for (const key in this.properties) {
        newDict[key] = Tag.tagFrom(this.properties[key], this);
      }
    }
    return newDict;
  }

  /** Iterate over [name, Tag] pairs for each property */
  *entries(): Generator<[string, Tag]> {
    if (this.properties) {
      for (const key in this.properties) {
        yield [key, Tag.tagFrom(this.properties[key], this)];
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
  getProperties(): TagDict {
    if (this.properties === undefined) {
      this.properties = {};
    }
    return this.properties;
  }

  clone(): Tag {
    return new Tag(structuredClone(this));
  }

  private static scalarToObject(
    val: TagScalar
  ): string | number | boolean | Date {
    return val;
  }

  private static tagToObject(tag: TagInterface): unknown {
    const hasProps =
      tag.properties !== undefined && Object.keys(tag.properties).length > 0;
    const hasValue = tag.eq !== undefined;

    // Bare tag (no value, no properties)
    if (!hasValue && !hasProps) {
      return true;
    }

    // Properties only
    if (!hasValue && hasProps) {
      const result: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(tag.properties!)) {
        if (!val.deleted) {
          result[key] = Tag.tagToObject(val);
        }
      }
      return result;
    }

    // Value only
    if (hasValue && !hasProps) {
      if (Array.isArray(tag.eq)) {
        return tag.eq.map(el => Tag.tagToObject(el));
      }
      return Tag.scalarToObject(tag.eq!);
    }

    // Both value and properties
    const result: Record<string, unknown> = {};
    if (Array.isArray(tag.eq)) {
      result['='] = tag.eq.map(el => Tag.tagToObject(el));
    } else {
      result['='] = Tag.scalarToObject(tag.eq!);
    }
    for (const [key, val] of Object.entries(tag.properties!)) {
      if (!val.deleted) {
        result[key] = Tag.tagToObject(val);
      }
    }
    return result;
  }

  /**
   * Convert to a plain JS object. References are resolved to actual
   * object pointers (which may be circular in JS - that's fine).
   * @param resolving - RefTags currently being resolved (for cycle detection)
   */
  toObject(resolving: Set<RefTag> = new Set()): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    if (this.properties) {
      for (const [key, prop] of Object.entries(this.properties)) {
        if (!prop.deleted) {
          const tag = Tag.tagFrom(prop, this);
          result[key] = tag.toObjectValue(resolving);
        }
      }
    }
    return result;
  }

  /**
   * Convert this tag's value to a plain JS object.
   * Override in RefTag to resolve references.
   * @param resolving - RefTags currently being resolved (for cycle detection)
   */
  toObjectValue(resolving: Set<RefTag>): unknown {
    const hasProps =
      this.properties !== undefined && Object.keys(this.properties).length > 0;
    const hasValue = this.eq !== undefined;

    // Bare tag (no value, no properties)
    if (!hasValue && !hasProps) {
      return true;
    }

    // Properties only
    if (!hasValue && hasProps) {
      return this.toObject(resolving);
    }

    // Value only
    if (hasValue && !hasProps) {
      if (Array.isArray(this.eq)) {
        return this.eq.map(el => {
          const tag = Tag.tagFrom(el, this);
          return tag.toObjectValue(resolving);
        });
      }
      return this.eq;
    }

    // Both value and properties
    const result: Record<string, unknown> = this.toObject(resolving);
    if (Array.isArray(this.eq)) {
      result['='] = this.eq.map(el => {
        const tag = Tag.tagFrom(el, this);
        return tag.toObjectValue(resolving);
      });
    } else {
      result['='] = this.eq;
    }
    return result;
  }

  /**
   * Custom JSON serialization that excludes _parent to avoid circular references.
   * This is called automatically by JSON.stringify().
   */
  toJSON(): unknown {
    const result: TagInterface = {};
    if (this.eq !== undefined) {
      result.eq = this.eq;
    }
    if (this.properties !== undefined) {
      result.properties = this.properties;
    }
    if (this.deleted) {
      result.deleted = true;
    }
    if (this.prefix) {
      result.prefix = this.prefix;
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
          const tag = Tag.tagFrom(prop, this);
          tag.collectReferenceErrors(errors, [...path, key]);
        }
      }
    }
    if (Array.isArray(this.eq)) {
      this.eq.forEach((el, i) => {
        const tag = Tag.tagFrom(el, this);
        tag.collectReferenceErrors(errors, [...path, `[${i}]`]);
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
      currentTag = next;
    }
    return currentTag.deleted ? undefined : currentTag;
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
    } else if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      value instanceof Date
    ) {
      currentTag.eq = value;
    } else if (Array.isArray(value)) {
      currentTag.eq = value.map((v: string | number) => {
        return {eq: v};
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
          properties[segment] = {};
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
        currentTag.properties[segment] = {deleted: true};
      }
    } else {
      if (Array.isArray(currentTag.eq)) {
        currentTag.eq.splice(segment, 1);
      }
    }
    return origCopy;
  }
}

/**
 * A tag that references another location in the tag tree.
 * When accessed, it dereferences to the target tag.
 *
 * Reference syntax:
 *   $path.to.thing     - absolute from root
 *   $^thing            - up one level, then 'thing'
 *   $^^thing           - up two levels, then 'thing'
 *   $items[0].name     - with array indexing
 */
export class RefTag extends Tag {
  readonly ups: number;
  readonly refPath: Path;

  constructor(ups: number, refPath: Path, parent?: Tag) {
    super({}, parent);
    this.ups = ups;
    this.refPath = refPath;
  }

  /**
   * Resolve this reference to the target tag.
   * Returns undefined if the reference cannot be resolved.
   */
  resolve(): Tag | undefined {
    // Start from the appropriate point based on ups
    let current: Tag | undefined;
    if (this.ups === 0) {
      // Absolute reference from root
      current = this.root;
    } else {
      // Relative reference - go up 'ups' levels from parent
      // $^ means go up 1 level from the containing scope
      current = this.parent;
      for (let i = 0; i < this.ups && current !== undefined; i++) {
        current = current.parent;
      }
    }

    if (current === undefined) {
      return undefined;
    }

    // Follow the path
    return current.find(this.refPath);
  }

  /**
   * Convert this reference to its string representation.
   */
  toRefString(): string {
    const prefix = '$' + '^'.repeat(this.ups);
    const pathStr = this.refPath
      .map((seg, i) => {
        if (typeof seg === 'number') {
          return `[${seg}]`;
        }
        return i === 0 ? seg : `.${seg}`;
      })
      .join('');
    return prefix + pathStr;
  }

  // Override virtual accessors to resolve the reference
  override getEq(): TagValue | undefined {
    return this.resolve()?.getEq();
  }

  override getProperty(name: string): Tag | undefined {
    return this.resolve()?.getProperty(name);
  }

  override getArrayElement(index: number): Tag | undefined {
    return this.resolve()?.getArrayElement(index);
  }

  override hasProperties(): boolean {
    return this.resolve()?.hasProperties() ?? false;
  }

  /**
   * For toObject, resolve the reference and return the target's object value.
   * This creates actual object pointers (circular references are allowed).
   * Detects cycles in the reference chain to prevent infinite recursion.
   */
  override toObjectValue(resolving: Set<RefTag>): unknown {
    // Check for cycle in reference chain
    if (resolving.has(this)) {
      // We're in a cycle - return undefined to break it
      // (The cycle will be completed when the outer resolution finishes)
      return undefined;
    }

    const resolved = this.resolve();
    if (resolved === undefined) {
      return undefined;
    }

    // Track that we're resolving this RefTag
    resolving.add(this);
    const result = resolved.toObjectValue(resolving);
    resolving.delete(this);

    return result;
  }

  /**
   * For JSON serialization, return a marker object instead of resolving.
   */
  override toJSON(): unknown {
    return {linkTo: this.toRefString()};
  }

  /**
   * Check if this reference resolves, add error if not.
   */
  override collectReferenceErrors(errors: string[], path: string[]): void {
    if (this.resolve() === undefined) {
      const location = path.length > 0 ? path.join('.') : 'root';
      errors.push(`Unresolved reference at ${location}: ${this.toRefString()}`);
    }
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
