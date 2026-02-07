/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {Tag, RefTag} from '../tags';
import type {TagStatement, TagValue, ArrayElement} from './statements';

/**
 * Executes TagStatements to build a Tag object.
 */
export class Interpreter {
  execute(statements: TagStatement[], extending?: Tag): Tag {
    // Root tag has no parent
    const tag = extending?.clone() ?? new Tag({});

    for (const stmt of statements) {
      this.executeStatement(stmt, tag);
    }

    return tag;
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
    const [writeKey, writeInto, parentTag] = this.buildAccessPath(
      tag,
      stmt.path
    );

    if (stmt.properties) {
      // name = value { new_properties } - replace properties with new ones
      const resultTag = this.createTagWithValue(stmt.value, parentTag);
      for (const propStmt of stmt.properties) {
        this.executeStatement(propStmt, resultTag);
      }
      writeInto[writeKey] = resultTag;
    } else if (stmt.preserveProperties) {
      // name = value { ... } - preserve existing properties, update value
      const existing = writeInto[writeKey];
      if (existing && stmt.value.kind !== 'reference') {
        // Update value in place, preserving properties and parent chains
        this.setTagValue(existing, stmt.value);
      } else {
        // No existing tag, or reference value (which requires a RefTag)
        const resultTag = this.createTagWithValue(stmt.value, parentTag);
        if (existing?.properties) {
          // Clone properties with correct parent to preserve parent chains
          resultTag.properties = {};
          for (const [key, val] of Object.entries(existing.properties)) {
            resultTag.properties[key] = val.clone(resultTag);
          }
        }
        writeInto[writeKey] = resultTag;
      }
    } else {
      // name = value - simple assignment
      writeInto[writeKey] = this.createTagWithValue(stmt.value, parentTag);
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
    const [writeKey, writeInto, parentTag] = this.buildAccessPath(
      tag,
      stmt.path
    );

    if (stmt.preserveValue) {
      // name = ... { properties } - preserve value, replace properties
      const existing = writeInto[writeKey];
      const resultTag = new Tag({}, parentTag);
      if (existing) {
        resultTag.eq = existing.eq;
      }
      for (const propStmt of stmt.properties) {
        this.executeStatement(propStmt, resultTag);
      }
      writeInto[writeKey] = resultTag;
    } else {
      // name = { properties } - no value, replace properties
      const resultTag = new Tag({}, parentTag);
      for (const propStmt of stmt.properties) {
        this.executeStatement(propStmt, resultTag);
      }
      writeInto[writeKey] = resultTag;
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
    const [writeKey, writeInto, parentTag] = this.buildAccessPath(
      tag,
      stmt.path
    );
    // Create or reuse the result tag - this is the tag that will be stored
    // and that child tags will have as their parent
    const resultTag = writeInto[writeKey] ?? new Tag({}, parentTag);

    // Execute nested statements in the context of the result tag
    for (const propStmt of stmt.properties) {
      this.executeStatement(propStmt, resultTag);
    }

    writeInto[writeKey] = resultTag;
  }

  private executeDefine(
    stmt: {kind: 'define'; path: string[]; deleted: boolean},
    tag: Tag
  ): void {
    const [writeKey, writeInto, parentTag] = this.buildAccessPath(
      tag,
      stmt.path
    );
    if (stmt.deleted) {
      writeInto[writeKey] = new Tag({deleted: true}, parentTag);
    } else {
      writeInto[writeKey] = new Tag({}, parentTag);
    }
  }

  /**
   * Navigate to the parent of the final path segment, creating intermediate
   * tags as needed. Returns [finalKey, parentDict, parentTag] so caller can write to it.
   */
  private buildAccessPath(
    tag: Tag,
    path: string[]
  ): [string, Record<string, Tag>, Tag] {
    if (path.length === 0) {
      throw new Error('INTERNAL ERROR: buildAccessPath called with empty path');
    }

    let currentTag = tag;
    let parentDict = tag.getProperties();

    for (const segment of path.slice(0, -1)) {
      let next: Tag;
      if (parentDict[segment] === undefined) {
        next = new Tag({}, currentTag);
        parentDict[segment] = next;
      } else {
        // Ensure properties exists on this intermediate tag
        parentDict[segment].properties ??= {};
        next = parentDict[segment];
      }
      currentTag = next;
      parentDict = next.getProperties();
    }

    return [path[path.length - 1], parentDict, currentTag];
  }

  /**
   * Resolve array elements to Tag[] with proper parent links.
   */
  private resolveArrayWithParent(elements: ArrayElement[], parent: Tag): Tag[] {
    return elements.map(el => {
      // Reference without properties becomes a RefTag
      if (el.value?.kind === 'reference' && !el.properties) {
        return new RefTag(el.value.ups, el.value.path, parent);
      }

      const resultTag = new Tag({}, parent);

      if (el.value) {
        if (el.value.kind === 'array') {
          // Nested array
          resultTag.eq = this.resolveArrayWithParent(
            el.value.elements,
            resultTag
          );
        } else if (el.value.kind !== 'reference') {
          resultTag.eq = el.value.value;
        }
        // References with properties are ignored (just the properties are kept)
      }

      if (el.properties) {
        for (const stmt of el.properties) {
          this.executeStatement(stmt, resultTag);
        }
      }

      return resultTag;
    });
  }

  /**
   * Update an existing tag's value in place, preserving its properties.
   * Note: References must be handled separately since they require a RefTag.
   */
  private setTagValue(
    tag: Tag,
    valueData: Exclude<TagValue, {kind: 'reference'}>
  ): void {
    if (valueData.kind === 'array') {
      tag.eq = this.resolveArrayWithParent(valueData.elements, tag);
    } else {
      tag.eq = valueData.value;
    }
  }

  /**
   * Create a Tag with value, resolving arrays with proper parent links.
   * Returns a RefTag for reference values.
   */
  private createTagWithValue(valueData: TagValue, parent: Tag): Tag {
    if (valueData.kind === 'reference') {
      return new RefTag(valueData.ups, valueData.path, parent);
    }

    const resultTag = new Tag({}, parent);

    if (valueData.kind === 'array') {
      resultTag.eq = this.resolveArrayWithParent(valueData.elements, resultTag);
    } else {
      resultTag.eq = valueData.value;
    }

    return resultTag;
  }
}
