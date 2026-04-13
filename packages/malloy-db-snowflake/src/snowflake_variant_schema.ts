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
 * MERCHANTABILITY AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
 * COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
 * WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF
 * OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import type {AtomicTypeDef, Dialect, FieldDef} from '@malloydata/malloy';
import {TinyParser} from '@malloydata/malloy';
import {
  mkArrayTypeDef,
  mkFieldDef,
  pathToKey,
} from '@malloydata/malloy/internal';

export type NestedColumnKind = 'variant' | 'array' | 'object';

export interface NestedColumn {
  kind: NestedColumnKind;
  name: string;
}

export type Segment = {kind: 'name'; name: string} | {kind: 'array'};

export type Shape =
  | {kind: 'object'}
  | {kind: 'array'}
  | {kind: 'leaf'; type: string}
  | {kind: 'variant'};

export type PrefixKey = string;

export interface Children {
  elem?: PrefixKey;
  named: Map<string, PrefixKey>;
}

export interface VariantSchemaState {
  children: Map<PrefixKey, Children>;
  seededTopLevels: Set<PrefixKey>;
  shapes: Map<PrefixKey, Shape>;
}

export class PathParser extends TinyParser {
  constructor(pathName: string) {
    super(pathName, {
      quoted: /^'(\\'|[^'])*'/,
      array_of: /^\[\*]/,
      char: /^[[.\]]/,
      number: /^\d+/,
      word: /^\w+/,
    });
  }

  getName() {
    const nameStart = this.next();
    if (nameStart.type === 'word') {
      return nameStart.text;
    }
    if (nameStart.type === '[') {
      const quotedName = this.next('quoted');
      this.next(']');
      return quotedName.text;
    }
    throw this.parseError('Expected column name');
  }

  segments(): Segment[] {
    const segments: Segment[] = [{kind: 'name', name: this.getName()}];
    for (;;) {
      const sep = this.next();
      if (sep.type === 'eof') {
        return segments;
      }
      if (sep.type === '.') {
        segments.push({kind: 'name', name: this.next('word').text});
      } else if (sep.type === 'array_of') {
        segments.push({kind: 'array'});
      } else if (sep.type === '[') {
        const quoted = this.next('quoted');
        segments.push({kind: 'name', name: quoted.text});
        this.next(']');
      } else {
        throw this.parseError(`Unexpected ${sep.type}`);
      }
    }
  }
}

export function createVariantSchemaState(): VariantSchemaState {
  return {
    children: new Map(),
    seededTopLevels: new Set(),
    shapes: new Map(),
  };
}

export function mergeShape(
  existing: Shape | undefined,
  incoming: Shape
): Shape {
  if (existing === undefined) {
    return incoming;
  }
  if (existing.kind === 'variant' || incoming.kind === 'variant') {
    return {kind: 'variant'};
  }
  if (existing.kind !== incoming.kind) {
    return {kind: 'variant'};
  }
  if (
    existing.kind === 'leaf' &&
    incoming.kind === 'leaf' &&
    existing.type !== incoming.type
  ) {
    return {kind: 'variant'};
  }
  return existing;
}

export function seedTopLevelShape(
  state: VariantSchemaState,
  nestedColumn: NestedColumn
): void {
  const key = prefixKey([{kind: 'name', name: nestedColumn.name}]);
  if (nestedColumn.kind === 'array' || nestedColumn.kind === 'object') {
    state.seededTopLevels.add(key);
    state.shapes.set(key, {kind: nestedColumn.kind});
  }
}

export function accumulateVariantPath(
  state: VariantSchemaState,
  segments: Segment[],
  fieldType: string
): void {
  if (segments.length === 0) {
    return;
  }
  const topLevelKey = prefixKey(segments.slice(0, 1));
  const topLevelShape = state.shapes.get(topLevelKey);
  const topLevelIncoming =
    segments.length === 1
      ? observedTypeToShape(fieldType)
      : nextSegmentToShape(segments[1]);
  if (
    state.seededTopLevels.has(topLevelKey) &&
    topLevelShape &&
    (topLevelShape.kind === 'array' || topLevelShape.kind === 'object') &&
    topLevelShape.kind !== topLevelIncoming.kind
  ) {
    // Rule 1: top-level ARRAY/OBJECT from DESCRIBE are authoritative.
    // Ignore impossible sample rows rather than letting them override the seed.
    return;
  }
  let parentKey: PrefixKey | undefined;
  for (let i = 0; i < segments.length; i++) {
    const prefixSegments = segments.slice(0, i + 1);
    const key = prefixKey(prefixSegments);
    const impliedShape =
      i === segments.length - 1
        ? observedTypeToShape(fieldType)
        : nextSegmentToShape(segments[i + 1]);
    state.shapes.set(key, mergeShape(state.shapes.get(key), impliedShape));
    if (parentKey !== undefined) {
      recordChild(state, parentKey, segments[i], key);
    }
    parentKey = key;
  }
}

export function buildTopLevelField(
  nestedColumn: NestedColumn,
  state: VariantSchemaState,
  dialect: Dialect
): FieldDef {
  // Snowflake nested-schema inference follows these rules:
  // - top-level ARRAY/OBJECT from DESCRIBE are authoritative
  // - descendant paths imply ancestor shape
  // - conflicting shapes degrade only that prefix to variant
  // - every top-level nested column still produces a field
  const key = prefixKey([{kind: 'name', name: nestedColumn.name}]);
  const shape = state.shapes.get(key);
  if (shape === undefined) {
    return mkFieldDef(
      nestedColumn.kind === 'array'
        ? mkArrayTypeDef(opaqueVariantType())
        : opaqueVariantType(),
      nestedColumn.name
    );
  }
  return mkFieldDef(buildTypeForKey(key, state, dialect), nestedColumn.name);
}

function buildTypeForKey(
  key: PrefixKey,
  state: VariantSchemaState,
  dialect: Dialect
): AtomicTypeDef {
  const shape = state.shapes.get(key);
  if (shape === undefined || shape.kind === 'variant') {
    return opaqueVariantType();
  }
  if (shape.kind === 'leaf') {
    return dialect.sqlTypeToMalloyType(shape.type);
  }
  if (shape.kind === 'object') {
    const namedChildren = state.children.get(key)?.named;
    if (!namedChildren || namedChildren.size === 0) {
      return opaqueVariantType();
    }
    return {
      type: 'record',
      fields: [...namedChildren.entries()].map(([childName, childKey]) =>
        mkFieldDef(buildTypeForKey(childKey, state, dialect), childName)
      ),
    };
  }
  const elemKey = state.children.get(key)?.elem;
  const elementType = elemKey
    ? buildTypeForKey(elemKey, state, dialect)
    : opaqueVariantType();
  return mkArrayTypeDef(elementType);
}

function nextSegmentToShape(segment: Segment): Shape {
  return segment.kind === 'array' ? {kind: 'array'} : {kind: 'object'};
}

function observedTypeToShape(fieldType: string): Shape {
  // Defensive: production callers only pass Snowflake TYPEOF() results, which
  // are expected to be array/object or scalar leaf types, not "variant".
  if (
    fieldType === 'array' ||
    fieldType === 'object' ||
    fieldType === 'variant'
  ) {
    return {kind: fieldType};
  }
  return {kind: 'leaf', type: fieldType};
}

function recordChild(
  state: VariantSchemaState,
  parentKey: PrefixKey,
  segment: Segment,
  childKey: PrefixKey
): void {
  let children = state.children.get(parentKey);
  if (children === undefined) {
    children = {named: new Map()};
    state.children.set(parentKey, children);
  }
  if (segment.kind === 'array') {
    children.elem = childKey;
  } else {
    children.named.set(segment.name, childKey);
  }
}

function opaqueVariantType(): AtomicTypeDef {
  return {type: 'sql native', rawType: 'variant'};
}

function prefixKey(segments: Segment[]): PrefixKey {
  const [first, ...rest] = segments;
  if (first?.kind !== 'name') {
    throw new Error('Snowflake schema path must start with a named segment');
  }
  return pathToKey(
    first.name,
    rest.map(segment => (segment.kind === 'array' ? '[*]' : segment.name))
  );
}
