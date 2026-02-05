/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {TagDict, TagInterface} from '../tags';
import {Tag} from '../tags';
import type {TagStatement, TagValue, ArrayElement} from './statements';

export interface InterpreterError {
  message: string;
  code: string;
}

export interface InterpreterResult {
  tag: Tag;
  errors: InterpreterError[];
}

/**
 * Executes TagStatements to build a Tag object.
 */
export class Interpreter {
  private scopes: Tag[] = [];
  private errors: InterpreterError[] = [];

  constructor(outerScopes: Tag[] = []) {
    this.scopes = [...outerScopes];
  }

  execute(statements: TagStatement[], extending?: Tag): InterpreterResult {
    const tag = extending?.clone() ?? new Tag({});
    this.scopes.unshift(tag);

    for (const stmt of statements) {
      this.executeStatement(stmt, tag);
    }

    return {tag, errors: this.errors};
  }

  private executeStatement(stmt: TagStatement, tag: Tag): void {
    switch (stmt.kind) {
      case 'setEq':
        this.executeSetEq(stmt, tag);
        break;
      case 'replaceProperties':
        this.executeReplaceProperties(stmt, tag);
        break;
      case 'updateProperties':
        this.executeUpdateProperties(stmt, tag);
        break;
      case 'define':
        this.executeDefine(stmt, tag);
        break;
      case 'clearAll':
        tag.properties = {};
        break;
    }
  }

  private executeSetEq(
    stmt: {
      kind: 'setEq';
      path: string[];
      value: TagValue;
      properties?: TagStatement[];
      preserveProperties?: boolean;
    },
    tag: Tag
  ): void {
    const [writeKey, writeInto] = this.buildAccessPath(tag, stmt.path);
    const valueTag = this.resolveValue(stmt.value);

    if (stmt.properties) {
      // name = value { new_properties } - replace properties with new ones
      const propsTag = new Tag({});
      for (const propStmt of stmt.properties) {
        this.executeStatement(propStmt, propsTag);
      }
      writeInto[writeKey] = {...valueTag, properties: propsTag.properties};
    } else if (stmt.preserveProperties) {
      // name = value { ... } - preserve existing properties, update value
      writeInto[writeKey] = {...writeInto[writeKey], ...valueTag};
    } else {
      // name = value - simple assignment
      writeInto[writeKey] = valueTag;
    }
  }

  private executeReplaceProperties(
    stmt: {
      kind: 'replaceProperties';
      path: string[];
      properties: TagStatement[];
      preserveValue: boolean;
    },
    tag: Tag
  ): void {
    const [writeKey, writeInto] = this.buildAccessPath(tag, stmt.path);
    const propsTag = new Tag({});
    for (const propStmt of stmt.properties) {
      this.executeStatement(propStmt, propsTag);
    }

    if (stmt.preserveValue) {
      // name = ... { properties } - preserve value, replace properties
      writeInto[writeKey] = {
        ...writeInto[writeKey],
        properties: propsTag.properties,
      };
    } else {
      // name = { properties } - no value, replace properties
      writeInto[writeKey] = {properties: propsTag.properties};
    }
  }

  private executeUpdateProperties(
    stmt: {
      kind: 'updateProperties';
      path: string[];
      properties: TagStatement[];
    },
    tag: Tag
  ): void {
    const [writeKey, writeInto] = this.buildAccessPath(tag, stmt.path);
    const existing = Tag.tagFrom(writeInto[writeKey] ?? {});

    // Execute nested statements in the context of the existing tag
    for (const propStmt of stmt.properties) {
      this.executeStatement(propStmt, existing);
    }

    const thisObj = writeInto[writeKey] ?? {};
    writeInto[writeKey] = {
      ...thisObj,
      properties: {...thisObj.properties, ...existing.properties},
    };
  }

  private executeDefine(
    stmt: {kind: 'define'; path: string[]; deleted: boolean},
    tag: Tag
  ): void {
    const [writeKey, writeInto] = this.buildAccessPath(tag, stmt.path);
    if (stmt.deleted) {
      writeInto[writeKey] = {deleted: true};
    } else {
      writeInto[writeKey] = {};
    }
  }

  /**
   * Navigate to the parent of the final path segment, creating intermediate
   * tags as needed. Returns [finalKey, parentDict] so caller can write to it.
   */
  private buildAccessPath(tag: Tag, path: string[]): [string, TagDict] {
    let parentDict = tag.getProperties();

    for (const segment of path.slice(0, -1)) {
      let next: Tag;
      if (parentDict[segment] === undefined) {
        next = new Tag({});
        parentDict[segment] = next;
      } else {
        // Ensure properties exists on this intermediate tag
        parentDict[segment].properties ??= {};
        next = Tag.tagFrom(parentDict[segment]);
      }
      parentDict = next.getProperties();
    }

    return [path[path.length - 1], parentDict];
  }

  /**
   * Resolve a TagValue to a TagInterface.
   */
  private resolveValue(value: TagValue): TagInterface {
    switch (value.kind) {
      case 'string':
        return {eq: value.value};
      case 'array':
        return {eq: this.resolveArray(value.elements)};
      case 'reference':
        return this.resolveReference(value.path);
    }
  }

  /**
   * Resolve array elements to TagInterface[].
   */
  private resolveArray(elements: ArrayElement[]): TagInterface[] {
    return elements.map(el => {
      let result: TagInterface = {};

      if (el.value) {
        const resolved = this.resolveValue(el.value);
        result = {...resolved};
      }

      if (el.properties) {
        const propsTag = new Tag({});
        for (const stmt of el.properties) {
          this.executeStatement(stmt, propsTag);
        }
        result.properties = propsTag.properties;
      }

      return result;
    });
  }

  /**
   * Resolve a $() reference by looking up the path in scopes.
   */
  private resolveReference(path: string[]): TagInterface {
    for (const scope of this.scopes) {
      // First scope that has the first path component gets to resolve the whole path
      if (scope.has(path[0])) {
        const refTo = scope.tag(...path);
        if (refTo) {
          return structuredClone(refTo);
        }
        break;
      }
    }

    this.errors.push({
      code: 'tag-property-not-found',
      message: `Reference to undefined property ${path.join('.')}`,
    });
    return {};
  }
}
